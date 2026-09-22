(() => {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  document.documentElement.classList.add("has-title-reveal");

  const panels = Array.from(document.querySelectorAll(".hero, .slide"));
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

  // Draw-in for the timeline curves: measure the real path length so the
  // dash pattern matches exactly, then reveal each one once when its section
  // is reached. Runs for everyone; the CSS shortens it under reduced motion
  // instead of skipping it, same as the hero boot.
  const timelines = Array.from(document.querySelectorAll(".timeline"));
  if (timelines.length && "IntersectionObserver" in window) {
    timelines.forEach((timeline) => {
      const path = timeline.querySelector(".timeline-curve path");
      if (!path) return;
      timeline.style.setProperty("--path-length", String(path.getTotalLength()));
      timeline.classList.add("js-draw");
    });

    const timelineObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-drawn");
            timelineObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    timelines.forEach((timeline) => timelineObserver.observe(timeline));
  }

  const duration = 900;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const navLinks = Array.from(document.querySelectorAll(".section-nav-link"));
  const sectionNav = document.querySelector(".section-nav");
  const hero = document.querySelector(".hero");
  const langFlagsPreview = document.querySelector(".lang-flags-preview");

  let targets = [];
  let current = 0;
  let maxReached = 0;
  let animating = false;

  function computeTargets() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    targets = panels.map((panel) => panel.offsetTop);
    if (maxScroll > targets[targets.length - 1] + 10) targets.push(maxScroll);
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

  const tfgPanel = document.getElementById("project-tfg");
  const narrowQuery = window.matchMedia("(max-width: 900px)");

  function updateNavOpacity() {
    if (!sectionNav || !hero) return;
    const heroHeight = hero.offsetHeight || 1;
    const progress = Math.min(Math.max(window.scrollY / heroHeight, 0), 1);
    let opacity = progress;
    if (tfgPanel && narrowQuery.matches) {
      // The nav rail cuts across this slide's text on narrow screens, so fade
      // it out while the slide is on screen.
      const rect = tfgPanel.getBoundingClientRect();
      const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      opacity *= 1 - Math.min(Math.max(visible / (window.innerHeight || 1), 0), 1);
    }
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
    navLinks.forEach((link) => {
      const linkIndex = Number(link.dataset.index);
      link.classList.toggle("active", linkIndex === navIndex);
      link.classList.toggle("revealed", linkIndex <= maxReached);
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
    layoutTechGrid();
    computeTargets();
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
      if (scrollableAncestor(e.target, e.deltaY)) {
        lastInnerScroll = performance.now();
        return;
      }
      e.preventDefault();
      if (animating) return;
      if (performance.now() - lastInnerScroll < INNER_SCROLL_COOLDOWN) return;
      if (e.deltaY > 0) animateTo(current + 1);
      else if (e.deltaY < 0) animateTo(current - 1);
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
      animateTo(Number(link.dataset.index));
    });
  });
})();

(() => {
  const popover = document.getElementById("capgemini-work");
  const opener = document.querySelector('[popovertarget="capgemini-work"]');
  if (!popover || !opener) return;
  const arrow = popover.querySelector(".work-popover-arrow");

  const compactQuery = window.matchMedia("(max-width: 900px), (max-height: 22rem)");

  function positionPopover() {
    if (compactQuery.matches) {
      popover.style.removeProperty("left");
      popover.style.removeProperty("top");
      return;
    }

    const btnRect = opener.getBoundingClientRect();
    const margin = 12;
    const gap = 10;

    popover.style.left = "0px";
    popover.style.top = "0px";

    const popRect = popover.getBoundingClientRect();

    let left = btnRect.left;
    left = Math.min(left, window.innerWidth - popRect.width - margin);
    left = Math.max(left, margin);

    const spaceBelow = window.innerHeight - btnRect.bottom - gap - margin;
    const spaceAbove = btnRect.top - gap - margin;

    let top;
    let placeAbove;
    if (popRect.height <= spaceBelow || spaceBelow >= spaceAbove) {
      placeAbove = false;
      top = btnRect.bottom + gap;
    } else {
      placeAbove = true;
      top = btnRect.top - gap - popRect.height;
    }
    top = Math.min(Math.max(top, margin), window.innerHeight - margin - popRect.height);

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    if (arrow) {
      const arrowLeft = Math.min(
        Math.max(btnRect.left + btnRect.width / 2 - left - 6, 12),
        popRect.width - 24
      );
      arrow.style.left = `${arrowLeft}px`;
      if (placeAbove) {
        arrow.style.top = "auto";
        arrow.style.bottom = "-6px";
        arrow.style.transform = "rotate(225deg)";
      } else {
        arrow.style.top = "-6px";
        arrow.style.bottom = "auto";
        arrow.style.transform = "rotate(45deg)";
      }
    }
  }

  popover.addEventListener("toggle", (e) => {
    if (e.newState === "open") positionPopover();
  });

  window.addEventListener("resize", () => {
    if (popover.matches(":popover-open")) positionPopover();
  });
})();

(() => {
  // Assets live next to this script, not next to the page, so the localized
  // copies under /en/ and /de/ resolve them too.
  const ASSET_BASE = new URL(".", document.currentScript?.src || location.href);

  const GALLERY_IMAGES = {
    nextcell: [
      "Captura de pantalla 2026-09-11 121509.png",
      "Captura de pantalla 2026-09-11 121542.png",
      "Captura de pantalla 2026-09-11 121613.png",
      "Captura de pantalla 2026-09-11 121644.png",
    ],
    fireball: [],
    "escape-light-dungeon": [
      "Captura de pantalla 2026-09-11 124755.png",
      "Captura de pantalla 2026-09-11 124834.png",
      "Captura de pantalla 2026-09-11 124859.png",
      "Captura de pantalla 2026-09-11 124928.png",
    ],
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
