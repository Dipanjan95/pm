$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$docker = if ($dockerCommand) {
	$dockerCommand.Source
} else {
	$dockerDirectory = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin"
	$env:PATH = "$dockerDirectory;$env:PATH"
	Join-Path $dockerDirectory "docker.exe"
}

if (-not (Test-Path $docker)) {
	throw "Docker CLI not found. Start Docker Desktop or add docker.exe to PATH."
}

& $docker compose down --remove-orphans
if ($LASTEXITCODE -ne 0) {
	exit $LASTEXITCODE
}

Write-Host "Project Management app has been stopped."
