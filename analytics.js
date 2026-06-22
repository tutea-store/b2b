(function (window, document, tagName, source, functionName, script, firstScript) {
  window[functionName] = window[functionName] || function () {
    (window[functionName].a = window[functionName].a || []).push(arguments);
  };
  window[functionName].l = 1 * new Date();

  for (var index = 0; index < document.scripts.length; index += 1) {
    if (document.scripts[index].src === source) return;
  }

  script = document.createElement(tagName);
  firstScript = document.getElementsByTagName(tagName)[0];
  script.async = true;
  script.src = source;
  firstScript.parentNode.insertBefore(script, firstScript);
})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=110065875", "ym");

ym(110065875, "init", {
  ssr: true,
  webvisor: true,
  clickmap: true,
  ecommerce: "dataLayer",
  referrer: document.referrer,
  url: location.href,
  accurateTrackBounce: true,
  trackLinks: true
});

document.addEventListener("click", function (event) {
  if (!(event.target instanceof Element)) return;

  var link = event.target.closest("a[href]");
  if (!link) return;

  var href = link.getAttribute("href") || "";
  var decodedHref = href;

  try {
    decodedHref = decodeURIComponent(href);
  } catch (error) {
    // Keep the original URL if it contains an invalid escape sequence.
  }

  var goal = "";

  if (href.indexOf("t.me/") !== -1) {
    goal = decodedHref.toLowerCase().indexOf("сэмпл-бокс") !== -1
      ? "sample_box_click"
      : "telegram_click";
  } else if (href.indexOf("catalog.html") !== -1) {
    goal = "catalog_open";
  } else if (/\.(pdf|zip)(?:[?#]|$)/i.test(href)) {
    goal = "material_download";
  }

  if (!goal) return;

  ym(110065875, "reachGoal", goal, {
    page: location.pathname,
    link: href.split("?")[0],
    label: (link.textContent || "").trim().slice(0, 100)
  });
});
