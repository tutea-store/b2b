const hero = document.querySelector(".consumer-hero");
const stickyCta = document.querySelector(".consumer-sticky-cta");

if (hero && stickyCta && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(([entry]) => {
    stickyCta.classList.toggle("is-visible", !entry.isIntersecting);
  });

  observer.observe(hero);
}
