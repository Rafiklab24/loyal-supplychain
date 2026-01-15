#!/bin/bash

clear

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║         🚀 Loyal Supply Chain - Full System Start         ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Step 1: Start PostgreSQL
echo "📝 Step 1/3: Starting PostgreSQL Database..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"$DIR/scripts/START_DATABASE.sh"
echo ""
sleep 2

# Step 2: Start Backend API in new terminal
echo "📝 Step 2/3: Starting Backend API (port 3000)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
osascript -e "tell application \"Terminal\" to do script \"cd '$DIR' && ./scripts/START_BACKEND.sh\""
echo "✅ Backend API starting in new terminal window"
echo ""
sleep 3

# Step 3: Start Frontend UI in new terminal
echo "📝 Step 3/3: Starting Frontend UI (port 5173)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
osascript -e "tell application \"Terminal\" to do script \"cd '$DIR' && ./scripts/START_FRONTEND.sh\""
echo "✅ Frontend UI starting in new terminal window"
echo ""
sleep 3

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Test backend
echo "🔍 Testing backend API..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Backend API is running"
else
    echo "⚠️  Backend API not responding yet (may need more time)"
fi

# Open browser
echo ""
echo "🌐 Opening browser to http://localhost:5173"
open http://localhost:5173

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║                  ✅ System Started!                        ║"
echo "║                                                            ║"
echo "║  📊 Database:   Running                                    ║"
echo "║  🔌 Backend:    http://localhost:3000                      ║"
echo "║  🎨 Frontend:   http://localhost:5173                      ║"
echo "║                                                            ║"
echo "║  Login with any username/password                          ║"
echo "║  Toggle language with button in top-right                  ║"
echo "║                                                            ║"
echo "║  To stop: Close the terminal windows or press Ctrl+C      ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📖 For help, see: HOW_TO_START.md"
echo ""

