import { describe, expect, test, tier } from 'claude-code/testing'

import { barOf, clockOf, controlArgvOf, hasEnded, modelAt, modelOf, SCRIPT } from '../hooks/now-playing'
import * as Fixtures from './fixtures'

tier('user')

describe('now-playing', () => {
  test('a playing answer parses whole', async () => {
    const model = modelOf({ exitCode: 0, stdout: Fixtures.PLAYING, stderr: '' }, 7)

    expect(model).toEqual({
      kind: 'ok',
      readAt: 7,
      now: {
        state: 'playing',
        track: { name: 'FOREVER', artist: 'BABYMONSTER', album: 'FOREVER - Single', duration: 213 },
        position: 197,
      },
    })
  })

  test('a closed answer has no track', async () => {
    expect(modelOf({ exitCode: 0, stdout: Fixtures.CLOSED, stderr: '' }, 0)).toEqual({
      kind: 'ok',
      readAt: 0,
      now: { state: 'closed', track: null, position: null },
    })
  })

  test('the script asks for no system volume and walks no playlist', async () => {
    expect(SCRIPT).not.toContain('getVolumeSettings')
    expect(SCRIPT).not.toContain('tracks')
  })

  test('while playing the position runs on from the read, capped at the end', async () => {
    const model = modelOf({ exitCode: 0, stdout: Fixtures.PLAYING, stderr: '' }, 1000)
    const at = (ms: number) => {
      const shown = modelAt(model, ms)

      return shown.kind === 'ok' ? shown.now.position : null
    }

    expect(at(1000)).toBe(197)
    expect(at(3500)).toBe(199.5)
    expect(at(60000)).toBe(213)
    expect(hasEnded(model, 16000)).toBe(false)
    expect(hasEnded(model, 17000)).toBe(true)
  })

  test('paused, the position stays where it was read', async () => {
    const model = modelOf({ exitCode: 0, stdout: Fixtures.PAUSED, stderr: '' }, 0)
    const shown = modelAt(model, 60000)

    expect(shown.kind === 'ok' ? shown.now.position : null).toBe(197)
    expect(hasEnded(model, 60000)).toBe(false)
  })

  test('a non-zero exit carries the last stderr line', async () => {
    expect(modelOf({ exitCode: 1, stdout: '', stderr: 'a\nb: bad' }, 0)).toEqual({
      kind: 'error',
      text: 'osascript exited 1: b: bad',
    })
  })

  test('non-JSON and unknown states are errors', async () => {
    expect(modelOf({ exitCode: 0, stdout: 'nope', stderr: '' }, 0).kind).toBe('error')
    expect(modelOf({ exitCode: 0, stdout: '{"state":"dancing"}', stderr: '' }, 0).kind).toBe('error')
  })

  test('each control has its own AppleScript', async () => {
    expect(controlArgvOf('next')).toEqual(['osascript', '-e', 'tell application "Music" to next track'])
    expect(controlArgvOf('playpause')[2]).toContain('playpause')
  })

  test('clocks and bars', async () => {
    expect(clockOf(0)).toBe('0:00')
    expect(clockOf(197.9)).toBe('3:17')
    expect(clockOf(3725)).toBe('1:02:05')
    expect(barOf(0.5, 10)).toBe('█████░░░░░')
    expect(barOf(2, 4)).toBe('████')
    expect(barOf(-1, 4)).toBe('░░░░')
    expect(barOf(Number.NaN, 3)).toBe('░░░')
  })
})
