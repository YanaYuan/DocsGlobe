import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeCrossfieldContacts } from "./helpers/email-crossfield.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const expected = [
  ["王海宁", "puh3-nfmk-1831", "hainingmail@bjmu.edu.cn", "pmid40158096", 2025],
  ["刘爱华", "puh3-nfmk-1771", "liuaihuacmu@163.com", "pmid42543222", 2026],
  ["杨琨", "puh3-nfmk-4032", "yangkun@bjmu.edu.cn", "pmid36129525", 2023],
  ["乐云逸", "puh3-nfmk-4652", "leyunyi@bjmu.edu.cn", "pmid39095726", 2024],
  ["克晓燕", "puh3-xynk-1501", "kexy@gobroadhealthcare.com", "pmid38662205", 2024],
  ["王继军", "puh3-xynk-1491", "wangjj368@163.com", "pmid41462436", 2025],
  ["董菲", "puh3-xynk-1471", "knowflying@163.com", "pmid42225948", 2026],
  ["杨萍", "puh3-xynk-1371", "yangping198302@163.com", "pmid41559357", 2026],
  ["包芳", "puh3-xynk-3312", "baofang@bjmu.edu.cn", "pmid41071290", 2025],
  ["李晓光", "puh3-grjbk-1101", "lixiaoguangpuh3@bjmu.edu.cn", "pmid37597780", 2023],
  ["李璐", "puh3-grjbk-1081", "lili_lu@163.com", "pmid38336670", 2024],
  ["姜薇", "puh3-pfk-3312", "jiangwei@medmail.com.cn", "pmid21879237", 2012],
  ["马川", "puh3-pfk-3412", "cma_2000@163.com", "pmid40155530", 2025],
  ["宋清华", "puh3-pfk-3462", "songqinghua169@163.com", "pmid28669926", 2017],
  ["李薇薇", "puh3-pfk-3392", "liweiwei792002@sina.com", "pmid40829507", 2026],
  ["谢志强", "puh3-pfk-3452", "xiezq66@163.com", "pmid34904682", 2022],
  ["张卫方", "puh3-hyxk-1973", "tsy1997@126.com", "pmid38910165", 2024],
  ["祝安惠", "puh3-hyxk-1971", "zhuanhui718@sina.com", "pmid42351067", 2026],
  ["赵梅莘", "puh3-hyxk-1969", "zhaomeixin.student@sina.com", "pmid35098955", 2022],
  ["高洪伟", "puh3-nfmk-1691", "gaohw@bjmu.edu.cn", "pmc7220250", 2020],
  ["田勍", "puh3-nfmk-4672", "tiannate@bjmu.edu.cn", "pmc13315098", 2026],
  ["刘烨", "puh3-nfmk-1761", "yeliumed@bjmu.edu.cn", "pmc11268237", 2024],
  ["陈静", "puh3-grjbk-6161", "jchen@bjmu.edu.cn", "pmc13413413", 2026],
  ["邓忠华", "puh3-grjbk-1051", "dengzhonghuatj@163.com", "pmc13413413", 2026],
  ["门月华", "puh3-pfk-3372", "menyuehua@126.com", "pmc12677457", 2025],
];

