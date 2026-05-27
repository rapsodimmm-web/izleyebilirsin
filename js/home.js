// ===================== HOME PAGE =====================
let heroItems   = [];
let heroIndex   = 0;
let heroTimer   = null;
let allMovies   = [];
let allTV       = [];
let activeGenre = 'all';
let movieWindow = 'week';
let tvWindow    = 'week';
let randomPool  = []; // all loaded items for random pick

async function init() {
  initNavbar();
  initNavbarSearch();
  initScrollProgress();

  showSkeletons('movies-row');
  showSkeletons('tv-row');
  showSkeletons('top10-row', 5);

  renderContinueWatching();
  renderFavoritesSection();

  // Parallel load
  const [moviesData, tvData] = await Promise.all([
    apiFetch(API.trendingMovies(1, 'week')),
    apiFetch(API.trendingTV(1, 'week')),
  ]);

  allMovies = moviesData?.results || [];
  allTV     = tvData?.results    || [];
  randomPool = [...allMovies, ...allTV];

  // Hero
  heroItems = allMovies.filter(m => m.backdrops?.length > 0 || m.poster).slice(0, 7);
  if (!heroItems.length && allMovies.length) heroItems = allMovies.slice(0, 7);

  if (heroItems.length) {
    renderHero(heroItems[0]);
    renderHeroIndicators();
    startHeroAutoplay();
  }

  renderCardRow('movies-row', allMovies, 'movie', true);
  renderTop10Row(allMovies);
  renderCardRow('tv-row', allTV, 'tv', true);
  buildGenreFilter(allMovies);

  document.querySelectorAll('.card-row-wrapper').forEach(initRowArrows);

  initTimeToggles();
  initRandomPick();
  initTrailerModal();
}

// ===================== SCROLL PROGRESS =====================
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const total = document.body.scrollHeight - window.innerHeight;
    const pct   = total > 0 ? (window.scrollY / total) * 100 : 0;
    bar.style.width = pct + '%';
  }, { passive: true });
}

function showSkeletons(rowId, n=10) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.innerHTML = '';
  createSkeletonCards(n).forEach(s => row.appendChild(s));
}

// ===================== HERO =====================
function renderHero(rawItem) {
  const item    = normalizeItem(rawItem);
  const backdrop = document.getElementById('hero-backdrop');
  const content  = document.querySelector('.hero-content');
  if (!backdrop) return;

  if (content) { content.style.opacity = '0'; content.style.transform = 'translateY(14px)'; }
  const bg = item.backdrops?.[0] || item.poster || '';

  setTimeout(() => {
    if (bg) backdrop.style.backgroundImage = `url('${bg}')`;
    setText('hero-title',  item.displayTitle);
    setText('hero-rating', formatRating(item.vote_average));
    setText('hero-year',   item.displayYear);

    const genresEl = document.getElementById('hero-genres');
    if (genresEl) {
      genresEl.innerHTML = (item.genres||[]).slice(0,3)
        .map(g=>`<span class="genre-tag">${getGenreLabel(g)}</span>`).join('');
    }
    const plotEl = document.getElementById('hero-plot');
    if (plotEl) { plotEl.textContent = item.plot || ''; plotEl.style.display = item.plot ? '' : 'none'; }

    const type = (item.name && !item.title) ? 'tv' : 'movie';
    const playBtn = document.getElementById('hero-play-btn');
    if (playBtn) playBtn.href = `player.html?id=${item.imdb_id}&type=${type}`;

    const trailerBtn = document.getElementById('hero-trailer-btn');
    if (trailerBtn) {
      if (item.trailer) { trailerBtn.dataset.trailer = item.trailer; trailerBtn.classList.remove('hidden'); }
      else { trailerBtn.classList.add('hidden'); }
    }

    if (content) {
      content.style.transition = 'opacity .5s ease, transform .5s ease';
      content.style.opacity  = '1';
      content.style.transform = 'translateY(0)';
    }
    updateHeroIndicators();
  }, 260);
}

function renderHeroIndicators() {
  const c = document.getElementById('hero-indicators');
  if (!c) return;
  c.innerHTML = heroItems.map((_,i) =>
    `<button class="hero-dot${i===0?' active':''}" onclick="goToHero(${i})"></button>`
  ).join('');
}
function updateHeroIndicators() {
  document.querySelectorAll('.hero-dot').forEach((d,i) => d.classList.toggle('active', i===heroIndex));
}
window.goToHero = (i) => { heroIndex=i; renderHero(heroItems[i]); resetHeroTimer(); };
function startHeroAutoplay() {
  heroTimer = setInterval(() => {
    heroIndex = (heroIndex+1) % heroItems.length;
    renderHero(heroItems[heroIndex]);
  }, 7000);
}
function resetHeroTimer() { clearInterval(heroTimer); startHeroAutoplay(); }

