'use strict';

// ---------------------------------------------------------------------------
// Privacy Score — metodologia
//
// Ponto de partida: 100
// Deduções por categoria:
//   Terceiros:      -3 por domínio (máx. -30) | -5 por rastreador conhecido (máx. -15)
//   Cookies 3ª p.:  -3 por cookie  (máx. -15)
//   Persistentes:   -2 por cookie  (máx. -10)
//   Supercookies:   -10 por ETag   (máx. -20)
//   Cookie syncing: -5 por sinal   (máx. -10)
//   localStorage:   -2 por entrada (máx. -10)
//   sessionStorage: -1 por entrada (máx. -5)
//   IndexedDB:      -3 por banco   (máx. -9)
//   Canvas FP:      -15 (único)
//   WebGL FP:       -10 (único)
//   AudioContext FP:-10 (único)
//   Scripts susp.:  -10 por script (máx. -20)
//   Redirects:      -15 por evento (máx. -15)
//
// Classificação:
//   80-100 → Boa  |  50-79 → Moderada  |  20-49 → Ruim  |  0-19 → Crítica
// ---------------------------------------------------------------------------

function computePrivacyScore(data) {
  let score = 100;
  const breakdown = [];

  function deduct(amount, label) {
    if (amount <= 0) return;
    score -= amount;
    breakdown.push({ amount, label });
  }

  // Terceiros
  const tpCount = data.thirdParties.length;
  deduct(Math.min(tpCount * 3, 30), `${tpCount} domínio(s) de terceiros detectados`);

  const trackers = data.thirdParties.filter(t => t.isSuspected).length;
  deduct(Math.min(trackers * 5, 15), `${trackers} rastreador(es) conhecido(s)`);

  // Cookies
  deduct(Math.min(data.cookies.thirdParty.length * 3, 15),
    `${data.cookies.thirdParty.length} cookie(s) de terceira parte`);
  deduct(Math.min(data.cookies.persistent.length * 2, 10),
    `${data.cookies.persistent.length} cookie(s) persistente(s)`);
  deduct(Math.min(data.cookies.supercookies.length * 10, 20),
    `${data.cookies.supercookies.length} supercookie(s) via ETag`);
  deduct(Math.min(data.cookieSyncing.length * 5, 10),
    `${data.cookieSyncing.length} sinal(is) de cookie syncing`);

  // Storage
  deduct(Math.min(data.storage.localStorage.length * 2, 10),
    `${data.storage.localStorage.length} entrada(s) no localStorage`);
  deduct(Math.min(data.storage.sessionStorage.length * 1, 5),
    `${data.storage.sessionStorage.length} entrada(s) no sessionStorage`);
  deduct(Math.min(data.storage.indexedDB.length * 3, 9),
    `${data.storage.indexedDB.length} banco(s) IndexedDB`);

  // Fingerprinting
  if (data.fingerprinting.canvas > 0)
    deduct(15, `Canvas fingerprinting (${data.fingerprinting.canvas} chamada(s))`);
  if (data.fingerprinting.webgl > 0)
    deduct(10, `WebGL fingerprinting (${data.fingerprinting.webgl} chamada(s))`);
  if (data.fingerprinting.audio > 0)
    deduct(10, `AudioContext fingerprinting (${data.fingerprinting.audio} chamada(s))`);

  // Hijacking
  deduct(Math.min(data.hijacking.suspiciousScripts.length * 10, 20),
    `${data.hijacking.suspiciousScripts.length} script(s) externo(s) suspeito(s)`);
  deduct(Math.min(data.hijacking.redirectAttempts.length * 15, 15),
    `${data.hijacking.redirectAttempts.length} redirecionamento(s) entre domínios`);

  return { score: Math.max(0, score), breakdown };
}

function scoreClass(s) {
  if (s >= 80) return 'good';
  if (s >= 50) return 'moderate';
  if (s >= 20) return 'poor';
  return 'critical';
}

