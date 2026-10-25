import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const mentors = [
  ["崔立刚", "puh3-csyxk-2281", "cuijuegang@126.com"],
  ["王淑敏", "puh3-csyxk-2251", "shuminwang2014@163.com"],
  ["毕洪森", "puh3-zxwk-1081", "hongsenbi@sina.com"],
  ["韩彤妍", "puh3-ek-1071", "tongyanhan@qq.com"],
  ["袁慧书", "puh3-fsk-1582", "huishuy@sina.com"],
  ["韩鸿宾", "puh3-fsk-1565", "hanhongbin@bjmu.edu.cn"],
  ["尚春亮", "puh3-fck-2911", "shangchl@bjmu.edu.cn"],
  ["田华", "puh3-gk-1700", "tianhua@bjmu.edu.cn"],
  ["韦峰", "puh3-gk-1708", "mountweifeng@126.com"],
  ["蔡宏", "puh3-gk-1709", "hongcai@bjmu.edu.cn"],
  ["姬涛", "puh3-gk-6853", "jitaomd@163.com"],
  ["许南方", "puh3-gk-6753", "xunanfang@foxmail.com"],
  ["刘冰川", "puh3-gk-6993", "liubc@bjmu.edu.cn"],
  ["张立强", "puh3-hxywzzyxk-3522", "zhanglq@bjmu.edu.cn"],
  ["崔丽艳", "puh3-jyk-5151", "cliyan@163.com"],
  ["李正迁", "puh3-mzk-2354", "zhengqianli@hsc.pku.edu.cn"],
  ["张春雷", "puh3-pfk-3362", "zhangchunleius@163.com"],
  ["李东明", "puh3-pfk-3322", "lidm3@163.com"],
  ["王文慧", "puh3-pfk-3442", "wwh0608@126.com"],
  ["付卫", "puh3-ptwk-1471", "fuwei@bjmu.edu.cn"],
  ["原春辉", "puh3-ptwk-1491", "ychdoctor@163.com"],
  ["李慕行", "puh3-ptwk-3951", "limuxing@hsc.pku.edu.cn"],
  ["樊东升", "puh3-sjnk-1571", "dsfan@sina.com"],
  ["唐雯", "puh3-snk-2571", "tanggwen@126.com"],
  ["葛庆岗", "puh3-wzbxk-1046", "qingganggelin@126.com"],
  ["张静", "puh3-xhk-1291", "sihuizhang@sina.com"],
  ["祖凌云", "puh3-xxgnk-3191", "dr_zly@126.com"],
  ["凌云鹏", "puh3-xzwk-1540", "micsling@163.com"],
  ["景红梅", "puh3-xynk-1511", "hongmeijing@bjmu.edu.cn"],
  ["洪晶", "puh3-yk-1562", "hongjing1964@sina.com"],
  ["齐虹", "puh3-yk-1585", "doctorqihong@163.com"],
  ["李学民", "puh3-yk-1553", "lxmlxm66@sina.com"],
];
const papers = [
  ["郎宁", "puh3-fsk-1580", "langning800129@126.com", "41888686", 2026],
  ["马青变", "puh3-jzk-1001", "maqingbian@126.com", "41680647", 2026],
  ["杨军", "puh3-sjwk-2781", "yangjbysy@bjmu.edu.cn", "41921692", 2026],
  ["刘晓光", "puh3-gk-1694", "xgliudoctor@163.com", "41857102", 2026],
  ["刘从容", "puh3-blk-1581", "congrong_liu@hsc.pku.edu.cn", "39025403", 2024],
];

test("recruitment batch preserves 971 biographies, 179 old contacts and all 1142 prior sources", () => {
  const sources = data.sources.slice(0, 1142);
  const ids = new Set(sources.map(s => s.id));
  const historical = data.doctors.map(d => ({
    ...d, contacts: d.contacts.filter(c => ids.has(c.sourceId)),
    evidence: d.evidence.filter(e => ids.has(e.sourceId)),
  }));
  assert.equal(digest(historical), "3c0f4e2feae8caf7c4e74b20fb5e8702564f77a5f9c5787d02df725e194e7ed4");
  assert.equal(digest(sources), "ccf3403b1f9e05d30f6f826e961d025ebee46f98ec49acee9d7dae7c10398619");
  assert.equal(historical.filter(d => d.contacts.length).length, 179);
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("32 mentor contacts are exact academic addresses with named-page provenance and uncertainty", () => {
  for (const [name, id, email] of mentors) {
    const doctor = data.doctors.find(d => d.id === id);
    assert.equal(doctor.name, name);
    assert.equal(doctor.hospitalId, "puh3");
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.equal(contact.value, email);
    assert.equal(contact.purpose, "academic");
    assert.equal(contact.sourceId, `email-recruitment-${id}`);
    assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.value === email)).map(d => d.id), [id]);
    assert.match(contact.identityNote, /合作导师姓名.*联系方式/);
    assert.match(contact.identityNote, /不证明收件箱由本人独立管理/);
    assert.match(contact.identityNote, /未测试收信/);
    assert.deepEqual(doctor.evidence.at(-1), { sourceId: contact.sourceId, fields: ["contacts"] });
    const source = data.sources.find(s => s.id === contact.sourceId);
    const url = new URL(source.url);
    assert.ok(["bysyzhaopin.zhiye.com", "bysyzhaopin1.zhiye.com"].includes(url.hostname));
    assert.equal(url.pathname, "/recruitFeed/detail");
    assert.match(url.searchParams.get("id"), /^[0-9a-f-]{36}$/);
    assert.equal(source.kind, "hospital-profile");
    assert.equal(source.accessMethod, "web");
    assert.equal(source.accessedAt, "2026-10-10");
    assert.equal(source.sourceUpdatedAt, null);
    assert.equal(source.publishedYear, undefined);
  }
});

