import { pgTable, text, serial, integer, timestamp, date, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const projectStatusEnum = pgEnum("project_status", ["planning", "active", "on_hold", "completed", "cancelled"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "critical"]);
export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "review", "done"]);
export const memberRoleEnum = pgEnum("project_member_role", ["lead", "member"]);
export const approvalStatusEnum = pgEnum("approval_status", ["not_required", "pending", "approved", "rejected"]);

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  departmentId: integer("department_id"),
  name: text("name").notNull(),
  description: text("description"),
  status: projectStatusEnum("status").notNull().default("planning"),
  priority: priorityEnum("priority").notNull().default("medium"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  budget: numeric("budget", { precision: 12, scale: 2 }),
  progress: integer("progress").notNull().default(0),
  managerId: integer("manager_id"),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("not_required"),
  approvalRequestedAt: timestamp("approval_requested_at"),
  approvedAt: timestamp("approved_at"),
  approvedById: integer("approved_by_id"),
  approvalNote: text("approval_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projectTasksTable = pgTable("project_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("todo"),
  priority: priorityEnum("priority").notNull().default("medium"),
  assigneeId: integer("assignee_id"),
  dueDate: date("due_date"),
  progress: integer("progress").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projectMembersTable = pgTable("project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: memberRoleEnum("role").notNull().default("member"),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const projectAttachmentsTable = pgTable("project_attachments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  taskId: integer("task_id"),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileData: text("file_data"),
  uploadedById: integer("uploaded_by_id").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

export const insertProjectTaskSchema = createInsertSchema(projectTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;
export type ProjectTask = typeof projectTasksTable.$inferSelect;

export type ProjectMember = typeof projectMembersTable.$inferSelect;
export type ProjectAttachment = typeof projectAttachmentsTable.$inferSelect;
