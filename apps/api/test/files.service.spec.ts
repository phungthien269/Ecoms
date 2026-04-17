import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FilesService } from "../src/modules/files/files.service";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("http://localhost:9000/presigned-upload")
}));

describe("FilesService", () => {
  const prisma = {
    fileAsset: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    }
  };
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const values: Record<string, unknown> = {
        MEDIA_DRIVER: "s3",
        S3_ENDPOINT: "http://localhost:9000",
        S3_BUCKET: "ecoms",
        S3_REGION: "us-east-1",
        S3_ACCESS_KEY: "minio",
        S3_SECRET_KEY: "miniosecret",
        S3_FORCE_PATH_STYLE: true,
        MEDIA_UPLOAD_URL_TTL_SECONDS: 900
      };
      return values[key] ?? fallback;
    })
  };

  const service = new FilesService(prisma as never, configService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates s3 upload intent with a presigned upload url", async () => {
    prisma.fileAsset.create.mockResolvedValue({
      id: "asset-1",
      driver: "s3",
      bucket: "ecoms",
      objectKey: "products/demo.png",
      originalName: "demo.png",
      mimeType: "image/png",
      sizeBytes: 1200,
      url: "http://localhost:9000/ecoms/products/demo.png",
      status: "PENDING",
      createdAt: new Date("2026-04-18T01:00:00.000Z")
    });

    const result = await service.createUploadIntent("seller-1", {
      filename: "demo.png",
      mimeType: "image/png",
      folder: "products"
    });

    expect(prisma.fileAsset.create).toHaveBeenCalled();
    expect(getSignedUrl).toHaveBeenCalled();
    expect(result.upload.method).toBe("PUT");
    expect(result.upload.strategy).toBe("single_put");
    expect(result.upload.uploadUrl).toBe("http://localhost:9000/presigned-upload");
    expect(result.asset.status).toBe("PENDING");
  });

  it("marks owned file ready", async () => {
    prisma.fileAsset.findFirst.mockResolvedValue({
      id: "asset-1",
      createdById: "seller-1"
    });
    prisma.fileAsset.update.mockResolvedValue({
      id: "asset-1",
      driver: "s3",
      bucket: "ecoms",
      objectKey: "products/demo.png",
      originalName: "demo.png",
      mimeType: "image/png",
      sizeBytes: null,
      url: "http://localhost:9000/ecoms/products/demo.png",
      status: "READY",
      createdAt: new Date("2026-04-18T01:00:00.000Z")
    });

    const result = await service.complete("seller-1", "asset-1");
    expect(result.status).toBe("READY");
  });
});
