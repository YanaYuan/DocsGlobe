import { CONTACT_SOURCE_LABELS, FIELD_LABELS, emailContactHref, evidenceDate, filterDoctors, isStale,
  validateDirectory } from "./directory.mjs";
import { coverageStats, planStats, validateCoverage } from "./coverage.mjs";

const query = document.querySelector("#query");
const hospitalSelect = document.querySelector("#hospital");
const departmentSelect = document.querySelector("#department");
const doctorRows = document.querySelector("#doctor-rows");
const tableContainer = document.querySelector("#doctor-table-container");
const resultCount = document.querySelector("#result-count");

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function externalLink(label, url) {
  const notice = new URL(url).protocol === "http:" ? "（HTTP旧站，连接未加密）" : "";
  const link = element("a", `${label}${notice} ↗`);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `${label}${notice}（在新标签页打开）`);
  return link;
}

function contactSection(doctor, sources) {
  const section = element("section", undefined, "contacts");
  section.setAttribute("aria-label", `${doctor.name}的公开联系方式`);
  if (!doctor.contacts?.length) {
    section.append(element("span", "未核实"));
    return section;
  }
  for (const contact of doctor.contacts) {
    const source = sources.find(item => item.id === contact.sourceId);
    const entry = element("div", undefined, "contact-entry");
    const link = element("a", contact.value, "email-link");
    link.href = emailContactHref(contact.value);
    link.setAttribute("aria-label", `${doctor.name}的公开学术邮箱 ${contact.value}（打开邮件客户端）`);
    entry.append(link);
    entry.append(externalLink("查看邮箱原始出处", source.url));
    section.append(entry);
  }
  return section;
}

function doctorTableRow(doctor, data) {
  const hospital = data.hospitals.find(item => item.id === doctor.hospitalId);
  const profile = data.sources.find(source => source.id === doctor.profileSourceId);
  const checkedAt = evidenceDate(doctor, data.sources);
  const row = element("tr", undefined, "doctor-row");
  const name = element("th", doctor.name);
  name.scope = "row";
  row.append(name);
  for (const text of [hospital.name, doctor.department, doctor.title]) {
    row.append(element("td", text));
  }
  const introduction = element("td");
  const biography = element("section", undefined, "biography");
  biography.setAttribute("aria-label", `${doctor.name}的专业方向与医生介绍`);
  biography.append(element("p", `专业方向：${doctor.focusAreas.join("、")}`, "focus-areas"));
  for (const item of doctor.experience) biography.append(element("p", item, "experience"));
  if (doctor.profileNote) biography.append(element("p", doctor.profileNote, "contact-note profile-note"));
  introduction.append(biography);
  row.append(introduction);
  const email = element("td");
  email.append(contactSection(doctor, data.sources));
  row.append(email, element("td", "未收录"));

  const links = element("td", undefined, "doctor-links");
  links.append(externalLink("官方介绍", profile.url),
    externalLink("医院官网", hospital.website));
  const linkedUrls = new Set([profile.url, hospital.website]);
  const details = element("details", undefined, "sources");
  details.append(element("summary", "查看核对说明"));
  const list = element("ul", undefined, "source-list");
  for (const entry of [...doctor.evidence, ...hospital.evidence]) {
    const source = data.sources.find(item => item.id === entry.sourceId);
    if (!linkedUrls.has(source.url)) {
      links.append(externalLink(source.title, source.url));
      linkedUrls.add(source.url);
    }
    const item = element("li");
    item.append(element("span", source.title));
    item.append(element("small", `支持字段：${entry.fields.map(field => FIELD_LABELS[field]).join("、")}`));
    item.append(element("small", `发布者：${source.publisher} · 核对：${source.accessedAt} · ${source.accessMethod === "browser" ? "浏览器直接访问" : "网页直接读取"}`));
    if (source.kind === "journal-article") item.append(element("small", `论文发表年份：${source.publishedYear}`));
    if (source.kind === "society-notice") item.append(element("small", `学术通知年份：${source.publishedYear}`));
    item.append(element("small", source.sourceUpdatedAt
      ? `原站更新日期：${source.sourceUpdatedAt}`
      : "原站更新日期未确认；访问成功不代表资料仍为最新。"));
    list.append(item);
  }
  links.append(element("small", `核对：${checkedAt}`));
  details.append(list);
  details.append(element("p", `医院等级：${hospital.grade}`, "contact-note"));
  for (const contact of doctor.contacts ?? []) {
    const source = data.sources.find(item => item.id === contact.sourceId);
    details.append(element("p", `${contact.value} · ${CONTACT_SOURCE_LABELS[source.kind]} · 页面核对 ${source.accessedAt}`, "contact-note"));
    details.append(element("p", contact.identityNote, "contact-note"));
    details.append(element("p", source.kind === "journal-article"
      ? `论文发表于 ${source.publishedYear} 年；邮箱为发表时的通讯信息，不代表当前仍可用。`
      : source.kind === "clinical-trial-registry"
        ? "邮箱取自试验登记的科研联系人栏，不代表当前招募、可预约就诊或接受患者咨询；未验证收信或回复。"
        : source.kind === "society-notice"
          ? `邮箱取自 ${source.publishedYear} 年学术通知的具名联系人栏，可能用于当时活动或团队联系；不代表活动仍开放、本人专用或可预约就诊。`
        : "邮箱取自公开介绍，未验证当前收信、回复或是否接受患者咨询。", "contact-note"));
    if (isStale(source.accessedAt)) {
      details.append(element("p", "该邮箱来源已满 180 天未复核，请重新查看原站。", "stale"));
    }
  }
  details.append(element("p", "患者评价：暂未收录。当前执业与出诊状态：未独立核验。", "record-note"));
  details.append(element("p", `记录 ID：${doctor.id}`, "record-id"));
  links.append(details);
  if (isStale(checkedAt) || isStale(evidenceDate(hospital, data.sources))) {
    links.append(element("p", "部分来源已满 180 天未复核", "stale"));
  }
  row.append(links);
  return row;
}

