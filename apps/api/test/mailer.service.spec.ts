import { MailerService } from "../src/modules/mailer/mailer.service";

describe("MailerService", () => {
  const originalFetch = global.fetch;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  afterEach(() => {
    global.fetch = originalFetch;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    jest.restoreAllMocks();
  });

  it("logs email delivery in console mode", async () => {
    console.log = jest.fn();
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          MAIL_DRIVER: "console"
        };
        return values[key] ?? fallback;
      })
    };
    const service = new MailerService(configService as never);

    const result = await service.send({
      to: "buyer@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello"
    });

    expect(result).toEqual({
      accepted: true,
      driver: "console"
    });
    expect(console.log).toHaveBeenCalled();
  });

  it("posts email delivery through resend when configured", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true
    }) as never;
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          MAIL_DRIVER: "resend",
          RESEND_API_KEY: "resend-key",
          MAIL_FROM_EMAIL: "no-reply@ecoms.local",
          MAIL_FROM_NAME: "Ecoms"
        };
        return values[key] ?? fallback;
      })
    };
    const service = new MailerService(configService as never);

    const result = await service.send({
      to: "buyer@example.com",
      subject: "Order placed",
      html: "<p>Placed</p>",
      text: "Placed"
    });

    expect(result).toEqual({
      accepted: true,
      driver: "resend"
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST"
      })
    );
  });
});
