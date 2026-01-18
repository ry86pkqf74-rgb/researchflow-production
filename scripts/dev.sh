#!/bin/bash
# ResearchFlow Production - Development Helper Script
# ====================================================

set -e

BLUE='\033[34m'
GREEN='\033[32m'
YELLOW='\033[33m'
NC='\033[0m'

case "$1" in
    start)
        echo -e "${BLUE}Starting development environment...${NC}"
        docker-compose up -d
        echo ""
        echo -e "${GREEN}Services started!${NC}"
        echo "  Web UI:    http://localhost:5173"
        echo "  API:       http://localhost:3001"
        echo "  Worker:    http://localhost:8000"
        echo "  PostgreSQL: localhost:5432"
        echo "  Redis:     localhost:6379"
        ;;

    stop)
        echo -e "${YELLOW}Stopping development environment...${NC}"
        docker-compose down
        echo -e "${GREEN}Services stopped.${NC}"
        ;;

    restart)
        echo -e "${YELLOW}Restarting development environment...${NC}"
        docker-compose restart
        echo -e "${GREEN}Services restarted.${NC}"
        ;;

    logs)
        SERVICE=${2:-}
        if [ -n "$SERVICE" ]; then
            docker-compose logs -f "$SERVICE"
        else
            docker-compose logs -f
        fi
        ;;

    shell)
        SERVICE=${2:-orchestrator}
        case "$SERVICE" in
            orchestrator|orch)
                docker-compose exec orchestrator /bin/sh
                ;;
            worker)
                docker-compose exec worker /bin/bash
                ;;
            postgres|db)
                docker-compose exec postgres psql -U ros ros
                ;;
            redis)
                docker-compose exec redis redis-cli
                ;;
            *)
                echo "Unknown service: $SERVICE"
                echo "Available: orchestrator, worker, postgres, redis"
                exit 1
                ;;
        esac
        ;;

    rebuild)
        SERVICE=${2:-}
        if [ -n "$SERVICE" ]; then
            echo -e "${BLUE}Rebuilding $SERVICE...${NC}"
            docker-compose build "$SERVICE"
            docker-compose up -d "$SERVICE"
        else
            echo -e "${BLUE}Rebuilding all services...${NC}"
            docker-compose build
            docker-compose up -d
        fi
        echo -e "${GREEN}Rebuild complete.${NC}"
        ;;

    reset-db)
        echo -e "${YELLOW}Resetting database...${NC}"
        docker-compose down -v postgres
        docker-compose up -d postgres
        sleep 5
        docker-compose exec -T postgres psql -U ros -d ros -f /docker-entrypoint-initdb.d/init.sql
        echo -e "${GREEN}Database reset complete.${NC}"
        ;;

    clean)
        echo -e "${YELLOW}Cleaning up development environment...${NC}"
        docker-compose down -v --remove-orphans
        docker system prune -f
        echo -e "${GREEN}Cleanup complete.${NC}"
        ;;

    status)
        echo -e "${BLUE}Service Status${NC}"
        docker-compose ps
        ;;

    *)
        echo "ResearchFlow Development Helper"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  start       Start all services"
        echo "  stop        Stop all services"
        echo "  restart     Restart all services"
        echo "  logs [svc]  Follow logs (optional: specific service)"
        echo "  shell <svc> Open shell in service (orchestrator, worker, postgres, redis)"
        echo "  rebuild [s] Rebuild services (optional: specific service)"
        echo "  reset-db    Reset database to initial state"
        echo "  clean       Remove all containers and volumes"
        echo "  status      Show service status"
        echo ""
        exit 1
        ;;
esac
