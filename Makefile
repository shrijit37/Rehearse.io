# Canonical Makefile. scripts/ holds the real logic.
# `make dev` runs the full local stack; `make dev MODE=prod` runs the web dev
# server against the deployed API. `make stop` stops whichever is running.
.PHONY: setup dev stop test lint build migrate health

MODE ?= local

setup:
	./scripts/setup

dev:
	./scripts/dev $(MODE)

stop:
	./scripts/dev --stop

test:
	./scripts/test

lint:
	./scripts/lint

build:
	./scripts/build

migrate:
	./scripts/migrate

health:
	./scripts/health
