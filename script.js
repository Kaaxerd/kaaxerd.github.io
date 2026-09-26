(() => {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  document.documentElement.classList.add("has-title-reveal");

  let panels = Array.from(document.querySelectorAll(".hero, .slide"));
  if (!panels.length) return;

  const titleTargets = document.querySelectorAll(".project-title");
  if (titleTargets.length && "IntersectionObserver" in window) {
    const titleObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            titleObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    titleTargets.forEach((el) => titleObserver.observe(el));
  }

  // "Nuevos / Refrescantes / Entretenidos": each one is paused mid-animation
  // (off to the right, invisible) via CSS until this class lands, then they
  // play in from the right and settle centered, staggered by nth-child.
  const goalList = document.querySelector(".tech-goal-list");
  if (goalList && "IntersectionObserver" in window) {
    const goalObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            goalObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    goalObserver.observe(goalList);
  }

  const duration = 900;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const navLinks = Array.from(document.querySelectorAll(".section-nav-link"));
  const sectionNav = document.querySelector(".section-nav");
  const hero = document.querySelector(".hero");
  const langFlagsPreview = document.querySelector(".lang-flags-preview");

  let targets = [];
  // Panel index each nav link points at, derived from its href (-1 while the
  // target is missing), so reordering slides never desyncs the nav.
  let navIndices = [];
  let current = 0;
  let maxReached = 0;
  let animating = false;

  function computeTargets() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    targets = panels.map((panel) => panel.offsetTop);
    if (maxScroll > targets[targets.length - 1] + 10) targets.push(maxScroll);
  }

  function computeNavIndices() {
    navIndices = navLinks.map((link) => {
      const id = decodeURIComponent((link.getAttribute("href") || "").replace(/^#/, ""));
      const target = id ? document.getElementById(id) : null;
      return target ? panels.findIndex((panel) => panel === target || panel.contains(target)) : -1;
    });
  }

  function layoutTechGrid() {
    const grid = document.querySelector(".tech-grid");
    if (!grid) return;
    const items = Array.from(grid.children);
    const n = items.length;
    if (!n) return;

    const slide = grid.closest(".slide");
    const slideStyle = getComputedStyle(slide);
    const gridStyle = getComputedStyle(grid);
    const gap = parseFloat(gridStyle.columnGap || gridStyle.gap) || 0;
    const paddingBottom = parseFloat(slideStyle.paddingBottom) || 0;
    const paddingTop = parseFloat(slideStyle.paddingTop) || 0;

    const content = grid.parentElement;
    const gridRect = grid.getBoundingClientRect();
    const availableWidth = gridRect.width;
    // Measure the space left by everything except the grid, so the result does
    // not depend on the size the grid happens to have right now.
    const siblingsHeight = content.getBoundingClientRect().height - gridRect.height;
    const viewportHeight = Math.min(slide.clientHeight, window.innerHeight);
    const availableHeight = viewportHeight - paddingTop - paddingBottom - siblingsHeight;
    if (availableHeight <= 0) return;

    const MIN_SIZE = 44;
    const MAX_SIZE = 112;
    const SIZE_TOLERANCE = 0.95;

    const candidates = [];
    for (let c = 1; c <= n; c++) {
      const rows = Math.ceil(n / c);
      const itemW = (availableWidth - gap * (c - 1)) / c;
      const itemH = (availableHeight - gap * (rows - 1)) / rows;
      const size = Math.min(itemW, itemH);
      if (size <= 0) continue;
      const lastRow = n - c * (rows - 1);
      candidates.push({ c, rows, size, effective: Math.min(size, MAX_SIZE), unevenness: c - lastRow });
    }
    if (!candidates.length) return;

    const fitting = candidates.filter((cand) => cand.size >= MIN_SIZE);
    const pool = fitting.length ? fitting : candidates;
    const bestEffective = Math.max(...pool.map((cand) => cand.effective));
    const best = pool
      .filter((cand) => cand.effective >= bestEffective * SIZE_TOLERANCE)
      .reduce((a, b) => {
        if (b.unevenness !== a.unevenness) return b.unevenness < a.unevenness ? b : a;
        if (b.effective !== a.effective) return b.effective > a.effective ? b : a;
        return b.size > a.size ? b : a;
      });

    const { c, rows } = best;
    const width = Math.floor(Math.min((availableWidth - gap * (c - 1)) / c, MAX_SIZE)) - 1;
    const height = Math.floor(Math.min((availableHeight - gap * (rows - 1)) / rows, MAX_SIZE)) - 1;
    const lastRow = n - c * (rows - 1);
    const offset = Math.floor((c - lastRow) / 2);
    const lastRowStart = c * (rows - 1);

    grid.style.gridTemplateColumns = `repeat(${c}, ${width}px)`;
    grid.style.gridAutoRows = `${height}px`;

    items.forEach((item, i) => {
      if (i >= lastRowStart) {
        item.style.gridColumnStart = String(offset + 1 + (i - lastRowStart));
      } else {
        item.style.gridColumnStart = "";
      }
    });
  }

  function updateNavOpacity() {
    if (!sectionNav || !hero) return;
    const heroHeight = hero.offsetHeight || 1;
    const progress = Math.min(Math.max(window.scrollY / heroHeight, 0), 1);
    const opacity = progress;
    sectionNav.style.opacity = String(opacity);
    sectionNav.style.pointerEvents = opacity > 0.1 ? "auto" : "none";
    if (langFlagsPreview) {
      const langOpacity = 1 - progress;
      langFlagsPreview.style.opacity = String(langOpacity);
      langFlagsPreview.style.pointerEvents = langOpacity > 0.1 ? "auto" : "none";
    }
  }

  function updateActiveNav(index) {
    const navIndex = Math.min(index, panels.length - 1);
    if (navIndex > maxReached) maxReached = navIndex;

    // Slides without their own row (e.g. a continuation slide) select the
    // nearest preceding linked slide.
    let activeLink = null;
    let activeIndex = -1;
    navLinks.forEach((link, i) => {
      const linkIndex = navIndices[i];
      if (linkIndex >= 0 && linkIndex <= navIndex && linkIndex > activeIndex) {
        activeIndex = linkIndex;
        activeLink = link;
      }
    });

    let parent = null;
    let lastChild = null;
    navLinks.forEach((link, i) => {
      const linkIndex = navIndices[i];
      const revealed = linkIndex >= 0 && linkIndex <= maxReached;
      const isChild = link.classList.contains("section-nav-link--sub");
      link.classList.toggle("revealed", revealed);
      link.classList.toggle("active", link === activeLink);
      if (link === activeLink) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
      link.classList.remove("is-branch-end", "is-expanded");
      if (!isChild) {
        parent = link;
        lastChild = null;
      } else if (revealed) {
        lastChild?.classList.remove("is-branch-end");
        link.classList.add("is-branch-end");
        lastChild = link;
        parent?.classList.add("is-expanded");
      }
    });
  }

  function animateTo(index) {
    if (index < 0 || index >= targets.length || animating) return;
    animating = true;
    current = index;
    updateActiveNav(current);

    const startY = window.scrollY;
    const targetY = targets[index];
    const distance = targetY - startY;
    const startTime = performance.now();

    function step(now) {
      const t = Math.min((now - startTime) / duration, 1);
      window.scrollTo(0, startY + distance * ease(t));
      updateNavOpacity();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        animating = false;
        panels.forEach((panel, i) => {
          if (i !== current) panel.scrollTop = 0;
        });
      }
    }

    requestAnimationFrame(step);
  }

  function refreshLayout() {
    panels = Array.from(document.querySelectorAll(".hero, .slide"));
    layoutTechGrid();
    computeTargets();
    computeNavIndices();
    updateActiveNav(current);
    if (!animating && targets.length) {
      const index = Math.min(current, targets.length - 1);
      if (Math.abs(window.scrollY - targets[index]) > 1) window.scrollTo(0, targets[index]);
    }
    updateNavOpacity();
  }

  function syncCurrent() {
    if (animating || !targets.length) return;
    const y = window.scrollY;
    let index = 0;
    let bestDistance = Infinity;
    targets.forEach((target, i) => {
      const distance = Math.abs(target - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        index = i;
      }
    });
    if (index !== current) {
      current = index;
      updateActiveNav(current);
    }
  }

  let resizeQueued = false;
  function queueRefreshLayout() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      refreshLayout();
    });
  }

  refreshLayout();
  updateActiveNav(current);
  window.addEventListener("resize", queueRefreshLayout);
  window.addEventListener("load", refreshLayout);
  window.addEventListener(
    "scroll",
    () => {
      updateNavOpacity();
      syncCurrent();
    },
    { passive: true }
  );

  // Returns the nearest ancestor that can still scroll in the dragged
  // direction, so inner scrollers (galleries, long slides, the popover) keep
  // their native scrolling while the page itself stays snapped.
  function scrollableAncestor(node, delta) {
    let el = node instanceof Element ? node : null;
    while (el && el !== document.body && el !== document.documentElement) {
      const overflowY = getComputedStyle(el).overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        el.scrollHeight - el.clientHeight > 1
      ) {
        const canScrollDown = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
        const canScrollUp = el.scrollTop > 1;
        if (delta > 0 ? canScrollDown : canScrollUp) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  // A fresh scroll gesture is required to leave a slide once its inner content
  // has been scrolled to the end.
  const INNER_SCROLL_COOLDOWN = 250;
  let lastInnerScroll = 0;

  function openDialog() {
    return document.querySelector("dialog[open], [popover]:popover-open");
  }

  function isDialogOpen() {
    return Boolean(openDialog());
  }

  // Trackpads and free-spin wheels emit a long inertial stream of wheel events
  // for a single flick, often outlasting the slide animation. The whole stream
  // is treated as one gesture that may change at most one slide; a new gesture
  // starts after a quiet gap, a direction flip, or a clear acceleration (the
  // user pushed again while the inertia was decaying).
  const WHEEL_GESTURE_GAP = 180;
  const WHEEL_MIN_DELTA = 4;
  const WHEEL_ACCEL_RATIO = 2;
  const WHEEL_ACCEL_MIN = 15;
  let lastWheelTime = -Infinity;
  let lastWheelMagnitude = 0;
  let lastWheelSign = 0;
  let wheelGestureUsed = false;

  function normalizedWheelDelta(e) {
    if (e.deltaMode === 1) return e.deltaY * 16;
    if (e.deltaMode === 2) return e.deltaY * window.innerHeight;
    return e.deltaY;
  }

  // Returns true when this event begins a new gesture.
  function trackWheelGesture(delta) {
    const now = performance.now();
    const magnitude = Math.abs(delta);
    const sign = Math.sign(delta);
    const isNew =
      now - lastWheelTime > WHEEL_GESTURE_GAP ||
      (sign !== 0 && sign !== lastWheelSign) ||
      magnitude > Math.max(lastWheelMagnitude * WHEEL_ACCEL_RATIO, lastWheelMagnitude + WHEEL_ACCEL_MIN);
    lastWheelTime = now;
    lastWheelMagnitude = magnitude;
    if (sign !== 0) lastWheelSign = sign;
    if (isNew) wheelGestureUsed = false;
    return isNew;
  }

  window.addEventListener(
    "wheel",
    (e) => {
      const dialog = openDialog();
      if (dialog) {
        // Keep the page from scrolling underneath the popover so it stays
        // put; if the wheel is over the popover itself, let it scroll its
        // own (scrollbar-less) content instead.
        if (!dialog.contains(e.target)) e.preventDefault();
        return;
      }
      const delta = normalizedWheelDelta(e);
      trackWheelGesture(delta);
      if (scrollableAncestor(e.target, delta)) {
        lastInnerScroll = performance.now();
        // The gesture that scrolled inner content must not also flip the slide.
        wheelGestureUsed = true;
        return;
      }
      e.preventDefault();
      // Gestures starting mid-animation are swallowed too, so their inertial
      // tail can't fire a delayed second jump once the animation ends.
      if (animating) {
        wheelGestureUsed = true;
        return;
      }
      if (wheelGestureUsed) return;
      if (performance.now() - lastInnerScroll < INNER_SCROLL_COOLDOWN) return;
      if (Math.abs(delta) < WHEEL_MIN_DELTA) return;
      wheelGestureUsed = true;
      animateTo(current + (delta > 0 ? 1 : -1));
    },
    { passive: false }
  );

  const SWIPE_THRESHOLD = 40;
  let touchStartY = null;
  let touchNative = false;
  let touchMulti = false;

  window.addEventListener(
    "touchstart",
    (e) => {
      touchMulti = e.touches.length > 1;
      touchNative = false;
      touchStartY = touchMulti ? null : e.touches[0].clientY;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (touchMulti || touchStartY === null) return;
      if (e.touches.length > 1) {
        touchMulti = true;
        return;
      }
      const delta = touchStartY - e.touches[0].clientY;
      const dialog = openDialog();
      if (dialog && !dialog.contains(e.target)) {
        if (e.cancelable) e.preventDefault();
        touchNative = true;
        return;
      }
      if (scrollableAncestor(e.target, delta)) {
        touchNative = true;
        return;
      }
      if (touchNative) {
        // The inner scroller just hit its end: restart the gesture from here so
        // dragging further still moves to the next panel.
        touchNative = false;
        touchStartY = e.touches[0].clientY;
      }
      if (e.cancelable) e.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener(
    "touchend",
    (e) => {
      const startY = touchStartY;
      const native = touchNative;
      const multi = touchMulti;
      touchStartY = null;
      touchNative = false;
      touchMulti = false;
      if (startY === null || native || multi || animating || isDialogOpen()) return;
      const delta = startY - e.changedTouches[0].clientY;
      if (Math.abs(delta) < SWIPE_THRESHOLD) return;
      if (delta > 0) animateTo(current + 1);
      else animateTo(current - 1);
    },
    { passive: true }
  );

  window.addEventListener("keydown", (e) => {
    if (animating || isDialogOpen()) return;
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      animateTo(current + 1);
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      animateTo(current - 1);
    }
  });

  document.querySelector(".hero-scroll")?.addEventListener("click", (e) => {
    e.preventDefault();
    animateTo(1);
  });

  document.querySelectorAll(".project-next").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      animateTo(current + 1);
    });
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const index = navIndices[navLinks.indexOf(link)];
      if (index >= 0) animateTo(index);
    });
  });
})();

