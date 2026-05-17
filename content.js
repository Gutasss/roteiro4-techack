'use strict';

// Injected directly into the page context so it can wrap native prototype methods
// before any page script runs. Communicates back via postMessage.
function injectPageScript(code) {
  const script = document.createElement('script');
  script.textContent = code;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

const INTERCEPT_CODE = `(function () {
  'use strict';

  function notify(api) {
    window.postMessage({ __PTD_EVENT__: true, api: api }, '*');
  }

  // --- Canvas fingerprinting ---
  const _toDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function () {
    notify('canvas');
    return _toDataURL.apply(this, arguments);
  };

  const _getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type) {
    var ctx = _getContext.apply(this, arguments);
    if (ctx && type === '2d' && !ctx.__ptd_patched__) {
      ctx.__ptd_patched__ = true;
      var _getImageData = ctx.getImageData.bind(ctx);
      ctx.getImageData = function () {
        notify('canvas');
        return _getImageData.apply(this, arguments);
      };
    }
    return ctx;
  };

  // --- WebGL fingerprinting ---
  function patchWebGL(proto) {
    var _getParameter = proto.getParameter;
    proto.getParameter = function (param) {
      // RENDERER, VENDOR, UNMASKED_RENDERER_WEBGL, UNMASKED_VENDOR_WEBGL
      if (param === 0x1F01 || param === 0x1F00 || param === 0x9246 || param === 0x9245) {
        notify('webgl');
      }
      return _getParameter.apply(this, arguments);
    };

    var _getExtension = proto.getExtension;
    proto.getExtension = function (name) {
      if (name === 'WEBGL_debug_renderer_info') notify('webgl');
      return _getExtension.apply(this, arguments);
    };
  }

  if (typeof WebGLRenderingContext  !== 'undefined') patchWebGL(WebGLRenderingContext.prototype);
  if (typeof WebGL2RenderingContext !== 'undefined') patchWebGL(WebGL2RenderingContext.prototype);

  // --- AudioContext fingerprinting ---
  function patchAudio(Ctor) {
    var _createOscillator = Ctor.prototype.createOscillator;
    Ctor.prototype.createOscillator = function () {
      notify('audio');
      return _createOscillator.apply(this, arguments);
    };

    var _createDynamicsCompressor = Ctor.prototype.createDynamicsCompressor;
    Ctor.prototype.createDynamicsCompressor = function () {
      notify('audio');
      return _createDynamicsCompressor.apply(this, arguments);
    };
  }

  if (typeof AudioContext        !== 'undefined') patchAudio(AudioContext);
  if (typeof OfflineAudioContext !== 'undefined') patchAudio(OfflineAudioContext);

  // --- Redirect hijacking: watch location changes ---
  var _assign   = window.location.assign.bind(window.location);
  var _replace  = window.location.replace.bind(window.location);

  Object.defineProperty(window.location, 'assign', {
    get: function () {
      return function (url) {
        window.postMessage({ __PTD_REDIRECT__: true, url: url }, '*');
        return _assign(url);
      };
    }
  });

  Object.defineProperty(window.location, 'replace', {
    get: function () {
      return function (url) {
        window.postMessage({ __PTD_REDIRECT__: true, url: url }, '*');
        return _replace(url);
      };
    }
  });
})();`;

injectPageScript(INTERCEPT_CODE);

// Deduplicate fingerprint signals to avoid flooding the background
const notifiedApis = new Set();

window.addEventListener('message', (event) => {
  if (!event.data || event.source !== window) return;

  if (event.data.__PTD_EVENT__) {
    const api = event.data.api;
    if (!notifiedApis.has(api)) {
      notifiedApis.add(api);
      browser.runtime.sendMessage({ type: 'FINGERPRINT', api });
    }
  }
});

// --- Web Storage & IndexedDB collector ---
function collectStorageData() {
  const ls  = [];
  const ss  = [];
  const idb = [];
  const domain = location.hostname;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key   = localStorage.key(i);
      const value = localStorage.getItem(key) || '';
      ls.push({ key, size: key.length + value.length, domain });
    }
  } catch {}

  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key   = sessionStorage.key(i);
      const value = sessionStorage.getItem(key) || '';
      ss.push({ key, size: key.length + value.length, domain });
    }
  } catch {}

  const send = () => browser.runtime.sendMessage({
    type: 'STORAGE_DATA',
    data: { localStorage: ls, sessionStorage: ss, indexedDB: idb }
  });

  if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
    indexedDB.databases()
      .then((dbs) => {
        dbs.forEach(db => idb.push({ name: db.name, version: db.version, domain }));
        send();
      })
      .catch(send);
  } else {
    send();
  }
}

window.addEventListener('load', () => {
  collectStorageData();
  // Catch storage set after load (e.g. lazy-init trackers)
  setTimeout(collectStorageData, 3000);
});
