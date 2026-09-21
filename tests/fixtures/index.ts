import type { Args, CommandRunInput, On, RenderElement, RenderInput, SessionStartInput } from 'claude-code'
import { mock } from 'claude-code/testing'

/** An interactive terminal session in /work. */
export const SESSION: SessionStartInput = {
  surface: 'terminal',
  isInteractive: true,
  cwd: '/work',
}

/** The /music command as the composer sends it. */
export const MUSIC: CommandRunInput = {
  command: 'music',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 160 },
}

/** The band above the prompt, 120 body columns, no survey. */
export const BAND: RenderInput<'AbovePrompt'> = {
  component: 'AbovePrompt',
  surface: 'terminal',
  requestId: 'above-prompt',
  viewport: { columns: 120, rows: 40 },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
}

/** What the world beneath draws in the band when the mod passes. */
export const BENEATH: RenderElement = { type: 'Text', children: ['(beneath)'] }

/** What Music.app prints mid-song. */
export const PLAYING = JSON.stringify({
  state: 'playing',
  system: { volume: 44, muted: true },
  volume: 53,
  shuffle: false,
  repeat: 'off',
  track: { name: 'FOREVER', artist: 'BABYMONSTER', album: 'FOREVER - Single', duration: 213 },
  position: 197,
  playlist: { name: 'Favourite Songs', index: 409, count: 411 },
  next: { name: 'Klaxon', artist: 'i-dle' },
})

/** The same song paused, unmuted, shuffle and repeat on. */
export const PAUSED = JSON.stringify({
  ...JSON.parse(PLAYING),
  state: 'paused',
  system: { volume: 80, muted: false },
  shuffle: true,
  repeat: 'all',
})

/** What Music.app prints when it is not running. */
export const CLOSED = JSON.stringify({
  state: 'closed',
  system: { volume: 44, muted: false },
  volume: null,
  shuffle: null,
  repeat: null,
  track: null,
  position: null,
  playlist: null,
  next: null,
})

/**
 * The world beneath the mod: a session that starts, a command that
 * registers, osascript answering `stdout`, a band that draws BENEATH when
 * the mod passes.
 *
 * @param on the test's `on`
 * @param stdout what each osascript run prints (mutable through `answers`)
 * @returns what was kept, and the clock
 */
export function world(on: On, stdout = PLAYING) {
  const runs: Args<'process.run'>[] = []
  const invalidated: string[] = []
  const answers = { stdout, exitCode: 0, stderr: '' }

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('process.run', ($, e) => {
    runs.push(e)

    return { value: { exitCode: answers.exitCode, stdout: answers.stdout, stderr: answers.stderr } }
  })
  on('ui.invalidate', ($, e) => {
    invalidated.push(e.event)

    return { value: undefined }
  })
  on('ui.render', { component: 'AbovePrompt' }, () => BENEATH)

  const clock = mock.clock(on)

  return { runs, invalidated, answers, clock }
}

/**
 * A rendered tree's text: its strings and labels in order, one newline
 * between a column Box's children, one space between a row's.
 *
 * @param tree what `$.ui.render` resolved to
 * @returns the text
 */
export function textOf(tree: unknown): string {
  if (typeof tree === 'string' || typeof tree === 'number') {
    return String(tree)
  }

  if (Array.isArray(tree)) {
    return tree.map(textOf).join('')
  }

  if (typeof tree !== 'object' || !tree) {
    return ''
  }

  const props: unknown = Reflect.get(tree, 'props')
  const isColumn =
    typeof props === 'object' && props ? Reflect.get(props, 'flexDirection') === 'column' : false
  const isRow =
    typeof props === 'object' && props ? Reflect.get(props, 'flexDirection') === 'row' : false
  const label: unknown = typeof props === 'object' && props ? Reflect.get(props, 'label') : undefined
  const children: unknown = Reflect.get(tree, 'children') ?? []
  const parts = Array.isArray(children) ? children.map(textOf) : [textOf(children)]

  return `${typeof label === 'string' ? label : ''}${parts.join(isColumn ? '\n' : isRow ? ' ' : '')}`
}
