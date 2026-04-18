import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import type {
  FileAssetSummary,
  FileUploadIntentSummary
} from "@ecoms/contracts";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { SystemSettingsService } from "../systemSettings/system-settings.service";
import { CreateUploadIntentDto } from "./dto/create-upload-intent.dto";

type UploadInstruction = FileUploadIntentSummary["upload"];

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly systemSettingsService: SystemSettingsService
  ) {}

  async listOwn(userId: string): Promise<FileAssetSummary[]> {
    const assets = await this.prisma.fileAsset.findMany({
      where: { createdById: userId },
      orderBy: [{ createdAt: "desc" }],
      take: 50
    });

    return assets.map((asset) => this.serialize(asset));
  }

  async createUploadIntent(
    userId: string,
    payload: CreateUploadIntentDto
  ): Promise<FileUploadIntentSummary> {
    const driver = this.configService.get<string>("MEDIA_DRIVER") ?? "s3";
    const bucket = driver === "s3" ? this.configService.get<string>("S3_BUCKET") ?? null : null;
    const objectKey = this.buildObjectKey(payload.folder, payload.filename);
    const publicUrl = this.resolvePublicUrl(driver, objectKey);
    const upload = await this.buildUploadInstruction(driver, objectKey, publicUrl, payload);

    const asset = await this.prisma.fileAsset.create({
      data: {
        createdById: userId,
        driver,
        bucket,
        objectKey,
        originalName: payload.filename,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        url: publicUrl,
        status: "PENDING",
        metadata: {
          folder: payload.folder ?? null,
          uploadStrategy: upload.strategy,
          expiresAt: upload.expiresAt
        }
      }
    });

    return {
      asset: this.serialize(asset),
      upload
    };
  }

  async complete(
    userId: string,
    fileAssetId: string,
    status: "PENDING" | "READY" | "FAILED" = "READY"
  ) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: fileAssetId,
        createdById: userId
      }
    });

    if (!asset) {
      throw new NotFoundException("File asset not found");
    }

    const updated = await this.prisma.fileAsset.update({
      where: { id: fileAssetId },
      data: {
        status
      }
    });

    return this.serialize(updated);
  }

  async requireOwnedReadyAsset(userId: string, fileAssetId: string) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: fileAssetId,
        createdById: userId
      }
    });

    if (!asset) {
      throw new NotFoundException("File asset not found");
    }

    if (asset.status !== "READY") {
      throw new ConflictException("File asset is not ready for reuse");
    }

    return asset;
  }

  async requireOwnedReadyAssets(userId: string, fileAssetIds: string[]) {
    if (fileAssetIds.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(fileAssetIds)];
    const assets = await this.prisma.fileAsset.findMany({
      where: {
        id: {
          in: uniqueIds
        },
        createdById: userId
      }
    });

    if (assets.length !== uniqueIds.length) {
      throw new NotFoundException("One or more file assets were not found");
    }

    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

    return fileAssetIds.map((fileAssetId) => {
      const asset = assetMap.get(fileAssetId);
      if (!asset) {
        throw new NotFoundException("One or more file assets were not found");
      }

      if (asset.status !== "READY") {
        throw new ConflictException("One or more file assets are not ready for reuse");
      }

      return asset;
    });
  }

  getDiagnostics() {
    const driver = this.configService.get<string>("MEDIA_DRIVER") ?? "s3";

    if (driver === "local") {
      return {
        driver,
        configured: true,
        healthy: true,
        message: "Local media driver active",
        publicBaseUrl:
          this.configService.get<string>("MEDIA_PUBLIC_BASE_URL") ?? "http://localhost:4000/uploads"
      };
    }

    if (driver === "cloudinary") {
      const configured = Boolean(
        this.configService.get<string>("CLOUDINARY_CLOUD_NAME") &&
          this.configService.get<string>("CLOUDINARY_API_KEY") &&
          this.configService.get<string>("CLOUDINARY_API_SECRET")
      );

      return {
        driver,
        configured,
        healthy: configured,
        message: configured
          ? "Cloudinary signed upload config is ready"
          : "Cloudinary driver selected but one or more credentials are missing",
        publicBaseUrl: this.configService.get<string>("MEDIA_PUBLIC_BASE_URL") ?? null
      };
    }

    const configured = Boolean(
      this.configService.get<string>("S3_BUCKET") &&
        this.configService.get<string>("S3_REGION")
    );

    return {
      driver,
      configured,
      healthy: configured,
      message: configured
        ? "S3 upload config is ready"
        : "S3 driver selected but bucket/region config is incomplete",
      publicBaseUrl: this.configService.get<string>("MEDIA_PUBLIC_BASE_URL") ?? null,
      endpoint: this.configService.get<string>("S3_ENDPOINT") ?? null
    };
  }

  async probeDiagnostics() {
    const diagnostics = this.getDiagnostics();

    if (!diagnostics.configured) {
      return {
        ...diagnostics,
        probeStatus: "degraded" as const,
        probeMessage: "Driver is not fully configured"
      };
    }

    if (diagnostics.driver === "local") {
      return {
        ...diagnostics,
        probeStatus: "ok" as const,
        probeMessage: "Local media driver does not require external probe"
      };
    }

    if (diagnostics.driver === "cloudinary") {
      try {
        const cloudName = this.configService.get<string>("CLOUDINARY_CLOUD_NAME");
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/ping`, {
          method: "GET"
        });

        return {
          ...diagnostics,
          healthy: response.ok,
          probeStatus: response.ok ? ("ok" as const) : ("degraded" as const),
          probeMessage: response.ok
            ? "Cloudinary API probe succeeded"
            : `Cloudinary API probe failed with status ${response.status}`
        };
      } catch (error) {
        return {
          ...diagnostics,
          healthy: false,
          probeStatus: "degraded" as const,
          probeMessage: error instanceof Error ? error.message : "Cloudinary probe failed"
        };
      }
    }

    try {
      await this.buildS3UploadInstruction(
        `healthchecks/${Date.now()}-probe.txt`,
        this.resolvePublicUrl("s3", `healthchecks/${Date.now()}-probe.txt`),
        "text/plain"
      );

      return {
        ...diagnostics,
        probeStatus: "ok" as const,
        probeMessage: "S3 signed upload probe succeeded"
      };
    } catch (error) {
      return {
        ...diagnostics,
        healthy: false,
        probeStatus: "degraded" as const,
        probeMessage: error instanceof Error ? error.message : "S3 probe failed"
      };
    }
  }

  private async buildUploadInstruction(
    driver: string,
    objectKey: string,
    publicUrl: string,
    payload: CreateUploadIntentDto
  ): Promise<UploadInstruction> {
    if (driver === "cloudinary") {
      return this.buildCloudinaryUploadInstruction(objectKey, publicUrl);
    }

    if (driver === "s3") {
      return this.buildS3UploadInstruction(objectKey, publicUrl, payload.mimeType);
    }

    return {
      strategy: "single_put",
      method: "PUT",
      uploadUrl: publicUrl,
      publicUrl,
      headers: {
        "content-type": payload.mimeType
      },
      expiresAt: null
    };
  }

  private async buildS3UploadInstruction(
    objectKey: string,
    publicUrl: string,
    mimeType: string
  ): Promise<UploadInstruction> {
    const bucket = this.configService.get<string>("S3_BUCKET");
    if (!bucket) {
      throw new ServiceUnavailableException("S3_BUCKET is required for s3 media uploads");
    }

    const expiresIn = await this.getUploadUrlTtlSeconds();
    const client = this.createS3Client();
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: mimeType
      }),
      {
        expiresIn
      }
    );

    return {
      strategy: "single_put",
      method: "PUT",
      uploadUrl,
      publicUrl,
      headers: {
        "content-type": mimeType
      },
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
    };
  }

  private async getUploadUrlTtlSeconds() {
    try {
      return await this.systemSettingsService.getNumberValue("media_upload_url_ttl_seconds");
    } catch {
      return this.configService.get<number>("MEDIA_UPLOAD_URL_TTL_SECONDS", 900);
    }
  }

  private buildCloudinaryUploadInstruction(
    objectKey: string,
    publicUrl: string
  ): UploadInstruction {
    const cloudName = this.configService.get<string>("CLOUDINARY_CLOUD_NAME");
    const apiKey = this.configService.get<string>("CLOUDINARY_API_KEY");
    const apiSecret = this.configService.get<string>("CLOUDINARY_API_SECRET");

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        "Cloudinary upload config is incomplete for signed uploads"
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = objectKey.replace(/\.[^.]+$/, "");
    const signaturePayload = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = createHash("sha1").update(signaturePayload).digest("hex");

    return {
      strategy: "form_post",
      method: "POST",
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      publicUrl,
      fields: {
        api_key: apiKey,
        public_id: publicId,
        timestamp,
        signature
      },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
  }

  private createS3Client() {
    const endpoint = this.configService.get<string>("S3_ENDPOINT");
    const region = this.configService.get<string>("S3_REGION", "us-east-1");
    const accessKeyId = this.configService.get<string>("S3_ACCESS_KEY");
    const secretAccessKey = this.configService.get<string>("S3_SECRET_KEY");
    const forcePathStyle = this.configService.get<boolean>("S3_FORCE_PATH_STYLE", true);

    return new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey
            }
          : undefined
    });
  }

  private buildObjectKey(folder: string | undefined, filename: string) {
    const safeName = filename
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "")
      .toLowerCase();
    const prefix = folder
      ?.trim()
      .replace(/[^a-zA-Z0-9/_-]/g, "")
      .replace(/^\/+|\/+$/g, "");
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return prefix ? `${prefix}/${stamp}-${safeName}` : `uploads/${stamp}-${safeName}`;
  }

  private resolvePublicUrl(driver: string, objectKey: string) {
    const explicitBase = this.configService.get<string>("MEDIA_PUBLIC_BASE_URL");
    if (explicitBase) {
      return `${explicitBase.replace(/\/+$/, "")}/${objectKey}`;
    }

    if (driver === "cloudinary") {
      const cloudName = this.configService.get<string>("CLOUDINARY_CLOUD_NAME") ?? "demo";
      return `https://res.cloudinary.com/${cloudName}/image/upload/${objectKey.replace(/\.[^.]+$/, "")}`;
    }

    if (driver === "local") {
      return `http://localhost:4000/uploads/${objectKey}`;
    }

    const endpoint = this.configService.get<string>("S3_ENDPOINT") ?? "http://localhost:9000";
    const bucket = this.configService.get<string>("S3_BUCKET") ?? "ecoms";
    return `${endpoint.replace(/\/+$/, "")}/${bucket}/${objectKey}`;
  }

  private serialize(asset: {
    id: string;
    driver: string;
    bucket: string | null;
    objectKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number | null;
    url: string;
    status: string;
    createdAt: Date;
  }): FileAssetSummary {
    return {
      id: asset.id,
      driver: asset.driver,
      bucket: asset.bucket,
      objectKey: asset.objectKey,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      url: asset.url,
      status: asset.status as FileAssetSummary["status"],
      createdAt: asset.createdAt.toISOString()
    };
  }
}
