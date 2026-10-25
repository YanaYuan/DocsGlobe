import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAppServer } from "../scripts/server.mjs";

test("local server serves the app and only public application files", async t => {
  const server = createAppServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/", "/index.html", "/styles.css", "/app.mjs", "/directory.mjs", "/coverage.mjs",
    "/data/beijing.json", "/data/coverage.json"]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
    assert.ok((await response.text()).length > 0, path);
  }
  const json = await fetch(`${base}/data/beijing.json`);
  assert.match(json.headers.get("content-type"), /application\/json/);
  assert.equal((await json.json()).doctors.length, 971);
  const coverage = await fetch(`${base}/data/coverage.json`);
  assert.match(coverage.headers.get("content-type"), /application\/json/);
  const progress = await coverage.json();
  assert.equal(progress.baseline.records.length, 45);
  assert.equal(progress.citywideHospitalTotal, null);
  for (const path of ["/package.json", "/.env", "/%2e%2e%2fpackage.json", "/unknown"]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
    await response.text();
  }
  const post = await fetch(base, { method: "POST" });
  assert.equal(post.status, 405);
  await post.text();
  const head = await fetch(base, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});
