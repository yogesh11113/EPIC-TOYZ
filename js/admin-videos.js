/**
 * Epic Toyz — Admin Video Management Module
 * js/admin-videos.js
 *
 * Extends the Admin panel with full CRUD for the `product_videos` table.
 * Uploaded MP4 files are stored in Supabase Storage bucket "videos".
 * Poster images are uploaded to ImageKit CDN.
 *
 * Usage: included via <script> in admin/dashboard.html after admin.js
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   VIDEO ADMIN MODULE
───────────────────────────────────────────────────────────── */
const VideoAdmin = {
  _videos: [],
  _products: [],   // cached product list for the dropdown

  /* ═══════════════════════════════════════════════════════════
     SECTION RENDER — called by Admin.loadSection('videos')
  ═══════════════════════════════════════════════════════════ */
  async renderSection() {
    await this._loadProducts();
    await this._loadVideos();
    this._renderList();
  },

  /* ═══════════════════════════════════════════════════════════
     LOAD DATA
  ═══════════════════════════════════════════════════════════ */
  async _loadVideos() {
    const sb = window.EpicSupabase;
    if (!sb) {
      this._videos = [];
      return;
    }

    try {
      const { data, error } = await sb
        .from('product_videos')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          Toast.warning('Run scratch/videos_table.sql in Supabase to enable video management.');
          this._videos = [];
          return;
        }
        throw error;
      }
      this._videos = data || [];
    } catch (err) {
      Toast.error('Could not load videos: ' + (err.message || err));
      this._videos = [];
    }
  },

  async _loadProducts() {
    if (this._products.length) return; // cached
    try {
      if (window.DB && typeof DB.getProducts === 'function') {
        const products = await DB.getProducts({ activeOnly: false });
        this._products = (products || []).map(p => ({
          id: p.id,
          name: p.name,
          slug: p.slug
        }));
      }
    } catch (err) {
      console.warn('[VideoAdmin] Could not load products:', err);
      this._products = [];
    }
  },

  /* ═══════════════════════════════════════════════════════════
     RENDER VIDEO CARD LIST
  ═══════════════════════════════════════════════════════════ */
  _renderList() {
    const container = document.getElementById('videos-grid');
    if (!container) return;

    if (!this._videos.length) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:64px 24px; color:var(--text-muted);">
          <div style="font-size:48px; margin-bottom:16px; opacity:0.4">🎬</div>
          <div style="font-size:16px; font-weight:600; margin-bottom:8px;">No videos yet</div>
          <div style="font-size:13px;">Click <strong>Add Video</strong> to upload your first reel.</div>
        </div>`;
      return;
    }

    container.innerHTML = this._videos.map(v => this._buildCardHTML(v)).join('');
  },

  _buildCardHTML(v) {
    const statusClass = v.is_active ? 'active' : 'inactive';
    const statusLabel = v.is_active ? 'Active' : 'Inactive';
    const thumb = v.poster_url
      ? `<img src="${esc(v.poster_url)}" alt="${esc(v.title)}" loading="lazy">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;opacity:0.3">🎬</div>`;

    return `
      <div class="admin-video-card" data-id="${esc(v.id)}">
        <div class="admin-video-thumb" onclick="VideoAdmin.previewVideo('${esc(v.id)}')">
          ${thumb}
          <div class="play-overlay">▶</div>
          <span class="admin-video-status-pill ${statusClass}">${statusLabel}</span>
        </div>
        <div class="admin-video-info">
          <div class="admin-video-title" title="${esc(v.title)}">${esc(v.title)}</div>
          <div class="admin-video-product" title="${esc(v.product_name || v.product_slug)}">
            🏷️ ${esc(v.product_name || v.product_slug)}
          </div>
          <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;">
            Order: ${v.display_order}
          </div>
          <div class="admin-video-actions">
            <button class="btn btn-secondary btn-sm" onclick="VideoAdmin.openEditModal('${esc(v.id)}')">✏️ Edit</button>
            <button class="btn btn-sm" style="background:${v.is_active ? 'rgba(173,181,189,0.1)' : 'rgba(46,204,113,0.15)'}; color:${v.is_active ? '#adb5bd' : '#2ecc71'}; border:1px solid ${v.is_active ? 'rgba(173,181,189,0.2)' : 'rgba(46,204,113,0.3)'};"
              onclick="VideoAdmin.toggleActive('${esc(v.id)}', ${!v.is_active})">
              ${v.is_active ? '⏸ Deactivate' : '▶ Activate'}
            </button>
            <button class="btn btn-danger btn-sm" onclick="VideoAdmin.deleteVideo('${esc(v.id)}')">🗑️</button>
          </div>
        </div>
      </div>`;
  },

  /* ═══════════════════════════════════════════════════════════
     OPEN ADD MODAL
  ═══════════════════════════════════════════════════════════ */
  openAddModal() {
    this._resetModal();
    document.getElementById('video-modal-title').textContent = 'Add Video';
    document.getElementById('video-id').value = '';
    Admin.openModal('video-modal-backdrop');
  },

  /* ═══════════════════════════════════════════════════════════
     OPEN EDIT MODAL
  ═══════════════════════════════════════════════════════════ */
  openEditModal(id) {
    const v = this._videos.find(x => x.id === id);
    if (!v) return;

    this._resetModal();
    document.getElementById('video-modal-title').textContent = 'Edit Video';
    document.getElementById('video-id').value = v.id;
    document.getElementById('video-title').value = v.title || '';
    document.getElementById('video-order').value = v.display_order ?? 0;
    document.getElementById('video-active').checked = !!v.is_active;

    // Current video URL display
    if (v.video_url) {
      document.getElementById('video-current-url').textContent = 'Current: ' + this._shortUrl(v.video_url);
      document.getElementById('video-current-url').style.display = 'block';
    }

    // Poster preview
    if (v.poster_url) {
      const previewImg = document.getElementById('video-poster-preview');
      previewImg.src = v.poster_url;
      previewImg.style.display = 'block';
    }

    // Product select
    const sel = document.getElementById('video-product-select');
    if (sel) {
      // Try to find by slug
      const opt = Array.from(sel.options).find(o => o.dataset.slug === v.product_slug);
      if (opt) sel.value = opt.value;
    }

    Admin.openModal('video-modal-backdrop');
  },

  /* ═══════════════════════════════════════════════════════════
     SAVE (ADD OR UPDATE)
  ═══════════════════════════════════════════════════════════ */
  async saveVideo() {
    const sb = window.EpicSupabase;
    if (!sb) {
      Toast.error('Supabase not configured. Cannot save video.');
      return;
    }

    const id = document.getElementById('video-id').value.trim();
    const title = document.getElementById('video-title').value.trim();
    const order = parseInt(document.getElementById('video-order').value || '0', 10);
    const isActive = document.getElementById('video-active').checked;

    // Product
    const productSel = document.getElementById('video-product-select');
    const selectedOpt = productSel ? productSel.options[productSel.selectedIndex] : null;
    const productSlug = selectedOpt ? (selectedOpt.dataset.slug || '') : '';
    const productName = selectedOpt ? (selectedOpt.text || '') : '';

    if (!title) { Toast.warning('Please enter a video title.'); return; }
    if (!productSlug) { Toast.warning('Please select a product.'); return; }

    // Video file upload
    let videoUrl = '';
    if (id) {
      // Keep existing URL unless a new file was chosen
      const existing = this._videos.find(v => v.id === id);
      if (existing) videoUrl = existing.video_url;
    }

    const videoFileInput = document.getElementById('video-file-input');
    if (videoFileInput && videoFileInput.files && videoFileInput.files[0]) {
      try {
        videoUrl = await this._uploadVideo(videoFileInput.files[0]);
      } catch (err) {
        Toast.error('Video upload failed: ' + (err.message || err));
        return;
      }
    }

    if (!videoUrl) {
      Toast.warning('Please upload an MP4 video file.');
      return;
    }

    // Poster image upload
    let posterUrl = id ? (this._videos.find(v => v.id === id)?.poster_url || '') : '';
    const posterFileInput = document.getElementById('video-poster-input');
    if (posterFileInput && posterFileInput.files && posterFileInput.files[0]) {
      try {
        posterUrl = await this._uploadPoster(posterFileInput.files[0]);
      } catch (err) {
        Toast.warning('Poster upload failed (video will still be saved): ' + err.message);
      }
    }

    const payload = {
      title,
      video_url: videoUrl,
      poster_url: posterUrl || null,
      product_slug: productSlug,
      product_name: productName,
      display_order: isNaN(order) ? 0 : order,
      is_active: isActive,
      updated_at: new Date().toISOString()
    };

    const saveBtn = document.getElementById('video-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Saving...'; }

    try {
      let result;
      if (id) {
        result = await sb.from('product_videos').update(payload).eq('id', id).select().single();
      } else {
        payload.created_at = new Date().toISOString();
        result = await sb.from('product_videos').insert(payload).select().single();
      }

      if (result.error) throw result.error;

      Toast.success(id ? 'Video updated!' : 'Video added!');
      Admin.closeModal('video-modal-backdrop');
      await this.renderSection();
    } catch (err) {
      Toast.error('Save failed: ' + (err.message || err));
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Video'; }
    }
  },

  /* ═══════════════════════════════════════════════════════════
     TOGGLE ACTIVE
  ═══════════════════════════════════════════════════════════ */
  async toggleActive(id, newState) {
    const sb = window.EpicSupabase;
    if (!sb) return;
    try {
      const { error } = await sb
        .from('product_videos')
        .update({ is_active: newState, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      Toast.success(newState ? 'Video activated.' : 'Video deactivated.');
      await this.renderSection();
    } catch (err) {
      Toast.error('Failed to update: ' + (err.message || err));
    }
  },

  /* ═══════════════════════════════════════════════════════════
     DELETE
  ═══════════════════════════════════════════════════════════ */
  deleteVideo(id) {
    Admin.confirm('Delete this video? This cannot be undone.', 'Delete Video', async () => {
      const sb = window.EpicSupabase;
      if (!sb) return;
      try {
        const { error } = await sb.from('product_videos').delete().eq('id', id);
        if (error) throw error;
        Toast.success('Video deleted.');
        await this.renderSection();
      } catch (err) {
        Toast.error('Delete failed: ' + (err.message || err));
      }
    });
  },

  /* ═══════════════════════════════════════════════════════════
     PREVIEW VIDEO IN MODAL THUMB
  ═══════════════════════════════════════════════════════════ */
  previewVideo(id) {
    const v = this._videos.find(x => x.id === id);
    if (!v || !v.video_url) {
      Toast.info('No video URL available.');
      return;
    }

    // Open edit modal and show preview
    this.openEditModal(id);
    const previewWrap = document.getElementById('video-preview-wrap');
    if (previewWrap) {
      previewWrap.innerHTML = `
        <video src="${esc(v.video_url)}" controls muted playsinline
          style="width:100%;height:100%;object-fit:contain;"></video>`;
      previewWrap.classList.add('show');
    }
  },

  /* ═══════════════════════════════════════════════════════════
     FILE UPLOAD — VIDEO to Supabase Storage
  ═══════════════════════════════════════════════════════════ */
  async _uploadVideo(file) {
    const sb = window.EpicSupabase;
    if (!sb) throw new Error('Supabase not configured');

    // Validate file type
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
      throw new Error('Please upload an MP4, MOV, or WebM video file.');
    }

    const fileName = `video_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`;
    const filePath = `reels/${fileName}`;

    // Show progress UI
    this._showUploadProgress(0, 'Uploading video...');

    const { data, error } = await sb.storage
      .from('videos')
      .upload(filePath, file, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false
      });

    this._hideUploadProgress();

    if (error) throw new Error(error.message);

    // Get public URL
    const { data: urlData } = sb.storage.from('videos').getPublicUrl(filePath);
    if (!urlData?.publicUrl) throw new Error('Could not get public URL for uploaded video.');

    return urlData.publicUrl;
  },

  /* ═══════════════════════════════════════════════════════════
     FILE UPLOAD — POSTER to ImageKit
  ═══════════════════════════════════════════════════════════ */
  async _uploadPoster(file) {
    if (window.ImageKitUpload && ImageKitUpload.isConfigured()) {
      return await ImageKitUpload.uploadFile(file, { maxDimension: 800, quality: 0.85, folder: '/reels-posters' });
    }

    // Fallback: upload to Supabase Storage
    const sb = window.EpicSupabase;
    if (!sb) throw new Error('No upload service configured');

    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `poster_${Date.now()}.${ext}`;
    const { data, error } = await sb.storage
      .from('videos')
      .upload(`posters/${fileName}`, file, { contentType: file.type, upsert: false });

    if (error) throw new Error(error.message);

    const { data: urlData } = sb.storage.from('videos').getPublicUrl(`posters/${fileName}`);
    return urlData?.publicUrl || '';
  },

  /* ═══════════════════════════════════════════════════════════
     VIDEO FILE INPUT HANDLER
  ═══════════════════════════════════════════════════════════ */
  handleVideoFileSelect(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    const label = document.getElementById('video-file-label');
    if (label) label.textContent = `📹 ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;

    // Show inline preview
    const previewWrap = document.getElementById('video-preview-wrap');
    if (previewWrap) {
      const url = URL.createObjectURL(file);
      previewWrap.innerHTML = `<video src="${url}" controls muted playsinline
        style="width:100%;height:100%;object-fit:contain;"></video>`;
      previewWrap.classList.add('show');
    }
  },

  /* ═══════════════════════════════════════════════════════════
     POSTER FILE INPUT HANDLER
  ═══════════════════════════════════════════════════════════ */
  handlePosterFileSelect(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const img = document.getElementById('video-poster-preview');
    if (img) {
      img.src = URL.createObjectURL(file);
      img.style.display = 'block';
    }
  },

  /* ═══════════════════════════════════════════════════════════
     PRODUCT SELECT HANDLER — auto-fills product slug hint
  ═══════════════════════════════════════════════════════════ */
  handleProductSelect(select) {
    const opt = select.options[select.selectedIndex];
    const slug = opt ? opt.dataset.slug : '';
    const slugHint = document.getElementById('video-product-slug-hint');
    if (slugHint) {
      slugHint.textContent = slug ? `slug: ${slug}` : '';
    }
  },

  /* ═══════════════════════════════════════════════════════════
     POPULATE PRODUCT DROPDOWN
  ═══════════════════════════════════════════════════════════ */
  populateProductDropdown() {
    const sel = document.getElementById('video-product-select');
    if (!sel) return;

    sel.innerHTML = '<option value="">— Select a product —</option>';
    this._products.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      opt.dataset.slug = p.slug;
      sel.appendChild(opt);
    });
  },

  /* ═══════════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════════ */
  _resetModal() {
    // Reset form fields
    ['video-title', 'video-id', 'video-order'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = id === 'video-order' ? '0' : '';
    });

    const activeEl = document.getElementById('video-active');
    if (activeEl) activeEl.checked = true;

    const fileInput = document.getElementById('video-file-input');
    if (fileInput) fileInput.value = '';

    const posterInput = document.getElementById('video-poster-input');
    if (posterInput) posterInput.value = '';

    const fileLabel = document.getElementById('video-file-label');
    if (fileLabel) fileLabel.textContent = '📁 Choose MP4 video file';

    const posterPreview = document.getElementById('video-poster-preview');
    if (posterPreview) { posterPreview.src = ''; posterPreview.style.display = 'none'; }

    const previewWrap = document.getElementById('video-preview-wrap');
    if (previewWrap) { previewWrap.innerHTML = ''; previewWrap.classList.remove('show'); }

    const currentUrl = document.getElementById('video-current-url');
    if (currentUrl) { currentUrl.textContent = ''; currentUrl.style.display = 'none'; }

    this.populateProductDropdown();
    this._hideUploadProgress();
  },

  _showUploadProgress(pct, label) {
    const progressEl = document.getElementById('video-upload-progress');
    const fillEl = document.getElementById('video-upload-fill');
    const labelEl = document.getElementById('video-upload-label');
    if (progressEl) progressEl.classList.add('show');
    if (fillEl) fillEl.style.width = pct + '%';
    if (labelEl) labelEl.textContent = label || 'Uploading...';
  },

  _hideUploadProgress() {
    const progressEl = document.getElementById('video-upload-progress');
    if (progressEl) progressEl.classList.remove('show');
  },

  _shortUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/');
      return '...' + parts.slice(-2).join('/');
    } catch {
      return url.slice(-40);
    }
  }
};

/* ── EXPOSE GLOBALLY ─────────────────────────────────────────── */
window.VideoAdmin = VideoAdmin;
