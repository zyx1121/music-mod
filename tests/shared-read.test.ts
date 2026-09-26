import { describe, expect, test, tier } from 'claude-code/testing'

import { cachePathOf, entryOf, isFresh } from '../hooks/shared-read'

tier('user')

describe('shared-read', () => {
  test('the file sits under TMPDIR, else /tmp', async () => {
    expect(cachePathOf('/var/folders/x/T/')).toBe('/var/folders/x/T/music-mod/now.json')
    expect(cachePathOf('/var/folders/x/T')).toBe('/var/folders/x/T/music-mod/now.json')
    expect(cachePathOf(undefined)).toBe('/tmp/music-mod/now.json')
    expect(cachePathOf('')).toBe('/tmp/music-mod/now.json')
  })

  test('an entry parses with its run, or with none while a read is under way', async () => {
    const run = { exitCode: 0, stdout: '{}', stderr: '' }

    expect(entryOf(JSON.stringify({ readAt: 5, run }))).toEqual({ readAt: 5, run })
    expect(entryOf(JSON.stringify({ readAt: 5, run: null }))).toEqual({ readAt: 5, run: null })
    expect(entryOf(JSON.stringify({ readAt: 5, run: { exitCode: 'x' } }))).toEqual({ readAt: 5, run: null })
  })

  test('what is not an entry is null', async () => {
    expect(entryOf('nope')).toBeNull()
    expect(entryOf('null')).toBeNull()
    expect(entryOf(JSON.stringify({ run: null }))).toBeNull()
  })

  test('fresh means younger than the age asked, and never from the future', async () => {
    const entry = { readAt: 1000, run: null }

    expect(isFresh(entry, 1000, 5000)).toBe(true)
    expect(isFresh(entry, 5999, 5000)).toBe(true)
    expect(isFresh(entry, 6000, 5000)).toBe(false)
    expect(isFresh(entry, 500, 5000)).toBe(false)
    expect(isFresh(entry, 1000, 0)).toBe(false)
    expect(isFresh(null, 1000, 5000)).toBe(false)
  })
})
