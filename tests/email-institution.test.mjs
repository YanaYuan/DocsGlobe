import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const expected = [
  ["刘平", "puh3-szyxzx-1155", "1441", "Pingliu7703@sina.com"],
  ["王海燕", "puh3-szyxzx-1152", "4482", "wangquan1991@sina.com"],
  ["赵扬玉", "puh3-fck-1158", "5292", "zhaoyangyu@bjmu.edu.cn"],
  ["魏瑗", "puh3-fck-1168", "5452", "weiyuanbysy@163.com"],
  ["郭红燕", "puh3-fck-1157", "5362", "bysyghy@163.com"],
  ["杨蕊", "puh3-szyxzx-1170", "4132", "yrjeff@126.com"],
  ["杨硕", "puh3-szyxzx-1169", "3731", "yangshuo@263.net"],
  ["洪天配", "puh3-nfmk-1721", "4522", "tpho66@bjmu.edu.cn"],
  ["李东", "puh3-zyk-1401", "5422", "lidong6512@sina.com"],
  ["迟洪滨", "puh3-szyxzx-1150", "3851", "chihb@163.com"],
  ["马彩虹", "puh3-szyxzx-1153", "5352", "macaihong@263.net"],
  ["王丽娜", "puh3-szyxzx-1164", "5442", "bwanglina@sina.com"],
  ["王妍", "puh3-fck-1166", "3841", "wjgqhn@263.net"],
  ["王颖", "puh3-szyxzx-1151", "4102", "wangying02114@bjmu.edu.cn"],
  ["王永清", "puh3-fck-1154", "5482", "mddoctor@163.com"],
  ["张坤", "puh3-fck-1162", "5542", "bysyzk@163.com"],
  ["赵捷", "puh3-szyxzx-1157", "5282", "2358044941@qq.com"],
  ["甄秀梅", "puh3-szyxzx-1163", "4142", "xmzhen1970@aliyun.com"],
  ["智旭", "puh3-szyxzx-1158", "5302", "zhixujp@163.com"],
  ["陈练", "puh3-fck-3061", "4062", "chenlian@bjmu.edu.cn"],
  ["黄铄", "puh3-szyxzx-1161", "3761", "homelyleaf@aliyun.com"],
  ["李圆", "puh3-fck-2871", "5492", "yuanli@bjmu.edu.cn"],
  ["龙晓宇", "puh3-szyxzx-1167", "4082", "long_x_y@163.com"],
  ["辛喜艳", "puh3-zyk-1451", "3831", "bysyxinxiyan@sina.com"],
  ["杨进", "puh3-nfmk-4662", "3821", "yangjin@bjmu.edu.cn"],
  ["张浩琳", "puh3-zyk-3521", "3711", "zoe@bjmu.edu.cn"],
];

test("institution-first email batch preserves 971 biographies, 129 contacts and all 1093 prior sources", () => {
  const sources = data.sources.slice(0, 1093);
  const ids = new Set(sources.map(s => s.id));
  const historical = data.doctors.map(d => ({
    ...d, contacts: d.contacts.filter(c => ids.has(c.sourceId)),
    evidence: d.evidence.filter(e => ids.has(e.sourceId)),
  }));
  assert.equal(historical.length, 971);
  assert.equal(historical.filter(d => d.contacts.length).length, 129);
  assert.equal(digest(historical), "acc69b764c41780cb7bc10ef57efea1da68cabb4eb8460bd433e4e72abcbf322");
  assert.equal(digest(sources), "bbb05bc30aeee5f8772972b0ac1ac9951bb632504f2f27f4cda1b4054fa02e8a");
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("26 laboratory emails have exact named ownership, casing, research sources and uncertainty notes", () => {
  for (const [name, id, page, email] of expected) {
    const doctor = data.doctors.find(d => d.id === id);
    assert.equal(doctor.name, name);
    assert.equal(doctor.hospitalId, "puh3");
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.equal(contact.value, email);
    assert.equal(contact.purpose, "academic");
    assert.equal(contact.sourceId, `email-lab-${page}`);
    assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.value === email)).map(d => d.id), [id]);
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.equal(source.url, `https://sklffp.puh3.net.cn/info/1058/${page}.htm`);
    assert.equal(source.kind, "university-profile");
    assert.equal(source.accessMethod, "browser");
    assert.equal(source.accessedAt, "2026-10-10");
    assert.equal(source.sourceUpdatedAt, null);
    assert.equal(source.publishedYear, undefined);
    assert.match(contact.identityNote, /本人介绍页的E-mail栏/);
    assert.match(contact.identityNote, /未测试收信/);
    assert.deepEqual(doctor.evidence.at(-1), { sourceId: source.id, fields: ["contacts"] });
  }
});

