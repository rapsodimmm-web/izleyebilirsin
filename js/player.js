// ===================== PLAYER PAGE =====================
let currentItem   = null;
let currentType   = null;
let currentSeason = 1;
let currentEp     = 1;
let totalEps      = 0;
let currentSrc    = null;
let seasonCache   = {};
let iframeReady   = false;
let iframeTimer   = null;

async function init() {
  initNavbar();
  initNavbarSearch();
  initScrollProgress();

  const params = new URLSearchParams(window.location.search);
  const id   = params.get('id');
  currentType = params.get('type') || 'movie';

  if (!id) { showError('Geçersiz içerik ID\'si.'); return; }

  showLoading(true);

  try {
    const url  = currentType === 'tv' ? API.tvDetail(id) : API.movieDetail(id);
    const data = await apiFetch(url);
    if (!data || (!data.title && !data.name)) throw new Error('Veri alınamadı');

    currentItem = data;
    window.currentItem = data;

    renderSidebar(data);
    renderPlayer();
    renderCast(data.cast_crew?.cast || []);
    loadSimilar(id, currentType);
    saveWatchHistory(data);
    initKeyboardShortcuts();

  } catch (err) {
    console.error('Player init error:', err);
    showError('İçerik yüklenirken bir hata oluştu. Lütfen geri dönüp tekrar deneyin.');
  } finally {
    showLoading(false);
  }
}

// ===================== SCROLL PROGRESS =====================
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const total = document.body.scrollHeight - window.innerHeight;
    bar.style.width = (total > 0 ? (window.scrollY / total) * 100 : 0) + '%';
  }, { passive: true });
}

// ===================== SOURCE MANAGEMENT =====================
function getSourceList() { return SOURCES[currentType] || SOURCES.movie; }
function getActiveSourceDef() {
  const saved = getSavedSource();
  const list  = getSourceList();
  return list.find(s => s.id === saved) || list[0];
}
function buildEmbedUrl(srcDef) {
  if (!currentItem) return '';
  const id = currentItem.imdb_id;
  return currentType === 'tv'
    ? srcDef.url(id, currentSeason, currentEp)
    : srcDef.url(id);
}

// ===================== RENDER IFRAME =====================
function renderPlayer() {
  const iframe  = document.getElementById('player-iframe');
  const overlay = document.getElementById('iframe-loading');
  if (!iframe) return;

  const srcDef = getActiveSourceDef();
  currentSrc   = srcDef.id;
  const url    = buildEmbedUrl(srcDef);

  if (overlay) { overlay.classList.remove('hidden', 'fade-out'); }
  iframeReady = false;

  iframe.src = 'about:blank';
  setTimeout(() => { iframe.src = url; }, 80);

  clearTimeout(iframeTimer);
  iframe.onload = () => {
    if (iframe.src === 'about:blank') return;
    iframeReady = true;
    setTimeout(() => {
      overlay?.classList.add('fade-out');
      setTimeout(() => overlay?.classList.add('hidden'), 420);
    }, 800);
  };

  iframeTimer = setTimeout(() => {
    if (!iframeReady) {
      overlay?.classList.add('fade-out');
      setTimeout(() => overlay?.classList.add('hidden'), 420);
    }
  }, 8000);

  renderSourceButtons();

  const bd = document.getElementById('player-backdrop');
  if (bd && currentItem) {
    const img = currentItem.backdrops?.[0] || currentItem.poster || '';
    if (img) bd.style.backgroundImage = `url('${img}')`;
  }

  if (currentItem) {
    const item = normalizeItem(currentItem);
    document.title = `${item.displayTitle} — izleyebilirsin`;
    if (currentType === 'tv') document.title = `${item.displayTitle} S${currentSeason}E${currentEp} — izleyebilirsin`;
  }
}

// ===================== SOURCE SELECTOR BUTTONS =====================
function renderSourceButtons() {
  const container = document.getElementById('source-btns');
  if (!container) return;
  container.innerHTML = '';
  const sources = getSourceList();
  sources.forEach(src => {
    const btn = document.createElement('button');
    btn.className = 'source-btn' + (src.id === currentSrc ? ' active' : '');
    btn.innerHTML = `<span class="source-dot"></span>${src.label}`;
    btn.title = `${src.label} kaynağını kullan`;
    btn.addEventListener('click', () => switchSource(src.id));
    container.appendChild(btn);
  });
}

