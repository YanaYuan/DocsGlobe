import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { coverageStats, planStats, validateCoverage } from "../public/coverage.mjs";

const directory = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const data = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const now = new Date("2026-10-09T23:59:59Z");
const errors = value => validateCoverage(value, directory, now).join("\n");

test("partial baseline and pilot counts are separate from published doctor counts", () => {
  assert.deepEqual(validateCoverage(data, directory, now), []);
  assert.deepEqual(coverageStats(data), {
    baselineRecords: 45, departmentEntries: 95, listedRecords: 1050, linkedRecords: 981,
    excludedRecords: 54, pendingRecords: 15,
  });
  assert.equal(directory.doctors.length, 971);
  assert.equal(data.citywideHospitalTotal, null);
  assert.equal(data.baseline.source.publishedAt, "2026-09-10");
  assert.deepEqual(data.pilots.map(p => p.departments.length), [48, 47]);
  assert.deepEqual(data.pilots.map(p => p.rosterComplete), [false, false]);
});

test("sports snapshot preserves all three expert pages and distinguishes pending scope from published doctors", () => {
  const list = data.pilots[1].lists.find(l => l.department === "运动医学科");
  assert.deepEqual(list.pages.map(p => p.doctors.length), [20, 20, 2, 8]);
  assert.equal(list.declaredDoctorCount, 42);
  assert.equal(list.declaredPageCount, null);
  const entries = list.pages.slice(0, 3).flatMap(p => p.doctors);
  assert.equal(entries.filter(e => e.directoryDoctorId).length, 41);
  assert.equal(entries.find(e => e.name === "崔国庆").directoryDoctorId, "puh3-cui-guoqing");
  assert.equal(entries.find(e => e.name === "常翠青").directoryDoctorId, null);
  assert.ok(list.pages.slice(1, 3).flatMap(p => p.doctors).every(e => e.directoryDoctorId !== null));
  assert.match(list.note, /研究员.*暂不入/);
  assert.match(list.note, /老专家介绍/);
});

