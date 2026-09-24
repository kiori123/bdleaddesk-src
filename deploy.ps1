# Deploy BD Lead Hub len Vercel.
#
# Khac ban cu o mot cho: kiem TypeScript ngay tren may TRUOC khi upload.
# Vercel build mat 1 den 3 phut, mot loi chinh ta cung phai doi het chung do
# roi moi biet. tsc chay tai cho het khoang 10 den 20 giay.
#
# Buoc kiem nay can node_modules. Thu muc nao chua cai thi script se hoi,
# khong tu y chay npm install, va cung khong lay do lam ly do chan deploy.
#
# Muon bo qua buoc kiem: .\deploy.ps1 -Fast

param(
    [switch]$Fast
)

# tim thu muc du an: uu tien thu muc chua script, khong co thi lay mac dinh
$proj = Join-Path $HOME 'onpoint-lead-desk'
if ($PSScriptRoot) { $proj = $PSScriptRoot }
elseif ($MyInvocation.MyCommand.Path) { $proj = Split-Path -Parent $MyInvocation.MyCommand.Path }

if (-not (Test-Path (Join-Path $proj 'package.json'))) {
    Write-Host ""
    Write-Host "  Khong tim thay thu muc du an Lead Desk." -ForegroundColor Red
    Write-Host "  Da tim o: $proj" -ForegroundColor DarkGray
    Write-Host ""
    Read-Host "  Nhan Enter de dong"
    exit 1
}

$ErrorActionPreference = 'Stop'
Set-Location -Path $proj

Write-Host ""
Write-Host "  Du an  : BD Lead Hub" -ForegroundColor Cyan
Write-Host "  Thu muc: $proj" -ForegroundColor DarkGray
Write-Host ""

# --- Canh bao neu dang deploy tu ban cu -------------------------------------

if (-not (Test-Path (Join-Path $proj 'app\(app)\admin\UsagePanel.tsx'))) {
    Write-Host "  CANH BAO" -ForegroundColor Red
    Write-Host "  Thu muc nay KHONG co UsagePanel.tsx, tuc man hinh tracking credit." -ForegroundColor Red
    Write-Host "  Deploy tu day se xoa man hinh do khoi ban dang chay." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Ban day du nam o: Downloads\bdleaddesk-src" -ForegroundColor Yellow
    Write-Host ""
    $tiep = Read-Host "  Van deploy? (go dung chu YES de tiep, Enter de dung)"
    if ($tiep -ne 'YES') { exit 1 }
    Write-Host ""
}

# --- Kiem cac file cua tinh nang credit da co mat chua -----------------------

$canCo = @(
    'app\api\reveal\route.ts',
    'app\(app)\credits\page.tsx',
    'app\(app)\credits\CreditConsole.tsx',
    'app\(app)\credits\actions.ts'
)
$thieu = @($canCo | Where-Object { -not (Test-Path (Join-Path $proj $_)) })

if ($thieu.Count -gt 0) {
    Write-Host "  Thieu file cua man hinh Credits:" -ForegroundColor Yellow
    foreach ($f in $thieu) { Write-Host "    - $f" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "  Van deploy duoc, nhung trang /credits se bao 404." -ForegroundColor DarkGray
    Write-Host ""
    $tiep = Read-Host "  Deploy tiep? (y de tiep, Enter de dung)"
    if ($tiep -ne 'y') { exit 1 }
    Write-Host ""
} else {
    Write-Host "  Man hinh Credits: du file." -ForegroundColor Green
    Write-Host ""
}

# --- Kiem TypeScript truoc khi upload ---------------------------------------

$coModules = Test-Path (Join-Path $proj 'node_modules')

if ($Fast) {
    Write-Host "  Bo qua buoc kiem TypeScript (-Fast)." -ForegroundColor DarkGray
    Write-Host ""
}
elseif (-not $coModules) {
    Write-Host "  Thu muc nay chua cai node_modules nen khong kiem TypeScript duoc." -ForegroundColor Yellow
    Write-Host "  Vercel van build binh thuong, no tu cai tren server." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Cai bay gio thi mat vai phut, doi lai lan sau bat loi ngay tai cho." -ForegroundColor DarkGray
    $caiDat = Read-Host "  Chay npm install truoc? (y de cai, Enter de deploy luon)"

    if ($caiDat -eq 'y') {
        Write-Host ""
        Write-Host "  Dang cai. Lan dau hoi lau, dung tat cua so." -ForegroundColor DarkGray
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "  npm install that bai. Van deploy duoc, bo qua buoc kiem." -ForegroundColor Yellow
            Write-Host ""
        } else {
            $coModules = $true
            Write-Host ""
        }
    } else {
        Write-Host ""
    }
}