function switchSource(srcId) {
  if (srcId === currentSrc) return;
  saveSource(srcId);
  currentSrc = srcId;
  renderPlayer();
  showToast(`📺 Kaynak: ${getSourceList().find(s=>s.id===srcId)?.label}`);
}

// ===================== SAVE TO HISTORY =====================
function saveWatchHistory(data) {
  const item = normalizeItem(data);
  saveToHistory({
    imdb_id: item.imdb_id, displayTitle: item.displayTitle,
    poster: item.poster, backdrop: item.backdrops?.[0] || null,
    type: currentType,
    season: currentType === 'tv' ? currentSeason : null,
    episode: currentType === 'tv' ? currentEp : null,
    progress: Math.floor(Math.random() * 40 + 20),
  });
}

// ===================== SIDEBAR =====================
function renderSidebar(rawData) {
  const item = normalizeItem(rawData);

  const posterEl = document.getElementById('player-poster');
  if (posterEl) {
    if (item.poster) {
      posterEl.src = item.poster.replace('/original/', '/w342/');
      posterEl.alt = item.displayTitle;
      posterEl.onerror = () => posterEl.style.display = 'none';
    } else {
      posterEl.style.display = 'none';
    }
  }

  setText('player-title', item.displayTitle);
  setText('player-rating', formatRating(item.vote_average));

  const voteEl = document.getElementById('player-vote-count');
  if (voteEl && item.vote_count) voteEl.textContent = `(${Number(item.vote_count).toLocaleString('tr-TR')} oy)`;

  const yearEl = document.getElementById('player-year');
  if (yearEl && item.displayYear) yearEl.textContent = item.displayYear;

  const typeEl = document.getElementById('player-type');
  if (typeEl) typeEl.textContent = currentType === 'tv' ? '📺 Dizi' : '🎬 Film';

  const genresEl = document.getElementById('player-genres');
  if (genresEl) {
    genresEl.innerHTML = (item.genres||[]).map(g=>`<span class="genre-tag">${getGenreLabel(g)}</span>`).join('');
  }

  setText('player-plot', item.plot || 'Bu içerik için açıklama mevcut değil.');

  // Rating bar
  const rating = parseFloat(item.vote_average) || 0;
  if (rating > 0) {
    const barWrap  = document.getElementById('rating-bar-wrap');
    const barFill  = document.getElementById('rating-bar-fill');
    const barPct   = document.getElementById('rating-bar-pct');
    if (barWrap && barFill) {
      barWrap.style.display = '';
      if (barPct) barPct.textContent = `${rating.toFixed(1)} / 10`;
      // Animate after a brief delay
      setTimeout(() => { barFill.style.width = `${(rating / 10) * 100}%`; }, 300);
    }
  }

  // Director
  const crew = item.cast_crew?.crew || [];
  const director = crew.find(c => c.job === 'Director' || c.job === 'Series Director');
  const crewEl = document.getElementById('player-crew');
  if (crewEl && director) {
    crewEl.innerHTML = `Yönetmen: <strong>${director.name}</strong>`;
    crewEl.classList.remove('hidden');
  }

  // Favorite button
  const favBtn = document.getElementById('player-fav-btn');
  if (favBtn) {
    const nowFav = isFavorite(item.imdb_id);
    favBtn.classList.toggle('active', nowFav);
    favBtn.textContent = nowFav ? '❤️ Favorilerde' : '🤍 Favorilere Ekle';
    favBtn.addEventListener('click', () => {
      const added = toggleFavorite({
        imdb_id: item.imdb_id, displayTitle: item.displayTitle,
        poster: item.poster, type: currentType,
      });
      favBtn.classList.toggle('active', added);
      favBtn.textContent = added ? '❤️ Favorilerde' : '🤍 Favorilere Ekle';
      showToast(added ? '❤️ Favorilere eklendi' : '💔 Favorilerden çıkarıldı');
    });
  }

  if (currentType === 'tv') renderEpisodeSelector(item);
}

