# ============================================================
#  BAM DOI vao  don-va-deploy.cmd  de chay.
#  Dung dan noi dung file nay vao cua so PowerShell: khi dan,
#  PowerShell khong biet file dang nam o dau nen se doan nham
#  thu muc du an.
# ============================================================
#
# Don folder cu roi deploy, trong mot lan bam.
#
# Buoc scan da chuyen tu app\(app)\search sang app\(app)\scan. De lai ca hai thi
# app co hai route lam cung mot viec, lan sau doc code se roi.
#
# Script nay XOA FILE THAT, khong bo vao thung rac. Nen truoc khi xoa no bat
# buoc phai thay folder moi da ton tai, va bat anh go xac nhan.
#
# Bo qua buoc kiem TypeScript: .\don-va-deploy.ps1 -Fast

param(
    [switch]$Fast
)

$ErrorActionPreference = 'Stop'

# --- Tim thu muc du an ------------------------------------------------------
# Viet gon tren MOT dong. Kieu if/elseif nhieu dong chi dung trong file; luc dan
# vao console thi moi dong la mot lenh rieng, elseif dung mot minh se bao loi.
$doan = @(
    $PSScriptRoot,
    $(if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path }),
    (Join-Path $HOME 'Downloads\bdleaddesk-src'),
    (Join-Path $HOME 'onpoint-lead-desk')
) | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'package.json')) }

if (-not $doan) {
    Write-Host ""
    Write-Host "  Khong tim thay thu muc du an Lead Desk." -ForegroundColor Red
    Write-Host "  Da thu: thu muc chua script, Downloads\bdleaddesk-src, va onpoint-lead-desk." -ForegroundColor DarkGray
    Write-Host ""
    Read-Host "  Nhan Enter de dong"
    exit 1
}

$proj = $doan[0]
Set-Location -LiteralPath $proj

$cu  = Join-Path $proj 'app\(app)\search'
$moi = Join-Path $proj 'app\(app)\scan'

Write-Host ""
Write-Host "  Du an  : OnPoint Lead Desk" -ForegroundColor Cyan
Write-Host "  Thu muc: $proj" -ForegroundColor DarkGray
Write-Host ""

# --- Chan an toan: khong co folder moi thi khong duoc xoa folder cu --------
if (-not (Test-Path -LiteralPath $moi)) {
    Write-Host "  DUNG LAI" -ForegroundColor Red
    Write-Host "  Thu muc nay khong co app\(app)\scan." -ForegroundColor Red
    Write-Host ""

    $khac = Join-Path $HOME 'Downloads\bdleaddesk-src'
    if ((Test-Path -LiteralPath (Join-Path $khac 'app\(app)\scan')) -and ($khac -ne $proj)) {
        Write-Host "  Ban day du nam o thu muc khac:" -ForegroundColor Yellow
        Write-Host "    $khac" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Mo thu muc do roi bam doi  don-va-deploy.cmd  trong do." -ForegroundColor Yellow
    } else {
        Write-Host "  Nho Claude ghi lai bo file /scan truoc, roi chay lai." -ForegroundColor Yellow
    }

    Write-Host ""
    Read-Host "  Nhan Enter de dong"
    exit 1
}

# --- Don folder cu ---------------------------------------------------------
if (Test-Path -LiteralPath $cu) {
    $files = @(Get-ChildItem -LiteralPath $cu -Recurse -File)
    Write-Host "  Sap xoa vinh vien $($files.Count) file trong app\(app)\search :" -ForegroundColor Yellow
    foreach ($f in $files) {
        Write-Host "    $($f.FullName.Substring($proj.Length + 1))" -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Host "  Khong vao thung rac, khong hoan tac duoc." -ForegroundColor DarkGray
    Write-Host "  Ban thay the da nam o app\(app)\scan roi." -ForegroundColor DarkGray
    Write-Host ""

    $ok = Read-Host "  Go dung chu XOA de tiep, Enter de bo qua buoc nay"
    if ($ok -eq 'XOA') {
        Remove-Item -LiteralPath $cu -Recurse -Force
        Write-Host "  Da xoa app\(app)\search." -ForegroundColor Green
    } else {
        Write-Host "  Giu nguyen folder cu. Van deploy binh thuong." -ForegroundColor DarkGray
    }
    Write-Host ""
} else {
    Write-Host "  app\(app)\search khong con, khong co gi de don." -ForegroundColor Green
    Write-Host ""
}

# --- Nhac bien moi truong --------------------------------------------------
Write-Host "  Nho: nut New scan tren Brand board lay duong dan tu bien" -ForegroundColor Yellow
Write-Host "       NEXT_PUBLIC_SCAN_URL tren Vercel. Dat thanh  /scan" -ForegroundColor Yellow
Write-Host "       De trong thi nut se an di va hien 'Scanning is offline'." -ForegroundColor DarkGray
Write-Host ""

# --- Giao phan con lai cho deploy.ps1 --------------------------------------
$dep = Join-Path $proj 'deploy.ps1'
if (-not (Test-Path -LiteralPath $dep)) {
    Write-Host "  Khong thay deploy.ps1 trong thu muc nay." -ForegroundColor Red
    Read-Host "  Nhan Enter de dong"
    exit 1
}

& $dep -Fast:$Fast
exit $LASTEXITCODE
