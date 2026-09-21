import type { RenderElement } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

import * as Fixtures from './fixtures'

tier('user')

describe('register', () => {
  test('/music reads Music.app, opens the pane and says so', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)

    expect(world.runs, 'the start reads nothing').toEqual([])

    expect(await $.command.run(Fixtures.MUSIC)).toEqual({ text: 'Music pane shown' })

    expect(world.runs.length).toBe(1)
    expect(world.runs[0]?.argv.slice(0, 3)).toEqual(['osascript', '-l', 'JavaScript'])
    expect(world.opened).toEqual([{ id: 'music', title: 'Music', rows: 7, holdToasts: true }])

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(drawn).toContain('FOREVER')
    expect(drawn).toContain('BABYMONSTER · FOREVER - Single')
    expect(drawn).toContain('3:17 / 3:33')
    expect(drawn).toContain('vol 53 · sys 44 (muted)')
    expect(drawn).toContain('Favourite Songs 409/411')
    expect(drawn).toContain('next Klaxon · i-dle')
  })

  test('while open, the pane re-reads on the timer and redraws', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)

    expect(world.runs.length).toBe(1)

    world.answers.stdout = Fixtures.CLOSED
    await world.clock.advance(2000)

    expect(world.runs.length).toBe(2)
    expect(world.invalidated).toEqual(['ui.render', 'ui.render'])
    expect(Fixtures.textOf(await $.ui.render(Fixtures.PANE))).toContain("Music isn't running")
  })

  test('a second /music closes the pane and stops the timer', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)

    expect(await $.command.run(Fixtures.MUSIC)).toEqual({ text: 'Music pane hidden' })
    expect(world.closed.map(e => e.id)).toEqual(['music'])

    await world.clock.advance(10000)

    expect(world.runs.length, 'no read after the close').toBe(1)
  })

  test('the session ending stops the timer too', async ($, on) => {
    const world = Fixtures.world(on)

    on('session.end', ($, e) => ({ sessionId: e.sessionId }))
    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)
    await $.session.end({ reason: 'other', sessionId: 's1', resume: { id: 's1' } })
    await world.clock.advance(10000)

    expect(world.runs.length).toBe(1)
    expect(await $.command.run(Fixtures.MUSIC), 'the next /music opens again').toEqual({
      text: 'Music pane shown',
    })
  })

  test('the pane draws three transport controls', async ($, on) => {
    Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(drawn).toContain('⏮')
    expect(drawn).toContain('⏯')
    expect(drawn).toContain('⏭')
  })

  test('pressing next tells Music.app so, then re-reads', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)
    await $.ui.render(Fixtures.PANE)

    expect(await $.ui.press({ plugin: 'music-mod', key: 'next' })).toEqual({ element: 'next' })

    await world.clock.settle()

    expect(world.runs.map(run => run.argv.join(' '))).toEqual([
      expect.stringContaining('osascript -l JavaScript'),
      'osascript -e tell application "Music" to next track',
      expect.stringContaining('osascript -l JavaScript'),
    ])
  })

  test('pressing play/pause and previous send their own commands', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)
    await $.ui.render(Fixtures.PANE)
    await $.ui.press({ plugin: 'music-mod', key: 'playpause' })
    await world.clock.settle()
    await $.ui.press({ plugin: 'music-mod', key: 'previous' })
    await world.clock.settle()

    const sent = world.runs.map(run => run.argv[2]).filter(arg => arg?.startsWith('tell'))

    expect(sent).toEqual([
      'tell application "Music" to playpause',
      'tell application "Music" to previous track',
    ])
  })

  test('a failing osascript draws the error, not a crash', async ($, on) => {
    const world = Fixtures.world(on)

    world.answers.exitCode = 1
    world.answers.stderr = 'execution error: Not authorized to send Apple events to Music. (-1743)'

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(drawn).toContain('Could not read Music.app')
    expect(drawn).toContain('Not authorized')
  })

  test('another pane is left to its own hooks', async ($, on) => {
    Fixtures.world(on)
    on('ui.render', { component: 'Pane' }, ($, e) => {
      const { Text } = $.ui.resolve(e)

      return h(Text, null, 'someone else') as RenderElement
    })

    await $.session.start(Fixtures.SESSION)

    expect(Fixtures.textOf(await $.ui.render({ ...Fixtures.PANE, requestId: 'diff' }))).toBe('someone else')
  })

  test('a pane the surface cannot place is closed and said so', async ($, on) => {
    const world = Fixtures.world(on, Fixtures.PLAYING, true)

    await $.session.start(Fixtures.SESSION)

    expect(await $.command.run(Fixtures.MUSIC)).toEqual({ text: 'Music pane needs a wider terminal' })
    expect(world.closed.map(e => e.id)).toEqual(['music'])

    await world.clock.advance(10000)

    expect(world.runs.length).toBe(1)
  })
})
