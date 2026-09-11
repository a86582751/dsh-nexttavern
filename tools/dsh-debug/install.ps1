param([switch]$InstallCodexSkill)
$ErrorActionPreference = 'Stop'
$python = (Get-Command python -CommandType Application | Select-Object -First 1).Source
$destination = Join-Path $env:USERPROFILE '.local\bin'
$package = Join-Path $env:USERPROFILE '.dsh-debug\lib'
New-Item -ItemType Directory -Force -Path $destination, $package | Out-Null
foreach ($name in @('dsh_debug.py','http_worker.py','README.md')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $package $name) -Force
}
$entry = Join-Path $package 'dsh_debug.py'
$shim = "`$ErrorActionPreference = 'Stop'`n& '$($python.Replace("'","''"))' '$($entry.Replace("'","''"))' @args`nexit `$LASTEXITCODE`n"
Set-Content -LiteralPath (Join-Path $destination 'dsh-debug.ps1') -Value $shim -Encoding utf8
$userPath = [string][Environment]::GetEnvironmentVariable('Path','User')
if ($destination -notin ($userPath -split ';')) {
    [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $destination), 'User')
}
if ($destination -notin ($env:Path -split ';')) { $env:Path += ';' + $destination }
if ($InstallCodexSkill) {
    $skill = Join-Path $env:USERPROFILE '.codex\skills\dsh-debug'
    New-Item -ItemType Directory -Force -Path $skill | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'SKILL.md') -Destination (Join-Path $skill 'SKILL.md') -Force
}
Write-Output "Installed dsh-debug at $destination; existing shells may need their PATH refreshed."
