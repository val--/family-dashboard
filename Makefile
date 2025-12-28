.PHONY: help install dev build start clean docker-build docker-up docker-down docker-logs docker-restart docker-clean test-scripts up down

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Family Dashboard - Available commands:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

install: ## Install all dependencies (root + client)
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm run install:all

dev: ## Start development server (backend + frontend)
	@echo "$(BLUE)Starting development server...$(NC)"
	npm run dev

build: ## Build frontend for production
	@echo "$(BLUE)Building frontend...$(NC)"
	npm run build

start: ## Start production server
	@echo "$(BLUE)Starting production server...$(NC)"
	NODE_ENV=production npm start

# Docker commands
docker-build: ## Build Docker image
	@echo "$(BLUE)Building Docker image...$(NC)"
	docker compose build

docker-up: ## Start Docker container
	@echo "$(BLUE)Starting Docker container...$(NC)"
	docker compose up -d

docker-down: ## Stop Docker container
	@echo "$(BLUE)Stopping Docker container...$(NC)"
	docker compose down

up: docker-up ## Alias for docker-up: Start Docker container

down: docker-down ## Alias for docker-down: Stop Docker container

docker-logs: ## Show Docker container logs
	@echo "$(BLUE)Showing Docker logs...$(NC)"
	docker compose logs -f

docker-restart: ## Restart Docker container
	@echo "$(BLUE)Restarting Docker container...$(NC)"
	docker compose restart

docker-clean: ## Stop and remove Docker containers, volumes, and images
	@echo "$(YELLOW)Cleaning Docker resources...$(NC)"
	docker compose down -v
	@echo "$(GREEN)Docker cleanup complete$(NC)"

docker-rebuild: ## Rebuild and restart Docker container
	@echo "$(BLUE)Rebuilding and restarting Docker container...$(NC)"
	docker compose up -d --build

# Utility scripts
find-email: ## Get service account email from credentials
	@echo "$(BLUE)Finding service account email...$(NC)"
	npm run find-email

fetch-events: ## Test: Fetch calendar events
	@echo "$(BLUE)Fetching calendar events...$(NC)"
	npm run fetch-events

fetch-electricity: ## Test: Fetch electricity data
	@echo "$(BLUE)Fetching electricity data...$(NC)"
	npm run fetch-electricity

fetch-news: ## Test: Fetch news data
	@echo "$(BLUE)Fetching news data...$(NC)"
	npm run fetch-news

find-bus-stop: ## Find bus stop by name
	@echo "$(BLUE)Finding bus stop...$(NC)"
	npm run find-bus-stop

create-hue-key: ## Create Hue app key
	@echo "$(BLUE)Creating Hue app key...$(NC)"
	npm run create-hue-app-key

# Clean commands
clean: ## Remove node_modules and build artifacts
	@echo "$(YELLOW)Cleaning project...$(NC)"
	rm -rf node_modules
	rm -rf client/node_modules
	rm -rf client/dist
	@echo "$(GREEN)Clean complete$(NC)"

clean-install: clean install ## Clean and reinstall all dependencies

# Development helpers
check-env: ## Check if .env file exists
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)Warning: .env file not found$(NC)"; \
		echo "Copy .env.example to .env and configure it"; \
		exit 1; \
	else \
		echo "$(GREEN).env file found$(NC)"; \
	fi

check-credentials: ## Check if credentials file exists
	@if [ ! -f credentials/service-account.json ]; then \
		echo "$(YELLOW)Warning: credentials/service-account.json not found$(NC)"; \
		echo "Please add your Google service account JSON file"; \
		exit 1; \
	else \
		echo "$(GREEN)Credentials file found$(NC)"; \
	fi

setup: check-env check-credentials install ## Setup project (check files and install dependencies)

