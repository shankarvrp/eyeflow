CREATE TABLE "department_targets" (
	"department_id" uuid PRIMARY KEY NOT NULL,
	"daily_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"weekly_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"monthly_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "collection_signoffs_date_period_uidx";--> statement-breakpoint
ALTER TABLE "collection_signoffs" ADD COLUMN "signer_role" text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "emr_appointments" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "department_targets" ADD CONSTRAINT "department_targets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_targets" ADD CONSTRAINT "department_targets_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "department_targets_department_idx" ON "department_targets" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_signoffs_date_period_role_uidx" ON "collection_signoffs" USING btree ("business_date","period","signer_role");