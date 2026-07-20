CREATE TABLE "revenue_targets" (
	"id" text PRIMARY KEY DEFAULT 'clinic' NOT NULL,
	"daily_amount" numeric(12, 2) DEFAULT '200000' NOT NULL,
	"weekly_amount" numeric(12, 2) DEFAULT '1200000' NOT NULL,
	"monthly_amount" numeric(12, 2) DEFAULT '5000000' NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "revenue_targets" ADD CONSTRAINT "revenue_targets_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;