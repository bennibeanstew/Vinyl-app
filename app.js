/**
 * Vinyl Collection — Discogs-powered
 * Uses the public Discogs API (no auth required for public collections)
 */

// ── State ─────────────────────────────────────────────
const state = {
  username: '',
  albums: [],
  currentMode: 'az',
  currentFilter: null,
  currentIndex: 0,
  visibleAlbums: [],
};

// ── DOM refs ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const els = {
  syncText: $('sync-text'),
  countNumber: $('count-number'),
  albumCount: $('album-count'),
  detailsPanel: $('details-panel'),
  showDetailsBtn: $('show-details-btn'),
  discogsUsernameDisplay: $('discogs-username-display'),
  sortFilters: $('sort-filters'),
  searchContainer: $('search-container'),
  searchInput: $('search-input'),
  statsSection: $('stats-section'),
  statsContent: $('stats-content'),
  loadingState: $('loading-state'),
  errorState: $('error-state'),
  errorMsg: $('error-msg'),
  collectionOutput: $('collection-output'),
  albumModal: $('album-modal'),
  modalCover: $('modal-cover'),
  modalInfo: $('modal-info'),
  closeModal: $('close-modal'),
  modalPrev: $('modal-prev'),
  modalNext: $('modal-next'),
  randomBtn: $('random-btn'),
  siteFooter: $('site-footer'),
  discogsLink: $('discogs-link'),
  lastSyncFooter: $('last-sync-footer'),
  mainContent: $('main-content'),
  sortNav: $('sort-nav'),
};

// ── Init ──────────────────────────────────────────────
function init() {
  const params = new URLSearchParams(location.search);
  state.username = params.get('username') || '';

  // Sort button listeners
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  els.showDetailsBtn.addEventListener('click', () => {
    els.detailsPanel.hidden = !els.detailsPanel.hidden;
    els.showDetailsBtn.textContent = els.detailsPanel.hidden ? 'SHOW DETAILS' : 'HIDE DETAILS';
  });

  els.closeModal.addEventListener('click', closeModal);
  els.modalPrev.addEventListener('click', () => navigateModal(-1));
  els.modalNext.addEventListener('click', () => navigateModal(1));
  els.randomBtn.addEventListener('click', openRandom);

  els.searchInput.addEventListener('input', () => renderSearch(els.searchInput.value));

  document.addEventListener('keydown', e => {
    if (!els.albumModal.hidden) {
      if (e.key === 'ArrowLeft') navigateModal(-1);
      if (e.key === 'ArrowRight') navigateModal(1);
      if (e.key === 'Escape') closeModal();
    }
  });

  // Click outside modal to close
  els.albumModal.addEventListener('click', e => { if (e.target === els.albumModal) closeModal(); });

  if (!state.username) {
    showPrompt();
    return;
  }

  loadCollection();
}

