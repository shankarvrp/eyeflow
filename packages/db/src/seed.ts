import { count, eq } from "drizzle-orm";
import { createDatabase } from "./index";
import { customers, departments, payments } from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://eyeflow:eyeflow_dev_password@localhost:5432/eyeflow";

const db = createDatabase(databaseUrl);

const departmentSeed = [
  { name: "OPD", slug: "opd", displayOrder: 1 },
  { name: "Investigation", slug: "investigation", displayOrder: 2 },
  { name: "Pharmacy", slug: "pharmacy", displayOrder: 3 },
  { name: "OT", slug: "ot", displayOrder: 4 },
  { name: "Opticals", slug: "opticals", displayOrder: 5 },
];

await db.insert(departments).values(departmentSeed).onConflictDoNothing();

const paymentCountRow = (await db.select({ paymentCount: count() }).from(payments))[0];
const paymentCount = paymentCountRow?.paymentCount ?? 0;

if (paymentCount === 0) {
  const departmentRows = await db.select().from(departments);
  const departmentId = (name: string) => {
    const department = departmentRows.find((row) => row.name === name);
    if (!department) throw new Error(`Missing seeded department: ${name}`);
    return department.id;
  };

  const demoCustomers = [
    {
      name: "Anita Rao",
      department: "OPD",
      kind: "online" as const,
      amount: "1250",
      providerOrMode: "UPI",
    },
    {
      name: "Mohan Kumar",
      department: "Opticals",
      kind: "cash" as const,
      amount: "4800",
      providerOrMode: null,
    },
    {
      name: "Sana Iqbal",
      department: "Investigation",
      kind: "credit" as const,
      amount: "3200",
      providerOrMode: "CGHS",
    },
    {
      name: "Peter James",
      department: "Pharmacy",
      kind: "online" as const,
      amount: "1840",
      providerOrMode: "Card",
    },
  ];

  for (const demo of demoCustomers) {
    const [customer] = await db
      .insert(customers)
      .values({ name: demo.name })
      .returning({ id: customers.id });
    if (!customer) throw new Error(`Failed to seed customer: ${demo.name}`);

    await db.insert(payments).values({
      amount: demo.amount,
      customerId: customer.id,
      departmentId: departmentId(demo.department),
      discount: "0",
      kind: demo.kind,
      providerOrMode: demo.providerOrMode,
    });
  }
}

const seededDepartments = await db
  .select({ name: departments.name })
  .from(departments)
  .where(eq(departments.isActive, true));

console.log(
  `EyeFlow seed complete: ${seededDepartments.length} departments, ${paymentCount === 0 ? 4 : paymentCount} payments.`,
);

await db.$client.end();
