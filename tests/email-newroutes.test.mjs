import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDirectory } from "../public/directory.mjs";
import { planStats } from "../public/coverage.mjs";
import { beforeCrossfieldContacts } from "./helpers/email-crossfield.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const groups = [
  ["普通外科", [
    ["徐智", "xuzhi123456@sohu.com", "pmid32807617"],
    ["凌晓锋", "xiaofengling2005@126.com", "pmid42720905"],
    ["王立新", "wanglx823@sohu.com", "pmid32807617"],
    ["赵红梅", "hongmeizhaobysy@163.com", "pmid41402452"],
    ["张志鹏", "zhangzhipeng06@126.com", "pmid40424845"],
    ["张铃福", "zhanglingfu@bjmu.edu.cn", "pmid42720905"],
    ["李欣", "surgeon_bmu@bjmu.edu.cn", "pmid42546564"],
    ["崔龙", "cuilong1978@163.com", "pmid32807617"],
    ["周鑫", "zhouxinasd@sina.cn", "pmid42618801"],
    ["王港", "pkutchmwg@sina.com", "pmid32807617"],
    ["马朝来", "mazhaolai@sohu.com", "pmc3765743"],
    ["李磊", "drlilei223@sina.com", "pmc3765743"],
  ]],
  ["成形外科", [
    ["赵振民", "zzmbysy@sina.com", "pmid42401927"],
    ["李东", "lidong9@sina.com", "pmid36042025"],
    ["李比", "libi0377@sina.com", "pmid39542893"],
    ["薛红宇", "xuehongyu_x@163.com", "pmid32122765"],
    ["谢宏彬", "cs4811@aliyun.com", "pmid41073791"],
    ["夏有辰", "xiayouchen@126.com", "pmid42765643"],
    ["杨欣", "yangxin6@126.com", "pmid40598376"],
    ["潘柏林", "purlin_pan@sina.com", "pmid32868262"],
    ["安阳", "anyangdoctor@163.com", "pmid42823514"],
    ["赵润蕾", "runleizhao@outlook.com", "pmid38729047"],
    ["张辰", "zhangchenpumc@qq.com", "pmid39243057"],
    ["秦泽莲", "qinzl@bjmu.edu.cn", "pmid32713826"],
    ["张沛阳", "zpymedic@163.com", "pmid40598376"],
  ]],
  ["神经内科", [
    ["杨琼", "yangqiongputh@126.com", "pmid39849200"],
    ["徐迎胜", "xys@bjmu.edu.cn", "pmid40373763"],
    ["王宏利", "Hongli-77@263.net", "reused-pmid29169899"],
    ["叶珊", "yeshanbysy@163.com", "pmid41765997"],
    ["顾卫红", "jane55.gu@vip.sina.com", "pmid32889669"],
    ["崔德华", "dchui@bjmu.edu.cn", "cui-university"],
  ]],
  ["消化科", [
    ["杨雪松", "yangxuesong@bjmu.edu.cn", "pmid24557675"],
    ["夏志伟", "xiazhiwei@medmail.com.cn", "pmid21418829"],
    ["张莉", "zldrysn@163.com", "pmid25886790"],
    ["常虹", "changhong_69@163.com", "pmid37592046"],
    ["薛艳", "xueyanby@163.com", "pmid34321854"],
  ]],
  ["口腔科", [["李志刚", "lizhigang_99@yahoo.com", "pmid20143035"]]],
  ["肾脏内科", [
    ["何莲", "ducklinghe@sina.com", "pmid35644015"],
    ["毕书红", "bishh6690@aliyun.com", "pmid28455658"],
    ["唐子勇", "ziyong.tang@live.cn", "pmc6291953"],
  ]],
  ["老年内科", [
    ["朱昀", "yun-zhu@263.net", "pmid15205701"],
    ["刘慧琳", "liuhuilin202110@163.com", "pmid41844166"],
    ["王征", "wangzheng_puh3@yeah.net", "pmid39731935"],
    ["来璇", "laixuan@bjmu.edu.cn", "pmid41546035"],
  ]],
  ["儿科", [
    ["童笑梅", "tongxm2007@126.com", "pmid36698176"],
    ["鲁珊", "lucm@ccps.gov.cn", "pmid18947486"],
    ["王新利", "Xinli_Wang1217@yahoo.com.cn", "pmid17148563"],
    ["刘云峰", "liuyunfeng96@163.com", "pmid40739635"],
    ["李在玲", "topbj163@sina.com", "pmc12537648"],
  ]],
  ["耳鼻喉科", [
    ["闫燕", "yanyan_ent@bjmu.edu.cn", "pmid42207332"],
    ["张迎宏", "yinghongzhang@bjmu.edu.cn", "pmid41863728"],
    ["柯嘉", "jiake_ent@bjmu.edu.cn", "pmid34753454"],
    ["李涛", "bysylt@163.com", "pmid40311509"],
    ["马芙蓉", "furongma@126.com", "pmid42716330"],
    ["谢立锋", "luozner@sina.com", "pmid33541823"],
    ["张绍兴", "zhangshaoxing@bjmu.edu.cn", "pmid40451547"],
    ["刘仲奇", "zhongqiliu@126.com", "pmid35211575"],
    ["王丽", "doctorwangli@yahoo.com.cn", "pmid16334258"],
    ["潘滔", "tao-pan@uiowa.edu", "pmid19949236"],
  ]],
  ["麻醉科", [
    ["李民", "liminanesth@bjmu.edu.cn", "pmid42631835"],
    ["徐懋", "anae@163.com", "pmid41791898"],
    ["曾鸿", "yippeerong@139.com", "pmid35752068"],
    ["吴长毅", "iamwuchangyi@aliyun.com", "pmid39842637"],
    ["韩永正", "hanyongzheng@bjmu.edu.cn", "pmid42259405"],
    ["韩彬", "hanbinputh@163.com", "pmid33874892"],
    ["周阳", "zhouyang@pku.edu.cn", "pmid41449363"],
    ["李群", "liqunwill@sina.com", "pmid12920842"],
    ["郭向阳", "xiangyangguobysy@163.com", "pmid36192780"],
    ["王军", "luckyoldhorse@sina.com", "pmid26781803"],
  ]],
  ["疼痛科", [
    ["李水清", "lishuiqingpku@163.com", "pmid37231389"],
    ["孟秀丽", "meng_xiuli@163.com", "pmid26080847"],
    ["马云龙", "mayl_pth2012@163.com", "pmc4596494"],
    ["易端", "yiduan1987@163.com", "pmc7700084"],
  ]],
  ["危重医学科", [
    ["么改琦", "yaogaiqi@sina.com", "pmid42096120"],
    ["伊敏", "minyi0101@yahoo.com.cn", "pmid22033056"],
    ["朱曦", "xizhuccm@bjmu.edu.cn", "pmid41865454"],
    ["李强", "liqiang@bjmu.com.cn", "pmid19829682"],
  ]],
];
const doctor = (name, department) => {
  const matches = data.doctors.filter(d => d.name === name && d.department === department && d.hospitalId === "puh3");
  assert.equal(matches.length, 1, `${name} ${department}`);
  return matches[0];
};
const expected = groups.flatMap(([department, rows]) => rows.map(([name, email, key]) => ({
  doctor: doctor(name, department), email,
  sourceId: key.startsWith("reused-") ? `email-multiround-${key.slice(7)}` : `email-newroutes-${key}`,
})));
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("new routes preserve all 971 profiles, 313 prior contacts and 1265 prior sources", () => {
  const ids = new Set(expected.map(e => e.doctor.id));
  const batchSourceIds = new Set(data.sources.slice(0, 1336).map(s => s.id));
  const historical = beforeCrossfieldContacts(data).map(d => ({
    ...d,
    contacts: ids.has(d.id) ? [] : d.contacts.filter(c => batchSourceIds.has(c.sourceId)),
    evidence: d.evidence.filter(e => batchSourceIds.has(e.sourceId) &&
      (!ids.has(d.id) || !e.fields.includes("contacts"))),
  }));
  assert.equal(expected.length, 77);
  assert.equal(ids.size, 77);
  assert.equal(digest(historical), "cbdfeb1cecb8978563a78c7f9d9689e82232c595d0c49116f40040c148c4fa58");
  assert.equal(digest(data.sources.slice(0, 1265)), "2c09d2ec73608d04ab489f46dad2e6571ac822acf8660d4a965984c0cc613e8a");
  assert.equal(historical.filter(d => d.contacts.length).length, 313);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});

