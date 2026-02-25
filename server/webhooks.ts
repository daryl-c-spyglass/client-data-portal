import type { Express } from "express";
import crypto from "crypto";
import { deploymentLogs } from "@shared/schema";
import { requireAuth, requireMinimumRole } from "./auth";

function detectChangeType(message: string | undefined): string {
  if (!message) return "feature";
  const m = message.toLowerCase();
  if (m.includes("hotfix") || m.includes("urgent")) return "hotfix";
  if (m.includes("fix") || m.includes("bug")) return "bugfix";
  if (m.includes("refactor") || m.includes("cleanup")) return "refactor";
  if (m.includes("config") || m.includes("env") || m.includes("setting")) return "config";
  if (m.includes("doc") || m.includes("readme")) return "documentation";
  return "feature";
}

function verifyGitHubSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(rawBody).digest("hex");
    const sigBuf = Buffer.from(signature.padEnd(digest.length, " "));
    const digBuf = Buffer.from(digest.padEnd(signature.length, " "));
    if (sigBuf.length !== digBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, digBuf);
  } catch {
    return false;
  }
}

function verifyVercelSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac("sha1", secret);
    const digest = hmac.update(rawBody).digest("hex");
    return signature === digest;
  } catch {
    return false;
  }
}

export function registerWebhookRoutes(app: Express) {
  // ============================================================
  // GITHUB WEBHOOK — captures commits/pushes
  // POST /api/webhooks/github
  // ============================================================
  app.post("/api/webhooks/github", async (req, res) => {
    try {
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const pgModule = await import("pg");
      const pool = new pgModule.default.Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
      const db = drizzle(pool);

      const signature = req.headers["x-hub-signature-256"] as string;
      const event = req.headers["x-github-event"] as string;
      const rawBody = req.rawBody as Buffer | undefined;

      const secret = process.env.GITHUB_WEBHOOK_SECRET;
      if (secret && signature && rawBody) {
        if (!verifyGitHubSignature(rawBody, signature, secret)) {
          console.error("[Webhook:GitHub] Invalid signature — rejecting request");
          return res.status(401).json({ error: "Invalid signature" });
        }
      }

      console.log(`[Webhook:GitHub] Received event: ${event}`);

      if (event === "push") {
        const { ref, pusher, repository, head_commit } = req.body;
        if (!head_commit) {
          return res.status(200).json({ received: true, skipped: "no head_commit" });
        }

        const branch = (ref as string)?.replace("refs/heads/", "") || "main";
        const filesChanged = [
          ...(head_commit.added || []),
          ...(head_commit.modified || []),
          ...(head_commit.removed || []),
        ];

        await db.insert(deploymentLogs).values({
          commitHash: (head_commit.id as string)?.substring(0, 7) || null,
          commitMessage: (head_commit.message as string)?.substring(0, 255) || null,
          commitUrl: head_commit.url || null,
          branch,
          deploymentTarget: "github",
          environment: branch === "main" ? "production" : "development",
          changeType: detectChangeType(head_commit.message),
          changeDescription: (head_commit.message as string)?.split("\n")[0]?.substring(0, 500) || "GitHub push",
          filesChanged: filesChanged.length > 0 ? filesChanged : null,
          requestedByName: pusher?.name || head_commit.author?.name || null,
          requestSource: "github",
          requestReference: repository?.html_url || null,
          status: "pending",
        });

        console.log(`[Webhook:GitHub] Logged commit ${(head_commit.id as string)?.substring(0, 7)} by ${pusher?.name}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Webhook:GitHub] Error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ============================================================
  // VERCEL WEBHOOK — captures deployment events
  // POST /api/webhooks/vercel
  // ============================================================
  app.post("/api/webhooks/vercel", async (req, res) => {
    try {
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const { eq } = await import("drizzle-orm");
      const pgModule = await import("pg");
      const pool = new pgModule.default.Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
      const db = drizzle(pool);

      const signature = req.headers["x-vercel-signature"] as string;
      const rawBody = req.rawBody as Buffer | undefined;

      const secret = process.env.VERCEL_WEBHOOK_SECRET;
      if (secret && signature && rawBody) {
        if (!verifyVercelSignature(rawBody, signature, secret)) {
          console.error("[Webhook:Vercel] Invalid signature — rejecting request");
          return res.status(401).json({ error: "Invalid signature" });
        }
      }

      const { type, payload: eventPayload } = req.body;
      console.log(`[Webhook:Vercel] Received event: ${type}`);

      if (["deployment.created", "deployment.succeeded", "deployment.error", "deployment.canceled"].includes(type)) {
        const deployment = eventPayload?.deployment || eventPayload;
        const {
          id: deploymentId,
          url: deploymentUrl,
          meta = {},
          state,
          creator,
        } = deployment || {};

        const statusMap: Record<string, string> = {
          BUILDING: "in_progress",
          INITIALIZING: "in_progress",
          QUEUED: "pending",
          READY: "deployed",
          ERROR: "failed",
          CANCELED: "failed",
        };
        const status = statusMap[state as string] || "pending";

        const commitSha: string | undefined = meta.githubCommitSha || meta.gitlabCommitSha || meta.bitbucketCommitSha;
        const commitMessage: string | undefined = meta.githubCommitMessage || meta.gitlabCommitMessage;
        const commitRef: string = (meta.githubCommitRef || meta.gitlabCommitRef || "main") as string;
        const authorName: string | undefined = meta.githubCommitAuthorName || meta.gitlabCommitAuthorName || creator?.username;
        const commitHash = commitSha?.substring(0, 7);

        const existing = commitHash
          ? await db.select().from(deploymentLogs).where(eq(deploymentLogs.commitHash, commitHash)).limit(1)
          : [];

        if (existing.length > 0) {
          await db.update(deploymentLogs).set({
            deploymentTarget: "vercel",
            deploymentUrl: deploymentUrl ? `https://${deploymentUrl}` : null,
            deploymentId: deploymentId || null,
            status,
            deployedAt: status === "deployed" ? new Date() : null,
            updatedAt: new Date(),
          }).where(eq(deploymentLogs.id, existing[0].id));

          console.log(`[Webhook:Vercel] Updated ${commitHash} -> ${status}`);
        } else {
          await db.insert(deploymentLogs).values({
            commitHash: commitHash || null,
            commitMessage: commitMessage?.substring(0, 255) || null,
            commitUrl: meta.githubCommitUrl || null,
            branch: commitRef.replace("refs/heads/", ""),
            deploymentTarget: "vercel",
            deploymentUrl: deploymentUrl ? `https://${deploymentUrl}` : null,
            deploymentId: deploymentId || null,
            environment: "production",
            changeType: detectChangeType(commitMessage),
            changeDescription: commitMessage?.split("\n")[0]?.substring(0, 500) || "Vercel deployment",
            requestedByName: authorName || null,
            requestSource: "vercel",
            status,
            deployedAt: status === "deployed" ? new Date() : null,
          });

          console.log(`[Webhook:Vercel] Created ${commitHash} -> ${status}`);
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Webhook:Vercel] Error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ============================================================
  // RENDER WEBHOOK — captures Render deployments
  // POST /api/webhooks/render
  // ============================================================
  app.post("/api/webhooks/render", async (req, res) => {
    try {
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const { eq } = await import("drizzle-orm");
      const pgModule = await import("pg");
      const pool = new pgModule.default.Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
      const db = drizzle(pool);

      const { type, service, deploy } = req.body;
      console.log(`[Webhook:Render] Received event: ${type}`);

      if (type === "deploy" && deploy) {
        const { id: deploymentId, commit, status, finishedAt } = deploy;

        const statusMap: Record<string, string> = {
          created: "pending",
          build_in_progress: "in_progress",
          update_in_progress: "in_progress",
          live: "deployed",
          deactivated: "failed",
          build_failed: "failed",
          canceled: "failed",
        };
        const mappedStatus = statusMap[status as string] || "pending";
        const commitHash = (commit?.id as string)?.substring(0, 7);

        const existing = commitHash
          ? await db.select().from(deploymentLogs).where(eq(deploymentLogs.commitHash, commitHash)).limit(1)
          : [];

        if (existing.length > 0) {
          await db.update(deploymentLogs).set({
            deploymentTarget: "render",
            deploymentId: deploymentId || null,
            status: mappedStatus,
            deployedAt: mappedStatus === "deployed" && finishedAt ? new Date(finishedAt) : null,
            updatedAt: new Date(),
          }).where(eq(deploymentLogs.id, existing[0].id));

          console.log(`[Webhook:Render] Updated ${commitHash} -> ${mappedStatus}`);
        } else {
          await db.insert(deploymentLogs).values({
            commitHash: commitHash || null,
            commitMessage: (commit?.message as string)?.substring(0, 255) || null,
            branch: "main",
            deploymentTarget: "render",
            deploymentId: deploymentId || null,
            environment: "production",
            changeType: detectChangeType(commit?.message),
            changeDescription: (commit?.message as string)?.split("\n")[0]?.substring(0, 500) || "Render deployment",
            requestedByName: (commit?.author as string) || null,
            requestSource: "render",
            status: mappedStatus,
            deployedAt: mappedStatus === "deployed" && finishedAt ? new Date(finishedAt) : null,
          });

          console.log(`[Webhook:Render] Created ${commitHash} -> ${mappedStatus}`);
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Webhook:Render] Error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ============================================================
  // WEBHOOK HEALTH CHECK — developer only
  // GET /api/webhooks/health
  // ============================================================
  app.get("/api/webhooks/health", requireAuth, requireMinimumRole("developer"), async (req, res) => {
    try {
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const { sql, count, gte } = await import("drizzle-orm");
      const pgModule = await import("pg");
      const pool = new pgModule.default.Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
      const db = drizzle(pool);

      const health = {
        github: {
          configured: !!process.env.GITHUB_WEBHOOK_SECRET,
          endpoint: "/api/webhooks/github",
          webhookUrl: `${req.protocol}://${req.get("host")}/api/webhooks/github`,
        },
        vercel: {
          configured: !!process.env.VERCEL_WEBHOOK_SECRET,
          endpoint: "/api/webhooks/vercel",
          webhookUrl: `${req.protocol}://${req.get("host")}/api/webhooks/vercel`,
        },
        render: {
          configured: !!process.env.RENDER_WEBHOOK_SECRET,
          endpoint: "/api/webhooks/render",
          webhookUrl: `${req.protocol}://${req.get("host")}/api/webhooks/render`,
        },
      };

      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentActivity = await db
        .select({
          source: deploymentLogs.requestSource,
          count: count(),
          lastActivity: sql<string>`MAX(${deploymentLogs.createdAt})`,
        })
        .from(deploymentLogs)
        .where(gte(deploymentLogs.createdAt, cutoff))
        .groupBy(deploymentLogs.requestSource);

      res.json({ health, recentActivity });
    } catch (error) {
      console.error("[Webhook:Health] Error:", error);
      res.status(500).json({ error: "Failed to fetch webhook health" });
    }
  });

  console.log("✅ Webhook routes registered at /api/webhooks/*");
}
