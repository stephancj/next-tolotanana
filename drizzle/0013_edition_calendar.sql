ALTER TABLE "editions" ADD COLUMN "planning_mode" text DEFAULT 'dates' NOT NULL;--> statement-breakpoint
ALTER TABLE "editions" ADD COLUMN "operation_dates" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
-- Preserve the weekday-based calendars already used by historical editions.
UPDATE editions e SET planning_mode = 'legacy_weekdays' WHERE EXISTS (SELECT 1 FROM medical_records m WHERE m.edition_id=e.id AND lower(trim(m.planning_day)) IN ('lundi','mardi','mercredi','jeudi','vendredi'));

--> statement-breakpoint
UPDATE editions SET planning_mode='dates', operation_dates='["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06", "2026-12-07", "2026-12-08", "2026-12-09"]'::jsonb, updated_at=now() WHERE public_id='eada842c-4b7f-4bad-8297-c5dd54e5c286';

--> statement-breakpoint
UPDATE editions SET planning_mode='dates', operation_dates='["2027-04-19", "2027-04-20", "2027-04-21", "2027-04-22", "2027-04-23"]'::jsonb, updated_at=now() WHERE public_id='60765d92-791b-4d28-aa6b-0810d0abb4d4';
