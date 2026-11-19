param([Parameter(Mandatory = $true)][string]$SignalFile)

$ErrorActionPreference = "Stop"
$loadingHtmlPath = Join-Path $env:TEMP "vibe-loading-$PID.html"
$edgeProfile = Join-Path $env:TEMP "vibe-loading-edge-$PID"
$edgePaths = @(
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
if (-not $edgePaths) { throw "Microsoft Edge tidak ditemukan untuk menampilkan animasi loading." }
$edgePath = $edgePaths | Select-Object -First 1

$html = @'
<!doctype html><html lang="id"><head><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta charset="utf-8">
<style>
:root{--bg:#171717;--orange:#dd7a5b;--glow:#dd7a5b66;--cycle:10s}*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:table;width:100%;padding:15px;background:#1c1c1f;color:#f4f4f5;font:14px 'Segoe UI',sans-serif;text-align:center;overflow:hidden}
.preview{display:table-cell;vertical-align:middle;width:100%;max-width:620px}.caption{margin:0 0 10px;color:#71717a;font-size:11px}.window{--ring:var(--orange);--ring-glow:var(--glow);overflow:hidden;border:1px solid #3f3f46;border-radius:18px;background:#1c1c1f;text-align:left}
.window.state-success{--ring:#4ade80;--ring-glow:#4ade8070}.window.state-failure{--ring:#fb7185;--ring-glow:#fb718570}
.titlebar{height:34px;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid #303035;color:#a1a1aa;font-size:11px}.dot{width:8px;height:8px;border-radius:50%;background:var(--orange);box-shadow:0 0 12px var(--glow)}.content{padding:20px 18px 15px}h1{margin:0;text-align:center;font-size:17px;font-weight:600}.subtitle{margin:5px 0 0;color:#a1a1aa;text-align:center;font-size:11px}.stage{position:relative;height:112px;max-width:460px;margin:10px auto 0}
.logo{position:absolute;z-index:2;top:18px;left:50%;display:grid;width:56px;height:56px;place-items:center;transform:translateX(-50%);border-radius:16px;box-shadow:0 9px 24px #0004;animation-duration:var(--cycle);animation-timing-function:cubic-bezier(.2,.8,.2,1);animation-iteration-count:infinite}.logo>svg,.logo>.robot{position:relative;z-index:1}
.frame{position:absolute;inset:0;border:2px solid #45454d;border-radius:inherit;background:#242329}.frame:after,.vite .frame:before{--origin:0deg;--p:0deg;position:absolute;inset:-2px;padding:3px;border-radius:inherit;content:'';background:conic-gradient(from var(--origin),var(--ring) 0deg var(--p),transparent var(--p) calc(360deg - var(--p)),var(--ring) calc(360deg - var(--p)) 360deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;filter:drop-shadow(0 0 5px var(--ring-glow));opacity:0;animation:frame-fill var(--cycle) linear infinite}
@supports not (background:conic-gradient(from 0deg,red,blue)){.frame:after,.vite .frame:before{background:conic-gradient(var(--ring) 0deg 90deg,transparent 90deg 270deg,var(--ring) 270deg 360deg)}}
@property --p{syntax:'<angle>';inherits:false;initial-value:0deg}.router .frame:after{--origin:270deg}.claude .frame:after{--origin:90deg}.vite .frame:after{--origin:90deg;animation-name:vite-fill}.vite .frame:before{--origin:270deg;animation-name:vite-fill}
@keyframes frame-fill{0%,28%{--p:0deg;opacity:0}29%{--p:0deg;opacity:1}44%,85%{--p:180deg;opacity:1}94%,100%{--p:180deg;opacity:0}}
@keyframes vite-fill{0%,63%{--p:0deg;opacity:0}64%{--p:0deg;opacity:1}78%,85%{--p:180deg;opacity:1}94%,100%{--p:180deg;opacity:0}}
.router{background:#532d27;color:white;animation-name:router-journey}.router>svg{width:33px;height:33px}.vite{z-index:3;width:54px;height:54px;top:19px;border-radius:15px;animation:vite-breathe var(--cycle) ease-in-out infinite}.vite svg{width:37px;height:37px}.claude{width:62px;height:62px;top:15px;background:#302521;animation-name:claude-journey}.robot{display:block;width:48px;height:40px;overflow:visible}.robot svg{width:48px;height:40px;overflow:visible}.robot-body{fill:var(--ring)}.robot-eyes{fill:#18181b}.robot-legs{fill:var(--ring);transform-box:fill-box;transform-origin:top;animation:robot-step .45s steps(2) infinite}@keyframes robot-step{0%,100%{transform:translateY(0)}50%{transform:translateY(1px)}}
.bridge{position:absolute;z-index:1;top:43px;height:5px;width:calc(36% - 16px);overflow:hidden;border-radius:99px;background:#3f3f46;opacity:0;animation:bridge-visibility var(--cycle) linear infinite,bridge-release var(--cycle) cubic-bezier(.2,.7,.3,1) infinite}.bridge.left{left:14%;--dir:-1;transform-origin:left center}.bridge.right{right:14%;--dir:1;transform-origin:right center}.bridge:after{position:absolute;inset:0;border-radius:inherit;content:'';background:var(--ring);box-shadow:0 0 12px var(--ring-glow);transform:scaleX(0);animation:bridge-progress var(--cycle) ease-in-out infinite}.bridge.left:after{transform-origin:left}.bridge.right:after{transform-origin:right}
@keyframes bridge-visibility{0%,43%{opacity:0}46%,86.5%{opacity:1}89.5%,100%{opacity:0}}@keyframes bridge-release{0%,86%{filter:brightness(1);transform:translateX(0) scale(1,1)}87%{filter:brightness(3) drop-shadow(0 0 8px var(--ring));transform:translateX(calc(var(--dir)*6px)) scale(.9,1.5)}89.5%,100%{filter:brightness(1.2);transform:translateX(calc(var(--dir)*40px)) scale(.05,.1)}}@keyframes bridge-progress{0%,45%{transform:scaleX(0)}64%,95%{transform:scaleX(1)}100%{transform:scaleX(0)}}
@keyframes router-journey{0%,10%{left:50%;transform:translateX(-50%) scale(.78);opacity:.72}28%,82%{left:14%;transform:translateX(-50%) scale(1);opacity:1}100%{left:50%;transform:translateX(-50%) scale(.78);opacity:.72}}@keyframes claude-journey{0%,10%{left:50%;transform:translateX(-50%) scale(.78);opacity:.72}28%,82%{left:86%;transform:translateX(-50%) scale(1);opacity:1}100%{left:50%;transform:translateX(-50%) scale(.78);opacity:.72}}@keyframes vite-breathe{0%,10%,100%{transform:translateX(-50%) scale(.86);filter:brightness(.8)}28%,82%{transform:translateX(-50%) scale(1);filter:brightness(1.12)}}
.status{min-height:19px;margin:0;text-align:center;color:#a1a1aa;font-size:11px}.status:before{display:inline-block;width:6px;height:6px;margin:0 7px 1px 0;border-radius:50%;background:var(--ring);content:'';animation:pulse 1.8s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:.45}50%{opacity:1;box-shadow:0 0 10px var(--ring)}}.state-success .status{color:#4ade80}.state-success .status:before{animation:none}.state-failure .status{color:#fb7185}.state-failure .status:before{animation:none}.state-success .claude{box-shadow:0 0 25px #4ade8040}.state-failure .claude{box-shadow:0 0 25px #fb718540}.face-happy,.face-fail{display:none}.state-success .face-neutral,.state-failure .face-neutral{display:none}.state-success .face-happy,.state-failure .face-fail{display:block}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}.router{left:14%;opacity:1}.claude{left:86%;opacity:1}.bridge{opacity:1}.bridge:after{transform:scaleX(1)}.frame:after,.vite .frame:before{--p:180deg;opacity:1}}
</style></head><body><main class="preview"><p class="caption">VIBE APP · MEMUAT LAYANAN</p><section class="window" id="window"><div class="titlebar"><span class="dot"></span><span>Vibe App</span></div><div class="content"><h1>Menyiapkan Vibe App</h1><p class="subtitle">Menghubungkan layanan...</p><div class="stage" aria-label="Logo 9Router, Vite, dan Claude Code bergerak"><div class="logo router" title="9Router"><span class="frame"></span><svg viewBox="0 0 48 48" fill="none"><g stroke="white" stroke-width="3.2" stroke-linecap="round"><path d="M24 24 13 13m11 11 11-11M24 24 13 35m11-11 11 11"/><path d="M24 24V9m0 15v15M24 24H9m15 0h15" opacity=".9"/></g><g fill="white"><circle cx="13" cy="13" r="5"/><circle cx="35" cy="13" r="5"/><circle cx="13" cy="35" r="5"/><circle cx="35" cy="35" r="5"/><circle cx="24" cy="24" r="5"/></g></svg></div><div class="logo vite" title="Vite"><span class="frame"></span><svg viewBox="0 0 256 257" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="vite-a" x1="-.8" x2=".55" y1=".2" y2=".85"><stop stop-color="#41D1FF"/><stop offset="1" stop-color="#BD34FE"/></linearGradient><linearGradient id="vite-b" x1=".43" x2=".5" y1=".05" y2=".9"><stop stop-color="#FFEA83"/><stop offset=".08" stop-color="#FFDD35"/><stop offset="1" stop-color="#FFA800"/></linearGradient></defs><path fill="url(#vite-a)" d="M255 38 136 252c-2 4-8 4-10 0L1 38c-3-5 1-11 7-10l119 21c1 0 2 0 3 0l119-21c6-1 10 5 6 10Z"/><path fill="url(#vite-b)" d="m185 1-88 17c-2 0-3 2-4 4L87 112c0 3 3 5 6 4l25-8c3-1 6 2 5 5l-8 39c-1 3 3 6 6 4l15-9c3-2 7 1 6 5l-13 63c-1 4 4 6 6 3l2-3 81-161c2-3-1-7-5-6l-26 5c-3 1-6-2-5-5l9-41c1-3-2-6-5-5Z"/></svg></div><div class="bridge left"></div><div class="bridge right"></div><div class="logo claude" title="Claude Code"><span class="frame"></span><span class="robot"><svg viewBox="0 0 11 9" shape-rendering="crispEdges"><rect class="robot-body" x="1" y="0" width="9" height="7"/><rect class="robot-body" x="0" y="2" width="11" height="2"/><g class="robot-legs"><rect class="robot-body" x="2" y="7" width="1" height="2"/><rect class="robot-body" x="3" y="7" width="1" height="2"/><rect class="robot-body" x="7" y="7" width="1" height="2"/><rect class="robot-body" x="8" y="7" width="1" height="2"/></g><g class="robot-eyes"><g class="face-neutral"><rect x="2" y="2" width="1" height="1"/><rect x="8" y="2" width="1" height="1"/><rect x="5" y="5" width="1" height=".5"/></g><g class="face-happy"><rect x="2" y="1" width="1" height="1"/><rect x="3" y="2" width="1" height="1"/><rect x="2" y="3" width="1" height="1"/><rect x="8" y="1" width="1" height="1"/><rect x="7" y="2" width="1" height="1"/><rect x="8" y="3" width="1" height="1"/><rect x="4" y="5" width="3" height=".6"/></g><g class="face-fail"><path d="M2 1h1v1h1v1h1v1H4V3H3V2H2zM8 1h1v1H8v1H7v1H6V3h1V2h1z"/></g></g></svg></span></div></div><p id="status" class="status">Menyalakan 9Router...</p></div></section></main>
<script>function setStatus(value){const panel=document.getElementById('window'),status=document.getElementById('status');panel.classList.remove('state-success','state-failure');if(value==='ready'){panel.classList.add('state-success');status.textContent='Semua layanan siap';document.querySelector('.subtitle').textContent='Layanan berhasil terhubung'}else if(value==='fail'){panel.classList.add('state-failure');status.textContent='Layanan gagal dimulai';document.querySelector('.subtitle').textContent='Periksa koneksi 9Router'}else{status.textContent='Menyalakan 9Router...'}}
</script></body></html>
'@

$readyFile = "$SignalFile.ready"
Set-Content -LiteralPath $loadingHtmlPath -Value $html -NoNewline -Encoding utf8
$edgeArguments = @(
    "--user-data-dir=$edgeProfile",
    "--app=file:///$($loadingHtmlPath -replace '\\','/')",
    "--no-first-run",
    "--disable-features=msEdgeSidebarV2"
)
$edgeProcess = Start-Process -FilePath $edgePath -ArgumentList $edgeArguments -PassThru
Set-Content -LiteralPath $readyFile -Value "shown" -NoNewline -Encoding ascii
$state = ""
try {
    while ($state -ne "ready") {
        if (Test-Path -LiteralPath $SignalFile) {
            $state = (Get-Content -LiteralPath $SignalFile -Raw -ErrorAction SilentlyContinue).Trim()
            Remove-Item -LiteralPath $SignalFile -Force -ErrorAction SilentlyContinue
            if ($state -eq "fail") {
                Start-Sleep -Milliseconds 1500
                $state = ""
            }
        }
        Start-Sleep -Milliseconds 150
    }
    Start-Sleep -Milliseconds 1800
} finally {
    $edgeInstances = Get-CimInstance Win32_Process -Filter "name = 'msedge.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*$edgeProfile*" }
    foreach ($instance in $edgeInstances) {
        Stop-Process -Id $instance.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $SignalFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $readyFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $loadingHtmlPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $edgeProfile -Recurse -Force -ErrorAction SilentlyContinue
}
