CREATE TABLE "emr_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'foss' NOT NULL,
	"external_appointment_id" text NOT NULL,
	"emr_patient_id" uuid NOT NULL,
	"appointment_date" date NOT NULL,
	"visit_type" text,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emr_patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'foss' NOT NULL,
	"external_patient_id" text NOT NULL,
	"display_name" text NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "emr_patient_id" uuid;--> statement-breakpoint
ALTER TABLE "emr_appointments" ADD CONSTRAINT "emr_appointments_emr_patient_id_emr_patients_id_fk" FOREIGN KEY ("emr_patient_id") REFERENCES "public"."emr_patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "emr_appointments_source_external_id_uidx" ON "emr_appointments" USING btree ("source","external_appointment_id");--> statement-breakpoint
CREATE INDEX "emr_appointments_date_idx" ON "emr_appointments" USING btree ("appointment_date");--> statement-breakpoint
CREATE INDEX "emr_appointments_patient_idx" ON "emr_appointments" USING btree ("emr_patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "emr_patients_source_external_id_uidx" ON "emr_patients" USING btree ("source","external_patient_id");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_emr_patient_id_emr_patients_id_fk" FOREIGN KEY ("emr_patient_id") REFERENCES "public"."emr_patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_emr_patient_id_uidx" ON "customers" USING btree ("emr_patient_id");