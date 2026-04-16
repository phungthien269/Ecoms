import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  NotificationCategory,
  ReportTargetType
} from "@ecoms/contracts";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { UpdateReportStatusDto } from "./dto/update-report-status.dto";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
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

  async listAdmin() {
    const reports = await this.prisma.report.findMany({
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
            slug: true
          }
        },
        shop: {
          select: {
            id: true,
            name: true,
            slug: true
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
      orderBy: [{ createdAt: "desc" }]
    });

    return reports.map((report) => ({
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
    }));
  }

  async updateStatus(userId: string, reportId: string, payload: UpdateReportStatusDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: {
            id: true
          }
        }
      }
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: payload.status,
        resolvedNote: payload.resolvedNote?.trim() || undefined,
        resolvedAt:
          payload.status === "RESOLVED" || payload.status === "DISMISSED"
            ? new Date()
            : null,
        resolvedById:
          payload.status === "RESOLVED" || payload.status === "DISMISSED"
            ? userId
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

    return {
      id: updated.id,
      status: updated.status,
      resolvedNote: updated.resolvedNote,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null
    };
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
