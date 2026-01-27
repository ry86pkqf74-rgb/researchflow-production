# ResearchFlow Production Makefile
# ================================

.PHONY: help dev dev-build dev-logs dev-down build test test-unit test-integration test-e2e \
        lint format db-migrate db-seed db-backup db-backup-prod db-restore db-backup-retention \
        db-backup-list deploy-staging deploy-production clean

# Colors
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m

# Default target
help:
	@echo "$(BLUE)ResearchFlow Production Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-build    - Rebuild and start development environment"
	@echo "  make dev-logs     - Follow development logs"
	@echo "  make dev-down     - Stop development environment"
	@echo ""
	@echo "$(GREEN)Build:$(NC)"
	@echo "  make build        - Build all Docker images for production"
	@echo "  make build-orch   - Build orchestrator image only"
	@echo "  make build-worker - Build worker image only"
	@echo "  make build-web    - Build web image only"
	@echo ""
	@echo "$(GREEN)Testing:$(NC)"
	@echo "  make test         - Run all tests"
	@echo "  make test-unit    - Run unit tests"
	@echo "  make test-integration - Run integration tests"
	@echo "  make test-e2e     - Run end-to-end tests"
	@echo ""
	@echo "$(GREEN)Code Quality:$(NC)"
	@echo "  make lint         - Run linters"
	@echo "  make format       - Format code"
	@echo ""
	@echo "$(GREEN)Database:$(NC)"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-init      - Run init.sql (bootstrap only)"
	@echo "  make db-seed      - Seed database with test data"
	@echo "  make db-reset     - Reset database (WARNING: destroys data)"
	@echo "  make db-backup    - Create database backup"
	@echo "  make db-backup-prod - Create production database backup"
	@echo "  make db-restore BACKUP_FILE=path - Restore from backup"
	@echo "  make db-backup-retention - Clean up backups older than 30 days"
	@echo "  make db-backup-list - List available backups"
	@echo ""
	@echo "$(GREEN)Deployment:$(NC)"
	@echo "  make deploy-staging    - Deploy to staging"
	@echo "  make deploy-production - Deploy to production"
	@echo ""
	@echo "$(GREEN)Utilities:$(NC)"
	@echo "  make clean        - Clean up build artifacts"
	@echo "  make setup        - Initial project setup"

# ===================
# Development
# ===================

dev:
	@echo "$(BLUE)Starting development environment...$(NC)"
	docker-compose up

dev-build:
	@echo "$(BLUE)Rebuilding and starting development environment...$(NC)"
	docker-compose up --build

dev-logs:
	docker-compose logs -f

dev-down:
	@echo "$(YELLOW)Stopping development environment...$(NC)"
	docker-compose down

dev-shell-orch:
	docker-compose exec orchestrator /bin/sh

dev-shell-worker:
	docker-compose exec worker /bin/bash

# ===================
# Build
# ===================

build:
	@echo "$(BLUE)Building production images...$(NC)"
	docker-compose -f docker-compose.prod.yml build

build-orch:
	@echo "$(BLUE)Building orchestrator image...$(NC)"
	docker build -t researchflow/orchestrator:latest --target production ./services/orchestrator

build-worker:
	@echo "$(BLUE)Building worker image...$(NC)"
	docker build -t researchflow/worker:latest --target production ./services/worker

build-web:
	@echo "$(BLUE)Building web image...$(NC)"
	docker build -t researchflow/web:latest --target production ./services/web

# ===================
# Testing
# ===================

test: test-unit test-integration
	@echo "$(GREEN)All tests passed!$(NC)"

test-unit:
	@echo "$(BLUE)Running unit tests...$(NC)"
	npm run test:unit
	docker-compose run --rm worker pytest tests/unit -v

test-integration:
	@echo "$(BLUE)Running integration tests...$(NC)"
	docker-compose run --rm worker pytest tests/integration -v

test-e2e:
	@echo "$(BLUE)Running end-to-end tests...$(NC)"
	npm run test:e2e

test-coverage:
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	npm run test:coverage
	docker-compose run --rm worker pytest --cov=src --cov-report=html

# ===================
# Code Quality
# ===================

lint:
	@echo "$(BLUE)Running linters...$(NC)"
	npm run lint
	docker-compose run --rm worker ruff check src/
	docker-compose run --rm worker mypy src/

