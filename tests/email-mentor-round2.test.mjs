import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeGraduate } from "./helpers/email-graduate.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const sourceId = "email-mentor-round2-2025";
const expected = [
  ["puh3-gk-6623", "王程", "wangchengbjmu@bjmu.edu.cn", "第149行"],
  ["puh3-gk-6843", "袁磊", "yuanleipku@163.com", "第154、155行"],
];

test("second-round mentor contacts preserve the complete 584-person baseline", () => {
  const prior = beforeGraduate(data);
  const historical = {
    ...prior,
    sources: prior.sources.filter(source => source.id !== sourceId && !source.id.startsWith("email-audit-") &&
      !source.id.startsWith("email-reassess-") && !source.id.startsWith("email-hundred-")),
    doctors: prior.doctors.map(doctor => ({
      ...doctor,
      contacts: doctor.contacts.filter(contact => contact.sourceId !== sourceId && !contact.sourceId.startsWith("email-audit-") &&
        !contact.sourceId.startsWith("email-reassess-") && !contact.sourceId.startsWith("email-hundred-")),
      evidence: doctor.evidence.filter(item => item.sourceId !== sourceId && !item.sourceId.startsWith("email-audit-") &&
        !item.sourceId.startsWith("email-reassess-") && !item.sourceId.startsWith("email-hundred-")),
    })),
  };
  assert.equal(historical.doctors.filter(doctor => doctor.contacts.length).length, 584);
  assert.equal(historical.sources.length, 1505);
  assert.equal(createHash("sha256").update(JSON.stringify(historical)).digest("hex"),
    "72fecc5a2beb156a6ffbc6bc5cfd0c823680387869acf70099fb6ec33f194144");
  assert.deepEqual(expected.map(([id]) => historical.doctors.find(doctor => doctor.id === id).contacts),
    [[], []]);
});

test("two distinct orthopedic mentors have row-level email attribution, not phone imports", () => {
  for (const [id, name, value, row] of expected) {
    const doctor = data.doctors.find(item => item.id === id);
    assert.equal(doctor.name, name);
    assert.equal(doctor.hospitalId, "puh3");
    assert.equal(doctor.department, "骨科");
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.deepEqual(contact, {
      type: "email", value, purpose: "academic", sourceId, identityNote: contact.identityNote,
    });
    for (const text of [name, "北京大学第三医院", "骨科", "Sheet1", row, "J列", "不导入相邻电话字段"]) {
      assert.ok(contact.identityNote.includes(text), text);
    }
    assert.match(contact.identityNote, /未测试收信.*不保证当前有效.*不代表患者咨询渠道/);
    assert.deepEqual(doctor.evidence.at(-1), { sourceId, fields: ["contacts"] });
    assert.deepEqual(data.doctors.filter(item => item.contacts.some(other =>
      other.value.toLowerCase() === value.toLowerCase())).map(item => item.id), [id]);
  }
  const wangCheng = data.doctors.find(doctor => doctor.id === "puh3-gk-6623");
  assert.ok(wangCheng.contacts.every(contact => contact.value !== "pkuwang@yeah.net"));
  const sportsDoctor = data.doctors.find(doctor => doctor.name === "王成" && doctor.department === "运动医学科");
  assert.equal(sportsDoctor.contacts[0].value, "pkuwang@yeah.net");
});

test("one official second-round source adds exactly two emails without treating file migration as publication", () => {
  assert.deepEqual(data.sources.find(source => source.id === sourceId), {
    id: sourceId,
    title: "2025-2026北医三院大创教师项目信息（第二轮）：Sheet1第149、154、155行",
    publisher: "北京大学医学部教育处 / 北京大学第三临床医学院",
    url: "https://jiaoyuchu.bjmu.edu.cn/docs/2026-05/52bc0ef81e49425aa84797e6c48535ae.xlsx",
    publishedYear: 2025,
    accessedAt: "2026-10-14",
    accessMethod: "web",
    sourceUpdatedAt: null,
    kind: "university-profile",
  });
  assert.deepEqual(data.doctors.filter(doctor => doctor.contacts.some(contact => contact.sourceId === sourceId))
    .map(doctor => doctor.id), expected.map(([id]) => id));
  const emails = data.doctors.flatMap(doctor => doctor.contacts.filter(contact => contact.type === "email"));
  assert.equal(emails.length, 648);
  assert.equal(new Set(emails.map(contact => contact.value.toLowerCase())).size, 648);
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(planStats(coverage, data).email,
    { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});
