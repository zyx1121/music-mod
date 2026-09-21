/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { Elements, RenderElement } from 'claude-code'

import { barOf, clockOf, type Control, type Model, type NowPlaying } from '../now-playing'

/** The tags the band draws with. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

/** What a press on each control runs. */
export type Actions = Record<Control, () => void>

/** The fewest cells the bar keeps; below that the title gives way. */
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
 * Cells the engine draws its collapse mark (` [-]`) over at the band's right
 * edge; `bodyColumns` does not set them aside, so the line stops short of them.
 */
export const COLLAPSE_CELLS = 4

const WIDE =
  /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}]/u

/**
 * The columns `text` takes on the terminal, a CJK or emoji character two.
 *
 * @param text the string
 * @returns its cells
 */
export function widthOf(text: string): number {
  let width = 0

  for (const char of text) {
    width += WIDE.test(char) ? 2 : 1
  }

  return width
}

/**
 * `text` cut to `cells` columns with an ellipsis when it does not fit.
 *
 * @param text the string
 * @param cells the columns to fit
 * @returns the fitted string
 */
export function fitOf(text: string, cells: number): string {
  if (widthOf(text) <= cells) {
    return text
  }

  let width = 0
  let out = ''

  for (const char of text) {
    const w = WIDE.test(char) ? 2 : 1

    if (width + w > cells - 1) {
      return `${out}…`
    }

    width += w
    out += char
  }

  return out
}

/**
 * The band's tree for one `ui.render`: one line above the prompt filling its
 * width (the bar takes what the title leaves), its two glyphs pressable.
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
  const fixed = 2 + GLYPH_CELLS + 1 + 1 + 1 + clocks.length + 1 + GLYPH_CELLS
  const spare = Math.max(BAR_MIN_CELLS + 4, columns - COLLAPSE_CELLS - fixed)
  const isWhole = widthOf(title) + BAR_MIN_CELLS <= spare
  const titleCells = isWhole ? widthOf(title) : spare - BAR_MIN_CELLS
  const cells = spare - titleCells
  const bar = barOf(track.duration > 0 ? position / track.duration : 0, cells)

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