(() => {
  // Experience/education sequencer: bars can be selected (editor-style
  // highlight only), the Capgemini track folds its child tracks, and the
  // playhead sweeps from the start of the ruler to today the first time the
  // slide is reached, revealing everything as it passes.
  const sequencer = document.querySelector(".sequencer");
  if (!sequencer) return;
  const bars = Array.from(sequencer.querySelectorAll(".seq-bar"));
  const clock = sequencer.querySelector(".seq-clock-time");

  const style = getComputedStyle(sequencer);
  const start = parseFloat(style.getPropertyValue("--seq-start")) || 2019;
  const span = parseFloat(style.getPropertyValue("--seq-span")) || 8;
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const todayYear = today.getFullYear() + (today.getMonth() + (today.getDate() - 1) / daysInMonth) / 12;
  const now = Math.min(Math.max((todayYear - start) / span, 0), 1);
  sequencer.style.setProperty("--seq-now", now.toFixed(4));
  if (clock) {
    clock.dateTime = today.toISOString().slice(0, 10);
    clock.textContent = `${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`;
  }

  bars.forEach((bar) => {
    const props = getComputedStyle(bar);
    const from = parseFloat(props.getPropertyValue("--from"));
    const to = parseFloat(props.getPropertyValue("--to"));
    bar.classList.toggle("seq-bar--label-start", from - start > start + span - to);
  });

  function select(bar) {
    bars.forEach((b) => b.setAttribute("aria-pressed", String(b === bar)));
  }

  bars.forEach((bar) => {
    bar.addEventListener("click", () => select(bar));
    bar.addEventListener("focus", () => select(bar));
    bar.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const visible = bars.filter((b) => b.offsetParent !== null);
      const i = visible.indexOf(bar);
      const next = visible[(i + (e.key === "ArrowRight" ? 1 : -1) + visible.length) % visible.length];
      next.focus();
    });
  });

  sequencer.querySelectorAll(".seq-toggle").forEach((toggle) => {
    const rows = (toggle.getAttribute("aria-controls") || "")
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(expanded));
      rows.forEach((row) => {
        row.hidden = !expanded;
      });
    });
  });

  if (!("IntersectionObserver" in window)) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SWEEP_MS = reduced ? 500 : 1600;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const revealables = Array.from(sequencer.querySelectorAll(".seq-bar"));
  const keys = revealables.map(
    (el) => (parseFloat(getComputedStyle(el).getPropertyValue("--from")) - start) / span
  );

  sequencer.classList.add("is-armed");
  sequencer.style.setProperty("--seq-t", "0");

  function sweep() {
    const startTime = performance.now();
    function step(time) {
      const t = Math.min((time - startTime) / SWEEP_MS, 1);
      const head = now * ease(t);
      sequencer.style.setProperty("--seq-t", head.toFixed(4));
      revealables.forEach((el, i) => {
        if (head >= keys[i]) el.classList.add("is-revealed");
      });
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        revealables.forEach((el) => el.classList.add("is-revealed"));
        sequencer.style.removeProperty("--seq-t");
      }
    }
    requestAnimationFrame(step);
  }

  const sweepObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      sweepObserver.disconnect();
      sweep();
    },
    { threshold: 0.4 }
  );
  sweepObserver.observe(sequencer);
})();

