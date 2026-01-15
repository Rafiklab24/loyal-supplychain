#!/bin/bash

echo "=========================================="
echo "🗄️  Starting PostgreSQL Database..."
echo "=========================================="
echo ""

# Check if PostgreSQL is installed
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL is installed"
else
    echo "❌ PostgreSQL is not installed"
    echo ""
    echo "Install with: brew install postgresql@16"
    exit 1
fi

# Check if it's already running
if pgrep -x postgres > /dev/null; then
    echo "✅ PostgreSQL is already running"
else
    echo "🔄 Starting PostgreSQL..."
    brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null
    
    # Wait a moment
    sleep 2
    
    if pgrep -x postgres > /dev/null; then
        echo "✅ PostgreSQL started successfully"
    else
        echo "⚠️  Could not start PostgreSQL automatically"
        echo "   Try manually: brew services start postgresql@16"
    fi
fi

echo ""
echo "📊 Testing database connection..."
psql -U rafik -d loyal_supplychain -c "SELECT COUNT(*) as shipments FROM logistics.shipments;" 2>/dev/null && echo "✅ Database connection OK" || echo "⚠️  Database connection failed - make sure migrations are run"

echo ""
echo "=========================================="
echo "Database is ready!"
echo "=========================================="

