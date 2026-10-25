import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeGraduate } from "./helpers/email-graduate.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const report = JSON.parse(await readFile(new URL("../research/email-hundred-2026-10-14.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prefix = "email-hundred-";
const beforeThisBatch = beforeGraduate(data);
const prior = {
  ...beforeThisBatch,
  sources: beforeThisBatch.sources.filter(source => !source.id.startsWith(prefix)),
  doctors: beforeThisBatch.doctors.map(doctor => ({
    ...doctor,
    contacts: doctor.contacts.filter(contact => !contact.sourceId.startsWith(prefix)),
    evidence: doctor.evidence.filter(item => !item.sourceId.startsWith(prefix)),
  })),
};
const expected = [
  ["puh3-hxywzzyxk-4432", "刘贝贝", "呼吸与危重症医学科", "358376555@qq.com", "PMC9493488", 2022],
  ["puh3-gk-5733", "杨钟玮", "骨科", "yangzhongwei2023@126.com", "PMC11381409", 2024],
  ["puh3-hxywzzyxk-3602", "丁艳苓", "呼吸与危重症医学科", "dingyanling@163.com", "PMC9514175", 2023],
  ["puh3-mzk-1261", "李刚", "麻醉科", "17801172947@163.com", "PMC13493377", 2026],
  ["puh3-xxgnk-3111", "张媛", "心血管内科", "zhangyuan@medmail.com.cn", "PMC4460176", 2015],
  ["puh3-ek-1451", "周薇", "儿科", "weiz6553@vip.sina.com", "PMC10972884", 2024],
  ["puh3-xxgnk-3621", "李丹", "心血管内科", "lidan275265342@163.com", "PMC13199084", 2026],
  ["puh3-zlhlyfsbk-2871", "李倩", "肿瘤化疗与放射病科", "docliq@126.com", "PMC8017263", 2021],
  ["puh3-hxywzzyxk-3552", "朱红", "呼吸与危重症医学科", "zhuhongmedsci@163.com", "PMC4263330", 2014],
  ["puh3-sjnk-16622", "刘娜", "神经内科", "cnliuna@126.com", "PMC6521422", 2019],
  ["puh3-gk-1721", "潘胜发", "骨科", "panshengfa@vip.sina.com", "PMC11939441", 2025],
  ["puh3-fsk-1566", "何为", "放射科", "heweihw@126.com", "PMC8234539", 2021],
  ["puh3-sjnk-16712", "张华纲", "神经内科", "zhang-hg@bjmu.edu.cn", "PMC8869764", 2022],
  ["puh3-szyxzx-3231", "李嘉", "生殖医学科", "jj_apple_jj@163.com", "PMC6245701", 2018],
  ["puh3-xhk-1221", "田雪丽", "消化科", "tiantian1188_163@163.com", "PMC12389329", 2025],
  ["puh3-xwk-2461", "宁英泽", "胸外科", "ningyingze@163.com", "PMC13256934", 2026],
  ["puh3-yk-1603", "敖明昕", "眼科", "mingxin256@vip.sina.com", "PMC6383292", 2019],
  ["puh3-gk-6833", "王勇", "骨科", "runneryong@163.com", "PMC6805603", 2019],
  ["puh3-ttk-1947", "黄鑫", "疼痛科", "hay221@163.com", "PMC9137062", 2022],
  ["puh3-blk-1901", "李丹阳", "病理科", "danyangli@bjmu.edu.cn", "PMC6929319", 2019],
];

test("hundred-doctor additions restore the complete unchanged 594-email baseline", () => {
  const hash = createHash("sha256").update(JSON.stringify(prior)).digest("hex");
  assert.equal(hash, "bbf2fe6fb575eb3551d0421e9f20b5efdf8ad91a1f981b3e908124c918bcdba4");
  assert.equal(report.baseline.directorySha256, hash);
  assert.equal(prior.sources.length, 1516);
  assert.equal(prior.doctors.filter(doctor => doctor.contacts.length).length, 594);
  assert.equal(data.sources.filter(source => source.id.startsWith(prefix)).length, 20);
});

