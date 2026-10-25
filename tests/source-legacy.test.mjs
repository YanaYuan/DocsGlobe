import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isSafeUrl, validateDirectory, CONTACT_SOURCE_LABELS } from "../public/directory.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const now = new Date("2026-10-15T23:59:59Z");

test("HTTP source links require explicit opt-in without relaxing default website policy", () => {
  assert.equal(isSafeUrl("http://example.org/notice"), false);
  assert.equal(isSafeUrl("http://example.org/notice", true), true);
  assert.equal(isSafeUrl("https://example.org/notice"), true);
  for (const value of ["javascript:alert(1)", "data:text/html,test", "file:///test",
    "http://user:password@example.org/", "https://user:password@example.org/", "", null]) {
    assert.equal(isSafeUrl(value, true), false);
  }
  const draft = structuredClone(data);
  draft.sources[0].url = "http://example.org/notice";
  assert.ok(validateDirectory(draft, now).some(error => error.includes("HTTPS")));
  draft.sources[0].allowInsecureHttp = true;
  assert.deepEqual(validateDirectory(draft, now), []);
  draft.hospitals[0].website = "http://example.org/";
  assert.ok(validateDirectory(draft, now).some(error => error.includes("官网")));
});

test("legacy opt-in cannot silently apply to HTTPS, executable URLs or non-boolean values", () => {
  for (const [url, flag] of [
    ["https://example.org/notice", true],
    ["javascript:alert(1)", true],
    ["http://user:password@example.org/notice", true],
    ["http://example.org/notice", "true"],
    ["http://example.org/notice", false],
  ]) {
    const draft = structuredClone(data);
    Object.assign(draft.sources[0], { url, allowInsecureHttp: flag });
    assert.notDeepEqual(validateDirectory(draft, now), []);
  }
});

test("society notices have a distinct label and require a historical year", () => {
  assert.equal(CONTACT_SOURCE_LABELS["society-notice"], "学会 / 学术会议联系信息");
  const draft = structuredClone(data);
  Object.assign(draft.sources[0], { kind: "society-notice", publishedYear: 2013 });
  assert.deepEqual(validateDirectory(draft, now), []);
  delete draft.sources[0].publishedYear;
  assert.ok(validateDirectory(draft, now).some(error => error.includes("发表年份")));
});
