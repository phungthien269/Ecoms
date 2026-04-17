import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { FileAssetSummary } from "@ecoms/contracts";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUploadIntentDto } from "./dto/create-upload-intent.dto";

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async listOwn(userId: string): Promise<FileAssetSummary[]> {
    const assets = await this.prisma.fileAsset.findMany({
      where: { createdById: userId },
      orderBy: [{ createdAt: "desc" }],
      take: 50
    });

    return assets.map((asset) => this.serialize(asset));
  }

  async createUploadIntent(userId: string, payload: CreateUploadIntentDto) {
    const driver = this.configService.get<string>("MEDIA_DRIVER") ?? "s3";
    const bucket = this.configService.get<string>("S3_BUCKET") ?? null;
    const objectKey = this.buildObjectKey(payload.folder, payload.filename);
    const publicUrl = this.resolvePublicUrl(driver, objectKey);

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
          folder: payload.folder ?? null
        }
      }
    });

    return {
      asset: this.serialize(asset),
      upload: {
        method: "PUT",
        uploadUrl: publicUrl,
        headers: {
          "content-type": payload.mimeType
        }
      }
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

  private buildObjectKey(folder: string | undefined, filename: string) {
    const safeName = filename.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9.\-_]/g, "").toLowerCase();
    const prefix = folder?.trim().replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "");
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
      return `https://res.cloudinary.com/${cloudName}/image/upload/${objectKey}`;
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
