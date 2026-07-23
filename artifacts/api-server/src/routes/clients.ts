import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  clientsTable, clientInteractionsTable, clientDocumentsTable, projectsTable,
} from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

const tenantFilter = (authUser: any) =>
  authUser.role === "super_admin" ? undefined : authUser.tenantId;

// ── GET /clients/stats ──────────────────────────────────────────────────────
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tId = tenantFilter(authUser);
    const where = tId ? eq(clientsTable.tenantId, tId) : undefined;

    const [all] = await db.select({ count: count() }).from(clientsTable).where(where);
    const [active] = await db.select({ count: count() }).from(clientsTable)
      .where(tId ? and(eq(clientsTable.tenantId, tId), eq(clientsTable.status, "active")) : eq(clientsTable.status, "active"));
    const [inactive] = await db.select({ count: count() }).from(clientsTable)
      .where(tId ? and(eq(clientsTable.tenantId, tId), eq(clientsTable.status, "inactive")) : eq(clientsTable.status, "inactive"));
    const [prospect] = await db.select({ count: count() }).from(clientsTable)
      .where(tId ? and(eq(clientsTable.tenantId, tId), eq(clientsTable.status, "prospect")) : eq(clientsTable.status, "prospect"));

    res.json({
      total:   Number(all.count),
      active:  Number(active.count),
      inactive:Number(inactive.count),
      prospect:Number(prospect.count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /clients ─────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tId = tenantFilter(authUser);
    const clients = tId
      ? await db.select().from(clientsTable).where(eq(clientsTable.tenantId, tId)).orderBy(clientsTable.name)
      : await db.select().from(clientsTable).orderBy(clientsTable.name);
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /clients/:id ─────────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [client] = await db.select().from(clientsTable)
      .where(eq(clientsTable.id, Number(req.params.id))).limit(1);
    if (!client) { res.status(404).json({ message: "Client not found" }); return; }
    if (authUser.role !== "super_admin" && client.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /clients ─────────────────────────────────────────────────────────────
router.post("/", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.role === "super_admin" ? (req.body.tenantId ?? authUser.tenantId) : authUser.tenantId;

    // Auto-generate client code CL001, CL002, ...
    const [{ seq }] = await db.select({ seq: sql<number>`count(*)` }).from(clientsTable)
      .where(eq(clientsTable.tenantId, tenantId));
    const clientCode = `CL${String(Number(seq) + 1).padStart(3, "0")}`;

    const { id: _id, createdAt: _c, updatedAt: _u, ...body } = req.body;
    const [client] = await db.insert(clientsTable).values({ ...body, tenantId, clientCode }).returning();
    res.status(201).json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── PUT /clients/:id ──────────────────────────────────────────────────────────
router.put("/:id", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(clientsTable)
      .where(eq(clientsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Client not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const { id: _id, tenantId: _t, createdAt: _c, clientCode: _cc, ...data } = req.body;
    const [updated] = await db.update(clientsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clientsTable.id, Number(req.params.id))).returning();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DELETE /clients/:id ───────────────────────────────────────────────────────
router.delete("/:id", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(clientsTable)
      .where(eq(clientsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Client not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    await db.delete(clientsTable).where(eq(clientsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /clients/:id/interactions ─────────────────────────────────────────────
router.get("/:id/interactions", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const clientId = Number(req.params.id);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
    if (!client || (authUser.role !== "super_admin" && client.tenantId !== authUser.tenantId)) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const interactions = await db.select().from(clientInteractionsTable)
      .where(eq(clientInteractionsTable.clientId, clientId))
      .orderBy(sql`${clientInteractionsTable.interactionDate} DESC`);
    res.json(interactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /clients/:id/interactions ────────────────────────────────────────────
router.post("/:id/interactions", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const clientId = Number(req.params.id);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
    if (!client || (authUser.role !== "super_admin" && client.tenantId !== authUser.tenantId)) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const safeDate = (d: any) => (d && d !== "" ? d : null);
    const [interaction] = await db.insert(clientInteractionsTable).values({
      tenantId:         client.tenantId,
      clientId,
      interactionType:  req.body.interactionType,
      interactionDate:  req.body.interactionDate,
      notes:            req.body.notes ?? null,
      nextFollowupDate: safeDate(req.body.nextFollowupDate),
      createdBy:        authUser.id,
    }).returning();
    res.status(201).json(interaction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DELETE /clients/:id/interactions/:iid ─────────────────────────────────────
router.delete("/:id/interactions/:iid", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    await db.delete(clientInteractionsTable)
      .where(eq(clientInteractionsTable.id, Number(req.params.iid)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /clients/:id/documents ────────────────────────────────────────────────
router.get("/:id/documents", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const clientId = Number(req.params.id);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
    if (!client || (authUser.role !== "super_admin" && client.tenantId !== authUser.tenantId)) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const docs = await db.select().from(clientDocumentsTable)
      .where(eq(clientDocumentsTable.clientId, clientId))
      .orderBy(sql`${clientDocumentsTable.createdAt} DESC`);
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /clients/:id/documents ───────────────────────────────────────────────
router.post("/:id/documents", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const clientId = Number(req.params.id);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
    if (!client || (authUser.role !== "super_admin" && client.tenantId !== authUser.tenantId)) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const { fileName, fileUrl, fileType, fileSize } = req.body;
    const [doc] = await db.insert(clientDocumentsTable).values({
      tenantId:   client.tenantId,
      clientId,
      fileName,
      fileUrl,
      fileType,
      fileSize:   fileSize ? Number(fileSize) : null,
      uploadedBy: authUser.id,
    }).returning();
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DELETE /clients/:id/documents/:did ────────────────────────────────────────
router.delete("/:id/documents/:did", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    await db.delete(clientDocumentsTable)
      .where(eq(clientDocumentsTable.id, Number(req.params.did)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /clients/:id/projects ─────────────────────────────────────────────────
router.get("/:id/projects", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const clientId = Number(req.params.id);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
    if (!client || (authUser.role !== "super_admin" && client.tenantId !== authUser.tenantId)) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const tId = tenantFilter(authUser);
    const projects = tId
      ? await db.select().from(projectsTable).where(eq(projectsTable.tenantId, tId)).limit(100)
      : await db.select().from(projectsTable).limit(100);
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
