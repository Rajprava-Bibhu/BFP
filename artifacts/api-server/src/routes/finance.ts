import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { financialTransactionsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/transactions", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const txns = authUser.role === "super_admin"
      ? await db.select().from(financialTransactionsTable).orderBy(desc(financialTransactionsTable.transactionDate))
      : await db.select().from(financialTransactionsTable)
          .where(eq(financialTransactionsTable.tenantId, authUser.tenantId))
          .orderBy(desc(financialTransactionsTable.transactionDate));
    res.json(txns.map(t => ({ ...t, amount: parseFloat(t.amount) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/summary", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantFilter = authUser.role !== "super_admin" 
      ? sql`WHERE tenant_id = ${authUser.tenantId} AND status = 'completed'`
      : sql`WHERE status = 'completed'`;
    const result = await db.execute(sql`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
        SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END) as net_profit,
        COUNT(*) as total_transactions
      FROM financial_transactions
      ${tenantFilter}
    `);
    const row = (result as any).rows?.[0] ?? result?.[0] ?? {};
    res.json({
      totalIncome: parseFloat(row.total_income ?? 0),
      totalExpense: parseFloat(row.total_expense ?? 0),
      netProfit: parseFloat(row.net_profit ?? 0),
      totalTransactions: parseInt(row.total_transactions ?? 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/transactions", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.role === "super_admin" ? (req.body.tenantId ?? authUser.tenantId) : authUser.tenantId;
    const [txn] = await db.insert(financialTransactionsTable).values({
      ...req.body,
      tenantId,
      userId: authUser.id,
    }).returning();
    res.status(201).json({ ...txn, amount: parseFloat(txn.amount) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/transactions/:id/approve", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [updated] = await db.update(financialTransactionsTable)
      .set({ status: "completed", approvedById: authUser.id, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(financialTransactionsTable.id, Number(req.params.id))).returning();
    if (!updated) { res.status(404).json({ message: "Transaction not found" }); return; }
    res.json({ ...updated, amount: parseFloat(updated.amount) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
