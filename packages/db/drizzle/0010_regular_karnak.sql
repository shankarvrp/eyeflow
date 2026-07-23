CREATE TYPE "public"."optical_order_status" AS ENUM('walk_in', 'advanced', 'ordered', 'lens_arrived', 'fitted', 'delivered');--> statement-breakpoint
CREATE TABLE "optical_order_states" (
	"order_key" text PRIMARY KEY NOT NULL,
	"status" "optical_order_status" DEFAULT 'advanced' NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "optical_order_states" ADD CONSTRAINT "optical_order_states_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "optical_order_states_status_idx" ON "optical_order_states" USING btree ("status");