import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { emailContactHref, validateDirectory } from "../public/directory.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const original = data.doctors.slice(0, 170);
const sourceIds = new Set(data.sources.slice(0, 300).map(s => s.id));
const expected = [
  ["pumch-zhu-wenling", "zhuwenling@263.net", "email-gap-epmc-17526976", 2007],
  ["pumch-wang-liang", "wzmwll@sina.com", "email-gap-pmc7523753", 2020],
  ["puh3-wei-hui", "weihui2012@bjmu.edu.cn", "email-gap-who-chictr2500108234", null],
];

test("email-only additions preserve 170 biographies, all 121 prior contacts and all original evidence", () => {
  assert.equal(original.length, 170);
  assert.equal(digest(original.map(({ contacts, evidence, ...d }) => d)),
    "263c9851cf5023236f3703f9311935397689f0c6b9e3d64496ba7eaf19a69b43");
  const historical = original.map(d => ({
    ...d,
    contacts: d.contacts.filter(c => sourceIds.has(c.sourceId)),
    evidence: d.evidence.filter(e => sourceIds.has(e.sourceId)),
  }));
  assert.equal(historical.filter(d => d.contacts.length).length, 121);
  assert.equal(digest(historical),
    "2aeba9542a560747fee977fbad48696ce0959601d329a1a9c2ca9f2dd2e70df5");
  assert.equal(digest(data.sources.slice(0, 300)),
    "2b133c59b1b532c09d7ac145146b99e0203dce3e496079547dc35a2123d6ef9d");
});

test("three reviewed additions have exact ownership, direct sources and contact-only evidence", () => {
  const batchIds = new Set(expected.map(([, , id]) => id));
  const recipients = original.filter(d => d.contacts.some(c => batchIds.has(c.sourceId)));
  assert.deepEqual(new Set(recipients.map(d => d.id)), new Set(expected.map(([id]) => id)));
  assert.deepEqual(data.sources.slice(300, 303).map(s => s.id), [...batchIds]);
  for (const [id, value, sourceId, year] of expected) {
    const doctor = data.doctors.find(d => d.id === id);
    assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.value === value)).map(d => d.id), [id]);
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.deepEqual([contact.type, contact.purpose, contact.sourceId], ["email", "academic", sourceId]);
    assert.equal(emailContactHref(value), `mailto:${value}`);
    assert.match(contact.identityNote, /未测试收信/);
    assert.match(contact.identityNote, /北京协和医院|北京大学第三医院/);
    assert.deepEqual(doctor.evidence.filter(e => !sourceIds.has(e.sourceId)),
      [{ sourceId, fields: ["contacts"] }]);
    const source = data.sources.find(s => s.id === sourceId);
    assert.equal(source.accessedAt, "2026-10-09");
    if (year !== null) {
      assert.equal(source.kind, "journal-article");
      assert.equal(source.publishedYear, year);
      assert.equal(source.sourceUpdatedAt, null);
      assert.match(contact.identityNote, new RegExp(`${year}.*历史`));
    }
  }
  assert.deepEqual(validateDirectory(data), []);
});

test("historical author metadata and full-text correspondence are not misrepresented", () => {
  const zhu = data.doctors.find(d => d.id === "pumch-zhu-wenling").contacts[0];
  const zhuSource = data.sources.find(s => s.id === zhu.sourceId);
  const url = new URL(zhuSource.url);
  assert.equal(url.searchParams.get("query"), "EXT_ID:17526976 AND SRC:MED");
  assert.equal(url.searchParams.get("resultType"), "core");
  assert.match(zhu.identityNote, /作者元数据.*不是论文全文/);
  const wang = data.doctors.find(d => d.id === "pumch-wang-liang").contacts[0];
  assert.equal(data.sources.find(s => s.id === wang.sourceId).url,
    "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7523753/fullTextXML");
  assert.match(wang.identityNote, /Liang Wang.*单位标记d.*心内科.*星号/);
});

test("scientific trial contact is distinct from a shared public-contact name list", () => {
  const wei = data.doctors.find(d => d.id === "puh3-wei-hui").contacts[0];
  const source = data.sources.find(s => s.id === wei.sourceId);
  assert.equal(source.kind, "clinical-trial-registry");
  assert.equal(source.url, "https://trialsearch.who.int/Trial2.aspx?TrialID=ChiCTR2500108234");
  assert.equal(source.sourceUpdatedAt, "2025-09-01");
  assert.equal(source.publishedYear, undefined);
  assert.match(wei.identityNote, /2025-08-27.*Scientific Contact.*Hui Wei/);
  assert.match(wei.identityNote, /不表示当前招募/);
  assert.ok(!data.doctors.find(d => d.id === "puh3-liu-rui").contacts.some(c => c.value === wei.value));
});

test("namesakes, footer emails and an unverified recruitment repost remain excluded", () => {
  const rejected = [
    ["pumch-zhang-lihua", "zhanglh04036@163.com"],
    ["pumch-zhang-lihua", "zhanglh04036@aliyun.com"],
    ["pumch-wang-liang", "bryan_pumch@163.com"],
    ["puh3-zeng-yan", "puth_zy73@163.com"],
    ["puh3-zhang-na", "zhangna9902@pku.edu.cn"],
    ["puh3-liu-yang", "yliu_pu3h@bjmu.edu.cn"],
    ["puh3-xing-huayi", "xinghuayi1987@126.com"],
    ["puh3-fu-guimin", "2073738198@qq.com"],
  ];
  for (const [id, email] of rejected) {
    assert.ok(!data.doctors.find(d => d.id === id).contacts.some(c => c.value === email), id);
  }
  assert.ok(!data.doctors.some(d => d.contacts.some(c => c.value === "bysy@bjmu.edu.cn")));
  assert.deepEqual(data.doctors.find(d => d.id === "puh3-xing-huayi").contacts, []);
});
