/**
 * What Music.app reports, read with one `osascript -l JavaScript` run and
 * parsed from the JSON it prints.
 */
export type NowPlaying = {
  state: 'closed' | 'stopped' | 'playing' | 'paused' | 'fast forwarding' | 'rewinding'
  system: { volume: number; muted: boolean }
  volume: number | null
  shuffle: boolean | null
  repeat: string | null
  track: { name: string; artist: string; album: string; duration: number } | null
  position: number | null
  playlist: { name: string; index: number; count: number } | null
  next: { name: string; artist: string } | null
}

/** The pane's state: nothing read yet, a reading, or why the read failed. */
export type Model =
  | { kind: 'idle' }
  | { kind: 'ok'; now: NowPlaying }
  | { kind: 'error'; text: string }

/**
 * The JXA script osascript runs. One IIFE whose value is the JSON text
 * (osascript prints the top-level expression's value).
 */
export const SCRIPT = `(() => {
  const sys = Application.currentApplication()
  sys.includeStandardAdditions = true
  const vol = sys.getVolumeSettings()
  const out = {
    state: 'closed',
    system: { volume: vol.outputVolume, muted: vol.outputMuted },
    volume: null, shuffle: null, repeat: null,
    track: null, position: null, playlist: null, next: null,
  }
  const music = Application('Music')
  if (!music.running()) return JSON.stringify(out)
  out.state = music.playerState()
  out.volume = music.soundVolume()
  out.shuffle = music.shuffleEnabled()
  out.repeat = music.songRepeat()
  if (out.state === 'stopped') return JSON.stringify(out)
  const t = music.currentTrack()
  out.track = { name: t.name(), artist: t.artist(), album: t.album(), duration: t.duration() }
  try { out.position = music.playerPosition() } catch (e) { out.position = null }
  try {
    const pl = music.currentPlaylist()
    const idx = t.index()
    const n = pl.tracks.length
    out.playlist = { name: pl.name(), index: idx, count: n }
    if (idx < n) {
      const nt = pl.tracks[idx]
      out.next = { name: nt.name(), artist: nt.artist() }
    }
  } catch (e) {}
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
 * @returns the reading, or the error the pane should show
 */
export function modelOf(run: { exitCode: number; stdout: string; stderr: string }): Model {
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

  const system = isRecord(parsed.system) ? parsed.system : {}
  const track = isRecord(parsed.track) ? parsed.track : null
  const playlist = isRecord(parsed.playlist) ? parsed.playlist : null
  const next = isRecord(parsed.next) ? parsed.next : null

  return {
    kind: 'ok',
    now: {
      state: parsed.state as NowPlaying['state'],
      system: { volume: numberOr(system.volume, 0), muted: system.muted === true },
      volume: typeof parsed.volume === 'number' ? parsed.volume : null,
      shuffle: typeof parsed.shuffle === 'boolean' ? parsed.shuffle : null,
      repeat: typeof parsed.repeat === 'string' ? parsed.repeat : null,
      track: track
        ? {
            name: stringOr(track.name, ''),
            artist: stringOr(track.artist, ''),
            album: stringOr(track.album, ''),
            duration: numberOr(track.duration, 0),
          }
        : null,
      position: typeof parsed.position === 'number' ? parsed.position : null,
      playlist: playlist
        ? {
            name: stringOr(playlist.name, ''),
            index: numberOr(playlist.index, 0),
            count: numberOr(playlist.count, 0),
          }
        : null,
      next: next ? { name: stringOr(next.name, ''), artist: stringOr(next.artist, '') } : null,
    },
  }
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

