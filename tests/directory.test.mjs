import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { emailContactHref, evidenceDate, filterDoctors, isEmailAddress, isSafeUrl, isStale,
  validateDirectory } from "../public/directory.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const now = new Date("2026-10-15T23:59:59Z");

test("expanded directory is in scope, source-backed and explicitly partial", () => {
  assert.deepEqual(validateDirectory(data, now), []);
  assert.equal(data.hospitals.length, 4);
  assert.equal(data.doctors.length, 971);
  assert.equal(data.sources.length, 1563);
  assert.equal(new Set(data.doctors.map(doctor => doctor.department)).size, 46);
});

test("search supports name, hospital aliases, specialty and multiple AND terms", () => {
  assert.equal(filterDoctors(data, { query: "乔杰" })[0].id, "puh3-qiao-jie");
  assert.deepEqual(filterDoctors({ ...data, doctors: data.doctors.slice(0, 170) },
    { query: "  北医三院   多囊卵巢 " }).map(doctor => doctor.name),
    ["李蓉", "乔杰"]);
  assert.ok(filterDoctors(data, { query: "胰腺" }).some(doctor => doctor.name === "赵玉沛"));
  assert.equal(filterDoctors(data, { query: "协和" }).length, 65);
  assert.equal(filterDoctors(data, { query: "   " }).length, 971);
});

test("all biographies retain evidence and the original detailed profiles remain substantive", () => {
  for (const doctor of data.doctors) {
    assert.ok(doctor.evidence.some(entry => entry.fields.includes("experience")), doctor.name);
  }
  for (const doctor of data.doctors.slice(0, 28)) {
    assert.ok(doctor.experience.length >= 2, doctor.name);
    assert.ok(doctor.experience.join("").length >= 150, doctor.name);
    assert.ok(doctor.experience.every(paragraph => paragraph.length >= 50), doctor.name);
  }
  for (const id of ["tsinghua-zhang-contact", "pku-wang-contact", "pumc-xiao-xinhua-contact",
    "pumc-tian-zhuang-contact", "pku-li-rong-contact"]) {
    assert.ok(data.doctors.some(doctor => doctor.evidence.some(entry =>
      entry.sourceId === id && entry.fields.includes("experience"))), id);
  }
});

test("new hospitals and three doctors retain verified specialties, contacts and identity sources", () => {
  const expected = [
    ["pkufh-zhao-minghui", "赵明辉", "pkufh", "肾脏内科", "mhzhao@bjmu.edu.cn"],
    ["pkuph-li-zhanguo", "栗占国", "pkuph", "风湿免疫科", "li99@bjmu.edu.cn"],
    ["pkuph-huang-xiaojun", "黄晓军", "pkuph", "血液科", "xjhrm@medmail.com.cn"],
  ];
  for (const [id, name, hospitalId, department, email] of expected) {
    const doctor = data.doctors.find(item => item.id === id);
    assert.equal(doctor.name, name);
    assert.equal(doctor.hospitalId, hospitalId);
    assert.equal(doctor.department, department);
    assert.equal(doctor.contacts[0].value, email);
    const source = data.sources.find(item => item.id === doctor.contacts[0].sourceId);
    assert.equal(source.kind, "university-profile");
    assert.ok(source.title.includes(name));
    assert.ok(doctor.contacts[0].identityNote.includes(
      data.hospitals.find(hospital => hospital.id === hospitalId).name));
  }
  assert.equal(filterDoctors(data, { query: "北大一院 血管炎" })[0].name, "赵明辉");
  assert.equal(filterDoctors(data, { hospitalId: "pkuph" }).length, 2);
  assert.deepEqual(filterDoctors(data, { hospitalId: "pkuph", department: "血液科" })
    .map(doctor => doctor.name), ["黄晓军"]);
  assert.equal(filterDoctors(data, { hospitalId: "pkufh", department: "血液科" }).length, 0);
});

