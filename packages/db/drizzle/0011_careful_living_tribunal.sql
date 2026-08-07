CREATE TABLE "emr_ot_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'foss' NOT NULL,
	"external_case_id" text NOT NULL,
	"emr_patient_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"status" text NOT NULL,
	"procedure_name" text,
	"surgeon_name" text,
	"scheduled_at" timestamp with time zone,
	"package_amount" numeric(12, 2),
	"package_updated_by_user_id" text,
	"package_updated_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ot_package_signoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_date" date NOT NULL,
	"signer_role" text NOT NULL,
	"declared_amount" numeric(12, 2) NOT NULL,
	"calculated_amount" numeric(12, 2) NOT NULL,
	"note" text NOT NULL,
	"signed_by_user_id" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "emr_ot_cases" ADD CONSTRAINT "emr_ot_cases_emr_patient_id_emr_patients_id_fk" FOREIGN KEY ("emr_patient_id") REFERENCES "public"."emr_patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emr_ot_cases" ADD CONSTRAINT "emr_ot_cases_package_updated_by_user_id_user_id_fk" FOREIGN KEY ("package_updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ot_package_signoffs" ADD CONSTRAINT "ot_package_signoffs_signed_by_user_id_user_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "emr_ot_cases_source_external_id_uidx" ON "emr_ot_cases" USING btree ("source","external_case_id");--> statement-breakpoint
CREATE INDEX "emr_ot_cases_date_idx" ON "emr_ot_cases" USING btree ("business_date");--> statement-breakpoint
CREATE INDEX "emr_ot_cases_patient_idx" ON "emr_ot_cases" USING btree ("emr_patient_id");--> statement-breakpoint
CREATE INDEX "emr_ot_cases_status_idx" ON "emr_ot_cases" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ot_package_signoffs_date_role_uidx" ON "ot_package_signoffs" USING btree ("business_date","signer_role");--> statement-breakpoint
CREATE INDEX "ot_package_signoffs_date_idx" ON "ot_package_signoffs" USING btree ("business_date");