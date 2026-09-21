import { describe, expect, test, tier } from 'claude-code/testing'

import { barOf, clockOf, controlArgvOf, modelOf } from '../hooks/now-playing'
import * as Fixtures from './fixtures'

tier('user')

describe('now-playing', () => {
  test('a playing answer parses whole', async () => {
    const model = modelOf({ exitCode: 0, stdout: Fixtures.PLAYING, stderr: '' })

    expect(model.kind).toBe('ok')

    if (model.kind === 'ok') {
      expect(model.now.track?.name).toBe('FOREVER')
      expect(model.now.next).toEqual({ name: 'Klaxon', artist: 'i-dle' })
      expect(model.now.system).toEqual({ volume: 44, muted: true })
    }
  })

  test('a closed answer keeps the system volume', async () => {
    const model = modelOf({ exitCode: 0, stdout: Fixtures.CLOSED, stderr: '' })

    expect(model).toEqual({
      kind: 'ok',
      now: {
        state: 'closed',
        system: { volume: 44, muted: false },
        volume: null,
        shuffle: null,
        repeat: null,
        track: null,
        position: null,
        playlist: null,
        next: null,
      },
    })
  })

  test('a non-zero exit carries the last stderr line', async () => {
    expect(modelOf({ exitCode: 1, stdout: '', stderr: 'a\nb: bad' })).toEqual({
      kind: 'error',
      text: 'osascript exited 1: b: bad',
    })
  })

  test('non-JSON and unknown states are errors', async () => {
    expect(modelOf({ exitCode: 0, stdout: 'nope', stderr: '' }).kind).toBe('error')
    expect(modelOf({ exitCode: 0, stdout: '{"state":"dancing"}', stderr: '' }).kind).toBe('error')
  })

  test('each control has its own AppleScript', async () => {
    expect(controlArgvOf('next')).toEqual(['osascript', '-e', 'tell application "Music" to next track'])
    expect(controlArgvOf('previous')[2]).toContain('previous track')
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
