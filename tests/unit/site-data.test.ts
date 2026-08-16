import { describe, expect, it } from 'vitest';
import {
  formatSiteDataFieldValue,
  siteDataFields,
  siteDataJson,
  siteDataRowId,
  siteDataSiteLabel,
} from '../../src/internal/services/siteData';
import type { SiteDataRecord } from '../../src/types/drivePage';

/**
 * Drawing the per-site records the browser keeps.
 *
 * Everything in `datas` is arbitrary JSON a site wrote, so the whole file is
 * about not letting a site's choices break the table: a cycle must not throw a
 * render, a nested object must not be dumped into a cell, and the row must be
 * named after the site rather than after the title the site picked - two
 * different sites will both call theirs "My profile".
 */

const record = (over: Partial<SiteDataRecord> = {}): SiteDataRecord => ({
  siteKey: 'domain:example.lumen',
  profileId: 'p1',
  datas: {},
  ...over,
} as SiteDataRecord);

describe('siteDataRowId', () => {
  it('identifies a record by its site and profile together', () => {
    // Either alone collides: the same site under two profiles is two records.
    expect(siteDataRowId(record())).toBe('domain:example.lumen|p1');
    expect(siteDataRowId(record({ profileId: 'p2' }))).not.toBe(siteDataRowId(record()));
  });

  it('still produces an id when a part is missing', () => {
    expect(siteDataRowId({} as SiteDataRecord)).toBe('|');
  });
});

describe('siteDataSiteLabel', () => {
  it('shows a domain plainly', () => {
    expect(siteDataSiteLabel(record({ siteKey: 'domain:example.lumen' }))).toBe('example.lumen');
  });

  it('keeps the scheme and shortens the identifier for ipfs and ipns', () => {
    const cid = 'bafybeigdyrztktx5w6c7ldrmpmuvxvmxvzgmz2gk3qk3sczlnbltbztbla';
    expect(siteDataSiteLabel(record({ siteKey: `ipfs:${cid}` })))
      .toBe(`ipfs:${cid.slice(0, 8)}...${cid.slice(-6)}`);
    expect(siteDataSiteLabel(record({ siteKey: `ipns:${cid}` }))).toMatch(/^ipns:/);
  });

  it('leaves a short identifier uncut', () => {
    expect(siteDataSiteLabel(record({ siteKey: 'ipfs:short' }))).toBe('ipfs:short');
  });

  it('names an unrecognised key rather than showing nothing', () => {
    expect(siteDataSiteLabel(record({ siteKey: 'weird-key' }))).toBe('weird-key');
    expect(siteDataSiteLabel(record({ siteKey: '' }))).toBe('Unknown site');
    expect(siteDataSiteLabel({} as SiteDataRecord)).toBe('Unknown site');
  });
});

describe('formatSiteDataFieldValue', () => {
  it('shows scalars as they are', () => {
    expect(formatSiteDataFieldValue('hello')).toBe('hello');
    expect(formatSiteDataFieldValue(42)).toBe('42');
    expect(formatSiteDataFieldValue(false)).toBe('false');
  });

  it('marks an absent value with a dash', () => {
    expect(formatSiteDataFieldValue(null)).toBe('—');
    expect(formatSiteDataFieldValue(undefined)).toBe('—');
  });

  it('summarises a nested value instead of dumping it into the cell', () => {
    // A flat, scannable table is the point of this view; the raw JSON is one
    // click away for anyone who wants everything.
    expect(formatSiteDataFieldValue([1, 2, 3])).toBe('3 items');
    expect(formatSiteDataFieldValue([1])).toBe('1 item');
    expect(formatSiteDataFieldValue([])).toBe('0 items');
    expect(formatSiteDataFieldValue({ a: 1, b: 2 })).toBe('2 fields');
    expect(formatSiteDataFieldValue({ a: 1 })).toBe('1 field');
  });

  it('cuts a long string so one field cannot own the row', () => {
    const long = 'x'.repeat(500);
    const shown = formatSiteDataFieldValue(long);
    expect(shown).toHaveLength(141);
    expect(shown.endsWith('…')).toBe(true);
  });
});

describe('siteDataFields', () => {
  it('lists each field with its value already formatted', () => {
    expect(siteDataFields(record({ datas: { name: 'Ada', tags: ['a', 'b'] } })))
      .toEqual([{ key: 'name', value: 'Ada' }, { key: 'tags', value: '2 items' }]);
  });

  it('lists nothing when there is nothing, whatever shape datas arrived in', () => {
    // A site controls this value entirely, so it can be an array or a string.
    for (const datas of [undefined, null, [], 'a string', 42]) {
      expect(siteDataFields(record({ datas } as never))).toEqual([]);
    }
  });
});

describe('siteDataJson', () => {
  it('pretty-prints the record', () => {
    expect(siteDataJson(record({ datas: { a: 1 } }))).toBe('{\n  "a": 1\n}');
  });

  it('shows an empty object when there is no data', () => {
    expect(siteDataJson(record({ datas: undefined } as never))).toBe('{}');
  });

  it('gives an empty pane rather than throwing on a cycle', () => {
    // Arbitrary site-defined JSON can carry one, and a thrown render takes the
    // whole page with it.
    const cyclic: any = { name: 'x' };
    cyclic.self = cyclic;
    expect(siteDataJson(record({ datas: cyclic }))).toBe('');
  });
});
