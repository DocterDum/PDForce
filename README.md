# PDForce

PDForce is a lightweight Manifest V3 Chrome extension that overrides how websites serve PDFs. Sites can force PDFs to download (via `Content-Disposition: attachment` or the `<a download>` attribute) — PDForce lets you decide instead.

Three states, chosen from the toolbar popup:

| Mode | Behaviour |
| --- | --- |
| **Off** | No interference; the site behaves as intended. |
| **Force View** | PDFs open in Chrome's built-in viewer. |
| **Force Download** | PDFs are saved to disk. |

The choice is stored in `chrome.storage.local` and persists across restarts. The toolbar icon reflects the current state (grey bar / blue eye / green arrow).

## Install (unpacked)

1. Clone this repository.
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the repository folder.

Requires Chrome 128 or newer: the header rules match on response headers, which is a Chrome 128+ `declarativeNetRequest` feature.

## How it works

Two independent mechanisms cover the two ways a site controls PDF handling.

### 1. Response-header rewriting (`declarativeNetRequest`)

Static rulesets in `rules/` are enabled and disabled by the background service worker as the mode changes (`rules/force_view.json`, `rules/force_download.json`). They only match **main-frame document requests**, so the viewer's own sub-resource and range requests are left alone.

**Force View**

- `Content-Type: application/pdf` (or `application/x-pdf`) → set `Content-Disposition: inline`, unless it is already inline.
- Generic `Content-Type` (`application/octet-stream`, `binary/octet-stream`, `application/force-download`, `application/x-download`, `application/download`, `application/unknown`) on a URL matching `\.pdf($|\?|#)` → set `Content-Type: application/pdf` and `Content-Disposition: inline`.
- `Content-Disposition: attachment; filename="….pdf"` with a non-PDF, non-text, non-media `Content-Type` → set `Content-Type: application/pdf` and `Content-Disposition: inline`. This catches extensionless URLs where the filename is the only PDF signal.

**Force Download**

- `Content-Type: application/pdf` (or `application/x-pdf`) → set `Content-Disposition: attachment`, unless it is already an attachment.
- Generic `Content-Type` on a `.pdf` URL → set `Content-Disposition: attachment`.

### 2. DOM rewriting (content script)

`src/content.js` runs at `document_start` in all frames and watches the document with a `MutationObserver` (added nodes plus `href`/`download` attribute changes), so anchors added after load are handled too.

- **Force View** — strips `download` from anchors whose `href` looks like a PDF.
- **Force Download** — adds `download` to anchors whose `href` looks like a PDF.
- **Off** — restores every attribute PDForce changed.

The original markup is remembered in `data-pdforce-stripped-download` / `data-pdforce-added-download`, so switching modes (or back to Off) restores the page to its original state without a reload.

Anchor detection is a heuristic on the URL: a `.pdf` path, a `.pdf/` path segment, a query parameter whose value ends in `.pdf`, or a query hint such as `format=pdf` / `type=pdf` / `output=pdf` / `export=pdf`.

### State wiring

The popup writes the mode to `chrome.storage.local`. The service worker listens for the change and enables the matching ruleset (or none, for Off); content scripts listen for the same change and re-apply or undo their DOM edits. Using storage events rather than tab messaging means content scripts in background tabs, and any that load later, stay in sync without extra plumbing. The service worker also accepts an explicit `pdforce:mode` message for anything that needs to push the mode directly.

## Scope and limitations

**Handled**

- Navigations of every kind — plain anchor clicks, `window.open`, `location` assignment, form submits, redirects, static and extensionless URLs — through the header rules.
- Anchors carrying a `download` attribute, present at load or added later, through the content script.

**Not handled** — these are entirely client-side, so no header or anchor rewrite can reach them:

- A script building an anchor, setting `a.download` as a property, and calling `.click()`.
- `fetch`/`XHR` → `Blob` → save.
- `blob:` and `data:` URL saves.
- PDFs behind shadow DOM anchors, and PDF URLs the heuristics do not recognise.

**Other caveats**

- Chrome only honours `download` for same-origin URLs (plus `blob:` and `data:`). A cross-origin `<a download>` navigates instead of downloading — that is Chrome's rule, not PDForce's.
- Rewriting `Content-Disposition` replaces the whole header, so a `filename` parameter on the original header is lost and Chrome derives the filename from the URL instead. Responses that are already in the desired disposition are excluded from the rules, so the common cases keep their filename.
- A URL's `.pdf` suffix is unreliable (extensionless URLs, query strings, content-negotiated endpoints), which is why the header path prefers matching on `Content-Type` and only falls back to the URL when the type is generic.
- Header rules apply per request: changing the mode affects the next PDF you open, not one already on screen. DOM changes apply immediately.

## Behaviour

### Headers (navigation)

| Content-Type | Content-Disposition | Default | Force View | Force Download |
| --- | --- | --- | --- | --- |
| `application/pdf` | none / `inline` | View | no-op | → `attachment` |
| `application/pdf` | `attachment` | Download | → `inline` | no-op |
| `application/octet-stream` | none / `inline` | Download | → `application/pdf` + `inline` | no-op |
| `application/octet-stream` | `attachment` | Download | → `application/pdf` + `inline` | no-op |

### Anchors

| Markup | Default | Force View | Force Download |
| --- | --- | --- | --- |
| `<a href="x.pdf">` | per headers | per headers | add `download` |
| `<a href="x.pdf" download>` | Download | strip `download` | no-op |

Out of scope, and expected to keep downloading in every mode: JS-synthesised `a.download` + `click()`, `fetch` → `Blob` save, `blob:`/`data:` saves.

## Layout

```
manifest.json          MV3 manifest
src/background.js      service worker: mode → ruleset + icon
src/content.js         DOM rewrite + MutationObserver
src/popup/             three-state popup UI
rules/                 static declarativeNetRequest rulesets
icons/                 toolbar icons per state
tools/make_icons.py    regenerates icons/ (needs Pillow)
```

## License

Copyright (C) 2026 DocterDum

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [GNU Affero General Public License](LICENSE) for more details.