test("filters combine without substituting unrelated results", () => {
  assert.equal(filterDoctors(data, { hospitalId: "puh3" }).length, 903);
  assert.equal(filterDoctors(data, { department: "心内科" }).length, 59);
  assert.deepEqual(new Set(filterDoctors({ ...data, doctors: data.doctors.slice(0, 28) },
    { department: "心内科" }).map(doctor => doctor.name)),
    new Set(["田庄", "张抒扬", "方全", "严晓伟", "刘震宇", "方理刚", "范中杰", "沈珠军",
      "刘永太", "吴炜", "郭潇潇", "陈未", "陈太波", "程中伟", "杨德彦"]));
  assert.equal(filterDoctors(data, { hospitalId: "puh3", department: "心内科" }).length, 0);
  assert.equal(filterDoctors(data, { query: "不存在的医生" }).length, 0);
  assert.equal(filterDoctors(data, { query: "<script>alert(1)</script>" }).length, 0);
});

test("thirteen cardiology profiles publish exact verified contacts or explicit missing contacts", () => {
  const expected = [
    ["fang-quan", "方全", 4123, "主任医师", "13801371164@163.com", "心脏起搏治疗"],
    ["yan-xiaowei", "严晓伟", 4077, "主任医师", "xswy_pumc@163.com", "动脉粥样硬化预防"],
    ["liu-zhenyu", "刘震宇", 4113, "主任医师", "Pumch_lzy@163.com", "冠心病抗栓治疗"],
    ["fang-ligang", "方理刚", 4120, "主任医师", "fanglgpumch@sina.com", "超声心动图"],
    ["fan-zhongjie", "范中杰", 4119, "主任医师", "Fan@pumch.cn", "心脏康复"],
    ["shen-zhujun", "沈珠军", 4121, "主任医师", "zhujun66shen@126.com", "冠心病"],
    ["liu-yongtai", "刘永太", 4107, "主任医师", "ataiever@163.com", "心脏瓣膜病"],
    ["wu-wei", "吴炜", 4095, "主任医师", "camsww@hotmail.com", "经导管主动脉瓣置换术"],
    ["guo-xiaoxiao", "郭潇潇", 4094, "主任医师", "xiaoxiaoguopumch@163.com", "肺动脉高压"],
    ["chen-wei", "陈未", 4105, "主任医师", "chenwei6@medmail.com.cn", "心肌炎"],
    ["chen-taibo", "陈太波", 4110, "主任医师", "chentb@pumch.cn", "导管消融"],
    ["cheng-zhongwei", "程中伟", 4106, "副主任医师", "zhongwei_cheng@hotmail.com", "射频消融"],
    ["yang-deyan", "杨德彦", 4084, "副主任医师", "swallow_sums@aliyun.com", "心脏电生理"],
  ];
  for (const [slug, name, pageId, title, email, focus] of expected) {
    const id = `pumch-${slug}`;
    const matches = data.doctors.filter(d => d.id === id);
    assert.equal(matches.length, 1, id);
    const doctor = matches[0];
    assert.equal(doctor.name, name);
    assert.equal(doctor.hospitalId, "pumch");
    assert.equal(doctor.department, "心内科");
    assert.equal(doctor.title, title);
    const profile = data.sources.find(s => s.id === doctor.profileSourceId);
    assert.equal(profile.url, `https://www.pumch.cn/detail/${pageId}.html`);
    assert.equal(profile.accessedAt, "2026-10-08");
    assert.ok(filterDoctors(data, { query: `${name} ${focus}` }).some(d => d.id === id));
    if (email === null) {
      assert.deepEqual(doctor.contacts, []);
    } else {
      assert.equal(doctor.contacts.length, 1);
      assert.equal(doctor.contacts[0].value, email);
      const contactSource = data.sources.find(s => s.id === doctor.contacts[0].sourceId);
      assert.equal(contactSource.accessedAt, "2026-10-08");
      assert.ok(contactSource.title.includes(name));
      assert.equal(contactSource.kind, ["yang-deyan", "fang-quan", "chen-taibo", "cheng-zhongwei"].includes(slug)
        ? "journal-article" : "university-profile");
    }
  }
  assert.equal(data.doctors.slice(0, 72).filter(d => d.contacts?.length).length, 52);
});

