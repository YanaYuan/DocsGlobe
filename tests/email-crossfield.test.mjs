import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeCrossfieldContacts } from "./helpers/email-crossfield.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prefix = "email-crossfield-";
const reused = "email-combined-pmid41610669";
const groups = [
  ["肾脏内科", 16, 13, [
    ["范敏华", "fanminhua1964@163.com", "pmc3507668"],
  ]],
  ["急诊科", 16, 8, [
    ["刘桂花", "zhouwlin@163.com", "pmid36880239"],
    ["李姝", "lishu_lishu@bjmu.edu.cn", "pmid39112958"],
  ]],
  ["肿瘤化疗与放射病科", 14, 7, [
    ["曹宝山", "caobaoshan0711@aliyun.com", "pmid40962011"],
    ["王墨培", "wangmopei@bjmu.edu.cn", "pmid36271947"],
    ["顾阳春", "pku90201529@126.com", "pmid41663623"],
    ["马力文", "malw678@126.com", "pmc11016390"],
    ["张照辉", "zhaobj429@sina.com", "pmc8590943"],
  ]],
  ["心脏外科", 13, 6, [
    ["万峰", "drfengwan@hotmail.com", "pmid31915074"],
    ["赵鸿", "cardiohong@qq.com", "pmid33234215"],
    ["吴松", "drwusong@163.com", "pmid33234215"],
    ["张鲁锋", "zhang.lufeng@aliyun.com", "pmid28711647"],
  ]],
  ["神经外科", 14, 10, [
    ["王大明", "damingwangbysy@gmail.com", reused],
    ["王涛", "wangtao@bjmu.edu.cn", "pmid40159523"],
    ["陈晓东", "chenxd1111@sohu.com", reused],
    ["韩芸峰", "hyfln@126.com", "pmid41144058"],
    ["尹晓亮", "yinxiaoliang@bjmu.edu.cn", reused],
    ["谢京城", "tsejc@bjmu.edu.cn", "pmc9195413"],
    ["林国中", "guozhonglin@bjmu.edu.cn", "pmc9599232"],
  ]],
  ["职业病科", 8, 4, [
    ["赵金垣", "zhaojinyuan@sina.com", "pmid26920056"],
    ["李树强", "shuqiangli@263.net", "pmid39757148"],
    ["张雁林", "zhangyanlin@bjmu.edu.cn", "pmid39757148"],
    ["赵赞梅", "zzmpla@163.com", "pmc5117496"],
  ]],
  ["儿科", 20, 13, [
    ["刘慧", "adelebjmu@126.com", "pmc7403084"],
    ["汤亚南", "ran903904@163.com", "zgddek-2020-5-523"],
  ]],
  ["检验科", 4, 4, [
    ["张捷", "zhangjiebjmu@163.com", "pmid29545183"],
    ["王天成", "tcwang@bjmu.edu.cn", "pmid38286181"],
    ["乔蕊", "qiaorui@bjmu.edu.cn", "pmid41731477"],
  ]],
];
const expected = groups.flatMap(([department, , , rows]) => rows.map(([name, email, key]) => ({
  name, department, email, sourceId: key === reused ? key : prefix + key,
})));
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const doctor = (name, department) => {
  const matches = data.doctors.filter(d => d.hospitalId === "puh3" && d.name === name && d.department === department);
  assert.equal(matches.length, 1, `${name} ${department}`);
  return matches[0];
};
const contact = (name, department) => doctor(name, department).contacts[0];

