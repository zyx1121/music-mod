import { describe, expect, test, tier } from 'claude-code/testing'

import * as Fixtures from './fixtures'

tier('user')

describe('register', () => {
  test('an interactive start shows the line without /music, what is beneath below it', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)

    expect(Fixtures.textOf(await $.ui.render(Fixtures.BAND)).split('\n')[1]).toBe('(beneath)')

    expect(world.runs.length, 'the start reads once').toBe(1)
    expect(world.runs[0]?.argv.slice(0, 3)).toEqual(['osascript', '-l', 'JavaScript'])

    const drawn = Fixtures.lineOf(await $.ui.render(Fixtures.BAND))

    expect(drawn).toMatch(/^▶️ FOREVER · BABYMONSTER · FOREVER - Single █+░+ 3:17 \/ 3:33 ⏭️$/)
    expect(drawn).not.toContain('53')
    expect(drawn).not.toContain('409')
    expect(drawn).not.toContain('Klaxon')
  })

  test('a start the person last hid stays hidden, and /music shows it and remembers', async ($, on) => {
    const world = Fixtures.world(on, Fixtures.PLAYING, { shown: false })

    await $.session.start(Fixtures.SESSION)

    expect(world.runs, 'nothing read while hidden').toEqual([])
    expect(Fixtures.lineOf(await $.ui.render(Fixtures.BAND))).toBe('(beneath)')

    expect(await $.command.run(Fixtures.MUSIC)).toEqual({ text: 'Music shown above the prompt' })
    expect(world.stored.shown).toBe(true)
    expect(Fixtures.lineOf(await $.ui.render(Fixtures.BAND))).toMatch(/^▶️ FOREVER/)
  })

  test('a non-interactive start shows nothing', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start({ ...Fixtures.SESSION, isInteractive: false })

    expect(world.runs).toEqual([])
    expect(Fixtures.lineOf(await $.ui.render(Fixtures.BAND))).toBe('(beneath)')
  })

  test('pressing the state glyph toggles play/pause, then re-reads', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.BAND)

    expect(await $.ui.press({ plugin: 'music-mod', key: 'playpause' })).toEqual({ element: 'playpause' })

    await world.clock.settle()

    expect(world.runs.map(run => run.argv.join(' '))).toEqual([
      expect.stringContaining('osascript -l JavaScript'),
      'osascript -e tell application "Music" to playpause',
      expect.stringContaining('osascript -l JavaScript'),
    ])
  })

  test('pressing the next glyph skips the track', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.BAND)
    await $.ui.press({ plugin: 'music-mod', key: 'next' })
    await world.clock.settle()

    expect(world.runs[1]?.argv[2]).toBe('tell application "Music" to next track')
  })

  test('paused shows the pause glyph', async ($, on) => {
    Fixtures.world(on, Fixtures.PAUSED)

    await $.session.start(Fixtures.SESSION)

    expect(Fixtures.lineOf(await $.ui.render(Fixtures.BAND))).toMatch(/^⏸️ FOREVER/)
  })

  test('while playing, the clock runs on between reads without osascript', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await world.clock.advance(2000)

    expect(world.runs.length, 'ticks read nothing').toBe(1)
    expect(world.invalidated.length, 'each tick redraws').toBe(3)
    expect(Fixtures.lineOf(await $.ui.render(Fixtures.BAND))).toContain('3:19 / 3:33')
  })

  test('once refreshMs has passed, the band reads again and redraws', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)

    world.answers.stdout = Fixtures.CLOSED
    await world.clock.advance(4000)

    expect(world.runs.length).toBe(1)

    await world.clock.advance(1000)

    expect(world.runs.length).toBe(2)
    expect(Fixtures.lineOf(await $.ui.render(Fixtures.BAND))).toBe("🎵 Music isn't running")
  })

  test('a read leaves its reading in the shared file', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)

    const shared = JSON.parse(world.files[Fixtures.SHARED] ?? 'null')

    expect(shared.readAt).toBe(0)
    expect(shared.run.stdout).toBe(Fixtures.PLAYING)
  })

  test("another session's recent reading is taken instead of running osascript", async ($, on) => {
    const world = Fixtures.world(on)

    world.files[Fixtures.SHARED] = JSON.stringify({
      readAt: 0,
      run: { exitCode: 0, stdout: Fixtures.PAUSED, stderr: '' },
    })

    await $.session.start(Fixtures.SESSION)

    expect(world.runs, 'nothing run at the start').toEqual([])
    expect(Fixtures.lineOf(await $.ui.render(Fixtures.BAND))).toMatch(/^⏸️ FOREVER/)

    await world.clock.advance(4000)
    world.files[Fixtures.SHARED] = JSON.stringify({
      readAt: 4500,
      run: { exitCode: 0, stdout: Fixtures.CLOSED, stderr: '' },
    })
    await world.clock.advance(1000)

    expect(world.runs, 'the fresh shared reading is taken').toEqual([])
    expect(Fixtures.lineOf(await $.ui.render(Fixtures.BAND))).toBe("🎵 Music isn't running")
  })

  test('a read under way elsewhere is waited for, not repeated', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await world.clock.advance(4000)
    world.files[Fixtures.SHARED] = JSON.stringify({ readAt: 4800, run: null })
    await world.clock.advance(1000)

    expect(world.runs.length).toBe(1)
    expect(Fixtures.lineOf(await $.ui.render(Fixtures.BAND)), 'the last reading still draws').toMatch(/^▶️ FOREVER/)
  })

  test('a shared file that cannot be read falls back to osascript', async ($, on) => {
    const world = Fixtures.world(on)

    world.files[Fixtures.SHARED] = 'not json'

    await $.session.start(Fixtures.SESSION)

    expect(world.runs.length).toBe(1)
  })

  test('a track run out reads the next one before refreshMs', async ($, on) => {
    const world = Fixtures.world(on)

    world.answers.stdout = JSON.stringify({ ...JSON.parse(Fixtures.PLAYING), position: 211 })

    await $.session.start(Fixtures.SESSION)
    await world.clock.advance(2000)

    expect(world.runs.length, 'read at the end, 2 s in').toBe(2)
  })

  test('/music on a shown band hides it, stops the timer and remembers', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)

    expect(await $.command.run(Fixtures.MUSIC)).toEqual({ text: 'Music hidden' })
    expect(world.stored.shown).toBe(false)
    expect(Fixtures.lineOf(await $.ui.render(Fixtures.BAND))).toBe('(beneath)')

    await world.clock.advance(10000)

    expect(world.runs.length, 'no read after the hide').toBe(1)
  })

  test('a survey holding the band is yielded to', async ($, on) => {
    Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)

    const survey = { ...Fixtures.BAND, props: { ...Fixtures.BAND.props, hasSurvey: true } }

    expect(Fixtures.lineOf(await $.ui.render(survey))).toBe('(beneath)')
  })

  test('the session ending stops the timer too', async ($, on) => {
    const world = Fixtures.world(on)

    on('session.end', ($, e) => ({ sessionId: e.sessionId }))
    await $.session.start(Fixtures.SESSION)
    await $.session.end({ reason: 'other', sessionId: 's1', resume: { id: 's1' } })
    await world.clock.advance(10000)

    expect(world.runs.length).toBe(1)
    expect(await $.command.run(Fixtures.MUSIC), 'the next /music shows again').toEqual({
      text: 'Music shown above the prompt',
    })
  })

  test('a failing osascript draws the error, not a crash', async ($, on) => {
    const world = Fixtures.world(on)

    world.answers.exitCode = 1
    world.answers.stderr = 'execution error: Not authorized to send Apple events to Music. (-1743)'

    await $.session.start(Fixtures.SESSION)

    const drawn = Fixtures.lineOf(await $.ui.render(Fixtures.BAND))

    expect(drawn).toContain('⚠️ Could not read Music.app')
    expect(drawn).toContain('Not authorized')
  })

  test('a narrow band shrinks the bar and cuts the title', async ($, on) => {
    Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)

    const narrow = { ...Fixtures.BAND, props: { ...Fixtures.BAND.props, bodyColumns: 50 } }
    const drawn = Fixtures.lineOf(await $.ui.render(narrow))
    const bar = /[█░]+/.exec(drawn)?.[0] ?? ''

    expect(bar.length).toBe(6)
    expect(drawn).toContain('…')
    expect(drawn).toContain('3:17 / 3:33')
  })

  test('the line fills the band: the bar takes what the title leaves', async ($, on) => {
    Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)

    for (const bodyColumns of [80, 120, 200]) {
      const band = { ...Fixtures.BAND, props: { ...Fixtures.BAND.props, bodyColumns } }
      const drawn = Fixtures.lineOf(await $.ui.render(band))
      const bar = /[█░]+/.exec(drawn)?.[0] ?? ''

      expect(drawn).not.toContain('…')
      // 2 padding + 4 glyph cells + 4 spaces between 5 parts + title + bar + clocks,
      // stopping 4 cells short of the engine's collapse mark
      expect(2 + 4 + 4 + 'FOREVER · BABYMONSTER · FOREVER - Single'.length + bar.length + '3:17 / 3:33'.length).toBe(
        bodyColumns - 4,
      )
    }
  })
})
