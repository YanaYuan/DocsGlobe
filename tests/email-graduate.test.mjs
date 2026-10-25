import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeGraduate } from "./helpers/email-graduate.mjs";
import { beforeJournal } from "./helpers/email-journal.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const report = JSON.parse(await readFile(new URL("../research/email-graduate-2026-10-14.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prior = beforeGraduate(data);
const expected = [
  ["puh3-xhk-5081", "刘文正", "消化科", "dliu@hsc.pku.edu.cn", "email-hundred-pmc12389329", 2025],
  ["puh3-gk-1722", "张立", "骨科", "drzhli@163.com", "email-hundred-pmc11939441", 2025],
  ["puh3-gk-6963", "陈安富", "骨科", "bfyyhqc@163.com", "email-hundred-pmc6805603", 2019],
  ["puh3-ptwk-1561", "孙涛", "普通外科", "sundai2004@sina.com", "email-graduate-pmc7877389", 2021],
  ["puh3-szyxzx-3271", "张佳佳", "生殖医学科", "joyjiazhang@sohu.com", "email-hundred-pmc6245701", 2018],
  ["puh3-ttk-4035", "赵文奎", "疼痛科", "zhaowenkui2008@163.com", "email-hundred-pmc9137062", 2022],
  ["puh3-ttk-4045", "梁辰", "疼痛科", "eric.liangchen@163.com", "email-hundred-pmc9137062", 2022],
  ["puh3-wzbxk-1551", "薄世宁", "危重医学科", "652116041@qq.com", "email-graduate-pmc9746762", 2022],
  ["puh3-yk-1588", "许珂", "眼科", "docxuke@163.com", "email-graduate-pmc6192275", 2018],
];

test("graduate-route additions preserve the entire 614-contact baseline including reused sources", () => {
  const hash = createHash("sha256").update(JSON.stringify(prior)).digest("hex");
  assert.equal(hash, "4a79b1b737d6765b46803be507f1aa8f411b16e0e42b0becd5256280ca64e080");
  assert.equal(hash, report.baseline.directorySha256);
  assert.equal(prior.sources.length, 1536);
  assert.equal(prior.doctors.filter(doctor => doctor.contacts.length).length, 614);
  for (const source of prior.sources) {
    assert.deepEqual(data.sources.find(item => item.id === source.id), source);
  }
});

test("nine originally empty doctors receive exactly their verified academic email", () => {
  for (const [id, name, department, email, sourceId, year] of expected) {
    const doctor = data.doctors.find(item => item.id === id);
    const entry = report.entries.find(item => item.doctorId === id);
    assert.deepEqual([doctor.name, doctor.department, doctor.hospitalId], [name, department, "puh3"]);
    assert.deepEqual(prior.doctors.find(item => item.id === id).contacts, []);
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.deepEqual([contact.type, contact.purpose, contact.value, contact.sourceId],
      ["email", "academic", email, sourceId]);
    assert.match(contact.identityNote, /未测试收信.*不保证当前有效.*患者咨询/);
    assert.ok(doctor.evidence.some(item => item.sourceId === sourceId && item.fields.join() === "contacts"));
    assert.deepEqual(data.doctors.filter(item => item.contacts.some(c => c.value.toLowerCase() === email.toLowerCase()))
      .map(item => item.id), [id]);
    assert.deepEqual([entry.state, entry.email, entry.sourceId], ["accepted", email, sourceId]);
    assert.match(entry.sourceContentSha256, /^[a-f0-9]{64}$/);
    const source = data.sources.find(item => item.id === sourceId);
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-14");
    assert.equal(source.sourceUpdatedAt, null);
  }
});

test("six recipients reuse five unchanged originals rather than duplicating source rows", () => {
  const accepted = report.entries.filter(entry => entry.state === "accepted");
  const reused = accepted.filter(entry => entry.reusedSource);
  assert.equal(reused.length, 6);
  assert.equal(new Set(reused.map(entry => entry.sourceId)).size, 5);
  assert.equal(data.sources.filter(source => source.id.startsWith("email-graduate-")).length, 3);
  for (const entry of accepted) {
    assert.equal(data.sources.filter(source => source.url === entry.sourceUrl).length, 1);
  }
});

test("degree clues do not license transferring supervisors or same-sounding authors' addresses", () => {
  for (const id of ["puh3-yk-1576", "puh3-nnnk-1161", "puh3-ttk-1949", "puh3-zxwk-1181",
    "puh3-pfk-3402", "puh3-fck-2951"]) {
    assert.deepEqual(beforeJournal(data).doctors.find(doctor => doctor.id === id).contacts, []);
  }
  assert.equal(report.thesisRoute.individualThesisRecordsVerified, 0);
  assert.ok(report.thesisRoute.checks.some(check => check.httpStatus === 503));
  assert.equal(report.titleRecovery.matchedPmid, "19052652");
  assert.equal(report.titleRecovery.emailNotTransferred, "puh3_ww@bjmu.edu.cn");
  const note = id => data.doctors.find(doctor => doctor.id === id).contacts[0].identityNote;
  assert.match(note("puh3-wzbxk-1551"), /Shining Bo.*Xueni Li.*Bao/);
  assert.match(note("puh3-ttk-4045"), /Chen Liang.*本人.*不转用.*刘晓光/);
  assert.match(note("puh3-yk-1588"), /Ke Xu.*预算以外.*不混同协和/);
});

test("the ledger separates cached name screening from bounded network and degree research", () => {
  assert.equal(report.scope.missingNamesScreened, 357);
  assert.deepEqual(report.scope.cacheScan, {
    cacheFilesInspected: 796, uniqueXmlDocumentsParsed: 615,
    candidateAuthorRecords: 76, candidateDoctors: 35,
  });
  assert.equal(report.entries.length, report.scope.trackedDoctors);
  assert.equal(new Set(report.entries.map(entry => entry.doctorId)).size, report.entries.length);
  assert.equal(report.scope.newOfficialProfilesRead, 16);
  assert.equal(report.scope.retainedOfficialProfilesReused, 2);
  assert.equal(report.scope.exhaustive, false);
  const queries = report.entries.flatMap(entry => entry.queries);
  assert.equal(queries.length, 9);
  assert.equal(queries.reduce((n, query) => n + query.returnedRecords, 0), 71);
  assert.equal(queries.reduce((n, query) => n + query.papers.length, 0), 69);
  assert.equal(report.additionalFulltexts.length, 3);
  assert.ok(report.additionalFulltexts.every(item => item.status === 200));
});

test("graduate snapshot remains 623 while live journal additions preserve roster coverage", () => {
  assert.deepEqual(report.result, {
    addedEmailDoctors: 9, addedUniqueEmails: 9, addedSources: 3,
    doctorsReusingExistingSources: 6, distinctExistingSourcesReused: 5,
    emailDoctors: 623, uniqueEmails: 623, remainingMissing: 348, sources: 1539,
  });
  const emails = data.doctors.flatMap(doctor => doctor.contacts.filter(contact => contact.type === "email"));
  assert.equal(emails.length, 648);
  assert.equal(new Set(emails.map(contact => contact.value.toLowerCase())).size, 648);
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});
