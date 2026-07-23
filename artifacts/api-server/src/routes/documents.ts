import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const docs = authUser.role === "super_admin"
      ? await db.select().from(documentsTable).orderBy(desc(documentsTable.createdAt))
      : await db.select().from(documentsTable).where(eq(documentsTable.tenantId, authUser.tenantId)).orderBy(desc(documentsTable.createdAt));
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.role === "super_admin" ? (req.body.tenantId ?? authUser.tenantId) : authUser.tenantId;
    const [doc] = await db.insert(documentsTable).values({
      ...req.body,
      tenantId,
      uploadedById: authUser.id,
    }).returning();
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(documentsTable).where(eq(documentsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Document not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const { id, tenantId, createdAt, ...data } = req.body;
    const [updated] = await db.update(documentsTable).set({ ...data, updatedAt: new Date() })
      .where(eq(documentsTable.id, Number(req.params.id))).returning();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id/approve", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [updated] = await db.update(documentsTable)
      .set({ status: "approved", approvedById: authUser.id, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(documentsTable.id, Number(req.params.id))).returning();
    if (!updated) { res.status(404).json({ message: "Document not found" }); return; }
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(documentsTable).where(eq(documentsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Document not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    await db.delete(documentsTable).where(eq(documentsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