function scoreLabel(s) {
  if (s >= 80) return 'Boa privacidade';
  if (s >= 50) return 'Privacidade moderada';
  if (s >= 20) return 'Privacidade ruim';
  return 'Privacidade crítica';
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function empty(msg) {
  return `<p class="empty">${msg}</p>`;
}

function badge(text, cls) {
  return `<span class="badge ${cls || ''}">${text}</span>`;
}

function tag(text) {
  return `<span class="tag">${text}</span>`;
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function renderThirdParties(data) {
  const el = document.getElementById('third-list');
  if (!data.thirdParties.length) {
    el.innerHTML = empty('Nenhum domínio de terceiro detectado.');
    return;
  }

  el.innerHTML = data.thirdParties
    .slice()
    .sort((a, b) => b.count - a.count)
    .map(tp => `
      <div class="item ${tp.isSuspected ? 'danger' : ''}">
        <div class="item-row">
          <span class="host">${tp.host}</span>
          <span class="count">${tp.count} req.</span>
          ${tp.isSuspected ? badge('rastreador', 'danger') : ''}
        </div>
        <div class="tags">${tp.types.map(t => tag(t)).join('')}</div>
      </div>
    `).join('');
}

function renderCookies(data) {
  const { cookies, cookieSyncing } = data;

  document.getElementById('cookie-summary').innerHTML = `
    <div class="stats-grid">
      <div class="stat"><strong>${cookies.firstParty.length}</strong>1ª parte</div>
      <div class="stat"><strong>${cookies.thirdParty.length}</strong>3ª parte</div>
      <div class="stat"><strong>${cookies.session.length}</strong>Sessão</div>
      <div class="stat"><strong>${cookies.persistent.length}</strong>Persistente</div>
      <div class="stat"><strong>${cookies.supercookies.length}</strong>Supercookie</div>
    </div>
  `;

  let html = '';

  if (cookies.supercookies.length) {
    html += '<h3>Supercookies — ETags de terceiros</h3>';
    html += cookies.supercookies.map(sc => `
      <div class="item danger">
        <div class="item-row">
          <span class="host">${sc.domain}</span>
          ${badge('ETag', 'danger')}
        </div>
        <div class="detail">${sc.value}</div>
      </div>
    `).join('');
  }

  if (cookieSyncing.length) {
    html += '<h3>Cookie Syncing detectado</h3>';
    html += cookieSyncing.map(cs => `
      <div class="item warn">
        <div class="item-row">
          <span class="host">${cs.host}</span>
          ${badge('syncing', 'warn')}
        </div>
        <div class="detail">parâmetro: ${cs.param} = ${cs.hint}</div>
      </div>
    `).join('');
  }

  if (cookies.all.length) {
    html += '<h3>Cookies via Set-Cookie</h3>';
    html += cookies.all.slice(0, 25).map(c => `
      <div class="item ${c.isThirdParty ? 'warn' : ''}">
        <div class="item-row">
          <span class="host">${c.host}</span>
          <span class="name">${c.name}</span>
          ${c.isThirdParty ? badge('3ª parte', 'warn') : ''}
          ${badge(c.isSession ? 'sessão' : 'persistente', '')}
        </div>
      </div>
    `).join('');
    if (cookies.all.length > 25) {
      html += `<p class="more">… e mais ${cookies.all.length - 25} cookie(s)</p>`;
    }
  } else if (!cookies.supercookies.length && !cookieSyncing.length) {
    html = empty('Nenhum cookie detectado via cabeçalhos HTTP.');
  }

  document.getElementById('cookie-list').innerHTML = html;
}

function renderStorage(data) {
  const el = document.getElementById('storage-list');
  let html = '';

  if (data.storage.localStorage.length) {
    html += '<h3>localStorage</h3>';
    html += data.storage.localStorage.map(e => `
      <div class="item">
        <div class="item-row">
          <span class="name">${e.key}</span>
          <span class="size">${e.size} B</span>
        </div>
        <div class="detail">${e.domain}</div>
      </div>
    `).join('');
  }

  if (data.storage.sessionStorage.length) {
    html += '<h3>sessionStorage</h3>';
    html += data.storage.sessionStorage.map(e => `
      <div class="item">
        <div class="item-row">
          <span class="name">${e.key}</span>
          <span class="size">${e.size} B</span>
        </div>
        <div class="detail">${e.domain}</div>
      </div>
    `).join('');
  }

  if (data.storage.indexedDB.length) {
    html += '<h3>IndexedDB</h3>';
    html += data.storage.indexedDB.map(db => `
      <div class="item">
        <div class="item-row">
          <span class="name">${db.name}</span>
          ${badge(`v${db.version}`, '')}
        </div>
        <div class="detail">${db.domain}</div>
      </div>
    `).join('');
  }

  el.innerHTML = html || empty('Nenhum dado de armazenamento detectado.');
}

function renderFingerprinting(data) {
  const entries = [
    {
      label: 'Canvas API',
      count: data.fingerprinting.canvas,
      detail: 'toDataURL · getImageData'
    },
    {
      label: 'WebGL',
      count: data.fingerprinting.webgl,
      detail: 'getParameter · WEBGL_debug_renderer_info'
    },
    {
      label: 'AudioContext',
      count: data.fingerprinting.audio,
      detail: 'createOscillator · createDynamicsCompressor'
    }
  ];

  document.getElementById('fp-list').innerHTML = entries.map(e => `
    <div class="item ${e.count > 0 ? 'danger' : 'safe'}">
      <div class="fp-row">
        <span class="host">${e.label}</span>
        ${e.count > 0
          ? badge(`${e.count}× detectado`, 'danger')
          : badge('não detectado', 'safe')}
      </div>
      <div class="detail">${e.detail}</div>
    </div>
  `).join('');
}

function renderBreakdown(score, breakdown) {
  const el = document.getElementById('score-breakdown');
  if (!breakdown.length) {
    el.innerHTML = `<h3>Score: ${score}/100 — nenhuma penalidade</h3>`;
    return;
  }
  el.innerHTML = `
    <h3>Composição do Privacy Score — ${score}/100</h3>
    <ul>
      ${breakdown.map(b => `<li>−${b.amount} &nbsp; ${b.label}</li>`).join('')}
    </ul>
  `;
}

function renderHijacking(data) {
  const el = document.getElementById('hijack-list');
  let html = '';

  if (data.hijacking.suspiciousScripts.length) {
    html += '<h3>Scripts externos de rastreadores conhecidos</h3>';
    html += data.hijacking.suspiciousScripts.map(s => `
      <div class="item danger">
        <div class="item-row">
          <span class="host">${s}</span>
          ${badge('rastreador', 'danger')}
        </div>
        <div class="detail">Script externo de domínio de rastreamento conhecido</div>
      </div>
    `).join('');
  }

  if (data.hijacking.redirectAttempts.length) {
    html += '<h3>Redirecionamentos entre domínios</h3>';
    html += data.hijacking.redirectAttempts.map(r => `
      <div class="item warn">
        <div class="detail">${r.from} &rarr; ${r.to}</div>
      </div>
    `).join('');
  }

  el.innerHTML = html || empty('Nenhuma ameaça de hijacking detectada.');
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

function render(data) {
  if (!data || data.empty) {
    document.querySelector('main').innerHTML =
      empty('Navegue para uma página para analisar a privacidade.');
    return;
  }

  const { score, breakdown } = computePrivacyScore(data);

  const scoreEl = document.getElementById('score-value');
  scoreEl.textContent = score;
  scoreEl.className = scoreClass(score);
  document.getElementById('score-label').textContent = scoreLabel(score);

  renderThirdParties(data);
  renderCookies(data);
  renderStorage(data);
  renderFingerprinting(data);
  renderBreakdown(score, breakdown);
  renderHijacking(data);
}

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

browser.runtime.sendMessage({ type: 'GET_DATA' })
  .then(render)
  .catch(() => {
    document.querySelector('main').innerHTML =
      empty('Erro ao carregar dados. Tente recarregar a página.');
  });
