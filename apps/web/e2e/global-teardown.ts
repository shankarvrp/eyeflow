import postgres from "postgres";

export default async function globalTeardown() {
  const sql = postgres(
    process.env.DATABASE_URL ?? "postgresql://eyeflow:eyeflow_dev_password@127.0.0.1:5432/eyeflow",
    { max: 1, prepare: false },
  );
  try {
    await sql.begin(async (transaction) => {
      const testCustomers = await transaction<{ id: string }[]>`
        select id from customers
        where name like 'E2E Test %'
           or name like 'Persistence Patient %'
           or name like 'User Collection %'
      `;
      const customerIds = testCustomers.map((customer) => customer.id);
      if (customerIds.length === 0) return;
      await transaction`delete from audit_events where entity_id in ${transaction(customerIds)}`;
      await transaction`delete from payments where customer_id in ${transaction(customerIds)}`;
      await transaction`delete from customers where id in ${transaction(customerIds)}`;
    });
  } finally {
    await sql.end();
  }
}
