const hero = document.querySelector(".consumer-hero");
const footer = document.querySelector(".footer");
const stickyCta = document.querySelector(".consumer-sticky-cta");

if (hero && stickyCta && "IntersectionObserver" in window) {
  let isPastHero = false;
  let isFooterVisible = false;

  const updateSticky = () => {
    stickyCta.classList.toggle("is-visible", isPastHero && !isFooterVisible);
  };

  const observer = new IntersectionObserver(([entry]) => {
    isPastHero = !entry.isIntersecting;
    updateSticky();
  });

  observer.observe(hero);

  if (footer) {
    const footerObserver = new IntersectionObserver(([entry]) => {
      isFooterVisible = entry.isIntersecting;
      updateSticky();
    });

    footerObserver.observe(footer);
  }
}