test("crossfield batch preserves every profile, all 482 prior contacts and 1426 prior sources", () => {
  const historical = beforeCrossfieldContacts(data);
  assert.equal(digest(historical), "3649190e8ecbda8c335f7d20b023be8212d1053895d306b10b784f7d3012313b");
  assert.equal(digest(data.sources.slice(0, 1426)), "cfc7712647b449f2c45f3f524febf4e5b0a4e3b517ef00313e297657965e4301");
  assert.equal(historical.filter(d => d.contacts.length).length, 482);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("28 exact public emails have independent ownership and contact-only evidence", () => {
  assert.equal(expected.length, 28);
  for (const { name, department, email, sourceId } of expected) {
    const d = doctor(name, department);
    assert.equal(d.contacts.length, 1, name);
    const c = d.contacts[0];
    assert.equal(c.value, email);
    assert.equal(c.sourceId, sourceId);
    assert.equal(c.purpose, "academic");
    assert.equal(c.type, "email");
    assert.match(c.identityNote, /2026-10-13核对/);
    assert.match(c.identityNote, /未测试收信/);
    assert.deepEqual(d.evidence.at(-1), { sourceId, fields: ["contacts"] });
    assert.deepEqual(data.doctors.filter(x => x.contacts.some(c => c.value.toLowerCase() === email.toLowerCase())).map(x => x.id), [d.id]);
    const source = data.sources.find(s => s.id === sourceId);
    assert.equal(source.kind, "journal-article");
    assert.equal(source.accessMethod, "web");
    assert.equal(source.accessedAt, sourceId === reused ? "2026-10-10" : "2026-10-13");
    assert.equal(source.sourceUpdatedAt, null);
  }
});

test("Chinese biographies, named correspondence and individual contributor nodes are distinguished", () => {
  assert.match(contact("刘慧", "儿科").identityNote, /Biography明确.*刘慧.*并非.*童笑梅/);
  assert.match(contact("汤亚南", "儿科").identityNote, /作者简介明确.*汤亚南.*TANG Ya-Nan.*XML请求500/);
  assert.equal(data.sources.find(s => s.id === contact("汤亚南", "儿科").sourceId).url,
    "https://www.zgddek.com/CN/abstract/html/2020-5-523.htm");
  assert.equal(data.sources.find(s => s.id === contact("刘慧", "儿科").sourceId).url,
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC7403084/");
  assert.match(contact("范敏华", "肾脏内科").identityNote, /个人contrib.*aff12/);
  assert.match(contact("张照辉", "肿瘤化疗与放射病科").identityNote, /an0001.*纯文本/);
  assert.match(contact("谢京城", "神经外科").identityNote, /cor1.*仅有一个共同作者单位/);
  assert.match(contact("林国中", "神经外科").identityNote, /唯一缩写G\.L\..*C\.Y\./);
  assert.match(contact("王涛", "神经外科").identityNote, /42716573.*共享字段.*独立记录/);
  assert.match(contact("刘桂花", "急诊科").identityNote, /24342342.*Gui-Hua Liu/);
});

test("old shared article is reused without changing old contacts or transferring addresses", () => {
  const users = data.doctors.filter(d => d.contacts.some(c => c.sourceId === reused));
  assert.deepEqual(users.map(d => d.name).sort(), ["尹晓亮", "李小刚", "王大明", "陈晓东"].sort());
  assert.equal(new Set(users.map(d => d.contacts[0].value)).size, 4);
  assert.equal(contact("李小刚", "神经内科").value, "xgangli2002@163.com");
  assert.match(contact("王大明", "神经外科").identityNote, /双单位.*不继承李小刚/);
  for (const [name, department] of [
    ["张玉梅", "急诊科"], ["王斌", "急诊科"], ["李绯", "心脏外科"],
    ["魏玲", "儿科"], ["郑亦沐", "职业病科"], ["刘燕娥", "肿瘤化疗与放射病科"],
  ]) assert.deepEqual(doctor(name, department).contacts, []);
});

test("28 contacts use 23 new sources and one old source, while coverage remains partial", () => {
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1563);
  assert.equal(data.sources.filter(s => s.id.startsWith(prefix)).length, 23);
  assert.equal(new Set(expected.map(e => e.sourceId)).size, 24);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  for (const [department, total, current] of groups) {
    const rows = data.doctors.filter(d => d.hospitalId === "puh3" && d.department === department);
    assert.equal(rows.length, total);
    assert.equal(rows.filter(d => d.contacts.length).length, current, department);
  }
  assert.equal(data.doctors.filter(d => d.hospitalId === "puh3" && d.department === "胸外科" && d.contacts.length).length, 2);
});
