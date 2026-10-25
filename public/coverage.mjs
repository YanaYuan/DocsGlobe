import { isDate, isObject, isSafeUrl, isText } from "./directory.mjs";

export function validateCoverage(data, directory, now = new Date()) {
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const record = (value, fields, label) => {
    if (!isObject(value)) {
      errors.push(`${label} 必须为对象。`);
      return false;
    }
    for (const key of Object.keys(value)) {
      check(fields.includes(key), `${label} 包含未支持的字段：${key}`);
    }
    return true;
  };
  const array = (value, label) => {
    if (!Array.isArray(value)) {
      errors.push(`${label} 必须为数组。`);
      return [];
    }
    return value;
  };
  const unique = (seen, value, label) => {
    check(!seen.has(value), `${label} 重复：${value}`);
    seen.add(value);
  };
  const today = now.toISOString().slice(0, 10);
  const date = value => isDate(value) && value <= today && value <= data.updatedAt;
  if (!record(data, ["schemaVersion", "updatedAt", "coverage", "citywideHospitalTotal",
    "rightsStatus", "baseline", "accessIssues", "pilots", "workLog"], "覆盖进度")) return errors;
  check(data.schemaVersion === 1, "覆盖进度版本无效。");
  check(isDate(data.updatedAt) && data.updatedAt <= today, "覆盖进度日期无效或在未来。");
  check(data.coverage === "partial" && data.citywideHospitalTotal === null,
    "当前基准只能标为部分清单，全市医院总数必须保持未知。");
  check(data.rightsStatus === "not-reviewed", "不得将公开访问标为已获批量使用授权。");
  if (!Array.isArray(directory?.hospitals) || !Array.isArray(directory?.doctors) ||
    !directory.hospitals.every(isObject) || !directory.doctors.every(isObject)) {
    errors.push("覆盖进度必须关联有效医生目录。");
    return errors;
  }
  const hospitals = new Map(directory.hospitals.map(h => [h.id, h]));
  const doctors = new Map(directory.doctors.map(d => [d.id, d]));
  const logIds = new Set();
  for (const log of array(data.workLog, "工作记录")) {
    if (!record(log, ["id", "title", "startedAt", "completedAt", "doctorCountBefore",
      "doctorCountAfter", "note"], "工作记录")) continue;
    check(isText(log.id) && isText(log.title) && isText(log.note), "工作记录缺少标识、标题或计时范围。");
    unique(logIds, log.id, "工作记录");
    const timestamp = value => typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
      Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
    check(timestamp(log.startedAt) && timestamp(log.completedAt) &&
      log.startedAt < log.completedAt && log.completedAt <= now.toISOString() &&
      log.completedAt.slice(0, 10) <= data.updatedAt, "工作记录起止时间无效或在未来。");
    check(Number.isInteger(log.doctorCountBefore) && log.doctorCountBefore >= 0 &&
      Number.isInteger(log.doctorCountAfter) && log.doctorCountAfter > log.doctorCountBefore &&
      log.doctorCountAfter <= directory.doctors.length, "工作记录的入库数量无效。");
  }
  const baselineHospitalIds = new Set();
  const baseline = data.baseline;
  if (record(baseline, ["source", "scopeNote", "entityResolution", "gradeVerification", "records"], "医院基准")) {
    check(isText(baseline.scopeNote), "医院基准缺少范围说明。");
    check(baseline.entityResolution === "pending" && baseline.gradeVerification === "government-list-only",
      "医保机构记录尚未完成主体归并或卫健委等级核验。");
    const source = baseline.source;
    if (record(source, ["title", "publisher", "url", "publishedAt", "checkedAt"], "基准来源")) {
      check(isText(source.title) && isText(source.publisher), "基准来源缺少名称或发布者。");
      check(isSafeUrl(source.url), "基准来源链接无效。");
      check(date(source.checkedAt) && isDate(source.publishedAt) && source.publishedAt <= source.checkedAt,
        "基准来源日期无效。");
    }
    const codes = new Set();
    const districts = new Set(["东城区", "西城区", "朝阳区", "海淀区", "丰台区", "石景山区",
      "门头沟区", "房山区", "通州区", "顺义区", "昌平区", "大兴区", "怀柔区", "平谷区", "密云区", "延庆区"]);
    for (const item of array(baseline.records, "机构记录")) {
      if (!record(item, ["insuranceCode", "name", "insuranceDistrict", "directoryHospitalId"], "机构记录")) continue;
      check(typeof item.insuranceCode === "string" && /^\d{8}$/.test(item.insuranceCode), "医保编码必须保留八位字符串。");
      unique(codes, item.insuranceCode, "医保编码");
      check(isText(item.name) && districts.has(item.insuranceDistrict), "机构名称或医保区划无效。");
      if (item.directoryHospitalId !== null) {
        const hospital = hospitals.get(item.directoryHospitalId);
        check(hospital !== undefined, "机构关联医院不存在。");
        check(hospital !== undefined && item.name.includes(hospital.name), "机构名称与关联医院不一致。");
        baselineHospitalIds.add(item.directoryHospitalId);
      }
    }
  }
  const issueUrls = new Set();
  for (const issue of array(data.accessIssues, "访问缺口")) {
    if (!record(issue, ["url", "checkedAt", "status", "note"], "访问缺口")) continue;
    check(isSafeUrl(issue.url) && date(issue.checkedAt), "访问缺口链接或日期无效。");
    unique(issueUrls, issue.url, "访问缺口链接");
    check(["blocked", "incomplete"].includes(issue.status) && isText(issue.note), "访问缺口缺少明确状态或原因。");
  }
  const pilotIds = new Set();
  for (const pilot of array(data.pilots, "试点")) {
    if (!record(pilot, ["hospitalId", "indexUrl", "checkedAt", "rosterComplete", "note", "departments", "lists"], "试点")) continue;
    check(hospitals.has(pilot.hospitalId) && baselineHospitalIds.has(pilot.hospitalId), "试点医院必须关联目录和基准记录。");
    unique(pilotIds, pilot.hospitalId, "试点医院");
    check(isSafeUrl(pilot.indexUrl) && date(pilot.checkedAt), "试点入口或核对日期无效。");
    check(pilot.rosterComplete === false && isText(pilot.note), "试点不得声称已覆盖全院，必须保留范围说明。");
    const departmentNames = new Set();
    const departmentUrls = new Set();
    for (const department of array(pilot.departments, "科室入口")) {
      if (!record(department, ["name", "url", "audit"], "科室入口")) continue;
      check(isText(department.name) && isSafeUrl(department.url), "科室入口名称或链接无效。");
      unique(departmentNames, department.name, "科室入口名称");
      unique(departmentUrls, department.url, "科室入口链接");
      if (department.audit !== undefined &&
        record(department.audit, ["status", "checkedAt", "urls", "note"], "入口核查")) {
        const audit = department.audit;
        check(["roster-reviewed", "no-public-roster"].includes(audit.status) &&
          date(audit.checkedAt) && isText(audit.note), "入口核查状态、日期或说明无效。");
        const urls = array(audit.urls, "入口核查来源");
        check(urls.length > 0 && urls.every(isSafeUrl) && new Set(urls).size === urls.length,
          "入口核查必须提供不重复的有效来源链接。");
      }
    }
    const listNames = new Set();
    for (const list of array(pilot.lists, "名录快照")) {
      if (!record(list, ["department", "status", "declaredDoctorCount", "declaredPageCount", "note", "pages"], "名录快照")) continue;
      check(departmentNames.has(list.department), "名录快照科室不在已发现入口中。");
      unique(listNames, list.department, "名录快照科室");
      check(["captured", "needs-review"].includes(list.status) && isText(list.note), "名录快照状态或说明无效。");
      for (const field of ["declaredDoctorCount", "declaredPageCount"]) {
        check(list[field] === null || (Number.isInteger(list[field]) && list[field] > 0), `名录 ${field} 必须为正整数或未知。`);
      }
      const pages = array(list.pages, "名录分页");
      check(pages.length > 0, "名录快照缺少实际核对页。");
      const pageUrls = new Set();
      const profiles = new Set();
      const linkedIds = new Set();
      let count = 0;
      for (const page of pages) {
        if (!record(page, ["url", "doctors"], "名录分页")) continue;
        check(isSafeUrl(page.url), "名录分页链接无效。");
        unique(pageUrls, page.url, "名录分页");
        const entries = array(page.doctors, "列名记录");
        check(entries.length > 0, "已核对页不能没有列名记录。");
        count += entries.length;
        for (const entry of entries) {
          if (!record(entry, ["name", "profileUrl", "directoryDoctorId", "exclusionReason", "reviewNote"], "列名记录")) continue;
          check(isText(entry.name), "列名记录缺少姓名。");
          if (entry.exclusionReason !== undefined) {
            check(isText(entry.exclusionReason) && entry.directoryDoctorId === null &&
              entry.reviewNote === undefined, "范围排除必须提供原因，且不能同时关联医生或标为待核实。");
          }
          if (entry.reviewNote !== undefined) {
            check(isText(entry.reviewNote) && entry.directoryDoctorId === null,
              "待核实说明必须为非空文本，且不能同时关联医生。");
          }
          check(entry.profileUrl === null || isSafeUrl(entry.profileUrl), "个人介绍链接无效，未知时应为 null。");
          if (entry.profileUrl !== null) unique(profiles, entry.profileUrl, "个人介绍链接");
          if (entry.directoryDoctorId !== null) {
            const doctor = doctors.get(entry.directoryDoctorId);
            check(doctor !== undefined && doctor.name === entry.name && doctor.hospitalId === pilot.hospitalId,
              "列名记录与关联医生的姓名或医院不一致。");
            unique(linkedIds, entry.directoryDoctorId, "关联医生");
          }
        }
      }
      if (list.status === "captured") {
        check(list.declaredDoctorCount === count && list.declaredPageCount === pages.length,
          "已完成列名快照必须与声明人数和分页数一致；否则标为待核实。");
      }
    }
    for (const department of Array.isArray(pilot.departments) ? pilot.departments : []) {
      if (!isObject(department?.audit)) continue;
      check(department.audit.status === "roster-reviewed" ? listNames.has(department.name) :
        !listNames.has(department.name), "入口核查结论与实际名录快照不一致。");
    }
  }
  return errors;
}

