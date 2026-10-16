<div align="center">

<h1>music-mod</h1>

<p><strong>What Music.app plays, live in one line above the Claude Code prompt, with play, pause and next.</strong></p>

[![CI](https://img.shields.io/github/actions/workflow/status/zyx1121/music-mod/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/zyx1121/music-mod/actions)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-mod-d97757?style=flat-square)](https://github.com/anthropics/claude-code/tree/main/mods)
[![macOS](https://img.shields.io/badge/macOS-only-000000?style=flat-square&logo=apple)](hooks)
[![License](https://img.shields.io/github/license/zyx1121/music-mod?style=flat-square)](LICENSE)

**English** | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

</div>

```
╭─ MUSIC ──────────────────────────────────────────────────╮
│ ▶ Tipsy  WANUKA / Greenhorn ━━━━━━━━━━━━──────── 2:43 / 3:39 ⏭ │
╰──────────────────────────────────────────────────────────╯
```

Long sessions have a soundtrack, and a switch to Music.app to see the track breaks your focus. music-mod puts the track, its progress and 2 buttons in the terminal that you already look at.

## Features

- **One panel above the prompt**: the state, the track, a progress bar and the time, in a round border titled MUSIC. It sits in one row with the today-mod and hum panels, and works in fullscreen and inline layouts.
- **Buttons**: click the state glyph to play or pause, and `⏭` for the next track.
- **Never opens Music.app**: a read goes to the running process by its ID. Only a click calls Music.app by name.
- **One read for all sessions**: one `osascript` call every 5 seconds, for any number of open sessions. The clock updates every second.

## Quick start

Function hooks are in early access. Turn them on in your shell profile:

```sh
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
```

Then install the mod in Claude Code:

```
/plugin marketplace add zyx1121/music-mod
/plugin install music-mod@music-mod
```

Start a new session and play a song. The line appears above the prompt. On the first read, macOS can ask you to let your terminal control Music.

## Usage

`/music` hides the line or shows it again. The mod remembers your choice between sessions.

| Part | Shows |
|------|-------|
| `▶` `⏸` `»` `«` | The player state. Click to play or pause |
| Title | Track, artist and album, cut with an ellipsis when the line is narrow |
| Bar | Progress in the width that the title leaves (6 cells at least), then position and duration |
| `⏭` | Click for the next track |

When Music.app is not running or has stopped, the line says so. When `osascript` fails, the line shows the reason and the mod tries again.

## Configuration

| Setting | Default | Does |
|---------|---------|------|
| `refreshMs` | `5000` | time between reads of Music.app, 1000 at least |
| `showOnStart` | `true` | show the line when a session starts. `/music` wins after first use |

Set them with `/config`, or as `music-mod.refreshMs` in settings.

## How it works

- `hooks/register.tsx` registers `/music` on `session.start` and starts a 1-second tick. The tick draws the clock from the last read and reads again after `refreshMs`.
- `hooks/now-playing.ts` holds the JXA script for `osascript -l JavaScript` and the parser. The script asks only for what the line shows. It does not read the system volume, because that wakes `coreaudiod`.
- `hooks/shared-read.ts` keeps the shared read in `$TMPDIR/music-mod/now.json`. While one session reads, the others wait for its result.
- `hooks/views/band-view.tsx` draws the line with `Box`, `Text` and `Button` in the `AbovePrompt` band.

## Limits

- macOS only. The mod reads Music.app through Apple events.
- Function hooks are in early access, so an engine update can change the contract.

## For AI agents

Facts for coding agents and LLM tools. The rules for changing the code are in [AGENTS.md](AGENTS.md).

- **Summary**: Claude Code function-hooks mod that shows the Music.app track, progress and play, pause and next buttons in one line above the prompt.
- **Type**: plugin
- **Interfaces**: slash command `/music` (toggle), `AbovePrompt` UI line with buttons
- **Install**: `/plugin marketplace add zyx1121/music-mod`, then `/plugin install music-mod@music-mod`
- **Run**: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .`
- **Verify**: `bunx -p typescript tsc -p tsconfig.json && CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .`
- **Config**: plugin options `refreshMs`, `showOnStart`
- **Secrets**: none
- **Limits**: macOS. The terminal needs permission to control Music.

## Development

```sh
bunx -p typescript tsc -p tsconfig.json                    # typecheck
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .   # the engine's test harness
```

`types/claude-code.d.ts` is the engine contract from [anthropics/claude-code/mods/types](https://github.com/anthropics/claude-code/tree/main/mods/types). When the engine changes, copy the new version and let the typecheck show what moved.

## License

[MIT](LICENSE)
