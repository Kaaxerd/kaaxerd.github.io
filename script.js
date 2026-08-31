(() => {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  const panels = Array.from(document.querySelectorAll(".hero, .slide"));
  if (!panels.length) return;

  const duration = 900;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const navLinks = Array.from(document.querySelectorAll(".section-nav-link"));
  const sectionNav = document.querySelector(".section-nav");
  const hero = document.querySelector(".hero");

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

  window.addEventListener(
    "wheel",
    (e) => {
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
      if (touchStartY === null || animating) return;
      const delta = touchStartY - e.changedTouches[0].clientY;
      touchStartY = null;
      if (Math.abs(delta) < 50) return;
      if (delta > 0) animateTo(current + 1);
      else animateTo(current - 1);
    },
    { passive: true }
  );

  window.addEventListener("keydown", (e) => {
    if (animating) return;
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

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      animateTo(Number(link.dataset.index));
    });
  });
})();