test("five independent author records and one faculty sidebar resolve alternate-source cases", () => {
  for (const [name, id, email, pmid, year] of papers) {
    const doctor = data.doctors.find(d => d.id === id);
    assert.equal(doctor.name, name);
    const contact = doctor.contacts[0];
    assert.equal(contact.value, email);
    assert.equal(contact.sourceId, `email-recruitment-pmid${pmid}`);
    assert.equal(contact.purpose, "academic");
    assert.match(contact.identityNote, /个人作者元数据，不冒称全文通讯栏/);
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.equal(new URL(source.url).searchParams.get("query"), `EXT_ID:${pmid} AND SRC:MED`);
    assert.equal(source.kind, "journal-article");
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-10");
    assert.deepEqual(doctor.evidence.at(-1), { sourceId: source.id, fields: ["contacts"] });
    assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.value === email)).map(d => d.id), [id]);
  }
  const wang = data.doctors.find(d => d.id === "puh3-snk-2551");
  assert.equal(wang.name, "汪涛");
  assert.equal(wang.title, "职称未公开");
  assert.equal(wang.contacts[0].value, "wangt@bjmu.edu.cn");
  assert.match(wang.contacts[0].identityNote, /侧栏.*不是页脚/);
  const source = data.sources.find(s => s.id === wang.contacts[0].sourceId);
  assert.equal(source.kind, "university-profile");
  assert.equal(source.accessMethod, "browser");
  assert.equal(source.url, "https://www.ghd.pku.edu.cn/rcdw/jsxl/W/wt/index.htm");
});

test("partial-name matches, same-name clinicians, shared recruitment boxes and malformed emails stay excluded", () => {
  for (const id of ["puh3-gk-1722", "puh3-hxywzzyxk-3281", "puh3-zxwk-1031", "puh3-mzk-2404"]) {
    assert.deepEqual(data.doctors.find(d => d.id === id).contacts.filter(c =>
      c.sourceId.startsWith("email-recruitment-")), []);
  }
  const contacts = data.doctors.flatMap(d => d.contacts);
  for (const email of ["puthmzk@163.com", "puthmzk@hsc.pku.edu.cn", "ghd@pku.edu.cn",
    "15712820706@163.com", "13901291211@163.com", "bysysjwk@126.com",
    "xglius@vip.sina.com.cn", "langning800129@126. com", "liuer510@163.com"]) {
    assert.ok(!contacts.some(c => c.value === email), email);
  }
  assert.match(data.doctors.find(d => d.id === "puh3-hxywzzyxk-3522").contacts[0].identityNote, /不是姓名部分匹配的骨科张立/);
  assert.match(data.doctors.find(d => d.id === "puh3-xhk-1291").contacts[0].identityNote, /不是呼吸科同名张静/);
  assert.match(data.doctors.find(d => d.id === "puh3-ek-1071").contacts[0].identityNote, /正文职位链接仍写2025/);
  assert.equal(data.doctors.find(d => d.id === "puh3-zyk-1401").contacts[0].value, "lidong6512@sina.com");
});

test("38 new emails improve current progress without moving roster dates or denominators", () => {
  assert.deepEqual(planStats(coverage, data).email,
    { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.equal(data.doctors.filter(d => d.hospitalId === "puh3").length, 903);
  const added = data.sources.filter(s => s.id.startsWith("email-recruitment-"));
  assert.equal(added.length, 38);
  assert.equal(added.filter(s => s.kind === "hospital-profile").length, 32);
  assert.equal(added.filter(s => s.kind === "journal-article").length, 5);
  assert.equal(added.filter(s => s.kind === "university-profile").length, 1);
});
