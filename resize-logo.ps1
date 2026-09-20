param([string]$Source, [string]$Dest, [int]$Size = 300)

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($Source)
try {
  $scale = [Math]::Min($Size / $img.Width, $Size / $img.Height)
  $w = [int]($img.Width * $scale)
  $h = [int]($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)
  $ox = [int](($Size - $w) / 2)
  $oy = [int](($Size - $h) / 2)
  $g.DrawImage($img, $ox, $oy, $w, $h)
  $g.Dispose()
  $bmp.Save($Dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "Saved $Dest (${Size}x${Size})"
} finally {
  $img.Dispose()
}
