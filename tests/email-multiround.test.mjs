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
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const metadata = [
  ["马志中", "puh3_YK@bjmu.edu.cn", "35147748"],
  ["陈跃国", "chenyueguo@263.net", "38408954"],
  ["王常观", "docwcg@126.com", "37254066"],
  ["陈晓勇", "dr_chxy@126.com", "42678560"],
  ["王毅", "1053889636@qq.com", "42288851"],
  ["布娟", "bujuan110@163.com", "32279089"],
  ["窦宏亮", "douhongliang@puh3.net.cn", "41520174"],
  ["吴玲玲", "drwulingling@163.com", "42334531"],
  ["陈慧瑾", "chjdoc@aliyun.com", "41530316"],
  ["张钰", "1494867399@qq.com", "41087277"],
  ["彭荣梅", "pengrongmei@bjmu.edu.cn", "40020519"],
  ["刘瑜玲", "zqdodo@bjmu.edu.cn", "15944829"],
  ["赵素焱", "13512094662@126.com", "26874172"],
  ["赵琳", "ophzhaol@163.com", "32192468"],
  ["洪颖", "drhongying@bjmu.edu.cn", "38594720"],
  ["孙岩秀", "yxs0283@yahoo.com", "33691454"],
  ["侯志强", "justinhou2004@126.com", "33030670"],
  ["肖格格", "2476695497@qq.com", "32554307"],
  ["陆遥", "delichoc@sina.com", "39147192"],
  ["刘子源", "ziyuanliu@126.com", "39609730"],
  ["董栩然", "xurand@bjmu.edu.cn", "40185384"],
  ["王薇", "Puh3_ww@bjmu.edu.cn", "29169899"],
  ["王霄", "bysywangxiao@163.com", "40739139"],
  ["马宁", "kqmn@sina.com", "42816847"],
  ["郑旭", "zhengxu_allen@sina.com", "18677394"],
  ["李选", "xuanli@vip.sina.com", "39138303"],
  ["栾景源", "drluan@139.com", "39674271"],
  ["王昌明", "wangchangming@bjmu.edu.cn", "39674271"],
  ["韩金涛", "bmucystal@163.com", "38663515"],
  ["张龙", "longzh2000@163.com", "38538716"],
  ["贺慧颖", "huiyinghe@bjmu.edu.cn", "31020542"],
  ["裴斐", "peifei@bjmu.edu.cn", "30173944"],
  ["苏静", "sujing@bjmu.edu.cn", "33974996"],
  ["陆敏", "lumin@bjmu.edu.cn", "38242750"],
  ["张波", "zhangbo@bjmu.edu.cn", "30030778"],
  ["高子芬", "wjshgao@bjmu.edu.cn", "18949449"],
  ["石雪迎", "shixueying@bjmu.edu.cn", "25765028"],
  ["邹万忠", "cliff_ZOU@sina.com", "25582250"],
  ["刘岩", "laylaly@126.com", "36001209"],
  ["宋乐", "songle1983@qq.com", "25496669"],
];
const fulltexts = [
  ["田彦杰", "fygeneral@sina.com", "pmc11378217", 2024],
  ["文静", "w_jing89@yeah.net", "pmc9645362", 2022],
  ["郑杰", "zhengjie@bjmu.edu.cn", "pmc4337100", 2015],
  ["刘翠苓", "zhang990929@yahoo.com.cn", "pmc4337100", 2015],
  ["朱翔", "zj_summer2@163.com", "pmc4337100", 2015],
  ["田新霞", "tianxinxia@163.com", "pmc10711256", 2024],
  ["修典荣", "Xiudianrong@163.com", "pmc4337100", 2015],
  ["李军", "yanwt2003@163.com", "pmc11004963", 2024],
];
const doctor = name => {
  const matches = data.doctors.filter(d => d.hospitalId === "puh3" && d.name === name);
  assert.equal(matches.length, 1, name);
  return matches[0];
};