test("the batch covers exactly 100 disjoint initially empty doctors in the agreed groups", () => {
  assert.equal(report.entries.length, 100);
  assert.equal(new Set(report.entries.map(entry => entry.doctorId)).size, 100);
  assert.deepEqual(report.scope.groups, { candidates: 20, papers: 50, institutions: 30 });
  for (const [group, count] of Object.entries(report.scope.groups)) {
    assert.equal(report.entries.filter(entry => entry.group === group).length, count);
  }
  for (const entry of report.entries) {
    const doctor = prior.doctors.find(item => item.id === entry.doctorId);
    assert.deepEqual([doctor.name, doctor.department], [entry.name, entry.department]);
    assert.deepEqual(doctor.contacts, []);
    assert.ok(entry.checks.length);
    assert.ok(entry.decision);
    assert.equal(entry.exhaustive, false);
    if (entry.state !== "accepted") assert.ok(entry.nextStep);
  }
});

test("twenty original-source research contacts attach only to the reviewed doctor and department", () => {
  for (const [id, name, department, email, pmcid, year] of expected) {
    const doctor = data.doctors.find(item => item.id === id);
    const entry = report.entries.find(item => item.doctorId === id);
    assert.deepEqual([doctor.name, doctor.department, doctor.hospitalId], [name, department, "puh3"]);
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.deepEqual([contact.type, contact.purpose, contact.value, contact.sourceId],
      ["email", "academic", email, prefix + pmcid.toLowerCase()]);
    assert.match(contact.identityNote, /未测试收信.*不保证当前有效.*患者咨询/);
    assert.deepEqual(data.doctors.filter(item => item.contacts.some(c =>
      c.value.toLowerCase() === email.toLowerCase())).map(item => item.id), [id]);
    assert.ok(doctor.evidence.some(item => item.sourceId === contact.sourceId && item.fields.join() === "contacts"));
    const source = data.sources.find(item => item.id === contact.sourceId);
    assert.equal(source.url, `https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcid}/fullTextXML`);
    assert.equal(source.publishedYear, year);
    assert.equal(source.sourceUpdatedAt, null);
    assert.equal(source.accessedAt, "2026-10-14");
    assert.equal(entry.state, "accepted");
    assert.equal(entry.email, email);
    assert.ok(entry.emailEvidence.some(item => item.pmcid === pmcid &&
      (item.namedBlocks.some(block => block.includes(email)) ||
       item.directAuthorLinks?.some(link => link.directEmails.includes(email) ||
         link.linkedBlocks.some(block => block.emails.includes(email))))));
  }
});

test("department namesakes and ambiguous shared blocks remain protected", () => {
  for (const id of ["puh3-ptwk-1701", "puh3-qyxk-1546", "puh3-nfmk-4682"]) {
    assert.deepEqual(data.doctors.find(doctor => doctor.id === id).contacts, []);
    assert.equal(report.entries.find(entry => entry.doctorId === id).state, "unresolved-after-bounded-check");
  }
  const note = id => data.doctors.find(doctor => doctor.id === id).contacts[0].identityNote;
  assert.match(note("puh3-hxywzzyxk-4432"), /Beibei Liu.*Ning Shen.*分号.*不是按匿名地址顺序/);
  assert.match(note("puh3-zlhlyfsbk-2871"), /Li Qian.*Qian L.*完整中文姓名拼音/);
  assert.match(note("puh3-gk-5733"), /冬奥医疗保障/);
  assert.match(note("puh3-hxywzzyxk-3602"), /2023.*2022/);
  assert.match(report.entries.find(entry => entry.doctorId === "puh3-nfmk-4682").decision, /不按排列猜配/);
});

test("recorded retrieval metrics are derived from valid queries and distinguish cache reuse", () => {
  assert.equal(report.scope.invalidInitialQueriesExcluded, true);
  assert.equal(report.scope.exhaustive, false);
  for (const group of ["papers", "candidates"]) {
    const entries = report.entries.filter(entry => entry.group === group);
    const checks = entries.flatMap(entry => entry.checks);
    const metric = report.scope.metrics[group];
    assert.equal(metric.returnedRecords, entries.reduce((n, entry) => n + entry.returnedRecords, 0));
    assert.equal(metric.matchedAuthorRecords, entries.reduce((n, entry) => n + entry.matchingRecordIds.length, 0));
    assert.equal(metric.parsedXmlRecordsIncludingDuplicates, entries.reduce((n, entry) => n + entry.parsedXmlRecords, 0));
    assert.equal(metric.xmlChecksIncludingCacheReuse, checks.filter(check => check.kind === "original-xml").length);
    assert.equal(metric.uniqueXmlUrls, new Set(checks.filter(check => check.kind === "original-xml").map(check => check.url)).size);
    assert.equal(metric.incompleteResultPages, entries.filter(entry => entry.hitCount > entry.returnedRecords).length);
    for (const check of checks) {
      assert.ok(check.outcome);
      if (check.query) {
        assert.doesNotMatch(check.query, /AUTHOR:|AFFILIATION:/);
      }
    }
  }
  assert.equal(report.scope.metrics.papers.returnedRecords, 1419);
  assert.equal(report.scope.metrics.papers.parsedXmlRecordsIncludingDuplicates, 667);
  assert.equal(report.scope.metrics.papers.checkOutcomes["reused-current-batch-cache"], 33);
});

