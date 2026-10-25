import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeReassessment } from "./helpers/email-reassessment.mjs";
import { beforeReflection } from "./helpers/email-reflect.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const review = JSON.parse(await readFile(new URL("../research/email-reassessment-2026-10-14.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prior = beforeReassessment(data);
const prefix = "email-reassess-";
const expected = [
  ["puh3-sjnk-1481", "张英爽", "神经内科", "zhangys0317@126.com", "pmc7894467", 2021],
  ["puh3-sjnk-16682", "李坚", "神经内科", "LIJ698524@163.com", "pdf35156691", 2022],
  ["puh3-zyk-1461", "史成和", "中医科", "shichenghe@bjmu.edu.cn", "pmid40355026", 2025],
  ["puh3-nnnk-1141", "宮萍", "老年内科", "medical201611@gmail.com", "pmid27106584", 2016],
  ["puh3-ek-1431", "王雪梅", "儿科", "xuemeiw7886@sohu.com", "pmid21342626", 2011],
];

test("reassessment preserves the entire 589-email baseline, including all original evidence", () => {
  const hash = createHash("sha256").update(JSON.stringify(prior)).digest("hex");
  assert.equal(hash, "8899ab193196674368b59f2fd7e03b3d0785635a10b92c7d04c75873651a7846");
  assert.equal(review.baseline.directorySha256, hash);
  assert.equal(prior.sources.length, 1510);
  assert.equal(prior.doctors.filter(doctor => doctor.contacts.length).length, 589);
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.filter(source => source.id.startsWith(prefix)).length, 6);
});

test("five previously empty doctors receive only their exact documented academic contacts", () => {
  for (const [id, name, department, value, suffix, year] of expected) {
    const doctor = data.doctors.find(item => item.id === id);
    assert.deepEqual([doctor.name, doctor.department, doctor.hospitalId], [name, department, "puh3"]);
    assert.deepEqual(prior.doctors.find(item => item.id === id).contacts, []);
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.deepEqual([contact.type, contact.purpose, contact.value, contact.sourceId],
      ["email", "academic", value, prefix + suffix]);
    assert.match(contact.identityNote, /未测试收信.*不保证当前有效.*患者咨询/);
    assert.deepEqual(data.doctors.filter(item => item.contacts.some(c =>
      c.value.toLowerCase() === value.toLowerCase())).map(item => item.id), [id]);
    assert.ok(doctor.evidence.some(item => item.sourceId === contact.sourceId && item.fields.join() === "contacts"));
    const source = data.sources.find(item => item.id === contact.sourceId);
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-14");
    assert.equal(source.sourceUpdatedAt, null);
    const entry = review.entries.find(item => item.doctorId === id);
    assert.equal(entry.state, "accepted");
    assert.deepEqual([entry.email, entry.sourceId], [value, contact.sourceId]);
  }
});

test("shared research contacts retain limitations rather than asserting exclusive ownership", () => {
  const zhang = data.doctors.find(doctor => doctor.id === "puh3-sjnk-1481").contacts[0];
  assert.match(zhang.identityNote, /NCT04956822.*Xiaoxuan Liu.*共享或代管.*不声明本人独占/);
  const wang = data.doctors.find(doctor => doctor.id === "puh3-ek-1431");
  assert.match(wang.contacts[0].identityNote, /多作者.*未逐一标注个人所有权.*可能为团队使用.*不声明个人专属/);
  assert.ok(wang.evidence.some(item => item.sourceId === prefix + "pdf21342626"));
  assert.equal(data.sources.find(source => source.id === prefix + "pdf21342626").publishedYear, 2011);
});

test("original-PDF and official-publication bridges replace misleading affiliation and name filters", () => {
  const note = id => data.doctors.find(doctor => doctor.id === id).contacts[0].identityNote;
  assert.match(note("puh3-sjnk-16682"), /PDF第318页.*Jian Li.*神经内科.*大写LIJ/);
  assert.match(note("puh3-nnnk-1141"), /Gong Ping.*第3单位.*论文第4项.*通讯作者/);
  assert.match(note("puh3-zyk-1461"), /Chenghe Shi.*Jianxin Chen.*SHI Cheng-he.*未重复中医科/);
  assert.equal(data.sources.find(source => source.id === prefix + "pdf35156691").url,
    "https://journals.viamedica.pl/neurologia_neurochirurgia_polska/article/download/PJNNS.a2022.0016/65725");
});

test("explicitly wrong and still-ambiguous candidates are not released by relaxed rules", () => {
  const rejected = review.entries.find(entry => entry.doctorId === "puh3-ek-1471");
  assert.equal(rejected.state, "rejected-specific-candidate");
  assert.equal(rejected.confirmedContactName, "王新利");
  assert.ok(rejected.checks.some(check => check.kind === "original-pdf" &&
    check.outcome === "explicit-correspondent-Wang-Xin-Li"));
  for (const entry of review.entries.filter(item => item.state !== "accepted")) {
    assert.deepEqual(beforeReflection(data).doctors.find(doctor => doctor.id === entry.doctorId).contacts, []);
  }
  assert.ok(!data.doctors.some(doctor => doctor.contacts.some(contact => contact.value === "obesity530@126.com")));
});

test("the persistent review distinguishes screening from follow-up and reports actual coverage", () => {
  assert.equal(review.entries.length, 12);
  assert.equal(new Set(review.entries.map(entry => entry.doctorId)).size, 12);
  assert.equal(review.scope.retainedCandidateSummariesScreened, 46);
  assert.equal(review.scope.exhaustive, false);
  assert.equal(review.entries.filter(entry => entry.checks.length).length, review.scope.followedUpDoctors);
  assert.equal(review.entries.filter(entry => entry.state === "history-only").length,
    review.scope.additionalHistoryOnlyDoctors);
  for (const entry of review.entries) {
    assert.ok(entry.decision);
    for (const check of entry.checks) {
      assert.equal(new URL(check.url).protocol, "https:");
      assert.ok(check.outcome);
    }
  }
  const emails = data.doctors.flatMap(doctor => doctor.contacts.filter(contact => contact.type === "email"));
  assert.equal(emails.length, 648);
  assert.equal(new Set(emails.map(contact => contact.value.toLowerCase())).size, 648);
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.deepEqual(review.result, {
    addedEmailDoctors: 5, addedUniqueEmails: 5, addedSources: 6,
    emailDoctors: 594, uniqueEmails: 594, remainingMissing: 377, sources: 1516,
  });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});
