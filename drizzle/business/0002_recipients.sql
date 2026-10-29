CREATE TABLE "notification_preferences" (
	"app_id" uuid NOT NULL,
	"recipient_key" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_app_id_recipient_key_channel_pk" PRIMARY KEY("app_id","recipient_key","channel")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"recipient_key" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipient_contacts" (
	"app_id" uuid NOT NULL,
	"recipient_key" text NOT NULL,
	"channel" text NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipient_contacts_app_id_recipient_key_channel_pk" PRIMARY KEY("app_id","recipient_key","channel")
);
--> statement-breakpoint
CREATE TABLE "recipient_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"app_id" uuid NOT NULL,
	"recipient_key" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipients" (
	"app_id" uuid NOT NULL,
	"recipient_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipients_app_id_recipient_key_pk" PRIMARY KEY("app_id","recipient_key")
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_recipient_fk" FOREIGN KEY ("app_id","recipient_key") REFERENCES "public"."recipients"("app_id","recipient_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_recipient_fk" FOREIGN KEY ("app_id","recipient_key") REFERENCES "public"."recipients"("app_id","recipient_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_contacts" ADD CONSTRAINT "recipient_contacts_recipient_fk" FOREIGN KEY ("app_id","recipient_key") REFERENCES "public"."recipients"("app_id","recipient_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_tokens" ADD CONSTRAINT "recipient_tokens_recipient_fk" FOREIGN KEY ("app_id","recipient_key") REFERENCES "public"."recipients"("app_id","recipient_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_app_endpoint_uq" ON "push_subscriptions" USING btree ("app_id","endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_recipient_idx" ON "push_subscriptions" USING btree ("app_id","recipient_key");--> statement-breakpoint
CREATE INDEX "push_subscriptions_failed_idx" ON "push_subscriptions" USING btree ("failed_at") WHERE "push_subscriptions"."failed_at" is not null;--> statement-breakpoint
CREATE INDEX "recipient_tokens_expires_idx" ON "recipient_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "recipient_tokens_recipient_idx" ON "recipient_tokens" USING btree ("app_id","recipient_key");