test("institution and PDF routes preserve unsuccessful checks without inventing coverage", () => {
  assert.equal(report.scope.institutionProfilesRead, 30);
  assert.equal(report.scope.initialDepartmentIndexesRead, 11);
  assert.equal(report.scope.initialDepartmentArticlesRead, 90);
  assert.equal(report.scope.imagesVisuallyChecked.length, 2);
  const sharedIds = new Set(report.institutionChecks.map(check => check.id));
  for (const entry of report.entries.filter(item => item.group === "institutions")) {
    assert.ok(entry.checks.some(check => check.kind === "hospital-profile" && check.httpStatus === 200));
    assert.ok(entry.sharedCheckIds.every(id => sharedIds.has(id)));
  }
  assert.equal(report.publisherPdfFollowups.length, 11);
  assert.equal(new Set(report.publisherPdfFollowups.map(item => item.url)).size, 11);
  assert.equal(report.publisherPdfFollowups.filter(item => item.checks.some(check => check.outcome === "retrieved")).length, 3);
  assert.equal(report.publisherPdfFollowups.filter(item => item.checks.some(check => check.outcome === "access-failed")).length, 6);
  assert.equal(report.publisherPdfFollowups.filter(item => item.checks.some(check => check.outcome === "not-a-pdf-response")).length, 2);
});

test("direct author links, unique initials and an official historical publication remain auditable", () => {
  assert.equal(report.scope.directAuthorLinkRecheck.additionalEmailBearingAuthorRecords, 31);
  assert.equal(report.scope.directAuthorLinkRecheck.additionalAcceptedDoctors, 10);
  const entry = id => report.entries.find(item => item.doctorId === id);
  for (const [id, initials] of [
    ["puh3-gk-1721", "S.P."], ["puh3-fsk-1566", "W.H."],
    ["puh3-sjnk-16712", "H.Z."], ["puh3-xhk-1221", "X.T."],
  ]) {
    assert.ok(entry(id).decision.includes(initials));
    assert.match(entry(id).decision, /唯一对应/);
  }
  const li = entry("puh3-blk-1901");
  assert.match(li.decision, /官网.*第4项.*北大医院.*历史单位/);
  assert.ok(li.supplementaryChecks.some(check => check.outcome === "official-publication-4-exact-title-match"));
  assert.ok(li.supplementaryChecks.some(check => check.kind === "original-xml" && check.httpStatus === 200));
  const ning = data.doctors.find(doctor => doctor.id === "puh3-xwk-2461").contacts[0];
  assert.match(ning.identityNote, /Guangliang Qiang.*pkudd@bjmu.edu.cn.*研究联系渠道.*未逐人标注.*可能为团队使用.*不声明个人专属/);
  assert.deepEqual(data.doctors.find(doctor => doctor.id === "puh3-xwk-2381").contacts, []);
  assert.match(entry("pumch-li-ling").decision, /神经内科.*心内科/);
});

test("published totals count only the twenty new covered doctors and preserve roster dates", () => {
  assert.equal(report.entries.filter(entry => entry.state === "accepted").length, 20);
  assert.deepEqual(report.result, {
    addedEmailDoctors: 20, addedUniqueEmails: 20, addedSources: 20,
    emailDoctors: 614, uniqueEmails: 614, remainingMissing: 357, sources: 1536,
    groupYields: { candidates: 0, papers: 20, institutions: 0 },
  });
  const emails = data.doctors.flatMap(doctor => doctor.contacts.filter(contact => contact.type === "email"));
  assert.equal(emails.length, 648);
  assert.equal(new Set(emails.map(contact => contact.value.toLowerCase())).size, 648);
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});
