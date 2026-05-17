'use strict';

// Per-tab state: domains, cookies, storage, fingerprinting, hijacking
const tabData = new Map();

const KNOWN_TRACKERS = new Set([
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'googletagmanager.com', 'googletagservices.com', 'google-analytics.com',
  'facebook.net', 'connect.facebook.net', 'fbcdn.net',
  'hotjar.com', 'clarity.ms', 'quantserve.com', 'scorecardresearch.com',
  'outbrain.com', 'taboola.com', 'advertising.com', 'adsystem.amazon.com',
  'adsrvr.org', 'adnxs.com', 'pubmatic.com', 'rubiconproject.com',
  'openx.net', 'criteo.com', 'chartbeat.com', 'newrelic.com',
  'optimizely.com', 'segment.com', 'mixpanel.com', 'amplitude.com',
  'intercom.io', 'zendesk.com', 'hubspot.com', 'pardot.com'
]);

function getHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

function getEffectiveDomain(host) {
  const parts = host.split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : host;
}

function isThirdParty(reqHost, pageHost) {
  if (!reqHost || !pageHost) return false;
  return getEffectiveDomain(reqHost) !== getEffectiveDomain(pageHost);
}

function initTab(tabId, url) {
  tabData.set(tabId, {
    pageUrl: url,
    pageHost: getHostname(url),
    thirdParties: new Map(),
    cookieHeaders: [],
    eTags: [],
    storage: { localStorage: [], sessionStorage: [], indexedDB: [] },
    fingerprinting: { canvas: 0, webgl: 0, audio: 0 },
    hijacking: { suspiciousScripts: [], redirectAttempts: [] },
    cookieSyncing: []
  });
}

// Heuristic: URL params that look like user ID tokens being passed cross-domain
function detectCookieSyncing(url, reqHost, tab) {
  try {
    const params = new URL(url).searchParams;
    for (const [key, value] of params) {
      const k = key.toLowerCase();
      if (
        value.length >= 16 &&
        /^[a-zA-Z0-9_\-=+/]{16,}$/.test(value) &&
        /uid|userid|user_id|uuid|id|pid|cid|visitor|guid|ruid/.test(k)
      ) {
        if (!tab.cookieSyncing.find(s => s.host === reqHost && s.param === key)) {
          tab.cookieSyncing.push({ host: reqHost, param: key, hint: value.slice(0, 8) + '...' });
        }
      }
    }
  } catch {}
}

// --- webRequest listeners ---

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { tabId, url, type } = details;
    if (tabId < 0) return;

    const tab = tabData.get(tabId);
    if (!tab || !tab.pageHost) return;

    const reqHost = getHostname(url);
    if (!isThirdParty(reqHost, tab.pageHost)) return;

    if (!tab.thirdParties.has(reqHost)) {
      tab.thirdParties.set(reqHost, { count: 0, types: new Set() });
    }
    const entry = tab.thirdParties.get(reqHost);
    entry.count++;
    entry.types.add(type);

    if (type === 'script' && KNOWN_TRACKERS.has(reqHost)) {
      if (!tab.hijacking.suspiciousScripts.includes(reqHost)) {
        tab.hijacking.suspiciousScripts.push(reqHost);
      }
    }

    detectCookieSyncing(url, reqHost, tab);
  },
  { urls: ['<all_urls>'] }
);

browser.webRequest.onBeforeRedirect.addListener(
  (details) => {
    const { tabId, url, redirectUrl, type } = details;
    if (tabId < 0 || type !== 'main_frame') return;

    const tab = tabData.get(tabId);
    if (!tab) return;

    const fromHost = getHostname(url);
    const toHost   = getHostname(redirectUrl);
    if (fromHost && toHost && getEffectiveDomain(fromHost) !== getEffectiveDomain(toHost)) {
      tab.hijacking.redirectAttempts.push({ from: fromHost, to: toHost });
    }
  },
  { urls: ['<all_urls>'] }
);

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const { tabId, url, responseHeaders } = details;
    if (tabId < 0 || !responseHeaders) return;

    const tab = tabData.get(tabId);
    if (!tab) return;

    const reqHost = getHostname(url);
    const isTP    = isThirdParty(reqHost, tab.pageHost);

    for (const header of responseHeaders) {
      const name = header.name.toLowerCase();

      if (name === 'set-cookie') {
        const parts      = header.value.split(';').map(s => s.trim());
        const cookieName = parts[0].split('=')[0].trim();
        const isSession  = !parts.some(p =>
          p.toLowerCase().startsWith('expires=') || p.toLowerCase().startsWith('max-age=')
        );
        tab.cookieHeaders.push({
          name: cookieName,
          host: reqHost,
          isThirdParty: isTP,
          isSession,
          isPersistent: !isSession
        });
      }

      // ETag supercookies: third-party resources with long ETags
      if (name === 'etag' && isTP && header.value.replace(/"/g, '').length > 8) {
        if (!tab.eTags.find(e => e.domain === reqHost)) {
          tab.eTags.push({ domain: reqHost, value: header.value.slice(0, 14) + '...' });
        }
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// --- Tab lifecycle ---

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    initTab(tabId, changeInfo.url);
  }
});

browser.tabs.onRemoved.addListener((tabId) => tabData.delete(tabId));

// --- Message handler (content scripts + popup) ---

browser.runtime.onMessage.addListener((message, sender) => {
  // Messages arriving from content scripts have sender.tab
  if (sender.tab) {
    const tabId = sender.tab.id;
    if (!tabData.has(tabId)) initTab(tabId, sender.tab.url || '');
    const tab = tabData.get(tabId);

    if (message.type === 'FINGERPRINT') {
      if (message.api === 'canvas') tab.fingerprinting.canvas++;
      else if (message.api === 'webgl') tab.fingerprinting.webgl++;
      else if (message.api === 'audio') tab.fingerprinting.audio++;
      return;
    }

    if (message.type === 'STORAGE_DATA') {
      tab.storage = message.data;
      return;
    }

    return;
  }

  // Message from popup requesting current tab data
  if (message.type === 'GET_DATA') {
    return browser.tabs.query({ active: true, currentWindow: true }).then(([activeTab]) => {
      if (!activeTab) return null;
      const data = tabData.get(activeTab.id);
      if (!data) return { empty: true };

      return {
        pageUrl: data.pageUrl,
        pageHost: data.pageHost,
        thirdParties: Array.from(data.thirdParties.entries()).map(([host, info]) => ({
          host,
          count: info.count,
          types: Array.from(info.types),
          isSuspected: KNOWN_TRACKERS.has(host)
        })),
        cookies: {
          all: data.cookieHeaders,
          firstParty:  data.cookieHeaders.filter(c => !c.isThirdParty),
          thirdParty:  data.cookieHeaders.filter(c =>  c.isThirdParty),
          session:     data.cookieHeaders.filter(c =>  c.isSession),
          persistent:  data.cookieHeaders.filter(c =>  c.isPersistent),
          supercookies: data.eTags
        },
        storage: data.storage,
        fingerprinting: data.fingerprinting,
        hijacking: data.hijacking,
        cookieSyncing: data.cookieSyncing
      };
    });
  }
});
