import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { validateDirectory } from "../public/directory.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("additional papers preserve all 170 profiles, 126 prior emails and 305 sources", () => {
  const sources = data.sources.slice(0, 305);
  assert.equal(digest(sources), "fbc762d25b08cb8628ff84da1168230d2439cb5615faabe2f1e9140423a55ed7");
  const ids = new Set(sources.map(s => s.id));
  const historical = data.doctors.slice(0, 170).map(d => ({
    ...d,
    contacts: d.contacts.filter(c => ids.has(c.sourceId)),
    evidence: d.evidence.filter(e => ids.has(e.sourceId)),
  }));
  assert.equal(historical.filter(d => d.contacts.length).length, 126);
  assert.equal(digest(historical), "fafeda116b242ba5c445a1abc2ea51a2f7a84ee79beecde11cd8ad503df0e41f");
});

test("Jiang Weijuan's 2020 email belongs to her named contributor entry, not the corresponding author", () => {
  const sourceId = "email-more-papers-pmc7690097";
  const doctor = data.doctors.find(d => d.id === "puh3-jiang-weijuan");
  assert.equal(doctor.contacts.length, 1);
  const contact = doctor.contacts[0];
  assert.deepEqual([contact.type, contact.purpose, contact.value, contact.sourceId],
    ["email", "academic", "jwjtree@163.com", sourceId]);
  assert.match(contact.identityNote, /2020.*Contributor Information.*Weijuan Jiang/);
  assert.match(contact.identityNote, /第一作者单位1为北京大学第三医院放射治疗科/);
  assert.match(contact.identityNote, /不是把通讯作者王俊杰或共同作者江萍的邮箱转给她/);
  assert.match(contact.identityNote, /未测试收信/);
  assert.deepEqual(doctor.evidence.at(-1), { sourceId, fields: ["contacts"] });
  assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.sourceId === sourceId)).map(d => d.id),
    ["puh3-jiang-weijuan"]);
  const source = data.sources.find(s => s.id === sourceId);
  assert.equal(data.sources[305].id, sourceId);
  assert.equal(source.url, "https://pmc.ncbi.nlm.nih.gov/articles/PMC7690097/");
  assert.equal(source.publishedYear, 2020);
  assert.equal(source.kind, "journal-article");
  assert.equal(source.accessMethod, "browser");
  assert.equal(source.accessedAt, "2026-10-09");
  assert.equal(source.sourceUpdatedAt, null);
  assert.deepEqual(validateDirectory(data), []);
});

test("non-OA-flag follow-up preserves 170 profiles, 125 prior emails and 304 sources", () => {
  const sources = data.sources.slice(0, 304);
  assert.equal(digest(sources), "22a5c04e16ee953d70d3241f4a1313602d3cbb78e13baf724cfb66dc2313aab0");
  const ids = new Set(sources.map(s => s.id));
  const historical = data.doctors.slice(0, 170).map(d => ({
    ...d,
    contacts: d.contacts.filter(c => ids.has(c.sourceId)),
    evidence: d.evidence.filter(e => ids.has(e.sourceId)),
  }));
  assert.equal(historical.filter(d => d.contacts.length).length, 125);
  assert.equal(digest(historical), "c56074dac1efa1172c2718da5c37d68d4fccc0cc1ffdc6ef58e72d7a438cc8dd");
});

test("Han Yechen's historical email follows named correspondence and affiliation 2, not incorrect metadata", () => {
  const sourceId = "email-nflag-pmc9935361";
  const doctor = data.doctors.find(d => d.id === "pumch-han-yechen");
  assert.equal(doctor.contacts.length, 1);
  const contact = doctor.contacts[0];
  assert.deepEqual([contact.type, contact.purpose, contact.value, contact.sourceId],
    ["email", "academic", "bobogg2005@hotmail.com", sourceId]);
  assert.match(contact.identityNote, /2017.*通讯脚注明确列出韩业晨/);
  assert.match(contact.identityNote, /单位2为中国医学科学院北京协和医院心内科/);
  assert.match(contact.identityNote, /河北大学单位1未作为归属依据/);
  assert.match(contact.identityNote, /未测试收信/);
  assert.deepEqual(doctor.evidence.at(-1), { sourceId, fields: ["contacts"] });
  assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.sourceId === sourceId)).map(d => d.id),
    ["pumch-han-yechen"]);
  const source = data.sources.find(s => s.id === sourceId);
  assert.equal(data.sources[304].id, sourceId);
  assert.equal(source.url, "https://pmc.ncbi.nlm.nih.gov/articles/PMC9935361/");
  assert.equal(source.publishedYear, 2017);
  assert.equal(source.kind, "journal-article");
  assert.equal(source.accessMethod, "browser");
  assert.equal(source.accessedAt, "2026-10-09");
  assert.equal(source.sourceUpdatedAt, null);
  assert.deepEqual(validateDirectory(data), []);
});

