import { Client } from 'minio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';

export const minioClient = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

let storageMode: 'minio' | 'local' = 'minio';

function localFilePath(objectKey: string) {
  return path.join(process.cwd(), env.STORAGE_FALLBACK_DIR, objectKey);
}

export async function ensureBucket() {
  if (storageMode === 'local') {
    return;
  }

  try {
    const exists = await minioClient.bucketExists(env.MINIO_BUCKET);
    if (!exists) {
      await minioClient.makeBucket(env.MINIO_BUCKET);
    }
    storageMode = 'minio';
  } catch (error) {
    if (!env.STORAGE_FALLBACK_LOCAL) throw error;
    await fs.mkdir(path.join(process.cwd(), env.STORAGE_FALLBACK_DIR), { recursive: true });
    storageMode = 'local';
  }
}

export async function uploadBuffer(objectKey: string, buffer: Buffer, mimeType: string) {
  if (storageMode === 'local') {
    const filePath = localFilePath(objectKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return objectKey;
  }

  await minioClient.putObject(env.MINIO_BUCKET, objectKey, buffer, buffer.length, {
    'Content-Type': mimeType,
  });
  return objectKey;
}

export async function getObjectBuffer(objectKey: string): Promise<Buffer> {
  if (storageMode === 'local') {
    return fs.readFile(localFilePath(objectKey));
  }

  const stream = await minioClient.getObject(env.MINIO_BUCKET, objectKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function getStorageMode() {
  return storageMode;
}
