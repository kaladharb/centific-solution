#!/bin/bash

# VoltEdge Deployment Script

set -e

echo "🚀 Starting VoltEdge deployment..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Copy .env.example to .env and configure your variables."
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Validate required environment variables
if [ -z "$JWT_SECRET_KEY" ]; then
    echo "❌ JWT_SECRET_KEY is required"
    exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ DB_PASSWORD is required"
    exit 1
fi

echo "✅ Environment variables validated"

# Build and start services
echo "🏗️  Building and starting services..."
docker-compose -f docker-compose.prod.yml down || true
docker-compose -f docker-compose.prod.yml up --build -d

echo "⏳ Waiting for services to start..."
sleep 30

# Check if services are running
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo ""
    echo "🌐 Frontend: http://localhost:${FRONTEND_PORT:-80}"
    echo "🔧 Backend API: http://localhost:${BACKEND_PORT:-5000}/health"
    echo ""
    echo "📝 To check logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "🛑 To stop: docker-compose -f docker-compose.prod.yml down"
else
    echo "❌ Services failed to start. Check logs:"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi