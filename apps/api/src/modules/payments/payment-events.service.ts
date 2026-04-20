import { Injectable } from "@nestjs/common";
import type { PaymentEventSummary, PaymentStatus, UserRole } from "@ecoms/contracts";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PaymentEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: {
      paymentId: string;
      orderId: string;
      eventType: string;
      source: string;
      actorType: string;
      actorUserId?: string | null;
      previousStatus?: PaymentStatus | null;
      nextStatus: PaymentStatus;
      payload?: Record<string, unknown> | null;
    },
    prisma: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    return prisma.paymentEvent.create({
      data: {
        paymentId: input.paymentId,
        orderId: input.orderId,
        eventType: input.eventType,
        source: input.source,
        actorType: input.actorType,
        actorUserId: input.actorUserId ?? undefined,
        previousStatus: input.previousStatus ?? undefined,
        nextStatus: input.nextStatus,
        payload: input.payload as Prisma.InputJsonValue | undefined
      }
    });
  }

  async listForPayment(paymentId: string): Promise<PaymentEventSummary[]> {
    const events = await this.prisma.paymentEvent.findMany({
      where: {
        paymentId
      },
      include: {
        actorUser: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        }
      },
      orderBy: [{ createdAt: "asc" }]
    });

    return events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      source: event.source,
      actorType: event.actorType,
      actorUser: event.actorUser
        ? {
            id: event.actorUser.id,
            fullName: event.actorUser.fullName,
            role: event.actorUser.role as UserRole
          }
        : null,
      previousStatus: (event.previousStatus as PaymentStatus | null) ?? null,
      nextStatus: event.nextStatus as PaymentStatus,
      payload: (event.payload as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt.toISOString()
    }));
  }

  async listProviderEvents(query: {
    search?: string;
    eventType?: string;
    providerMode?: "mock_gateway" | "demo_gateway";
    callbackOutcome?: "processed" | "ignored";
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const allowedSources =
      query.providerMode === "mock_gateway"
        ? ["mock_webhook"]
        : query.providerMode === "demo_gateway"
          ? ["demo_gateway_webhook"]
          : ["mock_webhook", "demo_gateway_webhook"];
    const eventTypeFilter = query.callbackOutcome
      ? query.callbackOutcome === "processed"
        ? "PAYMENT_CALLBACK_PROCESSED"
        : "PAYMENT_CALLBACK_IGNORED"
      : undefined;
    const where: Prisma.PaymentEventWhereInput = {
      source: {
        in: allowedSources
      },
      ...(eventTypeFilter
        ? {
            eventType: eventTypeFilter
          }
        : query.eventType
        ? {
            eventType: {
              contains: query.eventType,
              mode: "insensitive"
            }
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                payment: {
                  is: {
                    referenceCode: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                payment: {
                  is: {
                    order: {
                      is: {
                        orderNumber: {
                          contains: query.search,
                          mode: "insensitive"
                        }
                      }
                    }
                  }
                }
              },
              {
                payment: {
                  is: {
                    user: {
                      is: {
                        fullName: {
                          contains: query.search,
                          mode: "insensitive"
                        }
                      }
                    }
                  }
                }
              },
              {
                payment: {
                  is: {
                    user: {
                      is: {
                        email: {
                          contains: query.search,
                          mode: "insensitive"
                        }
                      }
                    }
                  }
                }
              }
            ]
          }
        : {})
    };

    const [items, total, processedCount, ignoredCount, mockGatewayCount, demoGatewayCount] =
      await this.prisma.$transaction([
        this.prisma.paymentEvent.findMany({
          where,
          orderBy: [{ createdAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            actorUser: {
              select: {
                id: true,
                fullName: true,
                role: true
              }
            },
            payment: {
              select: {
                id: true,
                referenceCode: true,
                status: true,
                method: true,
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
            }
          }
        }),
        this.prisma.paymentEvent.count({ where }),
        this.prisma.paymentEvent.count({
          where: {
            ...where,
            eventType: "PAYMENT_CALLBACK_PROCESSED"
          }
        }),
        this.prisma.paymentEvent.count({
          where: {
            ...where,
            eventType: "PAYMENT_CALLBACK_IGNORED"
          }
        }),
        this.prisma.paymentEvent.count({
          where: {
            ...where,
            source: "mock_webhook"
          }
        }),
        this.prisma.paymentEvent.count({
          where: {
            ...where,
            source: "demo_gateway_webhook"
          }
        })
      ]);

    return {
      items: items.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        source: event.source,
        actorType: event.actorType,
        actorUser: event.actorUser
          ? {
              id: event.actorUser.id,
              fullName: event.actorUser.fullName,
              role: event.actorUser.role as UserRole
            }
          : null,
        previousStatus: (event.previousStatus as PaymentStatus | null) ?? null,
        nextStatus: event.nextStatus as PaymentStatus,
        payload: (event.payload as Record<string, unknown> | null) ?? null,
        createdAt: event.createdAt.toISOString(),
        payment: {
          id: event.payment.id,
          referenceCode: event.payment.referenceCode,
          status: event.payment.status,
          method: event.payment.method
        },
        user: event.payment.user,
        order: {
          id: event.payment.order.id,
          orderNumber: event.payment.order.orderNumber,
          status: event.payment.order.status,
          shop: event.payment.order.shop
        }
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      },
      summary: {
        processedCount,
        ignoredCount,
        mockGatewayCount,
        demoGatewayCount
      }
    };
  }
}
