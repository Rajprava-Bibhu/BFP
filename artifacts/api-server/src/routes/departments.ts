import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { departmentsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const depts = await db.select().from(departmentsTable)
      .where(authUser.role === "super_admin" ? undefined : eq(departmentsTable.tenantId, authUser.tenantId));

    const result = await Promise.all(depts.map(async (d) => {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(and(eq(usersTable.departmentId, d.id), eq(usersTable.tenantId, d.tenantId)));

      let headName: string | null = null;
      if (d.headUserId) {
        const [head] = await db.select().from(usersTable).where(eq(usersTable.id, d.headUserId)).limit(1);
        if (head) headName = `${head.firstName} ${head.lastName}`;
      }

      return {
        ...d,
        employeeCount: countResult?.count ?? 0,
        headName,
      };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const { name, description, headUserId } = req.body;
    const [dept] = await db.insert(departmentsTable).values({
      tenantId: authUser.tenantId,
      name,
      description,
      headUserId,
    }).returning();

    let headName: string | null = null;
    if (dept.headUserId) {
      const [head] = await db.select().from(usersTable).where(eq(usersTable.id, dept.headUserId)).limit(1);
      if (head) headName = `${head.firstName} ${head.lastName}`;
    }

    res.status(201).json({ ...dept, employeeCount: 0, headName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:departmentId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.departmentId);
    const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, id));
    if (!dept) {
      res.status(404).json({ message: "Department not found" });
      return;
    }
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.departmentId, id));
    let headName: string | null = null;
    if (dept.headUserId) {
      const [head] = await db.select().from(usersTable).where(eq(usersTable.id, dept.headUserId)).limit(1);
      if (head) headName = `${head.firstName} ${head.lastName}`;
    }
    res.json({ ...dept, employeeCount: countResult?.count ?? 0, headName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:departmentId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.departmentId);
    const { name, description, headUserId } = req.body;
    const [dept] = await db.update(departmentsTable)
      .set({ name, description, headUserId, updatedAt: new Date() })
      .where(eq(departmentsTable.id, id))
      .returning();
    if (!dept) {
      res.status(404).json({ message: "Department not found" });
      return;
    }
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.departmentId, id));
    let headName: string | null = null;
    if (dept.headUserId) {
      const [head] = await db.select().from(usersTable).where(eq(usersTable.id, dept.headUserId)).limit(1);
      if (head) headName = `${head.firstName} ${head.lastName}`;
    }
    res.json({ ...dept, employeeCount: countResult?.count ?? 0, headName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:departmentId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.departmentId);
    await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
    res.json({ success: true, message: "Department deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
