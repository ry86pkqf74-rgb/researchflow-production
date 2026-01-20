#!/bin/bash
# Claude Docker Status Dashboard

echo "📊 Claude Docker Status"
echo "========================"
echo ""

echo "🐳 Running Containers:"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep -i claude || echo "  None"
echo ""

echo "💾 Docker Disk Usage:"
docker system df
echo ""

echo "🧠 Memory Directory:"
ls -la ~/.claude-memory 2>/dev/null || echo "  Not found - will be created on first run"
echo ""

echo "📂 Claude Images:"
docker images | grep -i claude || echo "  None"
