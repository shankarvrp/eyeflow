ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user';
UPDATE "user" SET "role" = 'user' WHERE "role" IN ('cashier', 'viewer');
