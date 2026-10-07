// Serve a built site like Cloudflare Pages: static files, `index.html` for
// unknown paths (no 404.html), headers from `_headers` ignored.
//
//   tsx scripts/serve.ts [dir] [port]

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".yaml": "text/yaml; charset=utf-8",
};

const dir = resolve(process.argv[2] ?? "build/client");
const port = Number(process.argv[3] ?? process.env.PORT ?? 4173);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = join(dir, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ""));
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
  if (!existsSync(path)) path = join(dir, "index.html");
  res.writeHead(200, {
    "content-type": types[extname(path)] ?? "text/plain; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  createReadStream(path).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port} (${dir})`));
