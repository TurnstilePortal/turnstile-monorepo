AZTEC_CONTRACT_DIRS = $(shell find aztec/contracts -maxdepth 1 -mindepth 1 -type d)
AZTEC_CONTRACT_ARTIFACTS := $(foreach d,$(AZTEC_CONTRACT_DIRS), \
	$(eval NAME := $(shell grep '^pub contract ' $(d)/src/main.nr | sed 's/.*pub contract \([A-Za-z0-9_]\+\).*/\1/')) \
	aztec/target/$(notdir $(d))-$(NAME).json)

AZTEC_ARTIFACTS_PACKAGE_DIR = packages/aztec-artifacts/src/artifacts

.PHONY: build
build: artifacts packages

.PHONY: packages
packages:
	pnpm run build

.PHONY: init
init:
	@echo "Initializing project..."
	@echo "Setting git hooks path to hooks"
	git config core.hooksPath hooks

	@echo "Installing node dependencies..."
	pnpm install

.PHONY: test
test: test-l1 test-aztec

.PHONY: test-l1
test-l1:
	make -C l1 test

.PHONY: test-aztec
test-aztec:
	make -C aztec test

.PHONY: lint
lint:
	make -C l1 lint
	make -C aztec lint

.PHONY: artifacts
artifacts: l1-artifacts aztec-artifacts

.PHONY: l1-artifacts
l1-artifacts:
	@echo "Building L1 artifacts..."
	@bash scripts/build-l1-artifacts.sh

.PHONY: aztec-artifacts
aztec-artifacts: compile-aztec-contracts $(AZTEC_ARTIFACTS_PACKAGE_DIR)/index.ts

.PHONY: compile-aztec-contracts
compile-aztec-contracts:
	@echo "Compiling Aztec contracts..."
	@make -C aztec build

$(AZTEC_ARTIFACTS_PACKAGE_DIR)/index.ts: $(patsubst aztec/target/%,$(AZTEC_ARTIFACTS_PACKAGE_DIR)/%,$(AZTEC_CONTRACT_ARTIFACTS))
	@echo "Regenerating $(AZTEC_ARTIFACTS_PACKAGE_DIR)/artifacts/index.ts..."
	find $(AZTEC_ARTIFACTS_PACKAGE_DIR) -type f -name '*.ts' -not -name 'index.ts' -exec basename {} .ts \; | \
		xargs -I % echo "export * from './%.js';" > $(AZTEC_ARTIFACTS_PACKAGE_DIR)/index.ts

$(AZTEC_ARTIFACTS_PACKAGE_DIR)/%.json: aztec/target/%.json
	cp "$^" $(AZTEC_ARTIFACTS_PACKAGE_DIR)
	aztec codegen --force $@ -o $(dir $@)

.PHONY: sandbox
sandbox:
	@echo "Starting sandbox..."
	bash scripts/deploy-sandbox.sh
