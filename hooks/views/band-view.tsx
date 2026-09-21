/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { Elements, RenderElement } from 'claude-code'

import { barOf, clockOf, type Control, type Model, type NowPlaying } from '../now-playing'

/** The tags the band draws with. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

/** What a press on each control runs. */
export type Actions = Record<Control, () => void>

/** The progress bar's cells on a band wide enough to spare them. */
export const BAR_CELLS = 20

/** Below this many cells the bar stops shrinking and the title gives way. */
export const BAR_MIN_CELLS = 6

/** The state glyph, a pressable play/pause. */
export const STATE_MARK: Record<NowPlaying['state'], string> = {
  closed: '🎵',
  stopped: '▶️',
  playing: '▶️',
  paused: '⏸️',
  'fast forwarding': '⏩',
  rewinding: '⏪',
}

/** The next-track glyph. */
export const NEXT_MARK = '⏭️'

/** Cells an emoji with a variation selector takes on the terminal. */
const GLYPH_CELLS = 2

/**
 * `text` cut to `cells` columns with an ellipsis, counting a CJK or emoji
 * character as two cells.
 *
 * @param text the string
 * @param cells the columns to fit
 * @returns the fitted string
 */
export function fitOf(text: string, cells: number): string {
  let width = 0
  let out = ''

  for (const char of text) {
    const w = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{1F300}-\u{1FAFF}]/u.test(char) ? 2 : 1

    if (width + w > cells - 1) {
      return `${out}…`
    }

    width += w
    out += char
  }

  return out
}

/**
 * The band's tree for one `ui.render`: one line above the prompt, its two
 * glyphs pressable.
 *
 * @param kit Box, Text and Button
 * @param model what was last read
 * @param columns the band's body columns
 * @param actions what the glyphs run
 * @returns the tree
 */
export function bandView(kit: Kit, model: Model, columns: number, actions: Actions): RenderElement {
  const { Box, Text, Button } = kit

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
      <Box paddingX={1} flexDirection="row" gap={1}>
        <Button key="playpause" plain onPress={actions.playpause}>
          {STATE_MARK.stopped}
        </Button>
        <Text dimColor>Music is open, nothing playing</Text>
      </Box>
    )
  }

  const { track } = now
  const position = now.position ?? 0
  const clocks = `${clockOf(position)} / ${clockOf(track.duration)}`
  const title = [track.name, track.artist, track.album].filter(part => part !== '').join(' · ')
  const fixed = 2 + GLYPH_CELLS + 1 + 2 + 1 + clocks.length + 1 + GLYPH_CELLS
  const spare = columns - fixed
  const cells = Math.max(BAR_MIN_CELLS, Math.min(BAR_CELLS, Math.floor(spare / 3)))
  const bar = barOf(track.duration > 0 ? position / track.duration : 0, cells)
  const titleCells = Math.max(4, spare - cells)

  return (
    <Box paddingX={1} flexDirection="row" gap={1}>
      <Button key="playpause" plain onPress={actions.playpause}>
        {STATE_MARK[now.state]}
      </Button>
      <Text bold>{fitOf(title, titleCells)}</Text>
      <Text>
        {bar} <Text dimColor>{clocks}</Text>
      </Text>
      <Button key="next" plain onPress={actions.next}>
        {NEXT_MARK}
      </Button>
    </Box>
  )
}
