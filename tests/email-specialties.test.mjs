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
  ["高炜", "puh3-xxgnk-3041", "weigao@bjmu.edu.cn", "pmid37254140", 2023],
  ["崔鸣", "puh3-xxgnk-3171", "mingcui@bjmu.edu.cn", "pmid41540467", 2026],
  ["李昭屏", "puh3-xxgnk-3091", "zhaoping1223@163.com", "pmid40425699", 2025],
  ["贺蓓", "puh3-hxywzzyxk-3502", "puh3_hb@bjmu.edu.cn", "pmid34687998", 2022],
  ["沈宁", "puh3-hxywzzyxk-3091", "puh3shenning@bjmu.edu.cn", "pmid42426749", 2026],
  ["常春", "puh3-hxywzzyxk-4002", "changc@bjmu.edu.cn", "pmid41735995", 2026],
  ["周丽雅", "puh3-xhk-4341", "zhouliya123456@163.com", "pmid40945526", 2026],
  ["丁士刚", "puh3-xhk-4331", "dingshigang222@163.com", "pmid41107336", 2025],
  ["段丽萍", "puh3-xhk-4321", "duanlp@bjmu.edu.cn", "pmid41616821", 2026],
  ["宋志强", "puh3-xhk-2221", "szqinputh@163.com", "pmid40090338", 2025],
  ["李危石", "puh3-gk-1696", "puh3liweishi@163.com", "pmid42749721", 2026],
  ["刘忠军", "puh3-gk-1695", "zjliu@bjmu.edu.cn", "pmid42243588", 2026],
  ["周方", "puh3-gk-1702", "zhouf@bjmu.edu.cn", "pmid41520542", 2026],
  ["田耘", "puh3-gk-1699", "tiany@bjmu.edu.cn", "pmid41943026", 2026],
  ["孙垂国", "puh3-gk-1736", "sunchuiguo@163.com", "pmid41286794", 2025],
  ["唐熠达", "puh3-xxgnk-3031", "tang_yida@163.com", "tang-2021", 2021],
  ["郭丽君", "puh3-xxgnk-3061", "guo_li_jun@sohu.com", "pmc10845173", 2024],
  ["韩江莉", "puh3-xxgnk-3181", "dr_hanjiangli@126.com", "pmc10845173", 2024],
  ["孙永昌", "puh3-hxywzzyxk-3512", "suny@bjmu.edu.cn", "pmc12328282", 2025],
  ["陈亚红", "puh3-hxywzzyxk-3071", "chenyahong@vip.sina.com", "pmc13531628", 2026],
  ["梁瀛", "puh3-hxywzzyxk-3251", "bysyliangying@126.com", "pmc13558021", 2026],
  ["王琨", "puh3-xhk-1251", "wangkun_bjmu@vip.sina.com", "pmc12780913", 2026],
  ["周非非", "puh3-gk-1742", "zhoufeifei@pku.edu.cn", "pmc12722153", 2025],
];

test("specialty email batch preserves all 971 biographies, 156 contacts and 1120 prior sources", () => {
  const sources = data.sources.slice(0, 1120);
  const ids = new Set(sources.map(s => s.id));
  const historical = data.doctors.map(d => ({
    ...d, contacts: d.contacts.filter(c => ids.has(c.sourceId)),
    evidence: d.evidence.filter(e => ids.has(e.sourceId)),
  }));
  assert.equal(historical.filter(d => d.contacts.length).length, 156);
  assert.equal(digest(historical), "1d65340d0431201bcbb13fa8d07850af17a10263a58500b6efcfa310843f7509");
  assert.equal(digest(sources), "cba38416072aac706479cafa7c82460cb3816081ac9e738a84b90d5d79f0ebfe");
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("23 specialty emails retain exact individual ownership and contact-only evidence", () => {
  for (const [name, id, email, key, year] of expected) {
    const doctor = data.doctors.find(d => d.id === id);
    assert.equal(doctor.name, name);
    assert.equal(doctor.hospitalId, "puh3");
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.equal(contact.value, email);
    assert.equal(contact.purpose, "academic");
    assert.equal(contact.sourceId, `email-specialties-${key}`);
    assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.value === email)).map(d => d.id), [id]);
    assert.match(contact.identityNote, /未测试收信/);
    assert.match(contact.identityNote, /北京大学第三医院/);
    assert.deepEqual(doctor.evidence.at(-1), { sourceId: contact.sourceId, fields: ["contacts"] });
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.equal(source.kind, "journal-article");
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-10");
    assert.equal(source.sourceUpdatedAt, null);
  }
});

