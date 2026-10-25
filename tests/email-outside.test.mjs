import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeGraduate } from "./helpers/email-graduate.mjs";
import { beforeCrossfieldContacts } from "./helpers/email-crossfield.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const prefix = "email-outside-";
const groups = [
  ["骨科", [
    ["王少波", "Puthwangshaobo@163.com", "pmid32033548"],
    ["齐强", "qiqiang_puth@sohu.com", "pmid16784636"],
    ["郭昭庆", "gzq6698@sina.com", "pmid35395763"],
    ["刘延青", "liuyanqing71@126.com", "pmid36882789"],
    ["张志山", "ltlxl@sina.com", "pmid34789313"],
    ["李子剑", "li_zijian@bjmu.edu.cn", "pmid40266310"],
    ["李锋", "fengli@bjmu.edu.cn", "pmid41965683"],
    ["刁垠泽", "diaoyz@163.com", "pmid18767055"],
    ["陈欣", "chenxinbjmu@hotmail.com", "pmid40494501"],
    ["赵衍斌", "dageb@aliyun.com", "pmid34923190"],
    ["赵旻暐", "zmw@bjmu.edu.cn", "pmid41512929"],
    ["党礌", "danglei_2000@yahoo.com", "pmid22732826"],
    ["郭琰", "drguoy@bjmu.edu.cn", "pmid25818053"],
    ["周华", "zhouhua@bjmu.edu.cn", "pmid38438448"],
    ["李彦", "liyan03@bjmu.edu.cn", "pmid33780869"],
    ["刘啸", "lx86831@163.com", "pmid41194118"],
    ["侯国进", "pkuhgj@163.com", "pmid25205645"],
    ["唐彦超", "ychtang_0919@sina.cn", "pmid35729194"],
    ["郭新虎", "guoxinhu007@foxmail.com", "pmid39044021"],
    ["胡攀攀", "pphu@bjmu.edu.cn", "pmid42060212"],
    ["李梓赫", "skyhealth@qq.com", "pmid38532182"],
    ["司高", "si_gao@126.com", "pmid42784980"],
    ["祝腾蛟", "Zhutj@bjmu.edu.cn", "pmid41957767"],
    ["吴奉梁", "fengliangwu@126.com", "pmc4974757"],
    ["王龙杰", "wangjianing0125@126.com", "pmc7818723"],
    ["姜帅", "1102267823@qq.com", "pmc7818723"],
  ]],
  ["妇产科", [
    ["杨怡珂", "yang_yk@msn.com", "pmid41455355"],
    ["杨静", "wingman_yj@163.com", "pmid41645136"],
    ["王学举", "wangxueju006@sina.com", "pmid38037010"],
    ["姚颖", "alexbeauty@163.com", "pmid36183056"],
    ["杨孜", "zi_yang2005@126.com", "pmid26582505"],
    ["耿力", "gengli1957@bjmu.edu.cn", "pmid26769181"],
    ["梁华茂", "liang_bj@163.com", "pmid42167122"],
    ["王晓晔", "wxydg2007@126.com", "pmid37380910"],
    ["王威", "bysywangwei@163.com", "pmid40122801"],
    ["吴郁", "pheonix1997@163.com", "pmid41489095"],
    ["贺豪杰", "haojiehe@yahoo.com", "pmid40680910"],
    ["王一婷", "bysywangyiting@126.com", "pmid39736647"],
  ]],
];
const expected = groups.flatMap(([department, rows]) => rows.map(([name, email, key]) => ({ name, department, email, key })));
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const doctor = (name, department) => {
  const matches = data.doctors.filter(d => d.name === name && d.department === department && d.hospitalId === "puh3");
  assert.equal(matches.length, 1, `${name} ${department}`);
  return matches[0];
};

