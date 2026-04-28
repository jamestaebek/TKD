param([string]$mensaje = "")
function Write-Ok   { param($t) Write-Host "OK: $t" -ForegroundColor Green }
function Write-Info { param($t) Write-Host ">> $t" -ForegroundColor Cyan }
function Write-Err  { param($t) Write-Host "ERROR: $t" -ForegroundColor Red }
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
if ($mensaje -eq "") { $mensaje = "sync: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
Write-Info "Repo: TKD | Mensaje: $mensaje"
$keys = ssh-add -l 2>&1
if ($keys -match "no identities") { ssh-add "C:\Users\JJARAMILLOR\.ssh\id_personal" }
Write-Ok "SSH listo"
Write-Info "Pull..."
git pull
if ($LASTEXITCODE -ne 0) { Write-Err "Error en pull"; exit 1 }
$status = git status --porcelain
if (-not $status) { Write-Ok "Sin cambios. Todo al dia."; exit 0 }
Write-Info "Add, commit, push..."
git add .
git commit -m $mensaje
git push
if ($LASTEXITCODE -ne 0) { Write-Err "Error en push"; exit 1 }
Write-Ok "TKD sincronizado!"