test("under-covered specialty batch preserves all 971 profiles, 240 contacts and 1197 sources", () => {
  const sources = data.sources.slice(0, 1197);
  const ids = new Set(sources.map(s => s.id));
  const historical = beforeCrossfieldContacts(data).map(d => ({
    ...d, contacts: d.contacts.filter(c => ids.has(c.sourceId)),
    evidence: d.evidence.filter(e => ids.has(e.sourceId)),
  }));
  assert.equal(digest(historical), "86c4341c59a42c6d31634fa76fb7dd4e56919c00f8688d21c77dad6f5267c905");
  assert.equal(digest(sources), "2c5b98463a201f3e03187c01b1284c61f56aac6534b03ff07b8463466cecacb1");
  assert.equal(historical.filter(d => d.contacts.length).length, 240);
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("25 new emails retain exact named ownership, source representation and real publication years", () => {
  for (const [name, id, email, key, year] of expected) {
    const doctor = data.doctors.find(d => d.id === id);
    assert.equal(doctor.name, name);
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.equal(contact.value, email);
    assert.equal(contact.purpose, "academic");
    assert.equal(contact.sourceId, `email-undercovered-${key}`);
    assert.match(contact.identityNote, new RegExp(`${year}年论文公开地址`));
    assert.match(contact.identityNote, /未测试收信/);
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.equal(source.publishedYear, year);
    assert.equal(source.kind, "journal-article");
    assert.equal(source.accessMethod, "web");
    assert.equal(source.accessedAt, "2026-10-10");
    assert.equal(source.sourceUpdatedAt, null);
    assert.deepEqual(doctor.evidence.at(-1), { sourceId: source.id, fields: ["contacts"] });
    if (key.startsWith("pmid")) {
      assert.equal(new URL(source.url).searchParams.get("query"), `EXT_ID:${key.slice(4)} AND SRC:MED`);
      assert.match(contact.identityNote, /个人作者元数据，不冒称全文通讯栏/);
    } else {
      assert.equal(source.url, `https://www.ebi.ac.uk/europepmc/webservices/rest/${key.toUpperCase()}/fullTextXML`);
    }
    assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.value === email)).map(d => d.id), [id]);
  }
});

test("personal nodes, unique initials and unusual email domains are supported by identity evidence", () => {
  const note = id => data.doctors.find(d => d.id === id).contacts[0].identityNote;
  assert.match(note("puh3-nfmk-4672"), /contrib au0040直接列email/);
  assert.match(note("puh3-nfmk-1761"), /AN0003具名Ye Liu/);
  assert.match(note("puh3-grjbk-6161"), /\(J\.C\.\).*唯一对应Jing Chen/);
  assert.match(note("puh3-grjbk-1051"), /\(Z\.D\.\).*唯一对应Zhonghua Deng/);
  assert.match(note("puh3-pfk-3372"), /xref指向cor001/);
  assert.match(note("puh3-hyxk-1969"), /不因邮箱含student就否定个人归属/);
  assert.match(note("puh3-xynk-1501"), /非北大域名不用于推断任职变动/);
  assert.equal(data.sources.find(s => s.id === "email-undercovered-pmc13413413").publisher,
    "Journal of Fungi / Europe PMC");
});

test("namesakes, other hospitals, coauthor mailboxes and unresolved shared headers remain excluded", () => {
  const additions = data.doctors.flatMap(d => d.contacts)
    .filter(c => c.sourceId.startsWith("email-undercovered-"));
  for (const email of ["Chao_Xie@URMC.Rochester.edu", "wangchen66366@163.com", "wjiang@sdu.edu.cn",
    "qianzhang@cau.edu.cn", "2403649155@qq.com", "luxysin_bj3@163.com", "1911110404@bjmu.edu.cn"]) {
    assert.ok(!additions.some(c => c.value === email), email);
  }
  for (const id of ["puh3-nfmk-1821", "puh3-nfmk-4682", "puh3-pfk-3422",
    "puh3-pfk-3482", "puh3-pfk-3402", "puh3-nfmk-4722", "puh3-xynk-1441"]) {
    assert.deepEqual(data.doctors.find(d => d.id === id).contacts
      .filter(c => c.sourceId.startsWith("email-undercovered-")), [], id);
  }
});

test("five-department progress is measured without claiming hospital-wide or real-world email prevalence", () => {
  for (const [department, total, current] of [
    ["内分泌科", 19, 11], ["血液内科", 9, 7], ["感染疾病科", 4, 4],
    ["皮肤科", 18, 12], ["核医学科", 5, 4],
  ]) {
    const doctors = data.doctors.filter(d => d.hospitalId === "puh3" && d.department === department);
    assert.equal(doctors.length, total);
    assert.equal(doctors.filter(d => d.contacts.length).length, current);
  }
  assert.deepEqual(planStats(coverage, data).email,
    { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  const sources = data.sources.filter(s => s.id.startsWith("email-undercovered-"));
  assert.equal(sources.length, 24);
  assert.equal(sources.filter(s => s.id.includes("-pmid")).length, 19);
  assert.equal(data.doctors.filter(d => d.contacts.some(c => c.sourceId === "email-undercovered-pmc13413413")).length, 2);
});
