import { pgTable, text, serial, integer, timestamp, numeric, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const inventoryCategoryEnum = pgEnum("inventory_category", [
  "electronics", "furniture", "stationery", "equipment",
  "software", "vehicles", "raw_materials", "finished_goods",
  "spare_parts", "other"
]);
export const inventoryStatusEnum = pgEnum("inventory_status", [
  "in_stock", "low_stock", "out_of_stock", "discontinued", "on_order"
]);
export const inventoryUnitEnum = pgEnum("inventory_unit", [
  "piece", "box", "kg", "liter", "meter", "set", "pair", "unit"
]);

export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: inventoryCategoryEnum("category").notNull().default("other"),
  status: inventoryStatusEnum("status").notNull().default("in_stock"),
  unit: inventoryUnitEnum("unit").notNull().default("piece"),
  quantityOnHand: numeric("quantity_on_hand", { precision: 12, scale: 2 }).notNull().default("0"),
  minimumQuantity: numeric("minimum_quantity", { precision: 12, scale: 2 }).notNull().default("0"),
  reorderQuantity: numeric("reorder_quantity", { precision: 12, scale: 2 }).notNull().default("0"),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  location: text("location"),
  supplier: text("supplier"),
  supplierSku: text("supplier_sku"),
  barcode: text("barcode"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  managedById: integer("managed_by_id").references(() => usersTable.id),
  lastRestockedAt: timestamp("last_restocked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const inventoryTransactionsTable = pgTable("inventory_transactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  itemId: integer("item_id").notNull().references(() => inventoryItemsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id),
  type: text("type").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  quantityBefore: numeric("quantity_before", { precision: 12, scale: 2 }).notNull(),
  quantityAfter: numeric("quantity_after", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
