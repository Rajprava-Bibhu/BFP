import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { calendarEventsTable, holidaysTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/events", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const events = authUser.role === "super_admin"
      ? await db.select().from(calendarEventsTable).orderBy(calendarEventsTable.startAt)
      : await db.select().from(calendarEventsTable).where(eq(calendarEventsTable.tenantId, authUser.tenantId)).orderBy(calendarEventsTable.startAt);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/events", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.role === "super_admin" ? (req.body.tenantId ?? authUser.tenantId) : authUser.tenantId;
    const [event] = await db.insert(calendarEventsTable).values({
      ...req.body,
      tenantId,
      createdById: authUser.id,
    }).returning();
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/events/:id", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(calendarEventsTable).where(eq(calendarEventsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Event not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const { id, tenantId, createdAt, ...data } = req.body;
    const [updated] = await db.update(calendarEventsTable).set({ ...data, updatedAt: new Date() })
      .where(eq(calendarEventsTable.id, Number(req.params.id))).returning();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/events/:id", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(calendarEventsTable).where(eq(calendarEventsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Event not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    await db.delete(calendarEventsTable).where(eq(calendarEventsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/holidays", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const holidays = authUser.role === "super_admin"
      ? await db.select().from(holidaysTable).orderBy(holidaysTable.date)
      : await db.select().from(holidaysTable).where(eq(holidaysTable.tenantId, authUser.tenantId)).orderBy(holidaysTable.date);
    res.json(holidays);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/holidays", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.role === "super_admin" ? (req.body.tenantId ?? authUser.tenantId) : authUser.tenantId;
    const [holiday] = await db.insert(holidaysTable).values({ ...req.body, tenantId }).returning();
    res.status(201).json(holiday);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/holidays/:id", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    await db.delete(holidaysTable).where(eq(holidaysTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
