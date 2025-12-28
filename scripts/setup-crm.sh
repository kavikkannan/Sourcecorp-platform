#!/bin/bash

# Phase 2 CRM Setup Script
# This script sets up CRM permissions after the main database migration

set -e

echo "=========================================="
echo "SourceCorp Platform - Phase 2 CRM Setup"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if postgres container is running
if ! docker ps | grep -q sourcecorp-postgres; then
    echo "❌ Error: PostgreSQL container is not running."
    echo "Please run 'docker-compose up -d' first."
    exit 1
fi

echo "📦 Installing CRM permissions..."
echo ""

# Copy CRM permissions SQL to container and execute
docker exec -i sourcecorp-postgres psql -U sourcecorp_user -d sourcecorp <<EOF
-- CRM Permissions for Phase 2
INSERT INTO auth_schema.permissions (name, description) VALUES
  ('crm.case.create', 'Create new loan cases'),
  ('crm.case.view', 'View loan cases'),
  ('crm.case.view_all', 'View all loan cases (admin only)'),
  ('crm.case.assign', 'Assign cases to users'),
  ('crm.case.update_status', 'Update case status'),
  ('crm.case.upload_document', 'Upload documents to cases'),
  ('crm.case.add_note', 'Add notes to cases')
ON CONFLICT (name) DO NOTHING;
EOF

if [ $? -eq 0 ]; then
    echo "✅ CRM permissions installed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Go to Admin Panel → Roles"
    echo "2. Assign CRM permissions to appropriate roles"
    echo "3. Navigate to CRM → Cases to start managing loan cases"
    echo ""
    echo "CRM Permissions added:"
    echo "  - crm.case.create"
    echo "  - crm.case.view"
    echo "  - crm.case.view_all"
    echo "  - crm.case.assign"
    echo "  - crm.case.update_status"
    echo "  - crm.case.upload_document"
    echo "  - crm.case.add_note"
    echo ""
else
    echo "❌ Error: Failed to install CRM permissions"
    exit 1
fi

echo "=========================================="
echo "Phase 2 CRM Setup Complete!"
echo "=========================================="


