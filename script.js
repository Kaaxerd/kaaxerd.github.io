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

    const slideRect = slide.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const availableWidth = gridRect.width;
    const availableHeight = slideRect.bottom - gridRect.top - paddingBottom;

    const MIN_SIZE = 44;
    const MAX_SIZE = 112;

    let best = null;
    for (let c = 1; c <= n; c++) {
      const rows = Math.ceil(n / c);
      const itemW = (availableWidth - gap * (c - 1)) / c;
      const itemH = (availableHeight - gap * (rows - 1)) / rows;
      const size = Math.min(itemW, itemH);
      if (size <= 0) continue;
      const lastRow = n - c * (rows - 1);
      const unevenness = c - lastRow;
      const candidate = { c, rows, size, unevenness };

      if (!best) {
        best = candidate;
        continue;
      }

      const bestFits = best.size >= MIN_SIZE;
      const candFits = size >= MIN_SIZE;

      if (candFits && !bestFits) {
        best = candidate;
      } else if (candFits === bestFits) {
        if (candidate.unevenness < best.unevenness) {
          best = candidate;
        } else if (candidate.unevenness === best.unevenness && candidate.size > best.size) {
          best = candidate;
        }
      }
    }

    if (!best) return;

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
    sectionNav.style.opacity = String(progress);
    sectionNav.style.pointerEvents = progress > 0.1 ? "auto" : "none";
    if (langFlagsPreview) {
      langFlagsPreview.style.opacity = String(1 - progress);
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
      }
    }

    requestAnimationFrame(step);
  }

  function refreshLayout() {
    layoutTechGrid();
    computeTargets();
    updateNavOpacity();
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
  window.addEventListener("scroll", updateNavOpacity, { passive: true });

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
      e.preventDefault();
      if (animating) return;
      if (e.deltaY > 0) animateTo(current + 1);
      else if (e.deltaY < 0) animateTo(current - 1);
    },
    { passive: false }
  );

  let touchStartY = null;
  window.addEventListener(
    "touchstart",
    (e) => {
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchend",
    (e) => {
      if (touchStartY === null || animating || isDialogOpen()) return;
      const delta = touchStartY - e.changedTouches[0].clientY;
      touchStartY = null;
      if (Math.abs(delta) < 50) return;
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

  const compactQuery = window.matchMedia("(max-width: 29rem), (max-height: 22rem)");

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
      img.src = `img/${project}/${encodeURIComponent(file)}`;
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
