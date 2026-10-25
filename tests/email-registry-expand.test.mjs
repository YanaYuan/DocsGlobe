import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeCrossfieldContacts } from "./helpers/email-crossfield.mjs";
import { beforeJournal } from "./helpers/email-journal.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prefix = "email-registryexpand-";
const expected = [
  ["韩劲松", "妇产科", "Hanjinsong353@sina.com", "nct01396109"],
  ["姜亮", "骨科", "jiangliang@bjmu.edu.cn", "nct03416517"],
  ["王丽平", "神经内科", "dianer@126.com", "nct02029183"],
  ["白瑾", "心血管内科", "13810700414@126.com", "nct06516822"],
  ["刘剑羽", "放射科", "jyliubysy@163.com", "pmid30456593"],
  ["张立华", "放射科", "lihuazhang1013@126.com", "pmid35084519"],
  ["任翠", "放射科", "nanjihu_123@126.com", "pmid38001465"],
  ["袁源", "放射科", "pkuyuan1989@126.com", "pmid26002126"],
  ["邬海博", "放射科", "wuhaibo7532@sina.com", "pmid42218474"],
  ["刘颖", "放射科", "lyyulia@163.com", "pmid42613465"],
  ["曾祥柱", "放射科", "xiangzhuzeng@126.com", "pmid37216716"],
  ["杨琼", "放射科", "yangq1112@126.com", "pmid21458180"],
  ["张帆", "超声医学科", "zhangfancj@163.com", "pmid32898205"],
  ["王金锐", "超声医学科", "jinrui_wang@sina.com", "pmid25842255"],
  ["苗立英", "超声医学科", "liyingmiao@aliyun.com", "pmid32898205"],
  ["陈文", "超声医学科", "chenwen0708@bjmu.edu.cn", "pmid41254777"],
  ["谭石", "超声医学科", "tanshi@hsc.pku.edu.cn", "pmid39838315"],
  ["江凌", "超声医学科", "papayaling@163.com", "pmid36503498"],
  ["蒋洁", "超声医学科", "jiangjie_us@163.com", "pmid41272648"],
  ["王晓华", "放射科", "wxhmed@126.com", "pmc10784088"],
  ["孙彦", "超声医学科", "sunyan710@163.com", "pmc10006116"],
  ["何萍", "超声医学科", "heping198679@163.com", "pmc9773426"],
];
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const doctor = (name, department) => {
  const matches = data.doctors.filter(d => d.name === name && d.department === department && d.hospitalId === "puh3");
  assert.equal(matches.length, 1, `${name} ${department}`);
  return matches[0];
};

