import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { filterDoctors } from "../public/directory.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const added = data.doctors.slice(141, 170);
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const official = [
  ["叶剑飞", "1551", "副主任医师、副教授"], ["邓绍晖", "4701", "副主任医师"],
  ["张哲", "1601", "主治医师、研究员"], ["邱敏", "1561", "副主任医师"],
  ["刘磊", "1521", "主任医师"], ["卢剑", "1481", "主任医师、二级教授"],
  ["张洪宪", "1431", "主任医师"], ["田雨", "4041", "副主任医师"],
  ["赵磊", "1501", "主任医师"], ["杨文质", "1001", "主任医师"],
  ["陈忠新", "1031", "主任医师、教授"], ["马潞林", "1051", "主任医师"],
  ["张树栋", "1281", "主任医师、教授"], ["黄毅", "1071", "主任医师、二级教授"],
  ["洪锴", "1321", "主任医师"], ["庄申榕", "1441", "主任医师"],
  ["肖春雷", "1451", "主任医师"], ["侯小飞", "1461", "主任医师"],
  ["王国良", "1471", "主任医师"], ["田晓军", "3791", "主任医师、副教授"],
  ["张帆", "1591", "副主任医师"], ["刘可", "1531", "副主任医师"],
  ["赵连明", "1641", "副主任医师"], ["蔡涛", "1631", "副主任医师"],
  ["刘余庆", "1511", "主任医师、副教授"], ["罗康平", "1651", "副主任医师"],
  ["林浩成", "1621", "副主任医师、副研究员"], ["刘茁", "1611", "副主任医师"],
  ["唐文豪", "1571", "主任医师"],
];

test("urology preserves all 141 previous profiles and 248 sources without changing contacts", () => {
  const sourceIds = new Set(data.sources.slice(0, 248).map(s => s.id));
  const historical = data.doctors.slice(0, 141).map(d => ({
    ...d,
    contacts: d.contacts.filter(c => sourceIds.has(c.sourceId)),
    evidence: d.evidence.filter(e => sourceIds.has(e.sourceId)),
  }));
  assert.equal(digest(historical), "4846421685acecba36da6be169edba62fa14b77a30834ebf712514c6774163de");
  assert.equal(digest(data.sources.slice(0, 248)), "7c8eec649104a43d0f3c6daa93ba055292cfada85cc0e060dbb6725a5d5e21d2");
  assert.equal(historical.filter(d => !d.contacts.length).length, 43);
});

test("29 urology profiles have exact individual official evidence and two substantive paragraphs", () => {
  assert.deepEqual(added.map(d => d.name), official.map(([name]) => name));
  for (const [name, page, title] of official) {
    const doctor = added.find(d => d.name === name);
    assert.equal(doctor.hospitalId, "puh3");
    assert.equal(doctor.department, "泌尿外科");
    assert.equal(doctor.title, title);
    assert.equal(doctor.experience.length, 2);
    assert.ok(doctor.experience.join("").length >= 150, name);
    const source = data.sources.find(s => s.id === doctor.profileSourceId);
    assert.equal(source.url, `https://www.puh3.net.cn/mnwk/info/1004/${page}.htm`);
    assert.equal(source.accessedAt, "2026-10-09");
    assert.equal(source.accessMethod, "browser");
    assert.ok(doctor.evidence.some(e => e.sourceId === source.id &&
      ["name", "hospitalId", "department", "title", "focusAreas", "experience"].every(f => e.fields.includes(f))));
    assert.equal(doctor.practiceStatus, "not-independently-verified");
    assert.equal(doctor.reviewStatus, "not-collected");
  }
  assert.equal(filterDoctors(data, { hospitalId: "puh3", department: "泌尿外科" }).length, 29);
  assert.ok(filterDoctors(data, { query: "北医三院 男性不育" }).some(d => d.name === "洪锴"));
});

test("urology captures both expert pages but does not equate 29 listings with 42 staff physicians", () => {
  const pilot = coverage.pilots.find(p => p.hospitalId === "puh3");
  const list = pilot.lists.find(l => l.department === "泌尿外科");
  assert.equal(list.status, "captured");
  assert.equal(list.declaredDoctorCount, 29);
  assert.equal(list.declaredPageCount, 2);
  assert.deepEqual(list.pages.map(p => p.url), [
    "https://www.puh3.net.cn/mnwk/zjjs.htm", "https://www.puh3.net.cn/mnwk/zjjs/1.htm",
  ]);
  assert.deepEqual(list.pages.map(p => p.doctors.length), [20, 9]);
  assert.deepEqual(list.pages.flatMap(p => p.doctors.map(d => d.directoryDoctorId)), added.map(d => d.id));
  assert.match(list.note, /42.*在编医师/);
  assert.match(list.note, /退休/);
  assert.equal(pilot.rosterComplete, false);
  assert.equal(coverage.citywideHospitalTotal, null);
});

