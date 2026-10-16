/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { Elements, RenderElement } from 'claude-code'

import { barOf, clockOf, type Control, type Model, type NowPlaying } from '../now-playing'
import { COLOR, FRAME_CELLS, cellsOf, lineOf, panelOf, type Seg } from './panel'

/** The tags the band draws with. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

/** What a press on each control runs. */
export type Actions = Record<Control, () => void>

/** The panel's title. */
export const TITLE = 'MUSIC'

/** The fewest cells the bar keeps; below that the title gives way. */
export const BAR_MIN_CELLS = 6

/** The share of the band a playing track's panel takes. */
export const PLAYING_SHARE = 0.4

/** The fewest columns a playing track's panel takes. */
export const PLAYING_MIN_COLUMNS = 36

/** The state glyph, a pressable play/pause. */
export const STATE_MARK: Record<Exclude<NowPlaying['state'], 'closed'>, string> = {
  stopped: '▶',
  playing: '▶',
  paused: '⏸',
  'fast forwarding': '»',
  rewinding: '«',
}

/** The next-track glyph. */
export const NEXT_MARK = '⏭'

const WIDE =
  /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{1F300}-\u{1FAFF}]/u

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
 * A panel sized to one line of segments.
 *
 * @param kit Box, Text and Button
 * @param segs the line
 * @param tone the border's tone
 * @returns the tree
 */
function textPanelOf(kit: Kit, segs: readonly Seg[], tone: 'normal' | 'error' = 'normal'): RenderElement {
  const width = Math.max(cellsOf(segs), TITLE.length + 2) + FRAME_CELLS

  return panelOf(kit, { title: TITLE, tone, width }, lineOf(kit, segs))
}

/**
 * The band's panel for one `ui.render`: the track, a bar that takes what the
 * title leaves, and the two pressable glyphs.
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
    return textPanelOf(kit, [{ text: 'reading Music.app…', color: COLOR.muted }])
  }

  if (model.kind === 'error') {
    return panelOf(
      kit,
      { title: TITLE, tone: 'error', width: Math.max(PLAYING_MIN_COLUMNS, Math.floor(columns * PLAYING_SHARE)) },
      lineOf(kit, [
        { text: 'could not read Music.app', color: COLOR.error },
        { text: `  ${model.text}`, color: COLOR.muted },
      ]),
    )
  }

  const { now } = model

  if (now.state === 'closed') {
    return textPanelOf(kit, [{ text: 'not running', color: COLOR.muted }])
  }

  if (now.state === 'stopped' || !now.track) {
    const text = 'nothing playing'
    const width = 1 + 1 + text.length + FRAME_CELLS

    return panelOf(
      kit,
      { title: TITLE, width },
      <Box flexDirection="row" gap={1}>
        <Button key="playpause" plain onPress={actions.playpause}>
          {STATE_MARK.stopped}
        </Button>
        <Text color={COLOR.muted}>{text}</Text>
      </Box>,
    )
  }

  const { track } = now
  const position = now.position ?? 0
  const clocks = `${clockOf(position)} / ${clockOf(track.duration)}`
  const name = track.name
  const rest = [track.artist, track.album].filter(part => part !== '').join(' / ')
  const title = rest ? `${name}  ${rest}` : name
  const width = Math.min(columns, Math.max(PLAYING_MIN_COLUMNS, Math.floor(columns * PLAYING_SHARE)))
  // Glyph, title, bar, clocks and glyph, a space between each.
  const fixed = 1 + 1 + 1 + 1 + clocks.length + 1 + 1
  const spare = Math.max(BAR_MIN_CELLS + 4, width - FRAME_CELLS - fixed)
  const isWhole = widthOf(title) + BAR_MIN_CELLS <= spare
  const titleCells = isWhole ? widthOf(title) : spare - BAR_MIN_CELLS
  const shown = fitOf(title, titleCells)
  const shownName = [...shown].slice(0, [...name].length).join('')
  const bar = barOf(track.duration > 0 ? position / track.duration : 0, spare - titleCells)
  const filled = bar.replace(/░/g, '').length

  return panelOf(
    kit,
    { title: TITLE, width },
    <Box flexDirection="row" gap={1}>
      <Button key="playpause" plain onPress={actions.playpause}>
        {STATE_MARK[now.state]}
      </Button>
      <Text>
        <Text color={COLOR.text} bold>
          {shownName}
        </Text>
        <Text color={COLOR.muted}>{shown.slice(shownName.length)}</Text>
      </Text>
      <Text>
        <Text color={COLOR.title}>{'━'.repeat(filled)}</Text>
        <Text color={COLOR.line}>{'─'.repeat(bar.length - filled)}</Text>
        <Text color={COLOR.muted}> {clocks}</Text>
      </Text>
      <Button key="next" plain onPress={actions.next}>
        {NEXT_MARK}
      </Button>
    </Box>,
  )
}
