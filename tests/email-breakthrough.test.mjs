import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDirectory } from "../public/directory.mjs";
import { beforeReassessment } from "./helpers/email-reassessment.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const prior = beforeReassessment(data);
const expected = [
  ["pumch-lai-jinzhi", "赖晋智", "pumch", "心内科", "laijinzhi1973@outlook.com", "email-corresp-pmid42273130", "Jinzhi Lai"],
  ["puh3-hxywzzyxk-3131", "姚婉贞", "puh3", "呼吸与危重症医学科", "yaowanzhen@126.com", "email-corresp-pmid31213797", "Wanzhen Yao"],
  ["puh3-xhk-4281", "顾芳", "puh3", "消化科", "gf0515@sina.com", "email-corresp-pmid27382263", "Fang Gu"],
  ["puh3-nnnk-1051", "张帆", "puh3", "老年内科", "orthohui6436@sina.com", "email-corresp-pmid41368275", "Fan Zhang"],
  ["puh3-zyk-1431", "霍则军", "puh3", "中医科", "huozejun@163.com", "email-corresp-pmid39376907", "Zejun Huo"],
  ["puh3-ptwk-1521", "雷玉涛", "puh3", "普通外科", "leiyt@vip.sina.com", "email-corresp-pmid29245318", "Yutao Lei"],
  ["puh3-fck-1155", "李华军", "puh3", "妇产科", "chinalhj1967@126.com", "email-corresp-pmid36316927", "Huajun Li"],
  ["puh3-ttk-4095", "罗启鹏", "puh3", "疼痛科", "1293194276@qq.com", "email-trial-nct05610553", "Qipeng Luo"],
  ["puh3-ebhk-4911", "鲁兆毅", "puh3", "耳鼻喉科", "luzhaoyi@bjmu.edu.cn", "email-orcid-0000-0002-3501-9532", "Zhaoyi Lu"],
];
const rejected = [
  "zhangys0317@126.com",
  "zhouwlindr@163.com",
  "zhangfcdr@163.com",
  "tianxinxia@bjmu.edu.cn",
  "panly@pumch.cn",
  "liuwei0023@bjmu.edu.cn",
  "luxysin_bj3@163.com",
  "liubinsdu@163.com",
  "xy2007111@126.com",
  "1363185474@bjmu.edu.cn",
  "yaowanzhen11@edusbm.com",
];
const alreadyBoundElsewhere = [
  ["徐雁", "运动医学科", "yanxu@139.com"],
  ["王成", "运动医学科", "pkuwang@yeah.net"],
  ["周鑫", "普通外科", "zhouxinasd@sina.cn"],
  ["李民", "麻醉科", "liminanesth@bjmu.edu.cn"],
];

test("full-text correspondence, a missed site contact and one ORCID record add nine emails", () => {
  for (const [id, name, hospitalId, department, value, sourceId, english] of expected) {
    const doctor = data.doctors.find(item => item.id === id);
    assert.equal(doctor.name, name);
    assert.equal(doctor.hospitalId, hospitalId);
    assert.equal(doctor.department, department);
    assert.equal(doctor.contacts.length, 1);
    const contact = doctor.contacts[0];
    assert.equal(contact.value, value);
    assert.equal(contact.type, "email");
    assert.equal(contact.purpose, "academic");
    assert.equal(contact.sourceId, sourceId);
    assert.match(contact.identityNote, new RegExp(english.replace(" ", "\\s")));
    assert.match(contact.identityNote, /未测试收信/);
    assert.deepEqual(doctor.evidence.at(-1), { sourceId, fields: ["contacts"] });
    assert.deepEqual(data.doctors.filter(item =>
      item.contacts.some(itemContact => itemContact.value.toLowerCase() === value.toLowerCase()))
      .map(item => item.id), [id]);
    const source = data.sources.find(item => item.id === sourceId);
    assert.equal(source.accessedAt, "2026-10-14");
    assert.equal(source.accessMethod, "web");
    assert.equal(source.url.startsWith("https://"), true);
  }
  assert.match(data.doctors.find(item => item.id === "puh3-nnnk-1051").contacts[0].identityNote, /不把该地址转给同名/);
  assert.match(data.doctors.find(item => item.id === "puh3-ttk-4095").contacts[0].identityNote, /不写入电话/);
  assert.equal(data.sources.find(item => item.id === "email-trial-nct05610553").sourceUpdatedAt, "2022-11-08");
  assert.equal(data.sources.find(item => item.id === "email-orcid-0000-0002-3501-9532").kind, "university-profile");
  assert.equal(prior.doctors.find(item => item.id === "puh3-sjnk-1481").contacts.length, 0);
  const values = new Set(prior.doctors.flatMap(doctor => doctor.contacts.map(contact => contact.value.toLowerCase())));
  for (const value of rejected) assert.equal(values.has(value), false, value);
  for (const [name, department, value] of alreadyBoundElsewhere) {
    const owners = data.doctors.filter(doctor => doctor.contacts.some(contact => contact.value.toLowerCase() === value));
    assert.deepEqual(owners.map(doctor => [doctor.name, doctor.department]), [[name, department]]);
  }
  assert.equal(data.doctors.find(doctor => doctor.id === "puh3-fck-3151").contacts.length, 0);
  assert.equal(data.doctors.find(doctor => doctor.id === "puh3-gk-6623").contacts
    .filter(contact => !contact.sourceId.startsWith("email-mentor-round2-")).length, 0);
  assert.deepEqual(validateDirectory(data, new Date("2026-10-15T23:59:59Z")), []);
});