// ===================== TOP 10 ROW =====================
function renderTop10Row(movies) {
  const row = document.getElementById('top10-row');
  if (!row) return;
  row.innerHTML = '';
  const frag = document.createDocumentFragment();

  movies.slice(0, 10).forEach((rawItem, i) => {
    const item = normalizeItem(rawItem);
    const a = document.createElement('a');
    a.className = 'top10-card';
    a.href = `player.html?id=${item.imdb_id}&type=movie`;
    a.title = item.displayTitle;

    const numEl = document.createElement('div');
    numEl.className = 'top10-number';
    numEl.textContent = i + 1;

    const posterEl = document.createElement('div');
    posterEl.className = 'top10-poster';

    if (item.poster) {
      const img = document.createElement('img');
      img.src = item.poster.replace('/original/', '/w342/');
      img.alt = item.displayTitle;
      img.loading = 'lazy';
      img.onerror = () => { img.style.display='none'; };
      posterEl.appendChild(img);
    }

    a.appendChild(numEl);
    a.appendChild(posterEl);
    frag.appendChild(a);
  });

  row.appendChild(frag);
}

// ===================== TIME FILTER TOGGLE =====================
function initTimeToggles() {
  // Movies toggle
  const moviesToggle = document.getElementById('movies-time-toggle');
  moviesToggle?.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      moviesToggle.querySelectorAll('.time-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      movieWindow = btn.dataset.window;
      showSkeletons('movies-row', 8);
      const data = await apiFetch(API.trendingMovies(1, movieWindow));
      allMovies = data?.results || [];
      randomPool = [...allMovies, ...allTV];
      renderCardRow('movies-row', allMovies, 'movie', true);
      renderTop10Row(allMovies);
    });
  });

  // TV toggle
  const tvToggle = document.getElementById('tv-time-toggle');
  tvToggle?.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      tvToggle.querySelectorAll('.time-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      tvWindow = btn.dataset.window;
      showSkeletons('tv-row', 8);
      const data = await apiFetch(API.trendingTV(1, tvWindow));
      allTV = data?.results || [];
      randomPool = [...allMovies, ...allTV];
      renderCardRow('tv-row', allTV, 'tv', true);
    });
  });
}

// ===================== GENRE FILTER =====================
function buildGenreFilter(movies) {
  const filter = document.getElementById('genre-filter');
  if (!filter) return;
  const genreSet = new Set();
  movies.forEach(m => (m.genres||[]).forEach(g => genreSet.add(g)));
  const genres = ['all', ...Array.from(genreSet).slice(0,12)];

  filter.innerHTML = genres.map((g, i) => {
    return `<button class="genre-pill${i===0?' active':''}" data-genre="${g}">${i===0?'Tümü':getGenreLabel(g)}</button>`;
  }).join('');

  filter.querySelectorAll('.genre-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      filter.querySelectorAll('.genre-pill').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      activeGenre = btn.dataset.genre;
      const filtered = activeGenre === 'all'
        ? allMovies
        : allMovies.filter(m => (m.genres||[]).includes(activeGenre));
      renderCardRow('movies-row', filtered.length ? filtered : allMovies, 'movie', true);
    });
  });
}

// ===================== CARD ROW =====================
function renderCardRow(rowId, items, type, cascade=false) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.innerHTML = '';

  if (!items.length) {
    row.innerHTML = '<p style="color:var(--text3);padding:16px 0">Yükleniyor...</p>';
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach((item, i) => {
    const card = createMovieCard(item, type);
    if (cascade) {
      card.classList.add('cascade');
      card.style.animationDelay = `${Math.min(i * 0.04, 0.4)}s`;
    }
    frag.appendChild(card);
  });
  row.appendChild(frag);
}

// ===================== CONTINUE WATCHING =====================
function renderContinueWatching() {
  const section = document.getElementById('continue-section');
  const row     = document.getElementById('continue-row');
  if (!section || !row) return;

  const history = getHistory();
  if (!history.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  row.innerHTML = '';
  const frag = document.createDocumentFragment();

  history.slice(0,10).forEach(item => {
    const card = document.createElement('a');
    card.className = 'continue-card';
    card.href = `player.html?id=${item.imdb_id}&type=${item.type||'movie'}`;

    const backdrop = item.backdrop || item.poster || '';
    const typeLabel = item.type === 'tv'
      ? `Dizi${item.season ? ` • S${item.season}E${item.episode||1}` : ''}`
      : 'Film';

    card.innerHTML = `
      ${backdrop
        ? `<img class="continue-thumb" src="${backdrop.replace('/original/','/w500/')}" alt="${item.displayTitle}" loading="lazy">`
        : `<div class="continue-thumb-fallback">▶</div>`
      }
      <div class="continue-info">
        <div class="continue-title">${item.displayTitle}</div>
        <div class="continue-sub">${typeLabel}</div>
        <div class="continue-progress"><div class="continue-progress-bar" style="width:${item.progress||30}%"></div></div>
      </div>
      <button class="continue-remove" title="Geçmişten kaldır" data-id="${item.imdb_id}">✕</button>
    `;

    card.querySelector('.continue-remove').addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      removeFromHistory(item.imdb_id);
      card.style.opacity='0'; card.style.transform='scale(.95)'; card.style.transition='all .3s';
      setTimeout(() => { card.remove(); checkContinueEmpty(); }, 300);
    });

    frag.appendChild(card);
  });
  row.appendChild(frag);
}

