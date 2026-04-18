import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AuditLogSummary,
  PublicSystemSettingsSummary,
  SystemSettingSummary
} from "@ecoms/contracts";
import type { AuthPayload } from "../auth/types/auth-payload";
import { AuditLogsService } from "../auditLogs/audit-logs.service";
import { PrismaService } from "../prisma/prisma.service";

type SettingDefinition = {
  key: string;
  category: string;
  label: string;
  description: string;
  valueType: "STRING" | "NUMBER" | "BOOLEAN";
  defaultValue: string | number | boolean;
  min?: number;
  max?: number;
};

const settingDefinitions: SettingDefinition[] = [
  {
    key: "marketplace_name",
    category: "branding",
    label: "Marketplace name",
    description: "Primary storefront and admin display name.",
    valueType: "STRING",
    defaultValue: "Ecoms"
  },
  {
    key: "support_email",
    category: "support",
    label: "Support email",
    description: "Primary support contact shown in operations and messaging.",
    valueType: "STRING",
    defaultValue: "support@ecoms.local"
  },
  {
    key: "payment_timeout_minutes",
    category: "checkout",
    label: "Online payment timeout (minutes)",
    description: "Pending online payments expire after this many minutes.",
    valueType: "NUMBER",
    defaultValue: 15,
    min: 5,
    max: 60
  },
  {
    key: "payment_expiry_sweep_enabled",
    category: "operations",
    label: "Enable payment expiry sweep",
    description: "Controls background cleanup of expired pending online payments.",
    valueType: "BOOLEAN",
    defaultValue: true
  },
  {
    key: "payment_expiry_sweep_interval_seconds",
    category: "operations",
    label: "Payment expiry sweep interval (seconds)",
    description: "How often the background payment expiry sweep runs.",
    valueType: "NUMBER",
    defaultValue: 60,
    min: 15,
    max: 3600
  },
  {
    key: "provider_probes_enabled",
    category: "operations",
    label: "Enable provider probes",
    description: "Controls whether readiness performs live mail/media provider probes.",
    valueType: "BOOLEAN",
    defaultValue: true
  },
  {
    key: "return_request_window_days",
    category: "orders",
    label: "Return request window (days)",
    description: "Buyers can request returns until this many days after delivery.",
    valueType: "NUMBER",
    defaultValue: 7,
    min: 1,
    max: 30
  },
  {
    key: "seller_registration_enabled",
    category: "seller",
    label: "Allow new seller registration",
    description: "Controls whether users may create new shop registrations.",
    valueType: "BOOLEAN",
    defaultValue: true
  },
  {
    key: "order_auto_complete_days",
    category: "orders",
    label: "Order auto-complete days",
    description: "Operational target for future auto-complete jobs after delivery.",
    valueType: "NUMBER",
    defaultValue: 3,
    min: 1,
    max: 14
  },
  {
    key: "default_product_weight_grams",
    category: "shipping",
    label: "Default product weight (grams)",
    description: "Fallback weight used in checkout shipping when a product has no explicit weight.",
    valueType: "NUMBER",
    defaultValue: 300,
    min: 1,
    max: 100000
  },
  {
    key: "shipping_fee_hn",
    category: "shipping",
    label: "Base shipping fee - Hanoi",
    description: "Base shipping fee in VND for HN region orders up to 500g.",
    valueType: "NUMBER",
    defaultValue: 18000,
    min: 0,
    max: 200000
  },
  {
    key: "shipping_fee_hcm",
    category: "shipping",
    label: "Base shipping fee - Ho Chi Minh City",
    description: "Base shipping fee in VND for HCM region orders up to 500g.",
    valueType: "NUMBER",
    defaultValue: 18000,
    min: 0,
    max: 200000
  },
  {
    key: "shipping_fee_central",
    category: "shipping",
    label: "Base shipping fee - Central region",
    description: "Base shipping fee in VND for CENTRAL region orders up to 500g.",
    valueType: "NUMBER",
    defaultValue: 28000,
    min: 0,
    max: 200000
  },
  {
    key: "shipping_fee_other",
    category: "shipping",
    label: "Base shipping fee - Other regions",
    description: "Base shipping fee in VND for OTHER region orders up to 500g.",
    valueType: "NUMBER",
    defaultValue: 35000,
    min: 0,
    max: 200000
  },
  {
    key: "shipping_fee_extra_per_500g",
    category: "shipping",
    label: "Extra shipping fee per 500g block",
    description: "Additional shipping fee in VND per started 500g above the first 500g.",
    valueType: "NUMBER",
    defaultValue: 6000,
    min: 0,
    max: 100000
  },
  {
    key: "media_upload_url_ttl_seconds",
    category: "operations",
    label: "Media upload URL TTL (seconds)",
    description: "Signed upload URLs expire after this many seconds.",
    valueType: "NUMBER",
    defaultValue: 900,
    min: 60,
    max: 7200
  }
];