// ── Username prompt ───────────────────────────────────
function showPrompt() {
  els.loadingState.hidden = true;
  els.albumCount.hidden = true;
  els.statsBtn.style.display = 'none';
  els.randomBtn.hidden = true;
  els.siteFooter.hidden = false;
  document.querySelector('.sort-modes').style.display = 'none';

  els.collectionOutput.innerHTML = `
    <div class="username-prompt">
      <h2>Your Vinyl Collection</h2>
      <p>Enter your Discogs username to display your vinyl collection beautifully.</p>
      <div class="username-form">
        <input type="text" id="username-input" placeholder="Discogs username…" autocomplete="off" />
        <button id="username-submit">GO</button>
      </div>
    </div>`;

  $('username-submit').addEventListener('click', submitUsername);
  $('username-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitUsername(); });
}

function submitUsername() {
  const val = $('username-input').value.trim();
  if (!val) return;
  const url = new URL(location.href);
  url.searchParams.set('username', val);
  location.href = url.toString();
}

// ── Discogs API ────────────────────────────────────────
const DISCOGS_API = 'https://api.discogs.com';
const HEADERS = { 'User-Agent': 'VinylCollectionApp/1.0' };

async function loadCollection() {
  els.discogsUsernameDisplay.textContent = state.username;
  els.discogsLink.href = `https://www.discogs.com/user/${state.username}/collection`;
  els.discogsLink.textContent = `discogs.com/user/${state.username}/collection`;

  try {
    let page = 1;
    let totalPages = 1;
    const all = [];

    while (page <= totalPages) {
      const res = await fetch(
        `${DISCOGS_API}/users/${state.username}/collection/folders/0/releases?per_page=100&page=${page}&sort=artist&sort_order=asc`,
        { headers: HEADERS }
      );
      if (!res.ok) {
        if (res.status === 404) throw new Error(`User "${state.username}" not found on Discogs.`);
        if (res.status === 429) throw new Error('Rate limited by Discogs. Please wait a moment and refresh.');
        throw new Error(`Discogs API error: ${res.status}`);
      }
      const data = await res.json();
      totalPages = data.pagination.pages;
      all.push(...data.releases);
      els.countNumber.textContent = all.length;
      page++;
    }

    state.albums = all.map(normalizeAlbum);
    onCollectionLoaded();
  } catch (err) {
    els.loadingState.hidden = true;
    els.errorState.hidden = false;
    els.errorMsg.textContent = err.message;
  }
}

function normalizeAlbum(release) {
  const bi = release.basic_information || {};
  const artists = (bi.artists || []).map(a => a.name.replace(/ \(\d+\)$/, '')).join(', ');
  const genres = [...(bi.genres || []), ...(bi.styles || [])];
  const thumb = bi.cover_image || bi.thumb || '';
  const year = bi.year || null;
  const price = release.price || null;

  return {
    id: release.id,
    instanceId: release.instance_id,
    title: bi.title || 'Unknown Title',
    artist: artists || 'Unknown Artist',
    year,
    genres,
    thumb,
    format: (bi.formats || []).map(f => f.name).join(', ') || 'Vinyl',
    label: (bi.labels || []).map(l => l.name).join(', ') || '',
    catno: (bi.labels || []).map(l => l.catno).join(', ') || '',
    dateAdded: release.date_added || '',
    median: release.price || null,
    rating: release.rating || 0,
    releaseId: bi.id,
  };
}

function onCollectionLoaded() {
  els.loadingState.hidden = true;
  els.siteFooter.hidden = false;
  els.randomBtn.hidden = false;
  els.albumCount.hidden = false;

  const now = new Date();
  const syncStr = `DISCOGS COLLECTION · SYNCED ${now.toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  }).toUpperCase()}`;
  els.syncText.textContent = syncStr;
  els.lastSyncFooter.textContent = `Last sync: ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  setMode('az');
  renderInlineStats();
}

// ── Sorting & Filtering ────────────────────────────────
function setMode(mode) {
  state.currentMode = mode;
  state.currentFilter = null;

  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

  els.searchContainer.hidden = mode !== 'search';
  els.sortFilters.innerHTML = '';

  if (mode === 'search') {
    els.searchInput.value = '';
    els.searchInput.focus();
    renderSearch('');
    return;
  }

  switch (mode) {
    case 'az': renderAZ(); buildAZFilters(); break;
    case 'year': renderYear(); buildYearFilters(); break;
    case 'price': renderPrice(); buildPriceFilters(); break;
    case 'new': renderNew(); buildNewFilters(); break;
  }
}

function buildAZFilters() {
  const chars = new Set(state.albums.map(a => {
    const c = a.artist.replace(/^The /i, '')[0]?.toUpperCase() || '#';
    return /[A-Z]/.test(c) ? c : '#';
  }));
  const sorted = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].filter(c => chars.has(c));
  els.sortFilters.innerHTML = sorted.map(c =>
    `<button class="filter-btn" data-filter="${c}">${c}</button>`
  ).join('');
  attachFilterListeners();
}

function buildYearFilters() {
  const decades = new Set(state.albums.filter(a => a.year).map(a => Math.floor(a.year / 10) * 10));
  const sorted = [...decades].sort((a, b) => a - b);
  els.sortFilters.innerHTML = sorted.map(d =>
    `<button class="filter-btn" data-filter="${d}">${d}s</button>`
  ).join('');
  attachFilterListeners();
}

function buildPriceFilters() {
  const buckets = ['$100+', '$50–99', '$25–49', '$10–24', 'Under $10', '—'];
  els.sortFilters.innerHTML = buckets.map(b =>
    `<button class="filter-btn" data-filter="${b}">${b}</button>`
  ).join('');
  attachFilterListeners();
}

function buildNewFilters() {
  const years = new Set(state.albums.map(a => {
    if (!a.dateAdded) return null;
    return new Date(a.dateAdded).getFullYear();
  }).filter(Boolean));
  const sorted = [...years].sort((a, b) => b - a).slice(0, 5);
  els.sortFilters.innerHTML = sorted.map(y =>
    `<button class="filter-btn" data-filter="${y}">${y}</button>`
  ).join('');
  attachFilterListeners();
}

function attachFilterListeners() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentFilter = btn.dataset.filter;
      scrollToFilter(btn.dataset.filter);
    });
  });
}

function scrollToFilter(filter) {
  const section = document.querySelector(`[data-section="${CSS.escape(filter)}"]`);
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Render modes ──────────────────────────────────────
function renderAZ() {
  const groups = {};
  state.albums.forEach(a => {
    const raw = a.artist.replace(/^The /i, '')[0]?.toUpperCase() || '#';
    const key = /[A-Z]/.test(raw) ? raw : '#';
    (groups[key] = groups[key] || []).push(a);
  });
  const keys = Object.keys(groups).sort((a, b) => a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b));
  state.visibleAlbums = keys.flatMap(k => groups[k]);
  renderGroups(keys.map(k => ({ label: k, albums: groups[k] })));
}

function renderYear() {
  const groups = {};
  state.albums.forEach(a => {
    const y = a.year || '?';
    (groups[y] = groups[y] || []).push(a);
  });
  const keys = Object.keys(groups).filter(k => k !== '?').sort((a, b) => Number(a) - Number(b));
  if (groups['?']) keys.push('?');
  state.visibleAlbums = keys.flatMap(k => groups[k]);

  // Group by decade for headers
  const decades = {};
  keys.forEach(y => {
    if (y === '?') { (decades['Unknown'] = decades['Unknown'] || []).push(...groups[y]); return; }
    const d = Math.floor(Number(y) / 10) * 10 + 's';
    (decades[d] = decades[d] || []).push(...groups[y]);
  });
  const dKeys = Object.keys(decades).filter(k => k !== 'Unknown').sort();
  if (decades['Unknown']) dKeys.push('Unknown');
  renderGroups(dKeys.map(k => ({ label: k, albums: decades[k] })));
}

function renderPrice() {
  const getBucket = a => {
    const p = a.median;
    if (!p) return '—';
    if (p >= 100) return '$100+';
    if (p >= 50) return '$50–99';
    if (p >= 25) return '$25–49';
    if (p >= 10) return '$10–24';
    return 'Under $10';
  };
  const order = ['$100+', '$50–99', '$25–49', '$10–24', 'Under $10', '—'];
  const groups = {};
  state.albums.forEach(a => {
    const b = getBucket(a);
    (groups[b] = groups[b] || []).push(a);
  });
  const keys = order.filter(k => groups[k]);
  state.visibleAlbums = keys.flatMap(k => groups[k]);
  renderGroups(keys.map(k => ({ label: k, albums: groups[k] })));
}

function renderNew() {
  const groups = {};
  state.albums.forEach(a => {
    if (!a.dateAdded) return;
    const y = new Date(a.dateAdded).getFullYear();
    (groups[y] = groups[y] || []).push(a);
  });
  const keys = Object.keys(groups).sort((a, b) => Number(b) - Number(a));
  // Sort within each group by dateAdded descending
  keys.forEach(k => groups[k].sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)));
  state.visibleAlbums = keys.flatMap(k => groups[k]);
  renderGroups(keys.map(k => ({ label: k, albums: groups[k] })));
}

function renderSearch(query) {
  const q = query.toLowerCase().trim();
  const filtered = q
    ? state.albums.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.artist.toLowerCase().includes(q) ||
        (a.genres || []).some(g => g.toLowerCase().includes(q))
      )
    : state.albums;
  state.visibleAlbums = filtered;
  if (!q) {
    els.collectionOutput.innerHTML = '';
    return;
  }
  renderGroups([{ label: `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${query}"`, albums: filtered }]);
}

function renderGroups(groups) {
  els.collectionOutput.innerHTML = groups.map(({ label, albums }) => `
    <div class="section-group" data-section="${escAttr(label)}">
      <div class="section-heading">${escHtml(label)}</div>
      <div class="album-grid">
        ${albums.map((a, i) => albumCard(a, i)).join('')}
      </div>
    </div>
  `).join('');

  // Attach click listeners
  document.querySelectorAll('.album-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.idx, 10);
      openModal(idx);
    });
  });

  // Lazy load images
  const imgs = document.querySelectorAll('img[data-src]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '200px' });
  imgs.forEach(img => observer.observe(img));
}

