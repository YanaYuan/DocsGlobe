import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeGrok } from "./helpers/email-grok.mjs";
import { beforeTenRounds } from "./helpers/email-ten.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const report = JSON.parse(await readFile(new URL("../research/email-grok-2026-10-15.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prior = beforeGrok(data);
const expected = [
  ["puh3-ek-1091", "朴梅花", "儿科", "pmh1990@sina.com", 2025, "PMC11941668"],
  ["puh3-xynk-1441", "田磊", "血液内科", "tianlei@bjmu.edu.cn", 2024, "PMC11258385"],
  ["puh3-xhk-1261", "陆京京", "消化科", "lujingjing@bjmu.edu.cn", 2019, "PMC7003148"],
  ["puh3-xhk-1211", "索宝军", "消化科", "suobaojun2013@126.com", 2026, "PMC13137788"],
  ["puh3-jzk-2321", "王军红", "急诊科", "wangjh111@126.com", 2025, "PMC12214122"],
  ["puh3-gk-5743", "冯辉", "骨科", "fenghuibjmu@bjmu.edu.cn", 2026, "PMC13118223"],
  ["puh3-gk-6953", "赵然", "骨科", "zhaoran09@126.com", 2023, "PMC9990337"],
  ["puh3-fck-3001", "刘忠宇", "妇产科", "liuzhongyudayu@163.com", 2025, "PMC12292186"],
];

test("Grok additions restore the complete immutable 640-contact baseline and the older ten-round chain", () => {
  const hash = createHash("sha256").update(JSON.stringify(prior)).digest("hex");
  assert.equal(hash, "ce979765dfb5280a91e8d01c7fe544e566b5a2b399c83807027fa1366338f4cf");
  assert.equal(hash, report.baseline.directorySha256);
  assert.equal(prior.sources.length, 1555);
  assert.equal(prior.doctors.filter(d => d.contacts.length).length, 640);
  const ten = beforeTenRounds(data);
  assert.equal(createHash("sha256").update(JSON.stringify(ten)).digest("hex"),
    "77b6a038b4cace1723e3c87ce6f05090045f92bc021c327b108f7f1a3072bd6a");
});

test("eight previously empty doctors receive exact author-owned addresses", () => {
  assert.equal(report.entries.length, 8);
  for (const [id, name, department, email, year, pmcid] of expected) {
    const doctor = data.doctors.find(d => d.id === id);
    const entry = report.entries.find(e => e.doctorId === id);
    assert.deepEqual([doctor.name, doctor.department], [name, department]);
    assert.deepEqual(prior.doctors.find(d => d.id === id).contacts, []);
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.deepEqual([contact.value, contact.type, contact.purpose], [email, "email", "academic"]);
    assert.match(contact.identityNote, /未测试收信.*不保证当前有效.*患者咨询/);
    assert.equal(entry.email, email);
    assert.equal(entry.pmcid, pmcid);
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.equal(source.id, `email-grok-${id}`);
    assert.equal(source.url, `https://europepmc.org/articles/${pmcid}`);
    assert.equal(source.url, entry.sourceUrl);
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-15");
    assert.equal(source.sourceUpdatedAt, null);
    assert.equal(source.kind, "journal-article");
    assert.equal(data.sources.filter(s => s.url === source.url).length, 1);
    assert.ok(doctor.evidence.some(e => e.sourceId === source.id && e.fields.join() === "contacts"));
    assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.value.toLowerCase() === email)).map(d => d.id), [id]);
  }
});

test("same-hospital wrong department, other hospital and office addresses stay unassigned", () => {
  for (const item of report.rejected) {
      const doctor = data.doctors.find(d => d.id === item.doctorId);
      assert.deepEqual(doctor.contacts, []);
      assert.equal(doctor.contacts.some(c => c.value.toLowerCase() === item.email), false);
    }
    const jing = data.doctors.filter(d => d.contacts.some(c => c.value.toLowerCase() === "wingman_yj@163.com"));
    assert.deepEqual(jing.map(d => [d.id, d.name, d.department]), [["puh3-fck-3111", "杨静", "妇产科"]]);
  assert.equal(report.zeroYieldRoutes.length, 4);
  assert.match(report.zeroYieldRoutes.map(r => r.route).join(" "), /ClinicalTrials|ORCID|faculty|500/);
});

test("current directory has 648 unique emails and 323 gaps", () => {
  assert.deepEqual(report.result, {
    addedEmailDoctors: 8, addedUniqueEmails: 8, addedSources: 8,
    emailDoctors: 648, uniqueEmails: 648, remainingMissing: 323, sources: 1563,
  });
  const emails = data.doctors.flatMap(d => d.contacts);
  assert.equal(emails.length, 648);
  assert.equal(new Set(emails.map(c => c.value.toLowerCase())).size, 648);
  assert.equal(data.doctors.filter(d => !d.contacts.length).length, 323);
  assert.equal(data.sources.length, 1563);
  assert.equal(data.sources.filter(s => s.id.startsWith("email-grok-")).length, 8);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});
