import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const { tenantId, role, departmentId } = req.query;

    let tenantFilter = authUser.role === "super_admin" ? undefined : authUser.tenantId;
    if (tenantId) tenantFilter = parseInt(tenantId as string);

    const conditions: any[] = [];
    if (tenantFilter) conditions.push(eq(usersTable.tenantId, tenantFilter));
    if (role) conditions.push(eq(usersTable.role, role as any));
    if (departmentId) conditions.push(eq(usersTable.departmentId, parseInt(departmentId as string)));

    const users = await db.select({
      id: usersTable.id,
      tenantId: usersTable.tenantId,
      departmentId: usersTable.departmentId,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      avatar: usersTable.avatar,
      phone: usersTable.phone,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const { tenantId, departmentId, email, password, firstName, lastName, role, phone } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      tenantId, departmentId, email, passwordHash, firstName, lastName, role, phone
    }).returning({
      id: usersTable.id,
      tenantId: usersTable.tenantId,
      departmentId: usersTable.departmentId,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      avatar: usersTable.avatar,
      phone: usersTable.phone,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    });
    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.userId);
    const [user] = await db.select({
      id: usersTable.id,
      tenantId: usersTable.tenantId,
      departmentId: usersTable.departmentId,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      avatar: usersTable.avatar,
      phone: usersTable.phone,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, id));
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:userId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.userId);
    const { departmentId, firstName, lastName, role, phone, isActive } = req.body;
    const [user] = await db.update(usersTable)
      .set({ departmentId, firstName, lastName, role, phone, isActive, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        tenantId: usersTable.tenantId,
        departmentId: usersTable.departmentId,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        avatar: usersTable.avatar,
        phone: usersTable.phone,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:userId", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.userId);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
