import type { EngineInterface, On, PluginOptions, Timer } from 'claude-code'

import { ARGV, controlArgvOf, modelOf, READ_TIMEOUT_MS, type Control, type Model } from './now-playing'
import { bandView } from './views/band-view'

export const COMMAND_NAME = 'music'
export const DEFAULT_REFRESH_MS = 2000
export const MIN_REFRESH_MS = 500

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
 * The engine calls the band needs, taken off `$`.
 *
 * @param $ the engine
 * @returns the host
 */
function hostOf($: EngineInterface): Host {
  return {
    run: (argv, init) => $.process.run(argv, init),
    invalidate: () => $.ui.invalidate('ui.render'),
    every: (ms, fn) => $.clock.every(ms, fn),
    storeGet: key => $.store.get(key),
    storeSet: (key, value) => $.store.set(key, value),
  }
}

/**
 * The Music band: one line above the prompt, shown from the session's start
 * (the last /music choice, else `showOnStart`) and toggled by /music; a
 * timer re-reads Music.app while it shows, the band's render hook draws the
 * last reading, and a press on a glyph sends its control.
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
  let host: Host | null = null

  async function read(host: Host): Promise<void> {
    if (isReading) {
      return
    }

    isReading = true

    try {
      const run = await host.run(ARGV, { timeoutMs: READ_TIMEOUT_MS })

      model = modelOf(run)
    } catch (error) {
      model = { kind: 'error', text: error instanceof Error ? error.message : String(error) }
    } finally {
      isReading = false
    }

    host.invalidate()
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

    await read(host)
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
    await read(engine)

    timer?.cancel()
    timer = engine.every(refreshMs, () => {
      void read(engine)
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
      const engine = hostOf($)
      const kept = await engine.storeGet(STORE_SHOWN_KEY).catch(() => undefined)

      if (isShownAtStart(kept, options)) {
        await show(engine)
      }
    }

    return next(e)
  })

  on('command.run', { command: COMMAND_NAME }, async $ => {
    const engine = hostOf($)
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

    return bandView({ Box, Text, Button }, model, e.props.bodyColumns, actions)
  })

  on('session.end', ($, e, next) => {
    stop()

    return next(e)
  })
}
