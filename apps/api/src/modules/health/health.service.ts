import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { DependencyHealthEntry, HealthStatus, ReadinessStatus } from "@ecoms/contracts";
import { ConfigService } from "@nestjs/config";
import type { AuthPayload } from "../auth/types/auth-payload";
import { AuditLogsService } from "../auditLogs/audit-logs.service";
import { FilesService } from "../files/files.service";
import { MailerService } from "../mailer/mailer.service";
import { PaymentExpirySchedulerService } from "../payments/payment-expiry-scheduler.service";
import { PrismaService } from "../prisma/prisma.service";
import { RateLimitService } from "../rateLimit/rate-limit.service";
import { RealtimeStateService } from "../realtime/realtime-state.service";
import { SystemSettingsService } from "../systemSettings/system-settings.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
    private readonly mailerService: MailerService,
    private readonly filesService: FilesService,
    private readonly rateLimitService: RateLimitService,
    private readonly realtimeStateService: RealtimeStateService,
    private readonly paymentExpirySchedulerService: PaymentExpirySchedulerService,
    private readonly systemSettingsService: SystemSettingsService
  ) {}

  getHealth(): HealthStatus {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "ecoms-api"
    };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    const checks = await this.getChecks();
    const hasCriticalFailure = checks.some(
      (check) => check.key === "database" && check.status === "fail"
    );
    const hasDegraded = checks.some((check) => check.status === "degraded");

    return {
      status: hasCriticalFailure ? "fail" : hasDegraded ? "degraded" : "ok",
      timestamp: new Date().toISOString(),
      service: "ecoms-api",
      ready: !hasCriticalFailure,
      checks
    };
  }

  async assertReady() {
    const readiness = await this.getReadiness();
    if (!readiness.ready) {
      throw new ServiceUnavailableException(readiness);
    }

    return readiness;
  }

  async getDiagnostics() {
    return this.getReadiness();
  }

  async sendTestEmail(actor: AuthPayload, recipientEmail: string, subject?: string) {
    const marketplaceName = await this.getMarketplaceName();
    const resolvedSubject = subject?.trim() || `${marketplaceName} diagnostics test email`;
    const result = await this.mailerService.sendSafely({
      to: recipientEmail,
      subject: resolvedSubject,
      html: `<p>This is a provider verification email from <strong>${marketplaceName}</strong>.</p>`,
      text: `This is a provider verification email from ${marketplaceName}.`,
      tags: ["diagnostics", "test-email"]
    });

    await this.auditLogsService.record({
      actorUserId: actor.sub,
      actorRole: actor.role,
      action: "health.diagnostics.test_email",
      entityType: "HEALTH_DIAGNOSTIC",
      entityId: recipientEmail,
      summary: `Triggered diagnostics test email to ${recipientEmail}`,
      metadata: {
        driver: result.driver,
        accepted: result.accepted,
        recipientEmail,
        subject: resolvedSubject
      }
    });

    return {
      accepted: result.accepted,
      driver: result.driver,
      recipientEmail,
      subject: resolvedSubject
    };
  }

  async getMediaUploadSample(actor: AuthPayload) {
    const sample = await this.filesService.createDiagnosticUploadSample();

    await this.auditLogsService.record({
      actorUserId: actor.sub,
      actorRole: actor.role,
      action: "health.diagnostics.media_upload_sample",
      entityType: "HEALTH_DIAGNOSTIC",
      entityId: sample.objectKey,
      summary: `Generated diagnostics media upload sample for ${sample.driver}`,
      metadata: {
        driver: sample.driver,
        objectKey: sample.objectKey,
        strategy: sample.upload.strategy,
        method: sample.upload.method,
        expiresAt: sample.upload.expiresAt
      }
    });

    return sample;
  }

  async getDiagnosticsActivity() {
    return this.auditLogsService.listDiagnosticsActivity();
  }

  private toDetails(value: object): Record<string, unknown> {
    return value as Record<string, unknown>;
  }

  private async getChecks(): Promise<DependencyHealthEntry[]> {
    const providerProbesEnabled = await this.getProviderProbesEnabled();
    const [database, rateLimit, realtime] = await Promise.all([
      this.checkDatabase(),
      this.rateLimitService.getDiagnostics(),
      this.realtimeStateService.getDiagnostics()
    ]);
    const paymentExpiryScheduler = this.paymentExpirySchedulerService.getDiagnostics();
    const [mail, media] = providerProbesEnabled
      ? await Promise.all([
          this.mailerService.probeDiagnostics(),
          this.filesService.probeDiagnostics()
        ])
      : [this.mailerService.getDiagnostics(), this.filesService.getDiagnostics()];
    const loggingEnabled = this.configService.get<boolean>("REQUEST_LOGGING_ENABLED", true);
    const paymentExpirySchedulerActionHint = paymentExpiryScheduler.lastError
      ? "Inspect scheduler logs and payment sweep configuration."
      : paymentExpiryScheduler.lastResult?.skipReason === "disabled"
        ? "Enable payment expiry sweep to enforce timeouts without user interaction."
        : paymentExpiryScheduler.coordination.fallbackActive
          ? "Restore Redis coordination to prevent duplicate sweeps across instances."
          : "No action required";
    const paymentExpirySchedulerMessage = paymentExpiryScheduler.lastError
      ? paymentExpiryScheduler.lastError
      : paymentExpiryScheduler.lastResult?.skipReason === "disabled"
        ? "Payment expiry scheduler disabled"
        : paymentExpiryScheduler.lastResult?.skipReason === "lease_held_elsewhere"
          ? "Payment expiry sweep lease held by another instance"
          : paymentExpiryScheduler.coordination.message || "Payment expiry scheduler active";

    return [
      database,
      {
        key: "rate_limit_store",
        label: "Rate limit store",
        status: rateLimit.healthy
          ? rateLimit.fallbackActive
            ? "degraded"
            : "ok"
          : "degraded",
        message: rateLimit.message,
        details: this.toDetails({
          ...rateLimit,
          actionHint: rateLimit.fallbackActive
            ? "Bring Redis back to restore shared rate limiting across instances."
            : "No action required",
          source: rateLimit.fallbackActive ? "runtime_fallback" : "active_store"
        })
      },
      {
        key: "realtime_state_store",
        label: "Realtime state store",
        status: realtime.healthy
          ? realtime.fallbackActive
            ? "degraded"
            : "ok"
          : "degraded",
        message: realtime.message,
        details: this.toDetails({
          ...realtime,
          actionHint: realtime.fallbackActive
            ? "Restore Redis to recover cross-instance presence and unread state."
            : "No action required",
          source: realtime.fallbackActive ? "runtime_fallback" : "active_store"
        })
      },
      {
        key: "payment_expiry_scheduler",
        label: "Payment expiry scheduler",
        status:
          paymentExpiryScheduler.lastError
            ? "degraded"
            : paymentExpiryScheduler.coordination.fallbackActive
              ? "degraded"
              : paymentExpiryScheduler.lastResult?.skipReason === "disabled"
                ? "degraded"
              : "ok",
        message: paymentExpirySchedulerMessage,
        details: {
          ...paymentExpiryScheduler,
          source: "system_setting_or_env_fallback",
          actionHint: paymentExpirySchedulerActionHint
        }
      },
      {
        key: "mail_driver",
        label: "Mail driver",
        status: mail.healthy ? "ok" : "degraded",
        message: mail.probeMessage ?? mail.message,
        details: this.toDetails({
          ...mail,
          source: providerProbesEnabled ? "system_setting" : "env_fallback",
          actionHint: mail.healthy
            ? "No action required"
            : "Check mail credentials and outbound provider availability."
        })
      },
      {
        key: "media_driver",
        label: "Media driver",
        status: media.healthy ? "ok" : "degraded",
        message:
          "probeMessage" in media && typeof media.probeMessage === "string"
            ? media.probeMessage
            : media.message,
        details: this.toDetails({
          ...media,
          source: providerProbesEnabled ? "system_setting" : "env_fallback",
          actionHint: media.healthy
            ? "No action required"
            : "Verify media driver credentials, endpoint, and signed-upload configuration."
        })
      },
      {
        key: "request_logging",
        label: "Request logging",
        status: loggingEnabled ? "ok" : "degraded",
        message: loggingEnabled ? "Structured request logging enabled" : "Request logging disabled",
        details: {
          enabled: loggingEnabled,
          source: "env",
          actionHint: loggingEnabled
            ? "No action required"
            : "Enable request logging for production tracing."
        }
      },
      {
        key: "provider_probes",
        label: "Provider probes",
        status: providerProbesEnabled ? "ok" : "degraded",
        message: providerProbesEnabled
          ? "External provider probes enabled"
          : "External provider probes disabled",
        details: {
          enabled: providerProbesEnabled,
          source: "system_setting_or_env_fallback",
          actionHint: providerProbesEnabled
            ? "No action required"
            : "Enable probes if you need live verification of mail/media providers."
        }
      }
    ];
  }

  private async getProviderProbesEnabled() {
    try {
      return await this.systemSettingsService.getBooleanValue("provider_probes_enabled");
    } catch {
      return this.configService.get<boolean>("HEALTHCHECK_PROVIDER_PROBES_ENABLED", true);
    }
  }

  private async getMarketplaceName() {
    try {
      return await this.systemSettingsService.getStringValue("marketplace_name");
    } catch {
      return "Ecoms";
    }
  }

  private async checkDatabase(): Promise<DependencyHealthEntry> {
    try {
      await this.prisma.ping();
      return {
        key: "database",
        label: "PostgreSQL",
        status: "ok",
        message: "Database reachable"
      };
    } catch (error) {
      return {
        key: "database",
        label: "PostgreSQL",
        status: "fail",
        message: error instanceof Error ? error.message : "Database unreachable"
      };
    }
  }
}
