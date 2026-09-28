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
