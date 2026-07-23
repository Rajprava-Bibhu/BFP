import { pgTable, text, serial, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const socialPlatformEnum = pgEnum("social_platform", [
  "facebook", "instagram", "twitter", "linkedin",
  "youtube", "tiktok", "pinterest", "whatsapp", "telegram"
]);
export const postStatusEnum = pgEnum("post_status", [
  "draft", "scheduled", "published", "failed", "archived"
]);
export const contentTypeEnum = pgEnum("content_type", [
  "text", "image", "video", "carousel", "story", "reel", "link"
]);

export const digitalMarketingPostsTable = pgTable("digital_marketing_posts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id"),
  createdById: integer("created_by_id").references(() => usersTable.id),
  title: text("title").notNull(),
  content: text("content"),
  caption: text("caption"),
  hashtags: text("hashtags").array().notNull().default([]),
  platform: socialPlatformEnum("platform").notNull(),
  contentType: contentTypeEnum("content_type").notNull().default("text"),
  status: postStatusEnum("status").notNull().default("draft"),
  mediaUrls: text("media_urls").array().notNull().default([]),
  linkUrl: text("link_url"),
  callToAction: text("call_to_action"),
  targetAudience: text("target_audience"),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  externalPostId: text("external_post_id"),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  isBoosted: boolean("is_boosted").notNull().default(false),
  boostBudget: text("boost_budget"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDigitalMarketingPostSchema = createInsertSchema(digitalMarketingPostsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDigitalMarketingPost = z.infer<typeof insertDigitalMarketingPostSchema>;
export type DigitalMarketingPost = typeof digitalMarketingPostsTable.$inferSelect;

export const campaignTypeEnum = pgEnum("campaign_type", ["email", "sms", "whatsapp"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "scheduled", "running", "completed", "failed", "cancelled"]);

export const bulkCampaignsTable = pgTable("bulk_campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: campaignTypeEnum("type").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  recipients: text("recipients").notNull().default("[]"),
  recipientCount: integer("recipient_count").notNull().default(0),
  status: campaignStatusEnum("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  n8nExecutionId: text("n8n_execution_id"),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const n8nConfigTable = pgTable("n8n_configs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().unique().references(() => tenantsTable.id, { onDelete: "cascade" }),
  instanceUrl: text("instance_url"),
  socialWebhookUrl: text("social_webhook_url"),
  emailWebhookUrl: text("email_webhook_url"),
  smsWebhookUrl: text("sms_webhook_url"),
  whatsappWebhookUrl: text("whatsapp_webhook_url"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BulkCampaign = typeof bulkCampaignsTable.$inferSelect;
export type N8nConfig = typeof n8nConfigTable.$inferSelect;
