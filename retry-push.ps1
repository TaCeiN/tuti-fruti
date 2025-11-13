# Скрипт для повторной попытки push с задержкой
$maxAttempts = 5
$delaySeconds = 30

Write-Host "Попытка выполнить git push --force..." -ForegroundColor Yellow
Write-Host "Максимум попыток: $maxAttempts" -ForegroundColor Yellow
Write-Host "Задержка между попытками: $delaySeconds секунд" -ForegroundColor Yellow
Write-Host ""

for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    Write-Host "Попытка $attempt из $maxAttempts..." -ForegroundColor Cyan
    
    $result = git push --force 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "✅ Успешно отправлено!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "❌ Ошибка (код: $exitCode):" -ForegroundColor Red
        Write-Host $result
        
        if ($attempt -lt $maxAttempts) {
            Write-Host "Ожидание $delaySeconds секунд перед следующей попыткой..." -ForegroundColor Yellow
            Start-Sleep -Seconds $delaySeconds
        }
    }
}

Write-Host "Все попытки исчерпаны. Попробуйте позже." -ForegroundColor Red
exit 1

