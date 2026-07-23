import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { billingPlansTable, subscriptionsTable, invoicesTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/plans", async (_req, res) => {
  try {
    const plans = await db.select().from(billingPlansTable).orderBy(billingPlansTable.price);
    res.json(plans.map(p => ({ ...p, price: parseFloat(p.price) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/subscriptions", requireAuth, requireRole("super_admin", "org_admin"), async (_req, res) => {
  try {
    const subs = await db.select().from(subscriptionsTable).orderBy(subscriptionsTable.createdAt);
    const result = await Promise.all(subs.map(async (s) => {
      const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, s.tenantId)).limit(1);
      const [plan] = await db.select().from(billingPlansTable).where(eq(billingPlansTable.id, s.planId)).limit(1);
      return {
        ...s,
        amount: parseFloat(s.amount),
        tenantName: tenant?.name ?? "Unknown",
        planName: plan?.name ?? "Unknown",
      };
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/subscriptions", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { tenantId, planId } = req.body;
    const [plan] = await db.select().from(billingPlansTable).where(eq(billingPlansTable.id, planId)).limit(1);
    if (!plan) {
      res.status(404).json({ message: "Plan not found" });
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const [sub] = await db.insert(subscriptionsTable).values({
      tenantId,
      planId,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      amount: plan.price,
    }).returning();

    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);

    res.status(201).json({
      ...sub,
      amount: parseFloat(sub.amount),
      tenantName: tenant?.name ?? "Unknown",
      planName: plan.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/invoices", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const invoices = authUser.role === "super_admin"
      ? await db.select().from(invoicesTable).orderBy(invoicesTable.createdAt)
      : await db.select().from(invoicesTable).where(eq(invoicesTable.tenantId, authUser.tenantId)).orderBy(invoicesTable.createdAt);

    const result = await Promise.all(invoices.map(async (inv) => {
      const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, inv.tenantId)).limit(1);
      return { ...inv, amount: parseFloat(inv.amount), tenantName: tenant?.name ?? "Unknown" };
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