// ===================== EPISODE SELECTOR =====================
function renderEpisodeSelector(item) {
  const selector = document.getElementById('episode-selector');
  if (!selector) return;
  selector.classList.remove('hidden');

  const seasons = (item.seasons || []).filter(s => s.season_number > 0);
  const numSeasons = seasons.length || 1;

  const tabs = document.getElementById('season-tabs');
  if (tabs) {
    tabs.innerHTML = '';
    for (let s = 1; s <= numSeasons; s++) {
      const info = seasons.find(x => x.season_number === s);
      const btn = document.createElement('button');
      btn.className = `season-tab${s===currentSeason?' active':''}`;
      btn.textContent = `Sezon ${s}`;
      if (info?.episode_count) btn.title = `${info.episode_count} bölüm`;
      btn.dataset.season = s;
      btn.addEventListener('click', () => selectSeason(s, item.imdb_id));
      tabs.appendChild(btn);
    }
  }

  selectSeason(1, item.imdb_id);
}

async function selectSeason(season, imdbId) {
  currentSeason = season;
  currentEp     = 1;

  document.querySelectorAll('.season-tab').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.season) === season);
  });

  const grid = document.getElementById('episode-grid');
  if (!grid) return;

  if (seasonCache[season]) {
    totalEps = seasonCache[season].length;
    renderEpisodeGrid(seasonCache[season]);
    updateNextEpBtn();
    return;
  }

  grid.innerHTML = '<div style="display:flex;justify-content:center;padding:14px"><div class="spinner"></div></div>';

  const data = await apiFetch(API.seasonDetail(imdbId, season));
  const eps  = data?.episodes?.length
    ? data.episodes
    : Array.from({length:10}, (_,i) => ({episode_number:i+1, name:`Bölüm ${i+1}`}));

  seasonCache[season] = eps;
  totalEps = eps.length;
  renderEpisodeGrid(eps);
  updateNextEpBtn();
}

function renderEpisodeGrid(eps) {
  const grid = document.getElementById('episode-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  eps.forEach(ep => {
    const n   = ep.episode_number ?? ep;
    const btn = document.createElement('button');
    btn.className  = `episode-btn${n===currentEp?' active':''}`;
    btn.textContent = `B${n}`;
    btn.title = ep.name || `Bölüm ${n}`;
    btn.addEventListener('click', () => selectEpisode(n));
    frag.appendChild(btn);
  });
  grid.appendChild(frag);
}

function selectEpisode(ep) {
  currentEp = ep;
  document.querySelectorAll('.episode-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.textContent.replace('B','')) === ep);
  });

  updateNextEpBtn();

  if (currentItem) {
    const item = normalizeItem(currentItem);
    saveToHistory({
      imdb_id: item.imdb_id, displayTitle: item.displayTitle,
      poster: item.poster, backdrop: item.backdrops?.[0]||null,
      type: 'tv', season: currentSeason, episode: currentEp, progress: 5,
    });
  }

  renderPlayer();
  document.querySelector('.player-cinema')?.scrollIntoView({behavior:'smooth', block:'start'});
}

// ===================== NEXT EPISODE BUTTON =====================
function updateNextEpBtn() {
  ['next-ep-btn', 'next-ep-btn-mobile'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;

    if (currentType !== 'tv') { btn.classList.add('hidden'); return; }

    const hasNext = currentEp < totalEps;
    btn.classList.toggle('hidden', false);
    btn.disabled = !hasNext;

    const label = document.getElementById('next-ep-label');
    if (label) label.textContent = hasNext ? `S${currentSeason}E${currentEp+1}` : 'Son Bölüm';

    btn.onclick = hasNext ? () => {
      selectEpisode(currentEp + 1);
      showToast(`▶ Sonraki bölüm: S${currentSeason}E${currentEp}`);
    } : null;
  });
}

