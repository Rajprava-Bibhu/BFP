import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  tenantsTable, usersTable, projectsTable, subscriptionsTable,
  invoicesTable, attendanceTable, departmentsTable, campaignsTable
} from "@workspace/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/overview", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const isAdmin = authUser.role === "super_admin";

    const [totalTenants] = await db.select({ count: sql<number>`count(*)::int` }).from(tenantsTable);
    const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable)
      .where(isAdmin ? undefined : eq(usersTable.tenantId, authUser.tenantId));
    const [totalProjects] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable)
      .where(isAdmin ? undefined : eq(projectsTable.tenantId, authUser.tenantId));
    const [activeProjects] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable)
      .where(isAdmin ? eq(projectsTable.status, "active") : and(eq(projectsTable.tenantId, authUser.tenantId), eq(projectsTable.status, "active")));

    const revenueMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthName = d.toLocaleString('default', { month: 'short' });
      revenueMonths.push({ month: monthName, revenue: Math.floor(Math.random() * 50000) + 10000 });
    }

    const projectStatusCounts = await db
      .select({ status: projectsTable.status, count: sql<number>`count(*)::int` })
      .from(projectsTable)
      .where(isAdmin ? undefined : eq(projectsTable.tenantId, authUser.tenantId))
      .groupBy(projectsTable.status);

    const userRoleCounts = await db
      .select({ role: usersTable.role, count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(isAdmin ? undefined : eq(usersTable.tenantId, authUser.tenantId))
      .groupBy(usersTable.role);

    const [campaignsThisMonth] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignsTable)
      .where(isAdmin ? undefined : eq(campaignsTable.tenantId, authUser.tenantId));

    const totalRevenue = revenueMonths.reduce((sum, m) => sum + m.revenue, 0);
    const monthlyRevenue = revenueMonths[revenueMonths.length - 1]?.revenue ?? 0;

    res.json({
      totalTenants: totalTenants?.count ?? 0,
      totalUsers: totalUsers?.count ?? 0,
      totalProjects: totalProjects?.count ?? 0,
      activeProjects: activeProjects?.count ?? 0,
      totalRevenue,
      monthlyRevenue,
      attendanceRate: 87.5,
      campaignsThisMonth: campaignsThisMonth?.count ?? 0,
      revenueByMonth: revenueMonths,
      projectsByStatus: projectStatusCounts.map(p => ({ status: p.status, count: p.count })),
      usersByRole: userRoleCounts.map(u => ({ role: u.role, count: u.count })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/attendance", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const deptAttendance = await db.select({ name: departmentsTable.name })
      .from(departmentsTable)
      .where(authUser.role === "super_admin" ? undefined : eq(departmentsTable.tenantId, authUser.tenantId));

    const dailyAttendance = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dailyAttendance.push({
        date: d.toISOString().split("T")[0],
        present: Math.floor(Math.random() * 20) + 30,
        absent: Math.floor(Math.random() * 5) + 2,
        late: Math.floor(Math.random() * 5) + 1,
      });
    }

    res.json({
      dailyAttendance,
      departmentAttendance: deptAttendance.map(d => ({
        department: d.name,
        rate: Math.random() * 20 + 75,
      })),
      avgHoursPerDay: 7.8,
      onTimeRate: 88.5,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/projects", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable)
      .where(authUser.role === "super_admin" ? undefined : eq(projectsTable.tenantId, authUser.tenantId));

    const [completed] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable)
      .where(authUser.role === "super_admin" ? eq(projectsTable.status, "completed") : and(eq(projectsTable.tenantId, authUser.tenantId), eq(projectsTable.status, "completed")));

    const priorityCounts = await db
      .select({ status: projectsTable.priority, count: sql<number>`count(*)::int` })
      .from(projectsTable)
      .where(authUser.role === "super_admin" ? undefined : eq(projectsTable.tenantId, authUser.tenantId))
      .groupBy(projectsTable.priority);

    res.json({
      totalProjects: total?.count ?? 0,
      completedThisMonth: completed?.count ?? 0,
      overdueProjects: Math.floor(Math.random() * 5),
      avgCompletionRate: 73,
      projectsByPriority: priorityCounts.map(p => ({ status: p.status, count: p.count })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/revenue", requireAuth, async (req, res) => {
  try {
    const invoices = await db.select().from(invoicesTable);
    const totalRevenue = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + parseFloat(i.amount), 0);
    const mrr = totalRevenue / 12;
    const arr = mrr * 12;

    const invoicesByStatus = ["draft", "open", "paid", "void"].map(status => ({
      status,
      count: invoices.filter(i => i.status === status).length,
    }));

    res.json({
      totalRevenue,
      mrr,
      arr,
      revenueGrowth: 12.5,
      planDistribution: [
        { plan: "free", revenue: 0, count: 5 },
        { plan: "starter", revenue: mrr * 0.2, count: 10 },
        { plan: "professional", revenue: mrr * 0.5, count: 8 },
        { plan: "enterprise", revenue: mrr * 0.3, count: 3 },
      ],
      invoicesByStatus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
