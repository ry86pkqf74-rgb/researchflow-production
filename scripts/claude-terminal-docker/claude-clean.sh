#!/bin/bash
# Claude Docker Cleanup Script

echo "🧹 Claude Docker Cleanup"
echo ""

if [[ "$1" == "--deep" ]]; then
    echo "⚠️  Deep clean - removing ALL unused images..."
    docker system prune -a --volumes -f
else
    echo "Safe clean - removing only dangling resources..."
    docker system prune -f
fi

echo ""
echo "📊 Current Docker disk usage:"
docker system df
