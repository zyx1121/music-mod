/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { Elements, RenderElement } from 'claude-code'

import { barOf, clockOf, type Model, type NowPlaying } from '../now-playing'

/** The tags the band draws with. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text'>

/** The progress bar's cells on a band wide enough to spare them. */
export const BAR_CELLS = 24

/** Below this many body columns the bar shrinks to keep the clocks. */
export const BAR_MIN_CELLS = 8

const STATE_MARK: Record<NowPlaying['state'], string> = {
  closed: '🎵',
  stopped: '🎵',
  playing: '▶',
  paused: '⏸',
  'fast forwarding': '⏩',
  rewinding: '⏪',
}

/**
 * The first line: what plays, and the playlist it plays from.
 *
 * @param now the reading, with a track
 * @returns `🎶 name · artist · album  📃 399/411 🔀 🔁`
 */
export function titleLineOf(now: NowPlaying & { track: NonNullable<NowPlaying['track']> }): string {
  const { track } = now
  const who = [track.name, track.artist, track.album].filter(part => part !== '').join(' · ')
  const marks = [
    now.playlist ? `📃 ${now.playlist.index}/${now.playlist.count}` : null,
    now.shuffle ? '🔀' : null,
    now.repeat === 'one' ? '🔂' : now.repeat && now.repeat !== 'off' ? '🔁' : null,
  ].filter((part): part is string => part !== null)

  return `${now.state === 'playing' ? '🎶' : '🎵'} ${who}${marks.length ? `  ${marks.join(' ')}` : ''}`
}

/**
 * The second line's tail: the volume and the track up next.
 *
 * @param now the reading
 * @returns `🔊 53  ⏭ name · artist`
 */
export function tailOf(now: NowPlaying): string {
  const speaker = now.system.muted ? '🔇' : now.system.volume < 34 ? '🔈' : now.system.volume < 67 ? '🔉' : '🔊'
  const volume = now.volume === null ? speaker : `${speaker} ${now.volume}`
  const next = now.next
    ? `⏭ ${[now.next.name, now.next.artist].filter(part => part !== '').join(' · ')}`
    : now.playlist
      ? '⏭ end of playlist'
      : null

  return [volume, next].filter((part): part is string => part !== null).join('  ')
}

/**
 * The band's tree for one `ui.render`: two lines above the prompt.
 *
 * @param kit Box and Text
 * @param model what was last read
 * @param columns the band's body columns
 * @returns the tree
 */
export function bandView(kit: Kit, model: Model, columns: number): RenderElement {
  const { Box, Text } = kit

  if (model.kind === 'idle') {
    return (
      <Box paddingX={1}>
        <Text dimColor>🎵 Reading Music.app…</Text>
      </Box>
    )
  }

  if (model.kind === 'error') {
    return (
      <Box paddingX={1}>
        <Text wrap="truncate-end">
          <Text color="red">⚠️ Could not read Music.app</Text>
          <Text dimColor>  {model.text}</Text>
        </Text>
      </Box>
    )
  }

  const { now } = model

  if (now.state === 'closed') {
    return (
      <Box paddingX={1}>
        <Text dimColor>🎵 Music isn't running</Text>
      </Box>
    )
  }

  if (now.state === 'stopped' || !now.track) {
    return (
      <Box paddingX={1}>
        <Text dimColor>🎵 Music is open, nothing playing  {tailOf(now)}</Text>
      </Box>
    )
  }

  const { track } = now
  const position = now.position ?? 0
  const mark = STATE_MARK[now.state]
  const clocks = `${clockOf(position)} ${clockOf(track.duration)}`
  const tail = tailOf(now)
  const spare = columns - 2 - mark.length - 1 - clocks.length - 2 - 2 - tail.length
  const cells = Math.max(BAR_MIN_CELLS, Math.min(BAR_CELLS, spare))
  const bar = barOf(track.duration > 0 ? position / track.duration : 0, cells)

  return (
    <Box paddingX={1} flexDirection="column">
      <Text bold wrap="truncate-end">
        {titleLineOf({ ...now, track })}
      </Text>
      <Text wrap="truncate-end">
        {mark} {clockOf(position)} {bar} {clockOf(track.duration)}
        <Text dimColor>  {tail}</Text>
      </Text>
    </Box>
  )
}
