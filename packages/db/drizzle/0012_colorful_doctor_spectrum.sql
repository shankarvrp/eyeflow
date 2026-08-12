ALTER TYPE "public"."optical_order_status" ADD VALUE 'ready' BEFORE 'delivered';--> statement-breakpoint
ALTER TABLE "optical_order_states" ADD COLUMN "customer_phone" text;--> statement-breakpoint
ALTER TABLE "optical_order_states" ADD COLUMN "expected_delivery_date" date;