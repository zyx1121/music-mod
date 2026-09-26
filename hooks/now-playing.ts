/**
 * What Music.app reports, read with one `osascript -l JavaScript` run and
 * parsed from the JSON it prints: only what the band draws.
 */
export type NowPlaying = {
  state: 'closed' | 'stopped' | 'playing' | 'paused' | 'fast forwarding' | 'rewinding'
  track: { name: string; artist: string; album: string; duration: number } | null
  position: number | null
}

/**
 * The pane's state: nothing read yet, a reading taken at `readAt`
 * (milliseconds since the epoch), or why the read failed.
 */
export type Model =
  | { kind: 'idle' }
  | { kind: 'ok'; now: NowPlaying; readAt: number }
  | { kind: 'error'; text: string }

/**
 * The JXA script osascript runs. One IIFE whose value is the JSON text
 * (osascript prints the top-level expression's value). It asks Music.app for
 * the fewest properties the band draws: no system volume (each read of it
 * wakes coreaudiod) and no playlist walk (`tracks.length` is slow on a
 * long playlist).
 */
export const SCRIPT = `(() => {
  const out = { state: 'closed', track: null, position: null }
  const music = Application('Music')
  if (!music.running()) return JSON.stringify(out)
  out.state = music.playerState()
  if (out.state === 'stopped') return JSON.stringify(out)
  const t = music.currentTrack()
  out.track = { name: t.name(), artist: t.artist(), album: t.album(), duration: t.duration() }
  try { out.position = music.playerPosition() } catch (e) { out.position = null }
  return JSON.stringify(out)
})()`

/** The argv that reads Music.app. */
export const ARGV: readonly string[] = ['osascript', '-l', 'JavaScript', '-e', SCRIPT]

/** How long one read may take before it counts as failed. */
export const READ_TIMEOUT_MS = 5000

const STATES = new Set(['closed', 'stopped', 'playing', 'paused', 'fast forwarding', 'rewinding'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

/**
 * The reading a finished osascript run stands for.
 *
 * @param run the process result
 * @param readAt when the run was taken, milliseconds since the epoch
 * @returns the reading, or the error the pane should show
 */
export function modelOf(run: { exitCode: number; stdout: string; stderr: string }, readAt: number): Model {
  if (run.exitCode !== 0) {
    const reason = run.stderr.trim().split('\n').at(-1) ?? ''

    return { kind: 'error', text: `osascript exited ${run.exitCode}${reason ? `: ${reason}` : ''}` }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(run.stdout)
  } catch {
    return { kind: 'error', text: 'Music.app answered something that is not JSON' }
  }

  if (!isRecord(parsed) || typeof parsed.state !== 'string' || !STATES.has(parsed.state)) {
    return { kind: 'error', text: 'Music.app answered an unknown player state' }
  }

  const track = isRecord(parsed.track) ? parsed.track : null

  return {
    kind: 'ok',
    readAt,
    now: {
      state: parsed.state as NowPlaying['state'],
      track: track
        ? {
            name: stringOr(track.name, ''),
            artist: stringOr(track.artist, ''),
            album: stringOr(track.album, ''),
            duration: numberOr(track.duration, 0),
          }
        : null,
      position: typeof parsed.position === 'number' ? parsed.position : null,
    },
  }
}

/**
 * The reading as it stands at `at`: while playing, the position runs on from
 * where it was read, so the clock ticks without asking Music.app again.
 *
 * @param model what was last read
 * @param at now, milliseconds since the epoch
 * @returns the model with the position carried forward, capped at the track's end
 */
export function modelAt(model: Model, at: number): Model {
  if (model.kind !== 'ok' || model.now.state !== 'playing' || !model.now.track || model.now.position === null) {
    return model
  }

  const elapsed = Math.max(0, at - model.readAt) / 1000
  const { duration } = model.now.track
  const position = model.now.position + elapsed

  return { ...model, now: { ...model.now, position: duration > 0 ? Math.min(duration, position) : position } }
}

/**
 * Whether the playing track has run out by `at`, so the next one is due.
 *
 * @param model what was last read
 * @param at now, milliseconds since the epoch
 * @returns true once the carried-forward position reaches the duration
 */
export function hasEnded(model: Model, at: number): boolean {
  const shown = modelAt(model, at)

  return (
    shown.kind === 'ok' &&
    shown.now.state === 'playing' &&
    shown.now.track !== null &&
    shown.now.track.duration > 0 &&
    (shown.now.position ?? 0) >= shown.now.track.duration
  )
}

/**
 * Seconds as m:ss (or h:mm:ss past an hour).
 *
 * @param seconds a non-negative duration
 * @returns the clock text
 */
export function clockOf(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const h = Math.floor(whole / 3600)
  const m = Math.floor((whole % 3600) / 60)
  const s = whole % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)

  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/**
 * A progress bar of `width` cells, filled to `ratio`.
 *
 * @param ratio 0 to 1; out of range is clamped
 * @param width the bar's cells, at least 1
 * @returns the bar
 */
export function barOf(ratio: number, width: number): string {
  const cells = Math.max(1, Math.floor(width))
  const filled = Math.round(Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0)) * cells)

  return `${'█'.repeat(filled)}${'░'.repeat(cells - filled)}`
}


/** The transport controls the band offers. */
export type Control = 'playpause' | 'next'

const CONTROL_SCRIPT: Record<Control, string> = {
  playpause: 'tell application "Music" to playpause',
  next: 'tell application "Music" to next track',
}

/**
 * The argv that sends one transport control to Music.app.
 *
 * @param control which control
 * @returns the argv
 */
export function controlArgvOf(control: Control): readonly string[] {
  return ['osascript', '-e', CONTROL_SCRIPT[control]]
}