test("all 44 remaining cardiology profiles preserve individual identity and official evidence", () => {
  const additions = data.doctors.slice(28, 72);
  assert.equal(additions.length, 44);
  assert.equal(new Set(additions.map(d => d.name)).size, 44);
  assert.equal(new Set(additions.map(d => d.profileSourceId)).size, 44);
  for (const doctor of additions) {
    assert.equal(doctor.hospitalId, "pumch");
    assert.equal(doctor.department, "心内科");
    const source = data.sources.find(s => s.id === doctor.profileSourceId);
    assert.match(source.url, /^https:\/\/www\.pumch\.cn\/detail\/\d+\.html$/);
    assert.ok(source.title.includes(doctor.name));
    assert.equal(source.accessedAt, "2026-10-08");
    assert.equal(source.accessMethod, "browser");
    assert.ok(doctor.experience.every(p => p.length >= 25), doctor.name);
    assert.ok(doctor.evidence.some(e => e.fields.includes("department") &&
      e.sourceId.startsWith("pumch-cardiology")), doctor.name);
    assert.deepEqual(filterDoctors(data, { query: doctor.name, hospitalId: "pumch" }).map(d => d.id), [doctor.id]);
  }
  for (const [name, title] of [
    ["陈端霞", "研究员"], ["林雪", "主任医师"], ["闫建玲", "副主任医师"],
    ["白桦", "主治医师 / 副研究员"], ["张志宇", "住院医师"], ["王伦", "住院医师"],
    ["华天瑞", "主治医师"], ["廉慧", "副主任医师"],
  ]) {
    assert.equal(additions.find(d => d.name === name).title, title);
  }
});

test("short official biographies retain explicit gaps instead of padded or invented histories", () => {
  const brief = data.doctors.slice(0, 170).filter(d => d.experience.length === 1);
  assert.deepEqual(brief.map(d => d.name), ["邓华", "金晓峰", "李红武", "范静波", "张博为", "郭福新"]);
  for (const doctor of brief) {
    assert.match(doctor.profileNote, /资料缺口/);
    if (doctor.name === "金晓峰") assert.equal(doctor.contacts[0].value, "xhjxf@aliyun.com");
    else if (doctor.name === "李红武") assert.equal(doctor.contacts[0].value, "lhw3948@126.com");
    else if (doctor.name === "郭福新") assert.equal(doctor.contacts[0].value, "guofuxinpku@bjmu.edu.cn");
    else assert.deepEqual(doctor.contacts, []);
  }
  assert.match(data.doctors.find(d => d.name === "王亮").profileNote, /2016.*2017/);
  assert.match(data.doctors.find(d => d.name === "高鹏").profileNote, /同名/);
  assert.match(data.doctors.find(d => d.name === "杨杏林").profileNote, /资格.*未据此/);
  for (const note of ["", " ", null, {}, 12]) {
    const broken = structuredClone(data);
    broken.doctors[0].profileNote = note;
    assert.match(validateDirectory(broken, now).join("\n"), /资料缺口或差异说明/);
  }
});

