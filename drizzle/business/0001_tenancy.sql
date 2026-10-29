CREATE TYPE "public"."app_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "api_key_apps" (
	"api_key_id" text PRIMARY KEY NOT NULL,
	"app_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_memberships" (
	"app_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "app_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_memberships_app_id_user_id_pk" PRIMARY KEY("app_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "app_origins" (
	"app_id" uuid NOT NULL,
	"origin" text NOT NULL,
	CONSTRAINT "app_origins_app_id_origin_pk" PRIMARY KEY("app_id","origin")
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apps_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "instance_admins" (
	"slot" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instance_admins_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "instance_admins_singleton_check" CHECK ("instance_admins"."slot" = 1)
);
--> statement-breakpoint
ALTER TABLE "api_key_apps" ADD CONSTRAINT "api_key_apps_api_key_id_apikey_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."apikey"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_apps" ADD CONSTRAINT "api_key_apps_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_memberships" ADD CONSTRAINT "app_memberships_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_memberships" ADD CONSTRAINT "app_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_origins" ADD CONSTRAINT "app_origins_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instance_admins" ADD CONSTRAINT "instance_admins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_key_apps_app_id_idx" ON "api_key_apps" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "app_memberships_user_id_idx" ON "app_memberships" USING btree ("user_id");