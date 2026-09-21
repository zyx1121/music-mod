import { describe, expect, test, tier } from 'claude-code/testing'

import * as Fixtures from './fixtures'

tier('user')

describe('register', () => {
  test('/music reads Music.app and draws two lines above the prompt', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)

    expect(world.runs, 'the start reads nothing').toEqual([])
    expect(Fixtures.textOf(await $.ui.render(Fixtures.BAND)), 'hidden, the band is left beneath').toBe(
      '(beneath)',
    )

    expect(await $.command.run(Fixtures.MUSIC)).toEqual({ text: 'Music shown above the prompt' })

    expect(world.runs.length).toBe(1)
    expect(world.runs[0]?.argv.slice(0, 3)).toEqual(['osascript', '-l', 'JavaScript'])

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.BAND))
    const lines = drawn.split('\n')

    expect(lines.length).toBe(2)
    expect(lines[0]).toBe('🎶 FOREVER · BABYMONSTER · FOREVER - Single  📃 409/411')
    expect(lines[1]).toMatch(/^▶ 3:17 █+░+ 3:33  🔇 53  ⏭ Klaxon · i-dle$/)
  })

  test('paused, unmuted, shuffle and repeat show their marks', async ($, on) => {
    Fixtures.world(on, Fixtures.PAUSED)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)

    const [title, progress] = Fixtures.textOf(await $.ui.render(Fixtures.BAND)).split('\n')

    expect(title).toBe('🎵 FOREVER · BABYMONSTER · FOREVER - Single  📃 409/411 🔀 🔁')
    expect(progress).toMatch(/^⏸ 3:17 .* 3:33  🔊 53  ⏭ Klaxon · i-dle$/)
  })

  test('while shown, the band re-reads on the timer and redraws', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)

    expect(world.runs.length).toBe(1)

    world.answers.stdout = Fixtures.CLOSED
    await world.clock.advance(2000)

    expect(world.runs.length).toBe(2)
    expect(world.invalidated).toEqual(['ui.render', 'ui.render'])
    expect(Fixtures.textOf(await $.ui.render(Fixtures.BAND))).toBe("🎵 Music isn't running")
  })

  test('a second /music hides the band and stops the timer', async ($, on) => {
    const world = Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)

    expect(await $.command.run(Fixtures.MUSIC)).toEqual({ text: 'Music hidden' })
    expect(Fixtures.textOf(await $.ui.render(Fixtures.BAND))).toBe('(beneath)')

    await world.clock.advance(10000)

    expect(world.runs.length, 'no read after the hide').toBe(1)
  })

  test('a survey holding the band is yielded to', async ($, on) => {
    Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)

    const survey = { ...Fixtures.BAND, props: { ...Fixtures.BAND.props, hasSurvey: true } }

    expect(Fixtures.textOf(await $.ui.render(survey))).toBe('(beneath)')
  })

  test('the session ending stops the timer too', async ($, on) => {
    const world = Fixtures.world(on)

    on('session.end', ($, e) => ({ sessionId: e.sessionId }))
    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)
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
    await $.command.run(Fixtures.MUSIC)

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.BAND))

    expect(drawn).toContain('⚠️ Could not read Music.app')
    expect(drawn).toContain('Not authorized')
  })

  test('a narrow band keeps the clocks and shrinks the bar', async ($, on) => {
    Fixtures.world(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.MUSIC)

    const narrow = { ...Fixtures.BAND, props: { ...Fixtures.BAND.props, bodyColumns: 50 } }
    const progress = Fixtures.textOf(await $.ui.render(narrow)).split('\n')[1] ?? ''
    const bar = /[█░]+/.exec(progress)?.[0] ?? ''

    expect(bar.length).toBeLessThan(24)
    expect(bar.length).toBeGreaterThanOrEqual(8)
    expect(progress).toContain('3:17')
    expect(progress).toContain('3:33')
  })
})
