CREATE TABLE "edition_surgeons" (
	"edition_id" integer NOT NULL,
	"surgeon_id" integer NOT NULL,
	CONSTRAINT "edition_surgeons_edition_id_surgeon_id_pk" PRIMARY KEY("edition_id","surgeon_id")
);
--> statement-breakpoint
CREATE TABLE "editions" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid NOT NULL,
	"name" text NOT NULL,
	"place" text NOT NULL,
	"year" integer NOT NULL,
	"start_date" text,
	"end_date" text,
	"description" text,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "medical_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid NOT NULL,
	"edition_id" integer,
	"dossier_number" text,
	"last_name" text,
	"first_name" text,
	"dob" text,
	"age" text,
	"gender" text,
	"phone1" text,
	"phone2" text,
	"address" text,
	"distance" text DEFAULT 'non précisé',
	"photo_url" text,
	"weight" real,
	"height" real,
	"bmi" real,
	"blood_pressure" text,
	"temperature" real,
	"heart_rate" integer,
	"respiratory_rate" integer,
	"spo2" integer,
	"clinical_diagnosis" text,
	"intervention_type" text,
	"observation" text,
	"program_mission" integer DEFAULT 0,
	"planning_day" text,
	"block_entry_time" text,
	"block_exit_time" text,
	"intervention_details" text,
	"diagnosis_category" text,
	"history_diabetes" integer DEFAULT 0,
	"history_hypertension" integer DEFAULT 0,
	"history_asthma" integer DEFAULT 0,
	"history_cardiopathy" integer DEFAULT 0,
	"history_none" integer DEFAULT 0,
	"history_others" text,
	"asa_score" integer,
	"anesthesia_type" text,
	"anesthesia_observation" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted" boolean DEFAULT false,
	CONSTRAINT "medical_records_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "record_surgeons" (
	"medical_record_id" integer NOT NULL,
	"surgeon_id" integer NOT NULL,
	"role" text,
	CONSTRAINT "record_surgeons_medical_record_id_surgeon_id_pk" PRIMARY KEY("medical_record_id","surgeon_id")
);
--> statement-breakpoint
CREATE TABLE "surgeons" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid NOT NULL,
	"name" text NOT NULL,
	"specialty" text,
	"email" text,
	"phone" text,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted" boolean DEFAULT false,
	CONSTRAINT "surgeons_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "edition_surgeons" ADD CONSTRAINT "edition_surgeons_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_surgeons" ADD CONSTRAINT "edition_surgeons_surgeon_id_surgeons_id_fk" FOREIGN KEY ("surgeon_id") REFERENCES "public"."surgeons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_surgeons" ADD CONSTRAINT "record_surgeons_medical_record_id_medical_records_id_fk" FOREIGN KEY ("medical_record_id") REFERENCES "public"."medical_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_surgeons" ADD CONSTRAINT "record_surgeons_surgeon_id_surgeons_id_fk" FOREIGN KEY ("surgeon_id") REFERENCES "public"."surgeons"("id") ON DELETE no action ON UPDATE no action;