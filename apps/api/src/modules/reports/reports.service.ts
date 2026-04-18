import {
  ConflictException,
  Injectable,
  BadRequestException,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  NotificationCategory,
  ReportTargetType
} from "@ecoms/contracts";
import { AuditLogsService } from "../auditLogs/audit-logs.service";
import type { AuthPayload } from "../auth/types/auth-payload";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { ListAdminReportsDto } from "./dto/list-admin-reports.dto";
import {
  ReportModerationAction,
  UpdateReportStatusDto
} from "./dto/update-report-status.dto";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async create(userId: string, payload: CreateReportDto) {
    const target = await this.resolveTarget(payload.targetType, payload.targetId);

    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId: userId,
        targetType: payload.targetType,
        ...(payload.targetType === "PRODUCT" ? { productId: payload.targetId } : {}),
        ...(payload.targetType === "SHOP" ? { shopId: payload.targetId } : {}),
        ...(payload.targetType === "REVIEW" ? { reviewId: payload.targetId } : {}),
        status: {
          in: ["OPEN", "IN_REVIEW"]
        }
      }
    });

    if (existing) {
      throw new ConflictException("You already have an active report for this target");
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: payload.targetType,
        reason: payload.reason.trim(),
        details: payload.details?.trim() || undefined,
        ...(payload.targetType === "PRODUCT" ? { productId: payload.targetId } : {}),
        ...(payload.targetType === "SHOP" ? { shopId: payload.targetId } : {}),
        ...(payload.targetType === "REVIEW" ? { reviewId: payload.targetId } : {})
      }
    });

    const admins = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        role: {
          in: ["ADMIN", "SUPER_ADMIN"]
        }
      },
      select: {
        id: true
      }
    });

    await Promise.all(
      admins.map((admin) =>
        this.notificationsService.create({
          userId: admin.id,
          category: NotificationCategory.SYSTEM,
          title: "New moderation report submitted",
          body: `${payload.targetType} report created for ${target.label}.`,
          linkUrl: "/admin"
        })
      )
    );

    return {
      id: report.id,
      targetType: report.targetType,
      targetId: payload.targetId,
      reason: report.reason,
      details: report.details,
      status: report.status,
      resolvedNote: report.resolvedNote,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString()
    };
  }

  async listAdmin(query: ListAdminReportsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const where: Prisma.ReportWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.search
        ? {
            OR: [
              {
                reason: {
                  contains: query.search,
                  mode: "insensitive"
                }
              },
              {
                details: {
                  contains: query.search,
                  mode: "insensitive"
                }
              },
              {
                reporter: {
                  is: {
                    fullName: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                reporter: {
                  is: {
                    email: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                product: {
                  is: {
                    name: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                shop: {
                  is: {
                    name: {
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

    const [reports, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: {
          reporter: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          resolvedBy: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true
            }
          },
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              ownerId: true
            }
          },
          review: {
            select: {
              id: true,
              comment: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          }
        },
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.report.count({ where })
    ]);

    return {
      items: reports.map((report) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.productId ?? report.shopId ?? report.reviewId ?? "",
      reason: report.reason,
      details: report.details,
      status: report.status,
      resolvedNote: report.resolvedNote,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
      reporter: report.reporter,
      resolvedBy: report.resolvedBy,
      target:
        report.targetType === "PRODUCT"
          ? report.product
          : report.targetType === "SHOP"
            ? report.shop
            : report.review
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async updateStatus(actor: AuthPayload, reportId: string, payload: UpdateReportStatusDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: {
            id: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            shop: {
              select: {
                ownerId: true,
                name: true
              }
            }
          }
        },
        shop: {
          select: {
            id: true,
            name: true,
            ownerId: true
          }
        }
      }
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    const moderationResult = await this.applyModerationAction(report, payload.moderationAction);

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: payload.status,
        resolvedNote: this.buildResolvedNote(payload.resolvedNote, moderationResult.note),
        resolvedAt:
          payload.status === "RESOLVED" || payload.status === "DISMISSED"
          ? new Date()
            : null,
        resolvedById:
          payload.status === "RESOLVED" || payload.status === "DISMISSED"
            ? actor.sub
            : null
      }
    });

    await this.notificationsService.create({
      userId: report.reporter.id,
      category: NotificationCategory.SYSTEM,
      title: "Your report was updated",
      body: `Moderation moved your report to ${updated.status}.`,
      linkUrl: "/notifications"
    });

    if (moderationResult.ownerNotification) {
      await this.notificationsService.create(moderationResult.ownerNotification);
    }

    await this.auditLogsService.record({
      actorUserId: actor.sub,
      actorRole: actor.role,
      action: "reports.admin.update_status",
      entityType: "REPORT",
      entityId: reportId,
      summary: `Updated report ${reportId} to ${payload.status}`,
      metadata: {
        previousStatus: report.status,
        nextStatus: payload.status,
        moderationAction: payload.moderationAction ?? null
      }
    });

    return {
      id: updated.id,
      status: updated.status,
      resolvedNote: updated.resolvedNote,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null
    };
  }

  private async applyModerationAction(
    report: {
      targetType: string;
      product: {
        id: string;
        name: string;
        shop: { ownerId: string; name: string };
      } | null;
      shop: {
        id: string;
        name: string;
        ownerId: string;
      } | null;
    },
    moderationAction: ReportModerationAction | undefined
  ) {
    if (!moderationAction || moderationAction === ReportModerationAction.NONE) {
      return {
        note: null,
        ownerNotification: null
      };
    }

    if (moderationAction === ReportModerationAction.BAN_PRODUCT) {
      if (!report.product) {
        throw new BadRequestException("This report does not target a product");
      }

      await this.prisma.product.update({
        where: { id: report.product.id },
        data: { status: "BANNED" }
      });

      return {
        note: `Target action: product banned`,
        ownerNotification: {
          userId: report.product.shop.ownerId,
          category: NotificationCategory.SYSTEM,
          title: "A product from your shop was banned",
          body: `${report.product.name} was banned after moderation review.`,
          linkUrl: "/seller"
        }
      };
    }

    if (moderationAction === ReportModerationAction.ACTIVATE_PRODUCT) {
      if (!report.product) {
        throw new BadRequestException("This report does not target a product");
      }

      await this.prisma.product.update({
        where: { id: report.product.id },
        data: { status: "ACTIVE" }
      });

      return {
        note: `Target action: product activated`,
        ownerNotification: {
          userId: report.product.shop.ownerId,
          category: NotificationCategory.SYSTEM,
          title: "A product from your shop was restored",
          body: `${report.product.name} was restored after moderation review.`,
          linkUrl: "/seller"
        }
      };
    }

    if (moderationAction === ReportModerationAction.SUSPEND_SHOP) {
      if (!report.shop) {
        throw new BadRequestException("This report does not target a shop");
      }

      await this.prisma.shop.update({
        where: { id: report.shop.id },
        data: { status: "SUSPENDED" }
      });

      return {
        note: `Target action: shop suspended`,
        ownerNotification: {
          userId: report.shop.ownerId,
          category: NotificationCategory.SYSTEM,
          title: "Your shop was suspended",
          body: `${report.shop.name} was suspended after moderation review.`,
          linkUrl: "/seller"
        }
      };
    }

    if (moderationAction === ReportModerationAction.ACTIVATE_SHOP) {
      if (!report.shop) {
        throw new BadRequestException("This report does not target a shop");
      }

      await this.prisma.shop.update({
        where: { id: report.shop.id },
        data: { status: "ACTIVE" }
      });

      return {
        note: `Target action: shop activated`,
        ownerNotification: {
          userId: report.shop.ownerId,
          category: NotificationCategory.SYSTEM,
          title: "Your shop was restored",
          body: `${report.shop.name} was restored after moderation review.`,
          linkUrl: "/seller"
        }
      };
    }

    return {
      note: null,
      ownerNotification: null
    };
  }

  private buildResolvedNote(resolvedNote: string | undefined, actionNote: string | null) {
    const note = resolvedNote?.trim() || "";
    if (note && actionNote) {
      return `${note} | ${actionNote}`;
    }

    return note || actionNote || undefined;
  }

  private async resolveTarget(targetType: ReportTargetType, targetId: string) {
    if (targetType === "PRODUCT") {
      const product = await this.prisma.product.findFirst({
        where: { id: targetId, deletedAt: null },
        select: { id: true, name: true }
      });

      if (!product) {
        throw new NotFoundException("Report target not found");
      }

      return { label: product.name };
    }

    if (targetType === "SHOP") {
      const shop = await this.prisma.shop.findFirst({
        where: { id: targetId, deletedAt: null },
        select: { id: true, name: true }
      });

      if (!shop) {
        throw new NotFoundException("Report target not found");
      }

      return { label: shop.name };
    }

    const review = await this.prisma.review.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        product: {
          select: {
            name: true
          }
        }
      }
    });

    if (!review) {
      throw new NotFoundException("Report target not found");
    }

    return { label: `review for ${review.product.name}` };
  }
}
