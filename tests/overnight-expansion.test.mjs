import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { CONTACT_SOURCE_LABELS, filterDoctors, validateDirectory } from "../public/directory.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("overnight expansion preserves all original biographies, sources and 63 verified contacts", () => {
  const original = data.doctors.slice(0, 101);
  assert.equal(digest(original.map(({ contacts, evidence, ...doctor }) => doctor)),
    "6fd9ad7c7fde6ddcbf1fe50f0a5cc598d413d51e9dc1a351ac868d2863e5aeb7");
  const sources = data.sources.slice(0, 174);
  assert.equal(digest(sources), "d65a174ceb2e5a95ba134851728472e9ca1dce9c2c5eaf1d789671a5958754d5");
  const sourceIds = new Set(sources.map(s => s.id));
  const oldContacts = original.filter(d => d.contacts.some(c => sourceIds.has(c.sourceId)))
    .map(({ id, contacts }) => ({ id, contacts }));
  assert.equal(oldContacts.length, 63);
  assert.equal(digest(oldContacts), "99327cf9e03e500f9cbc4bab11bba20abafd4d16bc746f5149cd4fcabc4ec44a");
});

test("all 22 remaining sports physicians have published identities linked to their official roster", () => {
  const names = ["张辛", "鞠晓东", "林霖", "刘玉雷", "赵峰", "谢兴", "何震明", "王永健", "罗浩",
    "梅宇", "陈临新", "程序", "皮彦斌", "邵振兴", "刘振龙", "王佳宁", "李玳", "刘阳",
    "黄洪杰", "史尉利", "代岭辉", "孟庆阳"];
  const list = coverage.pilots.find(p => p.hospitalId === "puh3").lists
    .find(l => l.department === "运动医学科");
  const entries = list.pages.slice(1, 3).flatMap(p => p.doctors);
  assert.deepEqual(new Set(entries.map(e => e.name)), new Set(names));
  for (const name of names) {
    const matches = data.doctors.filter(d => d.name === name && d.hospitalId === "puh3");
    assert.equal(matches.length, 1, name);
    const doctor = matches[0];
    const entry = entries.find(e => e.name === name);
    assert.equal(entry.directoryDoctorId, doctor.id);
    assert.equal(doctor.department, "运动医学科");
    const source = data.sources.find(s => s.id === doctor.profileSourceId);
    assert.equal(source.url, entry.profileUrl);
    assert.ok(doctor.experience.length > 0);
    assert.ok(doctor.evidence.some(e => e.sourceId === source.id && e.fields.includes("experience")));
  }
  assert.equal(entries.length, 22);
  assert.equal(data.doctors.filter(d => d.name === "崔国庆").length, 1);
});

test("rheumatology captures seven official expert profiles without treating 28 staff as doctors", () => {
  const expected = [
    ["穆荣", "1001"], ["赵金霞", "1021"], ["姚中强", "1031"], ["刘蕊", "1041"],
    ["张警丰", "1051"], ["张晓盈", "10391"], ["魏慧", "10431"],
  ];
  const doctors = filterDoctors(data, { hospitalId: "puh3", department: "风湿免疫科" });
  assert.equal(doctors.length, 7);
  const pilot = coverage.pilots.find(p => p.hospitalId === "puh3");
  const list = pilot.lists.find(l => l.department === "风湿免疫科");
  assert.equal(list.status, "captured");
  assert.equal(list.declaredDoctorCount, 7);
  assert.equal(list.declaredPageCount, 1);
  assert.equal(list.pages.length, 1);
  assert.equal(list.pages[0].doctors.length, 7);
  assert.match(list.note, /28.*不能.*医生总数/);
  assert.equal(pilot.rosterComplete, false);
  for (const [name, page] of expected) {
    const doctor = doctors.find(d => d.name === name);
    const source = data.sources.find(s => s.id === doctor.profileSourceId);
    assert.equal(source.url, `https://www.puh3.net.cn/fsmyk/info/1004/${page}.htm`);
    assert.equal(doctor.experience.length, 2);
    assert.ok(doctor.experience.join("").length >= 150, name);
    assert.equal(list.pages[0].doctors.find(e => e.name === name).directoryDoctorId, doctor.id);
  }
  assert.match(doctors.find(d => d.name === "赵金霞").profileNote, /旧条目/);
  assert.match(doctors.find(d => d.name === "张晓盈").profileNote, /未核实.*排班/);
  assert.match(doctors.find(d => d.name === "魏慧").profileNote, /援藏/);
});

