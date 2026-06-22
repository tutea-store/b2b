(function () {
  var counterId = 110065875;
  var source = new URLSearchParams(location.search).get("source") || "main";
  var destination = new URL("index.html", location.href);

  destination.searchParams.set("utm_source", "qr");
  destination.searchParams.set("utm_medium", "offline");
  destination.searchParams.set("utm_campaign", "main_qr");
  destination.searchParams.set("utm_content", source);

  var redirected = false;

  function redirect() {
    if (redirected) return;
    redirected = true;
    location.replace(destination.href);
  }

  window.setTimeout(redirect, 1100);

  if (typeof window.ym === "function") {
    window.ym(counterId, "reachGoal", "qr_open", {
      source: source,
      destination: destination.pathname
    }, redirect);
  }
})();
