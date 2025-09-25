.SECONDEXPANSION:

CONTRACT_DIRS = $(shell find contracts -maxdepth 1 -mindepth 1 -type d)
ARTIFACTS := $(foreach d,$(CONTRACT_DIRS), \
    $(eval NAME := $(shell grep '^pub contract ' $(d)/src/main.nr | sed 's/.*pub contract \([A-Za-z0-9_]\+\).*/\1/')) \
    target/$(notdir $(d))-$(NAME).json)

# Extract package name from target pattern (e.g. "foo-bar" -> "foo")
PKG = $$(shell echo "$$*" | sed 's/\([^-]*\).*/\1/')

# Get all .nr files excluding tests
NR_FILES = $$(shell find contracts/$(PKG) -type f -name '*.nr' -not -path '*/test/*')

.PHONY: fmt test clean

build: $(ARTIFACTS)

target/%.json: contracts/$(PKG)/Nargo.toml $(NR_FILES)
	@echo "Building $*"
	aztec-nargo compile --silence-warnings --package $(shell echo "$*" | sed 's/\([^-]*\).*/\1/')
	aztec-postprocess-contract

# Format code
fmt:
	aztec-nargo fmt

# Test target depends on build
test: build
	aztec test --show-output

# Clean target to remove artifacts
clean:
	rm -rf target/*.json target/*.json.bak target/cache