(() => {
  // Assets live next to this script, not next to the page, so the localized
  // copies under /en/ and /de/ resolve them too.
  const ASSET_BASE = new URL(".", document.currentScript?.src || location.href);

  const GALLERY_IMAGES = {
    nextcell: ["01.webp", "02.webp", "03.webp", "04.webp"],
    fireball: [],
    "escape-light-dungeon": ["01.webp", "02.webp", "03.webp", "04.webp"],
    "patata-o-plomo": [],
    "player-vs-cubos": [],
    tfg: [],
  };

  const AUTOPLAY_MS = 5000;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildGallery(container, project, files) {
    const images = shuffle(files);
    let index = 0;
    let timer = null;

    container.classList.add("has-gallery");
    container.removeAttribute("aria-hidden");
    container.setAttribute("role", "group");
    container.setAttribute("aria-roledescription", "carrusel");
    container.setAttribute("aria-label", `Capturas de ${project}`);
    container.querySelector(".project-media-icon")?.remove();

    const slidesWrap = document.createElement("div");
    slidesWrap.className = "project-media-slides";

    const slides = images.map((file, i) => {
      const img = document.createElement("img");
      img.className = "project-media-slide";
      img.src = new URL(`img/${project}/${encodeURIComponent(file)}`, ASSET_BASE).href;
      img.alt = `Captura ${i + 1} de ${images.length} de ${project}`;
      img.loading = "lazy";
      slidesWrap.appendChild(img);
      return img;
    });
    container.appendChild(slidesWrap);

    let dots = [];
    if (images.length > 1) {
      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "project-media-nav project-media-nav--prev";
      prevBtn.setAttribute("aria-label", "Imagen anterior");
      prevBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "project-media-nav project-media-nav--next";
      nextBtn.setAttribute("aria-label", "Imagen siguiente");
      nextBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

      const dotsWrap = document.createElement("div");
      dotsWrap.className = "project-media-dots";
      dots = images.map((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "project-media-dot";
        dot.setAttribute("aria-label", `Ir a la imagen ${i + 1}`);
        dot.addEventListener("click", (e) => {
          e.stopPropagation();
          goTo(i);
          restartTimer();
        });
        dotsWrap.appendChild(dot);
        return dot;
      });

      container.append(prevBtn, nextBtn);
      (container.closest(".project-media-wrap") || container).append(dotsWrap);

      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        goTo(index - 1);
        restartTimer();
      });
      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        goTo(index + 1);
        restartTimer();
      });
    }

    function render() {
      slides.forEach((img, i) => img.classList.toggle("active", i === index));
      dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
    }

    function goTo(i) {
      index = (i + images.length) % images.length;
      render();
    }

    function restartTimer() {
      if (images.length < 2) return;
      if (timer) clearInterval(timer);
      timer = setInterval(() => goTo(index + 1), AUTOPLAY_MS);
    }

    render();
    restartTimer();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (timer) clearInterval(timer);
      } else {
        restartTimer();
      }
    });
  }

  document.querySelectorAll(".project-media[data-gallery]").forEach((container) => {
    const project = container.dataset.gallery;
    const files = GALLERY_IMAGES[project];
    if (files && files.length) buildGallery(container, project, files);
  });
})();

