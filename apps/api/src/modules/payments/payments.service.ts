import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import {
  NotificationCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentWebhookEvent
} from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";
import { NotificationsService } from "../notifications/notifications.service";
import { OrderStatusHistoryService } from "../orderStatusHistory/order-status-history.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "../auditLogs/audit-logs.service";
import type { AuthPayload } from "../auth/types/auth-payload";
import type { AdminBatchReplayMockWebhookDto } from "./dto/admin-batch-replay-mock-webhook.dto";
import type { AdminBatchReplayProviderWebhookDto } from "./dto/admin-batch-replay-provider-webhook.dto";
import type { ListAdminProviderEventsDto } from "./dto/list-admin-provider-events.dto";
import type { AdminReplayMockWebhookDto } from "./dto/admin-replay-mock-webhook.dto";
import type { AdminReplayProviderWebhookDto } from "./dto/admin-replay-provider-webhook.dto";
import type { ListAdminPaymentsDto } from "./dto/list-admin-payments.dto";
import { PaymentEventsService } from "./payment-events.service";
import { PaymentGatewayService } from "./payment-gateway.service";
import { PaymentLifecycleService } from "./payment-lifecycle.service";
import {
  DemoGatewayWebhookDto,
  DemoGatewayWebhookStatus
} from "./dto/demo-gateway-webhook.dto";
import type { MockPaymentWebhookDto } from "./dto/mock-payment-webhook.dto";
import { SystemSettingsService } from "../systemSettings/system-settings.service";

