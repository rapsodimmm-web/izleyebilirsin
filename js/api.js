// ===================== 2EMBED.CC API (via local CORS proxy) =====================
const BASE  = '/api';
const EMBED = 'https://www.2embed.cc';

const API = {
  trendingMovies:  (page=1,w='week') => `${BASE}/trending?time_window=${w}&page=${page}`,
  searchMovies:    (q,page=1)        => `${BASE}/search?q=${encodeURIComponent(q)}&page=${page}`,
  movieDetail:     (id)              => `${BASE}/movie?imdb_id=${id}`,
  similarMovies:   (id,page=1)       => `${BASE}/similar?imdb_id=${id}&page=${page}`,
  trendingTV:      (page=1,w='week') => `${BASE}/trendingtv?time_window=${w}&page=${page}`,
  searchTV:        (q,page=1)        => `${BASE}/searchtv?q=${encodeURIComponent(q)}&page=${page}`,
  tvDetail:        (id)              => `${BASE}/tv?imdb_id=${id}`,
  similarTV:       (id,page=1)       => `${BASE}/similartv?imdb_id=${id}&page=${page}`,
  seasonDetail:    (id,s)            => `${BASE}/season?imdb_id=${id}&season=${s}`,
};

// ===================== VIDEO EMBED SOURCES =====================
// Multiple sources for maximum availability — if one fails, switch to another
const SOURCES = {
  movie: [
    {
      id: '2embed',
      label: '2Embed',
      url: (id)        => `https://www.2embed.cc/embed/${id}`,
    },
    {
      id: 'vidsrc',
      label: 'VidSrc',
      url: (id)        => `https://vidsrc.to/embed/movie/${id}`,
    },
    {
      id: 'superembed',
      label: 'SuperEmbed',
      url: (id)        => `https://multiembed.mov/?video_id=${id}&tmdb=0`,
    },
    {
      id: '2skin',
      label: '2Embed Alt',
      url: (id)        => `https://www.2embed.skin/embed/${id}`,
    },
  ],
  tv: [
    {
      id: '2embed',
      label: '2Embed',
      url: (id,s,e)    => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
    },
    {
      id: 'vidsrc',
      label: 'VidSrc',
      url: (id,s,e)    => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
    },
    {
      id: 'superembed',
      label: 'SuperEmbed',
      url: (id,s,e)    => `https://multiembed.mov/?video_id=${id}&tmdb=0&s=${s}&e=${e}`,
    },
    {
      id: '2skin',
      label: '2Embed Alt',
      url: (id,s,e)    => `https://www.2embed.skin/embedtv/${id}&s=${s}&e=${e}`,
    },
  ],
};

// ===================== HTTP FETCH =====================
async function apiFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('API Error:', err.message, url);
    return null;
  }
}

// ===================== ITEM NORMALIZATION =====================
function normalizeItem(item) {
  return {
    ...item,
    displayTitle: item.title || item.name || 'Bilinmiyor',
    displayYear: item.year ||
      (item.release_date   ? item.release_date.split('-')[0]   : '') ||
      (item.first_air_date ? item.first_air_date.split('-')[0] : '') || '',
  };
}

// ===================== HELPERS =====================
function formatRating(r) {
  if (r == null) return 'N/A';
  const n = parseFloat(r);
  return isNaN(n) ? 'N/A' : n.toFixed(1);
}

const GENRE_TR = {
  'Action':'Aksiyon','Adventure':'Macera','Animation':'Animasyon',
  'Comedy':'Komedi','Crime':'Suç','Documentary':'Belgesel',
  'Drama':'Dram','Family':'Aile','Fantasy':'Fantastik',
  'History':'Tarih','Horror':'Korku','Music':'Müzik',
  'Mystery':'Gizem','Romance':'Romantik','Science Fiction':'Bilim Kurgu',
  'Thriller':'Gerilim','War':'Savaş','Western':'Western','TV Movie':'TV Filmi',
};
function getGenreLabel(g) { return GENRE_TR[g] || g; }

function createSkeletonCards(n=8) {
  return Array.from({length:n}, () => {
    const el = document.createElement('div');
    el.className = 'skeleton skeleton-card';
    return el;
  });
}