test("retirement, conflicting titles, research roles and uncertain campuses stay explicit", () => {
  const doctor = name => added.find(d => d.name === name);
  assert.match(doctor("杨文质").profileNote, /退休.*不代表当前在岗/);
  for (const name of ["刘磊", "王国良"]) {
    assert.equal(doctor(name).title, "主任医师");
    assert.match(doctor(name).profileNote, /副主任医师至今/);
  }
  assert.equal(doctor("张哲").title, "主治医师、研究员");
  assert.equal(doctor("林浩成").title, "副主任医师、副研究员");
  assert.match(doctor("马潞林").profileNote, /截止于2022年10月/);
  assert.match(doctor("刘茁").profileNote, /当前坐诊院区/);
  assert.match(doctor("蔡涛").profileNote, /资料缺口.*不推定为博士/);
  assert.match(doctor("罗康平").profileNote, /未把.*患者评价/);
});

test("23 urology emails retain exact ownership, representation, case and historical publication years", () => {
  const expected = [
    ["叶剑飞", "jamesyeh@126.com", "PMC13186160", 2026],
    ["邓绍晖", "Dengsh@bjmu.edu.cn", "42618819", 2026],
    ["张哲", "zhezhang@bjmu.edu.cn", "PMC12942501", 2026],
    ["邱敏", "qiuminpku@126.com", "41645129", 2026],
    ["刘磊", "liuleidoc@sina.com", "PMC12309041", 2025],
    ["卢剑", "lujian@bjmu.edu.cn", "42518145", 2026],
    ["张洪宪", "zwl2006@163.com", "PMC13310737", 2026],
    ["田雨", "tianyu@bjmu.edu.cn", "PMC8310681", 2022],
    ["马潞林", "malulinpku@163.com", "PMC12983820", 2026],
    ["张树栋", "zhangshudong@bjmu.edu.cn", "PMC13371696", 2026],
    ["黄毅", "pku_huang@163.com", "37635216", 2023],
    ["洪锴", "kenhong99@bjmu.edu.cn", "PMC13561745", 2026],
    ["肖春雷", "xiaochunleixcl@163.com", "PMC12752386", 2025],
    ["侯小飞", "houxf12@163.com", "PMC13472793", 2026],
    ["王国良", "wangguoliang@medmail.com.cn", "42247960", 2026],
    ["田晓军", "13511029003@163.com", "PMC12398379", 2025],
    ["张帆", "zhangfan@bjmu.edu.cn", "39794743", 2025],
    ["刘可", "bysybph@163.com", "PMC13263885", 2026],
    ["赵连明", "doctorzhaolm@163.com", "38036241", 2024],
    ["刘余庆", "pku3uro@aliyun.com", "PMC4834003", 2015],
    ["林浩成", "haochenglin292@163.com", "PMC12276673", 2025],
    ["刘茁", "liuzhuo1990@yeah.net", "41761186", 2026],
    ["唐文豪", "3279799939@qq.com", "PMC10006001", 2023],
  ];
  assert.equal(added.filter(d => d.contacts.length).length, 23);
  assert.equal(data.sources.slice(248, 300).length, 52);
  for (const [name, value, identifier, year] of expected) {
    const owners = data.doctors.filter(d => d.contacts.some(c => c.value === value));
    assert.deepEqual(owners.map(d => d.name), [name]);
    const contact = owners[0].contacts[0];
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.ok(source.url.includes(identifier));
    assert.equal(source.url.includes("fullTextXML"), identifier.startsWith("PMC"));
    assert.equal(source.publishedYear, year);
    assert.equal(source.kind, "journal-article");
    assert.equal(source.accessedAt, "2026-10-09");
    assert.equal(contact.purpose, "academic");
    assert.match(contact.identityNote, /北京大学第三医院/);
    assert.match(contact.identityNote, /未测试收信/);
    assert.ok(owners[0].evidence.some(e => e.sourceId === source.id && e.fields.includes("contacts")));
  }
  assert.match(added.find(d => d.name === "田雨").contacts[0].identityNote, /2022年卷期.*2021年/);
  assert.match(added.find(d => d.name === "刘余庆").contacts[0].identityNote, /2015年历史/);
  for (const name of ["刘可", "刘余庆"]) {
    assert.match(added.find(d => d.name === name).contacts[0].identityNote, /不宣称个人独占/);
  }
});

test("six unverified urology contacts remain empty and namesake or coauthor emails stay excluded", () => {
  assert.deepEqual(added.filter(d => !d.contacts.length).map(d => d.name),
    ["赵磊", "杨文质", "陈忠新", "庄申榕", "蔡涛", "罗康平"]);
  const accepted = added.flatMap(d => d.contacts.map(c => c.value));
  for (const rejected of ["zhangzhe@bjmu.edu.cn", "0663175510@pku.edu.cn",
    "2111110464@bjmu.edu.cn", "liuke@ccmu.edu.cn", "Tianyu3265811@sina.com",
    "jiangtao_sun@buaa.edu.cn", "xqy1993@pku.edu.cn", "bysy@bjmu.edu.cn"]) {
    assert.ok(!accepted.includes(rejected), rejected);
  }
  const log = coverage.workLog.find(l => l.id === "urology-batch-2026-10-09");
  assert.equal(log.doctorCountBefore, 141);
  assert.equal(log.doctorCountAfter, 170);
  assert.match(log.note, /未包含.*回归测试/);
});