test("two new mentor emails match cardiology identities without substituting namesakes", () => {
  for (const [name, email, mentor] of [
    ["谢洪智", "drxiehz@163.com", "J2009021358"],
    ["林雪", "linxuepumch@qq.com", "J2009021739"],
  ]) {
    const doctor = data.doctors.find(d => d.name === name);
    assert.equal(doctor.contacts.length, 1);
    assert.equal(doctor.contacts[0].value, email);
    const source = data.sources.find(s => s.id === doctor.contacts[0].sourceId);
    assert.equal(source.url, `https://yzbss.pumc.edu.cn/basicinfo/tutorinfo/tutordetail/${mentor}`);
    assert.equal(source.kind, "university-profile");
    assert.ok(doctor.contacts[0].identityNote.includes("北京协和医院"));
    assert.ok(doctor.evidence.some(e => e.sourceId === source.id && e.fields.includes("experience")));
  }
  for (const [name, address] of [["程康安", "chengkangan@hotmail.com"], ["王崇慧", "pumchwangch@126.com"]]) {
    assert.equal(data.doctors.find(d => d.name === name).contacts[0].value, address);
  }
});

test("eleven rehabilitation profiles publish exact official identities and substantive introductions", () => {
  const additions = data.doctors.slice(72, 83);
  const expected = [
    ["cui-guoqing", "崔国庆", "主任医师", "kfyxk/info/1004/1021.htm", "肩袖损伤"],
    ["yang-yanyan", "杨延砚", "主任医师", "kfyxk/info/1004/1041.htm", "骨质疏松症"],
    ["liu-nan", "刘楠", "主任医师", "kfyxk/info/1004/1051.htm", "自主神经功能障碍"],
    ["liu-xiaoxuan", "刘小璇", "主任医师", "kfyxk/info/1004/1061.htm", "神经肌肉病"],
    ["fu-guimin", "付桂敏", "副主任医师", "kfyxk/info/1004/1071.htm", "颈椎病康复"],
    ["li-xiaowen", "李筱雯", "副主任医师", "kfyxk/info/1004/1081.htm", "心血管疾病康复"],
    ["gu-li", "谷莉", "副主任医师", "kfyxk/info/1004/9071.htm", "围手术期康复"],
    ["zeng-yan", "曾妍", "副主任医师", "bfyq/info/1021/3021.htm", "疼痛物理治疗"],
    ["zhang-na", "张娜", "副主任医师", "kfyxk/info/1004/1101.htm", "痉挛诊疗"],
    ["xing-huayi", "邢华医", "副主任医师", "kfyxk/info/1004/9411.htm", "神经调控"],
    ["yuan-guangti", "原广提", "主任医师", "kfyxk/info/1006/9081.htm", "术后疼痛与功能障碍"],
  ];
  assert.equal(additions.length, expected.length);
  assert.equal(new Set(additions.map(d => d.id)).size, expected.length);
  for (const [slug, name, title, path, focus] of expected) {
    const doctor = additions.find(d => d.id === `puh3-${slug}`);
    assert.ok(doctor, name);
    assert.deepEqual([doctor.name, doctor.title, doctor.hospitalId, doctor.department],
      [name, title, "puh3", "康复医学科"]);
    const source = data.sources.find(s => s.id === doctor.profileSourceId);
    assert.equal(source.url, `https://www.puh3.net.cn/${path}`);
    assert.equal(source.accessedAt, "2026-10-08");
    assert.equal(source.accessMethod, "browser");
    assert.equal(doctor.experience.length, 2);
    assert.ok(doctor.experience.join("").length >= 150, name);
    assert.ok(doctor.experience.every(p => p.length >= 50), name);
    assert.ok(doctor.evidence.some(e => e.fields.includes("department")), name);
    assert.ok(filterDoctors(data, { query: `${name} ${focus}` }).some(d => d.id === doctor.id), name);
  }
  assert.equal(filterDoctors(data, { hospitalId: "puh3", department: "康复医学科" }).length, 12);
  assert.equal(filterDoctors(data, { query: "陈亚平" }).length, 0);
  assert.match(data.doctors.find(d => d.name === "杨延砚").profileNote, /副主任医师.*主任医师/);
  assert.match(data.doctors.find(d => d.name === "原广提").profileNote, /2024.*未核实.*不代表当前在岗/);
  assert.match(data.doctors.find(d => d.name === "刘小璇").profileNote, /神经科/);
});

