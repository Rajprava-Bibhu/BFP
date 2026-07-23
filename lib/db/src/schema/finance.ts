import { pgTable, text, serial, integer, timestamp, numeric, boolean, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income", "expense", "transfer", "refund", "adjustment"
]);
export const transactionCategoryEnum = pgEnum("transaction_category", [
  "salary", "rent", "utilities", "software", "marketing",
  "travel", "office_supplies", "equipment", "consulting",
  "sales", "subscription", "tax", "insurance", "other"
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending", "completed", "failed", "cancelled", "reversed"
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash", "bank_transfer", "credit_card", "debit_card",
  "cheque", "paypal", "stripe", "crypto", "other"
]);

export const financialTransactionsTable = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id),
  referenceNumber: text("reference_number").notNull(),
  type: transactionTypeEnum("type").notNull(),
  category: transactionCategoryEnum("category").notNull().default("other"),
  status: transactionStatusEnum("status").notNull().default("pending"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("bank_transfer"),
  description: text("description").notNull(),
  notes: text("notes"),
  transactionDate: date("transaction_date").notNull(),
  accountFrom: text("account_from"),
  accountTo: text("account_to"),
  relatedBillId: integer("related_bill_id"),
  tags: text("tags").array().notNull().default([]),
  attachmentUrl: text("attachment_url"),
  approvedById: integer("approved_by_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFinancialTransactionSchema = createInsertSchema(financialTransactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
export type FinancialTransaction = typeof financialTransactionsTable.$inferSelect;
