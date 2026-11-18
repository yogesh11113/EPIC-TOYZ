/**
 * Epic Toyz — Reels Video Showcase
 * js/reels.js
 *
 * Mobile-first Instagram Reels-style video shopping section.
 * Features:
 *  - Loads active videos from Supabase `product_videos` table
 *  - Horizontal swipe / scroll-snap card carousel on mobile
 *  - Responsive CSS grid on desktop (≥900px)
 *  - IntersectionObserver-based autoplay (play when visible, pause when not)
 *  - Only one video plays at a time
 *  - Muted by default with per-card mute toggle
 *  - Lazy video src assignment (only set when card is near viewport)
 *  - Graceful error handling (failed loads show placeholder)
 *  - Dot indicators (mobile only)
 */

'use strict';

/* ── STATE ──────────────────────────────────────────────────── */
const Reels = {
  _videos: [],
  _cards: [],       // { el, video, src } per card
  _playIO: null,    // IntersectionObserver for play/pause
  _lazyIO: null,    // IntersectionObserver for lazy src assignment
  _currentMuted: true,

  /* ── PUBLIC INIT ─────────────────────────────────────────── */
  async init() {
    const section = document.getElementById('reels');
    if (!section) return;

    try {
      this._videos = await this._fetchVideos();
    } catch (err) {
      console.warn('[Reels] Failed to fetch videos:', err);
      this._videos = [];
    }

    const track = document.getElementById('reels-track');
    const dotsEl = document.getElementById('reels-dots');
    if (!track) return;

    if (!this._videos.length) {
      track.innerHTML = `
        <div class="reels-empty">
          <div class="reels-empty-icon">🎬</div>
          <p>No videos yet — check back soon!</p>
        </div>`;
      return;
    }

    this._render(track, dotsEl);
    this._initLazyLoad();
    this._initPlayObserver();
    this._initDots(dotsEl, track);
    this._initSwipeHint(track);
  },

  /* ── FETCH FROM SUPABASE ─────────────────────────────────── */
  async _fetchVideos() {
    const sb = window.EpicSupabase;
    if (!sb) {
      console.info('[Reels] Supabase not available — no videos to show.');
      return [];
    }

    const { data, error } = await sb
      .from('product_videos')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      // Table may not exist yet — fail silently
      if (error.code === 'PGRST205' || error.code === '42P01') {
        console.info('[Reels] product_videos table not found. Run scratch/videos_table.sql in Supabase.');
        return [];
      }
      throw error;
    }

    return data || [];
  },

  /* ── RENDER CARDS ───────────────────────────────────────────── */
  _render(track, dotsEl) {
    track.innerHTML = '';
    this._cards = [];

    this._videos.forEach((v, idx) => {
      const card = this._buildCard(v, idx);
      track.appendChild(card.el);
      this._cards.push(card);
    });

    // Build dots
    if (dotsEl) {
      dotsEl.innerHTML = '';
      this._videos.forEach((_, idx) => {
        const dot = document.createElement('button');
        dot.className = 'reels-dot' + (idx === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `Video ${idx + 1}`);
        dot.addEventListener('click', () => this._scrollToCard(idx, track));
        dotsEl.appendChild(dot);
      });
    }
  },

  _buildCard(video, idx) {
    const productUrl = `/product.html?slug=${encodeURIComponent(video.product_slug)}`;
    const hasVideo = !!(video.video_url);

    const el = document.createElement('div');
    el.className = 'reel-card';
    el.dataset.index = idx;

    // We set video.src lazily via IntersectionObserver
    el.innerHTML = `
      <div class="reel-video-wrap">
        ${this._buildVideoEl(video, hasVideo)}
        <div class="reel-skeleton${hasVideo ? '' : ' hidden'}" aria-hidden="true"></div>
        ${!hasVideo ? `
          <div class="reel-upload-placeholder">
            <span class="reel-placeholder-icon">🎬</span>
            <span>Video coming soon</span>
          </div>` : ''}
        <div class="reel-error-state" aria-hidden="true">
          <span style="font-size:36px;opacity:0.4">📽️</span>
          <span>Video unavailable</span>
        </div>
        ${hasVideo ? `
          <button class="reel-mute-btn" aria-label="Toggle mute" data-muted="true">
            🔇
          </button>
          <div class="reel-play-indicator" aria-hidden="true">
            <div class="reel-play-icon">▶</div>
          </div>` : ''}
        <div class="reel-video-fade" aria-hidden="true"></div>
      </div>
      <div class="reel-card-info">
        <div class="reel-product-name">${this._esc(video.title || video.product_name || 'RC Car')}</div>
        <a href="${productUrl}" class="reel-cta" aria-label="View ${this._esc(video.product_name || 'product')}">
          View Product
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>`;

    // Wire up mute toggle
    const muteBtn = el.querySelector('.reel-mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const videoEl = el.querySelector('video');
        if (!videoEl) return;
        const nowMuted = !videoEl.muted;
        videoEl.muted = nowMuted;
        muteBtn.textContent = nowMuted ? '🔇' : '🔊';
        muteBtn.dataset.muted = nowMuted;
        this._currentMuted = nowMuted;
      });
    }

    // CTA click: navigate to product
    const ctaBtn = el.querySelector('.reel-cta');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    const videoEl = el.querySelector('video');

    // Wire video events
    if (videoEl && hasVideo) {
      videoEl.addEventListener('canplay', () => {
        const skeleton = el.querySelector('.reel-skeleton');
        if (skeleton) skeleton.classList.add('hidden');
      });

      videoEl.addEventListener('error', () => {
        el.classList.add('load-error');
        const skeleton = el.querySelector('.reel-skeleton');
        if (skeleton) skeleton.classList.add('hidden');
      });

      // Show play/pause indicator briefly on click
      el.querySelector('.reel-video-wrap').addEventListener('click', () => {
        if (!videoEl.src) return;
        const indicator = el.querySelector('.reel-play-indicator');
        const playIcon = el.querySelector('.reel-play-icon');
        if (videoEl.paused) {
          videoEl.play().catch(() => {});
          if (playIcon) playIcon.textContent = '▶';
        } else {
          videoEl.pause();
          if (playIcon) playIcon.textContent = '⏸';
        }
        if (indicator) {
          indicator.classList.add('show');
          setTimeout(() => indicator.classList.remove('show'), 600);
        }
      });
    }

    return { el, videoEl, src: video.video_url, poster: video.poster_url };
  },

  _buildVideoEl(video, hasVideo) {
    if (!hasVideo) return '';
    const poster = video.poster_url ? `poster="${this._esc(video.poster_url)}"` : '';
    // src is intentionally omitted here — set lazily via IntersectionObserver
    return `<video
      muted
      loop
      playsinline
      preload="none"
      ${poster}
      disablepictureinpicture
      disableremoteplayback
    ></video>`;
  },

  /* ── LAZY SRC LOADING ────────────────────────────────────── */
  _initLazyLoad() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: set all srcs immediately
      this._cards.forEach(c => {
        if (c.videoEl && c.src) c.videoEl.src = c.src;
      });
      return;
    }

    this._lazyIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const card = this._cards[Number(entry.target.dataset.index)];
        if (card && card.videoEl && card.src && !card.videoEl.src) {
          card.videoEl.src = card.src;
          card.videoEl.load();
        }
        // Unobserve once loaded
        this._lazyIO.unobserve(entry.target);
      });
    }, {
      rootMargin: '0px 200px 0px 200px', // load 200px before entering viewport
      threshold: 0
    });

    this._cards.forEach(c => this._lazyIO.observe(c.el));
  },

  /* ── PLAY / PAUSE OBSERVER ───────────────────────────────── */
  _initPlayObserver() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: autoplay all (browser will limit anyway)
      this._cards.forEach(c => {
        if (c.videoEl) c.videoEl.play().catch(() => {});
      });
      return;
    }

    this._playIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const card = this._cards[Number(entry.target.dataset.index)];
        if (!card || !card.videoEl || !card.videoEl.src) return;

        if (entry.isIntersecting) {
          // Apply current global mute state before playing
          card.videoEl.muted = this._currentMuted;
          const muteBtn = entry.target.querySelector('.reel-mute-btn');
          if (muteBtn) {
            muteBtn.textContent = this._currentMuted ? '🔇' : '🔊';
          }
          card.videoEl.play().catch(() => {
            // Autoplay blocked (should not happen with muted, but handle anyway)
            card.videoEl.muted = true;
            card.videoEl.play().catch(() => {});
          });
        } else {
          card.videoEl.pause();
        }
      });
    }, {
      threshold: 0.6,         // play when 60% visible
      rootMargin: '0px'
    });

    this._cards.forEach(c => this._playIO.observe(c.el));
  },

  /* ── DOT SCROLL SYNC ─────────────────────────────────────── */
  _initDots(dotsEl, track) {
    if (!dotsEl || !('IntersectionObserver' in window)) return;

    const dots = Array.from(dotsEl.querySelectorAll('.reels-dot'));

    const dotIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const idx = Number(entry.target.dataset.index);
        dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      });
    }, {
      root: track.parentElement,
      threshold: 0.5
    });

    this._cards.forEach(c => dotIO.observe(c.el));
  },

  _scrollToCard(idx, track) {
    const card = this._cards[idx];
    if (!card) return;
    card.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  },

  /* ── SWIPE HINT (subtle animation first load) ──────────────── */
  _initSwipeHint(track) {
    // Only on mobile and only once per session
    if (window.innerWidth >= 900) return;
    if (sessionStorage.getItem('et_reels_hinted')) return;
    sessionStorage.setItem('et_reels_hinted', '1');

    if (this._cards.length < 2) return;

    // Brief peek animation to show swipeability
    requestAnimationFrame(() => {
      setTimeout(() => {
        track.scrollTo({ left: 60, behavior: 'smooth' });
        setTimeout(() => {
          track.scrollTo({ left: 0, behavior: 'smooth' });
        }, 500);
      }, 1200);
    });
  },

  /* ── HELPERS ─────────────────────────────────────────────── */
  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

/* ── AUTO-INIT on DOMContentLoaded ───────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  Reels.init();
});

/* ── EXPOSE GLOBALLY (for debugging) ─────────────────────────── */
window.Reels = Reels;
