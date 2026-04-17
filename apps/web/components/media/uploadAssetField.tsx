"use client";

import { useState, useTransition } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

interface UploadAssetFieldProps {
  accessToken: string;
  folder: string;
  assetIdInputName: string;
  urlInputName?: string;
  label: string;
  helperText: string;
  accept?: string;
}

interface UploadIntentResponse {
  data: {
    asset: {
      id: string;
      url: string;
      originalName: string;
    };
    upload: {
      strategy: "single_put" | "form_post";
      method: "PUT" | "POST";
      uploadUrl: string;
      publicUrl: string;
      headers?: Record<string, string>;
      fields?: Record<string, string>;
      expiresAt: string | null;
    };
  };
}

export function UploadAssetField({
  accessToken,
  folder,
  assetIdInputName,
  urlInputName,
  label,
  helperText,
  accept = "image/*"
}: UploadAssetFieldProps) {
  const [isPending, startTransition] = useTransition();
  const [assetId, setAssetId] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    startTransition(async () => {
      setError("");
      setStatus("Đang xin upload intent...");

      try {
        const intentResponse = await fetch(`${API_URL}/files/upload-intent`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            folder
          })
        });

        if (!intentResponse.ok) {
          throw new Error("Không tạo được upload intent");
        }

        const intentPayload = (await intentResponse.json()) as UploadIntentResponse;
        const upload = intentPayload.data.upload;

        setStatus("Đang upload file...");

        if (upload.strategy === "form_post") {
          const formData = new FormData();
          Object.entries(upload.fields ?? {}).forEach(([key, value]) => {
            formData.append(key, value);
          });
          formData.append("file", file);

          const uploadResponse = await fetch(upload.uploadUrl, {
            method: upload.method,
            body: formData
          });

          if (!uploadResponse.ok) {
            throw new Error("Upload Cloudinary thất bại");
          }
        } else {
          const uploadResponse = await fetch(upload.uploadUrl, {
            method: upload.method,
            headers: upload.headers,
            body: file
          });

          if (!uploadResponse.ok) {
            throw new Error("Upload file thất bại");
          }
        }

        setStatus("Đang hoàn tất asset...");

        const completeResponse = await fetch(
          `${API_URL}/files/${intentPayload.data.asset.id}/complete`,
          {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              status: "READY"
            })
          }
        );

        if (!completeResponse.ok) {
          throw new Error("Không complete được file asset");
        }

        setAssetId(intentPayload.data.asset.id);
        setAssetUrl(intentPayload.data.asset.url);
        setStatus("Upload xong. Asset ready.");
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Upload lỗi");
        setStatus("");
        setAssetId("");
        setAssetUrl("");
      } finally {
        event.target.value = "";
      }
    });
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-950">{label}</div>
      <p className="mt-1 text-sm text-slate-500">{helperText}</p>
      <input type="hidden" name={assetIdInputName} value={assetId} readOnly />
      {urlInputName ? <input type="hidden" name={urlInputName} value={assetUrl} readOnly /> : null}
      <label className="mt-4 block cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600">
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={onFileChange}
          disabled={isPending}
        />
        {isPending ? "Đang upload..." : "Chọn file để upload"}
      </label>
      {status ? <div className="mt-3 text-sm text-emerald-700">{status}</div> : null}
      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      {assetId ? (
        <div className="mt-3 rounded-[1rem] bg-white p-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-950">Asset ready</div>
          <div className="mt-1 break-all">{assetId}</div>
          <div className="mt-1 break-all text-orange-600">{assetUrl}</div>
        </div>
      ) : null}
    </div>
  );
}