format:
	@echo "$(BLUE)Formatting code...$(NC)"
	npm run format
	docker-compose run --rm worker ruff format src/
	docker-compose run --rm worker isort src/

# ===================
# Database
# ===================

db-migrate:
	@echo "$(BLUE)Running database migrations...$(NC)"
	bash scripts/db-migrate.sh

db-init:
	@echo "$(BLUE)Running init.sql (bootstrap only)...$(NC)"
	docker-compose exec postgres psql -U ros -d ros -f /docker-entrypoint-initdb.d/init.sql

db-migrate-governance:
	@echo "$(BLUE)Applying governance_config hotfix...$(NC)"
	cat migrations/0012_governance_config_hotfix.sql | docker-compose exec -T postgres psql -U ros -d ros

db-seed:
	@echo "$(BLUE)Seeding database...$(NC)"
	docker-compose exec orchestrator npm run db:seed

db-reset:
	@echo "$(RED)WARNING: This will destroy all data!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker-compose down -v
	docker-compose up -d postgres
	sleep 5
	make db-migrate

db-backup:
	@echo "$(BLUE)Creating database backup...$(NC)"
	@mkdir -p backups
	@TIMESTAMP=$$(date +%Y%m%d_%H%M%S); \
	docker-compose exec -T postgres pg_dump -U $${POSTGRES_USER:-ros} $${POSTGRES_DB:-ros} | gzip > backups/backup_$$TIMESTAMP.sql.gz
	@echo "$(GREEN)Backup created in backups/$(NC)"

db-backup-prod:
	@echo "$(BLUE)Creating production database backup...$(NC)"
	@mkdir -p backups
	@TIMESTAMP=$$(date +%Y%m%d_%H%M%S); \
	docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U $${POSTGRES_USER:-ros} $${POSTGRES_DB:-ros} | gzip > backups/backup_prod_$$TIMESTAMP.sql.gz
	@echo "$(GREEN)Production backup created in backups/$(NC)"

db-restore:
	@echo "$(YELLOW)Restoring database from backup...$(NC)"
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "$(RED)ERROR: BACKUP_FILE not specified$(NC)"; \
		echo "Usage: make db-restore BACKUP_FILE=backups/backup_YYYYMMDD_HHMMSS.sql.gz"; \
		exit 1; \
	fi
	@if [ ! -f "$(BACKUP_FILE)" ]; then \
		echo "$(RED)ERROR: Backup file not found: $(BACKUP_FILE)$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)WARNING: This will overwrite the current database!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	gunzip -c $(BACKUP_FILE) | docker-compose exec -T postgres psql -U $${POSTGRES_USER:-ros} $${POSTGRES_DB:-ros}
	@echo "$(GREEN)Database restored from $(BACKUP_FILE)$(NC)"

db-backup-retention:
	@echo "$(BLUE)Cleaning up old backups (keeping last 30 days)...$(NC)"
	@mkdir -p backups
	@find backups -name "backup_*.sql.gz" -type f -mtime +30 -print -delete 2>/dev/null || true
	@echo "$(GREEN)Backup retention cleanup complete$(NC)"

