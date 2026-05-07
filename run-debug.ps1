# PowerShell script to run the overlay with error capture
# Save as: run-debug.ps1
# Run with: powershell -ExecutionPolicy Bypass -File run-debug.ps1

Write-Host "Overlay Debug Launcher" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

# Clear old log
if (Test-Path "app-error.log") {
    Remove-Item "app-error.log"
    Write-Host "Cleared previous error log" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting app in 2 seconds..." -ForegroundColor Yellow
Write-Host "(This window will stay open after the app closes to show errors)" -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Start the app
Write-Host ""
Write-Host "Launching npm start..." -ForegroundColor Cyan
npm start 2>&1 | Tee-Object -FilePath "app-output.txt"

Write-Host ""
Write-Host "App closed." -ForegroundColor Yellow
Write-Host ""

# Check for errors
if (Test-Path "app-error.log") {
    Write-Host "=== ERRORS FOUND ===" -ForegroundColor Red
    Write-Host ""
    Get-Content "app-error.log" | Write-Host
    Write-Host ""
    Write-Host "Errors saved to: app-error.log" -ForegroundColor Red
} else {
    Write-Host "No errors logged!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Press Enter to close this window..."
Read-Host
