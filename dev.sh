#!/bin/bash

# Development script for collaborative AI chat
# This script starts the application in development mode with hot reloading

echo " Starting Collaborative AI Chat in DEVELOPMENT mode..."
echo "📝 Changes to source code will be reflected automatically!"
echo ""

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Start in development mode
echo " Starting development environment..."
docker-compose -f docker-compose.dev.yml up --build

echo ""
echo "✅ Development environment started!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 Backend API: http://localhost:9000"
echo "🗄️  Database: localhost:3307"
echo "🔍 Vector DB: http://localhost:8000"
echo ""
echo "💡 To stop the development environment, press Ctrl+C"
