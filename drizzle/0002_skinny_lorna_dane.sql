CREATE TABLE "sync_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"public_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_mutations" (
	"mutation_id" uuid PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"public_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "pre_op_call" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "pre_op_call_at" timestamp;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "prescription_details" text;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "pharmacy_status" text;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "post_op_room" text;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "post_op_bed" text;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "post_op_entry_time" text;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "discharge_time" text;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "discharge_notes" text;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_public_id_unique" UNIQUE("public_id");