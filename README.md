# PDForce

PDForce is a lightweight Manifest V3 Chrome extension that overrides how websites serve PDFs. Sites can force PDFs to download (via Content-Disposition: attachment or the <a download> attribute) — PDForce lets you decide instead. Toggle between three states: Off (default site behavior), Force View (open in Chrome's PDF viewer), and Force Download. Works by rewriting response headers and PDF anchor attributes. Licensed under AGPLv3.