test("outside-route research preserves every original profile, 444 old email holders and 1389 old sources", () => {
  const historicalSourceIds = new Set(data.sources.slice(0, 1389).map(s => s.id));
  const historical = beforeCrossfieldContacts(data).map(d => ({
    ...d, contacts: d.contacts.filter(c => historicalSourceIds.has(c.sourceId)),
    evidence: d.evidence.filter(e => historicalSourceIds.has(e.sourceId)),
  }));
  assert.equal(digest(historical), "05f6ff004e640bb078fd8d4332d9e4e4650eeca97adde360644c1eeaf74e449b");
  assert.equal(digest(data.sources.slice(0, 1389)), "4492262f2a913c5eabc309a84b5017149b1250dc9b63cc212e4534a227d06696");
  assert.equal(historical.filter(d => d.contacts.length).length, 444);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("38 exact contacts have individual evidence, preserved casing and correctly typed sources", () => {
  assert.equal(expected.length, 38);
  for (const { name, department, email, key } of expected) {
    const d = doctor(name, department);
    assert.equal(d.contacts.length, 1);
    const c = d.contacts[0];
    assert.equal(c.value, email, name);
    assert.equal(c.type, "email");
    assert.equal(c.purpose, "academic");
    assert.equal(c.sourceId, prefix + key);
    assert.match(c.identityNote, /未测试收信/);
    assert.ok(d.evidence.some(e => e.sourceId === c.sourceId && e.fields.join() === "contacts"));
    assert.deepEqual(data.doctors.filter(x => x.contacts.some(c => c.value.toLowerCase() === email.toLowerCase())).map(x => x.id), [d.id]);
    const s = data.sources.find(s => s.id === c.sourceId);
    assert.equal(s.kind, "journal-article");
    assert.equal(s.accessedAt, "2026-10-13");
    assert.equal(s.sourceUpdatedAt, null);
    if (key.startsWith("pmid")) {
      assert.equal(new URL(s.url).searchParams.get("query"), `EXT_ID:${key.slice(4)} AND SRC:MED`);
    } else assert.ok(s.url.endsWith(`${key.toUpperCase()}/fullTextXML`));
  }
});

test("contributor information does not transfer contacts by similar romanization or mailbox username", () => {
  const prior = beforeGraduate(data);
  assert.match(doctor("吴奉梁", "骨科").contacts[0].identityNote, /个人contrib.*节点直接嵌入.*Aff1/);
  assert.match(doctor("王龙杰", "骨科").contacts[0].identityNote, /Contributor Information.*Longjie Wang.*不把该地址分配给.*王佳宁/);
  assert.match(doctor("姜帅", "骨科").contacts[0].identityNote, /Contributor Information.*Shuai Jiang.*并非前部email标签/);
  assert.deepEqual(doctor("王佳宁", "运动医学科").contacts, []);
  assert.deepEqual(doctor("王程", "骨科").contacts
    .filter(contact => !contact.sourceId.startsWith("email-mentor-round2-")), []);
  assert.equal(doctor("王成", "运动医学科").contacts[0].value, "pkuwang@yeah.net");
  assert.match(doctor("李子剑", "骨科").contacts[0].identityNote, /心血管研究者.*区分/);
  for (const [name, department] of [
    ["张立", "骨科"], ["许婕", "骨科"], ["袁磊", "骨科"], ["刘露", "妇产科"],
  ]) assert.deepEqual(prior.doctors.find(item => item.id === doctor(name, department).id).contacts
    .filter(contact => !contact.sourceId.startsWith("email-mentor-round2-")), []);
  assert.equal(doctor("张龑", "妇产科").contacts[0].sourceId, "email-author-pmid35315023");
  assert.ok(doctor("张龑", "妇产科").contacts.every(contact => !contact.sourceId.startsWith(prefix)));
});

test("online publication precedes the future print issue and historic emails retain their dates", () => {
  const si = doctor("司高", "骨科").contacts[0];
  assert.match(si.identityNote, /2026-09-21.*2027年1月.*在线发表年/);
  assert.equal(data.sources.find(s => s.id === si.sourceId).publishedYear, 2026);
  for (const [name, year] of [["齐强", 2006], ["刁垠泽", 2009], ["党礌", 2012]]) {
    assert.equal(data.sources.find(s => s.id === doctor(name, "骨科").contacts[0].sourceId).publishedYear, year);
  }
  assert.match(doctor("李锋", "骨科").contacts[0].identityNote, /ifmed与lfmed.*不修正/);
});

test("outside batch shares 37 sources and its historical rounded 50 percent was below half", () => {
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1563);
  assert.equal(data.sources.filter(s => s.id.startsWith(prefix)).length, 37);
  assert.equal(data.doctors.filter(d => d.contacts.some(c => c.sourceId === prefix + "pmc7818723")).length, 2);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.ok(482 / 971 < 0.5);
  assert.equal(coverage.updatedAt, "2026-10-09");
  for (const [department, total, current] of [["骨科", 75, 65], ["妇产科", 50, 28]]) {
    const doctors = data.doctors.filter(d => d.hospitalId === "puh3" && d.department === department);
    assert.equal(doctors.length, total);
    assert.equal(doctors.filter(d => d.contacts.length).length, current);
  }
});
