# PowerShell script to create initial Obligation Template
# This script runs the TypeScript template creation script

Write-Host "Creating Initial Obligation Template..." -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
Set-Location -Path "$PSScriptRoot\..\backend"

# Run the TypeScript script
npm run migrate:initial-obligation-template

# Return to original directory
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "Template creation script completed." -ForegroundColor Green
