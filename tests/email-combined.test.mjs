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
  ["王悦", "puh3-snk-2601", "bjwangyue@sina.com", "pmid42010519", 2026],
  ["郑丹侠", "puh3-snk-2581", "dxzheng@sina.com", "pmid42021204", 2026],
  ["解倩", "puh3-snk-2651", "xieqian@bjmu.edu.cn", "pmid40215639", 2025],
  ["白琼", "puh3-snk-2641", "baiqiong@bjmu.edu.cn", "pmid42432533", 2026],
  ["傅瑜", "puh3-sjnk-1531", "lilac_fu@126.com", "pmid38850625", 2024],
  ["李小刚", "puh3-sjnk-1561", "xgangli2002@163.com", "pmid41610669", 2026],
  ["肖卫忠", "puh3-sjnk-1511", "weizhongx@sina.com", "pmid40155756", 2025],
  ["孙庆利", "puh3-sjnk-16612", "qingli_sun@sohu.com", "pmid39983506", 2025],
  ["张远锦", "puh3-sjnk-16702", "zhangyuanjin01@126.com", "pmid41077114", 2025],
  ["陈仲强", "puh3-gk-1706", "puth_czq@126.com", "pmc5000765", 2016],
  ["范东伟", "puh3-gk-7053", "fdw_puth@163.com", "pmc5000765", 2016],
  ["周庆涛", "puh3-hxywzzyxk-3532", "zhouqingtaobysy@sina.com", "pmc4522053", 2015],
  ["于淼", "puh3-gk-1738", "miltonyupku@163.com", "pmc11895114", 2025],
  ["张永珍", "puh3-xxgnk-3071", "zhangy_zhen@163.com", "pmc4289563", 2014],
  ["陈宝霞", "puh3-xxgnk-3201", "chenbaoxia@medmail.com.cn", "pmc4289563", 2014],
  ["冯新恒", "puh3-xxgnk-3121", "fengxinheng2013@126.com", "pmc4289563", 2014],
  ["李卫虹", "puh3-xxgnk-3161", "weihong70@gmail.com", "pmc4289563", 2014],
  ["冯杰莉", "puh3-xxgnk-3221", "jielifeng@ymail.com", "pmc4289563", 2014],
  ["郭丽梅", "puh3-blk-2111", "guolimei@bjmu.edu.cn", "pmc12872308", 2026],
  ["侯纯升", "puh3-ptwk-1571", "chunshenghou@126.com", "pmc12872308", 2026],
  ["邢燕", "puh3-ek-1081", "xingyan@bjmu.edu.cn", "pmc12711401", 2025],
  ["付鹏", "puh3-csyxk-2421", "pengf01@sohu.com", "pmc12549354", 2025],
  ["杜毅鹏", "puh3-hxywzzyxk-3261", "yipengdu1980@sina.com", "pmc12872307", 2026],
];

test("combined email batch preserves every old profile, all 217 contacts and 1180 sources", () => {
  const sources = data.sources.slice(0, 1180);
  const ids = new Set(sources.map(s => s.id));
  const historical = data.doctors.map(d => ({
    ...d, contacts: d.contacts.filter(c => ids.has(c.sourceId)),
    evidence: d.evidence.filter(e => ids.has(e.sourceId)),
  }));
  assert.equal(digest(historical), "1dac4f6a13835151480985c9c385ab9e871f1ff300ff42fc55b807d4f619347e");
  assert.equal(digest(sources), "2ba6354fe9a508c0f05cca60a0f90b69851c12c1cd43989e279c46d70fe52bd7");
  assert.equal(historical.filter(d => d.contacts.length).length, 217);
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("23 combined-route emails have exact ownership, publication years and contact-only evidence", () => {
  for (const [name, id, email, key, year] of expected) {
    const doctor = data.doctors.find(d => d.id === id);
    assert.equal(doctor.name, name);
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.equal(contact.value, email);
    assert.equal(contact.purpose, "academic");
    assert.equal(contact.sourceId, `email-combined-${key}`);
    assert.match(contact.identityNote, new RegExp(`${year}年论文公开地址`));
    assert.match(contact.identityNote, /未测试收信/);
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.equal(source.kind, "journal-article");
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-10");
    assert.equal(source.sourceUpdatedAt, null);
    assert.deepEqual(doctor.evidence.at(-1), { sourceId: source.id, fields: ["contacts"] });
    assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.value === email)).map(d => d.id), [id]);
  }
});

