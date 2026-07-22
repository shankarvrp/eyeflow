CREATE TABLE "collection_signoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_date" date NOT NULL,
	"period" text NOT NULL,
	"declared_cash" numeric(12, 2) NOT NULL,
	"declared_online" numeric(12, 2) NOT NULL,
	"declared_credit" numeric(12, 2) NOT NULL,
	"declared_discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"calculated_net" numeric(12, 2) NOT NULL,
	"note" text NOT NULL,
	"signed_by_user_id" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_signoffs" ADD CONSTRAINT "collection_signoffs_signed_by_user_id_user_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_signoffs_date_period_uidx" ON "collection_signoffs" USING btree ("business_date","period");--> statement-breakpoint
CREATE INDEX "collection_signoffs_date_idx" ON "collection_signoffs" USING btree ("business_date");