test("rehabilitation paper contacts belong only to the named correspondents, not coauthors or the hospital", () => {
  const expected = [
    ["崔国庆", "drcuiguoqing1964@126.com", "plos-cui-guoqing-contact", 2024],
    ["刘楠", "puth_liunan@outlook.com", "frontiers-liu-nan-contact", 2023],
  ];
  for (const [name, email, sourceId, year] of expected) {
    const owners = data.doctors.filter(d => d.contacts.some(c => c.value === email));
    assert.deepEqual(owners.map(d => d.name), [name]);
    assert.equal(owners[0].contacts[0].sourceId, sourceId);
    const source = data.sources.find(s => s.id === sourceId);
    assert.equal(source.kind, "journal-article");
    assert.equal(source.publishedYear, year);
    assert.equal(source.accessedAt, "2026-10-08");
    assert.ok(owners[0].contacts[0].identityNote.includes("北京大学第三医院"));
  }
  assert.equal(data.doctors.filter(d => d.contacts.length).length, 648);
  for (const doctor of data.doctors.slice(72, 83)) {
    if (!expected.some(([name]) => name === doctor.name) &&
      !["杨延砚", "刘小璇"].includes(doctor.name)) assert.deepEqual(doctor.contacts, []);
  }
  const contacts = data.doctors.flatMap(d => d.contacts);
  for (const address of ["bysy@bjmu.edu.cn", "zymf@pku.edu.cn", "cgq3019@vip.163.com"]) {
    assert.ok(!contacts.some(c => c.value === address), address);
  }
});

test("sports medicine publishes eighteen verified profiles without duplicating a cross-department doctor", () => {
  const expected = [
    ["敖英芳",1091],["王健全",1141],["胡跃林",1401],["闫辉",5391],["龚熹",1411],["徐雁",1391],
    ["郭秦炜",1421],["焦晨",1371],["刘平",1451],["黄红拾",1431],["马勇",1441],["江东",1361],
    ["杨渝平",1461],["王成",1351],["王健",1481],["肖健",1551],["印钰",1471],["王海军",1591],
  ];
  const additions = data.doctors.slice(83, 101);
  assert.deepEqual(additions.map(d => d.name), expected.map(([name]) => name));
  for (const [name, page] of expected) {
    const doctor = additions.find(d => d.name === name);
    assert.equal(doctor.hospitalId, "puh3");
    assert.equal(doctor.department, "运动医学科");
    assert.equal(doctor.title, "主任医师");
    assert.equal(doctor.experience.length, 2);
    assert.ok(doctor.experience.join("").length >= 150, name);
    assert.ok(doctor.experience.every(p => p.length >= 50), name);
    assert.equal(doctor.contacts.length, 1);
    const source = data.sources.find(s => s.id === doctor.profileSourceId);
    assert.equal(source.url, `https://www.puh3.net.cn/ydyxk/info/1004/${page}.htm`);
    assert.equal(source.accessedAt, "2026-10-08");
    assert.ok(doctor.evidence.some(e => e.sourceId === source.id && e.fields.includes("experience")));
  }
  assert.equal(data.doctors.filter(d => d.name === "崔国庆").length, 1);
  assert.ok(data.doctors.find(d => d.name === "崔国庆").evidence.some(e => e.sourceId === "puh3-cui-guoqing-sports"));
  assert.ok(!data.doctors.some(d => d.name === "常翠青"));
  assert.match(data.doctors.find(d => d.name === "杨渝平").profileNote, /崇礼.*未确认/);
  assert.equal(filterDoctors(data, { department: "运动医学科" }).length, 43);
  assert.equal(data.doctors.filter(d => d.contacts.length).length, 648);
});