test("all 77 exact public academic contacts retain direct source ownership and historic casing", () => {
  for (const { doctor: d, email, sourceId } of expected) {
    assert.equal(d.contacts.length, 1);
    const contact = d.contacts[0];
    assert.equal(contact.value, email, d.name);
    assert.equal(contact.sourceId, sourceId, d.name);
    assert.equal(contact.purpose, "academic");
    assert.match(contact.identityNote, /未测试收信/);
    const source = data.sources.find(s => s.id === sourceId);
    assert.equal(source.accessedAt, "2026-10-10");
    assert.equal(source.sourceUpdatedAt, null);
    assert.ok(d.evidence.some(e => e.sourceId === sourceId && e.fields.join() === "contacts"));
    assert.deepEqual(data.doctors.filter(x => x.contacts.some(c => c.value === email)).map(x => x.id), [d.id]);
    if (sourceId.includes("-pmid")) {
      assert.equal(new URL(source.url).searchParams.get("query"), `EXT_ID:${sourceId.split("-pmid")[1]} AND SRC:MED`);
    }
  }
  assert.notEqual(doctor("李东", "成形外科").contacts[0].value, doctor("李东", "中医科").contacts[0].value);
  assert.equal(doctor("王宏利", "神经内科").contacts[0].sourceId, "email-multiround-pmid29169899");
  assert.equal(data.sources.filter(s => s.url.includes("EXT_ID%3A29169899")).length, 1);
});

