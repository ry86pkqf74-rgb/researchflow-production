#!/bin/bash
# Quick deployment script for Vercel
# This script helps deploy the ResearchFlow frontend to Vercel

set -e

echo "🚀 ResearchFlow Vercel Deployment"
echo "=================================="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
fi

# Check if we're in the right directory
if [ ! -f "vercel.json" ]; then
    echo "❌ Error: vercel.json not found. Please run this script from the repository root."
    exit 1
fi

echo "📋 Deployment Options:"
echo "1) Development deployment (preview)"
echo "2) Production deployment"
echo ""
read -p "Select deployment type (1 or 2): " deploy_type

case $deploy_type in
    1)
        echo ""
        echo "🔨 Building and deploying to development..."
        vercel
        ;;
    2)
        echo ""
        echo "⚠️  This will deploy to production!"
        read -p "Are you sure? (y/n): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            echo "🔨 Building and deploying to production..."
            vercel --prod
        else
            echo "❌ Deployment cancelled"
            exit 0
        fi
        ;;
    *)
        echo "❌ Invalid option. Please select 1 or 2."
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Verify the deployment at the URL provided above"
echo "2. Check that environment variables are set in Vercel dashboard"
echo "3. Test the frontend with your backend API"
echo ""
echo "For more information, see VERCEL_DEPLOYMENT.md"
