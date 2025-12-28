#!/bin/bash

# SourceCorp Platform - Quick Start Script

set -e

echo "========================================"
echo "SourceCorp Platform - Quick Start"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    
    # Generate random secrets
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    
    cat > .env << EOF
# Database Configuration
DB_PASSWORD=${DB_PASSWORD}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
EOF
    
    echo "✓ Environment file created with secure random values"
else
    echo "✓ Environment file already exists"
fi

echo ""
echo "Starting Docker services..."
docker-compose up -d

echo ""
echo "Waiting for services to be ready..."
sleep 10

echo ""
echo "Running database migrations..."
docker-compose exec -T backend npm run migrate

echo ""
echo "========================================"
echo "✓ Platform started successfully!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Create admin user:"
echo "   bash scripts/setup-admin.sh"
echo ""
echo "2. Access the platform:"
echo "   http://localhost"
echo ""
echo "View logs:"
echo "   docker-compose logs -f"
echo ""

