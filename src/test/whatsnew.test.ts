import { describe, expect, it } from 'vitest'
import { currentVersion, parseChangelog, shippedEntries, unseenEntries } from '../modules/whatsnew/whatsnew'

const SAMPLE = `# Changelog

## [Unreleased]

### Added
- unreleased work in progress

## [26.10.31.1] - 2026-10-31

### Fixed
- Fixed a race
- Added a thing
  - nested detail

## [26.10.30.2] - 2026-10-30

## [26.10.30.1] - 2026-10-30

### Added
- Older change
`

describe('parseChangelog', () => {
  it('parses headings and bullets, skipping Unreleased', () => {
    const entries = parseChangelog(SAMPLE)
    expect(entries.map((e) => e.version)).toEqual(['26.10.31.1', '26.10.30.2', '26.10.30.1'])
    expect(entries[0].items).toEqual(['Fixed a race', 'Added a thing', 'nested detail'])
    expect(entries[0].date).toBe('2026-10-31')
  })

  it('takes the newest heading as the current version', () => {
    expect(currentVersion(parseChangelog(SAMPLE))).toBe('26.10.31.1')
  })
})

describe('unseenEntries', () => {
  it('filters older and empty sections', () => {
    const entries = parseChangelog(SAMPLE)
    expect(unseenEntries(entries, '26.10.30.2').map((e) => e.version)).toEqual(['26.10.31.1'])
    expect(unseenEntries(entries, '26.10.31.1')).toEqual([])
    expect(unseenEntries([], '')).toEqual([])
  })

  it('compares versions numerically per segment', () => {
    const entries = [
      { version: '26.10.31.10', date: null, items: ['ten'] },
      { version: '26.10.31.2', date: null, items: ['two'] },
    ]
    expect(unseenEntries(entries, '26.10.31.2').map((e) => e.version)).toEqual(['26.10.31.10'])
  })
})

describe('shipped changelog', () => {
  it('yields at least one released entry', () => {
    const entries = shippedEntries()
    expect(entries.length).toBeGreaterThan(0)
    expect(entries[0].items.length).toBeGreaterThan(0)
  })
})
