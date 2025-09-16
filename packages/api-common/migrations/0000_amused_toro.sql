CREATE TYPE "public"."l1_allow_list_status" AS ENUM('UNKNOWN', 'PROPOSED', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "block_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain" varchar(10) NOT NULL,
	"last_scanned_block" bigint DEFAULT 0 NOT NULL,
	"last_scan_timestamp" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "block_progress_chain_unique" UNIQUE("chain")
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(20),
	"name" varchar(100),
	"decimals" smallint,
	"l1_address" char(42),
	"l2_address" char(66),
	"l1_allow_list_status" "l1_allow_list_status",
	"l1_allow_list_proposal_tx" varchar(66),
	"l1_allow_list_proposer" varchar(42),
	"l1_allow_list_approver" varchar(42),
	"l1_allow_list_resolution_tx" varchar(66),
	"l1_portal_registration_submitter" varchar(42),
	"l1_registration_block" bigint,
	"l2_registration_available_block" bigint,
	"l2_registration_block" bigint,
	"l2_portal_registration_submitter" varchar(66),
	"l2_portal_registration_fee_payer" varchar(66),
	"l1_registration_tx" varchar(66),
	"l2_registration_tx" varchar(66),
	"l2_registration_tx_index" integer,
	"l2_registration_log_index" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tokens_l1_address_unique" UNIQUE("l1_address"),
	CONSTRAINT "tokens_l2_address_unique" UNIQUE("l2_address")
);
