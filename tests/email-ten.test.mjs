import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeTenRounds } from "./helpers/email-ten.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const report = JSON.parse(await readFile(new URL("../research/email-ten-2026-10-15.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prior = beforeTenRounds(data);
const expected = [
  ["puh3-jrxgk-1661", "梁士凯", "介入血管外科", "liangshikai90@126.com", 2025, 4],
  ["puh3-wzbxk-1045", "陈浩辉", "危重医学科", "chenhaohui_y@163.com", 2021, 8],
  ["puh3-jzk-1011", "葛洪霞", "急诊科", "ghx781122@163.com", 2021, 9],
  ["pumch-zhang-tengyue", "张腾越", "心内科", "fredzty@163.com", 2018, undefined],
  ["pumch-li-jingyi", "黎婧怡", "心内科", "pangxiongli@126.com", 2025, undefined],
];
const contact = id => data.doctors.find(d => d.id === id).contacts[0];

test("ten-round additions preserve the complete immutable 635-contact baseline", () => {
  const hash = createHash("sha256").update(JSON.stringify(prior)).digest("hex");
  assert.equal(hash, "77b6a038b4cace1723e3c87ce6f05090045f92bc021c327b108f7f1a3072bd6a");
  assert.equal(hash, report.baseline.directorySha256);
  assert.equal(prior.sources.length, 1550);
  assert.equal(prior.doctors.filter(d => d.contacts.length).length, 635);
  for (const source of prior.sources) {
    assert.deepEqual(data.sources.find(s => s.id === source.id), source);
  }
});

test("five previously empty doctors receive exact distinct addresses and original-source evidence", () => {
  assert.equal(report.entries.length, 5);
  for (const [id, name, department, email, year, round] of expected) {
    const doctor = data.doctors.find(d => d.id === id);
    const entry = report.entries.find(e => e.doctorId === id);
    assert.deepEqual([doctor.name, doctor.department], [name, department]);
    assert.deepEqual(prior.doctors.find(d => d.id === id).contacts, []);
    assert.equal(doctor.contacts.length, 1);
    assert.deepEqual([contact(id).value, contact(id).type, contact(id).purpose], [email, "email", "academic"]);
    assert.equal(entry.state, "accepted");
    assert.equal(entry.round, round);
    assert.equal(entry.email, email);
    assert.match(entry.evidenceSha256, /^[a-f0-9]{64}$/);
    assert.match(contact(id).identityNote, /未测试收信.*不保证当前有效.*患者咨询/);
    const source = data.sources.find(s => s.id === contact(id).sourceId);
    assert.equal(source.id, entry.sourceId);
    assert.equal(source.url, entry.sourceUrl);
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-15");
    assert.equal(source.sourceUpdatedAt, null);
    assert.equal(source.kind, "journal-article");
    assert.equal(data.sources.filter(s => s.url === source.url).length, 1);
    assert.ok(doctor.evidence.some(e => e.sourceId === source.id && e.fields.join() === "contacts"));
    assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.value === email)).map(d => d.id), [id]);
  }
});