const definitionMap = new Map(settingDefinitions.map((item) => [item.key, item]));
const publicSettingKeys = [
  "marketplace_name",
  "support_email",
  "payment_timeout_minutes",
  "order_auto_complete_days"
] as const;

@Injectable()
export class SystemSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async listAdmin(): Promise<SystemSettingSummary[]> {
    const existing = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: settingDefinitions.map((item) => item.key)
        }
      },
      include: {
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: [{ category: "asc" }, { key: "asc" }]
    });

    const existingMap = new Map(existing.map((item) => [item.key, item]));

    return settingDefinitions.map((definition) => {
      const record = existingMap.get(definition.key);
      return {
        key: definition.key,
        category: definition.category,
        label: definition.label,
        description: definition.description,
        valueType: definition.valueType,
        value: record ? this.normalizeStoredValue(record.value, definition.valueType) : definition.defaultValue,
        updatedAt: record?.updatedAt.toISOString() ?? null,
        updatedBy: record?.updatedBy ?? null
      };
    });
  }

  async getPublicSummary(): Promise<PublicSystemSettingsSummary> {
    const [marketplaceName, supportEmail, paymentTimeoutMinutes, orderAutoCompleteDays] =
      await Promise.all([
        this.getStringValue("marketplace_name"),
        this.getStringValue("support_email"),
        this.getNumberValue("payment_timeout_minutes"),
        this.getNumberValue("order_auto_complete_days")
      ]);

    return {
      marketplaceName,
      supportEmail,
      paymentTimeoutMinutes,
      orderAutoCompleteDays
    };
  }

  async listPublic() {
    const adminItems = await this.listAdmin();
    return adminItems.filter((item) =>
      publicSettingKeys.includes(item.key as (typeof publicSettingKeys)[number])
    );
  }

  async listHistory(key?: string): Promise<
    Array<{
      setting: SystemSettingSummary;
      events: Array<
        AuditLogSummary & {
          previousValue: string | number | boolean | null;
          nextValue: string | number | boolean | null;
        }
      >;
    }>
  > {
    const settings = await this.listAdmin();
    const selectedSettings = key
      ? settings.filter((item) => item.key === key)
      : settings;

    if (key && selectedSettings.length === 0) {
      throw new NotFoundException("System setting not found");
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        entityType: "SYSTEM_SETTING",
        action: "system_settings.admin.update",
        ...(key ? { entityId: key } : {})
      },
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
      take: key ? 20 : 100
    });

    const groupedLogs = new Map<string, typeof auditLogs>();
    for (const log of auditLogs) {
      const settingKey = log.entityId;
      if (!settingKey) {
        continue;
      }

      const current = groupedLogs.get(settingKey) ?? [];
      current.push(log);
      groupedLogs.set(settingKey, current);
    }

    return selectedSettings.map((setting) => ({
      setting,
      events: (groupedLogs.get(setting.key) ?? []).map((log) => ({
        id: log.id,
        actorRole: log.actorRole,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        summary: log.summary,
        metadata: (log.metadata as Record<string, unknown> | null) ?? null,
        createdAt: log.createdAt.toISOString(),
        actorUser: log.actorUser,
        previousValue: this.normalizeAuditValue(
          (log.metadata as Record<string, unknown> | null)?.previousValue,
          setting.valueType
        ),
        nextValue: this.normalizeAuditValue(
          (log.metadata as Record<string, unknown> | null)?.nextValue,
          setting.valueType
        )
      }))
    }));
  }

  async update(actor: AuthPayload, key: string, rawValue: string): Promise<SystemSettingSummary> {
    const definition = definitionMap.get(key);
    if (!definition) {
      throw new NotFoundException("System setting not found");
    }

    const nextValue = this.parseValue(definition, rawValue);
    const previous = await this.prisma.systemSetting.findUnique({
      where: { key }
    });

    const updated = await this.prisma.systemSetting.upsert({
      where: { key },
      update: {
        category: definition.category,
        label: definition.label,
        description: definition.description,
        value: nextValue,
        updatedById: actor.sub
      },
      create: {
        key,
        category: definition.category,
        label: definition.label,
        description: definition.description,
        value: nextValue,
        updatedById: actor.sub
      },
      include: {
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    await this.auditLogsService.record({
      actorUserId: actor.sub,
      actorRole: actor.role,
      action: "system_settings.admin.update",
      entityType: "SYSTEM_SETTING",
      entityId: key,
      summary: `Updated system setting ${key}`,
      metadata: {
        previousValue: previous?.value ?? null,
        nextValue
      }
    });

    return {
      key: definition.key,
      category: definition.category,
      label: definition.label,
      description: definition.description,
      valueType: definition.valueType,
      value: this.normalizeStoredValue(updated.value, definition.valueType),
      updatedAt: updated.updatedAt.toISOString(),
      updatedBy: updated.updatedBy
    };
  }

  async getNumberValue(key: string) {
    const definition = definitionMap.get(key);
    if (!definition || definition.valueType !== "NUMBER") {
      throw new NotFoundException("Numeric system setting not found");
    }

    const value = await this.getValue(key);
    return typeof value === "number" ? value : Number(definition.defaultValue);
  }

  async getStringValue(key: string) {
    const definition = definitionMap.get(key);
    if (!definition || definition.valueType !== "STRING") {
      throw new NotFoundException("String system setting not found");
    }

    const value = await this.getValue(key);
    return typeof value === "string" ? value : String(definition.defaultValue);
  }

  async getBooleanValue(key: string) {
    const definition = definitionMap.get(key);
    if (!definition || definition.valueType !== "BOOLEAN") {
      throw new NotFoundException("Boolean system setting not found");
    }

    const value = await this.getValue(key);
    return typeof value === "boolean" ? value : Boolean(definition.defaultValue);
  }

  private async getValue(key: string) {
    const definition = definitionMap.get(key);
    if (!definition) {
      throw new NotFoundException("System setting not found");
    }

    const record = await this.prisma.systemSetting.findUnique({
      where: { key }
    });

    if (!record) {
      return definition.defaultValue;
    }

    return this.normalizeStoredValue(record.value, definition.valueType);
  }

  private normalizeStoredValue(value: unknown, valueType: SettingDefinition["valueType"]) {
    if (valueType === "NUMBER") {
      return typeof value === "number" ? value : Number(value);
    }

    if (valueType === "BOOLEAN") {
      return typeof value === "boolean" ? value : value === "true";
    }

    return typeof value === "string" ? value : String(value ?? "");
  }

  private normalizeAuditValue(
    value: unknown,
    valueType: SettingDefinition["valueType"]
  ): string | number | boolean | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.normalizeStoredValue(value, valueType);
  }

  private parseValue(definition: SettingDefinition, rawValue: string) {
    if (definition.valueType === "STRING") {
      const value = rawValue.trim();
      if (!value) {
        throw new BadRequestException(`${definition.label} cannot be empty`);
      }
      return value;
    }

    if (definition.valueType === "BOOLEAN") {
      if (!["true", "false"].includes(rawValue)) {
        throw new BadRequestException(`${definition.label} must be true or false`);
      }
      return rawValue === "true";
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      throw new BadRequestException(`${definition.label} must be a valid number`);
    }

    if (definition.min !== undefined && value < definition.min) {
      throw new BadRequestException(`${definition.label} must be at least ${definition.min}`);
    }

    if (definition.max !== undefined && value > definition.max) {
      throw new BadRequestException(`${definition.label} must be at most ${definition.max}`);
    }

    return value;
  }
}
