ALTER TABLE "medical_records" ADD COLUMN "pre_op_checked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "pre_op_checked_at" timestamp;