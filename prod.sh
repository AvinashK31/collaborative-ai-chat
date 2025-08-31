#!/bin/bash

# Production script for collaborative AI chat
# This script starts the application in production mode

echo "🚀 Starting Collaborative AI Chat in PRODUCTION mode..."
echo "📦 Using compiled/built versions of the application"
echo ""

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Start in production mode
echo "🔧 Starting production environment..."
docker-compose up --build

echo ""
echo "✅ Production environment started!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 Backend API: http://localhost:9000"
echo "🗄️  Database: localhost:3307"
echo "🔍 Vector DB: http://localhost:8000"
echo ""
echo "💡 To stop the production environment, press Ctrl+C"