if (-not $Fast -and $coModules) {
    Write-Host "  Dang kiem TypeScript tai cho..." -ForegroundColor DarkGray

    npx tsc --noEmit

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  Code con loi kieu du lieu. Chua upload gi ca." -ForegroundColor Red
        Write-Host "  Cac dong loi nam ngay tren, moi dong co dang duong-dan(dong,cot)." -ForegroundColor Yellow
        Write-Host "  Sua xong chay lai script nay." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Neu muon deploy bat chap: .\deploy.ps1 -Fast" -ForegroundColor DarkGray
        Write-Host ""
        Read-Host "  Nhan Enter de dong"
        exit 1
    }

    Write-Host "  TypeScript sach." -ForegroundColor Green
    Write-Host ""
}

# --- Deploy -----------------------------------------------------------------

Write-Host "  Dang deploy len Vercel. Next.js phai build nen hoi lau," -ForegroundColor DarkGray
Write-Host "  thuong 1 den 3 phut. Dung tat cua so." -ForegroundColor DarkGray
Write-Host ""

npx vercel --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  Deploy that bai (ma loi $LASTEXITCODE)." -ForegroundColor Red
    Write-Host "  Chua dang nhap thi chay : npx vercel login" -ForegroundColor Yellow
    Write-Host "  Loi build thi xem dong bao loi o tren." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "  Nhan Enter de dong"
    exit $LASTEXITCODE
}

# --- Viec can lam sau khi deploy --------------------------------------------

Write-Host ""
Write-Host "  Xong. Link nam o dong Production ben tren." -ForegroundColor Green
Write-Host ""
Write-Host "  Bon buoc kiem, lam dung thu tu:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Mo /credits" -ForegroundColor White
Write-Host "     Phai thay thanh Searches today, va category cua minh con credit." -ForegroundColor DarkGray
Write-Host "     Mo luon /admin xem man hinh tracking con nguyen." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  2. Scan thu MOT brand DA CO nguoi, vi du Dior." -ForegroundColor White
Write-Host "     Phai bi chan ngay tren form, khong tao job, khong ton luot." -ForegroundColor DarkGray
Write-Host "     Do la o Skip brands already on file dang lam viec." -ForegroundColor DarkGray
Write-Host "     Bo tick o do roi scan lai thi phai chay binh thuong." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  3. Scan thu MOT brand CHUA co ai, roi chay trong Supabase SQL editor:" -ForegroundColor White
Write-Host "     select kind, status, created_at from job order by created_at desc limit 3;" -ForegroundColor DarkGray
Write-Host "     select brands, profiles from search_usage order by created_at desc limit 1;" -ForegroundColor DarkGray
Write-Host "     profiles = 0 la SignalHire khong tra ve ai, khong phai app hong." -ForegroundColor DarkGray
Write-Host "     Truong hop do chuong o goc phai tren phai co mot dong bao." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  4. Reveal thu MOT nguoi, roi chay:" -ForegroundColor White
Write-Host "     select status, amount, settled_at from credit_ledger order by created_at desc limit 1;" -ForegroundColor DarkGray
Write-Host "     committed  = vong credit khep kin, xong viec." -ForegroundColor DarkGray
Write-Host "     reserved   = treo giua chung. Bao Claude TRUOC khi chay nhieu," -ForegroundColor DarkGray
Write-Host "                  neu khong han muc se tu siet dan." -ForegroundColor DarkGray
Write-Host "     Vao brand vua reveal, bam Email: phai mo Outlook da dien san" -ForegroundColor DarkGray
Write-Host "     nguoi nhan va tieu de. Ra Gmail la ban cu chua len." -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Nhan Enter de dong"
