#!/usr/bin/env node
/**
 * Local test server for PDForce.
 *
 *   node test/server.js          # http://localhost:8787
 *   PORT=9000 node test/server.js
 *
 * Serves a one-page PDF under every combination of Content-Type and
 * Content-Disposition in the test matrix, plus a page of DOM cases.
 */

const http = require("node:http");

const PORT = Number(process.env.PORT || 8787);

const CONTENT_TYPES = {
  pdf: "application/pdf",
  octet: "application/octet-stream",
  html: "text/html",
  none: null
};

const DISPOSITIONS = {
  none: null,
  inline: 'inline; filename="matrix.pdf"',
  attachment: 'attachment; filename="matrix.pdf"'
};

function makePdf(label) {
  const text = `PDForce test: ${label}`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    null, // stream, built below
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  const stream = `BT /F1 14 Tf 30 110 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

const MATRIX = [
  { ct: "pdf", cd: "none", expected: "View" },
  { ct: "pdf", cd: "inline", expected: "View" },
  { ct: "pdf", cd: "attachment", expected: "Download" },
  { ct: "octet", cd: "none", expected: "Download" },
  { ct: "octet", cd: "inline", expected: "Download" },
  { ct: "octet", cd: "attachment", expected: "Download" }
];

const EXTENSIONS = [
  { path: "/file/matrix.pdf", label: ".pdf URL" },
  { path: "/file/matrix", label: "extensionless URL" },
  { path: "/file/matrix.pdf?v=2", label: ".pdf + query string" }
];

function caseUrl(base, ct, cd) {
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}ct=${ct}&cd=${cd}`;
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]
  );
}

function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 60rem; padding: 0 1rem; }
  h1 { font-size: 1.3rem; } h2 { font-size: 1.05rem; margin-top: 2rem; }
  table { border-collapse: collapse; width: 100%; margin-top: .5rem; }
  th, td { border: 1px solid #ddd; padding: .4rem .6rem; text-align: left; }
  th { background: #f6f7f9; }
  code { background: #f2f3f5; padding: 0 .25rem; border-radius: 3px; }
  .note { color: #666; }
</style></head><body>${body}</body></html>`;
}

function indexPage() {
  let body = `<h1>PDForce test matrix</h1>
  <p class="note">Toggle the extension between Off / Force View / Force Download and click through the links.</p>`;

  for (const { path, label } of EXTENSIONS) {
    body += `<h2>${escapeHtml(label)} — <code>${escapeHtml(path)}</code></h2>
    <table><tr><th>Content-Type</th><th>Content-Disposition</th><th>Default</th><th>Link</th></tr>`;
    for (const row of MATRIX) {
      const url = caseUrl(path, row.ct, row.cd);
      body += `<tr><td><code>${escapeHtml(CONTENT_TYPES[row.ct] || "(none)")}</code></td>
        <td><code>${escapeHtml(DISPOSITIONS[row.cd] || "(none)")}</code></td>
        <td>${row.expected}</td>
        <td><a href="${escapeHtml(url)}">open</a></td></tr>`;
    }
    body += "</table>";
  }

  body += `<h2>DOM cases</h2><p><a href="/dom">Anchor attribute tests</a></p>`;
  return layout("PDForce test matrix", body);
}

function domPage() {
  const target = "/file/dom.pdf?ct=pdf&cd=attachment";
  const body = `<h1>DOM cases</h1>
  <p class="note">Same-origin PDF served as <code>application/pdf</code> + <code>attachment</code>.</p>
  <h2>In scope</h2>
  <ul>
    <li><a href="${target}">plain anchor</a> — follows headers</li>
    <li><a href="${target}" download>anchor with <code>download</code></a> — Force View strips it</li>
    <li id="late"></li>
  </ul>
  <h2>Out of scope (expected to keep downloading)</h2>
  <ul>
    <li><button id="js-click">JS-synthesised a.download + click()</button></li>
    <li><button id="blob-save">fetch &rarr; Blob &rarr; save</button></li>
  </ul>
  <script>
    // Anchor added after load, to exercise the MutationObserver.
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = ${JSON.stringify(target)};
      a.textContent = "dynamically added anchor";
      a.setAttribute("download", "");
      document.getElementById("late").append(a, " — added 1s after load");
    }, 1000);

    document.getElementById("js-click").addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = ${JSON.stringify(target)};
      a.download = "synthesised.pdf";
      a.click();
    });

    document.getElementById("blob-save").addEventListener("click", async () => {
      const blob = await (await fetch(${JSON.stringify(target)})).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "blob.pdf";
      a.click();
    });
  </script>`;
  return layout("PDForce DOM cases", body);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(indexPage());
    return;
  }

  if (url.pathname === "/dom") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(domPage());
    return;
  }

  if (url.pathname.startsWith("/file/")) {
    const ct = CONTENT_TYPES[url.searchParams.get("ct") || "pdf"];
    const cd = DISPOSITIONS[url.searchParams.get("cd") || "none"];
    const pdf = makePdf(`${ct || "no content-type"} / ${cd || "no content-disposition"}`);

    const headers = { "content-length": pdf.length, "cache-control": "no-store" };
    if (ct) headers["content-type"] = ct;
    if (cd) headers["content-disposition"] = cd;

    response.writeHead(200, headers);
    response.end(pdf);
    return;
  }

  response.writeHead(404, { "content-type": "text/plain" });
  response.end("not found");
});

server.listen(PORT, () => {
  console.log(`PDForce test server: http://localhost:${PORT}`);
});