type PaymentWithOrder = Prisma.PaymentGetPayload<{
  include: {
    order: true;
  };
}>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly orderStatusHistoryService: OrderStatusHistoryService,
    private readonly auditLogsService: AuditLogsService,
    private readonly paymentEventsService: PaymentEventsService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly paymentLifecycleService: PaymentLifecycleService,
    private readonly systemSettingsService: SystemSettingsService
  ) {}

  async confirm(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId
      },
      include: {
        order: true
      }
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.method === PaymentMethod.COD) {
      throw new ConflictException("COD payments do not require confirmation");
    }

    return this.applyPaymentTransition(payment, PaymentStatus.PAID, {
      source: "buyer_manual_confirm",
      occurredAt: new Date(),
      metadata: {
        flow: "manual_payment_confirmed"
      }
    });
  }

  async handleMockWebhook(
    payload: MockPaymentWebhookDto,
    signature: string | undefined,
    context?: {
      replayedBy?: AuthPayload | null;
    }
  ) {
    this.assertWebhookSignature(payload, signature);

    const payment = await this.prisma.payment.findFirst({
      where: payload.paymentId
        ? {
            id: payload.paymentId
          }
        : {
            referenceCode: payload.referenceCode
          },
      include: {
        order: true
      }
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.method === PaymentMethod.COD) {
      throw new ConflictException("COD payments do not accept webhook callbacks");
    }

    const nextStatus = this.mapWebhookEventToStatus(payload.event);
    const metadata = {
      flow: "mock_webhook",
      providerMode: "mock_gateway",
      providerContract: "mock_gateway",
      webhookEvent: payload.event,
      providerReference: payload.providerReference ?? null,
      ...this.buildReplayMetadata(context?.replayedBy)
    };
    const result = await this.applyPaymentTransition(payment, nextStatus, {
      source: "mock_webhook",
      occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
      metadata
    });
    await this.recordProviderCallbackOutcome(payment, result, "mock_webhook", metadata);
    return result;
  }

  async handleDemoGatewayWebhook(
    payload: DemoGatewayWebhookDto,
    signature: string | undefined,
    context?: {
      replayedBy?: AuthPayload | null;
    }
  ) {
    const providerDiagnostics = this.paymentGatewayService.getProviderDiagnostics();
    if (providerDiagnostics.mode !== "demo_gateway") {
      throw new ConflictException("Demo gateway callback is disabled in the current payment mode");
    }

    this.assertDemoGatewaySignature(payload, signature);
    if (providerDiagnostics.merchantCode && payload.merchantCode !== providerDiagnostics.merchantCode) {
      throw new UnauthorizedException("Invalid merchant code");
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        referenceCode: payload.referenceCode
      },
      include: {
        order: true
      }
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.method === PaymentMethod.COD) {
      throw new ConflictException("COD payments do not accept webhook callbacks");
    }

    const nextStatus = this.mapWebhookEventToStatus(
      this.paymentGatewayService.mapDemoGatewayStatus(payload.status)
    );
    const metadata = {
      flow: "demo_gateway_webhook",
      providerMode: "demo_gateway",
      providerContract: "demo_gateway",
      gatewayStatus: payload.status,
      providerReference: payload.providerReference,
      merchantCode: payload.merchantCode,
      ...this.buildReplayMetadata(context?.replayedBy)
    };
    const result = await this.applyPaymentTransition(payment, nextStatus, {
      source: "demo_gateway_webhook",
      occurredAt: new Date(payload.occurredAt),
      metadata
    });
    await this.recordProviderCallbackOutcome(payment, result, "demo_gateway_webhook", metadata);
    return result;
  }

  async expireStalePendingPayments() {
    return this.paymentLifecycleService.expireStalePendingPayments();
  }

  async replayMockWebhook(actor: AuthPayload, payload: AdminReplayMockWebhookDto) {
    const signature = this.paymentGatewayService.signWebhookPayload(payload);
    const result = await this.handleMockWebhook(payload, signature, {
      replayedBy: actor
    });

    await this.auditLogsService.record({
      actorUserId: actor.sub,
      actorRole: actor.role,
      action: "health.diagnostics.payment_gateway_replay",
      entityType: "HEALTH_DIAGNOSTIC",
      entityId: payload.paymentId ?? payload.referenceCode ?? undefined,
      summary: `Replayed ${payload.event} mock gateway callback for ${payload.paymentId ?? payload.referenceCode}`,
      metadata: {
        paymentId: payload.paymentId ?? null,
        referenceCode: payload.referenceCode ?? null,
        event: payload.event,
        providerReference: payload.providerReference ?? null,
        processed: result.processed,
        paymentStatus: result.paymentStatus,
        orderStatus: result.orderStatus
      }
    });

    return result;
  }

  async replayProviderWebhook(actor: AuthPayload, payload: AdminReplayProviderWebhookDto) {
    const diagnostics = this.paymentGatewayService.getProviderDiagnostics();

    if (diagnostics.mode === "demo_gateway") {
      let referenceCode = payload.referenceCode ?? "";
      if (!referenceCode && payload.paymentId) {
        const payment = await this.prisma.payment.findUnique({
          where: { id: payload.paymentId },
          select: { referenceCode: true }
        });

        if (!payment) {
          throw new NotFoundException("Payment not found");
        }
        referenceCode = payment.referenceCode;
      }

      const demoPayload: DemoGatewayWebhookDto = {
        merchantCode: diagnostics.merchantCode ?? "demo_merchant",
        referenceCode,
        status:
          payload.event === PaymentWebhookEvent.PAID
            ? DemoGatewayWebhookStatus.SUCCESS
            : payload.event === PaymentWebhookEvent.EXPIRED
              ? DemoGatewayWebhookStatus.EXPIRED
              : DemoGatewayWebhookStatus.FAILED,
        providerReference:
          payload.providerReference ??
          `demo-provider-${payload.paymentId ?? payload.referenceCode ?? "payment"}`,
        occurredAt: new Date().toISOString()
      };

      const signature = this.paymentGatewayService.signDemoGatewayPayload(demoPayload);
      const result = await this.handleDemoGatewayWebhook(demoPayload, signature, {
        replayedBy: actor
      });

      await this.auditLogsService.record({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: "health.diagnostics.payment_provider_replay",
        entityType: "HEALTH_DIAGNOSTIC",
        entityId: payload.paymentId ?? referenceCode,
        summary: `Replayed ${payload.event} provider callback via ${diagnostics.mode}`,
        metadata: {
          providerMode: diagnostics.mode,
          paymentId: payload.paymentId ?? null,
          referenceCode,
          event: payload.event,
          processed: result.processed,
          paymentStatus: result.paymentStatus,
          orderStatus: result.orderStatus
        }
      });

      return {
        providerMode: diagnostics.mode,
        providerContract: "demo_gateway",
        ...result
      };
    }

    const result = await this.replayMockWebhook(actor, payload);
    await this.auditLogsService.record({
      actorUserId: actor.sub,
      actorRole: actor.role,
      action: "health.diagnostics.payment_provider_replay",
      entityType: "HEALTH_DIAGNOSTIC",
      entityId: payload.paymentId ?? payload.referenceCode ?? undefined,
      summary: `Replayed ${payload.event} provider callback via ${diagnostics.mode}`,
      metadata: {
        providerMode: diagnostics.mode,
        paymentId: payload.paymentId ?? null,
        referenceCode: payload.referenceCode ?? null,
        event: payload.event,
        processed: result.processed,
        paymentStatus: result.paymentStatus,
        orderStatus: result.orderStatus
      }
    });

    return {
      providerMode: diagnostics.mode,
      providerContract: "mock_gateway",
      ...result
    };
  }

  async batchReplayMockWebhook(actor: AuthPayload, payload: AdminBatchReplayMockWebhookDto) {
    type ReplayTarget = {
      paymentId?: string;
      referenceCode?: string;
    };

    const targets: ReplayTarget[] = [
      ...(payload.paymentIds ?? []).map((paymentId) => ({ paymentId })),
      ...(payload.referenceCodes ?? []).map((referenceCode) => ({ referenceCode }))
    ];
    const uniqueTargets = Array.from(
      new Map(
        targets.map((target) => [
          target.paymentId ? `payment:${target.paymentId}` : `reference:${target.referenceCode}`,
          target
        ])
      ).values()
    );

    if (uniqueTargets.length === 0) {
      throw new ConflictException("At least one payment target is required");
    }

    const results: Array<{
      target: string;
      ok: boolean;
      paymentStatus?: string;
      orderStatus?: string;
      processed?: boolean;
      error?: string;
    }> = [];

    for (let index = 0; index < uniqueTargets.length; index += 1) {
      const target = uniqueTargets[index]!;
      try {
        const result = await this.replayMockWebhook(actor, {
          ...target,
          event: payload.event,
          providerReference: payload.providerReferencePrefix
            ? `${payload.providerReferencePrefix}-${index + 1}`
            : undefined
        });
        results.push({
          target: target.paymentId ?? target.referenceCode ?? "",
          ok: true,
          paymentStatus: result.paymentStatus,
          orderStatus: result.orderStatus,
          processed: result.processed
        });
      } catch (error) {
        results.push({
          target: target.paymentId ?? target.referenceCode ?? "",
          ok: false,
          error: error instanceof Error ? error.message : "Batch replay failed"
        });
      }
    }

    await this.auditLogsService.record({
      actorUserId: actor.sub,
      actorRole: actor.role,
      action: "health.diagnostics.payment_gateway_batch_replay",
      entityType: "HEALTH_DIAGNOSTIC",
      summary: `Batch replayed ${payload.event} mock gateway callbacks for ${uniqueTargets.length} payment target(s)`,
      metadata: {
        event: payload.event,
        targetCount: uniqueTargets.length,
        successCount: results.filter((item) => item.ok).length,
        failureCount: results.filter((item) => !item.ok).length,
        results
      }
    });

    return {
      event: payload.event,
      targetCount: uniqueTargets.length,
      successCount: results.filter((item) => item.ok).length,
      failureCount: results.filter((item) => !item.ok).length,
      results
    };
  }

  async batchReplayProviderWebhook(actor: AuthPayload, payload: AdminBatchReplayProviderWebhookDto) {
    type ReplayTarget = {
      paymentId?: string;
      referenceCode?: string;
    };

    const targets: ReplayTarget[] = [
      ...(payload.paymentIds ?? []).map((paymentId) => ({ paymentId })),
      ...(payload.referenceCodes ?? []).map((referenceCode) => ({ referenceCode }))
    ];
    const uniqueTargets = Array.from(
      new Map(
        targets.map((target) => [
          target.paymentId ? `payment:${target.paymentId}` : `reference:${target.referenceCode}`,
          target
        ])
      ).values()
    );

    if (uniqueTargets.length === 0) {
      throw new ConflictException("At least one payment target is required");
    }

    const results: Array<{
      target: string;
      ok: boolean;
      providerMode?: string;
      providerContract?: string;
      paymentStatus?: string;
      orderStatus?: string;
      processed?: boolean;
      error?: string;
    }> = [];

    for (let index = 0; index < uniqueTargets.length; index += 1) {
      const target = uniqueTargets[index]!;
      try {
        const result = await this.replayProviderWebhook(actor, {
          ...target,
          event: payload.event,
          providerReference: payload.providerReferencePrefix
            ? `${payload.providerReferencePrefix}-${index + 1}`
            : undefined
        });
        results.push({
          target: target.paymentId ?? target.referenceCode ?? "",
          ok: true,
          providerMode: result.providerMode,
          providerContract: result.providerContract,
          paymentStatus: result.paymentStatus,
          orderStatus: result.orderStatus,
          processed: result.processed
        });
      } catch (error) {
        results.push({
          target: target.paymentId ?? target.referenceCode ?? "",
          ok: false,
          error: error instanceof Error ? error.message : "Batch provider replay failed"
        });
      }
    }

    await this.auditLogsService.record({
      actorUserId: actor.sub,
      actorRole: actor.role,
      action: "health.diagnostics.payment_provider_batch_replay",
      entityType: "HEALTH_DIAGNOSTIC",
      summary: `Batch replayed ${payload.event} provider callbacks for ${uniqueTargets.length} payment target(s)`,
      metadata: {
        event: payload.event,
        targetCount: uniqueTargets.length,
        successCount: results.filter((item) => item.ok).length,
        failureCount: results.filter((item) => !item.ok).length,
        results
      }
    });

    return {
      event: payload.event,
      targetCount: uniqueTargets.length,
      successCount: results.filter((item) => item.ok).length,
      failureCount: results.filter((item) => !item.ok).length,
      results
    };
  }

  async listAdmin(query: ListAdminPaymentsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const where: Prisma.PaymentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentMethod ? { method: query.paymentMethod } : {}),
      ...(query.eventType
        ? {
            events: {
              some: {
                eventType: {
                  contains: query.eventType,
                  mode: "insensitive"
                }
              }
            }
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                referenceCode: {
                  contains: query.search,
                  mode: "insensitive"
                }
              },
              {
                order: {
                  is: {
                    orderNumber: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                user: {
                  is: {
                    fullName: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                user: {
                  is: {
                    email: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              shop: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          },
          events: {
            include: {
              actorUser: {
                select: {
                  id: true,
                  fullName: true,
                  role: true
                }
              }
            },
            orderBy: [{ createdAt: "desc" }],
            take: 5
          }
        }
      }),
      this.prisma.payment.count({ where })
    ]);

    return {
      items: items.map((payment) => ({
        id: payment.id,
        method: payment.method,
        status: payment.status,
        amount: payment.amount.toString(),
        referenceCode: payment.referenceCode,
        expiresAt: payment.expiresAt?.toISOString() ?? null,
        paidAt: payment.paidAt?.toISOString() ?? null,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
        user: payment.user,
        order: {
          id: payment.order.id,
          orderNumber: payment.order.orderNumber,
          status: payment.order.status,
          shop: payment.order.shop
        },
        recentEvents: payment.events.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          source: event.source,
          actorType: event.actorType,
          actorUser: event.actorUser
            ? {
                id: event.actorUser.id,
                fullName: event.actorUser.fullName,
                role: event.actorUser.role
              }
            : null,
          previousStatus: event.previousStatus,
          nextStatus: event.nextStatus,
          payload: (event.payload as Record<string, unknown> | null) ?? null,
          createdAt: event.createdAt.toISOString()
        }))
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async listAdminProviderEvents(query: ListAdminProviderEventsDto) {
    return this.paymentEventsService.listProviderEvents(query);
  }

  async getAdminIncidentCenter() {
    const [publicSettings, providerDiagnostics, incidentActivity, pendingOnlinePayments, recentNonSuccessPayments] =
      await Promise.all([
        this.systemSettingsService.getPublicSummary(),
        Promise.resolve(this.paymentGatewayService.getProviderDiagnostics()),
        this.auditLogsService.listPaymentIncidentActivity(),
        this.prisma.payment.findMany({
          where: {
            method: PaymentMethod.ONLINE_GATEWAY,
            status: PaymentStatus.PENDING
          },
          orderBy: [{ createdAt: "asc" }],
          take: 6,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                shop: {
                  select: {
                    id: true,
                    name: true,
                    slug: true
                  }
                }
              }
            }
          }
        }),
        this.prisma.payment.findMany({
          where: {
            method: PaymentMethod.ONLINE_GATEWAY,
            status: {
              in: [PaymentStatus.FAILED, PaymentStatus.EXPIRED]
            },
            updatedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 6,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                shop: {
                  select: {
                    id: true,
                    name: true,
                    slug: true
                  }
                }
              }
            }
          }
        })
      ]);

    const pendingAgeBuckets = {
      underFiveMinutes: 0,
      fiveToFifteenMinutes: 0,
      overFifteenMinutes: 0
    };
    for (const payment of pendingOnlinePayments) {
      const ageMinutes = Math.max(0, Math.floor((Date.now() - payment.createdAt.getTime()) / 60000));
      if (ageMinutes < 5) {
        pendingAgeBuckets.underFiveMinutes += 1;
      } else if (ageMinutes <= 15) {
        pendingAgeBuckets.fiveToFifteenMinutes += 1;
      } else {
        pendingAgeBuckets.overFifteenMinutes += 1;
      }
    }

    const recentFailureBreakdown = recentNonSuccessPayments.reduce(
      (summary, payment) => {
        if (payment.status === PaymentStatus.FAILED) {
          summary.failed += 1;
        }
        if (payment.status === PaymentStatus.EXPIRED) {
          summary.expired += 1;
        }
        return summary;
      },
      {
        failed: 0,
        expired: 0
      }
    );

    const affectedShops = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        pendingCount: number;
        failedOrExpiredCount: number;
        totalImpactedPayments: number;
      }
    >();
    const affectedCustomers = new Map<
      string,
      {
        id: string;
        fullName: string;
        email: string;
        pendingCount: number;
        failedOrExpiredCount: number;
        totalImpactedPayments: number;
      }
    >();

    const registerImpact = (
      payment: (typeof pendingOnlinePayments)[number] | (typeof recentNonSuccessPayments)[number],
      kind: "pending" | "failed"
    ) => {
      const shop = payment.order.shop;
      const currentShop = affectedShops.get(shop.id) ?? {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        pendingCount: 0,
        failedOrExpiredCount: 0,
        totalImpactedPayments: 0
      };
      if (kind === "pending") {
        currentShop.pendingCount += 1;
      } else {
        currentShop.failedOrExpiredCount += 1;
      }
      currentShop.totalImpactedPayments += 1;
      affectedShops.set(shop.id, currentShop);

      const customer = payment.user;
      const currentCustomer = affectedCustomers.get(customer.id) ?? {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        pendingCount: 0,
        failedOrExpiredCount: 0,
        totalImpactedPayments: 0
      };
      if (kind === "pending") {
        currentCustomer.pendingCount += 1;
      } else {
        currentCustomer.failedOrExpiredCount += 1;
      }
      currentCustomer.totalImpactedPayments += 1;
      affectedCustomers.set(customer.id, currentCustomer);
    };

    for (const payment of pendingOnlinePayments) {
      registerImpact(payment, "pending");
    }
    for (const payment of recentNonSuccessPayments) {
      registerImpact(payment, "failed");
    }

    const sortImpact = <
      T extends {
        totalImpactedPayments: number;
        pendingCount: number;
        failedOrExpiredCount: number;
      }
    >(
      items: T[]
    ) =>
      items
        .sort((left, right) => {
          if (right.totalImpactedPayments !== left.totalImpactedPayments) {
            return right.totalImpactedPayments - left.totalImpactedPayments;
          }
          if (right.pendingCount !== left.pendingCount) {
            return right.pendingCount - left.pendingCount;
          }
          return right.failedOrExpiredCount - left.failedOrExpiredCount;
        })
        .slice(0, 5);

    return {
      gateway: {
        enabled: publicSettings.paymentOnlineGatewayEnabled,
        incidentMessage: publicSettings.paymentIncidentMessage,
        provider: providerDiagnostics.provider,
        displayName: providerDiagnostics.displayName,
        mode: providerDiagnostics.mode,
        configured: providerDiagnostics.configured,
        actionHint: providerDiagnostics.actionHint
      },
      impact: {
        pendingCount: pendingOnlinePayments.length,
        recentFailedOrExpiredCount: recentNonSuccessPayments.length,
        oldestPendingAt: pendingOnlinePayments[0]?.createdAt.toISOString() ?? null,
        nextPendingExpiryAt:
          pendingOnlinePayments
            .map((payment) => payment.expiresAt)
            .filter((value): value is Date => Boolean(value))
            .sort((left, right) => left.getTime() - right.getTime())[0]
            ?.toISOString() ?? null,
        pendingAgeBuckets,
        recentFailureBreakdown,
        affectedShops: sortImpact(Array.from(affectedShops.values())),
        affectedCustomers: sortImpact(Array.from(affectedCustomers.values()))
      },
      pendingPayments: pendingOnlinePayments.map((payment) => ({
        id: payment.id,
        referenceCode: payment.referenceCode,
        amount: payment.amount.toString(),
        status: payment.status,
        createdAt: payment.createdAt.toISOString(),
        expiresAt: payment.expiresAt?.toISOString() ?? null,
        user: payment.user,
        order: {
          id: payment.order.id,
          orderNumber: payment.order.orderNumber,
          status: payment.order.status,
          shop: payment.order.shop
        }
      })),
      recentFailures: recentNonSuccessPayments.map((payment) => ({
        id: payment.id,
        referenceCode: payment.referenceCode,
        amount: payment.amount.toString(),
        status: payment.status,
        updatedAt: payment.updatedAt.toISOString(),
        user: payment.user,
        order: {
          id: payment.order.id,
          orderNumber: payment.order.orderNumber,
          status: payment.order.status,
          shop: payment.order.shop
        }
      })),
      activity: incidentActivity
    };
  }

  async getAdminTrace(query: { paymentId?: string; referenceCode?: string }) {
    const payment = await this.prisma.payment.findFirst({
      where: query.paymentId
        ? {
            id: query.paymentId
          }
        : {
            referenceCode: query.referenceCode
          },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            shop: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    const events = await this.paymentEventsService.listForPayment(payment.id);

    return {
      payment: {
        id: payment.id,
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        orderStatus: payment.order.status,
        user: payment.user,
        shop: payment.order.shop,
        method: payment.method,
        status: payment.status,
        amount: payment.amount.toString(),
        referenceCode: payment.referenceCode,
        expiresAt: payment.expiresAt?.toISOString() ?? null,
        paidAt: payment.paidAt?.toISOString() ?? null,
        metadata: (payment.metadata as Record<string, unknown> | null) ?? null,
        checkoutArtifact: this.paymentGatewayService.parseCheckoutArtifact(payment.metadata),
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString()
      },
      events
    };
  }

  private async applyPaymentTransition(
    payment: PaymentWithOrder,
    nextStatus: PaymentStatus,
    input: {
      source: string;
      occurredAt: Date;
      metadata: Record<string, unknown>;
    }
  ) {
    if (payment.status === nextStatus) {
      return {
        paymentId: payment.id,
        orderId: payment.orderId,
        paymentStatus: payment.status,
        orderStatus: payment.order.status,
        processed: false
      };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictException("Payment is already in a terminal state");
    }

    const currentOrderStatus = payment.order.status as OrderStatus;

    if (nextStatus === PaymentStatus.PAID && payment.expiresAt && payment.expiresAt < input.occurredAt) {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.EXPIRED,
            metadata: {
              ...(payment.metadata as Record<string, unknown> | null),
              expiredAt: input.occurredAt.toISOString(),
              flow: "payment_expired_before_confirmation"
            }
          }
        });

        await this.syncOrderForFailedPayment(tx, payment.orderId, currentOrderStatus, input.occurredAt);
      });

      throw new ConflictException("Payment has expired");
    }

    const orderStatus: OrderStatus =
      nextStatus === PaymentStatus.PAID
        ? currentOrderStatus === OrderStatus.PENDING
          ? OrderStatus.CONFIRMED
          : currentOrderStatus
        : currentOrderStatus === OrderStatus.PENDING
          ? OrderStatus.CANCELLED
          : currentOrderStatus;

    await this.prisma.$transaction(async (tx) => {
      const previousStatus = payment.status as PaymentStatus;
      const isGatewayTransition = ["mock_webhook", "demo_gateway_webhook"].includes(input.source);
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          paidAt: nextStatus === PaymentStatus.PAID ? input.occurredAt : null,
          metadata: {
            ...(payment.metadata as Record<string, unknown> | null),
            ...input.metadata,
            transitionedAt: input.occurredAt.toISOString(),
            paymentStatus: nextStatus
          }
        }
      });
      await this.paymentEventsService.record(
        {
          paymentId: payment.id,
          orderId: payment.orderId,
          eventType: `PAYMENT_${nextStatus}`,
          source: input.source,
          actorType: isGatewayTransition ? "PAYMENT_GATEWAY" : "CUSTOMER",
          actorUserId: isGatewayTransition ? null : payment.userId,
          previousStatus,
          nextStatus,
          payload: input.metadata
        },
        tx
      );
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: orderStatus
        }
      });

      if (orderStatus !== currentOrderStatus) {
        await this.orderStatusHistoryService.record(
          {
            orderId: payment.orderId,
            status: orderStatus,
            actorType: isGatewayTransition ? "PAYMENT_GATEWAY" : "BUYER",
            actorUserId: isGatewayTransition ? null : payment.userId,
            note: this.buildOrderTransitionNote(nextStatus, orderStatus),
            metadata: {
              paymentId: payment.id,
              paymentStatus: nextStatus,
              paymentMethod: payment.method,
              ...input.metadata
            }
          },
          tx
        );
      }
    });

    await this.emitPaymentNotifications(payment, nextStatus, orderStatus);

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      paymentStatus: nextStatus,
      orderStatus,
      processed: true
    };
  }

  private async emitPaymentNotifications(
    payment: PaymentWithOrder,
    paymentStatus: PaymentStatus,
    orderStatus: OrderStatus
  ) {
    const seller = await this.prisma.shop.findUnique({
      where: { id: payment.order.shopId },
      select: { ownerId: true, name: true }
    });

    if (paymentStatus === PaymentStatus.PAID) {
      await this.notificationsService.create({
        userId: payment.userId,
        category: NotificationCategory.ORDER_STATUS,
        title: "Payment confirmed",
        body: `${payment.order.orderNumber} is now ready for seller processing.`,
        linkUrl: `/orders/${payment.orderId}`
      });

      if (seller) {
        await this.notificationsService.create({
          userId: seller.ownerId,
          category: NotificationCategory.ORDER_STATUS,
          title: `Payment received for ${seller.name}`,
          body: `${payment.order.orderNumber} has been paid and can be confirmed.`,
          linkUrl: "/seller/orders"
        });
      }

      return;
    }

    if (orderStatus === OrderStatus.CANCELLED) {
      await this.notificationsService.create({
        userId: payment.userId,
        category: NotificationCategory.ORDER_STATUS,
        title: "Payment not completed",
        body: `${payment.order.orderNumber} was cancelled because payment did not complete.`,
        linkUrl: `/orders/${payment.orderId}`
      });
    }
  }

  private async syncOrderForFailedPayment(
    client: Prisma.TransactionClient,
    orderId: string,
    currentOrderStatus: OrderStatus,
    occurredAt: Date
  ) {
    if (currentOrderStatus !== OrderStatus.PENDING) {
      return;
    }

    await client.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED
      }
    });

    await this.orderStatusHistoryService.record(
      {
        orderId,
        status: OrderStatus.CANCELLED,
        actorType: "PAYMENT_GATEWAY",
        note: "Order auto-cancelled because payment expired before confirmation",
        metadata: {
          occurredAt: occurredAt.toISOString()
        }
      },
      client
    );
  }

  private buildReplayMetadata(actor?: AuthPayload | null) {
    if (!actor) {
      return {};
    }

    return {
      replayedByAdmin: true,
      replayedByAdminId: actor.sub,
      replayedByAdminRole: actor.role
    };
  }

  private async recordProviderCallbackOutcome(
    payment: PaymentWithOrder,
    result: {
      paymentId: string;
      orderId: string;
      paymentStatus: string;
      orderStatus: string;
      processed: boolean;
    },
    source: "mock_webhook" | "demo_gateway_webhook",
    metadata: Record<string, unknown>
  ) {
    await this.paymentEventsService.record({
      paymentId: payment.id,
      orderId: payment.orderId,
      eventType: result.processed ? "PAYMENT_CALLBACK_PROCESSED" : "PAYMENT_CALLBACK_IGNORED",
      source,
      actorType: "PAYMENT_GATEWAY",
      actorUserId: null,
      previousStatus: payment.status as PaymentStatus,
      nextStatus: result.paymentStatus as PaymentStatus,
      payload: {
        ...metadata,
        callbackOutcome: result.processed ? "processed" : "ignored"
      }
    });
  }

  private mapWebhookEventToStatus(event: PaymentWebhookEvent) {
    switch (event) {
      case PaymentWebhookEvent.PAID:
        return PaymentStatus.PAID;
      case PaymentWebhookEvent.FAILED:
        return PaymentStatus.FAILED;
      case PaymentWebhookEvent.EXPIRED:
        return PaymentStatus.EXPIRED;
      default:
        throw new ConflictException("Unsupported payment webhook event");
    }
  }

  private assertWebhookSignature(payload: MockPaymentWebhookDto, signature: string | undefined) {
    if (!signature) {
      throw new UnauthorizedException("Missing webhook signature");
    }

    const expectedSignature = this.paymentGatewayService.signWebhookPayload(payload);

    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Invalid webhook signature");
    }
  }

  private assertDemoGatewaySignature(
    payload: DemoGatewayWebhookDto,
    signature: string | undefined
  ) {
    if (!signature) {
      throw new UnauthorizedException("Missing webhook signature");
    }

    const expectedSignature = this.paymentGatewayService.signDemoGatewayPayload(payload);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Invalid webhook signature");
    }
  }

  private buildOrderTransitionNote(paymentStatus: PaymentStatus, orderStatus: OrderStatus) {
    if (paymentStatus === PaymentStatus.PAID && orderStatus === OrderStatus.CONFIRMED) {
      return "Payment confirmed and order moved to confirmed";
    }

    if ([PaymentStatus.FAILED, PaymentStatus.EXPIRED].includes(paymentStatus) && orderStatus === OrderStatus.CANCELLED) {
      return "Order cancelled because payment did not complete";
    }

    return `Order status updated after payment transition to ${paymentStatus}`;
  }
}
