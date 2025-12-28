# PowerShell script to run finance templates migration

Write-Host "========================================"
Write-Host "Finance Templates Migration"
Write-Host "========================================"
Write-Host ""

Write-Host "Running migration..."
docker-compose exec backend npm run migrate:finance-templates

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Migration completed successfully!"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "✗ Migration failed. Please check the error messages above."
    Write-Host ""
    exit 1
}

