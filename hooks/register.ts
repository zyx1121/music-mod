import type { On, PluginOptions, Timer } from 'claude-code'

import { ARGV, controlArgvOf, modelOf, READ_TIMEOUT_MS, type Control, type Model } from './now-playing'
import { paneView } from './views/pane-view'

export const PANE_ID = 'music'
export const PANE_TITLE = 'Music'
export const COMMAND_NAME = 'music'
export const DEFAULT_REFRESH_MS = 2000
export const MIN_REFRESH_MS = 500
export const PANE_ROWS = 7

export const SHOWN_TEXT = 'Music pane shown'
export const HIDDEN_TEXT = 'Music pane hidden'
export const TOO_NARROW_TEXT = 'Music pane needs a wider terminal'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * The Music pane: /music toggles it, a timer re-reads Music.app while it is
 * open, and the pane's render hook draws the last reading.
 *
 * @param on the engine's hook registrar
 * @param options the plugin's userConfig values
 */
export function register(on: On, options: PluginOptions): void {
  const refreshMs = refreshMsOf(options)

  let model: Model = { kind: 'idle' }
  let timer: Timer | null = null
  let isOpen = false
  let isReading = false
  let host: Host | null = null

  type Host = {
    run: (argv: readonly string[], init: { timeoutMs: number }) => Promise<{ exitCode: number; stdout: string; stderr: string }>
    invalidate: () => void
    every: (ms: number, fn: () => void) => Timer
    open: (pane: { id: string; title: string; rows: number; holdToasts: true }) => Promise<unknown>
    close: (pane: { id: string }) => Promise<unknown>
  }

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
    previous: () => void control('previous'),
    playpause: () => void control('playpause'),
    next: () => void control('next'),
  }

  function stop(): void {
    timer?.cancel()
    timer = null
    isOpen = false
  }

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: COMMAND_NAME,
        description: "What Music.app is playing, in a pane beside the transcript",
      })
    } catch (error) {
      $.ui.log(`/${COMMAND_NAME} did not register: ${error instanceof Error ? error.message : String(error)}`)
    }

    return next(e)
  })

  on('command.run', { command: COMMAND_NAME }, async ($) => {
    const engine: Host = {
      run: (argv, init) => $.process.run(argv, init),
      invalidate: () => $.ui.invalidate('ui.render'),
      every: (ms, fn) => $.clock.every(ms, fn),
      open: pane => $.ui.open(pane),
      close: pane => $.ui.close(pane),
    }

    host = engine

    if (isOpen) {
      stop()
      await engine.close({ id: PANE_ID }).catch(() => undefined)

      return { text: HIDDEN_TEXT }
    }

    await read(engine)

    const opened = await engine.open({ id: PANE_ID, title: PANE_TITLE, rows: PANE_ROWS, holdToasts: true })

    if (isRecord(opened) && opened.isPlaced === false) {
      await engine.close({ id: PANE_ID }).catch(() => undefined)

      return { text: TOO_NARROW_TEXT }
    }

    isOpen = true
    timer?.cancel()
    timer = engine.every(refreshMs, () => {
      void read(engine)
    })

    return { text: SHOWN_TEXT }
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) {
      return next(e)
    }

    const { Box, Text, Button } = $.ui.resolve(e)

    return paneView({ Box, Text, Button }, model, e.props.bodyColumns, actions)
  })

  on('ui.close', { id: PANE_ID }, ($, e, next) => {
    stop()

    return next(e)
  })

  on('session.end', ($, e, next) => {
    stop()

    return next(e)
  })
}
