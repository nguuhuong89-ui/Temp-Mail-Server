import { pgTable, serial, text, boolean, timestamp, integer, index } from "drizzle-orm/pg-core";

export const emailsTable = pgTable(
  "emails",
  {
    id: serial("id").primaryKey(),
    toAddress: text("to_address").notNull(),
    fromAddress: text("from_address").notNull(),
    subject: text("subject").notNull().default(""),
    textBody: text("text_body").notNull().default(""),
    htmlBody: text("html_body").notNull().default(""),
    preview: text("preview").notNull().default(""),
    hasAttachments: boolean("has_attachments").notNull().default(false),
    domainId: integer("domain_id"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("emails_to_received_idx").on(t.toAddress, t.receivedAt),
    index("emails_received_idx").on(t.receivedAt),
    index("emails_domain_idx").on(t.domainId),
  ],
);

export type Email = typeof emailsTable.$inferSelect;
