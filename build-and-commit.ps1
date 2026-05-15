$ErrorActionPreference = "Stop"

Write-Host "Building frontend..." -ForegroundColor Cyan
npx vite build --config vite.app.config.ts
if (-not $?) { Write-Error "Frontend build failed."; exit 1 }

Write-Host "Building server..." -ForegroundColor Cyan
npx esbuild server/index.ts --platform=node --target=node20 --outfile=dist/server/index.js --format=esm --packages=external
if (-not $?) { Write-Error "Server build failed."; exit 1 }

Write-Host "Staging dist/..." -ForegroundColor Cyan
git add dist/

$staged = git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No changes in dist/ — nothing to commit." -ForegroundColor Yellow
} else {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    git commit -m "build: atualizar dist ($timestamp)"
    git push
    Write-Host "Done — dist pushed to remote." -ForegroundColor Green
}
