CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"company" text,
	"phone" text,
	"source" text DEFAULT 'contact' NOT NULL,
	"message" text,
	"sandbox_org_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "is_sandbox" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "template_org_id" uuid;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "organizations_sandbox_idx" ON "organizations" USING btree ("is_sandbox","expires_at");