CREATE TABLE "sync_devices" (
	"device_id" uuid PRIMARY KEY NOT NULL,
	"last_cursor" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"app_version" text
);
--> statement-breakpoint
CREATE TABLE "sync_entity_versions" (
	"entity" text NOT NULL,
	"public_id" uuid NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sync_entity_versions_entity_public_id_pk" PRIMARY KEY("entity","public_id")
);
--> statement-breakpoint
ALTER TABLE "surgeons" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;