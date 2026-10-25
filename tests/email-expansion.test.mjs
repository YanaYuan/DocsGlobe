import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { emailContactHref } from "../public/directory.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const expected = [
  ["敖英芳", "aoyingfang@163.com", "tjus-ao-yingfang-contact", null],
  ["王健全", "wjqsportsmed@163.com", "PMC13612774", 2026],
  ["闫辉", "yanhui@puh3.net.cn", "PMC12322743", 2025],
  ["龚熹", "gongxi518@163.com", "PMC13447984", 2026],
  ["徐雁", "yanxu@139.com", "PMC13176588", 2026],
  ["郭秦炜", "guoqinwei@vip.sina.com", "PMC13418591", 2026],
  ["焦晨", "jiaoshuj@mail.tsinghua.edu.cn", "PMC13554615", 2026],
  ["刘平", "bjusmlp@126.com", "PMC12801008", 2025],
  ["黄红拾", "huanghs@bjmu.edu.cn", "PMC12881305", 2026],
  ["马勇", "huidong01@sina.com", "PMC11022449", 2024],
  ["江东", "Dong_jiang@bjmu.edu.cn", "PMC13554615", 2026],
  ["杨渝平", "yyyyppvip@sina.com", "PMC13104289", 2026],
  ["印钰", "13501174894@qq.com", "PMC8377324", 2021],
  ["王成", "pkuwang@yeah.net", "PMC12511731", 2025],
  ["王海军", "bysywang@163.com", "PMC11046295", 2024],
  ["杨延砚", "yyykaixin@163.com", "PMC12309270", 2025],
  ["刘小璇", "Lucyan_liu@bjmu.edu.cn", "PMC13452721", 2026],
  ["方全", "13801371164@163.com", "PMC12927242", 2026],
  ["陈太波", "chentb@pumch.cn", "PMC12927242", 2026],
  ["金晓峰", "xhjxf@aliyun.com", "PMC10749349", 2023],
  ["朱燕林", "zhuyanlin@hotmail.com", "PMC5728894", 2017],
  ["田然", "ron_tian@163.com", "PMC13519092", 2026],
  ["刘颖娴", "liuyingxian@pumch.com", "PMC9283712", 2022],
  ["白桦", "baih@pumch.cn", "PMC13044639", 2026],
  ["杨静", "yj_pumch@126.com", "PMC4683955", 2015],
  ["朱园园", "piglet819@163.com", "PMC12873658", 2026],
  ["杨杏林", "yangxinglindz@163.com", "PMC13206809", 2026],
  ["廉慧", "lianhui@pumch.cn", "PMC13607141", 2026],
  ["胡跃林", "sportshyl@sina.com", "28389877", 2018],
  ["王健", "wangjiansy@googlemail.com", "19501293", 2009],
  ["程中伟", "zhongwei_cheng@hotmail.com", "23273342", 2013],
  ["高鹏", "drgao7094@sina.com", "35589080", 2022],
  ["王辉", "huiwang097@163.com", "33810955", 2021],
  ["杨明", "yangming@pumch.cn", "39261167", 2024],
];

test("34 reviewed contacts retain exact ownership, source representation and publication years", () => {
  assert.equal(expected.length, 34);
  for (const [name, value, identifier, year] of expected) {
    const owners = data.doctors.filter(d => d.contacts.some(c => c.value === value));
    assert.deepEqual(owners.map(d => d.name), [name]);
    const contact = owners[0].contacts[0];
    const source = data.sources.find(s => s.id === contact.sourceId);
    assert.equal(emailContactHref(value), `mailto:${value}`);
    assert.equal(contact.purpose, "academic");
    assert.match(contact.identityNote, /北京协和医院|北京大学第三医院|北医三院/);
    assert.match(contact.identityNote, /未测试收信/);
    assert.ok(owners[0].evidence.some(e => e.sourceId === source.id && e.fields.includes("contacts")));
    assert.ok(source.title.includes(name));
    assert.equal(source.accessedAt, "2026-10-08");
    if (year === null) {
      assert.equal(source.kind, "university-profile");
      assert.equal(source.url, "https://yjsb.tjus.edu.cn/info/1031/4053.htm");
      assert.equal(source.sourceUpdatedAt, "2022-10-12");
    } else {
      assert.equal(source.kind, "journal-article");
      assert.equal(source.publishedYear, year);
      assert.equal(source.accessMethod, "web");
      assert.equal(source.sourceUpdatedAt, null);
      const url = new URL(source.url);
      assert.equal(url.hostname, "www.ebi.ac.uk");
      if (identifier.startsWith("PMC")) assert.ok(url.pathname.endsWith(`/${identifier}/fullTextXML`));
      else {
        assert.equal(url.searchParams.get("query"), `EXT_ID:${identifier} AND SRC:MED`);
        assert.equal(url.searchParams.get("resultType"), "core");
      }
    }
  }
});

test("shared papers do not share addresses and namesake emails remain excluded", () => {
  for (const names of [["方全", "陈太波"], ["焦晨", "江东"]]) {
    const contacts = names.map(name => data.doctors.find(d => d.name === name).contacts[0]);
    assert.equal(contacts[0].sourceId, contacts[1].sourceId);
    assert.notEqual(contacts[0].value, contacts[1].value);
  }
  const stored = new Set(data.doctors.flatMap(d => d.contacts.map(c => c.value)));
  for (const address of [
    "zhangna9902@pku.edu.cn", "xfxj2000@126.com", "whjun1@bjmu.edu.cn",
    "zy7311@sohu.com", "puth_zy73@163.com",
    "yangmier@gmail.com", "yangjing@pumch.cn", "ttyywangliang@sohu.com",
    "598303365@qq.com", "sjz@cau.edu.cn", "qfang@bupt.edu.cn", "taibo_chen@jlu.edu.cn",
    "bysy@bjmu.edu.cn", "zymf@pku.edu.cn",
  ]) assert.ok(!stored.has(address), address);
  assert.deepEqual(data.doctors.filter(doctor => doctor.contacts.some(contact =>
    contact.value === "wangchengbjmu@bjmu.edu.cn")).map(doctor => doctor.id), ["puh3-gk-6623"]);
  assert.equal(data.doctors.find(d => d.name === "刘颖娴").contacts[0].value, "liuyingxian@pumch.com");
  assert.match(data.doctors.find(d => d.name === "王健").contacts[0].identityNote, /2009.*较旧/);
});

test("the first email batch retains all 63 historical contact sources and its original biographies", () => {
  const historicalDoctors = data.doctors.slice(0, 101);
  const historicalSources = new Set(data.sources.slice(0, 174).map(s => s.id));
  const contacts = historicalDoctors.flatMap(d => d.contacts).filter(c => historicalSources.has(c.sourceId));
  assert.equal(contacts.length, 63);
  assert.equal(contacts.filter(c => data.sources.find(s => s.id === c.sourceId).kind === "university-profile").length, 27);
  assert.equal(contacts.filter(c => data.sources.find(s => s.id === c.sourceId).kind === "journal-article").length, 36);
  const additions = new Set(expected.map(([name]) => name));
  assert.equal(historicalDoctors.filter(d => !additions.has(d.name) &&
    d.contacts.some(c => historicalSources.has(c.sourceId))).length, 29);
  assert.equal(historicalDoctors.filter(d => d.experience.length >= 2).length, 96);
});
