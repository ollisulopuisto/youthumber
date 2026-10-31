// What's New: turns the repo's CHANGELOG.md into dialog entries and decides
// when the dialog should open by itself. The changelog is the release history
// (release packaging treats its first `## [..]` heading as the version), so
// it is the one place this app documents what changed; the dialog surfaces it
// instead of inventing a second source. Vite inlines the file at build time,
// so the desktop DMG and the web build both ship exactly what was released.
import changelogRaw from '../../../CHANGELOG.md?raw'

export interface WhatsNewEntry {
  version: string
  date: string | null
  items: string[]
}

// Keep-a-Changelog calver: `## [26.10.30.1] - 2026-10-30`.
const HEADING = /^## \[(\d{2}\.\d{2}\.\d{2}\.\d+)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/

/** localStorage key for the newest version the user has been shown. */
export const SEEN_KEY = 'whats-new-seen'

export function parseChangelog(text: string): WhatsNewEntry[] {
  const entries: WhatsNewEntry[] = []
  let current: WhatsNewEntry | null = null
  for (const line of text.split('\n')) {
    const heading = HEADING.exec(line)
    if (heading) {
      if (current) entries.push(current)
      current = { version: heading[1], date: heading[2] ?? null, items: [] }
    } else if (line.startsWith('## ')) {
      // [Unreleased] or any other section: unreleased work is not news yet.
      if (current) entries.push(current)
      current = null
    } else if (current) {
      const stripped = line.trim()
      if (stripped.startsWith('- ')) current.items.push(stripped.slice(2))
    }
  }
  if (current) entries.push(current)
  return entries
}

/** The running build's version: the newest changelog heading. */
export function currentVersion(entries: WhatsNewEntry[]): string | null {
  return entries.length ? entries[0].version : null
}

function versionKey(version: string): number[] {
  return version.replace(/^v/, '').split('.').map(Number)
}

/** Entries newer than `lastSeen`, compared numerically per segment so
 *  26.10.31.10 sorts after 26.10.31.2. Empty sections are dropped so the
 *  dialog never shows a bare heading. */
export function unseenEntries(entries: WhatsNewEntry[], lastSeen: string): WhatsNewEntry[] {
  const seenKey = lastSeen ? versionKey(lastSeen) : null
  return entries.filter((entry) => {
    if (!entry.items.length) return false
    if (!seenKey) return true
    const key = versionKey(entry.version)
    for (let i = 0; i < Math.max(key.length, seenKey.length); i++) {
      const diff = (key[i] ?? 0) - (seenKey[i] ?? 0)
      if (diff !== 0) return diff > 0
    }
    return false
  })
}

/** The parsed shipped changelog (inlined by Vite at build time). */
export function shippedEntries(): WhatsNewEntry[] {
  return parseChangelog(changelogRaw)
}
