import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { tenantsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/", requireAuth, requireRole("super_admin"), async (_req, res) => {
  try {
    const tenants = await db.select().from(tenantsTable).orderBy(tenantsTable.createdAt);
    const tenantsWithCount = await Promise.all(
      tenants.map(async (t) => {
        const countResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(usersTable)
          .where(eq(usersTable.tenantId, t.id));
        return { ...t, employeeCount: countResult[0]?.count ?? 0 };
      })
    );
    res.json(tenantsWithCount);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { name, slug, domain, plan, adminEmail, adminPassword, adminFirstName, adminLastName } = req.body;
    
    const [tenant] = await db.insert(tenantsTable).values({ name, slug, domain, plan }).returning();
    
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await db.insert(usersTable).values({
      tenantId: tenant.id,
      email: adminEmail,
      passwordHash,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: "org_admin",
    });
    
    res.status(201).json({ ...tenant, employeeCount: 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:tenantId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.tenantId);
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id));
    if (!tenant) {
      res.status(404).json({ message: "Tenant not found" });
      return;
    }
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.tenantId, id));
    res.json({ ...tenant, employeeCount: countResult?.count ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:tenantId", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.tenantId);
    const { name, domain, plan, isActive } = req.body;
    const [tenant] = await db
      .update(tenantsTable)
      .set({ name, domain, plan, isActive, updatedAt: new Date() })
      .where(eq(tenantsTable.id, id))
      .returning();
    if (!tenant) {
      res.status(404).json({ message: "Tenant not found" });
      return;
    }
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.tenantId, id));
    res.json({ ...tenant, employeeCount: countResult?.count ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:tenantId", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.tenantId);
    await db.delete(tenantsTable).where(eq(tenantsTable.id, id));
    res.json({ success: true, message: "Tenant deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
