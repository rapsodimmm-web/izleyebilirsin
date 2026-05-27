// ===================== SEARCH PAGE =====================
let currentQuery  = '';
let currentTab    = 'movie';
let movieResults  = [];
let tvResults     = [];
let moviePage     = 1;
let tvPage        = 1;
let movieTotal    = 0;
let tvTotal       = 0;
let searchTimer   = null;
let isSearching   = false;
let isLoadingMore = false;

async function init() {
  initNavbar();
  initNavbarSearch();
  initScrollProgress();

  const params = new URLSearchParams(window.location.search);
  const q    = params.get('q') || '';
  const type = params.get('type') || 'movie';

  setTab(type, false);

  if (q) {
    currentQuery = q;
    const input = document.getElementById('big-search-input');
    if (input) input.value = q;
    document.title = `"${q}" Arama Sonuçları — izleyebilirsin`;
    await runSearch(q, true);
  } else if (type === 'movie' || type === 'tv') {
    await loadTrending(type);
  } else {
    showState('initial');
  }

  setupListeners();
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

// ===================== TRENDING (when no query) =====================
async function loadTrending(type) {
  showState('loading');
  const data = type === 'tv'
    ? await apiFetch(API.trendingTV(1))
    : await apiFetch(API.trendingMovies(1));

  const results = data?.results || [];
  const total   = data?.total_results || results.length;

  if (type === 'movie') { movieResults = results; movieTotal = total; moviePage = 1; }
  else                  { tvResults    = results; tvTotal    = total; tvPage    = 1; }

  if (results.length) {
    const countEl = document.getElementById('results-count');
    if (countEl) countEl.textContent = `Trend ${type==='tv'?'Diziler':'Filmler'}`;
    renderGrid(results, type, false);
    checkLoadMoreVisibility(type);
  } else {
    showState('initial');
  }
}

// ===================== SEARCH =====================
async function runSearch(q, fresh=true) {
  if (!q || isSearching) return;
  isSearching = true;
  showState('loading');

  if (fresh) {
    moviePage = 1; tvPage = 1;
    movieResults = []; tvResults = [];
    movieTotal = 0; tvTotal = 0;
  }

  try {
    const [moviesData, tvData] = await Promise.all([
      apiFetch(API.searchMovies(q, moviePage)),
      apiFetch(API.searchTV(q, tvPage)),
    ]);

    if (fresh) {
      movieResults = moviesData?.results || [];
      tvResults    = tvData?.results    || [];
    } else {
      movieResults = [...movieResults, ...(moviesData?.results || [])];
      tvResults    = [...tvResults, ...(tvData?.results || [])];
    }

    movieTotal = moviesData?.total_results || 0;
    tvTotal    = tvData?.total_results    || 0;

    renderCurrentTab(fresh);
    checkLoadMoreVisibility(currentTab);
  } catch {
    showState('error');
  } finally {
    isSearching = false;
  }
}

// ===================== LOAD MORE =====================
async function loadMore() {
  if (isLoadingMore || isSearching) return;
  isLoadingMore = true;

  const btn = document.getElementById('load-more-btn');
  if (btn) { btn.disabled = true; btn.querySelector('#load-more-text').textContent = 'Yükleniyor...'; }

  if (currentQuery) {
    if (currentTab === 'movie') moviePage++;
    else tvPage++;
    await runSearch(currentQuery, false);
  } else {
    const type = currentTab;
    const page = type === 'movie' ? ++moviePage : ++tvPage;
    const data = type === 'tv'
      ? await apiFetch(API.trendingTV(page))
      : await apiFetch(API.trendingMovies(page));

    const newItems = data?.results || [];

    if (type === 'movie') movieResults = [...movieResults, ...newItems];
    else tvResults = [...tvResults, ...newItems];

    // Append only new cards
    appendToGrid(newItems, type);
    checkLoadMoreVisibility(type);
  }

  isLoadingMore = false;
  if (btn) { btn.disabled = false; btn.querySelector('#load-more-text').textContent = '⬇ Daha Fazla Yükle'; }
}

function checkLoadMoreVisibility(type) {
  const wrap  = document.getElementById('load-more-wrap');
  if (!wrap) return;

  const current = type === 'movie' ? movieResults.length : tvResults.length;
  const total   = type === 'movie' ? movieTotal : tvTotal;

  // Show if there are more results available
  const hasMore = total > current && current > 0;
  wrap.style.display = hasMore ? 'flex' : 'none';
}

// ===================== TABS =====================
function setTab(tab, renderNow=true) {
  currentTab = tab;
  document.querySelectorAll('.search-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tab)
  );
  if (renderNow) {
    if (currentQuery) renderCurrentTab(true);
    else loadTrending(tab);
  }
}

function renderCurrentTab(fresh=true) {
  const results = currentTab === 'tv' ? tvResults : movieResults;
  const total   = currentTab === 'tv' ? tvTotal   : movieTotal;
  const label   = currentTab === 'tv' ? 'dizi' : 'film';
  const countEl = document.getElementById('results-count');

  if (!results.length) {
    if (countEl) countEl.textContent = '';
    showState(currentQuery ? 'empty' : 'initial');
    return;
  }

  if (countEl) {
    const totalStr = total > results.length ? ` (${total.toLocaleString('tr-TR')} toplam)` : '';
    countEl.textContent = currentQuery
      ? `${results.length} ${label} gösteriliyor${totalStr} — "${currentQuery}"`
      : `${results.length} içerik`;
  }

  renderGrid(results, currentTab, !fresh);
}

function renderGrid(items, type, append=false) {
  const grid = document.getElementById('results-grid');
  if (!grid) return;

  showState('results');

  if (!append) {
    grid.innerHTML = '';
  }

  const startIdx = append ? grid.children.length : 0;
  const frag = document.createDocumentFragment();

  items.slice(append ? startIdx : 0).forEach((item, i) => {
    const card = createMovieCard(item, type);
    card.classList.add('cascade');
    card.style.animationDelay = `${Math.min(i * 0.035, 0.6)}s`;
    frag.appendChild(card);
  });

  grid.appendChild(frag);
}

function appendToGrid(items, type) {
  const grid = document.getElementById('results-grid');
  if (!grid) return;

  const startDelay = grid.children.length;
  const frag = document.createDocumentFragment();
  items.forEach((item, i) => {
    const card = createMovieCard(item, type);
    card.classList.add('cascade');
    card.style.animationDelay = `${Math.min(i * 0.035, 0.4)}s`;
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}

// ===================== LISTENERS =====================
function setupListeners() {
  const input = document.getElementById('big-search-input');
  const form  = document.getElementById('big-search-form');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input?.value.trim();
    if (q && q !== currentQuery) {
      currentQuery = q;
      history.pushState({}, '', `?q=${encodeURIComponent(q)}&type=${currentTab}`);
      document.title = `"${q}" Arama Sonuçları — izleyebilirsin`;
      runSearch(q, true);
    }
  });

  // Debounced live search
  input?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (!q) { showState('initial'); return; }
    if (q.length < 2) return;
    searchTimer = setTimeout(() => {
      if (q !== currentQuery) {
        currentQuery = q;
        history.replaceState({}, '', `?q=${encodeURIComponent(q)}&type=${currentTab}`);
        runSearch(q, true);
      }
    }, 480);
  });

  // Tab buttons
  document.querySelectorAll('.search-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      history.replaceState({}, '', `?${currentQuery?`q=${encodeURIComponent(currentQuery)}&`:''}type=${tab.dataset.tab}`);
      setTab(tab.dataset.tab);
    });
  });

  // Load more button
  document.getElementById('load-more-btn')?.addEventListener('click', loadMore);

  // Keyboard shortcut: / to focus search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input?.focus();
    }
  });
}