db-backup-list:
	@echo "$(BLUE)Available backups:$(NC)"
	@ls -lh backups/*.sql.gz 2>/dev/null || echo "No backups found in backups/"

# ===================
# Deployment
# ===================

deploy-staging:
	@echo "$(BLUE)Deploying to staging...$(NC)"
	./scripts/deploy.sh staging

deploy-production:
	@echo "$(YELLOW)WARNING: Deploying to production!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	./scripts/deploy.sh production

# Kubernetes deployments
k8s-dev:
	kubectl apply -k infrastructure/kubernetes/overlays/dev

k8s-staging:
	kubectl apply -k infrastructure/kubernetes/overlays/staging

k8s-production:
	kubectl apply -k infrastructure/kubernetes/overlays/production

# ===================
# Utilities
# ===================

setup:
	@echo "$(BLUE)Setting up project...$(NC)"
	./scripts/setup.sh
	npm install
	cp .env.example .env
	@echo "$(GREEN)Setup complete! Edit .env with your configuration.$(NC)"

clean:
	@echo "$(YELLOW)Cleaning up...$(NC)"
	docker-compose down -v --remove-orphans
	rm -rf node_modules
	rm -rf services/orchestrator/node_modules
	rm -rf services/orchestrator/dist
	rm -rf services/web/node_modules
	rm -rf services/web/dist
	rm -rf .pytest_cache
	rm -rf __pycache__
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "$(GREEN)Cleanup complete!$(NC)"

# Version info
version:
	@echo "$(BLUE)ResearchFlow Production$(NC)"
	@echo "Orchestrator: $(shell cd services/orchestrator && node -p "require('./package.json').version" 2>/dev/null || echo 'N/A')"
	@echo "Worker: $(shell cd services/worker && python -c "import tomllib; print(tomllib.load(open('pyproject.toml', 'rb'))['project']['version'])" 2>/dev/null || echo 'N/A')"
	@echo "Web: $(shell cd services/web && node -p "require('./package.json').version" 2>/dev/null || echo 'N/A')"

# ===================
# Statistical Analysis (Phase 5)
# ===================

verify-deps: ## Verify statistical dependencies in worker
	@echo "$(BLUE)Verifying statistical dependencies...$(NC)"
	docker-compose exec worker python -c "\
import scipy; print('scipy:', scipy.__version__); \
import statsmodels; print('statsmodels:', statsmodels.__version__); \
import lifelines; print('lifelines:', lifelines.__version__); \
import sklearn; print('scikit-learn:', sklearn.__version__); \
import pandas; print('pandas:', pandas.__version__); \
import numpy; print('numpy:', numpy.__version__); \
print('$(GREEN)All statistical dependencies OK!$(NC)')"

test-analysis: ## Test statistical analysis endpoints
	@echo "$(BLUE)Testing analysis capabilities...$(NC)"
	curl -sf http://localhost:3001/api/ros/analysis/capabilities | jq . || echo "$(RED)Capabilities endpoint failed$(NC)"
	@echo ""
	@echo "$(BLUE)Testing descriptive analysis...$(NC)"
	curl -sf -X POST http://localhost:3001/api/ros/analysis/run \
		-H "Content-Type: application/json" \
		-d '{"analysis_type": "descriptive", "variables": ["age", "bmi"]}' | jq . || echo "$(RED)Analysis endpoint failed$(NC)"

# ===================
# Version Control (Phase 5.5)
# ===================

verify-git: ## Verify Git is available in worker container
	@echo "$(BLUE)Verifying Git in worker...$(NC)"
	docker-compose exec worker git --version
	docker-compose exec worker python -c "import git; print('GitPython:', git.__version__)"
	@echo "$(GREEN)Git verification OK!$(NC)"

test-version: ## Test version control endpoints
	@echo "$(BLUE)Testing version control status...$(NC)"
	curl -sf http://localhost:3001/api/version/status | jq . || echo "$(RED)Version status endpoint failed$(NC)"
	@echo ""
	@echo "$(BLUE)Testing project list...$(NC)"
	curl -sf http://localhost:3001/api/version/projects | jq . || echo "$(RED)Projects endpoint failed$(NC)"

# ===================
# Live Mode (Phase 4.5)
# ===================

start-live: ## Start services in live mode (requires authentication)
	@echo "$(YELLOW)Starting in LIVE mode - authentication required$(NC)"
	APP_MODE=live GOVERNANCE_MODE=LIVE docker-compose up -d

start-demo: ## Start services in demo mode (no authentication required)
	@echo "$(GREEN)Starting in DEMO mode$(NC)"
	APP_MODE=demo GOVERNANCE_MODE=DEMO docker-compose up -d

# ===================
# Health Checks
# ===================

health: ## Check health of all services
	@echo "$(BLUE)=== Service Health Check ===$(NC)"
	@echo ""
	@echo "Worker (port 8000):"
	@curl -sf http://localhost:8000/health 2>/dev/null | jq -r '.status // "unhealthy"' || echo "  $(RED)Not responding$(NC)"
	@echo ""
	@echo "Orchestrator (port 3001):"
	@curl -sf http://localhost:3001/health 2>/dev/null | jq -r '.status // "unhealthy"' || echo "  $(RED)Not responding$(NC)"
	@echo ""
	@echo "Web (port 3000):"
	@curl -sf http://localhost:3000 2>/dev/null | head -c 50 && echo "" || echo "  $(RED)Not responding$(NC)"
	@echo ""
	@echo "$(BLUE)=== Health Check Complete ===$(NC)"
