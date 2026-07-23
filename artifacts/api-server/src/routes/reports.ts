import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  attendanceTable, usersTable, departmentsTable,
  projectsTable, projectTasksTable, financialTransactionsTable,
  auditEntriesTable,
} from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router: IRouter = Router();

function tenantFilter(tenantId: number) {
  return eq(attendanceTable.tenantId, tenantId);
}

function parseDateRange(query: any) {
  const from = query.from ? String(query.from) : null;
  const to = query.to ? String(query.to) : null;
  return { from, to };
}

function inDateRange(col: any, from: string | null, to: string | null) {
  const conds = [];
  if (from) conds.push(gte(col, from));
  if (to) conds.push(lte(col, to));
  return conds;
}

// ─── Attendance Report ──────────────────────────────────────────────────────
router.get("/attendance", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { from, to } = parseDateRange(req.query);
    const deptId = req.query.departmentId ? Number(req.query.departmentId) : null;

    const where: any[] = [eq(attendanceTable.tenantId, user.tenantId)];
    if (from) where.push(gte(attendanceTable.date, from));
    if (to) where.push(lte(attendanceTable.date, to));

    const rows = await db.select({
      id: attendanceTable.id,
      date: attendanceTable.date,
      status: attendanceTable.status,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      hoursWorked: attendanceTable.hoursWorked,
      userId: attendanceTable.userId,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      departmentId: usersTable.departmentId,
      departmentName: departmentsTable.name,
    })
      .from(attendanceTable)
      .innerJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
      .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
      .where(and(...where))
      .orderBy(desc(attendanceTable.date));

    const filtered = deptId ? rows.filter(r => r.departmentId === deptId) : rows;

    const total = filtered.length;
    const present = filtered.filter(r => r.status === "present" || r.status === "late").length;
    const absent = filtered.filter(r => r.status === "absent").length;
    const late = filtered.filter(r => r.status === "late").length;
    const leave = filtered.filter(r => r.status === "leave").length;
    const avgHours = filtered.length > 0
      ? filtered.reduce((s, r) => s + (parseFloat(r.hoursWorked ?? "0") || 0), 0) / Math.max(filtered.filter(r => r.hoursWorked).length, 1)
      : 0;

    // Per-department breakdown
    const deptMap = new Map<string, { name: string; present: number; absent: number; total: number }>();
    for (const r of filtered) {
      const dn = r.departmentName ?? "No Department";
      if (!deptMap.has(dn)) deptMap.set(dn, { name: dn, present: 0, absent: 0, total: 0 });
      const d = deptMap.get(dn)!;
      d.total++;
      if (r.status === "present" || r.status === "late") d.present++;
      else if (r.status === "absent") d.absent++;
    }

    res.json({
      summary: { total, present, absent, late, leave, avgHours: Number(avgHours.toFixed(2)), attendanceRate: total > 0 ? Math.round(present / total * 100) : 0 },
      byDepartment: Array.from(deptMap.values()),
      rows: filtered.map(r => ({
        ...r, employeeName: `${r.firstName} ${r.lastName}`,
        hoursWorked: r.hoursWorked ?? "0",
      })),
    });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
});

// ─── Projects Report ────────────────────────────────────────────────────────
router.get("/projects", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { from, to } = parseDateRange(req.query);
    const statusFilter = req.query.status ? String(req.query.status) : null;

    const where: any[] = [eq(projectsTable.tenantId, user.tenantId)];
    if (from) where.push(gte(projectsTable.startDate, from));
    if (to) where.push(lte(projectsTable.startDate, to));
    if (statusFilter) where.push(eq(projectsTable.status, statusFilter as any));

    const projects = await db.select({
      id: projectsTable.id,
      name: projectsTable.name,
      status: projectsTable.status,
      priority: projectsTable.priority,
      progress: projectsTable.progress,
      startDate: projectsTable.startDate,
      endDate: projectsTable.endDate,
      budget: projectsTable.budget,
      departmentId: projectsTable.departmentId,
      departmentName: departmentsTable.name,
      managerId: projectsTable.managerId,
      managerFirst: usersTable.firstName,
      managerLast: usersTable.lastName,
    })
      .from(projectsTable)
      .leftJoin(departmentsTable, eq(projectsTable.departmentId, departmentsTable.id))
      .leftJoin(usersTable, eq(projectsTable.managerId, usersTable.id))
      .where(and(...where))
      .orderBy(desc(projectsTable.createdAt));

    // Fetch task counts per project
    const allTaskRows = await db.select({
      projectId: projectTasksTable.projectId,
      status: projectTasksTable.status,
    })
      .from(projectTasksTable)
      .innerJoin(projectsTable, eq(projectTasksTable.projectId, projectsTable.id))
      .where(eq(projectsTable.tenantId, user.tenantId));

    const taskMap = new Map<number, { total: number; done: number }>();
    for (const t of allTaskRows) {
      if (!taskMap.has(t.projectId)) taskMap.set(t.projectId, { total: 0, done: 0 });
      const m = taskMap.get(t.projectId)!;
      m.total++;
      if (t.status === "done") m.done++;
    }

    const byStatus: Record<string, number> = {};
    for (const p of projects) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    }
    const totalBudget = projects.reduce((s, p) => s + (parseFloat(p.budget ?? "0") || 0), 0);
    const avgProgress = projects.length > 0 ? projects.reduce((s, p) => s + (p.progress ?? 0), 0) / projects.length : 0;

    res.json({
      summary: { total: projects.length, byStatus, totalBudget: totalBudget.toFixed(2), avgProgress: Math.round(avgProgress) },
      rows: projects.map(p => ({
        ...p,
        managerName: p.managerId ? `${p.managerFirst ?? ""} ${p.managerLast ?? ""}`.trim() : "—",
        tasks: taskMap.get(p.id) ?? { total: 0, done: 0 },
      })),
    });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
});

