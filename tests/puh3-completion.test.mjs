import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { filterDoctors, validateDirectory } from "../public/directory.mjs";
import { coverageStats, planStats, validateCoverage } from "../public/coverage.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const pilot = coverage.pilots.find(p => p.hospitalId === "puh3");
const entries = pilot.lists.flatMap(l => l.pages.flatMap(p => p.doctors));
const added = data.doctors.slice(170);
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const now = new Date("2026-10-15T23:59:59Z");

test("hospital expansion preserves all 170 prior profiles, 127 contacts and 306 sources exactly", () => {
  const sourceIds = new Set(data.sources.slice(0, 306).map(s => s.id));
  const historical = data.doctors.slice(0, 170).map(d => ({
    ...d,
    contacts: d.contacts.filter(c => sourceIds.has(c.sourceId)),
    evidence: d.evidence.filter(e => sourceIds.has(e.sourceId)),
  }));
  assert.equal(digest(historical),
    "47236924e2931bc57763e607143ccbf4c1e8cf14b3a43d667c472411591bccfd");
  assert.equal(digest(data.sources.slice(0, 306)),
    "ec11df430ea0fe3e78e27d4abfa3cc36ee2e21b552163655b819856c88fc4cd0");
  assert.equal(added.length, 801);
  assert.equal(historical.filter(d => d.contacts.length).length, 127);
  assert.deepEqual(validateDirectory(data, now), []);
  assert.deepEqual(validateCoverage(coverage, data, now), []);
});

test("all 47 public entrances have evidence, but two have no published named roster", () => {
  assert.equal(pilot.departments.length, 47);
  assert.equal(pilot.lists.length, 45);
  assert.equal(pilot.rosterComplete, false);
  const missing = pilot.departments.filter(d => d.audit.status === "no-public-roster");
  assert.deepEqual(missing.map(d => d.name), ["健康医学科（体检中心）", "输血科"]);
  for (const department of pilot.departments) {
    assert.equal(department.audit.checkedAt, "2026-10-09");
    assert.ok(department.audit.urls.length);
    assert.ok(department.audit.note);
  }
  assert.equal(planStats(coverage, data).entries.current, 48);
  assert.equal(coverage.citywideHospitalTotal, null);
});

test("named observations separate linked doctors, explicit exclusions and unresolved identities", () => {
  assert.equal(entries.length, 991);
  assert.equal(entries.filter(e => e.directoryDoctorId).length, 922);
  assert.equal(entries.filter(e => e.exclusionReason).length, 54);
  const pending = entries.filter(e => !e.directoryDoctorId && !e.exclusionReason);
  assert.deepEqual(pending.map(e => e.name).sort(), [
    "陈亚平", "常翠青", "杨瑞杰", "花欣炜", "张耀华", "魏蕊", "宋纯理", "梁晓龙",
    "郑佳佳", "司文喆", "李子健", "陈龙", "艾华", "张玉萍", "白艳杰",
  ].sort());
  const linked = new Set(entries.filter(e => e.directoryDoctorId).map(e => e.directoryDoctorId));
  const doctors = data.doctors.filter(d => d.hospitalId === "puh3");
  assert.equal(linked.size, 903);
  assert.deepEqual(linked, new Set(doctors.map(d => d.id)));
  assert.equal(coverageStats(coverage).pendingRecords, 15);
});

test("reviewed cross-department identities merge, while same-name clinicians stay separate", () => {
  for (const name of ["郭静萱", "刘剑羽", "刘晓光", "洪锴", "乔杰", "李蓉", "崔国庆", "郭向阳"]) {
    assert.equal(data.doctors.filter(d => d.hospitalId === "puh3" && d.name === name).length, 1, name);
  }
  for (const [name, count] of [["李丹", 2], ["张静", 2], ["张帆", 3], ["杨琼", 2],
    ["李东", 2], ["李欣", 2], ["李刚", 2], ["刘平", 2]]) {
    assert.equal(data.doctors.filter(d => d.hospitalId === "puh3" && d.name === name).length, count, name);
  }
  assert.equal(new Set(entries.filter(e => e.name === "郭静萱").map(e => e.directoryDoctorId)).size, 1);
  assert.equal(data.doctors.find(d => d.name === "刘剑羽").department, "放射科");
  assert.equal(data.doctors.find(d => d.name === "崔国庆").id, "puh3-cui-guoqing");
  for (const name of ["李哲海", "袁蓉", "李志宏", "秦京京", "崔立刚", "姬涛", "范东伟"]) {
    assert.ok(data.doctors.some(d => d.name === name), name);
  }
});

