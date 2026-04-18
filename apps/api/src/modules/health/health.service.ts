import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { DependencyHealthEntry, HealthStatus, ReadinessStatus } from "@ecoms/contracts";
import { ConfigService } from "@nestjs/config";
import { FilesService } from "../files/files.service";
import { MailerService } from "../mailer/mailer.service";
import { PrismaService } from "../prisma/prisma.service";
import { RateLimitService } from "../rateLimit/rate-limit.service";
import { RealtimeStateService } from "../realtime/realtime-state.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
    private readonly filesService: FilesService,
    private readonly rateLimitService: RateLimitService,
    private readonly realtimeStateService: RealtimeStateService
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

  private toDetails(value: object): Record<string, unknown> {
    return value as Record<string, unknown>;
  }

  private async getChecks(): Promise<DependencyHealthEntry[]> {
    const providerProbesEnabled = this.configService.get<boolean>(
      "HEALTHCHECK_PROVIDER_PROBES_ENABLED",
      true
    );
    const [database, rateLimit, realtime] = await Promise.all([
      this.checkDatabase(),
      this.rateLimitService.getDiagnostics(),
      this.realtimeStateService.getDiagnostics()
    ]);
    const [mail, media] = providerProbesEnabled
      ? await Promise.all([
          this.mailerService.probeDiagnostics(),
          this.filesService.probeDiagnostics()
        ])
      : [this.mailerService.getDiagnostics(), this.filesService.getDiagnostics()];
    const loggingEnabled = this.configService.get<boolean>("REQUEST_LOGGING_ENABLED", true);

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
        details: this.toDetails(rateLimit)
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
        details: this.toDetails(realtime)
      },
      {
        key: "mail_driver",
        label: "Mail driver",
        status: mail.healthy ? "ok" : "degraded",
        message: mail.probeMessage ?? mail.message,
        details: this.toDetails(mail)
      },
      {
        key: "media_driver",
        label: "Media driver",
        status: media.healthy ? "ok" : "degraded",
        message:
          "probeMessage" in media && typeof media.probeMessage === "string"
            ? media.probeMessage
            : media.message,
        details: this.toDetails(media)
      },
      {
        key: "request_logging",
        label: "Request logging",
        status: loggingEnabled ? "ok" : "degraded",
        message: loggingEnabled ? "Structured request logging enabled" : "Request logging disabled",
        details: {
          enabled: loggingEnabled
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
          enabled: providerProbesEnabled
        }
      }
    ];
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
