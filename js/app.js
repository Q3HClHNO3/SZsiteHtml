import { calculateScheme, generateOptimizationAdvice } from "./calculations.js";

const MODEL_IMAGES = {
  import: "assets/images/model-empty.jpg",
  "方案一": "assets/images/scheme-1.jpg",
  "方案二": "assets/images/scheme-2.jpg",
  "方案三": "assets/images/scheme-3.jpg",
  "方案三优化": "assets/images/scheme-3-optimized.jpg"
};

const moduleNames = {
  import: "模型导入",
  params: "参数修改",
  capacity: "容量评估",
  efficiency: "连接效率评估",
  quality: "设施布局评估",
  comparison: "方案对比",
  aiQa: "AI 指标问答"
};

const sidebarConfig = {
  optimization: {
    title: "评估优化模型",
    items: [
      { id: "import", name: "导入模型", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
      { id: "params", name: "参数修改", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
      { id: "comparison", name: "方案对比", icon: "M3 10h18M7 15h1m4 0h1m4 0h1M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" },
      { id: "aiQa", name: "AI 指标问答", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z" }
    ]
  },
  assessment: {
    title: "评估模型矩阵",
    items: [
      { id: "capacity", name: "基面系统容量评估", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
      { id: "efficiency", name: "基面系统连接效率评估", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
      { id: "quality", name: "基面系统设施布局评估", icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" }
    ]
  }
};

const editableFields = [
  ["landArea", "基础数据", "用地面积", "㎡"],
  ["constructionLandArea", "基础数据", "建设用地面积", "㎡"],
  ["totalFloorArea", "基础数据", "总建筑面积", "㎡"],
  ["buildingBaseArea", "基础数据", "建筑基底面积", "㎡"],
  ["floorAreaRatio", "基础数据", "容积率", ""],
  ["undergroundArea", "基面系统", "地下基面", "㎡"],
  ["surfaceArea", "基面系统", "地表基面", "㎡"],
  ["elevatedArea", "基面系统", "地上基面", "㎡"],
  ["systemCount", "基面系统", "系统总数", "个"],
  ["connectionNodes", "连接效率", "连接节点数", "个"],
  ["projectionArea", "连接效率", "立体基面投影面积P", "㎡"],
  ["influenceArea", "连接效率", "影响域面积A", "㎡"],
  ["connectedFloors", "连接效率", "人工统计ΣFi", "层单位"]
];

const facilityFields = [];

let database = {};
let projectMeta = {};
let formulaPreset = null;
let state = {
  activeItemId: "import",
  isPanelOpen: true,
  selectedScheme: "方案一",
  targetDataModule: "capacity",
  isModelImported: false,
  currentModelImageKey: "import",
  currentModelImagePath: MODEL_IMAGES.import,
  importedImageStatus: "AWAITING UPLOAD...",
  isPresentationMode: false,
  showCalculationProcess: false,
  tleMode: "ppt-research",
  validationMessages: [],
  qaMessages: [
    {
      role: "assistant",
      text: "你好，我是 AI 知识库问答助手。你可以询问 C、D、HCI、VCI、TLEI、FLI 的定义、输入参数、适用场景或优化含义。",
      references: ["来源：指标说明"]
    }
  ]
};

const $ = (id) => document.getElementById(id);
const number = (value) => Number(String(value ?? 0).replace(/,/g, "")) || 0;
const fmt = (value, digits = 2) => value === null || value === undefined || !Number.isFinite(Number(value))
  ? "--"
  : Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits });
const pct = (value) => value === null || value === undefined || !Number.isFinite(Number(value)) ? "--" : `${(Number(value) * 100).toFixed(1)}`;
const researchValue = (value, digits = 5) => value === null || value === undefined || !Number.isFinite(Number(value)) ? "—" : fmt(value, digits);
const corridorModeLabel = (mode) => ({
  "verified-detail": "已核验逐条数据",
  "width-class-summary": "已核验区间面积",
  "representative-width-estimate": "典型7m连廊专业估算",
  legacy: "历史兼容（非正式研究）",
  "not-evaluable": "待补充数据"
}[mode] || "待补充数据");
const researchTleiValue = (connectivity, digits = 5) => Number.isFinite(connectivity?.TLEI_research)
  ? researchValue(connectivity.TLEI_research, digits)
  : "待补充连廊明细数据";
const cloneRows = (rows) => rows.map((row) => ({ ...row }));
const isBlank = (value) => value === null || value === undefined || String(value).trim() === "";

const indicatorExplanations = [
  ["D", "基面分布效能指数", "含义：地下、地表、地上三类基面面积占比与理想结构的接近程度。输入：三类基面面积与理想权重。输出：0-1 分布均衡值。使用场景：判断公共活动是否过度集中在单一标高。"],
  ["C", "基面容量指数", "含义：单位开发强度下的公共空间容量效能。输入：三层面积、N_i、D、容积率R。输出：C=(A_effective_10k×D)/R。"],
  ["HCI", "水平连接指数", "含义：水平覆盖与节点密度的乘积。输入：MPR、MCI。输出：HCI=MPR×MCI，不作额外归一化。"],
  ["VCI", "垂直连接指数", "含义：基面层阶度与每个连续系统连通楼层单位的乘积。输出：VCI=MLI×MSCR。"],
  ["TLEI", "立体链接效能指数", "含义：HCI、VCI 与实时连廊宽度效能 Wf 的综合。默认 PPT 研究公式，并保留旧平台兼容结果。"],
  ["FLI", "设施布局指数", "含义：逐设施功能效能 FE 与复合指数 LA 经开发强度修正后的研究值。原始值不等同于 displayScore。"]
];

const knowledgeBase = {
  C: {
    name: "基面容量指数 C",
    aliases: ["C", "容量", "基面容量", "capacity"],
    definition: "基面容量指数 C 用于衡量高强度片区内地下、地表、地上公共基面共同提供的空间承载能力。",
    inputs: "主要输入包括地表层面积、地下层面积、地上层面积、建设用地面积、容积率、有效系数以及分布效能指数 D。",
    scenario: "适用于比较不同城市设计方案的公共空间承载能力、立体开发强度和多层公共活动组织效率。",
    optimization: "当 C 偏低时，通常需要提高有效基面利用系数，补充地下或空中公共基面，并避免单一地表空间承担过多活动压力。",
    reference: "来源：基面容量评价"
  },
  D: {
    name: "分布效能指数 D",
    aliases: ["D", "分布", "分布效能", "基面分布"],
    definition: "分布效能指数 D 表达地下、地表、地上三类基面实际面积占比与理想权重结构的接近程度。",
    inputs: "主要输入包括三类基面的实际占比，以及预设的理想权重，例如地表、地下、地上各自的目标比例。",
    scenario: "适用于判断立体公共空间是否过度依赖某一标高，以及不同层面的功能分工是否均衡。",
    optimization: "当 D 偏低时，应校准三类基面的面积与功能分配，强化地下站城空间或空中连廊平台，减少地表基面过载。",
    reference: "来源：指标说明 / 基面容量评价"
  },
  HCI: {
    name: "水平连接指数 HCI",
    aliases: ["HCI", "水平连接", "水平", "横向连接"],
    definition: "水平连接指数 HCI 描述片区内公共基面在平面方向上的覆盖强度、节点密度和横向可达性。",
    inputs: "主要输入包括立体基面投影面积 P、影响域面积 A、连接节点数 N、立体基面总面积 S 和连廊宽度效能因子 Wf。",
    scenario: "适用于评估轨道出入口、公共服务界面、街区慢行路径之间的横向连续性。",
    optimization: "当 HCI 偏低时，可在核心步行路径和公共服务界面之间增加连接节点，优化横向连廊宽度和路径连续性。",
    reference: "来源：连接效率评价"
  },
  VCI: {
    name: "垂直连接指数 VCI",
    aliases: ["VCI", "垂直连接", "垂直", "竖向连接", "层阶度"],
    definition: "垂直连接指数 VCI 描述不同标高公共基面之间的转换效率和立体复合程度。",
    inputs: "主要输入包括层阶度 MLI、连通楼层数 Fi、系统总数和连廊宽度效能因子 Wf。",
    scenario: "适用于判断地下、地表、地上公共空间之间的换乘、跨层到达和复合使用效率。",
    optimization: "当 VCI 偏低时，应强化竖向转换节点，减少跨层绕行，提升站厅、地面广场、二层平台之间的直接联系。",
    reference: "来源：连接效率评价"
  },
  TLEI: {
    name: "立体链接效能指数 TLEI",
    aliases: ["TLEI", "立体链接", "链接效能", "连接效率", "整体连接"],
    definition: "立体链接效能指数 TLEI 综合反映水平连接、垂直连接、覆盖率和连通率形成的整体立体慢行网络效率。",
    inputs: "主要输入来自 HCI、VCI、MPR、MSCR、Wf 等连接效率相关中间指标。",
    scenario: "适用于多方案比选中判断哪一方案具有更好的立体通达、站城一体和跨层组织能力。",
    optimization: "当 TLEI 偏低时，应同时优化连接节点数量、关键路径宽度、标高衔接和核心公共界面的换乘组织。",
    reference: "来源：连接效率评价"
  },
  FLI: {
    name: "设施布局指数 FLI",
    aliases: ["FLI", "设施布局", "设施", "布局", "公共设施"],
    definition: "设施布局指数 FLI 衡量功能性、体验性、社会性、自发性设施配比与复合公共生活目标之间的匹配程度。",
    inputs: "主要输入包括四类设施的全局配比，以及可进一步扩展的分层配比、服务半径和人流热度数据。",
    scenario: "适用于判断公共服务设施是否过度功能化，是否支撑停留、交往、消费、活动等多元公共生活。",
    optimization: "当 FLI 偏低时，应补足体验性、社会性交往和自发活动空间，避免设施配置只满足单一通行或服务功能。",
    reference: "来源：设施布局评价"
  }
};

function currentScheme() {
  return database[state.selectedScheme];
}

function calculateCurrent(scheme = currentScheme()) {
  const results = calculateScheme({
    ...scheme.inputs,
    tleMode: state.tleMode
  }, projectMeta.idealWeights, formulaPreset, { tleMode: state.tleMode });
  scheme.computedResults = results;
  return { ...results, advice: generateOptimizationAdvice(results) };
}

function validateInputs(inputs, idealWeights = projectMeta.idealWeights) {
  const messages = [];
  editableFields.forEach(([key, category, label]) => {
    if (isBlank(inputs[key])) {
      messages.push(`${category} - ${label}不能为空。`);
      return;
    }
    if (Number(inputs[key]) < 0) messages.push(`${category} - ${label}不能为负数。`);
  });

  if (!Array.isArray(inputs.facilities)) messages.push("设施数据必须使用 research-formula-v2 逐设施数组结构。");

  const weightValues = Object.values(idealWeights || {});
  const weightSum = weightValues.reduce((sum, value) => sum + Number(value || 0), 0);
  if (weightValues.length && Math.abs(weightSum - 1) > 0.01) {
    messages.push(`分层理想权重当前合计为 ${weightSum.toFixed(2)}，必须调整为 1；系统不会静默归一化。`);
  }

  if (Number(inputs.coverageRate) < 0 || Number(inputs.coverageRate) > 100) {
    messages.push("覆盖率应控制在 0% 到 100% 之间。");
  }

  return messages;
}

function validationBlock(messages = validateInputs(currentScheme().inputs)) {
  if (!messages.length) return "";
  return `
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 flex-shrink-0 animate-in">
      <h3 class="text-xs font-bold text-amber-800 mb-2 tracking-wide">参数校验提示</h3>
      <ul class="space-y-1 text-xs leading-relaxed text-amber-800">
        ${messages.map((message) => `<li>${message}</li>`).join("")}
      </ul>
    </div>`;
}

function updateRow(rows, category, label, value, unit) {
  const row = rows.find((item) => item.category === category && item.label === label);
  if (row) {
    row.value = String(value);
    if (unit !== undefined) row.unit = unit;
  } else {
    rows.push({ category, label, value: String(value), unit: unit || "" });
  }
}

function derivedRows(moduleName, scheme = currentScheme()) {
  const rows = cloneRows(scheme.raw[moduleName] || []);
  const legacyMetricLabels = {
    capacity: ["基面分布效能指数D", "基面容量指数C"],
    efficiency: ["水平连接指数HCI", "垂直连接指数VCI", "立体链接效能指数TLEI", "Wf计算值"],
    quality: ["设施布局指数（FLI）", "设施功能效能指数（FE）", "设施布局复合指数（LA）"]
  }[moduleName] || [];
  rows.forEach((row) => {
    if (legacyMetricLabels.includes(row.label)) {
      row.category = "旧平台展示值";
      row.label = `${row.label}（旧）`;
    }
  });
  const results = calculateCurrent(scheme);
  const inputs = scheme.inputs;

  if (moduleName === "params") {
    editableFields.slice(0, 10).forEach(([key, category, label, unit]) => {
      updateRow(rows, category, label, fmt(inputs[key], 2), unit);
    });
  }

  if (moduleName === "capacity") {
    updateRow(rows, "研究原始指标", "基面分布效能指数D", researchValue(results.capacity.D), "");
    updateRow(rows, "研究原始指标", "基面容量指数C", researchValue(results.capacity.C), "");
    updateRow(rows, "研究原始指标", "有效公共空间面积（㎡）", fmt(results.capacity.effectiveAreaM2), "㎡");
    updateRow(rows, "研究原始指标", "有效公共空间面积（万㎡）", fmt(results.capacity.effectiveArea10k, 6), "万㎡");
    updateRow(rows, "归一化展示评分", "容量展示评分", researchValue(results.displayScores.capacity, 2), Number.isFinite(results.displayScores.capacity) ? "/100" : "");
    updateRow(rows, "分层公共空间面积（Ai）", "地表层", fmt(inputs.surfaceArea), "㎡");
    updateRow(rows, "分层公共空间面积（Ai）", "地下层", fmt(inputs.undergroundArea), "㎡");
    updateRow(rows, "分层公共空间面积（Ai）", "地上层", fmt(inputs.elevatedArea), "㎡");
    updateRow(rows, "分层实际占比（Pi）", "地表层", pct(results.capacity.actualRatios.surface), "%");
    updateRow(rows, "分层实际占比（Pi）", "地下层", pct(results.capacity.actualRatios.underground), "%");
    updateRow(rows, "分层实际占比（Pi）", "地上层", pct(results.capacity.actualRatios.elevated), "%");
  }

  if (moduleName === "efficiency") {
    updateRow(rows, "研究原始指标", "水平连接指数HCI", researchValue(results.connectivity.HCI), "");
    updateRow(rows, "研究原始指标", "垂直连接指数VCI", researchValue(results.connectivity.VCI), "");
    updateRow(rows, "研究原始指标", "立体链接效能指数TLEI", researchTleiValue(results.connectivity), "");
    updateRow(rows, "研究原始指标", "正式研究TLEI", researchTleiValue(results.connectivity), "");
    updateRow(rows, "研究原始指标", "旧平台兼容公式TLEI", researchValue(results.connectivity.TLEI_legacy), "");
    updateRow(rows, "归一化展示评分", "连接展示评分", researchValue(results.displayScores.connectivity, 2), Number.isFinite(results.displayScores.connectivity) ? "/100" : "");
    updateRow(rows, "连廊数据状态", "数据状态", results.connectivity.inputMode === "representative-width-estimate" ? "专业估算 · 结果已生成" : inputs.corridorDataStatus || "已核验", "");
    updateRow(rows, "连廊数据状态", "数据输入模式", corridorModeLabel(results.connectivity.inputMode), "");
    updateRow(rows, "连廊数据状态", "代表性连廊宽度", results.connectivity.representativeWidth, "m");
    updateRow(rows, "连廊数据状态", "方法说明", "Wf 当前采用典型7m连廊估算值1.20，属于专业估算口径，后续可使用Rhino/CAD实测数据替换。", "");
    updateRow(rows, "连廊数据状态", "连廊总面积", Number.isFinite(results.connectivity.totalCorridorArea) ? fmt(results.connectivity.totalCorridorArea) : "估算口径不使用绝对面积", Number.isFinite(results.connectivity.totalCorridorArea) ? "㎡" : "");
    updateRow(rows, "立体基面覆盖率（MPR）", "立体基面投影面积P", fmt(inputs.projectionArea), "㎡");
    updateRow(rows, "立体基面覆盖率（MPR）", "影响域面积A", fmt(inputs.influenceArea), "㎡");
    updateRow(rows, "立体基面覆盖率（MPR）", "MPR计算值", results.connectivity.MPR, "");
    updateRow(rows, "立体基面连接度（MCI）", "连接节点数N", fmt(inputs.connectionNodes, 0), "个");
    updateRow(rows, "立体基面连接度（MCI）", "立体基面总面积S", fmt(results.capacity.totalBaseArea), "㎡");
    updateRow(rows, "立体基面连接度（MCI）", "MCI计算值", results.connectivity.MCI, "个/万㎡");
    updateRow(rows, "立体基面层阶度（MLI）", "MLI计算值", researchValue(results.connectivity.MLI), "");
    updateRow(rows, "基面连通率（MSCR）", "基面连接楼层数Fi", fmt(inputs.connectedFloors, 0), "层");
    updateRow(rows, "基面连通率（MSCR）", "MSCR计算值", researchValue(results.connectivity.MSCR), "层单位/连续系统");
    updateRow(rows, "连廊宽度效能因子（Wf）", "Wf计算值", results.connectivity.inputMode === "legacy" ? `${researchValue(results.connectivity.Wf)}（历史兼容）` : researchValue(results.connectivity.Wf), "");
  }

  if (moduleName === "quality") {
    updateRow(rows, "研究原始指标", "设施功能效能指数（FE）", researchValue(results.facility.FE), "");
    updateRow(rows, "研究原始指标", "总体功能配比匹配度（D_func）", researchValue(results.facility.D_func), "");
    updateRow(rows, "研究原始指标", "垂直布局匹配度（D_vert）", researchValue(results.facility.D_vert), "");
    updateRow(rows, "研究原始指标", "设施布局复合指数（LA）", researchValue(results.facility.LA), "");
    updateRow(rows, "研究原始指标", "设施布局指数（FLI）", researchValue(results.facility.FLI), "");
    updateRow(rows, "归一化展示评分", "设施展示评分", researchValue(results.facility.displayScore, 2), Number.isFinite(results.facility.displayScore) ? "/100" : "");
    updateRow(rows, "数据诊断", "research-formula-v2", results.facility.diagnostics.join("；"), "");
    const legacy = inputs.legacyFacilityRatios || {};
    updateRow(rows, "旧平台展示值", "A1旧汇总比例", pct(legacy.functional), "%");
    updateRow(rows, "旧平台展示值", "A2旧汇总比例", pct(legacy.experiential), "%");
    updateRow(rows, "旧平台展示值", "A3旧汇总比例", pct(legacy.social), "%");
    updateRow(rows, "旧平台展示值", "A4旧汇总比例", pct(legacy.spontaneous), "%");
  }

  return rows;
}

function renderSidebar() {
  const container = $("sidebar-content");
  const renderSection = (config) => `
    <div class="mb-6">
      <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">${config.title}</h3>
      <div class="space-y-1">
        ${config.items.map((item) => {
          const isActive = state.activeItemId === item.id;
          return `
            <button onclick="handleSidebarClick('${item.id}')" class="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-xs transition-all duration-200 group ${isActive ? "bg-cyan-800 text-white shadow-md shadow-cyan-900/10" : "text-slate-500 hover:bg-slate-50 hover:text-cyan-800"}">
              <svg class="w-4 h-4 ${isActive ? "text-white" : "text-slate-300 group-hover:text-cyan-700"}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${item.icon}"/>
              </svg>
              <span class="font-medium text-left">${item.name}</span>
            </button>`;
        }).join("")}
      </div>
    </div>`;
  container.innerHTML = renderSection(sidebarConfig.optimization) + renderSection(sidebarConfig.assessment);
}

function renderRows(rows, editable = false) {
  return rows.map((item, idx, arr) => {
    const showCategory = idx === 0 || item.category !== arr[idx - 1].category;
    let rowSpan = 1;
    if (showCategory) {
      for (let i = idx + 1; i < arr.length; i++) {
        if (arr[i].category === item.category) rowSpan++;
        else break;
      }
    }
    const editConfig = editableFields.find((field) => field[2] === item.label) || facilityFields.find((field) => field[2] === item.label);
    const isFacility = facilityFields.some((field) => field[2] === item.label);
    const rawValue = editConfig
      ? (isFacility ? (currentScheme().inputs.facilities[editConfig[0]] || 0) * 100 : currentScheme().inputs[editConfig[0]])
      : number(item.value);
    return `
      <tr class="hover:bg-slate-50/50 transition-colors">
        ${showCategory ? `<td rowspan="${rowSpan}" class="font-medium text-slate-600 bg-white">${item.category}</td>` : ""}
        <td>${item.label}</td>
        <td class="font-mono">
          ${editable && editConfig ? `
            <div class="flex items-center gap-2">
              <input type="number" step="0.01" min="0" class="input-field w-24" data-key="${editConfig[0]}" data-facility="${isFacility ? "1" : "0"}" value="${rawValue ?? 0}">
              <span class="text-xs text-slate-400">${item.unit}</span>
            </div>` : `<span class="text-cyan-700 font-semibold">${item.value}</span> <span class="text-xs text-slate-400 ml-1">${item.unit}</span>`}
        </td>
      </tr>`;
  }).join("");
}

function adviceBlock(type) {
  const advice = calculateCurrent().advice;
  const focused = advice.filter((item) => {
    if (type === "capacity") return /基面|容量|地表|地下|空中/.test(item);
    if (type === "efficiency") return /连接|连廊|节点|可达/.test(item);
    if (type === "quality") return /设施|公共生活|活动/.test(item);
    return true;
  });
  const list = focused.length ? focused : advice.slice(0, 2);
  return `
    <div class="bg-cyan-50/60 border border-cyan-100 rounded-xl p-4 flex-shrink-0 animate-in">
      <h3 class="text-xs font-bold text-cyan-900 mb-2 tracking-wide">优化建议</h3>
      <ul class="space-y-2 text-xs leading-relaxed text-slate-600">
        ${list.map((item) => `<li class="flex gap-2"><span class="text-cyan-700 font-bold">•</span><span>${item}</span></li>`).join("")}
      </ul>
    </div>`;
}

function researchStatusBlock(type) {
  const results = calculateCurrent();
  const moduleResult = type === "capacity" ? results.capacity : type === "efficiency" ? results.connectivity : results.facility;
  const displayScore = type === "capacity" ? results.displayScores.capacity : type === "efficiency" ? results.displayScores.connectivity : results.facility.displayScore;
  const rawValue = type === "capacity" ? `C=${researchValue(results.capacity.C)}` : type === "efficiency" ? `TLEI=${researchTleiValue(results.connectivity)}` : `FLI=${researchValue(results.facility.FLI)}`;
  const messages = [...moduleResult.errors, ...moduleResult.warnings];
  return `
    <div class="border border-slate-200 bg-white rounded-xl p-4 flex-shrink-0 animate-in">
      <div class="grid grid-cols-3 gap-3 text-xs">
        <div><div class="text-[10px] text-slate-400">公式版本</div><div class="mt-1 font-mono font-bold text-cyan-800">${moduleResult.formulaVersion}</div></div>
        <div><div class="text-[10px] text-slate-400">研究原始指标</div><div class="mt-1 font-mono font-bold text-slate-800">${rawValue}</div></div>
        <div><div class="text-[10px] text-slate-400">归一化展示评分</div><div class="mt-1 font-mono font-bold text-slate-800">${researchValue(displayScore, 2)}${Number.isFinite(displayScore) ? "/100" : ""}</div></div>
      </div>
      ${messages.length ? `<div class="mt-3 border-t border-amber-100 pt-3 text-[11px] leading-relaxed text-amber-700">${messages.map((message) => `<div>WARNING：${message}</div>`).join("")}</div>` : ""}
    </div>`;
}

function renderPanel() {
  const container = $("panel-content");
  const title = $("panel-title");
  if (!state.isPanelOpen) return;
  if (state.isPresentationMode) {
    renderPresentationPanel();
    return;
  }

  if (state.activeItemId === "import") {
    title.innerText = "导入模型";
    container.innerHTML = `
      <div onclick="performModelImport()" class="flex-1 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors group cursor-pointer animate-in">
        <div class="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <svg class="w-5 h-5 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" stroke-width="2"/></svg>
        </div>
        <p class="text-sm font-medium text-slate-600">点击或拖拽上传模型文件</p>
        <p class="text-xs text-slate-400 mt-2">Demo 暂不接入 CAD / Rhino / GIS，使用 JSON 参数评估</p>
      </div>`;
    return;
  }

  if (state.activeItemId === "comparison") {
    renderComparisonPanel();
    return;
  }

  if (state.activeItemId === "aiQa") {
    renderAiQaPanel();
    return;
  }

  const isParams = state.activeItemId === "params";
  const moduleName = isParams ? "params" : state.activeItemId;
  const activeItem = [...sidebarConfig.optimization.items, ...sidebarConfig.assessment.items].find((item) => item.id === state.activeItemId);
  title.innerText = isParams ? `${activeItem.name} - ${state.selectedScheme}` : `${activeItem.name}结果`;
  const rows = isParams ? buildEditableParamRows() : derivedRows(moduleName);
  const buttonText = isParams ? "保存参数设置" : "导出模块数据";
  const buttonAction = isParams ? "onclick=\"saveParamsSettings()\"" : "";

  container.innerHTML = `
    <div class="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex-shrink-0 animate-in">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-700">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke-width="2"/></svg>
        </div>
        <div>
          <h3 class="text-sm font-bold text-slate-700">${state.selectedScheme}</h3>
          <p class="text-[10px] text-slate-400 mt-0.5">TARGET: ${moduleName.toUpperCase()}</p>
        </div>
      </div>
      ${isParams ? `<button ${buttonAction} class="px-4 py-2 bg-cyan-800 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm">${buttonText}</button>` : panelActionButtons(moduleName)}
    </div>
    ${validationBlock(isParams ? state.validationMessages : validateInputs(currentScheme().inputs))}
    ${isParams ? "" : researchStatusBlock(moduleName)}
    <div class="detail-table-block bg-slate-50 rounded-xl border border-slate-100 flex-1 flex flex-col min-h-0 animate-in" style="animation-delay: 50ms;">
      <div class="table-container p-2 flex-1">
        <table class="data-table">
          <thead><tr><th width="35%">指标分类</th><th width="35%">指标项</th><th width="30%">${isParams ? "参数输入" : "测算数值"}</th></tr></thead>
          <tbody>${renderRows(rows, isParams)}</tbody>
        </table>
      </div>
    </div>
    ${isParams ? "" : calculationProcessBlock(moduleName)}
    ${isParams ? "" : indicatorExplanationBlock()}
    ${isParams ? "" : adviceBlock(moduleName)}`;
}

function buildEditableParamRows() {
  const base = editableFields.map(([, category, label, unit]) => ({ category, label, value: "", unit }));
  return base;
}

function comparisonData() {
  const rows = Object.values(database).map((scheme) => ({ scheme, results: calculateCurrent(scheme) }));
  const evaluable = rows.filter((item) => Number.isFinite(item.results.compositeScore));
  const best = evaluable.length ? evaluable.reduce((winner, item) => item.results.compositeScore > winner.results.compositeScore ? item : winner, evaluable[0]) : null;
  return { rows, best };
}

function metricCard(label, value, note = "") {
  return `
    <div class="bg-white border border-slate-100 rounded-lg p-3">
      <div class="text-[10px] font-bold tracking-wide text-slate-400">${label}</div>
      <div class="mt-1 text-xl font-bold text-slate-800">${value ?? "—"}</div>
      ${note ? `<div class="mt-1 text-[11px] text-slate-400">${note}</div>` : ""}
    </div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function retrieveKnowledge(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return Object.entries(knowledgeBase)
    .map(([code, item]) => {
      const aliasScore = item.aliases.reduce((score, alias) => {
        return normalized.includes(alias.toLowerCase()) ? score + 3 : score;
      }, 0);
      const text = `${item.name} ${item.definition} ${item.inputs} ${item.scenario} ${item.optimization}`.toLowerCase();
      const tokenScore = normalized.split(/\s+|，|。|、|\?|？/).filter(Boolean).reduce((score, token) => {
        return text.includes(token) ? score + 1 : score;
      }, 0);
      return { code, item, score: aliasScore + tokenScore };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

function buildKnowledgeAnswer(query) {
  const matches = retrieveKnowledge(query);
  if (!matches.length) {
    return {
      text: "我暂时没有在本地知识库中匹配到明确指标。可以尝试输入：C 是什么、TLEI 怎么优化、HCI 输入参数、FLI 适用场景等问题。",
      references: ["来源：指标说明"]
    };
  }

  const sections = matches.map(({ code, item }) => {
    const wantsInput = /输入|参数|数据|字段/.test(query);
    const wantsScenario = /场景|适用|什么时候|用途/.test(query);
    const wantsOptimize = /优化|提升|偏低|建议|改善/.test(query);
    const detail = [
      `【${code}】${item.name}`,
      item.definition,
      wantsInput || (!wantsScenario && !wantsOptimize) ? `输入参数：${item.inputs}` : "",
      wantsScenario ? `适用场景：${item.scenario}` : "",
      wantsOptimize || /建议|含义/.test(query) ? `优化含义：${item.optimization}` : ""
    ].filter(Boolean).join("\n");
    return detail;
  });

  return {
    text: sections.join("\n\n"),
    references: [...new Set(matches.map(({ item }) => item.reference))]
  };
}

function renderQaMessages() {
  return state.qaMessages.map((message) => `
    <div class="flex ${message.role === "user" ? "justify-end" : "justify-start"}">
      <div class="max-w-[92%] rounded-xl border ${message.role === "user" ? "bg-cyan-800 text-white border-cyan-800" : "bg-white text-slate-700 border-slate-100"} px-4 py-3 text-xs leading-relaxed shadow-sm">
        <div class="whitespace-pre-line">${escapeHtml(message.text)}</div>
        ${message.references?.length ? `
          <div class="mt-3 pt-2 border-t ${message.role === "user" ? "border-cyan-700 text-cyan-50" : "border-slate-100 text-slate-400"}">
            ${message.references.map((reference) => `<div>${escapeHtml(reference)}</div>`).join("")}
          </div>` : ""}
      </div>
    </div>`).join("");
}

function renderAiQaPanel() {
  $("panel-title").innerText = "AI 知识库问答助手";
  $("panel-content").innerHTML = `
    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex-shrink-0 animate-in">
      <div class="text-[10px] tracking-[0.18em] font-bold text-cyan-800 uppercase">Local RAG Prototype</div>
      <h3 class="text-sm font-bold text-slate-800 mt-2">AI 知识库问答助手</h3>
      <p class="mt-2 text-xs leading-relaxed text-slate-500">当前版本使用本地 knowledgeBase 进行关键词检索与引用展示，用于模拟后续接入真实大模型 API 后的指标问答体验。</p>
    </div>
    <div id="qa-message-list" class="bg-slate-50 rounded-xl border border-slate-100 flex-1 overflow-y-auto min-h-0 p-3 space-y-3 animate-in">
      ${renderQaMessages()}
    </div>
    <div class="bg-white border border-slate-100 rounded-xl p-3 flex-shrink-0">
      <div class="grid grid-cols-2 gap-2 mb-3">
        ${["C 指数代表什么？", "TLEI 偏低怎么优化？", "HCI 需要哪些输入？", "FLI 适合什么场景？"].map((question) => `
          <button onclick="askKnowledgeBaseQuestion('${question}')" class="text-left text-[11px] text-slate-500 hover:text-cyan-800 bg-slate-50 hover:bg-cyan-50 border border-slate-100 rounded-lg px-3 py-2 transition-colors">${question}</button>
        `).join("")}
      </div>
      <form onsubmit="submitKnowledgeBaseQuestion(event)" class="flex items-end gap-2">
        <textarea id="qa-input" rows="2" class="input-field resize-none flex-1 text-xs leading-relaxed" placeholder="输入关于 C、D、HCI、VCI、TLEI、FLI 的问题"></textarea>
        <button class="px-4 py-2 bg-cyan-800 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm" type="submit">提问</button>
      </form>
    </div>`;
  const list = $("qa-message-list");
  if (list) list.scrollTop = list.scrollHeight;
}

function currentModuleForProcess() {
  if (state.activeItemId === "efficiency") return "efficiency";
  if (state.activeItemId === "quality") return "quality";
  return "capacity";
}

function indicatorExplanationBlock() {
  return `
    <details class="bg-white border border-slate-100 rounded-xl p-4 flex-shrink-0">
      <summary class="cursor-pointer text-xs font-bold text-slate-700 tracking-wide">指标解释</summary>
      <div class="mt-3 space-y-3">
        ${indicatorExplanations.map(([code, name, text]) => `
          <div class="grid grid-cols-[48px_1fr] gap-3 text-xs leading-relaxed">
            <div class="font-bold text-cyan-800">${code}</div>
            <div><span class="font-medium text-slate-700">${name}</span><br><span class="text-slate-500">${text}</span></div>
          </div>`).join("")}
      </div>
    </details>`;
}

function originalMetricComparisons(type, results, scheme = currentScheme()) {
  const specs = {
    capacity: [
      ["D", "基面分布效能指数D", results.capacity.D],
      ["C", "基面容量指数C", results.capacity.C]
    ],
    efficiency: [
      ["HCI", "水平连接指数HCI", results.connectivity.HCI],
      ["VCI", "垂直连接指数VCI", results.connectivity.VCI],
      ["TLEI", "立体链接效能指数TLEI", results.connectivity.TLEI_research]
    ],
    quality: [
      ["FLI", "设施布局指数（FLI）", results.facility.FLI],
      ["FE", "设施功能效能指数（FE）", results.facility.FE],
      ["LA", "设施布局复合指数（LA）", results.facility.LA]
    ]
  }[type] || [];
  const moduleName = type === "efficiency" ? "efficiency" : type;
  return specs.map(([code, label, currentValue]) => {
    const source = (scheme.raw[moduleName] || []).find((row) => row.label === label);
    const originalValue = source ? number(source.value) : null;
    const relativeDeviation = originalValue === null || !Number.isFinite(currentValue)
      ? null
      : (Math.abs(originalValue) > 0 ? Math.abs(currentValue - originalValue) / Math.abs(originalValue) : Math.abs(currentValue - originalValue));
    return { code, originalValue, currentValue, relativeDeviation, warning: relativeDeviation !== null && relativeDeviation > 0.2 };
  });
}

function comparisonAuditBlock(type, results) {
  const comparisons = originalMetricComparisons(type, results);
  return `
    <div class="mt-4 pt-4 border-t border-slate-200">
      <div class="flex items-center justify-between mb-2">
        <div class="text-xs font-bold text-slate-700">原始 JSON 展示值 / 当前计算值</div>
        <div class="text-[10px] text-slate-400">偏差阈值 20%</div>
      </div>
      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table class="w-full text-[11px]">
          <thead class="bg-slate-100 text-slate-500"><tr><th class="px-3 py-2 text-left">指标</th><th class="px-3 py-2 text-right">原始值</th><th class="px-3 py-2 text-right">当前值</th><th class="px-3 py-2 text-right">相对偏差</th></tr></thead>
          <tbody>${comparisons.map((item) => `
            <tr class="border-t border-slate-100 ${item.warning ? "bg-amber-50 text-amber-800" : "text-slate-600"}">
              <td class="px-3 py-2 font-bold">${item.code}${item.warning ? " · WARNING" : ""}</td>
              <td class="px-3 py-2 text-right font-mono">${item.originalValue ?? "--"}</td>
              <td class="px-3 py-2 text-right font-mono">${researchValue(item.currentValue)}</td>
              <td class="px-3 py-2 text-right font-mono">${item.relativeDeviation === null ? "--" : `${(item.relativeDeviation * 100).toFixed(1)}%`}</td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
      ${comparisons.some((item) => item.warning) ? `<p class="mt-2 text-[11px] leading-relaxed text-amber-700">WARNING：存在超过 20% 的偏差。请核对公式版本、单位、参考面积与归一化基准后再接受新结果。</p>` : ""}
    </div>`;
}

function calculationProcessBlock(type = currentModuleForProcess()) {
  if (!state.showCalculationProcess) return "";
  const results = calculateCurrent();
  const explanation = {
    capacity: results.capacity.explanation,
    efficiency: results.connectivity.explanation,
    quality: results.facility.explanation
  }[type];
  const formulaVersion = {
    capacity: results.capacity.formulaVersion,
    efficiency: results.connectivity.formulaVersion,
    quality: results.facility.formulaVersion
  }[type];
  const calculationErrors = {
    capacity: results.capacity.errors,
    efficiency: results.connectivity.errors,
    quality: results.facility.errors
  }[type];
  const calculationWarnings = {
    capacity: results.capacity.warnings,
    efficiency: results.connectivity.warnings,
    quality: results.facility.warnings
  }[type];
  const rows = [
    ["输入参数", explanation.inputs],
    ["公式逻辑", explanation.formula],
    ["中间计算值", explanation.intermediate],
    ["最终结果", explanation.result],
    ["中文解释", explanation.interpretation]
  ];

  return `
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 flex-shrink-0">
      <div class="flex items-center justify-between mb-3"><h3 class="text-xs font-bold text-slate-700 tracking-wide">计算过程</h3><span class="text-[10px] font-mono text-cyan-800">${formulaVersion}</span></div>
      <p class="text-[11px] leading-relaxed text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">${explanation.note}</p>
      ${calculationErrors.length ? `<div class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-700">${calculationErrors.join("；")}</div>` : ""}
      ${calculationWarnings.length ? `<div class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">${calculationWarnings.join("；")}</div>` : ""}
      <div class="space-y-3">
        ${rows.map(([label, text]) => `
          <div class="text-xs leading-relaxed">
            <div class="font-bold text-cyan-800 mb-1">${label}</div>
            <div class="text-slate-600">${text}</div>
          </div>`).join("")}
      </div>
      ${comparisonAuditBlock(type, results)}
    </div>`;
}

function panelActionButtons(type) {
  return `
    <div class="flex items-center gap-2">
      ${type === "efficiency" ? `<label class="flex items-center gap-2 text-[11px] text-slate-500">TLEI 口径
        <select onchange="handleTleModeChange(event)" class="bg-white border border-slate-200 rounded px-2 py-2 text-[11px] text-slate-700 focus:outline-none">
          <option value="ppt-research" ${state.tleMode === "ppt-research" ? "selected" : ""}>PPT研究公式</option>
          <option value="legacy-platform" ${state.tleMode === "legacy-platform" ? "selected" : ""}>旧平台兼容公式</option>
        </select></label>` : ""}
      <button onclick="toggleCalculationProcess('${type}')" class="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium rounded-lg transition-colors">
        ${state.showCalculationProcess ? "收起计算过程" : "查看计算过程"}
      </button>
    </div>`;
}

function handleTleModeChange(event) {
  state.tleMode = event.target.value;
  renderPanel();
  renderProjectIntro();
}

function renderProjectIntro() {
  const results = calculateCurrent();
  const { best } = comparisonData();
  const metrics = $("project-intro-metrics");
  if (!metrics) return;
  metrics.innerHTML = `
    <div class="rounded-lg border border-slate-100 bg-slate-50 p-2">
      <div class="text-[10px] text-slate-400">当前综合分</div>
      <div class="text-sm font-bold text-slate-800">${researchValue(results.compositeScore, 1)}</div>
    </div>
    <div class="rounded-lg border border-slate-100 bg-slate-50 p-2">
      <div class="text-[10px] text-slate-400">当前评价</div>
      <div class="text-sm font-bold text-cyan-800">${results.grade}</div>
    </div>
    <div class="rounded-lg border border-cyan-100 bg-cyan-50 p-2">
      <div class="text-[10px] text-cyan-700">推荐方案</div>
      <div class="text-sm font-bold text-cyan-900">${best ? best.scheme.name : "暂不可评估"}</div>
    </div>`;
}

function renderRecommendationBadge() {
  const badge = $("recommended-scheme-badge");
  if (!badge || !Object.keys(database).length) return;
  const { best } = comparisonData();
  badge.textContent = "结果已生成";
  badge.title = "Wf=1.20，基于典型7m连廊宽度估算。";
  badge.classList.remove("hidden");
}

function renderPresentationPanel() {
  const scheme = currentScheme();
  const results = calculateCurrent();
  const { rows, best } = comparisonData();
  $("panel-title").innerText = "面试展示模式";
  $("panel-content").innerHTML = `
    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex-shrink-0">
      <div class="text-[10px] tracking-[0.18em] font-bold text-cyan-800 uppercase">Project Story</div>
      <h3 class="text-sm font-bold text-slate-800 mt-2">${scheme.name} · ${projectMeta.projectSubtitle || "高强度片区"}</h3>
      <p class="mt-2 text-xs leading-relaxed text-slate-500">以城市设计方案参数为输入，快速判断基面容量、立体连接和设施布局的结构性短板，用于方案比选、汇报沟通和优化迭代。</p>
    </div>
    <div class="grid grid-cols-2 gap-3 flex-shrink-0">
      ${metricCard("C 容量", results.capacity.C, `D=${results.capacity.D}`)}
      ${metricCard("TLEI 连接", researchTleiValue(results.connectivity), `HCI=${results.connectivity.HCI} / VCI=${results.connectivity.VCI}`)}
      ${metricCard("FLI 设施", results.facility.FLI, `FE=${results.facility.FE} / LA=${results.facility.LA}`)}
      ${metricCard("综合评价", results.grade, `综合分 ${results.compositeScore}`)}
    </div>
    <div class="bg-slate-50 rounded-xl border border-slate-100 p-4 flex-shrink-0">
      <h3 class="text-xs font-bold text-slate-700 mb-3">核心输入参数</h3>
      <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600">
        <div>建设用地：<span class="font-mono text-slate-800">${fmt(scheme.inputs.constructionLandArea)}㎡</span></div>
        <div>容积率：<span class="font-mono text-slate-800">${fmt(scheme.inputs.floorAreaRatio, 2)}</span></div>
        <div>地下基面：<span class="font-mono text-slate-800">${fmt(scheme.inputs.undergroundArea)}㎡</span></div>
        <div>地表基面：<span class="font-mono text-slate-800">${fmt(scheme.inputs.surfaceArea)}㎡</span></div>
        <div>地上基面：<span class="font-mono text-slate-800">${fmt(scheme.inputs.elevatedArea)}㎡</span></div>
        <div>连接节点：<span class="font-mono text-slate-800">${fmt(scheme.inputs.connectionNodes, 0)}个</span></div>
      </div>
    </div>
    <div class="bg-slate-50 rounded-xl border border-slate-100 p-4 flex-1 overflow-y-auto min-h-0">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold text-slate-700">方案对比</h3>
        <span class="text-[11px] font-bold text-cyan-800 bg-cyan-50 border border-cyan-100 rounded-full px-2 py-1">${best ? `推荐 ${best.scheme.name}` : "暂不可评估"}</span>
      </div>
      <div class="space-y-2">
        ${rows.map(({ scheme: item, results: itemResults }) => `
          <div class="grid grid-cols-[1fr_auto] gap-3 rounded-lg border ${best && item.name === best.scheme.name ? "border-cyan-200 bg-cyan-50" : "border-slate-100 bg-white"} p-3 text-xs">
            <div class="font-medium text-slate-700">${item.name}</div>
            <div class="font-bold text-cyan-800">${researchValue(itemResults.compositeScore, 1)}</div>
            <div class="col-span-2 text-slate-500">C ${researchValue(itemResults.capacity.C)} / D ${researchValue(itemResults.capacity.D)} / TLEI ${researchTleiValue(itemResults.connectivity)} / FLI ${researchValue(itemResults.facility.FLI)}</div>
          </div>`).join("")}
      </div>
    </div>
    ${adviceBlock("presentation")}
    <p class="text-[10px] leading-relaxed text-slate-400">方法注释：Wf=1.20，基于典型7m连廊宽度的专业估算；后续可由 Rhino/CAD 实测面积加权结果替换。</p>`;
}

function renderComparisonPanel() {
  const title = $("panel-title");
  title.innerText = "方案对比";
  const { rows, best } = comparisonData();
  $("panel-content").innerHTML = `
    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex-shrink-0 animate-in">
      <h3 class="text-sm font-bold text-slate-700">${best ? `推荐方案：${best.scheme.name}` : "推荐方案暂不可评估"}</h3>
      <p class="text-xs text-slate-400 mt-1">${best ? `综合分 ${best.results.compositeScore}，评价 ${best.results.grade}。四方案采用统一典型连廊宽度假设，以控制连廊宽度变量，当前方案差异主要由覆盖范围、连接节点、层阶度和楼层连通率等指标产生。` : "当前核心指标不足，暂不生成综合推荐。"}</p>
    </div>
    <div class="bg-slate-50 rounded-xl border border-slate-100 flex-1 flex flex-col min-h-0 animate-in">
      <div class="table-container p-2 flex-1">
        <table class="data-table">
          <thead><tr><th>方案</th><th>D</th><th>C</th><th>HCI</th><th>VCI</th><th>TLEI</th><th>FLI</th><th>综合评分</th><th>综合判断</th></tr></thead>
          <tbody>
            ${rows.map(({ scheme, results }) => `
              <tr class="${best && scheme.name === best.scheme.name ? "bg-cyan-50" : "bg-white"}">
                <td class="font-medium text-slate-700">${scheme.name}${best && scheme.name === best.scheme.name ? " · 推荐方案" : ""}</td>
                <td>${researchValue(results.capacity.D)}</td><td>${researchValue(results.capacity.C)}</td><td>${researchValue(results.connectivity.HCI)}</td>
                <td>${researchValue(results.connectivity.VCI)}</td><td>${researchTleiValue(results.connectivity)}</td><td>${researchValue(results.facility.FLI)}</td>
                <td class="font-bold text-cyan-800">${researchValue(results.compositeScore, 1)}</td><td>${results.grade}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

function saveParamsSettings() {
  const scheme = currentScheme();
  const draftInputs = {
    ...scheme.inputs,
    facilities: Array.isArray(scheme.inputs.facilities) ? scheme.inputs.facilities.map((facility) => ({ ...facility })) : []
  };
  document.querySelectorAll(".input-field[data-key]").forEach((input) => {
    draftInputs[input.dataset.key] = isBlank(input.value) ? "" : number(input.value);
  });
  const messages = validateInputs(draftInputs);
  if (messages.length) {
    state.validationMessages = messages;
    renderPanel();
    return;
  }
  scheme.inputs = draftInputs;
  scheme.inputs.totalBaseArea = scheme.inputs.surfaceArea + scheme.inputs.undergroundArea + scheme.inputs.elevatedArea;
  scheme.computedResults = calculateScheme({ ...scheme.inputs, tleMode: state.tleMode }, projectMeta.idealWeights, formulaPreset, { tleMode: state.tleMode });
  state.validationMessages = [];
  renderPanel();
  renderMapImage();
  renderProjectIntro();
  renderRecommendationBadge();
}

function handleSidebarClick(id) {
  state.activeItemId = id;
  state.isPanelOpen = true;
  state.showCalculationProcess = false;
  state.validationMessages = validateInputs(currentScheme().inputs);
  if (id === "aiQa") {
    state.isPresentationMode = false;
    document.body.classList.remove("presentation-mode");
    const button = $("presentation-mode-button");
    if (button) button.textContent = "面试展示模式";
  }
  if (["capacity", "efficiency", "quality"].includes(id)) state.targetDataModule = id;
  renderSidebar();
  renderPanel();
  renderMapImage();
  $("right-panel").classList.remove("translate-x-full");
  if (id === "import") showImportedModelImage("import", "MODEL READY");
  if (id !== "import") showSchemeImage();
}

function showSchemeImage() {
  showImportedModelImage(state.selectedScheme, `${state.selectedScheme} LOADED`);
}

function performModelImport() {
  showImportedModelImage("import", "MODEL IMPORTED");
  openModelImageModal();
  renderMapImage();
}

function openSchemeDataPanel() {
  state.activeItemId = ["params", "capacity", "efficiency", "quality"].includes(state.activeItemId)
    ? state.activeItemId
    : state.targetDataModule;
  state.isPanelOpen = true;
  renderSidebar();
  renderPanel();
  renderMapImage();
  $("right-panel").classList.remove("translate-x-full");
  showSchemeImage();
}

function currentModuleName() {
  return moduleNames[state.activeItemId] || moduleNames[state.targetDataModule] || "模型视图";
}

function setFallbackContent(prefix, imagePath) {
  $(`${prefix}-fallback-scheme`).textContent = state.selectedScheme;
  $(`${prefix}-fallback-module`).textContent = currentModuleName();
  $(`${prefix}-fallback-path`).textContent = `图片路径缺失：${imagePath}`;
}

function loadModelImage(image, fallback, imagePath, context) {
  if (!image || !fallback) return;
  image.classList.remove("is-visible");
  image.style.display = "none";
  fallback.classList.remove("is-visible");
  image.onload = () => {
    fallback.classList.remove("is-visible");
    image.style.display = "block";
    if (image.id === "map-imported-image") image.classList.add("is-visible");
  };
  image.onerror = () => {
    image.classList.remove("is-visible");
    image.style.display = "none";
    fallback.classList.add("is-visible");
    setFallbackContent(context, imagePath);
    console.warn(`[模型图片] 加载失败：${imagePath}；方案：${state.selectedScheme}；模块：${currentModuleName()}`);
  };
  image.src = imagePath;
}

function syncModelPreview() {
  const imagePath = state.currentModelImagePath;
  $("model-preview-path").textContent = imagePath;
  $("model-preview-title").textContent = `${state.selectedScheme}模型预览`;
  loadModelImage($("model-preview-image"), $("modal-model-fallback"), imagePath, "modal");
}

function showImportedModelImage(imageKey, statusText) {
  const imagePath = MODEL_IMAGES[imageKey] || MODEL_IMAGES.import;
  state.isModelImported = true;
  state.importedImageStatus = statusText;
  state.currentModelImageKey = imageKey;
  state.currentModelImagePath = imagePath;
  loadModelImage($("map-imported-image"), $("map-model-fallback"), imagePath, "map");
  $("map-upload-placeholder").classList.add("is-hidden");
  $("map-status").innerText = statusText;
  if ($("model-preview-modal").classList.contains("is-open")) syncModelPreview();
}

function openModelImageModal() {
  syncModelPreview();
  $("model-preview-modal").classList.add("is-open");
  $("model-preview-modal").setAttribute("aria-hidden", "false");
}

function closeModelImageModal(event) {
  if (event && event.target.id !== "model-preview-modal") return;
  $("model-preview-modal").classList.remove("is-open");
  $("model-preview-modal").setAttribute("aria-hidden", "true");
}

function handleSchemeChange(event) {
  state.selectedScheme = event.target.value;
  state.showCalculationProcess = false;
  state.validationMessages = validateInputs(currentScheme().inputs);
  renderPanel();
  renderMapImage();
  renderProjectIntro();
  renderRecommendationBadge();
  showSchemeImage();
}

function closePanel() {
  state.isPanelOpen = false;
  state.activeItemId = null;
  renderSidebar();
  $("right-panel").classList.add("translate-x-full");
}

function renderMapImage() {
  const moduleLabel = $("map-module-label");
  const status = $("map-status");
  const statusButton = $("map-status-button");
  const currentModule = ["capacity", "efficiency", "quality", "comparison"].includes(state.activeItemId)
    ? state.activeItemId
    : (state.activeItemId === "params" ? state.targetDataModule : (state.activeItemId === "aiQa" ? "knowledge" : "default"));
  moduleLabel.innerText = `${state.selectedScheme} | ${String(currentModule).toUpperCase()}`;
  status.innerText = state.isModelImported ? state.importedImageStatus : "AWAITING UPLOAD...";
  statusButton.classList.toggle("hidden", state.activeItemId === "import" && !state.isModelImported);
}

function toggleCalculationProcess(type) {
  state.showCalculationProcess = !state.showCalculationProcess;
  if (type && ["capacity", "efficiency", "quality"].includes(type)) {
    state.activeItemId = type;
  }
  renderPanel();
}

function togglePresentationMode() {
  state.isPresentationMode = !state.isPresentationMode;
  state.isPanelOpen = true;
  $("presentation-mode-button").textContent = state.isPresentationMode ? "退出展示模式" : "面试展示模式";
  document.body.classList.toggle("presentation-mode", state.isPresentationMode);
  renderSidebar();
  renderPanel();
  renderMapImage();
  $("right-panel").classList.remove("translate-x-full");
}

function askKnowledgeBaseQuestion(question) {
  const trimmed = String(question || "").trim();
  if (!trimmed) return;
  state.qaMessages.push({ role: "user", text: trimmed });
  const answer = buildKnowledgeAnswer(trimmed);
  state.qaMessages.push({ role: "assistant", text: answer.text, references: answer.references });
  state.activeItemId = "aiQa";
  renderSidebar();
  renderAiQaPanel();
  $("right-panel").classList.remove("translate-x-full");
}

function submitKnowledgeBaseQuestion(event) {
  event.preventDefault();
  const input = $("qa-input");
  askKnowledgeBaseQuestion(input.value);
  input.value = "";
}

function buildReportHtml() {
  const scheme = currentScheme();
  const results = calculateCurrent();
  const { rows, best } = comparisonData();
  const coreInputFields = [
    ...editableFields,
    ...facilityFields.map(([key, category, label, unit]) => [`facilities.${key}`, category, label, unit])
  ];
  const inputRows = coreInputFields.map(([key, category, label, unit]) => {
    const value = key.startsWith("facilities.")
      ? pct(scheme.inputs.facilities[key.split(".")[1]])
      : fmt(scheme.inputs[key], key.includes("Ratio") || key.includes("Coefficient") || key.includes("Index") || key.includes("Factor") ? 2 : 0);
    return `<tr><td>${escapeHtml(category)}</td><td>${escapeHtml(label)}</td><td>${value} ${escapeHtml(unit)}</td></tr>`;
  }).join("");
  const comparisonRows = rows.map(({ scheme: item, results: result }) => `<tr class="${best && item.name === best.scheme.name ? "recommended" : ""}"><td>${escapeHtml(item.name)}${best && item.name === best.scheme.name ? "（推荐方案）" : ""}</td><td>${researchValue(result.capacity.D)}</td><td>${researchValue(result.capacity.C)}</td><td>${researchValue(result.connectivity.HCI)}</td><td>${researchValue(result.connectivity.VCI)}</td><td>${researchTleiValue(result.connectivity)}</td><td>${researchValue(result.facility.FLI)}</td><td>${researchValue(result.compositeScore, 1)}</td><td>${result.grade}</td></tr>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(projectMeta.projectName)}-${escapeHtml(scheme.name)}评估报告</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:40px;color:#1f2937;line-height:1.7;background:#f8fafc}.page{max-width:1120px;margin:auto;background:#fff;padding:36px;border:1px solid #e5e7eb}h1{font-size:26px;margin:0 0 8px}h2{margin-top:28px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;color:#0f172a}.meta{color:#64748b}.badge{display:inline-block;background:#ecfeff;color:#155e75;border:1px solid #cffafe;border-radius:999px;padding:4px 10px;font-weight:700;font-size:12px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}.card{border:1px solid #e5e7eb;background:#f8fafc;padding:14px}.card b{display:block;font-size:22px;color:#0f172a}table{border-collapse:collapse;width:100%;margin-top:10px;font-size:13px}td,th{border:1px solid #e5e7eb;padding:8px;text-align:left}th{background:#f1f5f9}.recommended{background:#ecfeff}ol{padding-left:22px}.note{background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:10px 12px;font-size:13px}</style></head><body><main class="page">
    <span class="badge">推荐方案：${escapeHtml(best ? best.scheme.name : "暂不可评估")}</span>
    <h1>${escapeHtml(projectMeta.projectName)}</h1><p class="meta">项目：${escapeHtml(projectMeta.projectSubtitle || "")} ｜ 当前方案：${escapeHtml(scheme.name)} ｜ 综合评分：${researchValue(results.compositeScore, 1)} ｜ 综合判断：${results.grade}</p>
    <p class="note">公式版本：${results.formulaVersion}。研究原始指标与归一化展示评分分开呈现；当前 TLEI 口径为 ${results.connectivity.tleMode}，连接数据模式为 ${escapeHtml(corridorModeLabel(results.connectivity.inputMode))}。Wf=1.20，基于典型7m连廊宽度专业估算；后续可由 Rhino/CAD 实测面积加权结果替换。</p>
    <div class="cards"><div class="card">D 研究值<b>${researchValue(results.capacity.D)}</b></div><div class="card">C 研究值<b>${researchValue(results.capacity.C)}</b></div><div class="card">TLEI 研究值<b>${researchTleiValue(results.connectivity)}</b></div><div class="card">FLI 研究值<b>${researchValue(results.facility.FLI)}</b></div></div>
    <h2>核心输入参数</h2><table><thead><tr><th>分类</th><th>参数</th><th>数值</th></tr></thead><tbody>${inputRows}</tbody></table>
    <h2>容量评估结果</h2><p>C=${researchValue(results.capacity.C)}，D=${researchValue(results.capacity.D)}，有效面积 ${fmt(results.capacity.effectiveAreaM2)}㎡ / ${fmt(results.capacity.effectiveArea10k, 6)}万㎡；地下/地表/地上占比分别为 ${pct(results.capacity.actualRatios.underground)}%、${pct(results.capacity.actualRatios.surface)}%、${pct(results.capacity.actualRatios.elevated)}%。</p>
    <h2>连接效率评估结果</h2><p>数据模式=${escapeHtml(corridorModeLabel(results.connectivity.inputMode))}；代表性宽度=${researchValue(results.connectivity.representativeWidth, 1)}m；Wf=${researchValue(results.connectivity.Wf)}；HCI=${researchValue(results.connectivity.HCI)}，VCI=${researchValue(results.connectivity.VCI)}，正式研究TLEI=${researchTleiValue(results.connectivity)}，Legacy=${researchValue(results.connectivity.TLEI_legacy)}；MCI=${researchValue(results.connectivity.MCI)} 个/万㎡，MSCR=${researchValue(results.connectivity.MSCR)} 层单位/连续系统。</p>
    <h2>设施布局评估结果</h2><p>FLI=${researchValue(results.facility.FLI)}，FE=${researchValue(results.facility.FE)}，LA=${researchValue(results.facility.LA)}，displayScore=${researchValue(results.facility.displayScore, 2)}。</p>
    <h2>方案对比</h2><table><thead><tr><th>方案</th><th>D</th><th>C</th><th>HCI</th><th>VCI</th><th>TLEI</th><th>FLI</th><th>综合评分</th><th>综合判断</th></tr></thead><tbody>${comparisonRows}</tbody></table>
    <h2>优化建议</h2><ol>${results.advice.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
  </main>
  </body></html>`;
}

function exportReport() {
  const blob = new Blob([buildReportHtml()], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const fileName = `${state.selectedScheme}-基面系统评估报告.html`;
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function bindEvents() {
  $("scheme-selector").addEventListener("change", handleSchemeChange);
  $("export-report-button").addEventListener("click", exportReport);
  $("presentation-mode-button").addEventListener("click", togglePresentationMode);
}

async function init() {
  const [response, presetResponse] = await Promise.all([
    fetch("./data/schemes.json"),
    fetch("./config/formula-presets.json")
  ]);
  const [data, presetData] = await Promise.all([response.json(), presetResponse.json()]);
  projectMeta = data;
  formulaPreset = presetData.presets[presetData.defaultPresetId];
  state.tleMode = formulaPreset.connectivity.tleMode || "ppt-research";
  database = data.schemes;
  state.selectedScheme = Object.keys(database)[0];
  state.validationMessages = validateInputs(database[state.selectedScheme].inputs, projectMeta.idealWeights);
  $("scheme-selector").innerHTML = Object.keys(database).map((name) => `<option value="${name}">${name}</option>`).join("");
  $("scheme-selector").value = state.selectedScheme;
  bindEvents();
  renderSidebar();
  renderPanel();
  renderMapImage();
  renderProjectIntro();
  renderRecommendationBadge();
  setTimeout(() => $("right-panel").classList.remove("translate-x-full"), 100);
}

Object.assign(window, {
  MODEL_IMAGES,
  handleSidebarClick,
  saveParamsSettings,
  performModelImport,
  openSchemeDataPanel,
  openModelImageModal,
  closeModelImageModal,
  handleSchemeChange,
  closePanel,
  toggleCalculationProcess,
  handleTleModeChange,
  togglePresentationMode,
  askKnowledgeBaseQuestion,
  submitKnowledgeBaseQuestion
});

init().catch((error) => {
  console.error(error);
  $("panel-title").innerText = "数据加载失败";
  $("panel-content").innerHTML = `<div class="text-sm text-red-600 leading-relaxed">无法读取 data/schemes.json。请在项目目录运行 <code class="font-mono">python3 -m http.server 8000</code>，再访问 <code class="font-mono">http://localhost:8000</code>。</div>`;
  $("right-panel").classList.remove("translate-x-full");
});
