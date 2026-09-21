# music-mod

A Claude Code mod (function-hooks plugin): `hooks/register.ts` exports `register(on, options)`; `/music` toggles a pane drawn by `hooks/views/pane-view.tsx` from what `hooks/now-playing.ts` reads out of Music.app through `osascript -l JavaScript`.

- Typecheck: `bunx -p typescript tsc -p tsconfig.json` (no node_modules; `types/claude-code.d.ts` is the engine contract, copied from `anthropics/claude-code/mods/types`).
- Tests: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .` (tests in `tests/`, named for the hooks file they cover).
- Run from source: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .` then `/music`.
- Function hooks are early access; when the engine's contract changes, refresh `types/claude-code.d.ts` from upstream and re-run both.
- GitHub-facing text is English. No em dashes.
