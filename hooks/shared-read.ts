/**
 * One reading of Music.app shared by every session on the machine: each
 * session looks at a small file under the temporary directory first and runs
 * osascript only when the reading there is older than it can use, so five
 * open sessions cost one read per interval, not five.
 */

/** A finished osascript run, as `$.process.run` resolves it. */
export type Run = { exitCode: number; stdout: string; stderr: string }

/**
 * What the shared file holds: when the reading was taken (milliseconds since
 * the epoch) and the run it came from, or null while the first read is
 * still under way.
 */
export type Entry = { readAt: number; run: Run | null }

/** The shared file's name under the temporary directory. */
export const CACHE_NAME = 'music-mod/now.json'

/**
 * The shared file's path.
 *
 * @param tmpdir `TMPDIR`, when set
 * @returns the path under it, else under /tmp
 */
export function cachePathOf(tmpdir: string | undefined): string {
  const dir = tmpdir && tmpdir !== '' ? tmpdir : '/tmp'

  return `${dir.replace(/\/+$/, '')}/${CACHE_NAME}`
}

function isRun(value: unknown): value is Run {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const run = value as Record<string, unknown>

  return typeof run.exitCode === 'number' && typeof run.stdout === 'string' && typeof run.stderr === 'string'
}

/**
 * The entry a shared file's text stands for.
 *
 * @param text the file's content
 * @returns the entry, or null when the text is not one
 */
export function entryOf(text: string): Entry | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null
  }

  const { readAt, run } = parsed as Record<string, unknown>

  if (typeof readAt !== 'number' || !Number.isFinite(readAt)) {
    return null
  }

  return { readAt, run: isRun(run) ? run : null }
}

/**
 * Whether an entry is recent enough to use instead of a new read. An entry
 * from the future (a clock set back) is never fresh.
 *
 * @param entry what the shared file holds
 * @param at now, milliseconds since the epoch
 * @param maxAgeMs the oldest reading the caller takes
 * @returns whether to use it
 */
export function isFresh(entry: Entry | null, at: number, maxAgeMs: number): entry is Entry {
  return entry !== null && entry.readAt <= at && at - entry.readAt < maxAgeMs
}
