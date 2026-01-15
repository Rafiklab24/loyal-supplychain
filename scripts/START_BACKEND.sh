#!/bin/bash

# Start Backend API Server
echo "=========================================="
echo "🚀 Starting Backend API Server..."
echo "=========================================="
echo ""

cd /Users/rafik/loyal-supplychain/app

# Set database URL
export DATABASE_URL="postgresql://rafik@localhost:5432/loyal_supplychain"

echo "📊 Database: $DATABASE_URL"
echo "🌐 Server will start on: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm run dev

