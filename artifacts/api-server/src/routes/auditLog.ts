import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { auditEntriesTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const entries = authUser.role === "super_admin"
      ? await db.select().from(auditEntriesTable).orderBy(desc(auditEntriesTable.createdAt)).limit(500)
      : await db.select().from(auditEntriesTable).where(eq(auditEntriesTable.tenantId, authUser.tenantId)).orderBy(desc(auditEntriesTable.createdAt)).limit(500);
    
    const result = await Promise.all(entries.map(async (entry) => {
      if (!entry.userId) return { ...entry, userName: "System", userEmail: "" };
      const [user] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, entry.userId)).limit(1);
      return {
        ...entry,
        userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
        userEmail: user?.email ?? "",
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
    const tenantId = authUser.role === "super_admin" ? (req.body.tenantId ?? authUser.tenantId) : authUser.tenantId;
    const [entry] = await db.insert(auditEntriesTable).values({
      ...req.body,
      tenantId,
      userId: authUser.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    }).returning();
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
