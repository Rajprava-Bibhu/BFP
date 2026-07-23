import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const bankStatementsTable = pgTable("bank_statements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  period: text("period"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  totalEntries: integer("total_entries").notNull().default(0),
  totalCredits: text("total_credits").notNull().default("0"),
  totalDebits: text("total_debits").notNull().default("0"),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bankStatementEntriesTable = pgTable("bank_statement_entries", {
  id: serial("id").primaryKey(),
  statementId: integer("statement_id").notNull().references(() => bankStatementsTable.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull(),
  date: text("date").notNull(),
  description: text("description"),
  credit: text("credit").notNull().default("0"),
  debit: text("debit").notNull().default("0"),
  balance: text("balance"),
  referenceNo: text("reference_no"),
});

export const cashbookEntriesTable = pgTable("cashbook_entries", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  description: text("description"),
  credit: text("credit").notNull().default("0"),
  debit: text("debit").notNull().default("0"),
  referenceNo: text("reference_no"),
  category: text("category"),
  entrySource: text("entry_source").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reconciliationReportsTable = pgTable("reconciliation_reports", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  statementId: integer("statement_id").references(() => bankStatementsTable.id),
  reportName: text("report_name").notNull(),
  period: text("period"),
  matchedCount: integer("matched_count").notNull().default(0),
  unmatchedBankCount: integer("unmatched_bank_count").notNull().default(0),
  unmatchedCashbookCount: integer("unmatched_cashbook_count").notNull().default(0),
  totalBankCredits: text("total_bank_credits").notNull().default("0"),
  totalBankDebits: text("total_bank_debits").notNull().default("0"),
  totalCashbookCredits: text("total_cashbook_credits").notNull().default("0"),
  totalCashbookDebits: text("total_cashbook_debits").notNull().default("0"),
  differenceCredits: text("difference_credits").notNull().default("0"),
  differenceDebits: text("difference_debits").notNull().default("0"),
  reportData: text("report_data").notNull().default("{}"),
  generatedById: integer("generated_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BankStatement = typeof bankStatementsTable.$inferSelect;
export type BankStatementEntry = typeof bankStatementEntriesTable.$inferSelect;
export type CashbookEntry = typeof cashbookEntriesTable.$inferSelect;
export type ReconciliationReport = typeof reconciliationReportsTable.$inferSelect;