test("historical affiliations and separate identity corroboration are not presented as new email dates", () => {
  assert.match(doctor("顾卫红", "神经内科").contacts[0].identityNote, /中日友好医院.*2005年/s);
  assert.match(doctor("潘滔", "耳鼻喉科").contacts[0].identityNote, /2007-2008年Iowa访问学者/);
  assert.match(doctor("马云龙", "疼痛科").contacts[0].identityNote, /历史骨科署名/);
  assert.match(doctor("马朝来", "普通外科").contacts[0].identityNote, /Zhaolai/);
  const meng = doctor("孟秀丽", "疼痛科");
  assert.ok(meng.evidence.some(e => e.sourceId === "email-newroutes-pmc12669058"));
  assert.match(meng.contacts[0].identityNote, /2025年来源只补身份/);
  assert.equal(data.sources.find(s => s.id === meng.contacts[0].sourceId).publishedYear, 2015);
  for (const [name, department, year] of [
    ["李群", "麻醉科", 2003], ["朱昀", "老年内科", 2004], ["王丽", "耳鼻喉科", 2005],
    ["鲁珊", "儿科", 2008], ["李志刚", "口腔科", 2009], ["潘滔", "耳鼻喉科", 2009],
  ]) {
    assert.equal(data.sources.find(s => s.id === doctor(name, department).contacts[0].sourceId).publishedYear, year);
  }
  const cui = doctor("崔德华", "神经内科").contacts[0];
  assert.match(cui.identityNote, /已退休教授栏目/);
  assert.equal(data.sources.find(s => s.id === cui.sourceId).kind, "university-profile");
});

test("ambiguous shared fields and different-hospital namesakes were not adopted by the new-routes batch", () => {
  for (const [name, department] of [
    ["王亮", "普通外科"], ["张洁", "成形外科"], ["郑亦沐", "职业病科"],
    ["李丽娟", "耳鼻喉科"], ["辛颖", "耳鼻喉科"], ["刘慧", "儿科"],
    ["薄世宁", "危重医学科"], ["钟延丰", "病理科"], ["陈晓红", "口腔科"], ["薛梅", "口腔科"],
  ]) assert.deepEqual(doctor(name, department).contacts.filter(c => c.sourceId.startsWith("email-newroutes-")), [], name);
  assert.ok(!expected.some(e => e.email === "pkujerry@126.com"));
  assert.equal(doctor("李在玲", "儿科").contacts[0].value, "topbj163@sina.com");
  assert.match(doctor("李在玲", "儿科").contacts[0].identityNote, /cor2.*cor1/s);
  assert.equal(data.sources.find(s => s.id === "email-newroutes-pmc12537648").accessMethod, "browser");
  assert.match(doctor("易端", "疼痛科").contacts[0].identityNote, /纯文本而非email标签/);
});

test("77 additions share 71 new sources and update progress without changing roster coverage", () => {
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1563);
  assert.equal(data.sources.filter(s => s.id.startsWith("email-newroutes-")).length, 71);
  assert.deepEqual(planStats(coverage, data).email, { current: 648, total: 971, remaining: 323, percent: 67 });
  assert.equal(coverage.updatedAt, "2026-10-09");
  for (const [department, count] of [
    ["普通外科", 24], ["成形外科", 16], ["神经内科", 21], ["消化科", 19],
    ["口腔科", 7], ["肾脏内科", 13], ["老年内科", 7], ["儿科", 13],
    ["耳鼻喉科", 15], ["麻醉科", 12], ["疼痛科", 9], ["危重医学科", 7],
  ]) assert.equal(data.doctors.filter(d => d.hospitalId === "puh3" && d.department === department && d.contacts.length).length, count, department);
});
