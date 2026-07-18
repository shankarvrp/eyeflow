import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const paymentKind = pgEnum("payment_kind", ["cash", "credit", "online"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emrPatients = pgTable(
  "emr_patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull().default("foss"),
    externalPatientId: text("external_patient_id").notNull(),
    displayName: text("display_name").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("emr_patients_source_external_id_uidx").on(table.source, table.externalPatientId),
  ],
);

export const emrAppointments = pgTable(
  "emr_appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull().default("foss"),
    externalAppointmentId: text("external_appointment_id").notNull(),
    emrPatientId: uuid("emr_patient_id")
      .notNull()
      .references(() => emrPatients.id, { onDelete: "cascade" }),
    appointmentDate: date("appointment_date").notNull(),
    visitType: text("visit_type"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("emr_appointments_source_external_id_uidx").on(
      table.source,
      table.externalAppointmentId,
    ),
    index("emr_appointments_date_idx").on(table.appointmentDate),
    index("emr_appointments_patient_idx").on(table.emrPatientId),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    emrPatientId: uuid("emr_patient_id").references(() => emrPatients.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("customers_emr_patient_id_uidx").on(table.emrPatientId),
    index("customers_name_idx").on(table.name),
  ],
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
    createdByUserId: text("created_by_user_id").references(() => user.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payments_occurred_at_idx").on(table.occurredAt),
    index("payments_customer_department_idx").on(table.customerId, table.departmentId),
  ],
);

export const userDepartmentAccess = pgTable(
  "user_department_access",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    canView: boolean("can_view").notNull().default(true),
    canCreate: boolean("can_create").notNull().default(false),
    canEditCurrent: boolean("can_edit_current").notNull().default(false),
    canEditHistory: boolean("can_edit_history").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.departmentId] })],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    reason: text("reason").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>().notNull(),
    after: jsonb("after").$type<Record<string, unknown>>().notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
    index("audit_events_actor_idx").on(table.actorUserId),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  departmentAccess: many(userDepartmentAccess),
  sessions: many(session),
}));
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));
export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
export const customerRelations = relations(customers, ({ many }) => ({ payments: many(payments) }));
export const emrPatientRelations = relations(emrPatients, ({ many, one }) => ({
  appointments: many(emrAppointments),
  customer: one(customers, { fields: [emrPatients.id], references: [customers.emrPatientId] }),
}));
export const emrAppointmentRelations = relations(emrAppointments, ({ one }) => ({
  patient: one(emrPatients, {
    fields: [emrAppointments.emrPatientId],
    references: [emrPatients.id],
  }),
}));
export const departmentRelations = relations(departments, ({ many }) => ({
  access: many(userDepartmentAccess),
  payments: many(payments),
}));
export const paymentRelations = relations(payments, ({ one }) => ({
  createdBy: one(user, { fields: [payments.createdByUserId], references: [user.id] }),
  customer: one(customers, { fields: [payments.customerId], references: [customers.id] }),
  department: one(departments, { fields: [payments.departmentId], references: [departments.id] }),
}));
export const userDepartmentAccessRelations = relations(userDepartmentAccess, ({ one }) => ({
  department: one(departments, {
    fields: [userDepartmentAccess.departmentId],
    references: [departments.id],
  }),
  user: one(user, { fields: [userDepartmentAccess.userId], references: [user.id] }),
}));
export const auditEventRelations = relations(auditEvents, ({ one }) => ({
  actor: one(user, { fields: [auditEvents.actorUserId], references: [user.id] }),
}));

export const currentTimestamp = sql`now()`;
