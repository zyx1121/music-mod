<!-- 翻译自 README.md @ docs/readme-template-v2。只翻 "For AI agents" 以上的章节，英文版更新时一起改。 -->

<div align="center">

<h1>music-mod</h1>

<p><strong>Music.app 正在播放的歌，实时显示在 Claude Code 输入框上方的一行，附播放、暂停与下一首。</strong></p>

[![CI](https://img.shields.io/github/actions/workflow/status/zyx1121/music-mod/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/zyx1121/music-mod/actions)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-mod-d97757?style=flat-square)](https://github.com/anthropics/claude-code/tree/main/mods)
[![macOS](https://img.shields.io/badge/macOS-only-000000?style=flat-square&logo=apple)](hooks)
[![License](https://img.shields.io/github/license/zyx1121/music-mod?style=flat-square)](LICENSE)

[English](README.md) | [繁體中文](README.zh-TW.md) | **简体中文**

</div>

```
╭─ MUSIC ──────────────────────────────────────────────────╮
│ ▶ Tipsy  WANUKA / Greenhorn ━━━━━━━━━━━━──────── 2:43 / 3:39 ⏭ │
╰──────────────────────────────────────────────────────────╯
```

长时间的 session 总有配乐，切到 Music.app 看歌名会打断专注。music-mod 把歌名、进度与 2 个按钮放进你本来就在看的终端。

## 功能

- **输入框上方一个面板**：状态、歌名、进度条与时间，外框标题是 MUSIC。它和 today-mod、hum 的面板排成同一行，全屏与 inline 布局都能用。
- **按钮**：点状态图标播放或暂停，点 `⏭` 下一首。
- **不会打开 Music.app**：读取按 process ID 发给正在运行的程序。只有点按钮时才按名称调用 Music.app。
- **所有 session 共用一次读取**：不论开几个 session，每 5 秒只调用一次 `osascript`。时钟每秒更新。

## 快速开始

function hooks 仍在抢先体验。在 shell profile 开启：

```sh
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
```

再到 Claude Code 安装：

```
/plugin marketplace add zyx1121/music-mod
/plugin install music-mod@music-mod
```

开新 session 并播放一首歌，输入框上方就会出现这一行。首次读取时，macOS 可能会询问是否允许终端控制「音乐」。

## 使用方式

`/music` 隐藏或重新显示这一行。你的选择会跨 session 记住。

| 部分 | 显示 |
|------|------|
| `▶` `⏸` `»` `«` | 播放状态。点一下播放或暂停 |
| 标题 | 歌名、歌手与专辑，布局窄时以省略号截断 |
| 进度条 | 用标题剩下的宽度显示进度(至少 6 格)，后接当前位置与总长 |
| `⏭` | 点一下跳到下一首 |

Music.app 没有运行或已停止时，这一行会说明。`osascript` 失败时，这一行显示原因，mod 会再试。

## 配置

| 设置 | 默认 | 作用 |
|------|------|------|
| `refreshMs` | `5000` | 两次读取 Music.app 的间隔，至少 1000 |
| `showOnStart` | `true` | session 开始时显示这一行。用过 `/music` 后以它为准 |

用 `/config` 设置，或在 settings 里设 `music-mod.refreshMs`。

## 工作原理

- `hooks/register.tsx` 在 `session.start` 注册 `/music` 并启动每秒一次的 tick。tick 用上次读取的结果画时钟，超过 `refreshMs` 就重新读取。
- `hooks/now-playing.ts` 存放给 `osascript -l JavaScript` 的 JXA 脚本与解析器。脚本只问这一行要显示的数据。它不读系统音量，因为那会唤醒 `coreaudiod`。
- `hooks/shared-read.ts` 把共用的读取结果存在 `$TMPDIR/music-mod/now.json`。一个 session 在读取时，其他 session 等它的结果。
- `hooks/views/band-view.tsx` 用 `Box`、`Text` 与 `Button` 在 `AbovePrompt` 区画出这一行。

## 限制

- 只支持 macOS。mod 通过 Apple events 读取 Music.app。
- function hooks 仍在抢先体验，引擎更新可能改变接口。

## 其他

给 AI agent 的结构化信息与开发说明在[英文版](README.md#for-ai-agents)。

## 许可证

[MIT](LICENSE)
