import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeJournal } from "./helpers/email-journal.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const report = JSON.parse(await readFile(new URL("../research/email-journal-2026-10-14.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prior = beforeJournal(data);
const expected = [
  ["puh3-nnnk-1161", "姜玲", "老年内科", "15910776454@163.com", "cma1010952", 2017],
  ["puh3-yk-1618", "周吉超", "眼科", "zhoujichao8888@163.com", "pmc11603821", 2024],
  ["puh3-yk-7292", "封康", "眼科", "ocufeng@hsc.pku.edu.cn", "pmc11487407", 2024],
  ["puh3-yk-1613", "杨帆", "眼科", "yangfan@bjmu.edu.cn", "pmc11487407", 2024],
  ["puh3-yk-7342", "刘嫣", "眼科", "doctorliuyan@bjmu.edu.cn", "pmc11506929", 2024],
  ["puh3-csyxk-3661", "薛恒", "超声医学科", "xueheng1987@bjmu.edu.cn", "pmc8947553", 2022],
  ["puh3-gk-1735", "李杨", "骨科", "liyangdr@bjmu.edu.cn", "pmc13649454", 2026],
  ["puh3-sjnk-16752", "宋红松", "神经内科", "bbhongsong@163.com", "pmc12960157", 2026],
];

test("journal additions preserve the entire 623-contact baseline", () => {
  const hash = createHash("sha256").update(JSON.stringify(prior)).digest("hex");
  assert.equal(hash, "3e46ec39c1d621ac4b11116f25bfc4d097da933044ad945176456445de109f26");
  assert.equal(report.baseline.directorySha256, hash);
  assert.equal(prior.doctors.filter(doctor => doctor.contacts.length).length, 623);
  assert.equal(prior.sources.length, 1539);
  for (const source of prior.sources) {
    assert.deepEqual(data.sources.find(item => item.id === source.id), source);
  }
});

test("eight previously empty doctors receive exactly their verified academic contact", () => {
  for (const [id, name, department, email, article, year] of expected) {
    const doctor = data.doctors.find(item => item.id === id);
    const entry = report.entries.find(item => item.doctorId === id);
    const sourceId = `email-journal-${article}`;
    assert.deepEqual([doctor.name, doctor.department, doctor.hospitalId], [name, department, "puh3"]);
    assert.deepEqual(prior.doctors.find(item => item.id === id).contacts, []);
    assert.equal(doctor.contacts.length, 1);
    assert.deepEqual([doctor.contacts[0].type, doctor.contacts[0].purpose, doctor.contacts[0].value,
      doctor.contacts[0].sourceId], ["email", "academic", email, sourceId]);
    assert.match(doctor.contacts[0].identityNote, /未测试收信.*不保证当前有效.*患者咨询/);
    assert.ok(doctor.evidence.some(item => item.sourceId === sourceId && item.fields.join() === "contacts"));
    assert.deepEqual([entry.state, entry.email, entry.sourceId], ["accepted", email, sourceId]);
    assert.match(entry.evidenceSha256, /^[a-f0-9]{64}$/);
    const source = data.sources.find(item => item.id === sourceId);
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-14");
    assert.equal(source.sourceUpdatedAt, null);
    assert.equal(source.url, entry.sourceUrl);
  }
  assert.equal(report.entries.filter(entry => entry.state === "accepted").length, 8);
});

test("shared papers do not duplicate sources or mix authors' addresses", () => {
  assert.equal(data.sources.filter(source => source.id.startsWith("email-journal-")).length, 7);
  const note = id => data.doctors.find(doctor => doctor.id === id).contacts[0].identityNote;
  assert.match(note("puh3-yk-7292"), /\(K\.F\.\).*Kang Feng/);
  assert.match(note("puh3-yk-1613"), /\(F\.Y\.\).*Fan Yang/);
  assert.match(note("puh3-yk-7342"), /\(Y\.L\.\).*Yan Liu/);
  assert.match(note("puh3-csyxk-3661"), /\(H\.X\.\).*Heng Xue/);
  assert.match(note("puh3-nnnk-1161"), /姜玲.*mailto.*不转用/);
  assert.match(note("puh3-gk-1735"), /Yang Li.*Yongzheng Han.*明确姓名配对/);
  assert.match(note("puh3-sjnk-16752"), /Hongsong Song.*Dongsheng Fan/);
  for (const entry of report.entries.filter(item => item.state === "accepted")) {
    assert.equal(data.sources.filter(source => source.url === entry.sourceUrl).length, 1);
    assert.deepEqual(data.doctors.filter(doctor => doctor.contacts.some(contact =>
      contact.value.toLowerCase() === entry.email.toLowerCase())).map(doctor => doctor.id), [entry.doctorId]);
  }
});

test("ambiguous authors, malformed domains and conference registration contacts remain unresolved", () => {
  for (const id of ["puh3-xxgnk-3051", "puh3-ptwk-1661", "puh3-ebhk-1251", "puh3-blk-1541",
    "puh3-blk-1591", "puh3-zxwk-1981", "puh3-csyxk-2361", "puh3-blk-1951", "puh3-xynk-1481"]) {
    assert.deepEqual(data.doctors.find(doctor => doctor.id === id).contacts, []);
    assert.equal(report.entries.find(entry => entry.doctorId === id).state, "unresolved");
  }
  assert.ok(report.additionalChecks.some(check => check.url === "https://meeting.dxy.cn/article/551914" &&
    check.outcome === "read-no-target-author-contact"));
  assert.ok(report.additionalChecks.some(check => check.outcome === "transport-failed"));
});

test("research scope separates name screening, bounded searches and actual original retrieval", () => {
  assert.equal(report.scope.missingNamesScreened, 348);
  assert.equal(report.scope.retainedNamedNoteScan.uniqueXmlDocumentsParsed, 643);
  assert.equal(report.scope.newOriginalCrossmatch.xmlDocumentsParsed, 93);
  assert.equal(report.scope.newOfficialProfilesRead, 10);
  assert.equal(report.scope.exhaustive, false);
  assert.equal(report.queries.length, 36);
  assert.equal(new Set(report.queries.map(query => query.doctorId)).size, 36);
  assert.equal(report.queries.reduce((sum, query) => sum + query.returnedRecords, 0), 510);
  assert.equal(report.queries.reduce((sum, query) => sum + query.papers.length, 0), 507);
  assert.equal(report.scope.xmlDeferredByBudget, 127);
  assert.equal(report.queries.flatMap(query => query.checks).filter(check => check.outcome === "access-failed").length, 14);
});

test("journal result stays historical while current directory contains 648 emails and 323 missing without changing roster coverage", () => {
  assert.deepEqual(report.result, {
    addedEmailDoctors: 8, addedUniqueEmails: 8, addedSources: 7,
    emailDoctors: 631, uniqueEmails: 631, remainingMissing: 340, sources: 1546,
  });
  const emails = data.doctors.flatMap(doctor => doctor.contacts.filter(contact => contact.type === "email"));
  assert.equal(emails.length, 648);
  assert.equal(new Set(emails.map(contact => contact.value.toLowerCase())).size, 648);
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});
