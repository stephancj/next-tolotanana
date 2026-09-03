ALTER TABLE "volunteer_registrations" ADD COLUMN "available_full_mission" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "available_dates" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "has_previous_experience" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "previous_editions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "engagement_experience" text;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "skills" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "preferred_commissions" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "contribution" text;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "tshirt_size" text;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "dietary_preference" text;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "allergies" text;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "emergency_contact_name" text;--> statement-breakpoint
ALTER TABLE "volunteer_registrations" ADD COLUMN "emergency_contact_phone" text;