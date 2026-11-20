param(
    [string]$ConnectionString = "",
    [string]$Password = "",
    [string]$ProjectRef = "rrpgoqmvzbjssesxlylp",
    [string]$PoolerHost = "aws-0-us-east-2.pooler.supabase.com",
    [switch]$Seed
)

# Ejecuta el API contra Supabase/PostgreSQL sin guardar la contraseña en disco.
#
# Uso recomendado:
#   .\scripts\run-api-supabase.ps1 -Seed
#
# También puedes pasar una cadena completa:
#   .\scripts\run-api-supabase.ps1 -ConnectionString "Host=...;..." -Seed

if (-not $ConnectionString) {
    if (-not $Password) {
        $secure = Read-Host "Contraseña de la base de datos de Supabase" -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }

    if (-not $Password) {
        throw "Debes indicar la contraseña de la base de datos."
    }

    $ConnectionString = "Host=$PoolerHost;Port=5432;Database=postgres;Username=postgres.$ProjectRef;Password=$Password;SSL Mode=Require;Trust Server Certificate=true"
}

$env:Database__Provider = "Postgres"
$env:ConnectionStrings__Default = $ConnectionString
if ($Seed) {
    $env:Seed__Enabled = "true"
}

Write-Host "Iniciando API contra PostgreSQL/Supabase en http://localhost:5150 ..." -ForegroundColor Cyan
Write-Host "Health: http://localhost:5150/health" -ForegroundColor DarkGray
Write-Host "Usuario: postgres.$ProjectRef" -ForegroundColor DarkGray
Write-Host "Pooler:  $PoolerHost" -ForegroundColor DarkGray

Push-Location (Join-Path $PSScriptRoot "..\src\NexComerce.Api")
try {
    dotnet run --urls http://localhost:5150
}
finally {
    Pop-Location
}
