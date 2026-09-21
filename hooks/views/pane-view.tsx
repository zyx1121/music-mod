/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { Elements, RenderElement } from 'claude-code'

import { barOf, clockOf, type Model } from '../now-playing'

/** The tags the pane draws with. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text'>

const STATE_MARK: Record<string, string> = {
  playing: '▶',
  paused: '⏸',
  'fast forwarding': '⏩',
  rewinding: '⏪',
}

/**
 * The Music pane's body for one `ui.render`.
 *
 * @param kit Box and Text
 * @param model what was last read
 * @param columns the body columns the pane has
 * @returns the tree
 */
export function paneView(kit: Kit, model: Model, columns: number): RenderElement {
  const { Box, Text } = kit

  if (model.kind === 'idle') {
    return (
      <Box paddingX={1}>
        <Text dimColor>Reading Music.app…</Text>
      </Box>
    )
  }

  if (model.kind === 'error') {
    return (
      <Box paddingX={1} flexDirection="column">
        <Text color="red">Could not read Music.app</Text>
        <Text dimColor>{model.text}</Text>
      </Box>
    )
  }

  const { now } = model

  if (now.state === 'closed') {
    return (
      <Box paddingX={1}>
        <Text dimColor>Music isn't running</Text>
      </Box>
    )
  }

  if (now.state === 'stopped' || !now.track) {
    return (
      <Box paddingX={1}>
        <Text dimColor>Music is open, nothing playing</Text>
      </Box>
    )
  }

  const { track } = now
  const position = now.position ?? 0
  const clocks = `${clockOf(position)} / ${clockOf(track.duration)}`
  const mark = STATE_MARK[now.state] ?? '♫'
  const barWidth = Math.max(4, columns - 2 - mark.length - 1 - clocks.length - 1 - 1)
  const bar = barOf(track.duration > 0 ? position / track.duration : 0, barWidth)
  const system = `sys ${now.system.volume}${now.system.muted ? ' (muted)' : ''}`
  const volume = now.volume === null ? system : `vol ${now.volume} · ${system}`
  const modes = [now.shuffle ? 'shuffle' : null, now.repeat && now.repeat !== 'off' ? `repeat ${now.repeat}` : null]
    .filter((s): s is string => s !== null)
    .join(' · ')
  const playlist = now.playlist ? `${now.playlist.name} ${now.playlist.index}/${now.playlist.count}` : null
  const next = now.next ? `${now.next.name} · ${now.next.artist}` : now.playlist ? 'end of playlist' : null

  return (
    <Box paddingX={1} flexDirection="column">
      <Text bold wrap="truncate-end">
        {track.name}
      </Text>
      <Text wrap="truncate-end">
        {track.artist}
        {track.album ? ` · ${track.album}` : ''}
      </Text>
      <Text>
        {mark} {bar} {clocks}
      </Text>
      <Text dimColor wrap="truncate-end">
        {volume}
        {modes ? ` · ${modes}` : ''}
        {playlist ? ` · ${playlist}` : ''}
      </Text>
      {next !== null ? (
        <Text wrap="truncate-end">
          <Text dimColor>next </Text>
          {next}
        </Text>
      ) : null}
    </Box>
  )
}
