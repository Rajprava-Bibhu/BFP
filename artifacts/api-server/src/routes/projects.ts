import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable, projectTasksTable, projectMembersTable, projectAttachmentsTable, usersTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

async function enrichProject(p: typeof projectsTable.$inferSelect) {
  const [taskCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(projectTasksTable).where(eq(projectTasksTable.projectId, p.id));
  const [completedCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(projectTasksTable).where(and(eq(projectTasksTable.projectId, p.id), eq(projectTasksTable.status, "done")));

  const members = await db.select({ userId: projectMembersTable.userId, role: projectMembersTable.role })
    .from(projectMembersTable).where(eq(projectMembersTable.projectId, p.id));
  const memberDetails = await Promise.all(members.map(async (m) => {
    const [user] = await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, m.userId)).limit(1);
    return user ? { ...user, role: m.role, name: `${user.firstName} ${user.lastName}` } : null;
  }));

  let managerName: string | null = null;
  let approvedByName: string | null = null;
  if (p.managerId) {
    const [mgr] = await db.select().from(usersTable).where(eq(usersTable.id, p.managerId)).limit(1);
    if (mgr) managerName = `${mgr.firstName} ${mgr.lastName}`;
  }
  if (p.approvedById) {
    const [approver] = await db.select().from(usersTable).where(eq(usersTable.id, p.approvedById)).limit(1);
    if (approver) approvedByName = `${approver.firstName} ${approver.lastName}`;
  }

  const [attachCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(projectAttachmentsTable).where(eq(projectAttachmentsTable.projectId, p.id));

  return {
    ...p,
    budget: p.budget ? parseFloat(p.budget) : null,
    taskCount: taskCount?.count ?? 0,
    completedTaskCount: completedCount?.count ?? 0,
    managerName,
    approvedByName,
    members: memberDetails.filter(Boolean),
    memberCount: members.length,
    attachmentCount: attachCount?.count ?? 0,
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const { status, departmentId } = req.query;
    const conditions: any[] = [];
    if (authUser.role !== "super_admin") conditions.push(eq(projectsTable.tenantId, authUser.tenantId));
    if (status) conditions.push(eq(projectsTable.status, status as any));
    if (departmentId) conditions.push(eq(projectsTable.departmentId, parseInt(departmentId as string)));

    const projects = await db.select().from(projectsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(projectsTable.createdAt));

    const result = await Promise.all(projects.map(enrichProject));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const { departmentId, name, description, status, priority, startDate, endDate, budget, managerId, memberIds } = req.body;
    const safeDate = (d: any) => (d && d !== "" ? d : null);
    const [project] = await db.insert(projectsTable).values({
      tenantId: authUser.tenantId,
      departmentId: departmentId ?? null,
      name,
      description,
      status: status ?? "planning",
      priority: priority ?? "medium",
      startDate: safeDate(startDate),
      endDate: safeDate(endDate),
      budget: budget || null,
      managerId: managerId ?? authUser.id,
    }).returning();

    if (memberIds?.length) {
      await db.insert(projectMembersTable).values(
        memberIds.map((uid: number) => ({ projectId: project.id, userId: uid, role: "member" as const }))
      ).onConflictDoNothing();
    }
    const enriched = await enrichProject(project);
    res.status(201).json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:projectId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.projectId);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ message: "Project not found" }); return; }
    res.json(await enrichProject(project));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:projectId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.projectId);
    const { name, description, status, priority, startDate, endDate, budget, progress, managerId, departmentId } = req.body;
    const safeDate = (d: any) => (d && d !== "" ? d : null);
    const safeBudget = (b: any) => (b !== undefined && b !== "" && b !== null ? b : null);
    const [project] = await db.update(projectsTable)
      .set({ name, description, status, priority, startDate: safeDate(startDate), endDate: safeDate(endDate), budget: safeBudget(budget), progress, managerId, departmentId, updatedAt: new Date() })
      .where(eq(projectsTable.id, id)).returning();
    if (!project) { res.status(404).json({ message: "Project not found" }); return; }
    res.json(await enrichProject(project));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:projectId", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const id = parseInt(req.params.projectId);
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:projectId/tasks", requireAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const tasks = await db.select().from(projectTasksTable)
      .where(eq(projectTasksTable.projectId, projectId))
      .orderBy(projectTasksTable.createdAt);
    const result = await Promise.all(tasks.map(async (t) => {
      let assigneeName: string | null = null;
      if (t.assigneeId) {
        const [a] = await db.select().from(usersTable).where(eq(usersTable.id, t.assigneeId)).limit(1);
        if (a) assigneeName = `${a.firstName} ${a.lastName}`;
      }
      return { ...t, assigneeName };
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:projectId/tasks", requireAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { title, description, status, priority, assigneeId, dueDate, progress } = req.body;
    const safeDate = (d: any) => (d && d !== "" ? d : null);
    const [task] = await db.insert(projectTasksTable).values({
      projectId, title, description,
      status: status ?? "todo",
      priority: priority ?? "medium",
      assigneeId: assigneeId ? parseInt(assigneeId) : null,
      dueDate: safeDate(dueDate),
      progress: progress ?? 0,
    }).returning();
    res.status(201).json({ ...task, assigneeName: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/:projectId/tasks/:taskId", requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const projectId = parseInt(req.params.projectId);
    const { title, description, status, priority, assigneeId, dueDate, progress } = req.body;

    const safeDate = (d: any) => (d && d !== "" ? d : null);
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId ? parseInt(assigneeId) : null;
    if (dueDate !== undefined) updateData.dueDate = safeDate(dueDate);
    if (progress !== undefined) updateData.progress = Math.min(100, Math.max(0, parseInt(progress)));

    const [task] = await db.update(projectTasksTable).set(updateData)
      .where(and(eq(projectTasksTable.id, taskId), eq(projectTasksTable.projectId, projectId)))
      .returning();

    if (!task) { res.status(404).json({ message: "Task not found" }); return; }

    const allTasks = await db.select({ progress: projectTasksTable.progress })
      .from(projectTasksTable).where(eq(projectTasksTable.projectId, projectId));
    if (allTasks.length > 0) {
      const avgProgress = Math.round(allTasks.reduce((s, t) => s + (t.progress ?? 0), 0) / allTasks.length);
      await db.update(projectsTable).set({ progress: avgProgress, updatedAt: new Date() })
        .where(eq(projectsTable.id, projectId));
    }

    let assigneeName: string | null = null;
    if (task.assigneeId) {
      const [a] = await db.select().from(usersTable).where(eq(usersTable.id, task.assigneeId)).limit(1);
      if (a) assigneeName = `${a.firstName} ${a.lastName}`;
    }
    res.json({ ...task, assigneeName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:projectId/tasks/:taskId", requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    await db.delete(projectTasksTable).where(eq(projectTasksTable.id, taskId));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:projectId/members", requireAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const members = await db.select().from(projectMembersTable)
      .where(eq(projectMembersTable.projectId, projectId));
    const result = await Promise.all(members.map(async (m) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, m.userId)).limit(1);
      return { ...m, user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role } : null };
    }));
    res.json(result.filter(m => m.user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:projectId/members", requireAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { userId, role } = req.body;
    const existing = await db.select().from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, userId)));
    if (existing.length > 0) {
      res.status(409).json({ message: "User is already a member" });
      return;
    }
    const [member] = await db.insert(projectMembersTable).values({
      projectId, userId, role: role ?? "member",
    }).returning();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    res.status(201).json({ ...member, user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role } : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:projectId/members/:userId", requireAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const userId = parseInt(req.params.userId);
    await db.delete(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:projectId/attachments", requireAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const attachments = await db.select({
      id: projectAttachmentsTable.id,
      projectId: projectAttachmentsTable.projectId,
      taskId: projectAttachmentsTable.taskId,
      filename: projectAttachmentsTable.filename,
      fileType: projectAttachmentsTable.fileType,
      fileSize: projectAttachmentsTable.fileSize,
      uploadedById: projectAttachmentsTable.uploadedById,
      uploadedAt: projectAttachmentsTable.uploadedAt,
    }).from(projectAttachmentsTable)
      .where(eq(projectAttachmentsTable.projectId, projectId))
      .orderBy(desc(projectAttachmentsTable.uploadedAt));

    const result = await Promise.all(attachments.map(async (a) => {
      const [uploader] = await db.select().from(usersTable).where(eq(usersTable.id, a.uploadedById)).limit(1);
      return { ...a, uploaderName: uploader ? `${uploader.firstName} ${uploader.lastName}` : "Unknown" };
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:projectId/attachments", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const projectId = parseInt(req.params.projectId);
    const { filename, fileType, fileSize, fileData, taskId } = req.body;

    if (!filename || !fileType || !fileSize) {
      res.status(400).json({ message: "filename, fileType, fileSize are required" });
      return;
    }
    if (fileSize > 10 * 1024 * 1024) {
      res.status(413).json({ message: "File too large. Maximum size is 10MB." });
      return;
    }

    const [attachment] = await db.insert(projectAttachmentsTable).values({
      projectId,
      taskId: taskId ?? null,
      filename,
      fileType,
      fileSize,
      fileData: fileData ?? null,
      uploadedById: authUser.id,
    }).returning();

    res.status(201).json({ ...attachment, uploaderName: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:projectId/attachments/:attachmentId/download", requireAuth, async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.attachmentId);
    const [attachment] = await db.select().from(projectAttachmentsTable)
      .where(eq(projectAttachmentsTable.id, attachmentId)).limit(1);
    if (!attachment || !attachment.fileData) {
      res.status(404).json({ message: "Attachment not found or no data stored" });
      return;
    }
    const base64Data = attachment.fileData.split(",")[1] ?? attachment.fileData;
    const buffer = Buffer.from(base64Data, "base64");
    res.set("Content-Type", attachment.fileType);
    res.set("Content-Disposition", `attachment; filename="${attachment.filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:projectId/attachments/:attachmentId", requireAuth, async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.attachmentId);
    await db.delete(projectAttachmentsTable).where(eq(projectAttachmentsTable.id, attachmentId));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:projectId/approval/request", requireAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) { res.status(404).json({ message: "Project not found" }); return; }
    if (project.progress < 100) {
      res.status(400).json({ message: "Project must be at 100% progress to request approval" });
      return;
    }
    const [updated] = await db.update(projectsTable)
      .set({ approvalStatus: "pending", approvalRequestedAt: new Date(), updatedAt: new Date() })
      .where(eq(projectsTable.id, projectId)).returning();
    res.json(await enrichProject(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:projectId/approval/review", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const projectId = parseInt(req.params.projectId);
    const { decision, note } = req.body;
    if (!["approved", "rejected"].includes(decision)) {
      res.status(400).json({ message: "decision must be 'approved' or 'rejected'" });
      return;
    }
    const [updated] = await db.update(projectsTable).set({
      approvalStatus: decision,
      approvedAt: new Date(),
      approvedById: authUser.id,
      approvalNote: note ?? null,
      status: decision === "approved" ? "completed" : undefined,
      updatedAt: new Date(),
    }).where(eq(projectsTable.id, projectId)).returning();
    if (!updated) { res.status(404).json({ message: "Project not found" }); return; }
    res.json(await enrichProject(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
