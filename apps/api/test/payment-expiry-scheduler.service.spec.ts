import { PaymentExpiryCoordinationService } from "../src/modules/payments/payment-expiry-coordination.service";
import { PaymentExpirySchedulerService } from "../src/modules/payments/payment-expiry-scheduler.service";

describe("PaymentExpirySchedulerService", () => {
  const paymentLifecycleService = {
    expireStalePendingPayments: jest.fn()
  };
  const paymentExpiryCoordinationService = {
    tryAcquireLease: jest.fn(),
    getDiagnostics: jest.fn()
  } satisfies Partial<PaymentExpiryCoordinationService>;
  const systemSettingsService = {
    getBooleanValue: jest.fn(),
    getNumberValue: jest.fn()
  };
  const configService = {
    get: jest.fn().mockImplementation((key: string, fallback?: unknown) => fallback)
  };

  const service = new PaymentExpirySchedulerService(
    paymentLifecycleService as never,
    paymentExpiryCoordinationService as never,
    systemSettingsService as never,
    configService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    systemSettingsService.getBooleanValue.mockResolvedValue(true);
    systemSettingsService.getNumberValue.mockResolvedValue(60);
    paymentExpiryCoordinationService.tryAcquireLease.mockResolvedValue({
      acquired: true,
      owner: "instance-1"
    });
    paymentExpiryCoordinationService.getDiagnostics.mockReturnValue({
      preferredStore: "memory",
      activeStore: "memory",
      configured: true,
      healthy: true,
      fallbackActive: false,
      instanceId: "instance-1",
      lastOwner: "instance-1",
      message: "Memory coordination active"
    });
    paymentLifecycleService.expireStalePendingPayments.mockResolvedValue({
      expiredCount: 2,
      cancelledOrderCount: 1
    });
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it("schedules and runs expiry sweeps under a lease", async () => {
    service.onModuleInit();

    await jest.advanceTimersByTimeAsync(5_000);

    expect(paymentExpiryCoordinationService.tryAcquireLease).toHaveBeenCalledWith(120_000);
    expect(paymentLifecycleService.expireStalePendingPayments).toHaveBeenCalledWith();
    expect(service.getDiagnostics().lastResult).toEqual({
      expiredCount: 2,
      cancelledOrderCount: 1,
      skipped: false
    });
  });

  it("skips sweeps when disabled", async () => {
    systemSettingsService.getBooleanValue.mockResolvedValue(false);
    service.onModuleInit();

    await jest.advanceTimersByTimeAsync(5_000);

    expect(paymentExpiryCoordinationService.tryAcquireLease).not.toHaveBeenCalled();
    expect(paymentLifecycleService.expireStalePendingPayments).not.toHaveBeenCalled();
    expect(service.getDiagnostics().lastResult).toEqual({
      expiredCount: 0,
      cancelledOrderCount: 0,
      skipped: true,
      skipReason: "disabled"
    });
  });

  it("skips sweeps when another instance holds the lease", async () => {
    paymentExpiryCoordinationService.tryAcquireLease.mockResolvedValue({
      acquired: false,
      owner: "instance-2"
    });
    service.onModuleInit();

    await jest.advanceTimersByTimeAsync(5_000);

    expect(paymentLifecycleService.expireStalePendingPayments).not.toHaveBeenCalled();
    expect(service.getDiagnostics().lastResult).toEqual({
      expiredCount: 0,
      cancelledOrderCount: 0,
      skipped: true,
      skipReason: "lease_held_elsewhere"
    });
  });
});
