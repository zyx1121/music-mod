# music-mod

> `/music` for Claude Code: what Music.app is playing, in two lines above the prompt, live.

`claude-code` · `mod` · `function-hooks` · `macos` · `music` · `now-playing`

[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-mod-d97757)](https://github.com/zyx1121/music-mod) &nbsp;[![CI](https://github.com/zyx1121/music-mod/actions/workflows/ci.yml/badge.svg)](https://github.com/zyx1121/music-mod/actions/workflows/ci.yml) &nbsp;[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](#license)

```
🎶 Tipsy · WANUKA · Greenhorn  📃 399/411
▶ 2:43 ████████████████░░░░░░░░ 3:39  🔉 53  ⏭ DANCE DANCE DADA (feat. EMA & たなか) · MAISONdes
```
<sub>The band directly above the prompt, in any layout. It redraws every two seconds while shown.</sub>

Long sessions have a soundtrack, and reaching for Music.app to check what is on breaks the flow. This mod keeps the answer one command away, inside the terminal you are already looking at: the track, where it is, how loud, and what comes next.

It is a Claude Code **mod**: a plugin whose behaviour lives in a TypeScript hooks module, written against the same engine API as the built-in `/diff` pane. It draws into the `AbovePrompt` band, so it sits above the input whether the transcript is fullscreen or inline, and never takes a side dock. No shell hooks, no MCP server, one `osascript` call per refresh.

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
/music        toggle the two lines
```

macOS only: it reads Music.app through Apple events. The first read may ask you to allow your terminal to control Music.

## What it shows

| Line | Content |
|------|---------|
| 1 | `🎶` playing or `🎵` paused, track · artist · album, then `📃 index/count` in the current playlist, `🔀` when shuffling, `🔁` or `🔂` when repeating |
| 2 | `▶` `⏸` `⏩` `⏪` player state, position, a progress bar (24 cells, shrinking on a narrow band), duration, then `🔊 🔉 🔈` system volume level with the Music volume beside it (`🔇` when muted), and `⏭` the track up next or `end of playlist` |

When Music.app is closed or stopped the band says so in one line instead. When `osascript` fails (not authorized, timed out), the band shows the reason and keeps polling. A survey that takes the band is yielded to.

## Configuration

| Field | Type | Default | What it does |
|-------|------|---------|--------------|
| `refreshMs` | number | `2000` | Milliseconds between reads while the band is shown. Floored at 500. |

Set it as any plugin `userConfig` field: `/config`, or `music-mod.refreshMs` in settings.

## How it is built

- `hooks/register.ts` exports `register(on, options)`. It registers `/music` on `session.start`, toggles the band on `command.run`, reads Music.app on a `$.clock.every` timer while shown, and cancels it on `session.end`.
- `hooks/now-playing.ts` holds the JXA script `osascript -l JavaScript` runs, the parser that turns its JSON into a `Model`, and the clock and progress-bar formatters.
- `hooks/views/band-view.tsx` draws the `Model` with the engine's `Box` and `Text` on `ui.render` for the `AbovePrompt` component.
- `types/claude-code.d.ts` is the engine contract this mod is typed against, copied from [`anthropics/claude-code/mods/types`](https://github.com/anthropics/claude-code/tree/main/mods/types).

```
bunx -p typescript tsc -p tsconfig.json          # typecheck
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .   # 13 tests, the engine's own harness
```

The API these mods are written against may change between releases without notice. When it does, refresh `types/claude-code.d.ts` from upstream and let the typecheck point at what moved.

## Contributing

Issues and PRs are welcome. Ground rules live in [CONTRIBUTING.md](https://github.com/zyx1121/.github/blob/main/CONTRIBUTING.md).

## License

[MIT](LICENSE) · now playing: whatever you left on
