import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeReflection } from "./helpers/email-reflect.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const report = JSON.parse(await readFile(new URL("../research/email-reflect-2026-10-15.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prior = beforeReflection(data);
const expected = [
  ["puh3-yk-1583", "张惠蓉", "眼科", "eagleye909@163.com", 2013],
  ["puh3-yk-7382", "朱德海", "眼科", "zhudehai2336@163.com", 2025],
  ["puh3-csyxk-2401", "付帅", "超声医学科", "ouhe1919@sina.com", 2014],
  ["puh3-pfk-3402", "路雪艳", "皮肤科", "lusialu@sina.com", 2013],
];
const contact = id => data.doctors.find(d => d.id === id).contacts[0];

test("reflection additions preserve the entire 631-contact baseline, not just its count", () => {
  const hash = createHash("sha256").update(JSON.stringify(prior)).digest("hex");
  assert.equal(hash, "73d10a7774ff8b4c4fc0c220dc3973636c15a30773066910c22418d439640bb3");
  assert.equal(report.baseline.directorySha256, hash);
  assert.equal(prior.sources.length, 1546);
  assert.equal(prior.doctors.filter(d => d.contacts.length).length, 631);
  for (const source of prior.sources) {
    assert.deepEqual(data.sources.find(s => s.id === source.id), source);
  }
});

test("four previously empty doctors get one exact contact, explicit provenance and academic caveats", () => {
  assert.equal(report.entries.length, 4);
  for (const [id, name, department, email, year] of expected) {
    const doctor = data.doctors.find(d => d.id === id);
    const entry = report.entries.find(e => e.doctorId === id);
    assert.deepEqual([doctor.name, doctor.department, doctor.hospitalId], [name, department, "puh3"]);
    assert.deepEqual(prior.doctors.find(d => d.id === id).contacts, []);
    assert.equal(doctor.contacts.length, 1);
    assert.deepEqual([contact(id).value, contact(id).type, contact(id).purpose], [email, "email", "academic"]);
    assert.match(contact(id).identityNote, /未测试收信.*不保证当前有效.*患者咨询/);
    assert.equal(entry.email, email);
    assert.equal(entry.state, "accepted");
    assert.match(entry.evidenceSha256, /^[a-f0-9]{64}$/);
    const source = data.sources.find(s => s.id === contact(id).sourceId);
    assert.equal(source.id, entry.sourceId);
    assert.equal(source.url, entry.sourceUrl);
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-15");
    assert.equal(source.sourceUpdatedAt, null);
    assert.equal(data.sources.filter(s => s.url === source.url).length, 1);
    assert.ok(doctor.evidence.some(e => e.sourceId === source.id && e.fields.join() === "contacts"));
  }
});

test("historical dates, clinic suspension and former affiliations are not rewritten as current facts", () => {
  assert.match(contact("puh3-yk-1583").identityNote, /长期停诊/);
  assert.match(contact("puh3-yk-1583").identityNote, /在线发表2013-01-10.*卷期为2012/);
  assert.match(contact("puh3-yk-7382").identityNote, /第一医院.*2025年12月调入三院/);
  assert.equal(contact("puh3-yk-7382").value, "zhudehai2336@163.com");
  assert.ok(!data.doctors.flatMap(d => d.contacts).some(c => c.value === "13651103036@163.com"));
  const fu = report.entries.find(e => e.doctorId === "puh3-csyxk-2401");
  assert.match(contact(fu.doctorId).identityNote, /五名作者各有不同邮箱/);
  assert.match(contact(fu.doctorId).identityNote, /原始作者元数据，非论文全文/);
  assert.equal(fu.supportingEvidence.length, 2);
  assert.ok(fu.supportingEvidence.every(e => new URL(e.sourceUrl).hostname === "yz.chsi.com.cn"));
  assert.ok(fu.supportingEvidence.every(e => /^[a-f0-9]{64}$/.test(e.evidenceSha256)));
});

test("named society contact retains its real HTTP source and event/team-use limitations", () => {
  const c = contact("puh3-pfk-3402");
  const source = data.sources.find(s => s.id === c.sourceId);
  assert.equal(source.kind, "society-notice");
  assert.equal(source.allowInsecureHttp, true);
  assert.equal(source.url, "http://221.226.128.173:8080/CN/column/item208.shtml");
  assert.match(c.identityNote, /可能用于活动或团队联系.*不声称本人专用或活动仍开放/);
  assert.match(c.identityNote, /网页具体发布日期未标注/);
  assert.match(c.identityNote, /ChiCTR.*阻断未作已验证/);
  assert.ok(!report.entries.some(e => e.sourceUrl.includes("chictr.org.cn")));
  assert.deepEqual(data.doctors.find(d => d.id === "puh3-xxgnk-3051").contacts, []);
  assert.equal(data.doctors.find(d => d.id === "puh3-nnnk-1161").contacts[0].value, "15910776454@163.com");
});

test("three actual rounds retain zero-yield work and reject repeated or shared author metadata", () => {
  assert.equal(report.roles.length, 2);
  assert.deepEqual(report.rounds.map(r => r.round), [1, 2, 3]);
  assert.deepEqual(report.roundYields, { "1": 1, "2": 3, "3": 0 });
  assert.deepEqual(report.pathfinderRounds.map(r => r.round), [1, 2, 3]);
  assert.equal(report.pathfinderRounds[0].stats.uniqueOriginalPapersAttempted, 26);
  assert.equal(report.pathfinderRounds[1].stats.uniquePublicationPagesAttempted, 11);
  const third = report.pathfinderRounds[2];
  assert.equal(third.statistics.pubmedMetadataSuccesses, 20);
  assert.equal(third.statistics.publisherSubstantivePagesRecovered, 0);
  assert.equal(third.statistics.newCandidateDoctorsThisRound, 0);
  assert.equal(third.statistics.priorCandidateInstitutionGapResolved, 1);
  assert.equal(third.selectedDoctors.reduce((sum, d) => sum + d.papers, 0), 20);
  assert.match(third.outcomes.find(d => d.name === "辛颖").result, /两邮箱复制进六位作者节点/);
  for (const d of third.selectedDoctors) {
    assert.deepEqual(data.doctors.find(item => item.id === d.doctorId).contacts, []);
  }
  assert.ok(report.rounds[0].checks.some(c => c.httpStatus === 405));
  assert.ok(report.rounds[0].checks.some(c => c.httpStatus === 401));
});

test("reflection result stays historical while current totals and roster coverage remain valid", () => {
  assert.deepEqual(report.result, {
    addedEmailDoctors: 4, addedUniqueEmails: 4, addedSources: 4,
    emailDoctors: 635, uniqueEmails: 635, remainingMissing: 336, sources: 1550,
  });
  const emails = data.doctors.flatMap(d => d.contacts);
  assert.equal(emails.length, 648);
  assert.equal(new Set(emails.map(c => c.value.toLowerCase())).size, 648);
  assert.equal(data.sources.length, 1563);
  assert.equal(data.doctors.filter(d => !d.contacts.length).length, 323);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});
