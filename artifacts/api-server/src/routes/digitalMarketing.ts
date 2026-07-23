import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { digitalMarketingPostsTable, bulkCampaignsTable, n8nConfigTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

const safeDate = (d: any) => (d && d !== "" ? new Date(d) : null);

async function triggerN8nWebhook(webhookUrl: string, payload: any): Promise<{ success: boolean; executionId?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { success: false };
    const body = await res.json().catch(() => ({}));
    return { success: true, executionId: body.executionId ?? body.id ?? "triggered" };
  } catch {
    return { success: false };
  }
}

// ─── Social Media Posts ────────────────────────────────────────────────────
router.get("/posts", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const posts = authUser.role === "super_admin"
      ? await db.select().from(digitalMarketingPostsTable).orderBy(desc(digitalMarketingPostsTable.createdAt))
      : await db.select().from(digitalMarketingPostsTable)
          .where(eq(digitalMarketingPostsTable.tenantId, authUser.tenantId))
          .orderBy(desc(digitalMarketingPostsTable.createdAt));
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/posts", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.role === "super_admin" ? (req.body.tenantId ?? authUser.tenantId) : authUser.tenantId;
    const { scheduledAt, ...rest } = req.body;
    const [post] = await db.insert(digitalMarketingPostsTable).values({
      ...rest,
      tenantId,
      createdById: authUser.id,
      scheduledAt: safeDate(scheduledAt),
    }).returning();
    res.status(201).json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/posts/:id", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(digitalMarketingPostsTable)
      .where(eq(digitalMarketingPostsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Post not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const { id, tenantId, createdAt, scheduledAt, publishedAt, ...data } = req.body;
    const [updated] = await db.update(digitalMarketingPostsTable)
      .set({ ...data, scheduledAt: safeDate(scheduledAt), publishedAt: safeDate(publishedAt), updatedAt: new Date() })
      .where(eq(digitalMarketingPostsTable.id, Number(req.params.id))).returning();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/posts/:id/publish", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(digitalMarketingPostsTable)
      .where(eq(digitalMarketingPostsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Post not found" }); return; }
    const n8nCfg = await db.select().from(n8nConfigTable).where(eq(n8nConfigTable.tenantId, authUser.tenantId)).limit(1);
    const cfg = n8nCfg[0];
    let n8nStatus = "no_webhook";
    if (cfg?.isEnabled && cfg.socialWebhookUrl) {
      const result = await triggerN8nWebhook(cfg.socialWebhookUrl, { post: existing, action: "publish" });
      n8nStatus = result.success ? "triggered" : "failed";
    }
    const [updated] = await db.update(digitalMarketingPostsTable)
      .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(digitalMarketingPostsTable.id, Number(req.params.id))).returning();
    res.json({ post: updated, n8nStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/posts/:id", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(digitalMarketingPostsTable)
      .where(eq(digitalMarketingPostsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Post not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    await db.delete(digitalMarketingPostsTable).where(eq(digitalMarketingPostsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Bulk Campaigns ────────────────────────────────────────────────────────
router.get("/campaigns", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const campaigns = authUser.role === "super_admin"
      ? await db.select().from(bulkCampaignsTable).orderBy(desc(bulkCampaignsTable.createdAt))
      : await db.select().from(bulkCampaignsTable)
          .where(eq(bulkCampaignsTable.tenantId, authUser.tenantId))
          .orderBy(desc(bulkCampaignsTable.createdAt));
    res.json(campaigns);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/campaigns", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.role === "super_admin" ? (req.body.tenantId ?? authUser.tenantId) : authUser.tenantId;
    const { scheduledAt, recipients, ...rest } = req.body;
    const recipientList: string[] = Array.isArray(recipients) ? recipients
      : typeof recipients === "string" ? recipients.split(/[\n,]+/).map((r: string) => r.trim()).filter(Boolean)
      : [];
    const [campaign] = await db.insert(bulkCampaignsTable).values({
      ...rest,
      tenantId,
      createdById: authUser.id,
      recipients: JSON.stringify(recipientList),
      recipientCount: recipientList.length,
      scheduledAt: safeDate(scheduledAt),
    }).returning();
    res.status(201).json(campaign);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/campaigns/:id", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(bulkCampaignsTable)
      .where(eq(bulkCampaignsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Campaign not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const { id, tenantId, createdAt, scheduledAt, recipients, ...data } = req.body;
    const recipientList: string[] = Array.isArray(recipients) ? recipients
      : typeof recipients === "string" ? recipients.split(/[\n,]+/).map((r: string) => r.trim()).filter(Boolean)
      : [];
    const [updated] = await db.update(bulkCampaignsTable)
      .set({ ...data, recipients: JSON.stringify(recipientList), recipientCount: recipientList.length, scheduledAt: safeDate(scheduledAt), updatedAt: new Date() })
      .where(eq(bulkCampaignsTable.id, Number(req.params.id))).returning();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/campaigns/:id/send", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [campaign] = await db.select().from(bulkCampaignsTable)
      .where(eq(bulkCampaignsTable.id, Number(req.params.id))).limit(1);
    if (!campaign) { res.status(404).json({ message: "Campaign not found" }); return; }
    if (authUser.role !== "super_admin" && campaign.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const n8nCfg = await db.select().from(n8nConfigTable).where(eq(n8nConfigTable.tenantId, authUser.tenantId)).limit(1);
    const cfg = n8nCfg[0];
    const webhookMap: Record<string, string | null | undefined> = {
      email: cfg?.emailWebhookUrl,
      sms: cfg?.smsWebhookUrl,
      whatsapp: cfg?.whatsappWebhookUrl,
    };
    const webhookUrl = webhookMap[campaign.type];
    let n8nStatus = "demo_mode";
    let executionId: string | undefined;
    if (cfg?.isEnabled && webhookUrl) {
      const recipients = JSON.parse(campaign.recipients || "[]");
      const result = await triggerN8nWebhook(webhookUrl, {
        campaign: { ...campaign, recipients },
        action: "send",
        triggeredBy: authUser.id,
      });
      n8nStatus = result.success ? "triggered" : "webhook_failed";
      executionId = result.executionId;
    }
    const recipients = JSON.parse(campaign.recipients || "[]");
    const [updated] = await db.update(bulkCampaignsTable)
      .set({
        status: n8nStatus === "webhook_failed" ? "failed" : "completed",
        sentAt: new Date(),
        sentCount: n8nStatus === "webhook_failed" ? 0 : recipients.length,
        failedCount: n8nStatus === "webhook_failed" ? recipients.length : 0,
        n8nExecutionId: executionId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(bulkCampaignsTable.id, Number(req.params.id))).returning();
    res.json({ campaign: updated, n8nStatus, demo: n8nStatus === "demo_mode" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/campaigns/:id", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(bulkCampaignsTable)
      .where(eq(bulkCampaignsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Campaign not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    await db.delete(bulkCampaignsTable).where(eq(bulkCampaignsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── n8n Config ────────────────────────────────────────────────────────────
router.get("/n8n-config", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [cfg] = await db.select().from(n8nConfigTable)
      .where(eq(n8nConfigTable.tenantId, authUser.tenantId)).limit(1);
    res.json(cfg ?? {
      tenantId: authUser.tenantId, isEnabled: false,
      instanceUrl: null, socialWebhookUrl: null,
      emailWebhookUrl: null, smsWebhookUrl: null, whatsappWebhookUrl: null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/n8n-config", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.tenantId;
    const { instanceUrl, socialWebhookUrl, emailWebhookUrl, smsWebhookUrl, whatsappWebhookUrl, isEnabled } = req.body;
    const [existing] = await db.select().from(n8nConfigTable).where(eq(n8nConfigTable.tenantId, tenantId)).limit(1);
    let cfg;
    if (existing) {
      [cfg] = await db.update(n8nConfigTable)
        .set({ instanceUrl, socialWebhookUrl, emailWebhookUrl, smsWebhookUrl, whatsappWebhookUrl, isEnabled: !!isEnabled, updatedAt: new Date() })
        .where(eq(n8nConfigTable.tenantId, tenantId)).returning();
    } else {
      [cfg] = await db.insert(n8nConfigTable)
        .values({ tenantId, instanceUrl, socialWebhookUrl, emailWebhookUrl, smsWebhookUrl, whatsappWebhookUrl, isEnabled: !!isEnabled })
        .returning();
    }
    res.json(cfg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
