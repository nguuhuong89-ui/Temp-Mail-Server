import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const adsTable = pgTable("ads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  placement: text("placement").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  isActive: boolean("is_active").notNull().default(true),
  impressions: integer("impressions").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Ad = typeof adsTable.$inferSelect;
