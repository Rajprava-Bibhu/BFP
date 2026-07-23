import { pgTable, text, serial, integer, timestamp, boolean, bigint, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const documentTypeEnum = pgEnum("document_type", [
  "contract", "policy", "report", "invoice", "receipt",
  "proposal", "presentation", "spreadsheet", "image",
  "certificate", "agreement", "manual", "other"
]);
export const documentStatusEnum = pgEnum("document_status", [
  "draft", "under_review", "approved", "rejected", "archived", "expired"
]);
export const documentAccessEnum = pgEnum("document_access", [
  "private", "department", "organization", "public"
]);

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id),
  departmentId: integer("department_id"),
  title: text("title").notNull(),
  description: text("description"),
  documentType: documentTypeEnum("document_type").notNull().default("other"),
  status: documentStatusEnum("status").notNull().default("draft"),
  accessLevel: documentAccessEnum("access_level").notNull().default("organization"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileUrl: text("file_url"),
  fileSize: bigint("file_size", { mode: "number" }),
  mimeType: text("mime_type"),
  version: integer("version").notNull().default(1),
  parentDocumentId: integer("parent_document_id"),
  tags: text("tags").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  approvedById: integer("approved_by_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const documentViewsTable = pgTable("document_views", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documentsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id),
  tenantId: integer("tenant_id").notNull(),
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
