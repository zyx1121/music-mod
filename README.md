# music-mod

> `/music` for Claude Code: what Music.app is playing, in a pane beside the transcript, live.

`claude-code` · `mod` · `function-hooks` · `macos` · `music`

[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-mod-d97757)](https://github.com/zyx1121/music-mod) &nbsp;[![CI](https://github.com/zyx1121/music-mod/actions/workflows/ci.yml/badge.svg)](https://github.com/zyx1121/music-mod/actions/workflows/ci.yml) &nbsp;[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](#license)

```
│ Espresso                                                             ✕
│ Sabrina Carpenter · Espresso - Single
│ ▶ ██████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 1:24 / 2:55
│ vol 53 · sys 44 (muted) · Favourite Songs 402/411
│ next Sticky · KISS OF LIFE
│ ⏮ ⏯ ⏭
```
<sub>The pane docked beside a fullscreen transcript on a 160-column terminal. It redraws every two seconds while open; the three controls are clickable.</sub>

Long sessions have a soundtrack, and reaching for Music.app to check what is on breaks the flow. This mod keeps the answer one command away, inside the terminal you are already looking at: the track, where it is, how loud, what comes next, and a way to skip it.

It is a Claude Code **mod**: a plugin whose behaviour lives in a TypeScript hooks module, written against the same engine API as the built-in `/diff` pane. No shell hooks, no MCP server, one `osascript` call per refresh.

## Install

Function hooks are early access, so the engine loads a mod only with the flag on. Put it in your shell profile:

```
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
```

Then install it as a plugin, from GitHub or from a local clone:

```
/plugin marketplace add zyx1121/music-mod
/plugin install music-mod@music-mod
```

Or try it for one session without installing:

```
claude --plugin-dir /path/to/music-mod
```

In the session:

```
/music        toggle the pane
```

macOS only: it reads Music.app through Apple events. The first read may ask you to allow your terminal to control Music.

## What it shows

| Line | Content |
|------|---------|
| 1 | Track name |
| 2 | Artist · album |
| 3 | Player state, a progress bar sized to the pane, position / duration |
| 4 | Music volume · system volume (muted or not) · shuffle and repeat when on · playlist and position in it |
| 5 | The track up next in the current playlist, or `end of playlist` |
| 6 | `⏮ ⏯ ⏭`: previous track, play/pause, next track. Click one, or focus the pane and press `h`, `k`, `l`. The pane re-reads right after. |

When Music.app is closed or stopped the pane says so instead. When `osascript` fails (not authorized, timed out), the pane shows the reason and keeps polling.

## Configuration

| Field | Type | Default | What it does |
|-------|------|---------|--------------|
| `refreshMs` | number | `2000` | Milliseconds between reads while the pane is open. Floored at 500. |

Set it as any plugin `userConfig` field: `/config`, or `music-mod.refreshMs` in settings.

## How it is built

- `hooks/register.ts` exports `register(on, options)`. It registers `/music` on `session.start`, toggles the pane on `command.run`, reads Music.app on a `$.clock.every` timer while the pane is open, cancels it on `ui.close` and `session.end`, and runs a control's AppleScript when its `Button` is pressed.
- `hooks/now-playing.ts` holds the JXA script `osascript -l JavaScript` runs, the parser that turns its JSON into a `Model`, the clock and progress-bar formatters, and the one-line AppleScript behind each control.
- `hooks/views/pane-view.tsx` draws the `Model` with the engine's `Box`, `Text` and `Button` on `ui.render`.
- `types/claude-code.d.ts` is the engine contract this mod is typed against, copied from [`anthropics/claude-code/mods/types`](https://github.com/anthropics/claude-code/tree/main/mods/types).

```
bunx -p typescript tsc -p tsconfig.json          # typecheck
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .   # 16 tests, the engine's own harness
```

The API these mods are written against may change between releases without notice. When it does, refresh `types/claude-code.d.ts` from upstream and let the typecheck point at what moved.

## Contributing

Issues and PRs are welcome. Ground rules live in [CONTRIBUTING.md](https://github.com/zyx1121/.github/blob/main/CONTRIBUTING.md).

## License

[MIT](LICENSE) · now playing: whatever you left on
