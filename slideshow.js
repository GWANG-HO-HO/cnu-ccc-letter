/* 사진 자동 슬라이드 기능: existing script.js can stay unchanged. */
(() => {
  'use strict';
  const config = window.PRAYER_PHOTOS || {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const instances = [];

  function loadPhoto(item) {
    if (!item || typeof item.src !== 'string' || !item.src.trim()) return Promise.resolve(null);
    return new Promise(resolve => {
      const img = new Image();
      img.alt = item.alt || '';
      img.decoding = 'async';
      img.onload = () => resolve({ img, caption: item.caption || '' });
      img.onerror = () => { console.warn('사진을 불러오지 못했습니다:', item.src); resolve(null); };
      img.src = item.src;
    });
  }

  async function mount(root, items, hero = false) {
    if (root.dataset.slideshowReady || !Array.isArray(items) || !items.length) return;
    root.dataset.slideshowReady = 'loading';
    // Keep the existing picture until replacements actually load.
    const photos = (await Promise.all(items.map(loadPhoto))).filter(Boolean);
    if (!photos.length) { delete root.dataset.slideshowReady; return; }
    const holder = hero ? document.createElement('div') : root;
    if (hero) {
      root.prepend(holder);
      root.querySelector(':scope > .hero-img')?.remove();
    } else holder.replaceChildren();
    holder.classList.add('prayer-slideshow');
    holder.setAttribute('role', 'region');
    holder.setAttribute('aria-roledescription', '슬라이드쇼');
    holder.setAttribute('aria-label', hero ? '첫 화면 사진' : '팀 단체사진과 사역사진');
    const slides = photos.map((photo, i) => {
      const shot = document.createElement('div');
      shot.className = 'prayer-shot' + (i === 0 ? ' is-active' : '');
      shot.setAttribute('role', 'group');
      shot.setAttribute('aria-label', `${photos.length}장 중 ${i + 1}번째 사진`);
      shot.setAttribute('aria-hidden', String(i !== 0));
      shot.append(photo.img);
      if (photo.caption && !hero) {
        const caption = document.createElement('figcaption');
        caption.textContent = photo.caption;
        shot.append(caption);
      }
      holder.append(shot);
      return shot;
    });
    root.dataset.slideshowReady = 'true';
    if (slides.length < 2) return;
    let index = 0, timer = null, inView = false, hovering = false, focused = false;
    let paused = reduced;
    const interval = hero ? 3200 : 3000;
    const controls = document.createElement('div');
    controls.className = 'prayer-controls';
    function button(label, text) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'prayer-control';
      btn.setAttribute('aria-label', label); btn.textContent = text;
      controls.append(btn); return btn;
    }
    const prev = button('이전 사진', '‹');
    const counter = document.createElement('span'); counter.className = 'prayer-counter';
    controls.append(counter);
    const next = button('다음 사진', '›');
    const toggle = button('자동 넘김 일시정지', '일시정지');
    holder.append(controls);
    function paint() {
      slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === index);
        slide.setAttribute('aria-hidden', String(i !== index));
      });
      counter.textContent = `${index + 1} / ${slides.length}`;
      toggle.textContent = paused ? '재생' : '일시정지';
      toggle.setAttribute('aria-label', paused ? '사진 자동 넘김 시작' : '사진 자동 넘김 일시정지');
    }
    function schedule() {
      clearTimeout(timer);
      if (!paused && inView && !hovering && !focused && !document.hidden) {
        timer = setTimeout(() => { index = (index + 1) % slides.length; paint(); schedule(); }, interval);
      }
    }
    function move(step) { index = (index + step + slides.length) % slides.length; paint(); schedule(); }
    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    toggle.addEventListener('click', () => { paused = !paused; paint(); schedule(); });
    // Do not interrupt keyboard users or people inspecting a photo.
   
    holder.addEventListener('focusin', () => { focused = true; schedule(); });
    holder.addEventListener('focusout', () => setTimeout(() => { focused = holder.contains(document.activeElement); schedule(); }, 0));
    holder.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    });
    let touchStart = null;
    holder.addEventListener('touchstart', e => { const t = e.touches[0]; touchStart = { x: t.clientX, y: t.clientY }; }, { passive: true });
    holder.addEventListener('touchend', e => {
      if (!touchStart) return;
      const t = e.changedTouches[0], dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
      touchStart = null;
    }, { passive: true });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; schedule(); });
      observer.observe(holder);
    } else inView = true;
    instances.push(schedule);
    paint(); schedule();
  }
  function init() {
    const hero = document.querySelector('.hero');
    if (hero) mount(hero, config.home, true);
    document.querySelectorAll('.team-card[id]').forEach(card => {
      const figure = card.querySelector('.team-photo');
      if (!figure) return;
      // Load team photos shortly before the reader reaches their section.
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting) { observer.disconnect(); mount(figure, config[card.id]); }
        }, { rootMargin: '400px' });
        observer.observe(figure);
      } else mount(figure, config[card.id]);
    });
  }
  document.addEventListener('visibilitychange', () => instances.forEach(schedule => schedule()));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
