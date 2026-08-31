(() => {
  const panels = Array.from(document.querySelectorAll(".hero, .slide"));
  if (!panels.length) return;

  const duration = 900;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const navLinks = Array.from(document.querySelectorAll(".section-nav-link"));

  let targets = [];
  let current = 0;
  let animating = false;

  function computeTargets() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    targets = panels.map((panel) => panel.offsetTop);
    if (maxScroll > targets[targets.length - 1] + 10) targets.push(maxScroll);
  }

  function updateActiveNav(index) {
    const navIndex = Math.min(index, panels.length - 1);
    navLinks.forEach((link) => {
      link.classList.toggle("active", Number(link.dataset.index) === navIndex);
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
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        animating = false;
      }
    }

    requestAnimationFrame(step);
  }

  computeTargets();
  updateActiveNav(current);
  window.addEventListener("resize", computeTargets);
  window.addEventListener("load", computeTargets);

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