test("multi-round batch preserves 971 biographies, 265 contacts and all 1221 previous sources", () => {
  const sources = data.sources.slice(0, 1221);
  const ids = new Set(sources.map(s => s.id));
  const historical = beforeCrossfieldContacts(data).map(d => ({
    ...d, contacts: d.contacts.filter(c => ids.has(c.sourceId)),
    evidence: d.evidence.filter(e => ids.has(e.sourceId)),
  }));
  assert.equal(digest(historical), "4809f85558d4d1aeaa1c987bfc8a248fc03cbdea68c527281e0e9ebd77887ee4");
  assert.equal(digest(sources), "e4ec660602eeca7d4e582ba27cd82f598e477e7b8edeb135d99d946bb1ffbbfc");
  assert.equal(historical.filter(d => d.contacts.length).length, 265);
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1563);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("48 exact public academic contacts retain named source ownership and representation", () => {
  const expected = [...metadata.map(([name, email, id]) => [name, email, `pmid${id}`]), ...fulltexts];
  for (const [name, email, key, year] of expected) {
    const d = doctor(name);
    assert.equal(d.contacts.length, 1);
    const c = d.contacts[0];
    assert.equal(c.value, email);
    assert.equal(c.sourceId, `email-multiround-${key}`);
    assert.equal(c.purpose, "academic");
    assert.match(c.identityNote, /未测试收信/);
    const s = data.sources.find(s => s.id === c.sourceId);
    assert.equal(s.kind, "journal-article");
    assert.equal(s.accessedAt, "2026-10-10");
    assert.equal(s.sourceUpdatedAt, null);
    assert.ok(d.evidence.some(e => e.sourceId === s.id && e.fields.join() === "contacts"));
    if (key.startsWith("pmid")) {
      assert.equal(new URL(s.url).searchParams.get("query"), `EXT_ID:${key.slice(4)} AND SRC:MED`);
      assert.equal(s.accessMethod, "web");
    } else {
      assert.equal(s.publishedYear, year);
      assert.equal(s.accessMethod, key === "pmc11004963" ? "browser" : "web");
      assert.equal(s.url, key === "pmc11004963" ?
        "https://pmc.ncbi.nlm.nih.gov/articles/PMC11004963/" :
        `https://www.ebi.ac.uk/europepmc/webservices/rest/${key.toUpperCase()}/fullTextXML`);
    }
    assert.deepEqual(data.doctors.filter(d => d.contacts.some(c => c.value === email)).map(d => d.id), [d.id]);
  }
});

test("historical affiliations, Chinese identity corroboration and source years are explicit", () => {
  assert.match(doctor("文静").contacts[0].identityNote, /第一医院小儿眼科.*2015年/);
  assert.equal(doctor("文静").id, "puh3-yk-7392");
  assert.match(doctor("张波").contacts[0].identityNote, /双重任职/);
  assert.match(doctor("高子芬").contacts[0].identityNote, /不把文献单位改写为三院/);
  const shi = doctor("石雪迎");
  assert.match(shi.contacts[0].identityNote, /仅列邮箱，未列本人单位/);
  assert.ok(shi.evidence.some(e => e.sourceId === "email-multiround-pmc11004963"));
  assert.notEqual(shi.contacts[0].value, doctor("李军").contacts[0].value);
  for (const [name, year] of [["刘瑜玲", 2005], ["郑旭", 2008], ["高子芬", 2008], ["邹万忠", 2014], ["宋乐", 2015]]) {
    const c = doctor(name).contacts[0];
    assert.equal(data.sources.find(s => s.id === c.sourceId).publishedYear, year);
    assert.match(c.identityNote, new RegExp(`${year}年论文公开地址`));
  }
});

test("paging discoveries go to the correct namesake and malformed or shared candidates remain absent", () => {
  assert.equal(doctor("刘岩").department, "病理科");
  assert.equal(doctor("刘岩").contacts[0].value, "laylaly@126.com");
  for (const name of ["刘彦", "刘嫣", "钟延丰", "梁士凯", "王琛", "田磊", "万伟"]) {
    assert.deepEqual(beforeJournal(data).doctors.find(item => item.id === doctor(name).id).contacts, [], name);
  }
  assert.equal(doctor("张倩").contacts[0].sourceId, "email-author-pmid16848817");
  assert.ok(doctor("张倩").contacts.every(contact => !contact.sourceId.startsWith("email-multiround-")));
  const added = data.doctors.flatMap(d => d.contacts).filter(c => c.sourceId.startsWith("email-multiround-"));
  for (const email of ["zhongyf@bjmu.edc", "zhongyf@bjmu.edu.cn", "liangshikai90@126.com",
    "zhangbopumch@163.com", "bysywangwei@163.com", "zhangping332@hsc.pku.edu.cn"]) {
    assert.ok(!added.some(c => c.value === email), email);
  }
});

test("45 priority-cohort and three reverse-matched contacts share 44 sources without changing the roster", () => {
  const cohort = data.doctors.filter(d => d.hospitalId === "puh3" &&
    ["眼科", "口腔科", "介入血管外科", "病理科"].includes(d.department));
  assert.equal(cohort.length, 125);
  assert.equal(cohort.filter(d => d.contacts.length).length, 76);
  for (const [department, current] of [["眼科", 43], ["口腔科", 7], ["介入血管外科", 8], ["病理科", 18]]) {
    assert.equal(cohort.filter(d => d.department === department && d.contacts.length).length, current);
  }
  const sources = data.sources.filter(s => s.id.startsWith("email-multiround-"));
  assert.equal(sources.length, 44);
  assert.equal(sources.filter(s => s.id.includes("-pmid")).length, 39);
  assert.equal(data.doctors.filter(d => d.contacts.some(c => c.sourceId === "email-multiround-pmc4337100")).length, 4);
  assert.equal(data.doctors.filter(d => d.contacts.some(c => c.sourceId === "email-multiround-pmid39674271")).length, 2);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
});
