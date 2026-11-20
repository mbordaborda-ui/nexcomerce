Add-Type -AssemblyName System.Drawing

$public = Join-Path (Split-Path $PSScriptRoot -Parent) 'public'
if (-not (Test-Path $public)) { New-Item -ItemType Directory -Path $public | Out-Null }

function New-RoundedPath([float]$size, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($size - $d, 0, $d, $d, 270, 90)
  $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $path.AddArc(0, $size - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-Icon([int]$size, [string]$file, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $c1 = [System.Drawing.ColorTranslator]::FromHtml('#8B5CF6')
  $c2 = [System.Drawing.ColorTranslator]::FromHtml('#5B21B6')
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)
  if ($maskable) {
    $g.FillRectangle($brush, $rect)
  } else {
    $path = New-RoundedPath $size ($size * 0.28)
    $g.FillPath($brush, $path)
    $path.Dispose()
  }

  $scale = if ($maskable) { 0.52 } else { 0.72 }
  $offset = ($size - $size * $scale) / 2
  $unit = ($size * $scale) / 64.0
  $points = @(
    (New-Object System.Drawing.PointF(($offset + 19 * $unit), ($offset + 44 * $unit))),
    (New-Object System.Drawing.PointF(($offset + 19 * $unit), ($offset + 20 * $unit))),
    (New-Object System.Drawing.PointF(($offset + 26 * $unit), ($offset + 20 * $unit))),
    (New-Object System.Drawing.PointF(($offset + 38 * $unit), ($offset + 35 * $unit))),
    (New-Object System.Drawing.PointF(($offset + 38 * $unit), ($offset + 20 * $unit))),
    (New-Object System.Drawing.PointF(($offset + 45 * $unit), ($offset + 20 * $unit))),
    (New-Object System.Drawing.PointF(($offset + 45 * $unit), ($offset + 44 * $unit))),
    (New-Object System.Drawing.PointF(($offset + 38 * $unit), ($offset + 44 * $unit))),
    (New-Object System.Drawing.PointF(($offset + 26 * $unit), ($offset + 29 * $unit))),
    (New-Object System.Drawing.PointF(($offset + 26 * $unit), ($offset + 44 * $unit)))
  )
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillPolygon($white, [System.Drawing.PointF[]]$points)

  $dest = Join-Path $public $file
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $white.Dispose(); $brush.Dispose(); $g.Dispose(); $bmp.Dispose()
  Write-Host "Created $file"
}

Draw-Icon 192 'pwa-192.png' $false
Draw-Icon 512 'pwa-512.png' $false
Draw-Icon 180 'apple-touch-icon.png' $false
Draw-Icon 512 'pwa-maskable-512.png' $true
