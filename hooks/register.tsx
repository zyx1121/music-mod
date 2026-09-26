/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { EngineInterface, On, PluginOptions, Timer } from 'claude-code'

import { ARGV, controlArgvOf, hasEnded, modelAt, modelOf, READ_TIMEOUT_MS, type Control, type Model } from './now-playing'
import { cachePathOf, entryOf, isFresh, type Entry } from './shared-read'
import { bandView } from './views/band-view'

export const COMMAND_NAME = 'music'
export const DEFAULT_REFRESH_MS = 5000
export const MIN_REFRESH_MS = 1000

/** How often the band redraws its clock while playing; no read happens on a tick. */
export const TICK_MS = 1000

/** At a track's end, a reading this recent (another session's) is still taken. */
export const END_MAX_AGE_MS = 1000

export const SHOWN_TEXT = 'Music shown above the prompt'
export const HIDDEN_TEXT = 'Music hidden'

/** The store key under which the last /music choice is kept between sessions. */
export const STORE_SHOWN_KEY = 'shown'

/**
 * The refresh interval the options ask for, floored at MIN_REFRESH_MS.
 *
 * @param options the plugin's userConfig values
 * @returns milliseconds between reads
 */
export function refreshMsOf(options: PluginOptions): number {
  const value = options.refreshMs

  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(MIN_REFRESH_MS, Math.floor(value))
    : DEFAULT_REFRESH_MS
}

