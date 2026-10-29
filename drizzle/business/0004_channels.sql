CREATE TABLE "app_channels" (
	"app_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signing_secret_encrypted" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_channels_app_id_channel_pk" PRIMARY KEY("app_id","channel")
);
--> statement-breakpoint
ALTER TABLE "app_channels" ADD CONSTRAINT "app_channels_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;