import { pgTable, text, serial, integer, timestamp, numeric, boolean, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { clientsTable } from "./clients";
import { usersTable } from "./users";

export const billStatusEnum = pgEnum("bill_status", ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled"]);
export const billTypeEnum = pgEnum("bill_type", ["invoice", "quote", "receipt", "credit_note", "debit_note"]);
export const taxTypeEnum = pgEnum("tax_type", ["none", "gst", "vat", "sales_tax"]);
export const billCategoryEnum = pgEnum("bill_category", ["normal", "gst"]);

export const billsTable = pgTable("bills", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clientsTable.id),
  billNumber: text("bill_number").notNull(),
  billType: billTypeEnum("bill_type").notNull().default("invoice"),
  billCategory: billCategoryEnum("bill_category").notNull().default("normal"),
  status: billStatusEnum("status").notNull().default("draft"),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date"),
  subject: text("subject"),
  notes: text("notes"),
  terms: text("terms"),
  currency: text("currency").notNull().default("USD"),

  sellerName: text("seller_name"),
  sellerAddress: text("seller_address"),
  sellerPhone: text("seller_phone"),
  sellerEmail: text("seller_email"),
  sellerGstNumber: text("seller_gst_number"),

  clientName: text("client_name"),
  clientAddress: text("client_address"),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  clientGstNumber: text("client_gst_number"),

  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),

  taxType: taxTypeEnum("tax_type").notNull().default("none"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),

  cgstRate: numeric("cgst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  sgstRate: numeric("sgst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  igstRate: numeric("igst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  igstAmount: numeric("igst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  isInterstate: boolean("is_interstate").notNull().default(false),

  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),

  createdById: integer("created_by_id").references(() => usersTable.id),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const billItemsTable = pgTable("bill_items", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id").notNull().references(() => billsTable.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull(),
  description: text("description").notNull(),
  hsn: text("hsn"),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  unit: text("unit"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  igstAmount: numeric("igst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const billCounterTable = pgTable("bill_counters", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().unique().references(() => tenantsTable.id, { onDelete: "cascade" }),
  prefix: text("prefix").notNull().default("INV"),
  counter: integer("counter").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBillSchema = createInsertSchema(billsTable).omit({ id: true, billNumber: true, createdAt: true, updatedAt: true });
export type InsertBill = z.infer<typeof insertBillSchema>;
export type Bill = typeof billsTable.$inferSelect;

export const insertBillItemSchema = createInsertSchema(billItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBillItem = z.infer<typeof insertBillItemSchema>;
export type BillItem = typeof billItemsTable.$inferSelect;