test("published paper email belongs only to its named correspondent, not coauthors", () => {
  const matches = data.doctors.filter(d => d.contacts?.some(c => c.value === "swallow_sums@aliyun.com"));
  assert.deepEqual(matches.map(d => d.name), ["杨德彦"]);
  const source = data.sources.find(s => s.id === "frontiers-yang-deyan-contact");
  assert.equal(source.publishedYear, 2024);
  assert.ok(source.url.endsWith("/10.3389/fcvm.2024.1336609/full"));
  for (const name of ["方全", "陈太波", "程中伟"]) {
    assert.ok(data.doctors.find(d => d.name === name).contacts.every(c =>
      c.sourceId !== source.id && c.value !== "swallow_sums@aliyun.com"));
  }
});

test("ordering is stable and independent of source array order", () => {
  const reversed = { ...data, doctors: [...data.doctors].reverse() };
  assert.deepEqual(filterDoctors(reversed).map(item => item.id), filterDoctors(data).map(item => item.id));
});

test("validation rejects dangling references, duplicate IDs and missing field evidence", () => {
  const broken = structuredClone(data);
  broken.doctors[0].hospitalId = "missing";
  broken.doctors[0].evidence[0].sourceId = "missing";
  broken.doctors[0].evidence[0].fields = ["name"];
  broken.doctors.push(structuredClone(broken.doctors[0]));
  const errors = validateDirectory(broken, now).join("\n");
  assert.match(errors, /关联医院不存在/);
  assert.match(errors, /不存在的来源/);
  assert.match(errors, /ID 重复/);
  assert.match(errors, /focusAreas 缺少来源/);
});

test("validation rejects out-of-scope hospitals and unsupported sensitive fields", () => {
  const broken = structuredClone(data);
  broken.hospitals[0].city = "上海市";
  broken.hospitals[1].grade = "三级乙等";
  broken.doctors[0].patientReviews = [{ text: "not permitted" }];
  broken.doctors[0].privatePhone = "not permitted";
  const errors = validateDirectory(broken, now).join("\n");
  assert.match(errors, /不属于北京三甲范围/);
  assert.match(errors, /patientReviews/);
  assert.match(errors, /privatePhone/);
});

test("source dates must exist, be real and not be in the future", () => {
  for (const value of ["2026-02-30", "2026-10-16", "yesterday", null]) {
    const broken = structuredClone(data);
    broken.sources[0].accessedAt = value;
    assert.match(validateDirectory(broken, now).join("\n"), /核对日期无效/);
  }
});

test("validation rejects fabricated status, untrusted URLs and malformed structures", () => {
  const broken = structuredClone(data);
  broken.doctors[0].practiceStatus = "verified";
  broken.doctors[1].reviewStatus = "five-stars";
  broken.sources[0].url = "javascript:alert(1)";
  broken.doctors[2].evidence = [null];
  const errors = validateDirectory(broken, now).join("\n");
  assert.match(errors, /实时执业状态/);
  assert.match(errors, /患者评价/);
  assert.match(errors, /HTTPS/);
  assert.match(errors, /证据格式错误/);
  for (const value of [null, [], {}, { sources: false }]) {
    assert.ok(validateDirectory(value, now).length);
  }
});

test("links disallow executable schemes, credentials and invalid inputs", () => {
  assert.equal(isSafeUrl("https://www.pumch.cn/detail/4712.html"), true);
  for (const url of ["javascript:alert(1)", "http://example.com", "https://user:pass@example.com", "", null]) {
    assert.equal(isSafeUrl(url), false);
  }
});

test("freshness uses the oldest supporting source, with an exact 180-day threshold", () => {
  const sources = structuredClone(data.sources);
  sources.find(source => source.id === "pumch-cardiology").accessedAt = "2026-09-01";
  assert.equal(evidenceDate(data.doctors[1], sources), "2026-09-01");
  const start = new Date("2026-01-01T00:00:00Z").getTime();
  assert.equal(isStale("2026-01-01", new Date(start + 180 * 86400000 - 1)), false);
  assert.equal(isStale("2026-01-01", new Date(start + 180 * 86400000)), true);
});

