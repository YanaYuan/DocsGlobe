export const FIELD_LABELS = Object.freeze({
  name: "姓名 / 医院名称",
  hospitalId: "所属医院",
  department: "科室",
  title: "职称",
  focusAreas: "专业方向",
  experience: "医生介绍",
  city: "城市",
  grade: "医院等级",
  website: "医院官网",
  contacts: "公开学术邮箱",
});

export const CONTACT_SOURCE_LABELS = Object.freeze({
  "university-profile": "高校 / 研究机构介绍",
  "hospital-profile": "医院介绍",
  "journal-article": "论文作者通讯信息",
  "clinical-trial-registry": "临床试验登记科研联系信息",
  "society-notice": "学会 / 学术会议联系信息",
});

const hospitalFields = ["name", "city", "grade", "website"];
const doctorFields = ["name", "hospitalId", "department", "title", "focusAreas", "experience"];

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isSafeUrl(value, allowHttp = false) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || (allowHttp === true && url.protocol === "http:")) &&
      !url.username && !url.password;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

export function isEmailAddress(value) {
  if (typeof value !== "string" || value.length > 254) return false;
  const [local] = value.split("@");
  return local.length <= 64 &&
    /^[A-Za-z0-9]+(?:[._+-][A-Za-z0-9]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/.test(value);
}

export function emailContactHref(value) {
  if (!isEmailAddress(value)) throw new TypeError("无法生成链接：公开邮箱格式无效。");
  return `mailto:${value}`;
}

export function validateDirectory(data, now = new Date()) {
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };
  if (!isObject(data)) return ["数据必须为 JSON 对象。"];
  check(data.schemaVersion === 1, "不支持的数据版本。");
  check(data.scope === "北京市三级甲等医院医生", "数据范围必须为北京市三级甲等医院医生。");
  check(data.coverage === "partial", "首版必须明确标注非全量收录。");
  for (const key of ["sources", "hospitals", "doctors"]) {
    check(Array.isArray(data[key]), `${key} 必须为数组。`);
  }
  if (errors.length) return errors;

  const today = now.toISOString().slice(0, 10);
  const index = (items, label) => {
    const map = new Map();
    for (const item of items) {
      if (!isObject(item) || !isText(item.id)) {
        errors.push(`${label} 缺少有效 ID。`);
        continue;
      }
      check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id), `${label} ID 格式无效：${item.id}`);
      check(!map.has(item.id), `${label} ID 重复：${item.id}`);
      map.set(item.id, item);
    }
    return map;
  };
  const sources = index(data.sources, "来源");
  const hospitals = index(data.hospitals, "医院");
  const doctors = index(data.doctors, "医生");
  const onlyFields = (record, fields, label = record.id) => {
    for (const key of Object.keys(record)) {
      check(fields.includes(key), `${label} 包含未支持的字段：${key}`);
    }
  };
  const evidence = (record, fields) => {
    if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
      errors.push(`${record.id} 缺少来源证据。`);
      return;
    }
    const covered = new Set();
    for (const entry of record.evidence) {
      if (!isObject(entry) || !Array.isArray(entry.fields)) {
        errors.push(`${record.id} 来源证据格式错误。`);
        continue;
      }
      check(sources.has(entry.sourceId), `${record.id} 引用了不存在的来源：${entry.sourceId}`);
      for (const field of entry.fields) {
        check(fields.includes(field), `${record.id} 证据字段无效：${field}`);
        covered.add(field);
      }
    }
    for (const field of fields) {
      check(covered.has(field), `${record.id} 的 ${field} 缺少来源。`);
    }
  };

  for (const source of sources.values()) {
    onlyFields(source, ["id", "title", "publisher", "url", "accessedAt", "accessMethod", "sourceUpdatedAt",
      "kind", "publishedYear", "allowInsecureHttp"]);
    check(isText(source.title) && isText(source.publisher), `${source.id} 缺少来源名称或发布者。`);
    check(source.allowInsecureHttp === undefined ||
      (source.allowInsecureHttp === true && typeof source.url === "string" && source.url.startsWith("http://")),
    `${source.id} HTTP 旧站例外必须明确标记且仅用于 HTTP 来源。`);
    check(isSafeUrl(source.url, source.allowInsecureHttp === true),
      `${source.id} 来源必须为有效 HTTPS 链接；已核验的 HTTP 旧站需明确标记。`);
    check(isDate(source.accessedAt) && source.accessedAt <= today, `${source.id} 核对日期无效或在未来。`);
    check(["web", "browser"].includes(source.accessMethod), `${source.id} 必须记录直接访问方式。`);
    check(source.sourceUpdatedAt === null ||
      (isDate(source.sourceUpdatedAt) && source.sourceUpdatedAt <= source.accessedAt),
    `${source.id} 原站更新日期无效；未知时应为 null。`);
    if (source.kind !== undefined) {
      check(Object.hasOwn(CONTACT_SOURCE_LABELS, source.kind), `${source.id} 联系方式来源类型无效。`);
    }
    if (["journal-article", "society-notice"].includes(source.kind) || source.publishedYear !== undefined) {
      check(Number.isInteger(source.publishedYear) && source.publishedYear >= 1800 &&
        isDate(source.accessedAt) && source.publishedYear <= Number(source.accessedAt.slice(0, 4)),
      `${source.id} 必须提供不晚于核对年份的有效发表年份。`);
    }
  }
  for (const hospital of hospitals.values()) {
    onlyFields(hospital, ["id", "name", "aliases", "city", "grade", "website", "evidence"]);
    check(isText(hospital.name), `${hospital.id} 缺少医院名称。`);
    check(hospital.city === "北京市" && hospital.grade === "三级甲等", `${hospital.id} 不属于北京三甲范围。`);
    check(Array.isArray(hospital.aliases) && hospital.aliases.every(isText), `${hospital.id} 别名无效。`);
    check(isSafeUrl(hospital.website), `${hospital.id} 医院官网链接无效。`);
    evidence(hospital, hospitalFields);
  }
  for (const doctor of doctors.values()) {
    onlyFields(doctor, ["id", "name", "hospitalId", "department", "title", "focusAreas", "experience",
      "profileSourceId", "profileNote", "practiceStatus", "reviewStatus", "contacts", "evidence"]);
    if (doctor.profileNote !== undefined) {
      check(isText(doctor.profileNote), `${doctor.id} 资料缺口或差异说明必须为非空文本。`);
    }
    for (const field of ["name", "department", "title"]) {
      check(isText(doctor[field]), `${doctor.id} 缺少 ${field}。`);
    }
    check(hospitals.has(doctor.hospitalId), `${doctor.id} 关联医院不存在。`);
    for (const field of ["focusAreas", "experience"]) {
      check(Array.isArray(doctor[field]) && doctor[field].length > 0 && doctor[field].every(isText),
        `${doctor.id} 的 ${field} 必须为非空文本数组。`);
    }
    check(sources.has(doctor.profileSourceId), `${doctor.id} 官方介绍来源不存在。`);
    check(Array.isArray(doctor.evidence) &&
      doctor.evidence.some(entry => isObject(entry) && entry.sourceId === doctor.profileSourceId),
    `${doctor.id} 官方介绍必须关联字段证据。`);
    check(doctor.practiceStatus === "not-independently-verified", `${doctor.id} 不得声称已核验实时执业状态。`);
    check(doctor.reviewStatus === "not-collected", `${doctor.id} 首版不支持患者评价数据。`);
    const contacts = doctor.contacts === undefined ? [] : doctor.contacts;
    check(Array.isArray(contacts), `${doctor.id} contacts 必须为数组；未找到时使用空数组。`);
    if (Array.isArray(contacts)) {
      const addresses = new Set();
      for (const contact of contacts) {
        if (!isObject(contact)) {
          errors.push(`${doctor.id} 联系方式格式无效。`);
          continue;
        }
        onlyFields(contact, ["type", "value", "purpose", "sourceId", "identityNote"], `${doctor.id} 联系方式`);
        check(contact.type === "email", `${doctor.id} 当前仅支持已核对的公开邮箱，不支持未经核验的电话。`);
        check(isEmailAddress(contact.value), `${doctor.id} 公开邮箱格式无效。`);
        check(contact.purpose === "academic", `${doctor.id} 高校或论文邮箱不得标为挂号、急诊或患者咨询渠道。`);
        check(isText(contact.identityNote), `${doctor.id} 联系方式缺少姓名及任职 / 研究方向的身份匹配说明。`);
        const source = sources.get(contact.sourceId);
        check(source !== undefined, `${doctor.id} 联系方式引用了不存在的来源：${contact.sourceId}`);
        check(source !== undefined && Object.hasOwn(CONTACT_SOURCE_LABELS, source.kind),
          `${doctor.id} 联系方式必须关联明确类型的医院、高校或论文来源。`);
        check(Array.isArray(doctor.evidence) && doctor.evidence.some(entry => isObject(entry) &&
          entry.sourceId === contact.sourceId && Array.isArray(entry.fields) && entry.fields.includes("contacts")),
        `${doctor.id} 联系方式缺少对应来源的字段证据。`);
        if (typeof contact.value === "string") {
          const key = contact.value.toLowerCase();
          check(!addresses.has(key), `${doctor.id} 公开邮箱重复。`);
          addresses.add(key);
        }
      }
    }
    evidence(doctor, Array.isArray(contacts) && contacts.length > 0 ? [...doctorFields, "contacts"] : doctorFields);
  }
  return errors;
}

export function filterDoctors(data, { query = "", hospitalId = "", department = "" } = {}) {
  const hospitals = new Map(data.hospitals.map(hospital => [hospital.id, hospital]));
  const terms = query.normalize("NFKC").trim().toLocaleLowerCase("zh-CN").split(/\s+/).filter(Boolean);
  return data.doctors.filter(doctor => {
    if (hospitalId && doctor.hospitalId !== hospitalId) return false;
    if (department && doctor.department !== department) return false;
    const hospital = hospitals.get(doctor.hospitalId);
    const text = [doctor.name, doctor.department, doctor.title, ...doctor.focusAreas,
      hospital.name, ...hospital.aliases].join(" ").normalize("NFKC").toLocaleLowerCase("zh-CN");
    return terms.every(term => text.includes(term));
  }).sort((a, b) => a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id));
}

export function evidenceDate(record, sources) {
  const ids = new Set(record.evidence.map(entry => entry.sourceId));
  return sources.filter(source => ids.has(source.id)).map(source => source.accessedAt).sort()[0];
}

export function isStale(date, now = new Date()) {
  return now.getTime() - new Date(`${date}T00:00:00Z`).getTime() >= 180 * 24 * 60 * 60 * 1000;
}
