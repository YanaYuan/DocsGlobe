import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDirectory } from "../public/directory.mjs";
import { beforeReassessment } from "./helpers/email-reassessment.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const prior = beforeReassessment(data);
const expected = [
  ["puh3-csyxk-3671", "付颖", "超声医学科", "gehuiyu@gmail.com", "24606451", 2014, "Ying Fu"],
  ["puh3-hxywzzyxk-3582", "孙丽娜", "呼吸与危重症医学科", "smileshi1982@163.com", "37653511", 2023, "Lina Sun"],
  ["puh3-pfk-3422", "张倩", "皮肤科", "68wwh@sohu.com", "16848817", 2006, "Qian Zhang"],
  ["puh3-ptwk-1541", "王德臣", "普通外科", "hepuzai@yahoo.com.cn", "15237452", 2004, "De-Chen Wang"],
  ["puh3-xxgnk-3211", "徐顺霖", "心血管内科", "sunny-heart@bjmu.edu.cn", "37872227", 2023, "Shunlin Xu"],
  ["puh3-xxgnk-3291", "王新宇", "心血管内科", "saplingwxyw@hotmail.com", "31209799", 2019, "Xinyu Wang"],
  ["puh3-sjnk-16722", "孙阿萍", "神经内科", "apings@163.com", "31897944", 2020, "A-Ping Sun"],
  ["puh3-szyxzx-1173", "王洋", "生殖医学科", "wangbearyang@163.com", "42448210", 2026, "Yang Wang"],
  ["puh3-zyk-1471", "和岚", "中医科", "bysyhl@sina.com", "22466947", 2012, "Lan He"],
  ["puh3-zyk-1511", "郭佳", "中医科", "guojia65@163.com", "22152767", 2011, "Jia Guo"],
  ["puh3-ptwk-3681", "李飞", "普通外科", "lifeipku@163.com", "34627687", 2021, "Fei Li"],
  ["puh3-qyxk-1902", "刘青", "全科医学科", "qingfoxii@163.com", "39923544", 2025, "Qing Liu"],
  ["puh3-jrxgk-1461", "庄金满", "介入血管外科", "zhuangjinman@sina.com", "21054979", 2010, "Jin-Man Zhuang"],
  ["puh3-szyxzx-3261", "潘宁宁", "生殖医学科", "pnn1210@126.com", "39956097", 2025, "Ningning Pan"],
  ["puh3-szyxzx-2921", "刘德风", "生殖医学科", "liudefeng@bjmu.edu.cn", "41680577", 2026, "Defeng Liu"],
  ["puh3-szyxzx-2931", "邓凤", "生殖医学科", "18510636765@163.com", "38639843", 2024, "Feng Deng"],
  ["puh3-fck-3141", "原鹏波", "妇产科", "yuanpengbo@bjmu.edu.cn", "42481510", 2026, "Peng-Bo Yuan"],
  ["puh3-nfmk-1731", "肖文华", "内分泌科", "xiaowenhua@bjmu.edu.cn", "42116003", 2026, "Wen-Hua Xiao"],
  ["puh3-kqk-1004", "张平", "口腔科", "kqzhangping@163.com", "22178848", 2011, "Ping Zhang"],
  ["puh3-fck-1156", "张龑", "妇产科", "zhangyann01@163.com", "35315023", 2025, "Yan Zhang"],
  ["puh3-hxywzzyxk-3271", "闫崴", "呼吸与危重症医学科", "yanwei@bjmu.edu.cn", "31370800", 2019, "Wei Yan"],
  ["puh3-snk-2561", "王松", "肾脏内科", "songwang30@163.com", "41927839", 2026, "Wang Song"],
  ["puh3-snk-2621", "杨文领", "肾脏内科", "yanglw2003@hotmail.com", "32460295", 2020, "Wen-Ling Yang"],
  ["puh3-snk-2541", "韩庆烽", "肾脏内科", "hanqingfeng@sina.com", "27587067", 2016, "Qing-Feng Han"],
  ["puh3-xhk-4351", "林三仁", "消化科", "linsanren@medmail.com.cn", "24762588", 2014, "Sanren Lin"],
  ["puh3-gk-6943", "李哲海", "骨科", "lizhehai2291@163.com", "33389496", 2021, "Zhe-Hai Li"],
  ["puh3-gk-1744", "姬洪全", "骨科", "jihq@bjmu.edu.cn", "25818053", 2015, "Hong Quan Ji"],
  ["puh3-gk-1728", "钟沃权", "骨科", "zhong811@yeah.net", "19844749", 2010, "Wo Quan Zhong"],
  ["puh3-szyxzx-1168", "宋雪凌", "生殖医学科", "sxldxx@263.net", "41225676", 2025, "Xue-Ling Song"],
  ["puh3-yk-1593", "李海平", "眼科", "drlihaiping@163.com", "41652020", 2026, "Hai Ping Li"],
  ["puh3-yk-7332", "由德勃", "眼科", "youdebo@sina.cn", "35127924", 2022, "De-Bo You"],
  ["puh3-yk-1565", "许艺民", "眼科", "xymeye@sohu.com", "15100744", 2004, "Yi-min Xu"],
  ["puh3-kqk-1011", "谢克贤", "口腔科", "kexianxie@bjmu.edu.cn", "35587015", 2021, "Ke-Xian Xie"],
  ["puh3-ttk-1951", "贾东林", "疼痛科", "jiadlin@126.com", "27465337", 2016, "Dong-Lin Jia"],
  ["puh3-fsk-1577", "田春艳", "放射科", "tcyzhs@yahoo.com.cn", "23287711", 2013, "Chun-Yan Tian"],
  ["puh3-csyxk-2321", "李志强", "超声医学科", "lizhq2006@bjmu.edu.cn", "38172706", 2024, "Li Zhiqiang"],
  ["puh3-blk-2121", "杨邵敏", "病理科", "yangshaomin@bjmu.edu.cn", "39952878", 2025, "Shaomin Yang"],
];
const rejected = [
  "xuemeiw7886@sohu.com",
  "lizhehai0472@163.com",
  "zhangyan001@bjmu.edu.cn",
  "zhangyann01@126.com",
  "tianchan@bjmu.edu.cn",
  "yangwang@bjmu.edu.cn",
  "huishuy@bjmu.edu.cn",
];