test("17 second-page sports emails retain exact author ownership, dates and source representation", () => {
  const expected = [
    ["张辛", "xinzhang0805@bjmu.edu.cn", "41412297", 2026],
    ["鞠晓东", "jxd1204@163.com", "39510205", 2025],
    ["林霖", "simon.lin2003@163.com", "24337464", 2015],
    ["刘玉雷", "liuyuleiok@sina.com", "38704572", 2024],
    ["赵峰", "tihi@vip163.com", "PMC10867664", 2024],
    ["谢兴", "mxxbj@126.com", "PMC12966508", 2026],
    ["何震明", "hezhenming@outlook.com", "PMC4437927", 2015],
    ["王永健", "wangpeking@gmail.com", "PMC7495937", 2020],
    ["程序", "drcx@vip.163.com", "PMC13435461", 2026],
    ["皮彦斌", "piyb@vip.sina.com", "37749543", 2023],
    ["邵振兴", "shaozhenxing@bjmu.edu.cn", "40074196", 2025],
    ["刘振龙", "zhenlong_liu@bjmu.edu.cn", "42067471", 2026],
    ["李玳", "emilylidai@163.com", "PMC13216035", 2026],
    ["黄洪杰", "hhj@bjmu.edu.cn", "42086187", 2026],
    ["史尉利", "shiweilibjmu@126.com", "42570848", 2026],
    ["代岭辉", "dlh110@163.com", "26104414", 2015],
    ["孟庆阳", "mengqingyang@bjmu.edu.cn", "39321698", 2024],
  ];
  for (const [name, address, identifier, year] of expected) {
    const owners = data.doctors.filter(d => d.contacts.some(c => c.value === address));
    assert.deepEqual(owners.map(d => d.name), [name]);
    const contact = owners[0].contacts[0];
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.ok(source.url.includes(identifier), name);
    assert.equal(source.kind, "journal-article");
    assert.equal(source.publishedYear, year);
    assert.match(contact.identityNote, /未.*收信/);
    if (!identifier.startsWith("PMC")) {
      assert.equal(new URL(source.url).searchParams.get("query"), `EXT_ID:${identifier} AND SRC:MED`);
    }
  }
  const historicalSourceIds = new Set(data.sources.slice(0, 306).map(s => s.id));
  for (const name of ["罗浩", "梅宇", "陈临新", "王佳宁", "刘阳"]) {
    assert.deepEqual(data.doctors.find(d => d.name === name && d.hospitalId === "puh3").contacts
      .filter(c => historicalSourceIds.has(c.sourceId)), []);
  }
  assert.ok(!data.doctors.find(d => d.name === "林霖").contacts.some(c => c.value === "yanhui@puh3.net.cn"));
  assert.ok(!data.doctors.find(d => d.name === "刘阳").contacts.some(c => c.value === "yliu_pu3h@bjmu.edu.cn"));
  assert.match(data.doctors.find(d => d.name === "刘玉雷").profileNote, /副主任医师/);
  assert.match(data.doctors.find(d => d.name === "鞠晓东").profileNote, /歧义/);
});

