import { ConfigService } from "@nestjs/config";
import { PaymentExpiryCoordinationService } from "../src/modules/payments/payment-expiry-coordination.service";

describe("PaymentExpiryCoordinationService", () => {
  it("uses memory coordination by default", async () => {
    const configService = {
      get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
        if (key === "PAYMENT_EXPIRY_COORDINATION_STORE") {
          return "memory";
        }

        return fallback;
      })
    } satisfies Partial<ConfigService>;

    const service = new PaymentExpiryCoordinationService(configService as never);
    const lease = await service.tryAcquireLease(30_000);

    expect(lease.acquired).toBe(true);
    expect(service.getDiagnostics()).toEqual(
      expect.objectContaining({
        preferredStore: "memory",
        activeStore: "memory",
        fallbackActive: false
      })
    );
  });

  it("falls back to memory when redis coordination is preferred without redis url", async () => {
    const configService = {
      get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
        if (key === "PAYMENT_EXPIRY_COORDINATION_STORE") {
          return "redis";
        }
        if (key === "REDIS_URL") {
          return undefined;
        }
        if (key === "PAYMENT_EXPIRY_REDIS_PREFIX") {
          return "ecoms:payment-expiry";
        }

        return fallback;
      })
    } satisfies Partial<ConfigService>;

    const service = new PaymentExpiryCoordinationService(configService as never);
    const lease = await service.tryAcquireLease(30_000);

    expect(lease.acquired).toBe(true);
    expect(service.getDiagnostics()).toEqual(
      expect.objectContaining({
        preferredStore: "redis",
        activeStore: "memory",
        fallbackActive: true,
        message: "Redis coordination unavailable, using in-memory lease"
      })
    );
  });
});