// ===================== KEYBOARD SHORTCUTS =====================
function initKeyboardShortcuts() {
  // Show hint
  const hintWrap = document.getElementById('kb-hint-wrap');
  if (hintWrap && currentType === 'tv') {
    hintWrap.innerHTML = `
      <div class="kb-hint" style="position:relative;bottom:auto;left:auto;transform:none;animation:none;font-size:.76rem">
        <kbd>F</kbd> Tam Ekran &nbsp;
        <kbd>←</kbd><kbd>→</kbd> Bölüm değiştir &nbsp;
        <kbd>Esc</kbd> Çık
      </div>
    `;
  } else if (hintWrap) {
    hintWrap.innerHTML = `
      <div class="kb-hint" style="position:relative;bottom:auto;left:auto;transform:none;animation:none;font-size:.76rem">
        <kbd>F</kbd> Tam Ekran &nbsp; <kbd>Esc</kbd> Çık
      </div>
    `;
  }

  document.addEventListener('keydown', (e) => {
    // Don't fire when typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'F' || e.key === 'f') {
      const iframe = document.getElementById('player-iframe');
      if (iframe) {
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        } else {
          iframe.requestFullscreen?.().catch(() => {});
        }
      }
    }

    if (e.key === 'ArrowRight' && currentType === 'tv') {
      if (currentEp < totalEps) { selectEpisode(currentEp + 1); e.preventDefault(); }
    }

    if (e.key === 'ArrowLeft' && currentType === 'tv') {
      if (currentEp > 1) { selectEpisode(currentEp - 1); e.preventDefault(); }
    }
  });
}

// ===================== CAST =====================
function renderCast(cast) {
  const section = document.getElementById('cast-section');
  const row     = document.getElementById('cast-row');
  if (!row || !cast.length) { section?.classList.add('hidden'); return; }
  section?.classList.remove('hidden');

  const fallback = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><rect width='72' height='72' rx='36' fill='%23202030'/><text x='36' y='46' text-anchor='middle' fill='%23505070' font-size='28'>👤</text></svg>`;
  const frag = document.createDocumentFragment();

  cast.slice(0, 24).forEach(p => {
    const card = document.createElement('div');
    card.className = 'cast-card';
    card.innerHTML = `
      <img class="cast-avatar" src="${p.profile||fallback}" alt="${p.name}" loading="lazy" onerror="this.src='${fallback}'">
      <div class="cast-name">${p.name}</div>
      <div class="cast-character">${p.character||''}</div>
    `;
    frag.appendChild(card);
  });
  row.appendChild(frag);
}

// ===================== SIMILAR =====================
async function loadSimilar(id, type) {
  const section = document.getElementById('similar-section');
  const row     = document.getElementById('similar-row');
  if (!row) return;

  row.innerHTML = '';
  createSkeletonCards(8).forEach(s => row.appendChild(s));

  const url  = type === 'tv' ? API.similarTV(id) : API.similarMovies(id);
  const data = await apiFetch(url);
  const items = data?.results || [];

  row.innerHTML = '';
  if (!items.length) { section?.classList.add('hidden'); return; }

  section?.classList.remove('hidden');
  const frag = document.createDocumentFragment();
  items.slice(0, 20).forEach((item, i) => {
    const card = createMovieCard(item, type);
    card.classList.add('cascade');
    card.style.animationDelay = `${Math.min(i*0.04, 0.5)}s`;
    frag.appendChild(card);
  });
  row.appendChild(frag);
  document.querySelectorAll('.card-row-wrapper').forEach(initRowArrows);
}

// ===================== STATES =====================
function showLoading(show) {
  document.getElementById('player-loading')?.classList.toggle('hidden', !show);
  document.getElementById('player-content')?.classList.toggle('hidden', show);
}

function showError(msg) {
  showLoading(false);
  const c = document.getElementById('player-content');
  if (c) {
    c.classList.remove('hidden');
    c.innerHTML = `
      <div class="state-container" style="padding-top:100px">
        <div class="state-icon">😔</div>
        <div class="state-title">Bir şeyler ters gitti</div>
        <div class="state-text">${msg}</div>
        <a href="index.html" class="btn-primary" style="margin-top:20px">← Ana Sayfaya Dön</a>
      </div>
    `;
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val || '';
}

// Expose for mobile mirror / external access
window.selectSeason  = (s, id) => selectSeason(s, id);
window.selectEpisode = (ep) => selectEpisode(ep);

// ===================== START =====================
document.addEventListener('DOMContentLoaded', init);