// ===================== MOVIE CARD =====================
function createMovieCard(rawItem, type='movie') {
  const item = normalizeItem(rawItem);
  const a = document.createElement('a');
  a.className = 'movie-card';
  a.href = `player.html?id=${item.imdb_id}&type=${type}`;
  a.title = item.displayTitle;

  const rating = formatRating(item.vote_average);
  const year   = item.displayYear;
  const typeLabel = type === 'tv' ? 'Dizi' : 'Film';
  const isFav = isFavorite(item.imdb_id);

  // Poster
  if (item.poster) {
    const img = document.createElement('img');
    img.className = 'movie-card-poster';
    img.alt = item.displayTitle;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = item.poster.replace('/original/', '/w342/');
    img.onerror = () => {
      const fb = document.createElement('div');
      fb.className = 'poster-fallback';
      fb.textContent = '🎬';
      img.replaceWith(fb);
    };
    a.appendChild(img);
  } else {
    const fb = document.createElement('div');
    fb.className = 'poster-fallback';
    fb.textContent = '🎬';
    a.appendChild(fb);
  }

  // Type badge
  const badge = document.createElement('span');
  badge.className = 'movie-card-type';
  badge.textContent = typeLabel;
  a.appendChild(badge);

  // Favorite button
  const fav = document.createElement('button');
  fav.className = 'movie-card-fav' + (isFav ? ' active' : '');
  fav.title = isFav ? 'Favorilerden çıkar' : 'Favorilere ekle';
  fav.textContent = isFav ? '❤️' : '🤍';
  fav.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const nowFav = toggleFavorite({ imdb_id: item.imdb_id, displayTitle: item.displayTitle, poster: item.poster, type });
    fav.classList.toggle('active', nowFav);
    fav.textContent = nowFav ? '❤️' : '🤍';
    fav.title = nowFav ? 'Favorilerden çıkar' : 'Favorilere ekle';
    showToast(nowFav ? `❤️ Favorilere eklendi` : `💔 Favorilerden çıkarıldı`);
  });
  a.appendChild(fav);

  // Hover overlay
  const overlay = document.createElement('div');
  overlay.className = 'movie-card-overlay';
  overlay.innerHTML = `
    <div class="movie-card-play">▶</div>
    <div class="movie-card-title">${item.displayTitle}</div>
    <div class="movie-card-meta">
      <span class="movie-card-rating">★ ${rating}</span>
      ${year ? `<span class="movie-card-year">${year}</span>` : ''}
    </div>
  `;
  a.appendChild(overlay);

  return a;
}

// ===================== localStorage: FAVORITES =====================
const FAV_KEY = 'izleyebilirsin_favorites';
function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
function isFavorite(id) { return getFavorites().some(f => f.imdb_id === id); }
function toggleFavorite(item) {
  let favs = getFavorites();
  const idx = favs.findIndex(f => f.imdb_id === item.imdb_id);
  if (idx >= 0) { favs.splice(idx, 1); }
  else { favs.unshift(item); }
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  return idx < 0; // returns true if now added
}

// ===================== localStorage: WATCH HISTORY =====================
const HISTORY_KEY = 'izleyebilirsin_history';
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveToHistory(item) {
  let history = getHistory();
  // Remove existing entry for same id
  history = history.filter(h => h.imdb_id !== item.imdb_id);
  history.unshift({ ...item, ts: Date.now() });
  // Keep only last 20
  if (history.length > 20) history = history.slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}
function removeFromHistory(id) {
  const history = getHistory().filter(h => h.imdb_id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ===================== localStorage: CURRENT SOURCE =====================
const SOURCE_KEY = 'izleyebilirsin_source';
function getSavedSource() { return localStorage.getItem(SOURCE_KEY) || '2embed'; }
function saveSource(id)   { localStorage.setItem(SOURCE_KEY, id); }

// ===================== TOAST =====================
function showToast(message, duration=3200) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(12px)';
    toast.style.transition = 'all .3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===================== ROW ARROWS =====================
function initRowArrows(wrapper) {
  const row = wrapper.querySelector('.card-row');
  if (!row) return;
  const l = wrapper.querySelector('.row-arrow-left');
  const r = wrapper.querySelector('.row-arrow-right');
  l?.addEventListener('click', () => row.scrollBy({left:-540, behavior:'smooth'}));
  r?.addEventListener('click', () => row.scrollBy({left:540, behavior:'smooth'}));
}

// ===================== NAVBAR =====================
function initNavbar() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 55);
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
}
function initNavbarSearch() {
  const form  = document.getElementById('navbar-search-form');
  const input = document.getElementById('navbar-search-input');
  if (!form || !input) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
  });
}

// ===================== EXPORTS =====================
window.API = API; window.SOURCES = SOURCES;
window.apiFetch = apiFetch;
window.normalizeItem = normalizeItem;
window.formatRating = formatRating;
window.getGenreLabel = getGenreLabel; window.GENRE_TR = GENRE_TR;
window.createSkeletonCards = createSkeletonCards;
window.createMovieCard = createMovieCard;
window.getFavorites = getFavorites; window.isFavorite = isFavorite; window.toggleFavorite = toggleFavorite;
window.getHistory = getHistory; window.saveToHistory = saveToHistory; window.removeFromHistory = removeFromHistory;
window.getSavedSource = getSavedSource; window.saveSource = saveSource;
window.showToast = showToast;
window.initRowArrows = initRowArrows;
window.initNavbar = initNavbar; window.initNavbarSearch = initNavbarSearch;
