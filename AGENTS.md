# music-mod

Claude Code mod (a function-hooks plugin). `hooks/register.tsx` exports `register(on, options)`. `/music` toggles a line in the `AbovePrompt` band. `hooks/views/band-view.tsx` draws it from what `hooks/now-playing.ts` reads from Music.app with `osascript -l JavaScript`. Read [README.md](README.md) first.

## Rules

- A read must never launch Music.app. Send read events to the running process by its ID, and treat a missing process as closed. Only a button click calls Music.app by name.
- Ask Music.app only for what the line shows. Do not read the system volume, because that wakes `coreaudiod`.
- All sessions share one read through `hooks/shared-read.ts`. Do not add a read per session.
- `types/claude-code.d.ts` is the engine contract from `anthropics/claude-code/mods/types`. Copy it, do not edit it.
- Repository documents and code comments are English. No em dashes.

## Verify

```sh
bunx -p typescript tsc -p tsconfig.json
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .
```

No node_modules. Each test file in `tests/` has the name of the hooks file that it covers. To run from source, use `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .`, then play a song.
