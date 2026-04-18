import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentExpiryCoordinationService } from "./payment-expiry-coordination.service";
import { PaymentLifecycleService } from "./payment-lifecycle.service";
import { SystemSettingsService } from "../systemSettings/system-settings.service";

@Injectable()
export class PaymentExpirySchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentExpirySchedulerService.name);
  private timeout: NodeJS.Timeout | null = null;
  private running = false;
  private lastRunAt: string | null = null;
  private nextRunAt: string | null = null;
  private lastResult:
    | {
        expiredCount: number;
        cancelledOrderCount: number;
        skipped: boolean;
        skipReason?: "disabled" | "lease_held_elsewhere";
      }
    | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly paymentLifecycleService: PaymentLifecycleService,
    private readonly paymentExpiryCoordinationService: PaymentExpiryCoordinationService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly configService: ConfigService
  ) {}

  onModuleInit() {
    void this.scheduleNextRun(5_000);
  }

  onModuleDestroy() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  getDiagnostics() {
    return {
      enabled: this.lastResult?.skipReason === "disabled" ? false : true,
      running: this.running,
      lastRunAt: this.lastRunAt,
      nextRunAt: this.nextRunAt,
      lastResult: this.lastResult,
      lastError: this.lastError,
      coordination: this.paymentExpiryCoordinationService.getDiagnostics()
    };
  }

  private async scheduleNextRun(delayMs?: number) {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    const intervalMs = delayMs ?? ((await this.getSweepIntervalSeconds()) * 1000);
    const nextRun = new Date(Date.now() + intervalMs);
    this.nextRunAt = nextRun.toISOString();
    this.timeout = setTimeout(() => {
      void this.runCycle();
    }, intervalMs);
    this.timeout.unref?.();
  }

  private async runCycle() {
    if (this.running) {
      await this.scheduleNextRun();
      return;
    }

    this.running = true;
    this.lastRunAt = new Date().toISOString();

    try {
      const enabled = await this.getSweepEnabled();
      if (!enabled) {
        this.lastResult = {
          expiredCount: 0,
          cancelledOrderCount: 0,
          skipped: true,
          skipReason: "disabled"
        };
        this.lastError = null;
        return;
      }

      const intervalSeconds = await this.getSweepIntervalSeconds();
      const lease = await this.paymentExpiryCoordinationService.tryAcquireLease(
        this.getLeaseTtlMs(intervalSeconds)
      );
      if (!lease.acquired) {
        this.lastResult = {
          expiredCount: 0,
          cancelledOrderCount: 0,
          skipped: true,
          skipReason: "lease_held_elsewhere"
        };
        this.lastError = null;
        return;
      }

      const result = await this.paymentLifecycleService.expireStalePendingPayments();
      this.lastResult = {
        ...result,
        skipped: false
      };
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Unknown scheduler error";
      this.logger.warn(`Payment expiry sweep failed: ${this.lastError}`);
    } finally {
      this.running = false;
      await this.scheduleNextRun();
    }
  }

  private async getSweepEnabled() {
    try {
      return await this.systemSettingsService.getBooleanValue("payment_expiry_sweep_enabled");
    } catch {
      return this.configService.get<boolean>("PAYMENT_EXPIRY_SWEEP_ENABLED", true);
    }
  }

  private async getSweepIntervalSeconds() {
    try {
      return await this.systemSettingsService.getNumberValue("payment_expiry_sweep_interval_seconds");
    } catch {
      return this.configService.get<number>("PAYMENT_EXPIRY_SWEEP_INTERVAL_SECONDS", 60);
    }
  }

  private getLeaseTtlMs(intervalSeconds: number) {
    return Math.max(intervalSeconds * 2 * 1000, 30_000);
  }
}