test("personal-author metadata and full-text evidence use accurate distinct representations", () => {
  for (const [, id, , key] of expected) {
    const contact = data.doctors.find(d => d.id === id).contacts[0];
    const source = data.sources.find(s => s.id === contact.sourceId);
    if (key.startsWith("pmid")) {
      const url = new URL(source.url);
      assert.equal(url.searchParams.get("query"), `EXT_ID:${key.slice(4)} AND SRC:MED`);
      assert.equal(url.searchParams.get("resultType"), "core");
      assert.equal(source.accessMethod, "web");
      assert.match(contact.identityNote, /个人作者元数据，未冒称全文通讯栏/);
    } else if (key === "pmc10845173") {
      assert.equal(source.url, "https://pmc.ncbi.nlm.nih.gov/articles/PMC10845173/");
      assert.equal(source.accessMethod, "browser");
      assert.match(contact.identityNote, /Contributor Information/);
    } else if (key.startsWith("pmc")) {
      assert.equal(source.url, `https://www.ebi.ac.uk/europepmc/webservices/rest/${key.toUpperCase()}/fullTextXML`);
      assert.equal(source.accessMethod, "web");
    } else {
      assert.equal(source.url, "https://atm.amegroups.org/article/view/78877/html");
      assert.match(contact.identityNote, /2021年历史地址/);
    }
  }
  assert.equal(data.sources.filter(s => s.id.startsWith("email-specialties-")).length, 22);
});

test("ambiguous shared fields, namesakes and secretarial contacts are not assigned", () => {
  const contacts = data.doctors.flatMap(d => d.contacts).filter(c => c.sourceId.startsWith("email-specialties-"));
  for (const email of ["bjpm-pku@bjmu.edu.cn", "changchun@bjmu.edu.cn", "si_gao@126.com",
    "puh3liweishi@bjmu.edu.cn", "xzheng@cpu.edu.cn", "xlzhang1225@126.com", "haipinghao@cpu.edu.cn"]) {
    assert.ok(!contacts.some(c => c.value === email), email);
  }
  const batchSourceIds = new Set(data.sources.slice(0, 1142).map(s => s.id));
  for (const id of ["puh3-xxgnk-3071", "puh3-hxywzzyxk-3532", "puh3-xhk-2301",
    "puh3-xhk-2251", "puh3-gk-1706", "puh3-zeng-yan"]) {
    assert.deepEqual(data.doctors.find(d => d.id === id).contacts.filter(c => batchSourceIds.has(c.sourceId)), []);
  }
  assert.match(data.doctors.find(d => d.id === "puh3-hxywzzyxk-4002").contacts[0].identityNote, /不是北京大学公共卫生学院/);
  assert.match(data.doctors.find(d => d.id === "puh3-gk-1742").contacts[0].identityNote, /另一位骨科医生周方/);
});

test("email progress increases by 23 without changing roster denominators or dates", () => {
  assert.deepEqual(planStats(coverage, data).email,
    { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  assert.equal(data.doctors.filter(d => d.hospitalId === "puh3").length, 903);
  assert.equal(data.doctors.filter(d => d.contacts.some(c => c.sourceId.startsWith("email-specialties-"))).length, 23);
});
