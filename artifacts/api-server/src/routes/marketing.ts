import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { campaignsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/campaigns", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const campaigns = authUser.role === "super_admin"
      ? await db.select().from(campaignsTable).orderBy(campaignsTable.createdAt)
      : await db.select().from(campaignsTable).where(eq(campaignsTable.tenantId, authUser.tenantId)).orderBy(campaignsTable.createdAt);
    res.json(campaigns);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/campaigns", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const { name, type, subject, content, targetAudience, scheduledAt } = req.body;
    const [campaign] = await db.insert(campaignsTable).values({
      tenantId: authUser.tenantId,
      name,
      type,
      subject,
      content,
      targetAudience,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    }).returning();
    res.status(201).json(campaign);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/campaigns/:campaignId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.campaignId);
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found" });
      return;
    }
    res.json(campaign);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/campaigns/:campaignId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.campaignId);
    const { name, status, subject, content, targetAudience, scheduledAt } = req.body;
    const [campaign] = await db.update(campaignsTable)
      .set({ name, status, subject, content, targetAudience, scheduledAt: scheduledAt ? new Date(scheduledAt) : null, updatedAt: new Date() })
      .where(eq(campaignsTable.id, id))
      .returning();
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found" });
      return;
    }
    res.json(campaign);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/campaigns/:campaignId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.campaignId);
    await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
    res.json({ success: true, message: "Campaign deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