function initialize(data) {
  for (const hospital of data.hospitals) {
    hospitalSelect.add(new Option(hospital.name, hospital.id));
  }
  const departments = [...new Set(data.doctors.map(doctor => doctor.department))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  for (const department of departments) departmentSelect.add(new Option(department, department));
  document.querySelector("#hospital-count").textContent = String(data.hospitals.length);
  document.querySelector("#doctor-count").textContent = String(data.doctors.length);
  document.querySelector("#filter-fields").disabled = false;
  const render = () => {
    const matches = filterDoctors(data, {
      query: query.value,
      hospitalId: hospitalSelect.value,
      department: departmentSelect.value,
    });
    doctorRows.replaceChildren(...matches.map(doctor => doctorTableRow(doctor, data)));
    tableContainer.hidden = matches.length === 0;
    resultCount.textContent = `找到 ${matches.length} 位医生 / 已收录 ${data.doctors.length} 位`;
    document.querySelector("#empty").hidden = matches.length !== 0;
  };
  const form = document.querySelector("#filters");
  form.addEventListener("submit", event => event.preventDefault());
  query.addEventListener("input", render);
  hospitalSelect.addEventListener("change", render);
  departmentSelect.addEventListener("change", render);
  form.addEventListener("reset", event => {
    event.preventDefault();
    query.value = "";
    hospitalSelect.value = "";
    departmentSelect.value = "";
    render();
    query.focus();
  });
  render();
}

function renderPlan(data, directory) {
  const content = document.querySelector("#plan-content");
  content.replaceChildren();
  const stats = planStats(data, directory);
  const grid = element("div", undefined, "progress-grid");
  const card = (title, counts, note) => {
    const article = element("article", undefined, "progress-card");
    const label = `${title}：${counts.current} / ${counts.total}`;
    article.append(element("h3", title), element("strong",
      `${counts.current} / ${counts.total} · ${counts.percent === null ? "暂无分母" : `${counts.percent}%`}`));
    if (counts.total > 0) {
      const bar = element("progress");
      bar.max = counts.total;
      bar.value = Math.min(counts.current, counts.total);
      bar.setAttribute("aria-label", label);
      article.append(bar);
    }
    article.append(element("p", note));
    grid.append(article);
  };
  card("首个100位医生里程碑", stats.milestone,
    stats.milestone.remaining === 0 ? "已达成；仅为阶段数量目标，不代表全市或全院覆盖。" :
      `还需新增 ${stats.milestone.remaining} 位有来源的医生。邮箱缺失不阻塞建档。`);
  card("两院入口已有核查记录", stats.entries,
    `包括名录快照和未发现公开名录的核查结论；还有 ${stats.entries.remaining} 个入口未记录。不是全院医生覆盖率。`);
  card("公开学术邮箱收录率", stats.email,
    `${stats.email.remaining} 位尚无已核实邮箱；无法保证都能找到，已收录邮箱也未验证收信。`);
  for (const list of stats.lists) {
    const hospital = directory.hospitals.find(h => h.id === list.hospitalId);
    card(`${hospital.name} · ${list.department}`, list,
      `已处理列名：${list.linked} 条关联档案、${list.excluded} 条有依据排除；${list.remaining} 条待核实。` +
      (list.status === "needs-review" ? "人数或完整性仍有冲突，不代表全科覆盖。" : "仅覆盖指定列表快照，不代表所有在岗医生。"));
  }
  content.append(grid);
  const steps = element("ol", undefined, "plan-steps");
  for (const text of [
    `第一阶段：至少100位有来源的医生介绍 — ${stats.milestone.remaining === 0 ? "已达成" : `还差${stats.milestone.remaining}位`}。`,
    "第二阶段：继续检查两家试点尚未盘点的入口，并复核已有名单中的身份、范围及遗漏问题；介绍与邮箱同批核对，邮箱缺失不阻塞建档，不以入口数推算医生总数。",
    "第三阶段：待名单分母明确后，按科室完成两院档案；退休、迁院、同名、研究岗位和访问失败单列处理，不能悄悄从分母中删除。",
    "第四阶段：核实北京三甲医院基准，再逐院扩展。全市总量及完成日期尚不能确定；患者评价与GitHub公开发布另行验收。",
  ]) steps.append(element("li", text));
  content.append(element("h3", "接下来做什么"), steps,
    element("p", "全市进度：总量未知，暂不显示百分比或倒计时。原先2—6小时达到100位、1—3个工作日盘点入口只是未校准预算，不是交付承诺。", "notice"));
  content.append(element("h3", "实际工作记录与时间边界"));
  if (data.workLog.length === 0) content.append(element("p", "尚无计时样本，暂不推算完成日期。"));
  for (const log of data.workLog) {
    const minutes = ((Date.parse(log.completedAt) - Date.parse(log.startedAt)) / 60000).toFixed(1);
    const article = element("article", undefined, "work-log");
    article.append(element("strong",
      `${log.title}：新增 ${log.doctorCountAfter - log.doctorCountBefore} 位（${log.doctorCountBefore} → ${log.doctorCountAfter}），经过 ${minutes} 分钟`),
      element("p", `${log.startedAt} 至 ${log.completedAt}（UTC）`),
      element("p", log.note));
    content.append(article);
  }
  content.append(element("p", "当前为人工触发、静态数据更新；没有后台采集任务，进度条不是正在运行的任务动画。后续按批记录耗时，结合剩余名单和访问阻塞再修订预算。", "notice"));
  document.querySelector("#plan-status").textContent = `名单快照更新 ${data.updatedAt} · 邮箱与数量按当前目录计算 · 不随下方筛选改变`;
  content.hidden = false;
}

function renderCoverage(data, directory) {
  const content = document.querySelector("#coverage-content");
  const stats = coverageStats(data);
  const summary = element("p",
    `${stats.baselineRecords} 条三甲机构候选记录 · ${stats.departmentEntries} 个已发现科室入口 · ${stats.listedRecords} 条人员列名记录`,
    "coverage-summary");
  content.append(summary, element("p",
    `其中 ${stats.linkedRecords} 条已关联医生档案、${stats.excludedRecords} 条有依据排除、${stats.pendingRecords} 条待核实。跨科室列名可能指向同一医生，列名数不是去重人数。未关联人员不计入 ${directory.doctors.length} 位已收录医生；全市医院总数与覆盖率仍未知。`));
  const baseline = element("details");
  baseline.append(element("summary", `医院基准候选 · ${stats.baselineRecords} 条（含院区，待主体归并）`));
  const source = data.baseline.source;
  baseline.append(element("p", data.baseline.scopeNote),
    externalLink(`${source.publisher}：${source.title}`, source.url),
    element("p", `来源标注日期 ${source.publishedAt} · 直接核对 ${source.checkedAt}。政府名单记载为三级甲等，仍待卫健委交叉核验。`));
  const table = element("table", undefined, "coverage-table");
  table.append(element("caption", "保留来源名称与医保编码；同名、别名和院区不自动视为独立医院"));
  const head = element("thead");
  const headings = element("tr");
  for (const label of ["来源机构名称", "医保区划", "医保编码", "已整理档案"]) {
    const cell = element("th", label);
    cell.scope = "col";
    headings.append(cell);
  }
  head.append(headings);
  const body = element("tbody");
  for (const item of data.baseline.records) {
    const row = element("tr");
    const count = directory.doctors.filter(doctor => doctor.hospitalId === item.directoryHospitalId).length;
    for (const text of [item.name, item.insuranceDistrict, item.insuranceCode,
      item.directoryHospitalId === null ? "尚未关联" : `${count} 位`]) {
      row.append(element("td", text));
    }
    body.append(row);
  }
  table.append(head, body);
  const scroll = element("div", undefined, "coverage-table-scroll");
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", "医院候选表，可横向滚动");
  scroll.append(table);
  baseline.append(scroll);
  content.append(baseline);

  for (const pilot of data.pilots) {
    const hospital = directory.hospitals.find(item => item.id === pilot.hospitalId);
    const section = element("article", undefined, "coverage-pilot");
    const audited = pilot.departments.every(department => department.audit !== undefined);
    section.append(element("h3", `${hospital.name} · ${audited ? "公开入口已逐项检查，在岗总量未知" : "全院盘点未完成"}`), element("p", pilot.note),
      externalLink("官方科室索引", pilot.indexUrl), element("p", `直接核对：${pilot.checkedAt}`));
    const departments = element("details");
    departments.append(element("summary", `${pilot.departments.length} 个已发现入口 · ${audited ? "均有核查结论，不等于全员覆盖" : "不代表逐页核验完成"}`));
    const links = element("ul", undefined, "coverage-entry-list");
    for (const department of pilot.departments) {
      const item = element("li");
      item.append(externalLink(department.name, department.url));
      if (department.audit) {
        item.append(element("span", ` · ${department.audit.status === "no-public-roster" ? "未发现公开逐人名录" : "已检查公开名录"}（${department.audit.checkedAt}）`),
          element("p", department.audit.note));
        for (const url of department.audit.urls) item.append(externalLink("核查来源", url));
      }
      links.append(item);
    }
    departments.append(links);
    section.append(departments);
    for (const list of pilot.lists) {
      const entries = list.pages.flatMap(page => page.doctors);
      const details = element("details", undefined, "coverage-roster");
      details.append(element("summary",
        `${list.department} · ${entries.length} 条列名 · ${list.status === "captured" ? "可见分页列名已核对" : "人数 / 完整性待核实"}`),
      element("p", list.note));
      for (const [index, page] of list.pages.entries()) {
        details.append(externalLink(`查看已核对列表页 ${index + 1}`, page.url));
        const names = element("ul", undefined, "coverage-entry-list");
        for (const entry of page.doctors) {
          const item = element("li");
          item.append(entry.profileUrl ? externalLink(entry.name, entry.profileUrl) : element("span", entry.name),
            element("span", entry.exclusionReason ? ` · 范围排除：${entry.exclusionReason}` :
              entry.directoryDoctorId === null ? ` · 待核实：${entry.reviewNote ?? "履历 / 身份 / 范围"}` : " · 已关联医生档案"));
          names.append(item);
        }
        details.append(names);
      }
      section.append(details);
    }
    content.append(section);
  }
  const issues = element("details");
  issues.append(element("summary", `访问缺口与审核边界 · ${data.accessIssues.length} 项访问问题`));
  for (const issue of data.accessIssues) {
    const note = element("p", `${issue.checkedAt} · ${issue.note} `);
    note.append(externalLink("原入口", issue.url));
    issues.append(note);
  }
  issues.append(element("p", "尚未完成批量使用许可审核；目前仅整理有来源的公开事实摘要，不提供绕过访问限制的功能。"));
  content.append(issues);
  if ([source.checkedAt, ...data.pilots.map(pilot => pilot.checkedAt)].some(date => isStale(date))) {
    content.append(element("p", "部分覆盖依据已满 180 天未复核，不能当作当前名册。", "stale"));
  }
  document.querySelector("#coverage-status").textContent = `部分基准与试点快照 · 更新 ${data.updatedAt} · 非全市完整名录`;
  content.hidden = false;
}

async function loadCoverage(directory) {
  try {
    const response = await fetch("./data/coverage.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`覆盖进度请求失败（HTTP ${response.status}）。`);
    const data = await response.json();
    const errors = validateCoverage(data, directory);
    if (errors.length) throw new Error(`覆盖进度校验失败：${errors.join("；")}`);
    renderPlan(data, directory);
    renderCoverage(data, directory);
  } catch (error) {
    console.error("覆盖进度加载失败：", error);
    document.querySelector("#plan-content").replaceChildren();
    document.querySelector("#plan-content").hidden = true;
    document.querySelector("#plan-status").textContent = "计划进度加载失败，不代表完成数为零。请查看下方覆盖进度错误说明。";
    document.querySelector("#coverage-content").replaceChildren();
    document.querySelector("#coverage-content").hidden = true;
    document.querySelector("#coverage-status").textContent = "覆盖进度不可用，不代表进度为零。";
    const notice = document.querySelector("#coverage-error");
    notice.textContent = `无法加载覆盖进度。${error instanceof Error ? error.message : String(error)}`;
    notice.hidden = false;
  }
}

try {
  const response = await fetch("./data/beijing.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`目录请求失败（HTTP ${response.status}）。`);
  const data = await response.json();
  const errors = validateDirectory(data);
  if (errors.length) throw new Error(`数据校验失败：${errors.join("；")}`);
  initialize(data);
  void loadCoverage(data);
} catch (error) {
  console.error("医生目录加载失败：", error);
  document.querySelector("#plan-status").textContent = "医生目录加载失败，无法计算计划进度。请查看下方目录错误说明。";
  document.querySelector("#coverage-status").textContent = "医生目录加载失败，暂不能校验覆盖进度的关联记录。";
  document.querySelector("#filter-fields").disabled = true;
  doctorRows.replaceChildren();
  tableContainer.hidden = true;
  const notice = document.querySelector("#load-error");
  notice.textContent = `无法加载医生目录。${error instanceof Error ? error.message : String(error)} 请通过本地 HTTP 服务打开页面，或联系维护者检查数据。`;
  notice.hidden = false;
  resultCount.textContent = "加载失败，不能将此状态视为没有医生。";
}