test("registry expansion preserves every profile, 422 prior email holders and 1368 prior sources", () => {
  const historicalSourceIds = new Set(data.sources.slice(0, 1368).map(s => s.id));
  const historical = beforeCrossfieldContacts(data).map(d => ({
    ...d, contacts: d.contacts.filter(c => historicalSourceIds.has(c.sourceId)),
    evidence: d.evidence.filter(e => historicalSourceIds.has(e.sourceId)),
  }));
  assert.equal(digest(historical), "504029ea1438d8da3a2bef438b2c0124fcdf0842555f123e7a1f779d3acd77c6");
  assert.equal(digest(data.sources.slice(0, 1368)), "8ce75e96f9436de7d0dd2feb3e49dca5a9c59f2a72e007d0c3578961d1ba8726");
  assert.equal(historical.filter(d => d.contacts.length).length, 422);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("22 exact contacts retain personal source attribution, original casing and source representation", () => {
  assert.equal(expected.length, 22);
  for (const [name, department, email, key] of expected) {
    const d = doctor(name, department);
    assert.equal(d.contacts.length, 1);
    const c = d.contacts[0];
    assert.equal(c.value, email, name);
    assert.equal(c.type, "email");
    assert.equal(c.purpose, "academic");
    assert.equal(c.sourceId, prefix + key);
    assert.match(c.identityNote, /未测试收信/);
    const s = data.sources.find(s => s.id === c.sourceId);
    assert.equal(s.accessedAt, "2026-10-13");
    assert.equal(s.accessMethod, "web");
    assert.ok(d.evidence.some(e => e.sourceId === s.id && e.fields.join() === "contacts"));
    assert.deepEqual(data.doctors.filter(x => x.contacts.some(c => c.value.toLowerCase() === email.toLowerCase())).map(x => x.id), [d.id]);
    if (key.startsWith("nct")) {
      assert.equal(s.kind, "clinical-trial-registry");
      assert.equal(s.url, `https://clinicaltrials.gov/api/v2/studies/${key.toUpperCase()}`);
      assert.match(c.identityNote, /分中心.*联系人字段/);
      assert.match(c.identityNote, /不是邮箱单独核实或首次公开日期/);
    } else {
      assert.equal(s.kind, "journal-article");
      assert.equal(s.sourceUpdatedAt, null);
      if (key.startsWith("pmid")) {
        assert.equal(new URL(s.url).searchParams.get("query"), `EXT_ID:${key.slice(4)} AND SRC:MED`);
      } else assert.ok(s.url.endsWith(`${key.toUpperCase()}/fullTextXML`));
    }
  }
});

test("same-hospital namesakes remain distinct and other-hospital or shared emails are not imported", () => {
  assert.equal(doctor("张帆", "泌尿外科").contacts[0].value, "zhangfan@bjmu.edu.cn");
  assert.equal(doctor("张帆", "老年内科").contacts[0].value, "orthohui6436@sina.com");
  assert.notEqual(doctor("张帆", "老年内科").contacts[0].value, doctor("张帆", "泌尿外科").contacts[0].value);
  assert.notEqual(doctor("张帆", "超声医学科").contacts[0].value, doctor("张帆", "老年内科").contacts[0].value);
  assert.equal(doctor("杨琼", "神经内科").contacts[0].value, "yangqiongputh@126.com");
  assert.notEqual(doctor("杨琼", "放射科").contacts[0].value, doctor("杨琼", "神经内科").contacts[0].value);
  for (const [name, department] of [
    ["沈伟伟", "超声医学科"],
    ["薛恒", "超声医学科"], ["曾妍", "康复医学科"],
  ]) assert.deepEqual(beforeJournal(data).doctors.find(item => item.id === doctor(name, department).id).contacts, []);
  assert.equal(doctor("田春艳", "放射科").contacts[0].sourceId, "email-author-pmid23287711");
  assert.equal(doctor("付颖", "超声医学科").contacts[0].sourceId, "email-author-pmid24606451");
  for (const [name, department] of [["田春艳", "放射科"], ["付颖", "超声医学科"]]) {
    assert.ok(doctor(name, department).contacts.every(contact => !contact.sourceId.startsWith(prefix)));
  }
  const contacts = data.doctors.flatMap(d => d.contacts).filter(c => c.sourceId.startsWith(prefix));
  for (const email of ["phe@pku.edu.cn", "zy7311@sohu.com", "dianen@126.com", "doctorsunwenjun@126.com", "clinicaltrials@medilinkthera.com"]) {
    assert.ok(!contacts.some(c => c.value === email), email);
  }
});

test("body-text correspondence, split correspondents and historical publication dates are explicit", () => {
  assert.match(doctor("何萍", "超声医学科").contacts[0].identityNote, /Contributor Information.*Aff1.*并非email标签/);
  assert.match(doctor("王晓华", "放射科").contacts[0].identityNote, /2023-11-24.*2024年1月.*Shufang Li.*不能互换/);
  assert.match(doctor("孙彦", "超声医学科").contacts[0].identityNote, /不把邮箱转给.*沈伟伟/);
  assert.match(doctor("韩劲松", "妇产科").contacts[0].identityNote, /牵头单位是协和/);
  assert.match(doctor("姜亮", "骨科").contacts[0].identityNote, /牵头单位是北大人民医院/);
  assert.match(doctor("袁源", "放射科").contacts[0].identityNote, /作者单位只写三院/);
  assert.equal(data.sources.find(s => s.id === prefix + "pmid21458180").publishedYear, 2011);
});

test("22 additions use 21 new sources and improve imaging coverage without changing roster dates", () => {
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1563);
  const sources = data.sources.filter(s => s.id.startsWith(prefix));
  assert.equal(sources.length, 21);
  assert.equal(sources.filter(s => s.kind === "clinical-trial-registry").length, 4);
  assert.equal(sources.filter(s => s.kind === "journal-article").length, 17);
  assert.equal(data.doctors.filter(d => d.contacts.some(c => c.sourceId === prefix + "pmid32898205")).length, 2);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  for (const [department, total, current] of [["放射科", 23, 14], ["超声医学科", 24, 17]]) {
    const doctors = data.doctors.filter(d => d.hospitalId === "puh3" && d.department === department);
    assert.equal(doctors.length, total);
    assert.equal(doctors.filter(d => d.contacts.length).length, current);
  }
});
