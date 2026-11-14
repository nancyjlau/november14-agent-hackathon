import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const sharedMessages = sqliteTable("shared_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  receivedAt: integer("received_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("shared_messages_user_time").on(table.userId, table.receivedAt)]);

export const botPrompts = sqliteTable("bot_prompts", {
  userId: text("user_id").primaryKey(),
  promptedAt: integer("prompted_at").notNull(),
});

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
});
