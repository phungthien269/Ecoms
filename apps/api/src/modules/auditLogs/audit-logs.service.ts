import { Injectable } from "@nestjs/common";
import type { AuditLogSummary } from "@ecoms/contracts";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListAuditLogsDto } from "./dto/list-audit-logs.dto";

type AuditLogRecord = Prisma.AuditLogGetPayload<{
  include: {
    actorUser: {
      select: {
        id: true;
        fullName: true;
        email: true;
      };
    };
  };
}>;

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmin(query: ListAuditLogsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action
        ? {
            action: {
              contains: query.action,
              mode: "insensitive"
            }
          }
        : {}),
      ...(query.entityType
        ? {
            entityType: {
              contains: query.entityType,
              mode: "insensitive"
            }
          }
        : {}),
      ...(query.actorRole
        ? {
            actorRole: {
              equals: query.actorRole
            }
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                summary: {
                  contains: query.search,
                  mode: "insensitive"
                }
              },
              {
                entityId: {
                  contains: query.search,
                  mode: "insensitive"
                }
              },
              {
                actorUser: {
                  is: {
                    fullName: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                actorUser: {
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
      this.prisma.auditLog.findMany({
        where,
        include: {
          actorUser: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      items: items.map((item) => this.serialize(item)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async record(
    payload: {
      actorUserId?: string | null;
      actorRole: string;
      action: string;
      entityType: string;
      entityId?: string | null;
      summary: string;
      metadata?: Record<string, unknown> | null;
    },
    prisma: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    return prisma.auditLog.create({
      data: {
        actorUserId: payload.actorUserId ?? undefined,
        actorRole: payload.actorRole,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId ?? undefined,
        summary: payload.summary,
        metadata: (payload.metadata ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
  }

  private serialize(item: AuditLogRecord): AuditLogSummary {
    return {
      id: item.id,
      actorRole: item.actorRole,
      action: item.action,
      entityType: item.entityType,
      entityId: item.entityId ?? null,
      summary: item.summary,
      metadata: (item.metadata as Record<string, unknown> | null) ?? null,
      createdAt: item.createdAt.toISOString(),
      actorUser: item.actorUser
    };
  }
}
