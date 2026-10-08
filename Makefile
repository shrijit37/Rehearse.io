# Canonical Makefile. scripts/ holds the real logic.
.PHONY: setup dev test lint build migrate health

setup:
	./scripts/setup

dev:
	./scripts/dev

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
