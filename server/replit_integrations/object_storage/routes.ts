import type { Express, Request, Response } from "express";
import { ObjectStorageService } from "./objectStorage";
import crypto from "crypto";

export function registerObjectStorageRoutes(app: Express): void {
  app.post("/api/uploads/request-url", async (req: Request, res: Response) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name || !contentType) {
        return res.status(400).json({ error: "Missing required fields: name, contentType" });
      }

      const maxSize = 50 * 1024 * 1024;
      if (size && size > maxSize) {
        return res.status(400).json({ error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB` });
      }

      const uniqueName = `${crypto.randomUUID()}-${name}`;
      const objectPath = ObjectStorageService.getPrivateObjectPath(uniqueName);
      const uploadURL = await ObjectStorageService.generatePresignedUploadUrl(objectPath, contentType);

      res.json({ uploadURL, objectPath });
    } catch (error: any) {
      console.error("[ObjectStorage] Error generating upload URL:", error.message);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.post("/api/uploads/public/request-url", async (req: Request, res: Response) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name || !contentType) {
        return res.status(400).json({ error: "Missing required fields: name, contentType" });
      }

      const uniqueName = `${crypto.randomUUID()}-${name}`;
      const objectPath = ObjectStorageService.getPublicObjectPath(uniqueName);
      const uploadURL = await ObjectStorageService.generatePresignedUploadUrl(objectPath, contentType);

      res.json({ uploadURL, objectPath });
    } catch (error: any) {
      console.error("[ObjectStorage] Error generating public upload URL:", error.message);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.get("/api/uploads/download-url", async (req: Request, res: Response) => {
    try {
      const objectPath = req.query.path as string;
      if (!objectPath) {
        return res.status(400).json({ error: "Missing required query parameter: path" });
      }

      const downloadURL = await ObjectStorageService.generatePresignedDownloadUrl(objectPath);
      res.json({ downloadURL });
    } catch (error: any) {
      console.error("[ObjectStorage] Error generating download URL:", error.message);
      res.status(500).json({ error: "Failed to generate download URL" });
    }
  });

  app.delete("/api/uploads", async (req: Request, res: Response) => {
    try {
      const objectPath = req.query.path as string;
      if (!objectPath) {
        return res.status(400).json({ error: "Missing required query parameter: path" });
      }

      await ObjectStorageService.deleteObject(objectPath);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[ObjectStorage] Error deleting object:", error.message);
      res.status(500).json({ error: "Failed to delete object" });
    }
  });
}