type Host = {
  run: (
    argv: readonly string[],
    init: { timeoutMs: number },
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  invalidate: () => void
  every: (ms: number, fn: () => void) => Timer
  now: () => Promise<number>
  readShared: () => Promise<Entry | null>
  writeShared: (entry: Entry) => Promise<void>
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
}

/**
 * Whether the band shows at a session's start: the last /music choice the
 * store kept, else the `showOnStart` option (true unless set false).
 *
 * @param kept what the store holds under STORE_SHOWN_KEY
 * @param options the plugin's userConfig values
 * @returns whether to show
 */
export function isShownAtStart(kept: unknown, options: PluginOptions): boolean {
  if (typeof kept === 'boolean') {
    return kept
  }

  return options.showOnStart !== false
}

/**
 * The engine calls the band needs, taken off `$`. The shared reading lives
 * under `TMPDIR`; a file the engine cannot read or write counts as absent.
 *
 * @param $ the engine
 * @returns the host
 */
async function hostOf($: EngineInterface): Promise<Host> {
  const path = cachePathOf(await $.env.get('TMPDIR').catch(() => undefined))

  return {
    run: (argv, init) => $.process.run(argv, init),
    invalidate: () => $.ui.invalidate('ui.render'),
    every: (ms, fn) => $.clock.every(ms, fn),
    now: () => $.clock.now(),
    readShared: () =>
      $.fs.read(path).then(
        text => (typeof text === 'string' ? entryOf(text) : null),
        () => null,
      ),
    writeShared: entry => $.fs.write(path, JSON.stringify(entry)).catch(() => undefined),
    storeGet: key => $.store.get(key),
    storeSet: (key, value) => $.store.set(key, value),
  }
}

/**
 * The Music band: one line above the prompt, shown from the session's start
 * (the last /music choice, else `showOnStart`) and toggled by /music. While
 * it shows, a one-second tick redraws the clock from the last reading and,
 * once `refreshMs` has passed, takes a new one: another session's from the
 * shared file when it is recent enough, else its own from osascript. A press
 * on a glyph sends its control and reads at once.
 *
 * @param on the engine's hook registrar
 * @param options the plugin's userConfig values
 */
export function register(on: On, options: PluginOptions): void {
  const refreshMs = refreshMsOf(options)

  let model: Model = { kind: 'idle' }
  let timer: Timer | null = null
  let isShown = false
  let isReading = false
  let checkedAt = 0
  let host: Host | null = null

  /**
   * Takes a reading no older than `maxAgeMs`: the shared one when it is,
   * else a new osascript run, claimed in the shared file first so the other
   * sessions wait for it instead of running their own.
   */
  async function read(host: Host, maxAgeMs: number): Promise<void> {
    if (isReading) {
      return
    }

    isReading = true

    try {
      const at = await host.now()
      const shared = await host.readShared()

      if (isFresh(shared, at, maxAgeMs)) {
        if (!shared.run) {
          // another session's read is under way: look again on the next tick
          checkedAt = Number.NEGATIVE_INFINITY

          return
        }

        checkedAt = at

        if (model.kind !== 'ok' || model.readAt !== shared.readAt) {
          model = modelOf(shared.run, shared.readAt)
        }

        return
      }

      checkedAt = at

      await host.writeShared({ readAt: at, run: null })

      const run = await host.run(ARGV, { timeoutMs: READ_TIMEOUT_MS })
      const readAt = await host.now()

      model = modelOf(run, readAt)
      await host.writeShared({ readAt, run })
    } catch (error) {
      model = { kind: 'error', text: error instanceof Error ? error.message : String(error) }
    } finally {
      isReading = false
      host.invalidate()
    }
  }

  async function tick(host: Host): Promise<void> {
    const at = await host.now().catch(() => null)

    if (at === null) {
      return
    }

    // a reading that already stood at the end (the track outruns its
    // metadata) waits for the usual refresh instead of re-reading each tick
    const isEndDue = hasEnded(model, at) && model.kind === 'ok' && !hasEnded(model, model.readAt)

    if (isEndDue) {
      await read(host, END_MAX_AGE_MS)
    } else if (at < checkedAt || at - checkedAt >= refreshMs) {
      await read(host, refreshMs)
    } else if (model.kind === 'ok' && model.now.state === 'playing') {
      host.invalidate()
    }
  }

  async function control(which: Control): Promise<void> {
    if (!host) {
      return
    }

    const run = await host.run(controlArgvOf(which), { timeoutMs: READ_TIMEOUT_MS }).catch(() => null)

    if (run && run.exitCode !== 0) {
      model = { kind: 'error', text: `osascript exited ${run.exitCode}: ${run.stderr.trim()}` }
      host.invalidate()

      return
    }

    await read(host, 0)
  }

  const actions = {
    playpause: () => void control('playpause'),
    next: () => void control('next'),
  }

  function stop(): void {
    timer?.cancel()
    timer = null
    isShown = false
  }

  async function show(engine: Host): Promise<void> {
    host = engine
    isShown = true
    model = { kind: 'idle' }
    await read(engine, refreshMs)

    timer?.cancel()
    timer = engine.every(TICK_MS, () => {
      void tick(engine)
    })
  }

  function hide(engine: Host): void {
    stop()
    engine.invalidate()
  }

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: COMMAND_NAME,
        description: 'What Music.app is playing, one line above the prompt',
      })
    } catch (error) {
      $.ui.log(
        `/${COMMAND_NAME} did not register: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    if (e.isInteractive && e.surface === 'terminal') {
      const engine = await hostOf($)
      const kept = await engine.storeGet(STORE_SHOWN_KEY).catch(() => undefined)

      if (isShownAtStart(kept, options)) {
        await show(engine)
      }
    }

    return next(e)
  })

  on('command.run', { command: COMMAND_NAME }, async $ => {
    const engine = await hostOf($)
    const isHiding = isShown

    if (isHiding) {
      hide(engine)
    } else {
      await show(engine)
    }

    await engine.storeSet(STORE_SHOWN_KEY, !isHiding).catch(() => undefined)

    return { text: isHiding ? HIDDEN_TEXT : SHOWN_TEXT }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!isShown || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Text, Button } = $.ui.resolve(e)
    const at = await $.clock.now()
    const beneath = await next(e)

    return (
      <Box flexDirection="column">
        {bandView({ Box, Text, Button }, modelAt(model, at), e.props.bodyColumns, actions)}
        {beneath}
      </Box>
    )
  })

  on('session.end', ($, e, next) => {
    stop()

    return next(e)
  })
}
