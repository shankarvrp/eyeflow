import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const paymentKind = pgEnum("payment_kind", ["cash", "credit", "online"]);

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("customers_name_idx").on(table.name)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id),
    kind: paymentKind("kind").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    providerOrMode: text("provider_or_mode"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payments_occurred_at_idx").on(table.occurredAt),
    index("payments_customer_department_idx").on(table.customerId, table.departmentId),
  ],
);

export const customerRelations = relations(customers, ({ many }) => ({ payments: many(payments) }));
export const departmentRelations = relations(departments, ({ many }) => ({
  payments: many(payments),
}));
export const paymentRelations = relations(payments, ({ one }) => ({
  customer: one(customers, { fields: [payments.customerId], references: [customers.id] }),
  department: one(departments, { fields: [payments.departmentId], references: [departments.id] }),
}));

export const currentTimestamp = sql`now()`;
