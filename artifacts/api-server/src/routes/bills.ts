import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { billsTable, billItemsTable, billCounterTable, clientsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

async function generateBillNumber(tenantId: number, prefix = "INV"): Promise<string> {
  const existing = await db.select().from(billCounterTable).where(eq(billCounterTable.tenantId, tenantId)).limit(1);
  let counter: number;
  if (existing.length === 0) {
    const [row] = await db.insert(billCounterTable).values({ tenantId, prefix, counter: 1 }).returning();
    counter = row.counter;
  } else {
    const [row] = await db.update(billCounterTable)
      .set({ counter: existing[0].counter + 1, updatedAt: new Date() })
      .where(eq(billCounterTable.tenantId, tenantId)).returning();
    counter = row.counter;
  }
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(counter).padStart(6, "0")}`;
}

function toNum(v: any): number { return parseFloat(String(v ?? 0)) || 0; }

function parseBill(b: any) {
  return {
    ...b,
    subtotal: toNum(b.subtotal),
    taxRate: toNum(b.taxRate),
    taxAmount: toNum(b.taxAmount),
    discountAmount: toNum(b.discountAmount),
    totalAmount: toNum(b.totalAmount),
    paidAmount: toNum(b.paidAmount),
    cgstRate: toNum(b.cgstRate),
    cgstAmount: toNum(b.cgstAmount),
    sgstRate: toNum(b.sgstRate),
    sgstAmount: toNum(b.sgstAmount),
    igstRate: toNum(b.igstRate),
    igstAmount: toNum(b.igstAmount),
  };
}

function parseItem(i: any) {
  return {
    ...i,
    quantity: toNum(i.quantity),
    unitPrice: toNum(i.unitPrice),
    amount: toNum(i.amount),
    taxRate: toNum(i.taxRate),
    cgstAmount: toNum(i.cgstAmount),
    sgstAmount: toNum(i.sgstAmount),
    igstAmount: toNum(i.igstAmount),
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const bills = authUser.role === "super_admin"
      ? await db.select().from(billsTable).orderBy(desc(billsTable.createdAt))
      : await db.select().from(billsTable).where(eq(billsTable.tenantId, authUser.tenantId)).orderBy(desc(billsTable.createdAt));
    res.json(bills.map(parseBill));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/next-number", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const prefix = req.query.gst === "true" ? "GST" : "INV";
    const [existing] = await db.select().from(billCounterTable).where(eq(billCounterTable.tenantId, authUser.tenantId)).limit(1);
    const next = (existing?.counter ?? 0) + 1;
    const year = new Date().getFullYear();
    res.json({ billNumber: `${prefix}-${year}-${String(next).padStart(6, "0")}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, Number(req.params.id))).limit(1);
    if (!bill) { res.status(404).json({ message: "Bill not found" }); return; }
    if (authUser.role !== "super_admin" && bill.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const items = await db.select().from(billItemsTable).where(eq(billItemsTable.billId, bill.id)).orderBy(billItemsTable.sortOrder);
    res.json({ ...parseBill(bill), items: items.map(parseItem) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.role === "super_admin" ? (req.body.tenantId ?? authUser.tenantId) : authUser.tenantId;
    const { items = [], ...billData } = req.body;
    const safeDate = (d: any) => (d && d !== "" ? d : null);
    const prefix = billData.billCategory === "gst" ? "GST" : "INV";
    const billNumber = await generateBillNumber(tenantId, prefix);

    const [bill] = await db.insert(billsTable).values({
      tenantId,
      createdById: authUser.id,
      billNumber,
      billType: billData.billType ?? "invoice",
      billCategory: billData.billCategory ?? "normal",
      status: billData.status ?? "draft",
      issueDate: billData.issueDate,
      dueDate: safeDate(billData.dueDate),
      subject: billData.subject ?? null,
      notes: billData.notes ?? null,
      terms: billData.terms ?? null,
      currency: billData.currency ?? "USD",
      clientId: billData.clientId ? parseInt(billData.clientId) : null,
      sellerName: billData.sellerName ?? null,
      sellerAddress: billData.sellerAddress ?? null,
      sellerPhone: billData.sellerPhone ?? null,
      sellerEmail: billData.sellerEmail ?? null,
      sellerGstNumber: billData.sellerGstNumber ?? null,
      clientName: billData.clientName ?? null,
      clientAddress: billData.clientAddress ?? null,
      clientPhone: billData.clientPhone ?? null,
      clientEmail: billData.clientEmail ?? null,
      clientGstNumber: billData.clientGstNumber ?? null,
      subtotal: String(billData.subtotal ?? 0),
      discountAmount: String(billData.discountAmount ?? 0),
      taxType: billData.billCategory === "gst" ? "gst" : (billData.taxType ?? "none"),
      taxRate: String(billData.taxRate ?? 0),
      taxAmount: String(billData.taxAmount ?? 0),
      cgstRate: String(billData.cgstRate ?? 0),
      cgstAmount: String(billData.cgstAmount ?? 0),
      sgstRate: String(billData.sgstRate ?? 0),
      sgstAmount: String(billData.sgstAmount ?? 0),
      igstRate: String(billData.igstRate ?? 0),
      igstAmount: String(billData.igstAmount ?? 0),
      isInterstate: billData.isInterstate ?? false,
      totalAmount: String(billData.totalAmount ?? 0),
      paidAmount: "0",
    }).returning();

    if (items.length > 0) {
      await db.insert(billItemsTable).values(
        items.map((item: any, idx: number) => ({
          billId: bill.id,
          tenantId,
          description: item.description,
          hsn: item.hsn ?? null,
          quantity: String(item.quantity ?? 1),
          unitPrice: String(item.unitPrice ?? 0),
          amount: String(item.amount ?? 0),
          unit: item.unit ?? null,
          taxRate: String(item.taxRate ?? 0),
          cgstAmount: String(item.cgstAmount ?? 0),
          sgstAmount: String(item.sgstAmount ?? 0),
          igstAmount: String(item.igstAmount ?? 0),
          sortOrder: idx,
        }))
      );
    }

    const finalItems = await db.select().from(billItemsTable).where(eq(billItemsTable.billId, bill.id)).orderBy(billItemsTable.sortOrder);
    res.status(201).json({ ...parseBill(bill), items: finalItems.map(parseItem) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const billId = Number(req.params.id);
    const [existing] = await db.select().from(billsTable).where(eq(billsTable.id, billId)).limit(1);
    if (!existing) { res.status(404).json({ message: "Not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const { items = [], ...billData } = req.body;
    const safeDate = (d: any) => (d && d !== "" ? d : null);

    const [updated] = await db.update(billsTable).set({
      billType: billData.billType,
      billCategory: billData.billCategory,
      status: billData.status,
      issueDate: billData.issueDate,
      dueDate: safeDate(billData.dueDate),
      subject: billData.subject ?? null,
      notes: billData.notes ?? null,
      terms: billData.terms ?? null,
      currency: billData.currency,
      clientId: billData.clientId ? parseInt(billData.clientId) : null,
      sellerName: billData.sellerName ?? null,
      sellerAddress: billData.sellerAddress ?? null,
      sellerPhone: billData.sellerPhone ?? null,
      sellerEmail: billData.sellerEmail ?? null,
      sellerGstNumber: billData.sellerGstNumber ?? null,
      clientName: billData.clientName ?? null,
      clientAddress: billData.clientAddress ?? null,
      clientPhone: billData.clientPhone ?? null,
      clientEmail: billData.clientEmail ?? null,
      clientGstNumber: billData.clientGstNumber ?? null,
      subtotal: String(billData.subtotal ?? 0),
      discountAmount: String(billData.discountAmount ?? 0),
      taxRate: String(billData.taxRate ?? 0),
      taxAmount: String(billData.taxAmount ?? 0),
      cgstRate: String(billData.cgstRate ?? 0),
      cgstAmount: String(billData.cgstAmount ?? 0),
      sgstRate: String(billData.sgstRate ?? 0),
      sgstAmount: String(billData.sgstAmount ?? 0),
      igstRate: String(billData.igstRate ?? 0),
      igstAmount: String(billData.igstAmount ?? 0),
      isInterstate: billData.isInterstate ?? false,
      totalAmount: String(billData.totalAmount ?? 0),
      updatedAt: new Date(),
    }).where(eq(billsTable.id, billId)).returning();

    await db.delete(billItemsTable).where(eq(billItemsTable.billId, billId));
    if (items.length > 0) {
      await db.insert(billItemsTable).values(
        items.map((item: any, idx: number) => ({
          billId,
          tenantId: existing.tenantId,
          description: item.description,
          hsn: item.hsn ?? null,
          quantity: String(item.quantity ?? 1),
          unitPrice: String(item.unitPrice ?? 0),
          amount: String(item.amount ?? 0),
          unit: item.unit ?? null,
          taxRate: String(item.taxRate ?? 0),
          cgstAmount: String(item.cgstAmount ?? 0),
          sgstAmount: String(item.sgstAmount ?? 0),
          igstAmount: String(item.igstAmount ?? 0),
          sortOrder: idx,
        }))
      );
    }
    const finalItems = await db.select().from(billItemsTable).where(eq(billItemsTable.billId, billId)).orderBy(billItemsTable.sortOrder);
    res.json({ ...parseBill(updated), items: finalItems.map(parseItem) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id/status", requireAuth, async (req, res) => {
  try {
    const billId = Number(req.params.id);
    const { status, paidAmount } = req.body;
    const extra: any = {};
    if (status === "sent") extra.sentAt = new Date();
    if (status === "paid") extra.paidAt = new Date();
    const [updated] = await db.update(billsTable)
      .set({ status, paidAmount: paidAmount ? String(paidAmount) : undefined, ...extra, updatedAt: new Date() })
      .where(eq(billsTable.id, billId)).returning();
    if (!updated) { res.status(404).json({ message: "Not found" }); return; }
    res.json(parseBill(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    await db.delete(billsTable).where(eq(billsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
