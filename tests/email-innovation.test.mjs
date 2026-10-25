import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeGraduate } from "./helpers/email-graduate.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prefix = "email-innovation-";
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const expected = [
  ["puh3-xxgnk-3241", "孙丽杰", "心血管内科", "lijiesun@126.com", 2025, 3],
  ["puh3-xxgnk-3301", "王方芳", "心血管内科", "doctorfancy@126.com", 2025, 6],
  ["puh3-xxgnk-3281", "赵威", "心血管内科", "beate_vv@126.com", 2025, 7],
  ["puh3-yk-1600", "范翔", "眼科", "fanxiang@126.com", 2025, 86],
  ["puh3-yk-1611", "韩亮", "眼科", "drhanliang@163.com", 2025, 87],
  ["puh3-yk-7322", "江晓丹", "眼科", "eyedrjiang@bjmu.edu.cn", 2025, 90],
  ["puh3-ebhk-1268", "王宇", "耳鼻喉科", "janewang18@bjmu.edu.cn", 2025, 102],
  ["puh3-jzk-1121", "怀伟", "急诊科", "15810392727@163.com", 2025, 119],
  ["puh3-jzk-1161", "郑康", "急诊科", "zhengkang@bjmu.edu.cn", 2025, 121],
  ["puh3-xxgnk-3931", "邵春丽", "心血管内科", "chunlishao@126.com", 2024, 5],
  ["puh3-xxgnk-3961", "王文尧", "心血管内科", "wangwy@bjmu.edu.cn", 2024, 7],
  ["puh3-xxgnk-3351", "徐昕晔", "心血管内科", "leaftonks@126.com", 2024, 8],
  ["puh3-hxywzzyxk-3281", "张静", "呼吸与危重症医学科", "jing_amy@bjmu.edu.cn", 2024, 18],
  ["puh3-ptwk-3571", "邴运韬", "普通外科", "bingyuntao@bjmu.edu.cn", 2024, 30],
  ["puh3-zxwk-1221", "马建勋", "成形外科", "ted_killua@163.com", 2024, 58],
  ["puh3-yk-1598", "邱伟强", "眼科", "weiqiang_qiu@bjmu.edu.cn", 2024, 136],
  ["puh3-ebhk-1270", "杜晨", "耳鼻喉科", "dcbriandu@163.com", 2024, 138],
  ["puh3-ebhk-1261", "李丽娟", "耳鼻喉科", "llj_juan1982@126.com", 2024, 140],
  ["puh3-ebhk-1260", "张珂", "耳鼻喉科", "zhangkebysy@163.com", 2024, 149],
  ["puh3-blk-1921", "王丹丹", "病理科", "dandan_wang@bjmu.edu.cn", 2024, 172],
];

test("mentor-table additions preserve every prior profile, all 511 contacts and 1450 sources", () => {
  const historical = beforeGraduate(data).doctors.map(d => ({
    ...d,
    contacts: d.contacts.filter(c => !c.sourceId.startsWith(prefix) && !c.sourceId.startsWith("email-author-") &&
      !c.sourceId.startsWith("email-corresp-") && !c.sourceId.startsWith("email-trial-") && !c.sourceId.startsWith("email-orcid-") &&
      !c.sourceId.startsWith("email-mentor-round2-") && !c.sourceId.startsWith("email-audit-") &&
      !c.sourceId.startsWith("email-reassess-") && !c.sourceId.startsWith("email-hundred-")),
    evidence: d.evidence.filter(e => !e.sourceId.startsWith(prefix) && !e.sourceId.startsWith("email-author-") &&
      !e.sourceId.startsWith("email-corresp-") && !e.sourceId.startsWith("email-trial-") && !e.sourceId.startsWith("email-orcid-") &&
      !e.sourceId.startsWith("email-mentor-round2-") && !e.sourceId.startsWith("email-audit-") &&
      !e.sourceId.startsWith("email-reassess-") && !e.sourceId.startsWith("email-hundred-")),
  }));
  assert.equal(historical.length, 971);
  assert.equal(historical.filter(d => d.contacts.length).length, 511);
  assert.equal(digest(historical), "8979b3aec8833e4a6d2c953d53ebe26bff3e56353d591e49543796093b32ac02");
  assert.equal(digest(data.sources.slice(0, 1450)), "47552c8d310d1714a4482bdc4891c4d946050e965fa987214fc5794421856620");
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("20 exact contacts belong to the named mentor and department, with row-level attribution", () => {
  assert.equal(expected.length, 20);
  for (const [id, name, department, value, year, row] of expected) {
    const doctor = data.doctors.find(d => d.id === id);
    assert.equal(doctor.name, name);
    assert.equal(doctor.hospitalId, "puh3");
    assert.equal(doctor.department, department);
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.equal(contact.value, value);
    assert.equal(contact.type, "email");
    assert.equal(contact.purpose, "academic");
    assert.equal(contact.sourceId, prefix + year);
    assert.ok(contact.identityNote.includes(name));
    assert.match(contact.identityNote, new RegExp(`第${row}[、行]`));
    assert.match(contact.identityNote, /未测试收信.*不保证当前有效.*不代表患者咨询渠道/);
    assert.deepEqual(doctor.evidence.find(e => e.sourceId === contact.sourceId),
      { sourceId: contact.sourceId, fields: ["contacts"] });
    assert.deepEqual(data.doctors.filter(d =>
      d.contacts.some(c => c.value.toLowerCase() === value.toLowerCase())).map(d => d.id), [id]);
  }
});

test("two official attachments retain historical years rather than becoming 2026 publications", () => {
  const sources = data.sources.filter(s => s.id.startsWith(prefix));
  assert.equal(sources.length, 2);
  for (const [year, url] of [
    [2025, "https://jiaoyuchu.bjmu.edu.cn/docs/2025-09/20250902094828540574.xlsx"],
    [2024, "https://jiaoyuchu.bjmu.edu.cn/docs/2024-09/20240919112609746009.xlsx"],
  ]) {
    const source = sources.find(s => s.id === prefix + year);
    assert.equal(source.url, url);
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-14");
    assert.equal(source.sourceUpdatedAt, null);
    assert.equal(source.publisher, "北京大学医学部教育处 / 北京大学第三临床医学院");
    assert.equal(source.kind, "university-profile");
    assert.equal(data.doctors.filter(d => d.contacts.some(c => c.sourceId === source.id)).length,
      year === 2025 ? 9 : 11);
  }
});

test("duplicate projects and cross-year repeats do not inflate coverage or transfer namesake addresses", () => {
  const added = data.doctors.filter(d => d.contacts.some(c => c.sourceId.startsWith(prefix)));
  assert.equal(added.length, 20);
  assert.equal(new Set(added.map(d => d.contacts[0].value)).size, 20);
  assert.equal(new Set(added.map(d => d.department)).size, 8);
  assert.equal(data.doctors.filter(d => d.name === "张静" && d.department === "消化科")
    .some(d => d.contacts.some(c => c.value === "jing_amy@bjmu.edu.cn")), false);
  assert.ok(data.doctors.filter(d => d.hospitalId !== "puh3")
    .every(d => d.contacts.every(c => !c.sourceId.startsWith(prefix))));
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(planStats(coverage, data).email,
    { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
});
