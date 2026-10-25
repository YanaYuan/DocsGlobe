import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeCrossfieldContacts } from "./helpers/email-crossfield.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const expected = [
  ["欧阳汉强", "骨科", "NCT04955509", "ouyanghanqiang@bjmu.edu.cn"],
  ["陈朝文", "普通外科", "NCT04310800", "ccw0070890@sina.com"],
  ["吕扬", "骨科", "NCT04663542", "lvyang42@126.com"],
  ["王圣林", "骨科", "NCT05847270", "pkuwsl@126.com"],
  ["冯学峰", "眼科", "NCT05714904", "xue168feng@sina.com"],
  ["刘晓鲁", "神经内科", "NCT01935518", "liuxiaolupku@gmail.com"],
  ["何及", "神经内科", "NCT06819358", "15801224009@163.COM"],
  ["徐伟仙", "心血管内科", "NCT04962438", "xwxbird05@163.com"],
  ["张娟", "儿科", "NCT07532421", "arbooo@126.com"],
  ["孙卓然", "骨科", "NCT05485636", "puh3_szr@163.com"],
  ["李卓夫", "骨科", "NCT04970862", "bjmulizhuofu@163.com"],
  ["万蒙", "口腔科", "NCT05924373", "wanmengpeking@126.com"],
  ["张晓盈", "风湿免疫科", "NCT07836361", "zhang_xiaoying@pku.edu.cn"],
  ["韩钦", "妇产科", "NCT07009327", "Lmlfe_lynn@126.com"],
  ["郭金竹", "皮肤科", "NCT07153666", "guojinzhu_826@163.com"],
  ["朱丹", "心血管内科", "NCT04939857", "Andrea_zhu@163.com"],
  ["王贵松", "心血管内科", "NCT04955054", "guisongwang@bjmu.edu.cn"],
  ["姜宇", "骨科", "NCT04781517", "jiangyu@bjmu.edu.cn"],
  ["王振宇", "神经外科", "NCT04957056", "wzyu502@163.com"],
  ["邹达", "骨科", "NCT04467944", "zd_puth@163.com"],
  ["俎明", "消化科", "NCT05870696", "zuming7777@qq.com"],
  ["王行雁", "普通外科", "NCT03366038", "wanghangyan111@163.com"],
  ["周思宇", "骨科", "NCT04688437", "bjmuzhousiyu@163.com"],
  ["路然", "内分泌科", "NCT05001815", "luransurf@126.com"],
  ["杜兰芳", "急诊科", "NCT05956431", "angelslovedudu@126.com"],
  ["孙艺谋", "成形外科", "NCT07849010", "sym316@126.com"],
  ["梁莉", "肿瘤化疗与放射病科", "NCT03050411", "liang.dr@163.com"],
  ["汪宇鹏", "心血管内科", "NCT04842838", "wangyp007@163.com"],
  ["孙宇", "骨科", "NCT05149404", "sunyuor@vip.sina.com"],
  ["盖晓燕", "呼吸与危重症医学科", "NCT05426720", "gxy81wfl79@163.com"],
  ["王飞", "呼吸与危重症医学科", "NCT06670872", "wangf78@139.com"],
  ["刘阳", "运动医学科", "NCT02833454", "surgeonliuyang@sina.com"],
];
const prefix = "email-alternative-";
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const doctor = (name, department) => {
  const matches = data.doctors.filter(d => d.name === name && d.department === department && d.hospitalId === "puh3");
  assert.equal(matches.length, 1, `${name} ${department}`);
  return matches[0];
};

