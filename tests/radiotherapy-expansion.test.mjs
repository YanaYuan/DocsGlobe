import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { filterDoctors } from "../public/directory.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const added = data.doctors.slice(130, 141);
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const expected = [
  ["江萍", "1121", "主任医师"], ["王皓", "1141", "主任医师、副教授"],
  ["姜玉良", "1171", "副主任医师"], ["曲昂", "1151", "主任医师"],
  ["吉喆", "1981", "副主任医师"], ["田素青", "1191", "副主任医师"],
  ["徐飞", "1201", "副主任医师"], ["姜伟娟", "1181", "主治医师"],
  ["郭福新", "1211", "主治医师"], ["陈意", "2471", "主治医师"], ["邱斌", "2521", "主治医师"],
];

test("radiotherapy preserves all 130 existing profiles, contacts and 228 sources exactly", () => {
  const sourceIds = new Set(data.sources.slice(0, 228).map(s => s.id));
  const historical = data.doctors.slice(0, 130).map(d => ({
    ...d,
    contacts: d.contacts.filter(c => sourceIds.has(c.sourceId)),
    evidence: d.evidence.filter(e => sourceIds.has(e.sourceId)),
  }));
  assert.equal(digest(historical), "bb0910a9ce65ac3bd5ecb0ae5a7c0d6b02162b438ce90f8e5de300b948e4f158");
  assert.equal(digest(data.sources.slice(0, 228)), "ede767ae808e79c16e455743fb4db4ab435c5dc5900f522a593dac25475f5cde");
  assert.equal(added.length, 11);
  assert.equal(data.sources.slice(228, 248).length, 20);
  assert.equal(data.doctors.filter(d => d.name === "王俊杰").length, 1);
});

test("all eleven new physicians have exact official identity and original factual biographies", () => {
  assert.deepEqual(added.map(d => d.name), expected.map(([name]) => name));
  for (const [name, page, title] of expected) {
    const doctor = added.find(d => d.name === name);
    assert.equal(doctor.hospitalId, "puh3");
    assert.equal(doctor.department, "肿瘤放疗科");
    assert.equal(doctor.title, title);
    const source = data.sources.find(s => s.id === doctor.profileSourceId);
    assert.equal(source.url, `https://www.puh3.net.cn/zlflk/info/1004/${page}.htm`);
    assert.equal(source.accessedAt, "2026-10-09");
    assert.equal(source.accessMethod, "browser");
    assert.ok(doctor.evidence.some(e => e.sourceId === source.id &&
      ["name", "hospitalId", "department", "title", "focusAreas", "experience"].every(f => e.fields.includes(f))));
    if (name !== "郭福新") {
      assert.equal(doctor.experience.length, 2);
      assert.ok(doctor.experience.join("").length >= 150, name);
    }
  }
  assert.equal(filterDoctors(data, { hospitalId: "puh3", department: "肿瘤放疗科" }).length, 12);
  assert.ok(filterDoctors(data, { query: "北医三院 妇科 插植" }).some(d => d.name === "曲昂"));
});

test("the full 13-entry snapshot retains the research-role gap and reuses Wang Junjie", () => {
  const pilot = coverage.pilots.find(p => p.hospitalId === "puh3");
  const list = pilot.lists.find(l => l.department === "肿瘤放疗科");
  assert.equal(list.status, "captured");
  assert.equal(list.declaredDoctorCount, 13);
  assert.equal(list.declaredPageCount, 1);
  assert.equal(list.pages.length, 1);
  assert.equal(list.pages[0].doctors.length, 13);
  assert.equal(list.pages[0].doctors.filter(d => d.directoryDoctorId).length, 12);
  assert.equal(list.pages[0].doctors.find(d => d.name === "王俊杰").directoryDoctorId, "puh3-wang-junjie");
  const researcher = list.pages[0].doctors.find(d => d.name === "杨瑞杰");
  assert.equal(researcher.directoryDoctorId, null);
  assert.equal(researcher.profileUrl, "https://www.puh3.net.cn/zlflk/info/1004/1161.htm");
  assert.ok(!data.doctors.some(d => d.name === "杨瑞杰"));
  assert.match(list.note, /74.*不能.*医生人数/);
  assert.equal(pilot.rosterComplete, false);
  assert.equal(coverage.citywideHospitalTotal, null);
});

