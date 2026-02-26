import { Storage } from "@google-cloud/storage";

const PUBLIC_OBJECT_SEARCH_PATHS = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",").filter(Boolean);
const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || ".private";

let storageClient: Storage | null = null;

function getStorage(): Storage {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

function getBucketName(): string {
  const bucketId = process.env.REPLIT_BUCKET_ID;
  if (!bucketId) {
    throw new Error("REPLIT_BUCKET_ID environment variable is not set. Please set up object storage first.");
  }
  return bucketId;
}

export async function generatePresignedUploadUrl(
  objectPath: string,
  contentType: string,
  expiresInMs: number = 15 * 60 * 1000
): Promise<string> {
  const storage = getStorage();
  const bucket = storage.bucket(getBucketName());
  const file = bucket.file(objectPath);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + expiresInMs,
    contentType,
  });

  return url;
}

export async function generatePresignedDownloadUrl(
  objectPath: string,
  expiresInMs: number = 15 * 60 * 1000
): Promise<string> {
  const storage = getStorage();
  const bucket = storage.bucket(getBucketName());
  const file = bucket.file(objectPath);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresInMs,
  });

  return url;
}

export async function deleteObject(objectPath: string): Promise<void> {
  const storage = getStorage();
  const bucket = storage.bucket(getBucketName());
  await bucket.file(objectPath).delete({ ignoreNotFound: true });
}

export async function getPublicUrl(objectPath: string): Promise<string | null> {
  for (const searchPath of PUBLIC_OBJECT_SEARCH_PATHS) {
    const fullPath = `${searchPath}/${objectPath}`;
    try {
      const storage = getStorage();
      const bucket = storage.bucket(getBucketName());
      const [exists] = await bucket.file(fullPath).exists();
      if (exists) {
        return `https://storage.googleapis.com/${getBucketName()}/${fullPath}`;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function getPrivateObjectPath(filename: string): string {
  return `${PRIVATE_OBJECT_DIR}/${filename}`;
}

export function getPublicObjectPath(filename: string): string {
  const publicDir = PUBLIC_OBJECT_SEARCH_PATHS[0] || "public";
  return `${publicDir}/${filename}`;
}

export const ObjectStorageService = {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  deleteObject,
  getPublicUrl,
  getPrivateObjectPath,
  getPublicObjectPath,
};