// ─── Financial Report ────────────────────────────────────────────────────────
router.get("/financial", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { from, to } = parseDateRange(req.query);
    const typeFilter = req.query.type ? String(req.query.type) : null;

    const where: any[] = [eq(financialTransactionsTable.tenantId, user.tenantId)];
    if (from) where.push(gte(financialTransactionsTable.transactionDate, from));
    if (to) where.push(lte(financialTransactionsTable.transactionDate, to));
    if (typeFilter) where.push(eq(financialTransactionsTable.type, typeFilter as any));

    const txns = await db.select({
      id: financialTransactionsTable.id,
      type: financialTransactionsTable.type,
      category: financialTransactionsTable.category,
      status: financialTransactionsTable.status,
      amount: financialTransactionsTable.amount,
      currency: financialTransactionsTable.currency,
      description: financialTransactionsTable.description,
      transactionDate: financialTransactionsTable.transactionDate,
      referenceNumber: financialTransactionsTable.referenceNumber,
      paymentMethod: financialTransactionsTable.paymentMethod,
      submitterFirst: usersTable.firstName,
      submitterLast: usersTable.lastName,
    })
      .from(financialTransactionsTable)
      .leftJoin(usersTable, eq(financialTransactionsTable.userId, usersTable.id))
      .where(and(...where))
      .orderBy(desc(financialTransactionsTable.transactionDate));

    const totalIncome = txns.filter(t => t.type === "income").reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const totalExpense = txns.filter(t => t.type === "expense").reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const netBalance = totalIncome - totalExpense;

    const byCategory: Record<string, number> = {};
    for (const t of txns) {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + (parseFloat(t.amount) || 0);
    }
    const byType: Record<string, number> = {};
    for (const t of txns) {
      byType[t.type] = (byType[t.type] ?? 0) + (parseFloat(t.amount) || 0);
    }

    res.json({
      summary: {
        total: txns.length,
        totalIncome: totalIncome.toFixed(2),
        totalExpense: totalExpense.toFixed(2),
        netBalance: netBalance.toFixed(2),
        byCategory,
        byType,
      },
      rows: txns.map(t => ({ ...t, submitterName: t.submitterFirst ? `${t.submitterFirst} ${t.submitterLast}` : "—" })),
    });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
});

