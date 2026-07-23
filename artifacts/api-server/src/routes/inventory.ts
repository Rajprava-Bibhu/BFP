import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { inventoryItemsTable, inventoryTransactionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const items = authUser.role === "super_admin"
      ? await db.select().from(inventoryItemsTable).orderBy(inventoryItemsTable.name)
      : await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.tenantId, authUser.tenantId)).orderBy(inventoryItemsTable.name);
    res.json(items.map(i => ({
      ...i,
      quantityOnHand: parseFloat(i.quantityOnHand),
      minimumQuantity: parseFloat(i.minimumQuantity),
      reorderQuantity: parseFloat(i.reorderQuantity),
      unitCost: parseFloat(i.unitCost),
      unitPrice: parseFloat(i.unitPrice),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.role === "super_admin" ? (req.body.tenantId ?? authUser.tenantId) : authUser.tenantId;
    const [item] = await db.insert(inventoryItemsTable).values({ ...req.body, tenantId }).returning();
    res.status(201).json({ ...item, quantityOnHand: parseFloat(item.quantityOnHand), unitCost: parseFloat(item.unitCost) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [existing] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, Number(req.params.id))).limit(1);
    if (!existing) { res.status(404).json({ message: "Item not found" }); return; }
    if (authUser.role !== "super_admin" && existing.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const { id, tenantId, createdAt, ...data } = req.body;
    const [updated] = await db.update(inventoryItemsTable).set({ ...data, updatedAt: new Date() })
      .where(eq(inventoryItemsTable.id, Number(req.params.id))).returning();
    res.json({ ...updated, quantityOnHand: parseFloat(updated.quantityOnHand), unitCost: parseFloat(updated.unitCost) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/restock", requireAuth, requireRole("super_admin", "org_admin", "department_head"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [item] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, Number(req.params.id))).limit(1);
    if (!item) { res.status(404).json({ message: "Item not found" }); return; }
    if (authUser.role !== "super_admin" && item.tenantId !== authUser.tenantId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    const { quantity, notes } = req.body;
    const before = parseFloat(item.quantityOnHand);
    const after = before + Number(quantity);
    const [updated] = await db.update(inventoryItemsTable)
      .set({
        quantityOnHand: after.toString(),
        status: after > parseFloat(item.minimumQuantity) ? "in_stock" : "low_stock",
        lastRestockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(inventoryItemsTable.id, item.id)).returning();
    await db.insert(inventoryTransactionsTable).values({
      tenantId: item.tenantId,
      itemId: item.id,
      userId: authUser.id,
      type: "restock",
      quantity: quantity.toString(),
      quantityBefore: before.toString(),
      quantityAfter: after.toString(),
      notes,
    });
    res.json({ ...updated, quantityOnHand: parseFloat(updated.quantityOnHand) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
