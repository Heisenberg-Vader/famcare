import { describe, expect, it } from 'vitest';
import { FORBIDDEN_CACHE_HOSTS, pwaOptions } from '../../pwa.config.js';

const sampleUrls = [
  'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
  'https://securetoken.googleapis.com/v1/token',
  'https://famcare-7e3db.firebaseio.com/x',
];

function matches(pattern, url) {
  if (pattern instanceof RegExp) return pattern.test(url);
  if (typeof pattern === 'string') return url.startsWith(pattern);
  if (typeof pattern === 'function') return pattern({ url: new URL(url), sameOrigin: false });
  return false;
}

describe('service worker caching', () => {
  it('has no runtime caching rule that matches Google or Firebase API traffic', () => {
    for (const rule of pwaOptions.workbox.runtimeCaching ?? []) {
      for (const url of sampleUrls) expect(matches(rule.urlPattern, url)).toBe(false);
    }
    expect(FORBIDDEN_CACHE_HOSTS).toContain('googleapis.com');
  });

  it('precaches only static build assets', () => {
    expect(pwaOptions.workbox.globPatterns.join(' ')).not.toMatch(/json/);
    expect(
      pwaOptions.workbox.navigateFallbackDenylist.some((r) => r.test('/__/auth/handler')),
    ).toBe(true);
  });
});

describe('precache contents', () => {
  it('leaves the family-only report and chart chunks out of the install download', () => {
    const ignores = pwaOptions.workbox.globIgnores.join(' ');
    for (const chunk of ['buildReport', 'html2canvas', 'MetricPlot']) {
      expect(ignores).toContain(chunk);
    }
    expect(ignores).not.toMatch(/NurseHome|firebase|react/);
  });
});
