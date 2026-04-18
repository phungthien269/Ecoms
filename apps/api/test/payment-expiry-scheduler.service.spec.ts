import { PaymentExpirySchedulerService } from "../src/modules/payments/payment-expiry-scheduler.service";

describe("PaymentExpirySchedulerService", () => {
  const paymentLifecycleService = {
    expireStalePendingPayments: jest.fn()
  };
  const systemSettingsService = {
    getBooleanValue: jest.fn(),
    getNumberValue: jest.fn()
  };
  const configService = {
    get: jest.fn().mockImplementation((key: string, fallback?: unknown) => fallback)
  };

  const service = new PaymentExpirySchedulerService(
    paymentLifecycleService as never,
    systemSettingsService as never,
    configService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    systemSettingsService.getBooleanValue.mockResolvedValue(true);
    systemSettingsService.getNumberValue.mockResolvedValue(60);
    paymentLifecycleService.expireStalePendingPayments.mockResolvedValue({
      expiredCount: 2,
      cancelledOrderCount: 1
    });
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it("schedules and runs expiry sweeps", async () => {
    service.onModuleInit();

    await jest.advanceTimersByTimeAsync(5_000);

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

    expect(paymentLifecycleService.expireStalePendingPayments).not.toHaveBeenCalled();
    expect(service.getDiagnostics().lastResult).toEqual({
      expiredCount: 0,
      cancelledOrderCount: 0,
      skipped: true
    });
  });
});
