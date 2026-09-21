import type { On, PluginOptions, Timer } from 'claude-code'

import { ARGV, modelOf, READ_TIMEOUT_MS, type Model } from './now-playing'
import { bandView } from './views/band-view'

export const COMMAND_NAME = 'music'
export const DEFAULT_REFRESH_MS = 2000
export const MIN_REFRESH_MS = 500

export const SHOWN_TEXT = 'Music shown above the prompt'
export const HIDDEN_TEXT = 'Music hidden'

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
}

/**
 * The Music band: /music toggles two lines above the prompt, a timer
 * re-reads Music.app while they show, and the band's render hook draws the
 * last reading.
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

  function stop(): void {
    timer?.cancel()
    timer = null
    isShown = false
  }

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: COMMAND_NAME,
        description: 'What Music.app is playing, two lines above the prompt',
      })
    } catch (error) {
      $.ui.log(
        `/${COMMAND_NAME} did not register: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    return next(e)
  })

  on('command.run', { command: COMMAND_NAME }, async $ => {
    const host: Host = {
      run: (argv, init) => $.process.run(argv, init),
      invalidate: () => $.ui.invalidate('ui.render'),
      every: (ms, fn) => $.clock.every(ms, fn),
    }

    if (isShown) {
      stop()
      host.invalidate()

      return { text: HIDDEN_TEXT }
    }

    isShown = true
    model = { kind: 'idle' }
    await read(host)

    timer?.cancel()
    timer = host.every(refreshMs, () => {
      void read(host)
    })

    return { text: SHOWN_TEXT }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!isShown || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return bandView({ Box, Text }, model, e.props.bodyColumns)
  })

  on('session.end', ($, e, next) => {
    stop()

    return next(e)
  })
}
