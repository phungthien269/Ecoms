import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
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
