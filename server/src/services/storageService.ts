import { Client } from 'minio';
import { env } from '../config/env';

export const minioClient = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(env.MINIO_BUCKET);
  if (!exists) {
    await minioClient.makeBucket(env.MINIO_BUCKET);
  }
}

export async function uploadBuffer(objectKey: string, buffer: Buffer, mimeType: string) {
  await minioClient.putObject(env.MINIO_BUCKET, objectKey, buffer, buffer.length, {
    'Content-Type': mimeType,
  });
  return objectKey;
}

export async function getObjectBuffer(objectKey: string): Promise<Buffer> {
  const stream = await minioClient.getObject(env.MINIO_BUCKET, objectKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
