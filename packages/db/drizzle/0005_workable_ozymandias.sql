CREATE TABLE "emr_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'foss' NOT NULL,
	"external_line_key" text NOT NULL,
	"external_receipt_id" text NOT NULL,
	"emr_patient_id" uuid NOT NULL,
	"receipt_date" date NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"receipt_type" text NOT NULL,
	"payment_mode" text NOT NULL,
	"source_department" text NOT NULL,
	"mapped_department" text,
	"mapped_mode" "payment_kind" NOT NULL,
	"mapped_provider_or_mode" text,
	"requires_review" boolean DEFAULT false NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "emr_receipt_id" uuid;--> statement-breakpoint
ALTER TABLE "emr_receipts" ADD CONSTRAINT "emr_receipts_emr_patient_id_emr_patients_id_fk" FOREIGN KEY ("emr_patient_id") REFERENCES "public"."emr_patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "emr_receipts_source_line_key_uidx" ON "emr_receipts" USING btree ("source","external_line_key");--> statement-breakpoint
CREATE INDEX "emr_receipts_date_idx" ON "emr_receipts" USING btree ("receipt_date");--> statement-breakpoint
CREATE INDEX "emr_receipts_patient_idx" ON "emr_receipts" USING btree ("emr_patient_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_emr_receipt_id_emr_receipts_id_fk" FOREIGN KEY ("emr_receipt_id") REFERENCES "public"."emr_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_emr_receipt_id_uidx" ON "payments" USING btree ("emr_receipt_id");