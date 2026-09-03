CREATE TABLE "volunteer_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid NOT NULL,
	"edition_id" integer NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"club_name" text NOT NULL,
	"city" text,
	"preferred_roles" text[] NOT NULL,
	"availability" text NOT NULL,
	"motivation" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "volunteer_registrations_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD CONSTRAINT "volunteer_registrations_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "volunteer_registration_edition_idx" ON "volunteer_registrations" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "volunteer_registration_email_idx" ON "volunteer_registrations" USING btree ("email");