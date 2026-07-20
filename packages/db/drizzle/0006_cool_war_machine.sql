CREATE TABLE "daily_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_date" date NOT NULL,
	"status" text DEFAULT 'closed' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"reason" text NOT NULL,
	"closed_by_user_id" text NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reopened_by_user_id" text,
	"reopened_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_closures" ADD CONSTRAINT "daily_closures_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_closures" ADD CONSTRAINT "daily_closures_reopened_by_user_id_user_id_fk" FOREIGN KEY ("reopened_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_closures_business_date_uidx" ON "daily_closures" USING btree ("business_date");