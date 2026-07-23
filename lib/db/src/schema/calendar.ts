import { pgTable, text, serial, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const eventTypeEnum = pgEnum("event_type", ["meeting", "task", "reminder", "deadline", "training", "leave", "holiday", "other"]);
export const eventRecurrenceEnum = pgEnum("event_recurrence", ["none", "daily", "weekly", "monthly", "yearly"]);

export const calendarEventsTable = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  createdById: integer("created_by_id").references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description"),
  eventType: eventTypeEnum("event_type").notNull().default("meeting"),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  allDay: boolean("all_day").notNull().default(false),
  location: text("location"),
  color: text("color").default("#4f46e5"),
  recurrence: eventRecurrenceEnum("recurrence").notNull().default("none"),
  recurrenceEndAt: timestamp("recurrence_end_at"),
  isPrivate: boolean("is_private").notNull().default(false),
  attendees: integer("attendees").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const holidaysTable = pgTable("holidays", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  type: text("type").notNull().default("public"),
  isOptional: boolean("is_optional").notNull().default(false),
  appliesTo: text("applies_to").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEventsTable.$inferSelect;

export const insertHolidaySchema = createInsertSchema(holidaysTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type Holiday = typeof holidaysTable.$inferSelect;