export function coverageStats(data) {
  const entries = data.pilots.flatMap(p => p.lists.flatMap(l => l.pages.flatMap(page => page.doctors)));
  const linkedRecords = entries.filter(entry => entry.directoryDoctorId !== null).length;
  const excludedRecords = entries.filter(entry => entry.exclusionReason !== undefined).length;
  return {
    baselineRecords: data.baseline.records.length,
    departmentEntries: data.pilots.reduce((count, p) => count + p.departments.length, 0),
    listedRecords: entries.length,
    linkedRecords,
    excludedRecords,
    pendingRecords: entries.length - linkedRecords - excludedRecords,
  };
}

export function planStats(data, directory) {
  const progress = (current, total) => ({
    current, total, remaining: Math.max(0, total - current),
    percent: total === 0 ? null : Math.min(100, Math.round(current / total * 100)),
  });
  const lists = data.pilots.flatMap(pilot => pilot.lists.map(list => {
    const entries = list.pages.flatMap(page => page.doctors);
    return {
      hospitalId: pilot.hospitalId, department: list.department, status: list.status,
      linked: entries.filter(e => e.directoryDoctorId !== null).length,
      excluded: entries.filter(e => e.exclusionReason !== undefined).length,
      ...progress(entries.filter(e => e.directoryDoctorId !== null || e.exclusionReason !== undefined).length, entries.length),
    };
  }));
  return {
    milestone: progress(directory.doctors.length, 100),
    entries: progress(data.pilots.reduce((count, p) => count + p.departments.filter(d =>
      d.audit !== undefined || p.lists.some(l => l.department === d.name)).length, 0),
    data.pilots.reduce((count, p) => count + p.departments.length, 0)),
    email: progress(directory.doctors.filter(d => d.contacts.length > 0).length, directory.doctors.length),
    lists,
  };
}