test("reverse author-field matches attach one email only to the named doctor", () => {
  for (const [id, name, department, value, pmid, year, english] of expected) {
    const doctor = data.doctors.find(item => item.id === id);
    assert.equal(doctor.name, name);
    assert.equal(doctor.hospitalId, "puh3");
    assert.equal(doctor.department, department);
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.equal(contact.value, value);
    assert.equal(contact.type, "email");
    assert.equal(contact.purpose, "academic");
    assert.equal(contact.sourceId, `email-author-pmid${pmid}`);
    assert.match(contact.identityNote, new RegExp(english.replace("-", "\\-")));
    assert.match(contact.identityNote, /未测试收信.*不保证当前有效.*接受患者咨询/);
    assert.deepEqual(doctor.evidence.at(-1), { sourceId: contact.sourceId, fields: ["contacts"] });
    assert.deepEqual(data.doctors.filter(item =>
      item.contacts.some(itemContact => itemContact.value.toLowerCase() === value.toLowerCase()))
      .map(item => item.id), [id]);
    const source = data.sources.find(item => item.id === contact.sourceId);
    assert.equal(source.publishedYear, year);
    assert.equal(source.kind, "journal-article");
    assert.equal(source.accessedAt, "2026-10-14");
    assert.equal(source.url,
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:${pmid}&format=json&resultType=core`);
  }
  assert.equal(new Set(expected.map(([, , , value]) => value.toLowerCase())).size, 37);
});

test("shared, namesake and off-department author emails stay out of the directory", () => {
  const values = new Set(prior.doctors.flatMap(doctor =>
    doctor.contacts.map(contact => contact.value.toLowerCase())));
  for (const value of rejected) assert.equal(values.has(value), false, value);
  assert.deepEqual(data.doctors.filter(doctor => doctor.contacts.some(contact =>
    contact.value.toLowerCase() === "tongxm2007@126.com")).map(doctor => doctor.id), ["puh3-ek-4571"]);
  assert.deepEqual(data.doctors.filter(doctor => doctor.contacts.some(contact =>
    contact.value.toLowerCase() === "xiudianrong@163.com")).map(doctor => doctor.id), ["puh3-ptwk-1481"]);
  assert.equal(data.doctors.find(doctor => doctor.id === "puh3-ptwk-1661").contacts.length, 0);
  assert.equal(data.doctors.find(doctor => doctor.id === "puh3-gk-6943").contacts[0].value, "lizhehai2291@163.com");
  assert.equal(prior.doctors.find(doctor => doctor.id === "puh3-ek-1431").contacts.length, 0);
  assert.equal(data.doctors.find(doctor => doctor.id === "puh3-sjnk-16642").contacts.length, 0);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});
