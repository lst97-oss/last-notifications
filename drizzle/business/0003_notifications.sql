CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'processing', 'delivered', 'dead_letter');--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"address_override" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"recipient_key" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"dedupe_key" text,
	"inapp" boolean DEFAULT true NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_priority_check" CHECK ("notifications"."priority" between -2 and 2),
	CONSTRAINT "notifications_archived_read_check" CHECK ("notifications"."archived_at" is null or "notifications"."read_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_fk" FOREIGN KEY ("app_id","recipient_key") REFERENCES "public"."recipients"("app_id","recipient_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_notification_channel_uq" ON "notification_deliveries" USING btree ("notification_id","channel");--> statement-breakpoint
CREATE INDEX "notification_deliveries_due_idx" ON "notification_deliveries" USING btree ("next_attempt_at") WHERE "notification_deliveries"."status" in ('pending', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_uq" ON "notifications" USING btree ("app_id","recipient_key","dedupe_key") WHERE "notifications"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "notifications_inbox_idx" ON "notifications" USING btree ("app_id","recipient_key","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_archived_idx" ON "notifications" USING btree ("app_id","recipient_key","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "notifications"."archived_at" is not null;--> statement-breakpoint
CREATE INDEX "notifications_archive_purge_idx" ON "notifications" USING btree ("archived_at") WHERE "notifications"."archived_at" is not null;--> statement-breakpoint
CREATE INDEX "notifications_outbound_purge_idx" ON "notifications" USING btree ("created_at") WHERE not "notifications"."inapp";--> statement-breakpoint
CREATE INDEX "notifications_app_created_idx" ON "notifications" USING btree ("app_id","created_at");