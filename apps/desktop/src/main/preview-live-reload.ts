/**
 * The script the preview server adds to every page it serves (3.2), as a classic script, as the
 * site's own are (X1). It listens to the server's events:
 * - `css`: the stylesheet changed alone; the new one is loaded beside the old, which goes once the
 *   new one has loaded, so nothing flashes unstyled;
 * - `reload`: pages changed; this one reloads if it is among them, or if everything did;
 * - `show`: the editor shows another page; this one goes there.
 *
 * While the tab is hidden, a reload or a move waits until it is shown again. It reads its base path
 * from its own tag, as the server wrote it.
 */
export const LIVE_RELOAD_SCRIPT = `(function () {
  "use strict";
  var script = document.currentScript;
  var base = script && script.getAttribute("data-base");
  if (!base || !window.EventSource) return;
  var here = decodeURIComponent(location.pathname.slice(base.length));
  if (here === "" || here.charAt(here.length - 1) === "/") here += "index.html";
  var waiting = null;
  function whenShown(run) {
    if (document.hidden) waiting = run;
    else run();
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && waiting) {
      var run = waiting;
      waiting = null;
      run();
    }
  });
  function swap(link, href) {
    var next = link.cloneNode(false);
    next.href = href;
    next.addEventListener("load", function () {
      if (link.parentNode) link.parentNode.removeChild(link);
    });
    link.parentNode.insertBefore(next, link.nextSibling);
  }
  var events = new EventSource(base + "__webforge/events");
  events.addEventListener("css", function (event) {
    var wanted = base + JSON.parse(event.data).href;
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var at = 0; at < links.length; at++) {
      var url = new URL(links[at].getAttribute("href"), location.href);
      if (url.pathname === wanted) {
        url.search = "?v=" + Date.now();
        swap(links[at], url.href);
      }
    }
  });
  events.addEventListener("reload", function (event) {
    var data = JSON.parse(event.data);
    if (data.all || data.pages.indexOf(here) !== -1) {
      whenShown(function () {
        location.reload();
      });
    }
  });
  events.addEventListener("show", function (event) {
    var page = JSON.parse(event.data).page;
    if (page !== here) {
      whenShown(function () {
        location.href = base + page;
      });
    }
  });
})();
`;