test("alternative sources preserve all profiles, 390 prior email holders and 1336 prior sources", () => {
  const historicalSourceIds = new Set(data.sources.slice(0, 1336).map(s => s.id));
  const historical = beforeCrossfieldContacts(data).map(d => ({
    ...d,
    contacts: d.contacts.filter(c => historicalSourceIds.has(c.sourceId)),
    evidence: d.evidence.filter(e => historicalSourceIds.has(e.sourceId)),
  }));
  assert.equal(digest(historical), "ea1180c359d35c5422d4ad705e7c9f05e3acf7f4b60670b1968b5ff5112e3e94");
  assert.equal(digest(data.sources.slice(0, 1336)), "e7673ea071d2bebea6b8e4ecc53d5d6c591e7ae8cc880161a49957228f8efd2f");
  assert.equal(historical.filter(d => d.contacts.length).length, 390);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("32 exact research contacts retain name-specific registry evidence and original casing", () => {
  assert.equal(expected.length, 32);
  for (const [name, department, id, email] of expected) {
    const d = doctor(name, department);
    const sourceId = `${prefix}${id.toLowerCase()}`;
    assert.equal(d.contacts.length, 1, name);
    const contact = d.contacts[0];
    assert.equal(contact.value, email, name);
    assert.equal(contact.sourceId, sourceId);
    assert.equal(contact.type, "email");
    assert.equal(contact.purpose, "academic");
    assert.match(contact.identityNote, /字段明确列出/);
    assert.match(contact.identityNote, /未测试收信/);
    assert.match(contact.identityNote, /不保证本人管理、当前有效或接受患者诊疗咨询/);
    assert.ok(d.evidence.some(e => e.sourceId === sourceId && e.fields.join() === "contacts"));
    assert.deepEqual(data.doctors.filter(x => x.contacts.some(c => c.value.toLowerCase() === email.toLowerCase())).map(x => x.id), [d.id]);
    const source = data.sources.find(s => s.id === sourceId);
    assert.equal(source.kind, "clinical-trial-registry");
    assert.equal(source.url, `https://clinicaltrials.gov/api/v2/studies/${id}`);
    assert.equal(source.accessedAt, "2026-10-13");
    assert.equal(source.accessMethod, "web");
    assert.ok(!Object.hasOwn(source, "publishedYear"));
    assert.match(contact.identityNote, new RegExp(source.sourceUpdatedAt));
  }
});

test("site contacts and historical update dates are not confused with lead-center ownership or email freshness", () => {
  for (const [name, department] of [
    ["陈朝文", "普通外科"], ["刘晓鲁", "神经内科"], ["万蒙", "口腔科"],
    ["王贵松", "心血管内科"], ["俎明", "消化科"],
  ]) assert.match(doctor(name, department).contacts[0].identityNote, /分中心联系人/);
  assert.match(doctor("陈朝文", "普通外科").contacts[0].identityNote, /不把其他牵头单位/);
  const source = data.sources.find(s => s.id === doctor("刘晓鲁", "神经内科").contacts[0].sourceId);
  assert.equal(source.sourceUpdatedAt, "2013-09-06");
  assert.match(doctor("刘晓鲁", "神经内科").contacts[0].identityNote, /不是邮箱单独核对或首次公开日期/);
  assert.match(doctor("韩钦", "妇产科").contacts[0].identityNote, /不推断另一个为错字/);
});

test("conflicting ownership, generic institutional addresses and inferred spelling corrections are not imported", () => {
  assert.deepEqual(doctor("张英爽", "神经内科").contacts
    .filter(contact => !contact.sourceId.startsWith("email-reassess-")), []);
  const contacts = data.doctors.flatMap(d => d.contacts).filter(c => c.sourceId.startsWith(prefix));
  for (const email of ["zhangys0317@126.com", "zhouf@bjmu.edu.cn", "bysysjwk@126.com", "neurbj@126.com", "Lmlfe_lyn@126.com"]) {
    assert.ok(!contacts.some(c => c.value === email), email);
  }
  assert.match(doctor("吕扬", "骨科").contacts[0].identityNote, /zhouf@bjmu.edu.cn.*不采用/);
});

test("32 additions across 18 departments change email coverage, not doctor or roster denominators", () => {
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1563);
  assert.equal(data.sources.filter(s => s.id.startsWith(prefix)).length, 32);
  assert.equal(new Set(expected.map(([, department]) => department)).size, 18);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.equal(data.doctors.filter(d => d.hospitalId === "puh3" && d.department === "骨科" && d.contacts.length).length, 65);
});
