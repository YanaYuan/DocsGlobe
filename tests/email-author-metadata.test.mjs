import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeGraduate } from "./helpers/email-graduate.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prefix = "email-author-";
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const expected = [
  ["puh3-xxgnk-3081", "刘书旺", "心血管内科", "liuswbysy@163.com", "42213007", 2026],
  ["puh3-xxgnk-3101", "李海燕", "心血管内科", "haiyanli_bysy@bjmu.edu.cn", "41094680", 2025],
  ["puh3-xxgnk-3321", "陈少敏", "心血管内科", "chenshaomin1999@163.com", "39953320", 2025],
  ["puh3-xxgnk-3251", "何立芸", "心血管内科", "hly26@126.com", "33148298", 2020],
  ["puh3-xxgnk-3261", "李蕾", "心血管内科", "dr_lilei@bjmu.edu.cn", "34629254", 2021],
  ["puh3-hxywzzyxk-3572", "路明", "呼吸与危重症医学科", "luming197954@163.com", "42157131", 2026],
  ["puh3-hxywzzyxk-3181", "王筱宏", "呼吸与危重症医学科", "sshwang@126.com", "40074970", 2025],
];

test("author-metadata additions preserve all 531 prior contacts and 1452 sources", () => {
  const historical = beforeGraduate(data).doctors.map(doctor => ({
    ...doctor,
    contacts: doctor.contacts.filter(contact => !contact.sourceId.startsWith(prefix) &&
      !contact.sourceId.startsWith("email-corresp-") && !contact.sourceId.startsWith("email-trial-") &&
      !contact.sourceId.startsWith("email-orcid-") && !contact.sourceId.startsWith("email-mentor-round2-") &&
      !contact.sourceId.startsWith("email-audit-") && !contact.sourceId.startsWith("email-reassess-") &&
      !contact.sourceId.startsWith("email-hundred-")),
    evidence: doctor.evidence.filter(item => !item.sourceId.startsWith(prefix) &&
      !item.sourceId.startsWith("email-corresp-") && !item.sourceId.startsWith("email-trial-") &&
      !item.sourceId.startsWith("email-orcid-") && !item.sourceId.startsWith("email-mentor-round2-") &&
      !item.sourceId.startsWith("email-audit-") && !item.sourceId.startsWith("email-reassess-") &&
      !item.sourceId.startsWith("email-hundred-")),
  }));
  assert.equal(historical.length, 971);
  assert.equal(historical.filter(doctor => doctor.contacts.length).length, 531);
  assert.equal(digest(historical), "7d76cc8f18c8aab379b665799e2246dc132988f7b0d0ab499e2f05d389ff2d70");
  assert.equal(digest(data.sources.slice(0, 1452)), "088f41f57eabef2ca81a60944a894d0ef10ce9033f31574939863658a1aee273");
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("seven emails are attached only to the exact named author and matching department", () => {
  for (const [id, name, department, value, pmid] of expected) {
    const doctor = data.doctors.find(item => item.id === id);
    assert.equal(doctor.name, name);
    assert.equal(doctor.hospitalId, "puh3");
    assert.equal(doctor.department, department);
    assert.equal(doctor.contacts.length, 1);
    assert.deepEqual(doctor.contacts[0], {
      type: "email",
      value,
      purpose: "academic",
      sourceId: `${prefix}pmid${pmid}`,
      identityNote: doctor.contacts[0].identityNote,
    });
    assert.match(doctor.contacts[0].identityNote, new RegExp(name === "路明" ? "Ming Lu" :
      name === "王筱宏" ? "Xiaohong Wang" :
      name === "刘书旺" ? "Shuwang Liu" :
      name === "李海燕" ? "Haiyan Li" :
      name === "陈少敏" ? "Shaomin Chen" :
      name === "何立芸" ? "Liyun He" : "Lei Li"));
    assert.match(doctor.contacts[0].identityNote, /未测试收信.*不保证当前有效.*接受患者咨询/);
    assert.deepEqual(doctor.evidence.find(item => item.sourceId === doctor.contacts[0].sourceId),
      { sourceId: doctor.contacts[0].sourceId, fields: ["contacts"] });
    assert.deepEqual(data.doctors.filter(item =>
      item.contacts.some(contact => contact.value.toLowerCase() === value.toLowerCase())).map(item => item.id), [id]);
  }
});

test("seven exact PMID sources retain article years and direct core-metadata URLs", () => {
  for (const [, , , , pmid, year] of expected) {
    const source = data.sources.find(item => item.id === `${prefix}pmid${pmid}`);
    assert.equal(source.url,
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:${pmid}&format=json&resultType=core`);
    assert.equal(source.kind, "journal-article");
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-14");
    assert.equal(source.accessMethod, "web");
    assert.equal(source.sourceUpdatedAt, null);
    assert.match(source.publisher, /Europe PMC$/);
  }
});

test("shared affiliation emails and namesakes do not inflate the new coverage", () => {
  const added = data.doctors.filter(doctor =>
    doctor.contacts.some(contact => contact.sourceId.startsWith(prefix)));
  assert.equal(added.length, 44);
  assert.equal(new Set(added.map(doctor => doctor.contacts[0].value.toLowerCase())).size, 44);
  assert.ok(added.every(doctor => doctor.hospitalId === "puh3"));
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(planStats(coverage, data).email,
    { current: 648, total: 971, remaining: 323, percent: 67 });
});
