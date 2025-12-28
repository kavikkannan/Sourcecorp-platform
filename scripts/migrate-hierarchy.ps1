# SourceCorp Platform - Hierarchy Migration Script (PowerShell)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SourceCorp Platform - Hierarchy Migration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker first." -ForegroundColor Red
    exit 1
}

Write-Host "Checking if backend container is running..." -ForegroundColor Yellow
$backendContainer = docker ps --filter "name=sourcecorp-backend" --format "{{.Names}}"
if (-not $backendContainer) {
    Write-Host "❌ Backend container is not running." -ForegroundColor Red
    Write-Host "Please start the platform first:" -ForegroundColor Yellow
    Write-Host "   docker-compose up -d" -ForegroundColor White
    exit 1
}

Write-Host "✓ Backend container is running" -ForegroundColor Green
Write-Host ""

Write-Host "Running hierarchy migration..." -ForegroundColor Yellow
docker-compose exec -T backend npm run migrate:hierarchy

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ Migration completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The following tables have been created:" -ForegroundColor Cyan
    Write-Host "  - auth_schema.user_hierarchy" -ForegroundColor White
    Write-Host "  - task_schema.tasks" -ForegroundColor White
    Write-Host ""
    Write-Host "You can now:" -ForegroundColor Cyan
    Write-Host "  1. Access the admin hierarchy page at: http://localhost/admin/hierarchy" -ForegroundColor White
    Write-Host "  2. Manage tasks at: http://localhost/tasks/hierarchy" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Migration failed. Please check the error messages above." -ForegroundColor Red
    Write-Host ""
    exit 1
}