test("all four seed doctors have the exact public emails and matching source evidence", () => {
  const expected = new Map([
    ["pumch-zhao-yupei", "zhao8028@263.net"],
    ["pumch-zhang-shuyang", "shuyangzhang103@nrdrs.org"],
    ["puh3-qiao-jie", "jie.qiao@263.net"],
    ["puh3-wang-junjie", "junjiewang_edu@sina.cn"],
  ]);
  const originalDoctors = data.doctors.filter(doctor => expected.has(doctor.id));
  assert.equal(originalDoctors.length, expected.size);
  for (const doctor of originalDoctors) {
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.equal(contact.value, expected.get(doctor.id));
    assert.equal(contact.purpose, "academic");
    assert.equal(emailContactHref(contact.value), `mailto:${expected.get(doctor.id)}`);
    const source = data.sources.find(item => item.id === contact.sourceId);
    assert.equal(source.kind, "university-profile");
    assert.ok(doctor.evidence.some(entry => entry.sourceId === source.id && entry.fields.includes("contacts")));
  }
});

test("eight additional doctors have distinct records, expected specialties and source-backed emails", () => {
  const additions = [
    ["pumch-li-mengtao", "李梦涛", "pumch", "风湿免疫科", "mengtao.li@cstar.org.cn", "系统性红斑狼疮"],
    ["pumch-zhu-lan", "朱兰", "pumch", "妇产科", "zhu_julie@vip.sina.com", "盆腔器官脱垂"],
    ["pumch-xiao-xinhua", "肖新华", "pumch", "内分泌科", "xiaoxh2014@vip.163.com", "糖尿病"],
    ["pumch-du-bin", "杜斌", "pumch", "重症医学中心", "dubin98@gmail.com", "脓毒症"],
    ["pumch-leng-jinhua", "冷金花", "pumch", "妇产科", "lengjenny@vip.sina.com", "子宫内膜异位症"],
    ["pumch-tian-zhuang", "田庄", "pumch", "心内科", "tianzhuangcn@sina.com", "心力衰竭"],
    ["puh3-li-rong", "李蓉", "puh3", "生殖医学中心", "roseli001@sina.com", "不孕症"],
    ["puh3-zhou-mouwang", "周谋望", "puh3", "康复医学科", "zhoumouwang@163.com", "运动损伤康复"],
  ];
  for (const [id, name, hospitalId, department, email, focus] of additions) {
    const matches = data.doctors.filter(doctor => doctor.id === id);
    assert.equal(matches.length, 1, id);
    const doctor = matches[0];
    assert.deepEqual([doctor.name, doctor.hospitalId, doctor.department], [name, hospitalId, department]);
    assert.equal(doctor.contacts.length, 1);
    assert.equal(doctor.contacts[0].value, email);
    assert.equal(emailContactHref(email), `mailto:${email}`);
    assert.equal(doctor.contacts[0].purpose, "academic");
    const profile = data.sources.find(source => source.id === doctor.profileSourceId);
    const contact = data.sources.find(source => source.id === doctor.contacts[0].sourceId);
    assert.ok(profile.title.includes(name));
    assert.ok(contact.title.includes(name));
    assert.equal(contact.kind, "university-profile");
    assert.equal(contact.accessedAt, "2026-10-07");
    assert.ok(doctor.evidence.some(entry => entry.sourceId === contact.id && entry.fields.includes("contacts")));
    assert.deepEqual(filterDoctors(data, { query: name, hospitalId, department }).map(item => item.id), [id]);
    assert.ok(filterDoctors(data, { query: focus, hospitalId }).some(item => item.id === id), focus);
  }
});