test("alternative-path pilot preserves all 170 prior profiles, 124 emails and 303 sources", () => {
  const sources = data.sources.slice(0, 303);
  assert.equal(digest(sources), "1e5b9f9bdc2f21d3080d7700ee25af82332b13130b213c75a9b082bed331d920");
  const ids = new Set(sources.map(s => s.id));
  const historical = data.doctors.slice(0, 170).map(d => ({
    ...d,
    contacts: d.contacts.filter(c => ids.has(c.sourceId)),
    evidence: d.evidence.filter(e => ids.has(e.sourceId)),
  }));
  assert.equal(historical.filter(d => d.contacts.length).length, 124);
  assert.equal(digest(historical), "3c14c315e4d3caaaab3ce0a7eb6150c8c577e97f9169e23d63b214714266f039");
});

test("Liu Rui has independently named 2024 correspondence, not Wei Hui's public trial address", () => {
  const sourceId = "email-pilot-pmc11652994";
  const doctor = data.doctors.find(d => d.id === "puh3-liu-rui");
  assert.equal(doctor.contacts.length, 1);
  const contact = doctor.contacts[0];
  assert.deepEqual([contact.type, contact.purpose, contact.value, contact.sourceId],
    ["email", "academic", "maryllr@sina.com", sourceId]);
  assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.sourceId === sourceId)).map(d => d.id),
    ["puh3-liu-rui"]);
  assert.deepEqual(doctor.evidence.at(-1), { sourceId, fields: ["contacts"] });
  assert.match(contact.identityNote, /PMC原始HTML全文.*Rui LIU.*北京大学第三医院风湿免疫科/);
  assert.match(contact.identityNote, /LIU Rui.*2024.*未测试收信/);
  const source = data.sources.find(s => s.id === sourceId);
  assert.equal(data.sources[303].id, sourceId);
  assert.equal(source.url, "https://pmc.ncbi.nlm.nih.gov/articles/PMC11652994/");
  assert.equal(source.kind, "journal-article");
  assert.equal(source.publishedYear, 2024);
  assert.equal(source.accessMethod, "browser");
  assert.equal(source.accessedAt, "2026-10-09");
  assert.equal(source.sourceUpdatedAt, null);
  assert.notEqual(contact.value, data.doctors.find(d => d.id === "puh3-wei-hui").contacts[0].value);
  assert.deepEqual(validateDirectory(data), []);
});

test("pilot does not assign coauthor, radiology or recruitment-only addresses to the target doctor", () => {
  const rejected = [
    ["puh3-xing-huayi", "puth_liunan@outlook.com"],
    ["puh3-xing-huayi", "liondoctor@hotmail.com"],
    ["puh3-xing-huayi", "xinghuayi1987@126.com"],
    ["pumch-xu-ruiyi", "fanglgpumch@sina.com"],
    ["pumch-han-yechen", "wangyining@pumch.cn"],
    ["pumch-han-yechen", "835162783@qq.com"],
    ["puh3-zhang-jingfeng", "zhao-jinxia@163.com"],
    ["puh3-jiang-weijuan", "junjiewang_edu@sina.cn"],
    ["puh3-jiang-weijuan", "jiangping@bjmu.edu.cn"],
    ["puh3-jiang-weijuan", "drjiangping@qq.com"],
  ];
  for (const [id, value] of rejected) {
    assert.ok(!data.doctors.find(d => d.id === id).contacts.some(c => c.value.toLowerCase() === value.toLowerCase()), id);
  }
});