test("plan progress is data-derived, bounded at the milestone, and never a citywide percentage", () => {
  const stats = planStats(data, directory);
  assert.deepEqual(stats.milestone, { current: 971, total: 100, remaining: 0, percent: 100 });
  assert.deepEqual(stats.entries, { current: 48, total: 95, remaining: 47, percent: 51 });
  assert.deepEqual(stats.email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.deepEqual(stats.lists.slice(0, 6).map(l => [l.current, l.total, l.remaining]),
    [[59,59,0],[12,13,1],[48,50,2],[7,7,0],[12,13,1],[29,29,0]]);
  for (const count of [0, 99, 100]) {
    const model = planStats(data, { ...directory, doctors: directory.doctors.slice(0, count) });
    assert.equal(model.milestone.percent, count);
    assert.equal(model.milestone.remaining, 100 - count);
    if (count === 0) assert.equal(model.email.percent, null);
  }
  const empty = planStats({ ...data, pilots: [] }, directory);
  assert.deepEqual(empty.entries, { current: 0, total: 0, remaining: 0, percent: null });
  assert.equal(data.citywideHospitalTotal, null);
});

test("work records preserve observed timestamps and reject impossible elapsed time or counts", () => {
  const log = data.workLog[0];
  assert.equal(log.doctorCountAfter - log.doctorCountBefore, 18);
  assert.equal(Date.parse(log.completedAt) - Date.parse(log.startedAt), 547388);
  assert.match(log.note, /未包含.*回归测试/);
  for (const mutate of [
    l => { l.completedAt = l.startedAt; },
    l => { l.startedAt = "2026-02-30T08:00:00.000Z"; },
    l => { l.completedAt = "2026-10-10T09:00:00.000Z"; },
    l => { l.doctorCountAfter = directory.doctors.length + 1; },
    l => { l.doctorCountBefore = -1; },
    l => { l.note = ""; },
  ]) {
    const broken = structuredClone(data);
    mutate(broken.workLog[0]);
    assert.match(errors(broken), /工作记录/);
  }
  const broken = structuredClone(data);
  broken.workLog.push(structuredClone(broken.workLog[0]));
  assert.match(errors(broken), /工作记录 重复/);
});

test("government record codes, campuses and four established hospitals stay distinct", () => {
  const records = data.baseline.records;
  assert.equal(new Set(records.map(r => r.insuranceCode)).size, 45);
  assert.deepEqual(records.filter(r => r.directoryHospitalId).map(r => r.directoryHospitalId).sort(),
    ["pkufh", "pkuph", "puh3", "pumch"]);
  assert.ok(records.find(r => r.insuranceCode === "04151001").name.includes("广安门"));
  assert.ok(records.find(r => r.insuranceCode === "24151001").name.includes("南区"));
  const broken = structuredClone(data);
  broken.baseline.records.push(structuredClone(broken.baseline.records[0]));
  broken.baseline.records[1].insuranceCode = 1110002;
  broken.baseline.records[2].insuranceDistrict = "河北省";
  assert.match(errors(broken), /医保编码 重复/);
  assert.match(errors(broken), /八位字符串/);
  assert.match(errors(broken), /医保区划无效/);
});

test("newly enriched cardiology candidates are linked to published profiles and leave the pending queue", () => {
  const entries = data.pilots[0].lists[0].pages.flatMap(page => page.doctors);
  const additions = directory.doctors.slice(15, 28);
  assert.equal(additions.length, 13);
  for (const doctor of additions) {
    const entry = entries.find(item => item.directoryDoctorId === doctor.id);
    assert.equal(entry?.name, doctor.name);
    assert.equal(entry.profileUrl, directory.sources.find(s => s.id === doctor.profileSourceId).url);
  }
  assert.equal(entries.filter(entry => entry.directoryDoctorId === null).length, 0);
});

test("every doctor in the 59-person cardiology snapshot maps to a matching published profile", () => {
  const entries = data.pilots[0].lists[0].pages.flatMap(page => page.doctors);
  assert.equal(entries.length, 59);
  assert.equal(new Set(entries.map(e => e.directoryDoctorId)).size, 59);
  for (const entry of entries) {
    const doctor = directory.doctors.find(d => d.id === entry.directoryDoctorId);
    assert.ok(doctor, entry.name);
    assert.equal(doctor.name, entry.name);
    assert.equal(doctor.department, "心内科");
    const profileUrl = directory.sources.find(s => s.id === doctor.profileSourceId).url;
    assert.equal(profileUrl.replace("https://www.pumch.cn/department_ims/doctor/detail/",
      "https://www.pumch.cn/detail/"), entry.profileUrl);
  }
  assert.equal(data.pilots[0].rosterComplete, false);
  assert.equal(data.citywideHospitalTotal, null);
});

test("cardiology preserves six pages and all 59 listed records including junior physicians", () => {
  const list = data.pilots[0].lists[0];
  assert.equal(list.status, "captured");
  assert.deepEqual(list.pages.map(p => p.doctors.length), [10, 10, 10, 10, 10, 9]);
  assert.equal(list.declaredDoctorCount, 59);
  assert.equal(list.declaredPageCount, 6);
  const junior = list.pages[5].doctors.find(d => d.name === "张志宇");
  assert.equal(junior.profileUrl, "https://www.pumch.cn/detail/44242.html");
  assert.equal(junior.directoryDoctorId, "pumch-zhang-zhiyu");
  for (const mutate of [
    d => d.pilots[0].lists[0].pages.pop(),
    d => d.pilots[0].lists[0].pages[0].doctors.pop(),
    d => d.pilots[0].lists[0].declaredDoctorCount++,
  ]) {
    const broken = structuredClone(data);
    mutate(broken);
    assert.match(errors(broken), /声明人数和分页数一致/);
  }
});

test("rehabilitation keeps conflicting headcounts and deduplicates supplementary official lists", () => {
  const list = data.pilots[1].lists[0];
  assert.equal(list.status, "needs-review");
  assert.equal(list.declaredDoctorCount, 17);
  assert.equal(list.declaredPageCount, null);
  assert.equal(list.pages[0].doctors.length, 10);
  assert.ok(list.pages[0].doctors.every(d => d.profileUrl === null));
  assert.deepEqual(list.pages.map(p => p.doctors.length), [10, 2, 1]);
  assert.match(list.note, /共20人/);
  assert.match(list.note, /不是连续分页/);
  const entries = list.pages.flatMap(p => p.doctors);
  assert.equal(new Set(entries.map(d => d.name)).size, 13);
  assert.equal(entries.filter(d => d.directoryDoctorId).length, 12);
  assert.deepEqual(entries.filter(d => d.directoryDoctorId === null).map(d => d.name), ["陈亚平"]);
  assert.match(list.note, /陈亚平.*退休.*暂不入目录/);
  for (const entry of list.pages[0].doctors) {
    const doctor = directory.doctors.find(d => d.id === entry.directoryDoctorId);
    assert.ok(doctor, entry.name);
    assert.equal(doctor.name, entry.name);
    assert.equal(doctor.department, "康复医学科");
  }
  for (const name of ["邢华医", "原广提"]) {
    assert.ok(entries.find(d => d.name === name).directoryDoctorId);
  }
  assert.equal(data.pilots[1].rosterComplete, false);
  const broken = structuredClone(data);
  broken.pilots[1].lists[0].status = "captured";
  assert.match(errors(broken), /声明人数和分页数一致/);
});

test("unknown denominators and pending authorization cannot silently become verified coverage", () => {
  const broken = structuredClone(data);
  broken.citywideHospitalTotal = 45;
  broken.coverage = "complete";
  broken.rightsStatus = "authorized";
  broken.baseline.gradeVerification = "regulator-verified";
  broken.pilots[0].rosterComplete = true;
  const result = errors(broken);
  for (const pattern of [/总数必须保持未知/, /已获批量使用授权/, /卫健委等级核验/, /不得声称已覆盖全院/]) {
    assert.match(result, pattern);
  }
});

test("cross-file identity links require matching names and hospitals", () => {
  const broken = structuredClone(data);
  broken.baseline.records[4].directoryHospitalId = "puh3";
  broken.pilots[0].lists[0].pages[0].doctors[0].directoryDoctorId = "puh3-qiao-jie";
  broken.pilots[1].hospitalId = "missing";
  assert.match(errors(broken), /机构名称与关联医院不一致/);
  assert.match(errors(broken), /姓名或医院不一致/);
  assert.match(errors(broken), /试点医院必须关联/);
});

test("all navigable surfaces reject unsafe source URLs", () => {
  for (const mutate of [
    d => d.baseline.source.url = "javascript:alert(1)",
    d => d.accessIssues[0].url = "data:text/html,test",
    d => d.pilots[0].indexUrl = "http://example.com",
    d => d.pilots[0].departments[0].url = "javascript:alert(1)",
    d => d.pilots[0].lists[0].pages[0].url = "data:text/html,test",
    d => d.pilots[0].lists[0].pages[0].doctors[0].profileUrl = "javascript:alert(1)",
  ]) {
    const broken = structuredClone(data);
    mutate(broken);
    assert.match(errors(broken), /链接|入口/);
  }
});

test("dates reject impossible, future and snapshot-inconsistent values", () => {
  for (const date of ["2026-02-30", "2026-10-10", "yesterday", null]) {
    const broken = structuredClone(data);
    broken.baseline.source.checkedAt = date;
    assert.match(errors(broken), /日期无效/);
  }
  const broken = structuredClone(data);
  broken.updatedAt = "2026-10-07";
  assert.match(errors(broken), /日期无效/);
  broken.baseline.source.publishedAt = "2026-10-09";
  assert.match(errors(broken), /基准来源日期无效/);
});

test("duplicate pages, profiles and department entries are rejected", () => {
  const broken = structuredClone(data);
  broken.pilots[0].departments.push(structuredClone(broken.pilots[0].departments[0]));
  broken.pilots[0].lists[0].pages.push(structuredClone(broken.pilots[0].lists[0].pages[0]));
  assert.match(errors(broken), /科室入口链接 重复/);
  assert.match(errors(broken), /名录分页 重复/);
  assert.match(errors(broken), /个人介绍链接 重复/);
});

test("malformed nested data and unsupported claims produce explicit errors", () => {
  for (const value of [null, [], {}, { schemaVersion: 1 }]) assert.ok(validateCoverage(value, directory, now).length);
  for (const mutate of [
    d => d.baseline.records = [null],
    d => d.accessIssues = [null],
    d => d.pilots = [null],
    d => d.pilots[0].departments = null,
    d => d.pilots[0].lists[0].pages = [null],
    d => d.pilots[0].lists[0].pages[0].doctors = [null],
    d => d.pilots[0].lists[0].pages[0].doctors[0].email = "unverified@example.org",
  ]) {
    const broken = structuredClone(data);
    mutate(broken);
    assert.ok(errors(broken));
  }
  assert.match(validateCoverage(data, null, now).join("\n"), /有效医生目录/);
});
