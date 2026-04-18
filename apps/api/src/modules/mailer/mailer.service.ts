import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: string[];
}

interface MailerDiagnostics {
  driver: string;
  configured: boolean;
  healthy: boolean;
  message: string;
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
}

@Injectable()
export class MailerService {
  constructor(private readonly configService: ConfigService) {}

  async send(input: SendEmailInput) {
    const driver = this.configService.get<string>("MAIL_DRIVER", "console");

    if (driver === "resend") {
      return this.sendWithResend(input);
    }

    console.log(
      JSON.stringify({
        level: "info",
        type: "email_sent",
        driver: "console",
        to: input.to,
        subject: input.subject,
        tags: input.tags ?? [],
        at: new Date().toISOString()
      })
    );

    return {
      accepted: true,
      driver: "console"
    };
  }

  async sendSafely(input: SendEmailInput) {
    try {
      return await this.send(input);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          type: "email_send_failed",
          driver: this.configService.get<string>("MAIL_DRIVER", "console"),
          to: input.to,
          subject: input.subject,
          error: error instanceof Error ? error.message : "Unknown email error",
          at: new Date().toISOString()
        })
      );

      return {
        accepted: false,
        driver: this.configService.get<string>("MAIL_DRIVER", "console")
      };
    }
  }

  getDiagnostics(): MailerDiagnostics {
    const driver = this.configService.get<string>("MAIL_DRIVER", "console");
    const fromEmail = this.configService.get<string>("MAIL_FROM_EMAIL", "no-reply@ecoms.local");
    const fromName = this.configService.get<string>("MAIL_FROM_NAME", "Ecoms");
    const replyTo = this.configService.get<string>("MAIL_REPLY_TO_EMAIL") ?? null;

    if (driver === "resend") {
      const hasApiKey = Boolean(this.configService.get<string>("RESEND_API_KEY"));
      return {
        driver,
        configured: hasApiKey,
        healthy: hasApiKey,
        message: hasApiKey
          ? "Resend driver configured"
          : "MAIL_DRIVER=resend but RESEND_API_KEY is missing",
        fromEmail,
        fromName,
        replyTo
      };
    }

    return {
      driver,
      configured: true,
      healthy: true,
      message: "Console mail driver active",
      fromEmail,
      fromName,
      replyTo
    };
  }

  private async sendWithResend(input: SendEmailInput) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY");
    const fromEmail = this.configService.get<string>("MAIL_FROM_EMAIL", "no-reply@ecoms.local");
    const fromName = this.configService.get<string>("MAIL_FROM_NAME", "Ecoms");
    const replyTo = this.configService.get<string>("MAIL_REPLY_TO_EMAIL");

    if (!apiKey) {
      throw new Error("RESEND_API_KEY is required when MAIL_DRIVER=resend");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: replyTo || undefined,
        tags: input.tags?.map((tag) => ({
          name: tag,
          value: "true"
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Resend request failed with status ${response.status}`);
    }

    return {
      accepted: true,
      driver: "resend"
    };
  }
}