test("rheumatology email evidence preserves author ownership and excludes namesake and coauthor addresses", () => {
  const expected = [
    ["穆荣", "murongster@163.com", "https://sklffp.puh3.net.cn/info/1058/5472.htm", null],
    ["赵金霞", "zhaojinxia@bjmu.edu.cn", "42307680", 2026],
    ["姚中强", "yaozhongqiang@sina.com", "40493318", 2025],
  ];
  for (const [name, email, identifier, year] of expected) {
    const doctor = data.doctors.find(d => d.name === name && d.hospitalId === "puh3");
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.equal(contact.value, email);
    assert.match(contact.identityNote, /北京大学第三医院/);
    assert.match(contact.identityNote, /未测试收信/);
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.ok(source.url.includes(identifier));
    if (year === null) assert.equal(source.kind, "university-profile");
    else {
      assert.equal(source.kind, "journal-article");
      assert.equal(source.publishedYear, year);
      assert.equal(new URL(source.url).searchParams.get("query"), `EXT_ID:${identifier} AND SRC:MED`);
    }
  }
  const historicalSources = new Set(data.sources.slice(0, 228).map(s => s.id));
  for (const name of ["刘蕊", "张警丰", "张晓盈", "魏慧"]) {
    const doctor = data.doctors.find(d => d.name === name && d.hospitalId === "puh3");
    assert.deepEqual(doctor.contacts.filter(c => historicalSources.has(c.sourceId)), []);
  }
  const emails = data.doctors.flatMap(d => d.contacts.map(c => c.value));
  for (const rejected of ["lratb1@aliyun.com", "drliur@126.com", "13922830163@139.com",
    "1416999724@qq.com", "bysy@bjmu.edu.cn", "liwen@buaa.edu.cn", "liumj@buaa.edu.cn"]) {
    assert.ok(!emails.includes(rejected), rejected);
  }
});

test("the original 38 email gaps gain exactly five independently sourced contacts", () => {
  const historicalSources = new Set(data.sources.slice(0, 174).map(s => s.id));
  const batchSources = new Set(data.sources.slice(174, 228).map(s => s.id));
  const snapshotSources = new Set(data.sources.slice(0, 228).map(s => s.id));
  const additions = data.doctors.slice(0, 101)
    .filter(d => d.contacts.some(c => !historicalSources.has(c.sourceId) && batchSources.has(c.sourceId)));
  assert.deepEqual(new Set(additions.map(d => d.name)), new Set(["王崇慧", "程康安", "李红武", "肖健", "滕雅群"]));
  assert.equal(data.doctors.slice(0, 101).filter(d => !d.contacts.some(c => snapshotSources.has(c.sourceId))).length, 33);
  assert.equal(data.doctors.slice(0, 130).filter(d => !d.contacts.some(c => snapshotSources.has(c.sourceId))).length, 42);
  const expected = [
    ["王崇慧", "pumchwangch@126.com", "27907885", 2017],
    ["程康安", "chengkangan@hotmail.com", "14636464", 2003],
    ["李红武", "lhw3948@126.com", "2054-2061-1.pdf", 2020],
    ["肖健", "xiaojian1968@163.com", "25240814", 2015],
  ];
  for (const [name, value, identifier, year] of expected) {
    const owners = data.doctors.filter(d => d.contacts.some(c => c.value === value));
    assert.deepEqual(owners.map(d => d.name), [name]);
    const contact = owners[0].contacts[0];
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.ok(source.url.includes(identifier));
    assert.equal(source.publishedYear, year);
    assert.match(contact.identityNote, /未测试收信/);
  }
  assert.match(additions.find(d => d.name === "李红武").contacts[0].identityNote, /学历表述存在差异/);
});

test("a trial scientific contact is labeled separately from journal authors and hospital footers", () => {
  const doctor = data.doctors.find(d => d.name === "滕雅群");
  const contact = doctor.contacts[0];
  assert.equal(contact.value, "tengyaqun@126.com");
  const source = data.sources.find(s => s.id === contact.sourceId);
  assert.equal(source.kind, "clinical-trial-registry");
  assert.equal(CONTACT_SOURCE_LABELS[source.kind], "临床试验登记科研联系信息");
  assert.equal(source.url, "https://trialsearch.who.int/Trial2.aspx?TrialID=ChiCTR2500098202");
  assert.equal(source.sourceUpdatedAt, "2025-03-10");
  assert.equal(source.publishedYear, undefined);
  assert.match(contact.identityNote, /Scientific Contact.*北京协和医院心内科/);
  assert.match(contact.identityNote, /2025-03-04/);
  assert.ok(doctor.evidence.some(e => e.sourceId === source.id && e.fields.includes("contacts")));
  assert.deepEqual(validateDirectory(data), []);
  const invalid = structuredClone(data);
  invalid.sources.find(s => s.id === source.id).kind = "unverified-contact";
  assert.match(validateDirectory(invalid).join("\n"), /联系方式来源类型无效/);
});