// ─── Department Performance Report ─────────────────────────────────────────
router.get("/departments", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { from, to } = parseDateRange(req.query);

    const departments = await db.select().from(departmentsTable)
      .where(eq(departmentsTable.tenantId, user.tenantId));

    const allUsers = await db.select({
      id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName,
      departmentId: usersTable.departmentId, role: usersTable.role, isActive: usersTable.isActive,
    }).from(usersTable).where(eq(usersTable.tenantId, user.tenantId));

    const attendanceWhere: any[] = [eq(attendanceTable.tenantId, user.tenantId)];
    if (from) attendanceWhere.push(gte(attendanceTable.date, from));
    if (to) attendanceWhere.push(lte(attendanceTable.date, to));
    const attendanceRows = await db.select({
      userId: attendanceTable.userId,
      status: attendanceTable.status,
    }).from(attendanceTable).where(and(...attendanceWhere));

    const projectsWhere: any[] = [eq(projectsTable.tenantId, user.tenantId)];
    if (from) projectsWhere.push(gte(projectsTable.startDate, from));
    if (to) projectsWhere.push(lte(projectsTable.startDate, to));
    const projectRows = await db.select({
      id: projectsTable.id, departmentId: projectsTable.departmentId,
      status: projectsTable.status, progress: projectsTable.progress,
    }).from(projectsTable).where(and(...projectsWhere));

    const deptRows = departments.map(dept => {
      const deptUsers = allUsers.filter(u => u.departmentId === dept.id);
      const deptAttendance = attendanceRows.filter(a => deptUsers.some(u => u.id === a.userId));
      const present = deptAttendance.filter(a => a.status === "present" || a.status === "late").length;
      const deptProjects = projectRows.filter(p => p.departmentId === dept.id);
      const completedProjects = deptProjects.filter(p => p.status === "completed").length;
      const avgProgress = deptProjects.length > 0
        ? Math.round(deptProjects.reduce((s, p) => s + (p.progress ?? 0), 0) / deptProjects.length)
        : 0;
      const head = allUsers.find(u => u.id === dept.headUserId);

      return {
        id: dept.id,
        name: dept.name,
        headName: head ? `${head.firstName} ${head.lastName}` : "—",
        employeeCount: deptUsers.filter(u => u.isActive).length,
        totalAttendance: deptAttendance.length,
        presentCount: present,
        attendanceRate: deptAttendance.length > 0 ? Math.round(present / deptAttendance.length * 100) : 0,
        totalProjects: deptProjects.length,
        completedProjects,
        avgProgress,
      };
    });

    const overallAttendanceRate = deptRows.reduce((s, d) => s + d.attendanceRate, 0) / Math.max(deptRows.length, 1);
    const totalEmployees = deptRows.reduce((s, d) => s + d.employeeCount, 0);

    res.json({
      summary: {
        totalDepartments: departments.length,
        totalEmployees,
        overallAttendanceRate: Math.round(overallAttendanceRate),
        totalProjects: projectRows.length,
      },
      rows: deptRows,
    });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
});

// ─── Audit Report ────────────────────────────────────────────────────────────
router.get("/audit-report", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { from, to } = parseDateRange(req.query);
    const actionFilter = req.query.action ? String(req.query.action) : null;
    const resourceFilter = req.query.resourceType ? String(req.query.resourceType) : null;

    const where: any[] = [eq(auditEntriesTable.tenantId, user.tenantId)];
    if (from) where.push(gte(sql`${auditEntriesTable.createdAt}::date`, from));
    if (to) where.push(lte(sql`${auditEntriesTable.createdAt}::date`, to));
    if (actionFilter) where.push(eq(auditEntriesTable.action, actionFilter as any));

    const rows = await db.select({
      id: auditEntriesTable.id,
      action: auditEntriesTable.action,
      resourceType: auditEntriesTable.resourceType,
      description: auditEntriesTable.description,
      ipAddress: auditEntriesTable.ipAddress,
      createdAt: auditEntriesTable.createdAt,
      userId: auditEntriesTable.userId,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
      .from(auditEntriesTable)
      .leftJoin(usersTable, eq(auditEntriesTable.userId, usersTable.id))
      .where(and(...where))
      .orderBy(desc(auditEntriesTable.createdAt))
      .limit(1000);

    const filtered = resourceFilter ? rows.filter(r => r.resourceType === resourceFilter) : rows;

    const byAction: Record<string, number> = {};
    const byResource: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    for (const r of filtered) {
      byAction[r.action] = (byAction[r.action] ?? 0) + 1;
      byResource[r.resourceType] = (byResource[r.resourceType] ?? 0) + 1;
      const name = r.firstName ? `${r.firstName} ${r.lastName}` : `User ${r.userId}`;
      byUser[name] = (byUser[name] ?? 0) + 1;
    }

    res.json({
      summary: { total: filtered.length, byAction, byResource, byUser },
      rows: filtered.map(r => ({
        ...r,
        userName: r.firstName ? `${r.firstName} ${r.lastName}` : "Unknown",
      })),
    });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
});

// ─── Departments list (for filters) ─────────────────────────────────────────
router.get("/meta/departments", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const depts = await db.select({ id: departmentsTable.id, name: departmentsTable.name })
      .from(departmentsTable)
      .where(eq(departmentsTable.tenantId, user.tenantId));
    res.json(depts);
  } catch (err) { res.status(500).json({ message: "Internal server error" }); }
});

export default router;