test("email validation disallows header injection, executable links and malformed addresses", () => {
  for (const email of ["contact@example.edu", "first.last+lab@dept.example.edu", "a_b@example.org"]) {
    assert.equal(isEmailAddress(email), true);
    assert.equal(emailContactHref(email), `mailto:${email}`);
  }
  for (const email of [
    "", null, 123, "a@example.org?bcc=other@example.org", "a@example.org#fragment",
    "a@example.org\r\nBcc:other@example.org", "a%0d%0a@example.org",
    "mailto:a@example.org", "javascript:alert(1)", "a b@example.org",
    ".a@example.org", "a..b@example.org", "a@example..org", "a@-example.org",
    `${"a".repeat(65)}@example.org`,
  ]) {
    assert.equal(isEmailAddress(email), false, String(email));
    assert.throws(() => emailContactHref(email), /公开邮箱格式无效/);
  }
});

test("contacts require real sources, field-level evidence and identity matching notes", () => {
  const broken = structuredClone(data);
  broken.doctors[0].contacts[0].sourceId = "missing";
  broken.doctors[0].contacts[0].identityNote = "";
  broken.doctors[1].evidence = broken.doctors[1].evidence.filter(entry => !entry.fields.includes("contacts"));
  delete broken.sources.find(source => source.id === "pku-qiao-contact").kind;
  const errors = validateDirectory(broken, now).join("\n");
  assert.match(errors, /联系方式引用了不存在的来源/);
  assert.match(errors, /身份匹配说明/);
  assert.match(errors, /联系方式缺少对应来源的字段证据/);
  assert.match(errors, /明确类型的医院、高校或论文来源/);
});

test("contacts reject malformed structures, duplicate addresses and appointment claims", () => {
  const cases = [
    { contacts: null, message: /contacts 必须为数组/ },
    { contacts: [null], message: /联系方式格式无效/ },
    { contacts: [{ ...data.doctors[0].contacts[0], type: "phone" }], message: /当前仅支持/ },
    { contacts: [{ ...data.doctors[0].contacts[0], purpose: "appointment" }], message: /不得标为挂号/ },
    { contacts: [{ ...data.doctors[0].contacts[0], privatePhone: "not permitted" }], message: /未支持的字段/ },
    { contacts: [data.doctors[0].contacts[0], data.doctors[0].contacts[0]], message: /公开邮箱重复/ },
  ];
  for (const { contacts, message } of cases) {
    const broken = structuredClone(data);
    broken.doctors[0].contacts = contacts;
    assert.match(validateDirectory(broken, now).join("\n"), message);
  }
});

test("missing contacts are explicitly supported without inventing contact details", () => {
  for (const missing of [true, false]) {
    const partial = structuredClone(data);
    partial.doctors[0].evidence = partial.doctors[0].evidence.filter(entry => !entry.fields.includes("contacts"));
    if (missing) delete partial.doctors[0].contacts;
    else partial.doctors[0].contacts = [];
    assert.deepEqual(validateDirectory(partial, now), []);
    assert.equal(filterDoctors(partial, { query: "赵玉沛" }).length, 1);
  }
});

test("paper contacts require a publication year, not a fabricated current date", () => {
  const paper = structuredClone(data);
  const source = paper.sources.find(item => item.id === "pumc-zhao-contact");
  source.kind = "journal-article";
  for (const year of [undefined, null, 2027, "2020"]) {
    source.publishedYear = year;
    assert.match(validateDirectory(paper, now).join("\n"), /有效发表年份/);
  }
  source.publishedYear = 2020;
  assert.deepEqual(validateDirectory(paper, now), []);
});

test("contact source age is included in a doctor's evidence freshness", () => {
  const sources = structuredClone(data.sources);
  sources.find(source => source.id === "pumc-zhao-contact").accessedAt = "2025-01-01";
  assert.equal(evidenceDate(data.doctors[0], sources), "2025-01-01");
  assert.equal(isStale(evidenceDate(data.doctors[0], sources), now), true);
});
