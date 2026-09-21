import type { Args, CommandRunInput, On, RenderInput, ResultOf, SessionStartInput } from 'claude-code'
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

/** The Music pane docked, 60 body columns, 7 rows. */
export const PANE: RenderInput<'Pane'> = {
  component: 'Pane',
  surface: 'terminal',
  requestId: 'music',
  viewport: { columns: 160, rows: 40 },
  props: {
    title: 'Music',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 7 },
    view: {},
  },
}

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
 * An open the surface left waiting undrawn, as the engine leaves an unasked
 * open on a narrow terminal.
 */
export const LEFT_WAITING: ResultOf['ui.open'] = {
  value: { isPlaced: false, reason: 'unasked below 144 columns' } as never,
}

/**
 * The world beneath the mod: a session that starts, a command that
 * registers, osascript answering `stdout`, panes kept as opened and closed.
 *
 * @param on the test's `on`
 * @param stdout what each osascript run prints (mutable through `answers`)
 * @param isLeftWaiting whether an open is left waiting undrawn
 * @returns what was kept, and the clock
 */
export function world(on: On, stdout = PLAYING, isLeftWaiting = false) {
  const runs: Args<'process.run'>[] = []
  const opened: Args<'ui.open'>[] = []
  const closed: Args<'ui.close'>[] = []
  const invalidated: string[] = []
  const answers = { stdout, exitCode: 0, stderr: '' }

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('process.run', ($, e) => {
    runs.push(e)

    return { value: { exitCode: answers.exitCode, stdout: answers.stdout, stderr: answers.stderr } }
  })
  on('ui.open', ($, e) => {
    opened.push(e)

    return isLeftWaiting ? LEFT_WAITING : { value: undefined }
  })
  on('ui.close', ($, e) => {
    closed.push(e)

    return { value: undefined }
  })
  on('ui.invalidate', ($, e) => {
    invalidated.push(e.event)

    return { value: undefined }
  })

  const clock = mock.clock(on)

  return { runs, opened, closed, invalidated, answers, clock }
}

/**
 * A rendered tree's text, its strings in order.
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
  const label: unknown = typeof props === 'object' && props ? Reflect.get(props, 'label') : undefined

  return `${typeof label === 'string' ? label : ''}${textOf(Reflect.get(tree, 'children') ?? [])}`
}