test("same-name Liu Ping and Li Dong do not share each other's professional emails", () => {
  assert.match(data.doctors.find(d => d.id === "puh3-szyxzx-1155").contacts[0].identityNote, /不是运动医学科/);
  assert.match(data.doctors.find(d => d.id === "puh3-zyk-1401").contacts[0].identityNote, /不是成形外科/);
  assert.ok(data.doctors.find(d => d.id === "puh3-liu-ping").contacts.every(c => c.value !== "Pingliu7703@sina.com"));
  assert.ok(data.doctors.find(d => d.id === "puh3-zxwk-1031").contacts.every(c =>
    c.value !== data.doctors.find(d => d.id === "puh3-zyk-1401").contacts[0].value));
  assert.equal(data.doctors.find(d => d.id === "puh3-szyxzx-1169").department, "生殖医学科");
  assert.match(data.doctors.find(d => d.id === "puh3-szyxzx-1169").contacts[0].identityNote, /不是检验科/);
});

test("Qiang's email is attributed to personal-author metadata, not falsely to email-free XML", () => {
  const doctor = data.doctors.find(d => d.id === "puh3-xwk-1011");
  assert.equal(doctor.name, "强光亮");
  const contact = doctor.contacts[0];
  assert.equal(contact.value, "pkudd@bjmu.edu.cn");
  const source = data.sources.find(s => s.id === contact.sourceId);
  assert.equal(source.id, "email-institution-pmid42133078");
  assert.equal(source.kind, "journal-article");
  assert.equal(source.publishedYear, 2026);
  assert.equal(source.accessMethod, "web");
  const url = new URL(source.url);
  assert.equal(url.searchParams.get("query"), "EXT_ID:42133078 AND SRC:MED");
  assert.match(contact.identityNote, /Guangliang Qiang本人单位字段/);
  assert.match(contact.identityNote, /XML未呈现邮箱/);
  assert.match(contact.identityNote, /未将地址转给共同作者Wei He/);
  assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.value === contact.value)).map(d => d.id), [doctor.id]);
});

test("unmatched research staff and unrelated-affiliation email owners stay out of this import", () => {
  const contacts = data.doctors.flatMap(d => d.contacts);
  for (const email of ["changchun@bjmu.edu.cn", "songyanan@bjmu.edu.cn", "yuyang5012@hotmail.com",
    "hep2007@bjmu.edu.cn", "yyuanwang@163.com", "zhao.weili@yahoo.com", "zhuxiaohuishine@VIP.163.com"]) {
    assert.ok(!contacts.some(c => c.value === email), email);
  }
  assert.equal(data.doctors.length, 971);
  assert.equal(data.doctors.filter(d => d.contacts.some(c =>
    c.sourceId.startsWith("email-lab-") || c.sourceId === "email-institution-pmid42133078")).length, 27);
});

test("email progress improves without changing physician or hospital-roster denominators", () => {
  assert.deepEqual(planStats(coverage, data).email,
    { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.equal(data.doctors.filter(d => d.hospitalId === "puh3").length, 903);
  assert.equal(data.sources.slice(1093, 1120).filter(s => s.kind === "university-profile").length, 26);
  assert.equal(data.sources.slice(1093, 1120).filter(s => s.kind === "journal-article").length, 1);
});