function checkContinueEmpty() {
  const row = document.getElementById('continue-row');
  if (!row?.children.length) document.getElementById('continue-section')?.classList.add('hidden');
}

// ===================== FAVORITES =====================
function renderFavoritesSection() {
  const section = document.getElementById('favorites-section');
  const row     = document.getElementById('favorites-row');
  if (!section || !row) return;
  const favs = getFavorites();
  if (!favs.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  row.innerHTML = '';
  const frag = document.createDocumentFragment();
  favs.slice(0, 15).forEach(item => frag.appendChild(createMovieCard(item, item.type || 'movie')));
  row.appendChild(frag);
}

// ===================== RANDOM PICK =====================
function initRandomPick() {
  const modal        = document.getElementById('random-modal');
  const closeBtn     = document.getElementById('random-close-btn');
  const againBtn     = document.getElementById('random-again-btn');
  const heroRandomBtn = document.getElementById('hero-random-btn');
  const mobileRandomBtn = document.getElementById('mobile-random-btn');

  if (!modal) return;

  const openRandom = () => {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    showRandomItem();
  };

  heroRandomBtn?.addEventListener('click', openRandom);
  mobileRandomBtn?.addEventListener('click', openRandom);

  // Navbar link
  document.getElementById('nav-random-link')?.addEventListener('click', (e) => {
    e.preventDefault(); openRandom();
  });

  againBtn?.addEventListener('click', showRandomItem);

  const closeRandom = () => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeRandom);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeRandom(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeRandom(); });
}

function showRandomItem() {
  const pool = randomPool.length ? randomPool : allMovies;
  if (!pool.length) return;

  const raw  = pool[Math.floor(Math.random() * pool.length)];
  const item = normalizeItem(raw);
  const type = (raw.name && !raw.title) ? 'tv' : 'movie';
  const url  = `player.html?id=${item.imdb_id}&type=${type}`;

  // Media
  const mediaEl = document.getElementById('random-card-media');
  if (mediaEl) {
    const backdrop = item.backdrops?.[0] || item.poster || '';
    if (backdrop) {
      mediaEl.innerHTML = `<img class="random-card-img" src="${backdrop.replace('/original/','/w500/')}" alt="${item.displayTitle}" loading="lazy">`;
    } else {
      mediaEl.innerHTML = `<div class="random-card-img-fallback">🎬</div>`;
    }
  }

  setText('random-title',      item.displayTitle);
  setText('random-rating',     formatRating(item.vote_average));
  setText('random-year',       item.displayYear);
  setText('random-type-label', type === 'tv' ? '📺 Dizi' : '🎬 Film');
  setText('random-plot',       item.plot || 'Bu içerik için açıklama mevcut değil.');

  const playBtn = document.getElementById('random-play-btn');
  if (playBtn) playBtn.href = url;
}

// ===================== TRAILER MODAL =====================
function initTrailerModal() {
  const modal     = document.getElementById('trailer-modal');
  const iframe    = document.getElementById('trailer-iframe');
  const closeBtn  = document.getElementById('trailer-close');
  const trailerBtn = document.getElementById('hero-trailer-btn');
  if (!modal) return;

  trailerBtn?.addEventListener('click', e => {
    e.preventDefault();
    const src = trailerBtn.dataset.trailer;
    if (src) { iframe.src = src+'?autoplay=1'; modal.classList.remove('hidden'); document.body.style.overflow='hidden'; }
  });

  const close = () => { modal.classList.add('hidden'); iframe.src=''; document.body.style.overflow=''; };
  closeBtn?.addEventListener('click', close);
  modal?.addEventListener('click', e => { if(e.target===modal) close(); });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val || '';
}

// ===================== START =====================
document.addEventListener('DOMContentLoaded', () => {
  init();

  // Intersection Observer for lazy card rows
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.movie-card, .top10-card').forEach((card, i) => {
            card.style.animationDelay = `${i * 0.04}s`;
            card.classList.add('cascade');
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.section').forEach(s => observer.observe(s));
  }
});
