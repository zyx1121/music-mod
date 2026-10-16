<!-- 翻譯自 README.md @ docs/readme-template-v2。只翻 "For AI agents" 以上的章節，英文版更新時一起改。 -->

<div align="center">

<h1>music-mod</h1>

<p><strong>Music.app 正在播的歌，即時顯示在 Claude Code 輸入框上方的一行，附播放、暫停與下一首。</strong></p>

[![CI](https://img.shields.io/github/actions/workflow/status/zyx1121/music-mod/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/zyx1121/music-mod/actions)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-mod-d97757?style=flat-square)](https://github.com/anthropics/claude-code/tree/main/mods)
[![macOS](https://img.shields.io/badge/macOS-only-000000?style=flat-square&logo=apple)](hooks)
[![License](https://img.shields.io/github/license/zyx1121/music-mod?style=flat-square)](LICENSE)

[English](README.md) | **繁體中文** | [简体中文](README.zh-CN.md)

</div>

```
╭─ MUSIC ──────────────────────────────────────────────────╮
│ ▶ Tipsy  WANUKA / Greenhorn ━━━━━━━━━━━━──────── 2:43 / 3:39 ⏭ │
╰──────────────────────────────────────────────────────────╯
```

長時間的 session 總有配樂，切到 Music.app 看歌名會打斷專注。music-mod 把歌名、進度與 2 個按鈕放進你本來就在看的終端機。

## 功能

- **輸入框上方一個面板**：狀態、歌名、進度條與時間，外框標題是 MUSIC。它和 today-mod、hum 的面板排成同一列，全螢幕與 inline 版面都能用。
- **按鈕**：點狀態圖示播放或暫停，點 `⏭` 下一首。
- **不會開啟 Music.app**：讀取依 process ID 送給正在執行的程式。只有點按鈕時才以名稱呼叫 Music.app。
- **所有 session 共用一次讀取**：不論開幾個 session，每 5 秒只呼叫一次 `osascript`。時鐘每秒更新。

## 快速開始

function hooks 仍在搶先體驗。在 shell profile 開啟：

```sh
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
```

再到 Claude Code 安裝：

```
/plugin marketplace add zyx1121/music-mod
/plugin install music-mod@music-mod
```

開新 session 並播一首歌，輸入框上方就會出現這一行。第一次讀取時，macOS 可能會詢問是否讓終端機控制「音樂」。

## 使用方式

`/music` 隱藏或重新顯示這一行。你的選擇會跨 session 記住。

| 部分 | 顯示 |
|------|------|
| `▶` `⏸` `»` `«` | 播放狀態。點一下播放或暫停 |
| 標題 | 歌名、歌手與專輯，版面窄時以省略號截斷 |
| 進度條 | 用標題剩下的寬度顯示進度(至少 6 格)，後接目前位置與總長 |
| `⏭` | 點一下跳到下一首 |

Music.app 沒在執行或已停止時，這一行會說明。`osascript` 失敗時，這一行顯示原因，mod 會再試。

## 設定

| 設定 | 預設 | 作用 |
|------|------|------|
| `refreshMs` | `5000` | 兩次讀取 Music.app 的間隔，至少 1000 |
| `showOnStart` | `true` | session 開始時顯示這一行。用過 `/music` 後以它為準 |

用 `/config` 設定，或在 settings 裡設 `music-mod.refreshMs`。

## 運作方式

- `hooks/register.tsx` 在 `session.start` 註冊 `/music` 並啟動每秒一次的 tick。tick 用上次讀取的結果畫時鐘，超過 `refreshMs` 就重新讀取。
- `hooks/now-playing.ts` 存放給 `osascript -l JavaScript` 的 JXA 腳本與解析器。腳本只問這一行要顯示的資料。它不讀系統音量，因為那會喚醒 `coreaudiod`。
- `hooks/shared-read.ts` 把共用的讀取結果存在 `$TMPDIR/music-mod/now.json`。一個 session 在讀取時，其他 session 等它的結果。
- `hooks/views/band-view.tsx` 用 `Box`、`Text` 與 `Button` 在 `AbovePrompt` 區畫出這一行。

## 限制

- 只支援 macOS。mod 透過 Apple events 讀取 Music.app。
- function hooks 仍在搶先體驗，引擎更新可能改變介面。

## 其他

給 AI agent 的結構化資訊與開發說明在[英文版](README.md#for-ai-agents)。

## 授權

[MIT](LICENSE)
