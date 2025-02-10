.PHONY: init
init:
	forge install
	pnpm install

.PHONY: build
build:
	@echo "Building L1 contracts..."
	forge build

.PHONY: test
test:
	@echo "Testing L1 contracts..."
	forge test

.PHONY: lint
lint:
	@echo "Linting L1 contracts..."
	pnpm run lint

.PHONY: clean
clean:
	@echo "Cleaning L1 contracts..."
	forge clean

.PHONY: fmt
fmt:
	@echo "Formatting L1 contracts..."
	forge fmt

.PHONY: doc
doc:
	@echo "Generating L1 documentation..."
	forge doc