(() => {
  const hero = document.querySelector(".hero");
  const grid = document.querySelector(".viewport-grid");
  const gizmo = document.querySelector(".viewport-gizmo");
  if (!hero || !grid || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let targetX = 0;
  let targetY = 0;
  let curX = 0;
  let curY = 0;
  let raf = null;

  function tick() {
    curX += (targetX - curX) * 0.08;
    curY += (targetY - curY) * 0.08;
    grid.style.setProperty("--tilt-x", `${(curY * 6).toFixed(2)}deg`);
    grid.style.setProperty("--tilt-y", `${(curX * 10).toFixed(2)}deg`);
    if (gizmo) gizmo.style.transform = `rotate(${(curX * 8).toFixed(2)}deg)`;

    if (Math.abs(targetX - curX) > 0.0005 || Math.abs(targetY - curY) > 0.0005) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
    }
  }

  hero.addEventListener(
    "mousemove",
    (e) => {
      const rect = hero.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width - 0.5;
      targetY = (e.clientY - rect.top) / rect.height - 0.5;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    { passive: true }
  );

  hero.addEventListener("mouseleave", () => {
    targetX = 0;
    targetY = 0;
    if (!raf) raf = requestAnimationFrame(tick);
  });
})();

(() => {
  // Same tilt idea as the hero gizmo, echoed on each project thumbnail: the
  // card responds to the mouse like a small viewport rather than a static
  // photo. Skipped on touch, where hover doesn't apply; toned down (not
  // removed) under reduced motion, same treatment as the rest of the boot
  // sequence - a few degrees of rotation isn't the large-scale parallax
  // motion that preference exists to avoid.
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const MAX_TILT_DEG = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 2 : 6;

  document.querySelectorAll(".project-media").forEach((media) => {
    media.addEventListener(
      "mousemove",
      (e) => {
        const rect = media.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        media.style.setProperty("--tilt-x", `${(-py * MAX_TILT_DEG).toFixed(2)}deg`);
        media.style.setProperty("--tilt-y", `${(px * MAX_TILT_DEG).toFixed(2)}deg`);
      },
      { passive: true }
    );

    media.addEventListener("mouseleave", () => {
      media.style.setProperty("--tilt-x", "0deg");
      media.style.setProperty("--tilt-y", "0deg");
    });
  });
})();
