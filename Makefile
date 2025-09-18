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

.PHONY: test-e2e
test-e2e: build sandbox
	bash scripts/test-e2e.sh

.PHONY: lint
lint:
	make -C l1 lint
	pnpm run lint:fix

.PHONY: fmt
fmt:
	make -C l1 fmt
	make -C aztec fmt
	pnpm run check:fix

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
	bash scripts/deploy.sh sandbox-local

.PHONY: docker-turnstile-deployer-image
docker-turnstile-deployer-image:
	@echo "Building turnstile-deploy Docker image..."
	$(eval VERSION := $(shell grep -m1 '"version":' packages/deploy/package.json | cut -d '"' -f 4))
	@echo "Using version: $(VERSION)"
	docker build -t turnstile-deployer:$(VERSION) -t turnstile-deployer:latest \
		--build-arg SERVICE=@turnstile-portal/deploy \
		-f docker/common/Dockerfile .

.PHONY: docker-api-migrations-image
docker-api-migrations-image:
	@echo "Building @turnstile-portal/api-common Docker image..."
	$(eval VERSION := $(shell grep -m1 '"version":' packages/api-common/package.json | cut -d '"' -f 4))
	@echo "Using version: $(VERSION)"
	docker build -t turnstile-api-migrations:$(VERSION) -t turnstile-api-migrations:latest \
		--build-arg SERVICE=@turnstile-portal/api-common \
		-f docker/common/Dockerfile .

.PHONY: docker-api-collector-image
docker-api-collector-image:
	@echo "Building @turnstile-portal/collector Docker image..."
	$(eval VERSION := $(shell grep -m1 '"version":' packages/collector/package.json | cut -d '"' -f 4))
	@echo "Using version: $(VERSION)"
	docker build -t turnstile-api-collector:$(VERSION) -t turnstile-api-collector:latest \
		--build-arg SERVICE=@turnstile-portal/collector \
		-f docker/common/Dockerfile .

.PHONY: docker-api-service-image
docker-api-service-image:
	@echo "Building @turnstile-portal/api-service Docker image..."
	$(eval VERSION := $(shell grep -m1 '"version":' packages/api-service/package.json | cut -d '"' -f 4))
	@echo "Using version: $(VERSION)"
	docker build -t turnstile-api-service:$(VERSION) -t turnstile-api-service:latest \
		--build-arg SERVICE=@turnstile-portal/api-service \
		-f docker/common/Dockerfile .

.PHONY: docker-api-images
docker-api-images: docker-api-migrations-image docker-api-collector-image docker-api-service-image
	@echo "Built all API Docker images"

.PHONY: docker
docker: docker-api-images docker-turnstile-deployer-image
	@echo "Built all Docker images"
