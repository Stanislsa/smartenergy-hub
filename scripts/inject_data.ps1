# Script PowerShell pour injecter des donnees synthetiques dans le Collector Service
# Utilise depuis Windows car les services Docker sont accessibles via localhost

param(
    [string]$DataFile = "synthetic_data.json",
    [string]$CollectorUrl = "http://localhost:8081/api/measurements",
    [int]$DelayMs = 10
)

# Lire le fichier JSON
$jsonData = Get-Content $DataFile | ConvertFrom-Json

$totalSent = 0
$totalFailed = 0

foreach ($sensorId in $jsonData.PSObject.Properties.Name) {
    $measurements = $jsonData.$sensorId
    Write-Host "Envoi de $($measurements.Count) mesures pour $sensorId..." -ForegroundColor Cyan
    
    $successCount = 0
    $failCount = 0
    
    foreach ($i in 0..($measurements.Count - 1)) {
        $measurement = $measurements[$i]
        
        try {
            $body = $measurement | ConvertTo-Json -Compress
            $response = Invoke-RestMethod -Uri $CollectorUrl -Method Post -Body $body -ContentType "application/json" -TimeoutSec 5
            
            if ($response -eq $null -or $response.StatusCode -eq 202) {
                $successCount++
                $totalSent++
            } else {
                $failCount++
                $totalFailed++
            }
        } catch {
            $failCount++
            $totalFailed++
            if ($i -lt 5) {
                Write-Host "  Erreur envoi mesure $($i+1): $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        
        # Petit delai pour eviter de surcharger le service
        if ($i % 50 -eq 0 -and $i -gt 0) {
            Start-Sleep -Milliseconds $DelayMs
        }
    }
    
    Write-Host "  OK $successCount/$($measurements.Count) envoyees avec succes" -ForegroundColor Green
    if ($failCount -gt 0) {
        Write-Host "  KO $failCount echecs" -ForegroundColor Red
    }
}

Write-Host "`nTotal: $totalSent envoyees, $totalFailed echecs" -ForegroundColor Cyan