// ===================== STATES =====================
function showState(state) {
  const stateEl   = document.getElementById('search-state');
  const resultEl  = document.getElementById('results-container');
  if (!stateEl || !resultEl) return;

  if (state === 'results') {
    stateEl.classList.add('hidden');
    resultEl.classList.remove('hidden');
    return;
  }

  stateEl.classList.remove('hidden');
  resultEl.classList.add('hidden');

  const map = {
    loading: `<div class="spinner"></div><div class="state-title" style="margin-top:16px">Aranıyor...</div>`,
    empty:   `<div class="state-icon">🔍</div>
               <div class="state-title">Sonuç bulunamadı</div>
               <div class="state-text">"${currentQuery}" için ${currentTab==='tv'?'dizi':'film'} bulunamadı.<br>Farklı bir terim deneyin.</div>`,
    initial: `<div class="state-icon">🎬</div>
               <div class="state-title">Ne izlemek istersiniz?</div>
               <div class="state-text">Film veya dizi adı yazarak arama yapın.<br><span style="font-size:.8rem;color:var(--text3)">İpucu: Aramayı açmak için / tuşuna basın</span></div>`,
    error:   `<div class="state-icon">⚠️</div>
               <div class="state-title">Arama başarısız</div>
               <div class="state-text">Bir hata oluştu. İnternet bağlantınızı kontrol edin.</div>`,
  };

  stateEl.innerHTML = map[state] || map.initial;
}

// ===================== START =====================
document.addEventListener('DOMContentLoaded', init);
