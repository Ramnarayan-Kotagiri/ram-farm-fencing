import { describe, it, expect, vi, afterEach } from 'vitest';
import { preset, emptyInspection } from '../src/data/scenarios';
import { defaultRates } from '../src/data/pricing';
import { shareUrl, readConfig, csvRows } from '../src/utils/exports';
afterEach(() => vi.unstubAllGlobals());
describe('portable configurations', () => {
  it('shares the active rates and Unicode notes but omits photos', () => {
    vi.stubGlobal('location', { href: 'https://example.test/farm/#hybrid' });
    const s = preset();
    s.inspections['W-test'] = {
      ...emptyInspection,
      notes: 'Road వద్ద inspected',
      photo: 'data:image/png;base64,AAA',
    };
    const url = shareUrl(s, { ...defaultRates, pole: 500 });
    const decoded = JSON.parse(decodeURIComponent(escape(atob(url.split('#plan=')[1]))));
    expect(decoded.rates.pole).toBe(500);
    expect(decoded.scenario.inspections['W-test'].notes).toBe('Road వద్ద inspected');
    expect(decoded.scenario.inspections['W-test'].photo).toBe('');
    expect(s.inspections['W-test'].photo).not.toBe('');
    expect(readConfig(JSON.stringify(decoded))).toEqual(decoded.scenario);
  });
  it('roundtrips the full state envelope', () => {
    const scenario = preset('all');
    expect(readConfig(JSON.stringify({ scenario, rates: defaultRates, saved: [] }))).toEqual(
      scenario,
    );
  });
  it('rejects malformed or topologically invalid imported plans', () => {
    expect(() => readConfig('{')).toThrow();
    const s = preset();
    s.sections.E[0].start = 0.5;
    expect(() => readConfig(JSON.stringify(s))).toThrow();
  });
  it('parses quoted CSV notes, embedded commas and CRLF correctly', () => {
    expect(
      csvRows('post_id,chainage_ft,notes\r\nW-1,0,"checked, good"\r\nW-2,8,"said ""reuse"""'),
    ).toEqual([
      ['post_id', 'chainage_ft', 'notes'],
      ['W-1', '0', 'checked, good'],
      ['W-2', '8', 'said "reuse"'],
    ]);
  });
});
