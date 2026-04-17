import { RateLimitService } from "../src/modules/rateLimit/rate-limit.service";

describe("RateLimitService", () => {
  const service = new RateLimitService();

  it("allows requests within the configured limit", () => {
    const first = service.consume("auth:127.0.0.1", 2, 1000);
    const second = service.consume("auth:127.0.0.1", 2, 1000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it("blocks requests after the configured limit", () => {
    service.consume("chat:127.0.0.2", 1, 1000);
    const blocked = service.consume("chat:127.0.0.2", 1, 1000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
