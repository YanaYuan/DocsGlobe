import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeReassessment } from "./helpers/email-reassessment.mjs";

const data = beforeReassessment(JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8")));
const ledger = JSON.parse(await readFile(new URL("../research/email-audit-2026-10-14.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prefix = "email-audit-";
const prior = {
  ...data,
  sources: data.sources.filter(source => !source.id.startsWith(prefix)),
  doctors: data.doctors.map(doctor => ({
    ...doctor,
    contacts: doctor.contacts.filter(contact => !contact.sourceId.startsWith(prefix)),
    evidence: doctor.evidence.filter(item => !item.sourceId.startsWith(prefix)),
  })),
};
const expected = [
  ["puh3-sjwk-2971", "刘彬", "神经外科", "liubin301@163.com", "email-audit-nct04465305"],
  ["puh3-jrxgk-1331", "董国祥", "介入血管外科", "dong_guoxiang@126.com", "email-audit-pmid17380667"],
  ["puh3-szyxzx-1172", "杨艳", "生殖医学科", "sofoa@sina.com", "email-audit-pmc3035581"],
];

test("the audit preserves the complete 586-person baseline and every original profile and source", () => {
  const digest = createHash("sha256").update(JSON.stringify(prior)).digest("hex");
  assert.equal(digest, "bc0c4fc1e766e13fb0f38ff68ef62422431ead9704234ad7f55fc26cc5d372bd");
  assert.equal(ledger.baseline.directorySha256, digest);
  assert.equal(prior.sources.length, 1506);
  assert.equal(prior.doctors.filter(doctor => doctor.contacts.some(contact => contact.type === "email")).length, 586);
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1510);
  assert.equal(data.sources.filter(source => source.id.startsWith(prefix)).length, 4);
});

test("the ledger covers all 385 baseline gaps exactly once without inventing search history", () => {
  const gaps = prior.doctors.filter(doctor => !doctor.contacts.some(contact => contact.type === "email"));
  assert.equal(ledger.entries.length, 385);
  assert.deepEqual(ledger.entries.map(entry => entry.doctorId).sort(), gaps.map(doctor => doctor.id).sort());
  assert.equal(new Set(ledger.entries.map(entry => entry.doctorId)).size, 385);
  assert.deepEqual(["candidate-needs-review", "retained-search-needs-review", "history-not-recovered"]
    .map(state => ledger.entries.filter(entry => entry.initialStatus === state).length), [49, 214, 122]);
  for (const entry of ledger.entries) {
    const doctor = prior.doctors.find(item => item.id === entry.doctorId);
    assert.deepEqual([entry.name, entry.hospitalId, entry.department], [doctor.name, doctor.hospitalId, doctor.department]);
    assert.equal(entry.profileUrl, prior.sources.find(source => source.id === doctor.profileSourceId).url);
    assert.ok(entry.nextAction);
    if (entry.initialStatus === "history-not-recovered") assert.equal(entry.historicalReferences.length, 0);
  }
  assert.match(ledger.scopeNote, /does not mean never searched/);
});

test("three disjoint twenty-person groups have completed bounded checks and reproducible metrics", () => {
  const selected = Object.values(ledger.groups).flat();
  assert.equal(selected.length, 60);
  assert.equal(new Set(selected).size, 60);
  for (const [group, ids] of Object.entries(ledger.groups)) {
    assert.equal(ids.length, 20);
    const entries = ledger.entries.filter(entry => entry.group === group);
    assert.deepEqual(entries.map(entry => entry.doctorId).sort(), [...ids].sort());
    for (const entry of entries) {
      assert.notEqual(entry.state, "queued");
      assert.ok(entry.decision);
      assert.equal(entry.reviewedAt, "2026-10-14");
      assert.equal(entry.scope.exhaustive, false);
      const checks = entry.checks.length ? entry.checks :
        entry.sharedCheckIndexes.map(index => ledger.sharedChecks[index]);
      assert.ok(checks.length > 0);
      for (const check of checks) {
        assert.ok(check && check.kind && check.outcome);
        assert.equal(new URL(check.url).protocol, "https:");
      }
    }
    const checks = group === "institution" ? ledger.sharedChecks : entries.flatMap(entry => entry.checks);
    const metrics = ledger.metrics[group];
    assert.equal(metrics.reviewedDoctors, 20);
    assert.equal(metrics.acceptedDoctors, entries.filter(entry => entry.state === "accepted").length);
    assert.equal(metrics.checkCount, checks.length);
    assert.equal(metrics.timedCheckCount, checks.filter(check => "elapsedSeconds" in check).length);
    assert.equal(metrics.timedRequestSeconds,
      Math.round(checks.reduce((sum, check) => sum + (check.elapsedSeconds || 0), 0) * 1000) / 1000);
    assert.equal(metrics.failedChecks, checks.filter(check => ["access-failed", "parse-failed"].includes(check.outcome)).length);
  }
  assert.equal(ledger.entries.filter(entry => entry.state === "not-in-trial").length, 325);
  assert.deepEqual(Object.values(ledger.metrics).map(group => group.acceptedDoctors), [3, 0, 0]);
  assert.ok(ledger.trialLimitations.some(note => note.includes("exclude manual review")));
});

test("three newly linked contacts have exact ownership, historical dates and identity bridges", () => {
  for (const [id, name, department, email, sourceId] of expected) {
    const doctor = data.doctors.find(item => item.id === id);
    assert.deepEqual([doctor.name, doctor.department, doctor.hospitalId], [name, department, "puh3"]);
    assert.deepEqual(prior.doctors.find(item => item.id === id).contacts, []);
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.deepEqual([contact.type, contact.purpose, contact.value, contact.sourceId],
      ["email", "academic", email, sourceId]);
    assert.match(contact.identityNote, /未测试收信.*不保证当前有效.*患者咨询/);
    assert.ok(doctor.evidence.some(item => item.sourceId === sourceId && item.fields.join() === "contacts"));
    assert.deepEqual(data.doctors.filter(item => item.contacts.some(c =>
      c.value.toLowerCase() === email.toLowerCase())).map(item => item.id), [id]);
    const entry = ledger.entries.find(item => item.doctorId === id);
    assert.equal(entry.state, "accepted");
    assert.equal(entry.group, "attribution");
    assert.deepEqual(entry.acceptedContact, { email, sourceId });
    const source = data.sources.find(item => item.id === sourceId);
    assert.equal(source.accessedAt, "2026-10-14");
  }
  const dong = data.doctors.find(doctor => doctor.id === "puh3-jrxgk-1331");
  assert.match(dong.title, /退休/);
  assert.ok(dong.evidence.some(item => item.sourceId === "email-audit-vascular-history" && item.fields.join() === "contacts"));
  assert.match(dong.contacts[0].identityNote, /2006.*合并/);
  assert.equal(data.sources.find(source => source.id === "email-audit-pmid17380667").publishedYear, 2007);
  assert.equal(data.sources.find(source => source.id === "email-audit-pmid17380667").publisher,
    "Acta Academiae Medicinae Sinicae / Europe PMC");
  assert.equal(data.sources.find(source => source.id === "email-audit-pmc3035581").publishedYear, 2011);
  assert.equal(data.sources.find(source => source.id === "email-audit-nct04465305").sourceUpdatedAt, "2021-07-08");
  assert.match(data.doctors.find(doctor => doctor.id === "puh3-szyxzx-1172").contacts[0].identityNote, /Contributor Information.*第10项/);
  assert.match(data.doctors.find(doctor => doctor.id === "puh3-sjwk-2971").contacts[0].identityNote, /NCT04958525.*逐项对应/);
});

test("candidates unresolved at the audit baseline remain empty in its historical snapshot", () => {
  const unresolved = ledger.entries.filter(entry => entry.state !== "accepted");
  assert.ok(unresolved.every(entry => data.doctors.find(doctor => doctor.id === entry.doctorId).contacts.length === 0));
  const values = data.doctors.flatMap(doctor => doctor.contacts.filter(c => c.type === "email").map(c => c.value.toLowerCase()));
  assert.equal(values.length, 589);
  assert.equal(new Set(values).size, 589);
  assert.deepEqual(planStats(coverage, data).email, { current: 589, total: 971, remaining: 382, percent: 61 });
  assert.deepEqual(ledger.result, {
    reviewedDoctors: 60, notInTrial: 325, addedEmails: 3, emailDoctors: 589, remainingMissing: 382, sources: 1510,
  });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});
