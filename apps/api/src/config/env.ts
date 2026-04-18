import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  MAIL_DRIVER: z.enum(["console", "resend"]).default("console"),
  MAIL_FROM_EMAIL: z.string().email().default("no-reply@ecoms.local"),
  MAIL_FROM_NAME: z.string().default("Ecoms"),
  MAIL_REPLY_TO_EMAIL: z.string().email().optional(),
  RESEND_API_KEY: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  REQUEST_LOGGING_ENABLED: booleanFromEnv.default(true),
  REALTIME_STATE_STORE: z.enum(["memory", "redis"]).default("memory"),
  REALTIME_REDIS_PREFIX: z.string().default("ecoms:realtime"),
  RATE_LIMIT_STORE: z.enum(["memory", "redis"]).default("memory"),
  RATE_LIMIT_REDIS_PREFIX: z.string().default("ecoms:rate-limit"),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  REPORT_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  REPORT_RATE_LIMIT_MAX: z.coerce.number().default(6),
  CHAT_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  CHAT_RATE_LIMIT_MAX: z.coerce.number().default(30),
  FILE_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  FILE_RATE_LIMIT_MAX: z.coerce.number().default(20),
  MEDIA_DRIVER: z.enum(["local", "s3", "cloudinary"]).default("s3"),
  MEDIA_UPLOAD_URL_TTL_SECONDS: z.coerce.number().default(900),
  MEDIA_PUBLIC_BASE_URL: z.string().url().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: booleanFromEnv.default(true),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  return envSchema.parse(config);
}