test("all ten original radiotherapy emails retain exact source, publication year and personal attribution", () => {
  const originalSourceIds = new Set(data.sources.slice(0, 248).map(s => s.id));
  const emails = [
    ["江萍", "drjiangping@qq.com", "PMC13581712", 2026],
    ["王皓", "wanghaobysy@bjmu.edu.cn", "PMC13477522", 2026],
    ["姜玉良", "yuliangjiang@bjmu.edu.cn", "PMC12663741", 2025],
    ["曲昂", "0463180457@bjmu.edu.cn", "35636572", 2022],
    ["吉喆", "jizhe@bjmu.edu.cn", "PMC11811234", 2025],
    ["田素青", "suqing.tian@bjmu.edu.cn", "39090291", 2024],
    ["徐飞", "xuf_puth@163.com", "PMC8467951", 2021],
    ["郭福新", "guofuxinpku@bjmu.edu.cn", "35636572", 2022],
    ["陈意", "yichen@bjmu.edu.cn", "PMC13563455", 2026],
    ["邱斌", "qiubin@pku.edu.cn", "PMC8304109", 2021],
  ];
  assert.equal(added.filter(d => d.contacts.some(c => originalSourceIds.has(c.sourceId))).length, 10);
  for (const [name, value, identifier, year] of emails) {
    const owners = data.doctors.filter(d => d.contacts.some(c => c.value === value));
    assert.deepEqual(owners.map(d => d.name), [name]);
    const contact = owners[0].contacts[0];
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.ok(source.url.includes(identifier));
    assert.equal(source.publishedYear, year);
    assert.equal(source.kind, "journal-article");
    assert.equal(source.accessedAt, "2026-10-09");
    assert.match(contact.identityNote, /北京大学第三医院/);
    assert.match(contact.identityNote, /未测试收信/);
    assert.ok(owners[0].evidence.some(e => e.sourceId === source.id && e.fields.includes("contacts")));
  }
  const qu = added.find(d => d.name === "曲昂").contacts[0];
  const guo = added.find(d => d.name === "郭福新").contacts[0];
  assert.equal(qu.sourceId, guo.sourceId);
  assert.notEqual(qu.value, guo.value);
  assert.match(added.find(d => d.name === "徐飞").contacts[0].identityNote, /F\.X\./);
  assert.match(added.find(d => d.name === "邱斌").contacts[0].identityNote, /B\.Q\./);
  assert.deepEqual(added.find(d => d.name === "姜伟娟").contacts.filter(c => originalSourceIds.has(c.sourceId)), []);
  assert.ok(!added.some(d => d.contacts.some(c => ["junjiewang@pku.edu.cn", "bysy@bjmu.edu.cn"].includes(c.value))));
});

test("sparse and conflicting official biographies remain explicit instead of invented", () => {
  const guo = added.find(d => d.name === "郭福新");
  assert.equal(guo.experience.length, 1);
  assert.match(guo.profileNote, /资料缺口.*科研栏目为空/);
  assert.match(added.find(d => d.name === "江萍").profileNote, /主任医师.*副主任医师/);
  assert.match(added.find(d => d.name === "徐飞").profileNote, /第三军医.*第四军医.*冲突/);
  assert.match(added.find(d => d.name === "陈意").profileNote, /截至2023/);
  assert.match(added.find(d => d.name === "邱斌").profileNote, /未核实当前排班/);
  assert.match(added.find(d => d.name === "曲昂").experience.join(""), /2025年8月/);
  const log = coverage.workLog.find(l => l.id === "radiotherapy-batch-2026-10-09");
  assert.equal(log.doctorCountBefore, 130);
  assert.equal(log.doctorCountAfter, 141);
  assert.match(log.note, /未包含.*回归测试/);
});
