# ============================================================
# 上理日历 · 每日自动更新计划任务安装脚本
# 请右键“以管理员身份运行”（或右键→使用 PowerShell 运行）。
# 安装后每天 09:00 自动抓取官网/教务处/体育部/公众号新事件。
# 卸载：在管理员 PowerShell 中执行
#   Unregister-ScheduledTask -TaskName '上理日历每日更新'
# ============================================================

$ErrorActionPreference = 'Stop'

$candidates = @(
  (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'),
  'C:\Program Files\nodejs\node.exe'
)
$node = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $node) { throw '未找到 node.exe，请先安装 Node.js' }

$script = Join-Path $PSScriptRoot 'update-events.js'
if (-not (Test-Path $script)) { throw '未找到 update-events.js' }

$action = New-ScheduledTaskAction -Execute $node -Argument ('"{0}"' -f $script)
$trigger = New-ScheduledTaskTrigger -Daily -At 09:00
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName '上理日历每日更新' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host '已安装每日更新任务：每天 09:00 自动抓取新事件。' -ForegroundColor Green
