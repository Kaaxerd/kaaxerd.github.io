(() => {
  const thesisBar = document.querySelector('.thesis-bar');
  const hero = document.querySelector('.hero');
  const chapterLabel = document.querySelector('.thesis-bar-chapter');
  const chapters = document.querySelectorAll('.chapter');

  if (!thesisBar || !hero || !('IntersectionObserver' in window)) return;

  const barOffset = () => thesisBar.offsetTop + thesisBar.offsetHeight;

  new IntersectionObserver(([entry]) => {
    thesisBar.classList.toggle('is-visible', !entry.isIntersecting);
  }, { rootMargin: `-${barOffset()}px 0px 0px 0px` }).observe(hero);

  const setChapter = (chapter) => {
    const number = chapter.querySelector('.chapter-number');
    const title = chapter.querySelector('h2');
    if (!number || !title) return;

    const numberEl = document.createElement('span');
    numberEl.textContent = number.textContent;
    chapterLabel.replaceChildren(numberEl, title.textContent);
  };

  // A chapter becomes current once its band reaches the thesis bar.
  const chapterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setChapter(entry.target);
    });
  }, { rootMargin: `-${barOffset()}px 0px -${Math.max(0, window.innerHeight - barOffset() - 1)}px 0px` });

  chapters.forEach((chapter) => chapterObserver.observe(chapter));
})();

(() => {
  const triangle = document.querySelector('.method-triangle');
  if (!triangle || !('IntersectionObserver' in window)) return;

  triangle.classList.add('is-armed');

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    // Let the armed state paint once so the transition has a start frame.
    requestAnimationFrame(() => triangle.classList.add('is-drawn'));
    observer.disconnect();
  }, { threshold: 0.5 });

  observer.observe(triangle);
})();

(() => {
  if (!('IntersectionObserver' in window)) return;

  // Visitors with reduced motion still get a signal that the chart woke up,
  // just without the scale/transform: bars render at full size from the
  // start and only the value labels fade in, no movement involved.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  // Grows each bar from its own baseline once the chart scrolls into view.
  // Plain inline styles + Web Animations API: no CSS classes, so there's no
  // cascade/specificity to fight, and without WAAPI support bars just sit
  // at full size (animate() would be undefined and skip everything below).
  const growChart = (chartSelector, barSelector, { axis, origin, groupSize = 1 }) => {
    const chart = document.querySelector(chartSelector);
    const bars = chart ? chart.querySelectorAll(barSelector) : [];
    if (!chart || !bars.length || !bars[0].animate) return;

    const values = chart.querySelectorAll('.frame-chart-value, .zone-chart-value');
    const collapsed = axis === 'x' ? 'scaleX(0)' : 'scaleY(0)';
    const full = axis === 'x' ? 'scaleX(1)' : 'scaleY(1)';

    if (!reduceMotion) {
      bars.forEach((bar) => {
        bar.style.transformOrigin = typeof origin === 'function' ? origin(bar) : origin;
        bar.style.transform = collapsed;
      });
    }
    values.forEach((value) => { value.style.opacity = '0'; });

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;

      if (!reduceMotion) {
        bars.forEach((bar, i) => {
          const delay = Math.floor(i / groupSize) * 90;
          bar.animate([{ transform: collapsed }, { transform: full }], {
            duration: 650,
            delay,
            easing: EASE,
            fill: 'forwards',
          });
        });
      }

      values.forEach((value, i) => {
        const delay = Math.floor(i / groupSize) * 90 + (reduceMotion ? 0 : 500);
        value.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: reduceMotion ? 500 : 300,
          delay,
          easing: 'ease',
          fill: 'forwards',
        });
      });

      observer.disconnect();
    }, { threshold: 0.3 });

    observer.observe(chart);
  };

  growChart('.zone-chart', '.zone-chart-bar--pueblo, .zone-chart-bar--lago, .zone-chart-bar--ciudad', {
    axis: 'y',
    origin: '0px 154px',
    groupSize: 3,
  });

  growChart('.frame-chart', '.frame-chart-bar', {
    axis: 'x',
    origin: (bar) => `${bar.getAttribute('x')}px 0px`,
  });
})();