test("nursing, pharmacy, technical and deceased observations are not missing physician records", () => {
  for (const name of ["浦钧宗", "高云秋", "陈吉棣", "林共周"]) {
    const entry = entries.find(e => e.name === name);
    assert.match(entry.exclusionReason, /已故/);
    assert.equal(entry.directoryDoctorId, null);
    assert.ok(!data.doctors.some(d => d.name === name));
  }
  const nursing = pilot.lists.find(l => l.department === "手术室").pages.flatMap(p => p.doctors);
  assert.equal(nursing.length, 9);
  assert.ok(nursing.every(e => e.exclusionReason && e.directoryDoctorId === null));
  const stats = planStats(coverage, data).lists.find(l => l.department === "手术室");
  assert.equal(stats.linked, 0);
  assert.equal(stats.excluded, 9);
  assert.equal(stats.remaining, 0);
  for (const name of ["田得祥", "张宝慧", "李梅君"]) {
    assert.match(data.doctors.find(d => d.name === name).profileNote, /老专家.*未核实/);
  }
  assert.match(data.doctors.find(d => d.name === "沈丽").profileNote, /2001年11月退休/);
  assert.ok(!data.doctors.some(d => d.name === "陈亚平"));
});

test("grouped dentistry biographies retain per-person sources and unresolved spelling/title conflicts", () => {
  const doctors = data.doctors.filter(d => d.hospitalId === "puh3" && d.department === "口腔科");
  assert.equal(doctors.length, 28);
  const list = pilot.lists.find(l => l.department === "口腔科");
  const rows = list.pages.flatMap(p => p.doctors);
  assert.equal(rows.length, 30);
  for (const name of ["张玉萍", "白艳杰"]) {
    assert.ok(rows.find(e => e.name === name).reviewNote);
    assert.ok(!doctors.some(d => d.name === name));
  }
  for (const name of ["周蕾", "王晓婧"]) {
    assert.equal(doctors.find(d => d.name === name).title, "职称未公开");
  }
  const wang = doctors.find(d => d.name === "王函");
  const source = data.sources.find(s => s.id === wang.profileSourceId);
  assert.equal(source.url, "https://www.puh3.net.cn/kqk/info/1512/1286.htm");
  assert.match(wang.experience.join(""), /2015年.*北京大学口腔医学院/);
  assert.match(doctors.find(d => d.name === "万蒙").profileNote, /博士.*硕士/);
});

test("new hospital-profile emails belong only to Zhang Zhe and Sun Yang", () => {
  for (const [name, department, email] of [
    ["张喆", "心脏外科", "zhangzhe@bjmu.edu.cn"],
    ["孙洋", "超声医学科", "xiaoyang6377@126.com"],
  ]) {
    const owners = data.doctors.filter(d => d.contacts.some(c => c.value === email));
    assert.equal(owners.length, 1);
    assert.equal(owners[0].name, name);
    assert.equal(owners[0].department, department);
    const contact = owners[0].contacts.find(c => c.value === email);
    assert.equal(data.sources.find(s => s.id === contact.sourceId).kind, "hospital-profile");
    assert.match(contact.identityNote, /未测试收信/);
  }
  const historicalSources = new Set(data.sources.slice(0, 1093).map(s => s.id));
  assert.equal(added.filter(d => d.contacts.some(c => historicalSources.has(c.sourceId))).length, 2);
  assert.ok(!data.doctors.find(d => d.name === "张哲").contacts.some(c => c.value === "zhangzhe@bjmu.edu.cn"));
});

test("summaries retain factual years, flag limited material and omit personal or promotional details", () => {
  for (const doctor of added) {
    assert.equal(doctor.hospitalId, "puh3");
    assert.ok(doctor.evidence.some(e => e.fields.includes("experience")));
    assert.match(doctor.profileNote, /原页/);
    assert.doesNotMatch(doctor.experience.join(""), /出生|党派|党员|籍贯|汉族|手机|传真|成功率|治愈率|最好|PMID|doi:/);
    if (doctor.experience.join("").length < 90) assert.match(doctor.profileNote, /履历有限|简短/);
  }
  assert.match(data.doctors.find(d => d.name === "孙超").experience.join(""), /1995-2000/);
  assert.equal(data.doctors.find(d => d.name === "荣美玉").title, "主治医师");
  assert.match(data.doctors.find(d => d.name === "马桂文").profileNote, /特约专家/);
  assert.ok(filterDoctors(data, { query: "北医三院 超声" }).some(d => d.name === "孙洋"));
});

test("audit evidence and exclusion annotations reject malformed or contradictory states", () => {
  for (const mutate of [
    p => { p.departments[0].audit.status = "complete"; },
    p => { p.departments[0].audit.urls = []; },
    p => { p.departments[0].audit.urls = ["javascript:alert(1)"]; },
    p => { p.departments[0].audit.checkedAt = "2026-10-10"; },
    p => { p.departments[0].audit.note = ""; },
    p => { p.departments[0].audit.status = "no-public-roster"; },
    p => { p.departments = {}; },
    p => { p.lists[0].pages[0].doctors[0].exclusionReason = "Not eligible"; },
    p => { p.lists[0].pages[0].doctors[0].reviewNote = "Unresolved"; },
    p => {
      const entry = p.lists.flatMap(l => l.pages.flatMap(page => page.doctors)).find(e => e.exclusionReason);
      entry.reviewNote = "Cannot also be pending";
    },
  ]) {
    const broken = structuredClone(coverage);
    mutate(broken.pilots.find(p => p.hospitalId === "puh3"));
    assert.ok(validateCoverage(broken, data, now).length);
  }
});
