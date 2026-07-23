/**
 * BizAuto — Unified File Storage Utility
 *
 * Supports two backends:
 *   - LOCAL (default): stores files as base64 data-URLs in PostgreSQL
 *   - S3:              uploads files to AWS S3 and returns a public URL
 *
 * Set USE_S3=true in your environment to switch to S3.
 * Required S3 env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 *                       S3_BUCKET_NAME, S3_BUCKET_REGION
 */

import crypto from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────
export interface StoredFile {
  url: string;
  key: string;
  size: number;
  mimeType: string;
  backend: "local" | "s3";
}

export interface UploadInput {
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
  folder?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function generateKey(input: UploadInput): string {
  const ext = input.originalName?.split(".").pop() ?? mimeToExt(input.mimeType);
  const id  = crypto.randomBytes(12).toString("hex");
  const folder = input.folder ?? "uploads";
  return `${folder}/${id}.${ext}`;
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg":       "jpg",
    "image/png":        "png",
    "image/gif":        "gif",
    "image/webp":       "webp",
    "image/svg+xml":    "svg",
    "application/pdf":  "pdf",
    "text/csv":         "csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return map[mime] ?? "bin";
}

// ── Local backend (base64 data-URL) ──────────────────────────────────────
function uploadLocal(input: UploadInput): StoredFile {
  const key    = generateKey(input);
  const b64    = input.buffer.toString("base64");
  const url    = `data:${input.mimeType};base64,${b64}`;
  return { url, key, size: input.buffer.length, mimeType: input.mimeType, backend: "local" };
}

// ── S3 backend ────────────────────────────────────────────────────────────
async function uploadS3(input: UploadInput): Promise<StoredFile> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const region = process.env.S3_BUCKET_REGION ?? process.env.AWS_REGION ?? "us-east-1";
  const bucket = process.env.S3_BUCKET_NAME;
  const cdnUrl = process.env.S3_CDN_URL;

  if (!bucket) throw new Error("S3_BUCKET_NAME environment variable is not set");

  const client = new S3Client({ region });
  const key    = generateKey(input);

  await client.send(
    new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        input.buffer,
      ContentType: input.mimeType,
      CacheControl: "max-age=31536000",
    })
  );

  const baseUrl = cdnUrl ?? `https://${bucket}.s3.${region}.amazonaws.com`;
  const url     = `${baseUrl}/${key}`;

  return { url, key, size: input.buffer.length, mimeType: input.mimeType, backend: "s3" };
}

// ── Delete from S3 ────────────────────────────────────────────────────────
export async function deleteFile(key: string): Promise<void> {
  if (process.env.USE_S3 !== "true") return;

  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");

  const region = process.env.S3_BUCKET_REGION ?? process.env.AWS_REGION ?? "us-east-1";
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) return;

  const client = new S3Client({ region });
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// ── Pre-signed URL (for client-side direct upload) ───────────────────────
export async function getPresignedUploadUrl(
  key: string,
  mimeType: string,
  expiresInSeconds = 300
): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl }               = await import("@aws-sdk/s3-request-presigner");

  const region = process.env.S3_BUCKET_REGION ?? process.env.AWS_REGION ?? "us-east-1";
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) throw new Error("S3_BUCKET_NAME not set");

  const client  = new S3Client({ region });
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

// ── Main upload entry point ────────────────────────────────────────────────
export async function uploadFile(input: UploadInput): Promise<StoredFile> {
  if (process.env.USE_S3 === "true") {
    return uploadS3(input);
  }
  return uploadLocal(input);
}

// ── Parse base64 data-URL (used for existing local uploads) ───────────────
export function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer:   Buffer.from(match[2], "base64"),
  };
}
