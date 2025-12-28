#!/bin/bash

# SourceCorp Platform - Hierarchy Migration Script

set -e

echo "========================================"
echo "SourceCorp Platform - Hierarchy Migration"
echo "========================================"
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "Checking if backend container is running..."
if ! docker ps --filter "name=sourcecorp-backend" --format "{{.Names}}" | grep -q sourcecorp-backend; then
    echo "❌ Backend container is not running."
    echo "Please start the platform first:"
    echo "   docker-compose up -d"
    exit 1
fi

echo "✓ Backend container is running"
echo ""

echo "Running hierarchy migration..."
docker-compose exec -T backend npm run migrate:hierarchy

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "✓ Migration completed successfully!"
    echo "========================================"
    echo ""
    echo "The following tables have been created:"
    echo "  - auth_schema.user_hierarchy"
    echo "  - task_schema.tasks"
    echo ""
    echo "You can now:"
    echo "  1. Access the admin hierarchy page at: http://localhost/admin/hierarchy"
    echo "  2. Manage tasks at: http://localhost/tasks/hierarchy"
    echo ""
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    echo ""
    exit 1
fi