function albumCard(album, idx) {
  const hasImg = album.thumb && album.thumb.trim();
  return `
    <div class="album-card" data-idx="${idx}" tabindex="0" role="button" aria-label="${escAttr(album.title)} by ${escAttr(album.artist)}">
      ${hasImg
        ? `<img data-src="${escAttr(album.thumb)}" alt="${escAttr(album.title)}" loading="lazy" />`
        : `<div class="album-placeholder">♪</div>`
      }
      <div class="album-card-hover">
        <div class="album-card-title">${escHtml(album.title)}</div>
        <div class="album-card-artist">${escHtml(album.artist)}</div>
      </div>
    </div>`;
}

// ── Modal ─────────────────────────────────────────────
function openModal(idx) {
  state.currentIndex = idx;
  const album = state.visibleAlbums[idx];
  if (!album) return;

  const hasImg = album.thumb && album.thumb.trim();
  els.modalCover.innerHTML = hasImg
    ? `<img src="${escAttr(album.thumb)}" alt="${escAttr(album.title)}" />`
    : `<div class="no-img">♪</div>`;

  const dateAdded = album.dateAdded
    ? new Date(album.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const genres = album.genres?.slice(0, 3).join(', ') || '—';

  els.modalInfo.innerHTML = `
    <h2 class="modal-album-title">${escHtml(album.title)}</h2>
    <p class="modal-album-artist">${escHtml(album.artist)}</p>
    <div class="modal-meta">
      ${album.year ? `<div class="modal-meta-row"><span class="meta-key">Release Year</span><span class="meta-val">${album.year}</span></div>` : ''}
      ${genres !== '—' ? `<div class="modal-meta-row"><span class="meta-key">Genre</span><span class="meta-val">${genres}</span></div>` : ''}
      ${album.format ? `<div class="modal-meta-row"><span class="meta-key">Format</span><span class="meta-val">${escHtml(album.format)}</span></div>` : ''}
      ${album.label ? `<div class="modal-meta-row"><span class="meta-key">Label</span><span class="meta-val">${escHtml(album.label)}</span></div>` : ''}
      ${album.median ? `<div class="modal-meta-row"><span class="meta-key">Median Price</span><span class="meta-val">$${album.median}</span></div>` : ''}
      <div class="modal-meta-row"><span class="meta-key">Date Added</span><span class="meta-val">${dateAdded}</span></div>
    </div>`;

  els.albumModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  els.albumModal.hidden = true;
  document.body.style.overflow = '';
}

function navigateModal(dir) {
  const next = state.currentIndex + dir;
  if (next >= 0 && next < state.visibleAlbums.length) openModal(next);
}

// ── Stats (inline) ────────────────────────────────────
function renderInlineStats() {
  const albums = state.albums;
  if (!albums.length) return;

  const artistCount = {};
  albums.forEach(a => { artistCount[a.artist] = (artistCount[a.artist] || 0) + 1; });
  const topArtists = Object.entries(artistCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxA = topArtists[0]?.[1] || 1;

  const genreCount = {};
  albums.forEach(a => (a.genres || []).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; }));
  const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxG = topGenres[0]?.[1] || 1;

  const yearCount = {};
  albums.forEach(a => { if (a.year) yearCount[a.year] = (yearCount[a.year] || 0) + 1; });
  const topYears = Object.entries(yearCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxY = topYears[0]?.[1] || 1;

  const comingUp = [...albums]
    .filter(a => a.dateAdded)
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .slice(0, 5);

  const statsRow = (label, count, max) => `
    <div class="stats-row">
      <span class="stats-label">${escHtml(label)}</span>
      <div class="stats-bar-wrap"><div class="stats-bar" style="width:${Math.round(count / max * 100)}%"></div></div>
      <span class="stats-count">${count}</span>
    </div>`;

  els.statsContent.innerHTML = `
    <div class="stats-section">
      <h3>Top Artists</h3>
      ${topArtists.map(([label, count]) => statsRow(label, count, maxA)).join('')}
    </div>
    <div class="stats-section">
      <h3>Top Genres</h3>
      ${topGenres.map(([label, count]) => statsRow(label, count, maxG)).join('')}
    </div>
    <div class="stats-section">
      <h3>Most Popular Years</h3>
      ${topYears.map(([label, count]) => statsRow(label, count, maxY)).join('')}
    </div>
    <div class="stats-section">
      <h3>Recently Added</h3>
      <ul class="coming-up-list">
        ${comingUp.map(a => `
          <li class="coming-up-item">
            <span class="coming-up-date">${new Date(a.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span class="coming-up-title">${escHtml(a.artist)} — ${escHtml(a.title)}</span>
            ${a.year ? `<span class="coming-up-year">(${a.year})</span>` : ''}
          </li>
        `).join('')}
      </ul>
    </div>`;

  els.statsSection.hidden = false;
}

// ── Random ────────────────────────────────────────────
function openRandom() {
  if (!state.visibleAlbums.length && !state.albums.length) return;
  const pool = state.visibleAlbums.length ? state.visibleAlbums : state.albums;
  const idx = Math.floor(Math.random() * pool.length);
  openModal(idx);
}

// ── Utils ─────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Start ─────────────────────────────────────────────
init();
