import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
  ["/directory.mjs", ["directory.mjs", "text/javascript; charset=utf-8"]],
  ["/coverage.mjs", ["coverage.mjs", "text/javascript; charset=utf-8"]],
  ["/data/beijing.json", ["data\\beijing.json", "application/json; charset=utf-8"]],
  ["/data/coverage.json", ["data\\coverage.json", "application/json; charset=utf-8"]],
]);

export function createAppServer() {
  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end("Method not allowed");
      return;
    }
    const path = request.url.split("?")[0];
    const file = files.get(path);
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    try {
      const body = await readFile(resolve(publicRoot, ...file[0].split("\\")));
      response.writeHead(200, { "Content-Type": file[1] });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      console.error(`Failed to serve ${path}:`, error);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Failed to read application file");
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("PORT must be an integer from 1 to 65535.");
    process.exitCode = 1;
  } else {
    const server = createAppServer();
    server.on("error", error => {
      console.error("Local server failed:", error);
      process.exitCode = 1;
    });
    server.listen(port, "127.0.0.1", () => {
      console.log(`DocsGlobe: http://127.0.0.1:${port}`);
    });
  }
}
