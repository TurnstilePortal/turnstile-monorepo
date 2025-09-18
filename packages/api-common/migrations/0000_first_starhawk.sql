CREATE TYPE "public"."l1_allow_list_status" AS ENUM('UNKNOWN', 'PROPOSED', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
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
--> statement-breakpoint
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
CREATE TABLE "contract_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"artifact_hash" char(66) NOT NULL,
	"artifact" jsonb NOT NULL,
	"contract_class_id" char(66) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_artifacts_artifact_hash_unique" UNIQUE("artifact_hash"),
	CONSTRAINT "contract_artifacts_contract_class_id_unique" UNIQUE("contract_class_id")
);
--> statement-breakpoint
CREATE TABLE "contract_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" char(66) NOT NULL,
	"original_contract_class_id" char(66),
	"current_contract_class_id" char(66),
	"initialization_hash" char(66),
	"deployment_params" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_instances_address_unique" UNIQUE("address")
);
--> statement-breakpoint
ALTER TABLE "contract_instances" ADD CONSTRAINT "contract_instances_original_contract_class_id_contract_artifacts_contract_class_id_fk" FOREIGN KEY ("original_contract_class_id") REFERENCES "public"."contract_artifacts"("contract_class_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD CONSTRAINT "contract_instances_current_contract_class_id_contract_artifacts_contract_class_id_fk" FOREIGN KEY ("current_contract_class_id") REFERENCES "public"."contract_artifacts"("contract_class_id") ON DELETE no action ON UPDATE no action;