test("metadata, XML correspondence, author initials and HTML contributor information stay distinct", () => {
  for (const [, id, , key] of expected) {
    const contact = data.doctors.find(d => d.id === id).contacts[0];
    const source = data.sources.find(s => s.id === contact.sourceId);
    if (key.startsWith("pmid")) {
      assert.equal(new URL(source.url).searchParams.get("query"), `EXT_ID:${key.slice(4)} AND SRC:MED`);
      assert.match(contact.identityNote, /个人作者元数据，不冒称全文通讯栏/);
      assert.equal(source.accessMethod, "web");
    } else if (["pmc5000765", "pmc4522053", "pmc11895114"].includes(key)) {
      assert.equal(source.url, `https://www.ebi.ac.uk/europepmc/webservices/rest/${key.toUpperCase()}/fullTextXML`);
      assert.equal(source.accessMethod, "web");
    } else {
      assert.equal(source.url, `https://pmc.ncbi.nlm.nih.gov/articles/${key.toUpperCase()}/`);
      assert.equal(source.accessMethod, "browser");
    }
  }
  const note = id => data.doctors.find(d => d.id === id).contacts[0].identityNote;
  assert.match(note("puh3-gk-1706"), /c1-ijms-17-01370/);
  assert.match(note("puh3-gk-7053"), /\(D\.F\.\).*唯一对应Dongwei Fan/);
  assert.match(note("puh3-hxywzzyxk-3532"), /contrib\/address\/email/);
  assert.match(note("puh3-xxgnk-3071"), /Contributor Information.*XML没有邮箱/);
  for (const [key, publisher] of [
    ["pmc5000765", "International Journal of Molecular Sciences / Europe PMC"],
    ["pmc4522053", "Journal of Translational Medicine / Europe PMC"],
    ["pmc11895114", "Asian Spine Journal / Europe PMC"],
    ["pmc4289563", "BMC Cardiovascular Disorders / PMC"],
  ]) {
    assert.equal(data.sources.find(s => s.id === `email-combined-${key}`).publisher, publisher);
  }
});

test("bilingual reverse matching retains specialties and leaves unresolved coauthors unfilled", () => {
  assert.equal(data.doctors.find(d => d.id === "puh3-csyxk-2421").department, "超声医学科");
  assert.equal(data.doctors.find(d => d.id === "puh3-blk-2111").department, "病理科");
  assert.equal(data.doctors.find(d => d.id === "puh3-ptwk-1571").department, "普通外科");
  assert.match(data.doctors.find(d => d.id === "puh3-csyxk-2421").contacts[0].identityNote, /超声影像解读.*不归给成形外科/);
  assert.match(data.doctors.find(d => d.id === "puh3-hxywzzyxk-3261").contacts[0].identityNote, /中文作者贡献明确杜毅鹏/);
  assert.match(data.doctors.find(d => d.id === "puh3-xxgnk-3161").contacts[0].identityNote, /不按拼音猜成李卫红/);
  for (const name of ["王松", "韩庆烽", "唐子勇", "毕书红", "顾卫红", "刘晓鲁", "张英爽", "夏志伟", "姚炜"]) {
    const doctors = data.doctors.filter(d => d.name === name && d.hospitalId === "puh3");
    assert.equal(doctors.length, 1, name);
    assert.deepEqual(doctors[0].contacts.filter(c => c.sourceId.startsWith("email-combined-")), [], name);
  }
  const additions = data.doctors.flatMap(d => d.contacts).filter(c => c.sourceId.startsWith("email-combined-"));
  for (const email of ["prof_zhongjunliu@126.com", "lyyulia@163.com", "ddkent@163.com",
    "13911765322@163.com", "15611908652@163.com", "jaylill2@163.com"]) {
    assert.ok(!additions.some(c => c.value === email), email);
  }
});

test("23 new email holders share 17 sources without inflating roster or source counts", () => {
  assert.deepEqual(planStats(coverage, data).email,
    { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  const added = data.sources.filter(s => s.id.startsWith("email-combined-"));
  assert.equal(added.length, 17);
  assert.equal(added.filter(s => s.id.includes("-pmid")).length, 9);
  assert.equal(data.doctors.filter(d => d.contacts.some(c => c.sourceId === "email-combined-pmc4289563")).length, 5);
  assert.equal(data.doctors.filter(d => d.contacts.some(c => c.sourceId === "email-combined-pmc5000765")).length, 2);
  assert.equal(data.doctors.filter(d => d.contacts.some(c => c.sourceId === "email-combined-pmc12872308")).length, 2);
});