test("all ten research rounds execute after planning and review before planning the next round", () => {
  assert.deepEqual(report.rounds.map(r => r.round), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(report.rounds.map(r => r.yield), [0, 0, 0, 1, 0, 0, 0, 1, 1, 0]);
  let previousFinish = -Infinity;
  for (const round of report.rounds) {
    assert.ok(Date.parse(round.plannedAt) > previousFinish);
    assert.ok(Date.parse(round.executedAt) >= Date.parse(round.plannedAt));
    assert.ok(Date.parse(round.finishedAt) >= Date.parse(round.executedAt));
    assert.ok(round.hypothesis && round.reasonFromPreviousRound && round.review && round.decisionForNextRound);
    assert.ok(round.checks.length > 0);
    assert.equal(round.checks.length, round.workload.checks);
    assert.ok(round.checks.some(c => ["retrieved", "reused-retained-cache"].includes(c.outcome)));
    assert.equal(round.acceptedCandidates.length, round.yield);
    previousFinish = Date.parse(round.finishedAt);
  }
  assert.match(report.rounds.at(-1).decisionForNextRound, /STOP.*no round11/);
  assert.equal(new Set(report.rounds.flatMap(r => r.targets.map(t => t.doctorId))).size, 28);
  assert.equal(report.rounds.flatMap(r => r.checks).filter(c => c.networkRequest).length, 105);
  assert.equal(report.pathfinderTotals.uniquePaperIdentitiesAttempted, 40);
  assert.equal(report.pathfinderTotals.uniquePaperIdentitiesRead, 38);
  assert.equal(report.pathfinderTotals.acceptedNewDoctors, 3);
  assert.equal(report.parentSupplement.counts.newEmails, 2);
  assert.equal(report.entries.filter(e => e.lane === "parent-supplement").length, 2);
  assert.match(report.postCompletionFeedback.timingAndScope, /after all ten rounds finished/);
});

test("explicit ownership outranks metadata position while historical and team limitations remain visible", () => {
  const liang = contact("puh3-jrxgk-1661").identityNote;
  assert.match(liang, /2025-07.*2025-08.*历史单位/);
  assert.match(liang, /原始PubMed作者元数据.*不冒称.*全文/);
  const chen = contact("puh3-wzbxk-1045").identityNote;
  assert.match(chen, /Li Sai.*Corresponding author: Chen Haohui, Email: chenhaohui_y@163.com/);
  assert.match(chen, /不按所在节点转给李赛/);
  const ge = contact("puh3-jzk-1011").identityNote;
  assert.match(ge, /41680647.*Qingbian Ma/);
  assert.match(ge, /共同通讯联系渠道.*不声称个人独占/);
  assert.match(ge, /在线发表2021-08-16.*卷期2022/);
  assert.notEqual(contact("puh3-jzk-1011").value, "maqingbian@126.com");
  assert.match(contact("pumch-zhang-tengyue").identityNote, /Contributor Information.*呼吸科.*2022.*ZHANG Tengyue/);
  assert.match(contact("pumch-li-jingyi").identityNote, /Jingyi Li.*pangxiongli@126.com.*不按邮箱用户名推测姓名/);
});

test("zero-yield rounds preserve failed hypotheses, blocked retrieval and other-owner exclusions", () => {
  assert.match(report.rounds[4].review, /repeats two addresses.*neither belongs to Liang Fei/);
  assert.match(report.rounds[5].review, /Equal-contribution.*do not assign email ownership/);
  assert.match(report.rounds[6].review, /not actual letters|rather than actual letters/);
  assert.ok(report.rounds.flatMap(r => r.checks).some(c => c.outcome === "access-failed"));
  assert.ok(report.parentSupplement.blockedEvidence.some(e => e.outcome.includes("429")));
  assert.ok(report.parentSupplement.phases.some(p => p.review.includes("只给邮寄地址")));
  assert.deepEqual(data.doctors.find(d => d.id === "puh3-xxgnk-3151").contacts, []);
  assert.deepEqual(data.doctors.find(d => d.id === "pumch-zhang-bowei").contacts, []);
});

test("current directory has 648 unique emails and 323 gaps without altering roster coverage", () => {
  assert.deepEqual(report.result, {
    addedEmailDoctors: 5, addedUniqueEmails: 5, addedSources: 5,
    emailDoctors: 640, uniqueEmails: 640, remainingMissing: 331, sources: 1555,
  });
  const emails = data.doctors.flatMap(d => d.contacts);
  assert.equal(emails.length, 648);
  assert.equal(new Set(emails.map(c => c.value.toLowerCase())).size, 648);
  assert.equal(data.doctors.filter(d => !d.contacts.length).length, 323);
  assert.equal(data.sources.length, 1563);
  assert.equal(data.sources.filter(s => s.id.startsWith("email-ten-")).length, 5);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});
