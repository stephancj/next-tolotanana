CREATE TABLE "medical_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"medical_record_public_id" uuid NOT NULL,
	"mutation_id" uuid,
	"action" text NOT NULL,
	"source" text NOT NULL,
	"device_id" uuid,
	"user_id" text,
	"changed_fields" jsonb NOT NULL,
	"before_data" jsonb,
	"after_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "medical_audit_record_id_idx" ON "medical_audit_log" USING btree ("medical_record_public_id","id");--> statement-breakpoint
CREATE INDEX "medical_audit_mutation_idx" ON "medical_audit_log" USING btree ("mutation_id");--> statement-breakpoint
INSERT INTO "medical_audit_log" (
    "medical_record_public_id", "action", "source", "changed_fields", "after_data"
)
SELECT "public_id", 'baseline', 'migration', '{}'::jsonb, to_jsonb(mr)
FROM "medical_records" mr;--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_medical_audit_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'medical_audit_log is append-only';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER medical_audit_log_immutable
BEFORE UPDATE OR DELETE ON "medical_audit_log"
FOR EACH ROW EXECUTE FUNCTION prevent_medical_audit_mutation();