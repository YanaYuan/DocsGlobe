import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { planStats } from "../public/coverage.mjs";
import { validateDirectory } from "../public/directory.mjs";

const directory = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const doctorId = "puh3-fck-3051";
const sourceId = "email-followup-pmc13254039";

test("Chen Junya's 2026 correspondence is linked to her own obstetrics profile", () => {
  const doctor = directory.doctors.find(item => item.id === doctorId);
  assert.equal(doctor.name, "陈俊雅");
  assert.equal(doctor.hospitalId, "puh3");
  assert.equal(doctor.department, "妇产科");
  assert.deepEqual(doctor.contacts, [{
    type: "email",
    value: "pkuxindichen@163.com",
    purpose: "academic",
    sourceId,
    identityNote: "2026年论文作者注具名JunYa Chen为通讯作者，单位为北京大学第三医院妇产科；与院方陈俊雅本人页的姓名、医院和科室对应。邮箱来自原文通讯作者说明，未测试收信，不代表患者咨询渠道。",
  }]);
  assert.deepEqual(doctor.evidence.at(-1), { sourceId, fields: ["contacts"] });

  const source = directory.sources.find(item => item.id === sourceId);
  assert.equal(source.title, "A Novel Fetal Intracranial Measurement Contributing to the Differential Diagnosis of Fetal Microcephaly");
  assert.equal(source.publisher, "Journal of Ultrasound in Medicine / Europe PMC");
  assert.equal(source.url, "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13254039/fullTextXML");
  assert.equal(source.publishedYear, 2026);
  assert.equal(source.accessedAt, "2026-10-14");
  assert.equal(source.kind, "journal-article");
  assert.deepEqual(directory.doctors.filter(item =>
    item.contacts.some(contact => contact.value === "pkuxindichen@163.com")).map(item => item.id), [doctorId]);
  assert.deepEqual(validateDirectory(directory, new Date("2026-10-15T23:59:59Z")), []);
  assert.deepEqual(planStats(coverage, directory).email,
    { current: 648, total: 971, remaining: 323, percent: 67 });
});
