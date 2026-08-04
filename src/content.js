(() => {
  const STORAGE_KEY = "mode";

  // Set on anchors whose `download` attribute we stripped, so it can be put back.
  const STRIPPED_ATTR = "data-pdforce-stripped-download";
  // Set on anchors we added a `download` attribute to.
  const ADDED_ATTR = "data-pdforce-added-download";

  const PDF_QUERY_HINTS = [
    "format=pdf",
    "type=pdf",
    "output=pdf",
    "filetype=pdf",
    "export=pdf",
    "download=pdf",
    "mimetype=application/pdf"
  ];

  let mode = "off";

  function looksLikePdf(anchor) {
    const href = anchor.href;
    if (!href) return false;

    let url;
    try {
      url = new URL(href, document.baseURI);
    } catch {
      return false;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    const path = url.pathname.toLowerCase();
    if (path.endsWith(".pdf")) return true;
    // Paths like /files/report.pdf/download or /view/report.pdf/inline.
    if (path.includes(".pdf/")) return true;
    // Viewer-style links: /viewer?file=/docs/report.pdf
    for (const value of url.searchParams.values()) {
      const lowered = value.toLowerCase();
      if (lowered.endsWith(".pdf") || lowered.includes(".pdf?") || lowered.includes(".pdf&")) {
        return true;
      }
    }

    const query = url.search.toLowerCase().replace(/\s/g, "");
    if (PDF_QUERY_HINTS.some((hint) => query.includes(hint))) return true;

    return false;
  }

  function forceView(anchor) {
    if (!anchor.hasAttribute("download")) return;
    if (!looksLikePdf(anchor)) return;
    anchor.setAttribute(STRIPPED_ATTR, anchor.getAttribute("download"));
    anchor.removeAttribute("download");
  }

  function forceDownload(anchor) {
    if (anchor.hasAttribute("download")) return;
    if (!looksLikePdf(anchor)) return;
    anchor.setAttribute("download", "");
    anchor.setAttribute(ADDED_ATTR, "");
  }

  function restore(anchor) {
    if (anchor.hasAttribute(ADDED_ATTR)) {
      anchor.removeAttribute("download");
      anchor.removeAttribute(ADDED_ATTR);
    }
    if (anchor.hasAttribute(STRIPPED_ATTR)) {
      anchor.setAttribute("download", anchor.getAttribute(STRIPPED_ATTR));
      anchor.removeAttribute(STRIPPED_ATTR);
    }
  }

  function applyTo(anchor) {
    if (mode === "view") {
      forceView(anchor);
    } else if (mode === "download") {
      forceDownload(anchor);
    }
  }

  function anchorsIn(node) {
    if (!(node instanceof Element)) return [];
    const found = node.matches("a[href]") ? [node] : [];
    return found.concat(Array.from(node.querySelectorAll("a[href]")));
  }

  function sweep(root = document) {
    if (!root.querySelectorAll) return;
    for (const anchor of root.querySelectorAll("a[href]")) applyTo(anchor);
  }

  function restoreAll() {
    const selector = `a[${ADDED_ATTR}], a[${STRIPPED_ATTR}]`;
    for (const anchor of document.querySelectorAll(selector)) restore(anchor);
  }

  const observer = new MutationObserver((mutations) => {
    if (mode === "off") return;
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          for (const anchor of anchorsIn(node)) applyTo(anchor);
        }
      } else if (mutation.type === "attributes") {
        const target = mutation.target;
        if (target instanceof HTMLAnchorElement) {
          // An href change can invalidate what we did to this anchor earlier.
          if (mutation.attributeName === "href") restore(target);
          applyTo(target);
        }
      }
    }
  });

  function startObserving() {
    const root = document.documentElement;
    if (!root) {
      document.addEventListener("readystatechange", startObserving, { once: true });
      return;
    }
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "download"]
    });
  }

  function setMode(next) {
    const resolved = ["off", "view", "download"].includes(next) ? next : "off";
    if (resolved === mode) return;
    mode = resolved;
    // Undo previous decisions first: switching view -> download must re-evaluate
    // anchors whose original markup we already changed.
    restoreAll();
    if (mode !== "off") sweep();
  }

  chrome.storage.local.get(STORAGE_KEY, (stored) => {
    setMode(stored && stored[STORAGE_KEY]);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    setMode(changes[STORAGE_KEY].newValue);
  });

  // Background can also push the mode explicitly (e.g. after a ruleset change).
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "pdforce:mode") setMode(message.mode);
  });

  startObserving();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (mode !== "off") sweep();
    });
  }
})();
