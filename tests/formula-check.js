import { readFileSync } from "node:fs";
import {
  FORMULA_VERSION,
  calculateCapacityScore,
  calculateConnectedFloorUnits,
  calculateConnectivityScore,
  calculateCorridorWidthEfficiency,
  calculateDistributionEfficiency,
  calculateFacilityLayoutScore,
  calculateScheme
} from "../js/calculations.js";

const data = JSON.parse(readFileSync(new URL("../data/schemes.json", import.meta.url), "utf8"));
const presetFile = JSON.parse(readFileSync(new URL("../config/formula-presets.json", import.meta.url), "utf8"));
const preset = presetFile.presets[presetFile.defaultPresetId];
let failures = 0;

function check(condition, message, detail = "") {
  const passed = Boolean(condition);
  console.log(`${passed ? "PASS" : "FAIL"}  ${message}${detail ? ` | ${detail}` : ""}`);
  if (!passed) failures += 1;
}

function near(actual, expected, tolerance = 0.001) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
}

function researchFacilities(verticalMix, overallMix = preset.facility.idealOverallMix) {
  const domainByActivity = { A1: "dining", A2: "cultureEntertainment", A3: "health", A4: "park" };
  return Object.entries(overallMix).flatMap(([activityType, overallShare]) => {
    return Object.entries(verticalMix[activityType]).map(([baseLevel, verticalShare]) => ({
      baseLevel,
      functionalDomain: domainByActivity[activityType],
      activityType,
      operationType: "T1",
      effectiveAreaM2: overallShare * verticalShare * 100000
    }));
  });
}

function verifiedCorridor(id, length, width, overrides = {}) {
  return {
    id,
    name: `测试连廊${id}`,
    level: "ground",
    elevation: 0,
    length,
    width,
    dataSource: "自动测试样例",
    verified: true,
    ...overrides
  };
}

console.log(`公式版本：${FORMULA_VERSION}\n`);

// 一、容量公式回归测试
const schemeOne = data.schemes["方案一"].inputs;
const capacity = calculateCapacityScore(schemeOne, data.idealWeights, preset);
check(near(capacity.D, 0.82327), "方案一 D 回归", `actual=${capacity.D}`);
check(near(capacity.effectiveAreaM2, 170387.88) && Math.round(capacity.effectiveAreaM2) === 170388, "方案一有效面积（㎡）回归", `exact=${capacity.effectiveAreaM2}, display≈${Math.round(capacity.effectiveAreaM2)}`);
check(near(capacity.effectiveArea10k, 17.0388), "方案一有效面积（万㎡）回归", `actual=${capacity.effectiveArea10k}`);
check(near(capacity.C, 2.87449), "方案一 C 回归", `actual=${capacity.C}`);

// 二、连接公式回归测试：Wf 由 width>7m 的 corridor 实时计算为 1.4。
const connectionFixture = {
  projectionArea: 135547.1,
  influenceArea: 193121.75,
  connectionNodes: 3,
  totalBaseArea: 181264.1,
  connectedFloors: 20,
  systemCount: 3,
  corridors: [verifiedCorridor("C1", 100, 8)]
};
const connectivity = calculateConnectivityScore(connectionFixture, preset);
check(near(connectivity.MPR, 0.70187), "MPR 回归", `actual=${connectivity.MPR}`);
check(near(connectivity.MCI, 0.1655), "MCI 回归（个/万㎡）", `actual=${connectivity.MCI}`);
check(near(connectivity.HCI, 0.11616), "HCI 回归", `actual=${connectivity.HCI}`);
check(near(connectivity.MLI, 1.33728), "MLI 回归", `actual=${connectivity.MLI}`);
check(near(connectivity.MSCR, 6.66667), "MSCR 回归（层单位/系统）", `actual=${connectivity.MSCR}`);
check(near(connectivity.VCI, 8.91518), "VCI 回归", `actual=${connectivity.VCI}`);
check(near(connectivity.TLEI_ppt, 1.2041), "PPT research TLEI 回归", `actual=${connectivity.TLEI_ppt}`);
check(near(connectivity.TLEI_legacy, 1.42471), "Legacy platform TLEI 回归", `actual=${connectivity.TLEI_legacy}`);
check(connectivity.tleMode === "ppt-research" && connectivity.TLEI === connectivity.TLEI_ppt, "默认使用 ppt-research 口径");

// 四方案统一使用典型7m连廊估算；设施研究状态与综合展示结果分开。
for (const [name, scheme] of Object.entries(data.schemes)) {
  const result = calculateScheme(scheme.inputs, data.idealWeights, preset);
  check(Number.isFinite(result.capacity.D) && Number.isFinite(result.capacity.C), `${name}容量研究公式可计算`, `D=${result.capacity.D}, C=${result.capacity.C}`);
  check(Number.isFinite(result.connectivity.HCI) && Number.isFinite(result.connectivity.VCI), `${name}连接基础指标可计算`, `HCI=${result.connectivity.HCI}, VCI=${result.connectivity.VCI}`);
  check(result.connectivity.inputMode === "representative-width-estimate" && near(result.connectivity.Wf, 1.2) && Number.isFinite(result.connectivity.TLEI_research), `${name}使用典型7m专业估算且正式 TLEI 可计算`);
  check(result.facility.notEvaluable && !result.fullyEvaluable, `${name}设施研究缺失状态保持独立`);
  check(Number.isFinite(result.compositeScore) && result.coreEvaluable && result.grade !== "数据待补齐", `${name}可生成综合展示分和评价`, `score=${result.compositeScore}, grade=${result.grade}`);
}

// 三、敏感性测试
const closerAreas = calculateCapacityScore({ ...schemeOne, groundArea: 100000, undergroundArea: 60000, upperArea: 40000 }, data.idealWeights, preset);
check(closerAreas.D > capacity.D, "实际面积占比更接近理想权重时 D 上升", `${capacity.D}→${closerAreas.D}`);

const higherFar = calculateCapacityScore({ ...schemeOne, floorAreaRatio: schemeOne.floorAreaRatio + 2 }, data.idealWeights, preset);
check(higherFar.C < capacity.C, "容积率增加且面积不变时 C 下降", `${capacity.C}→${higherFar.C}`);

const moreNodes = calculateConnectivityScore({ ...connectionFixture, connectionNodes: 8 }, preset);
check(moreNodes.MCI > connectivity.MCI && moreNodes.HCI > connectivity.HCI && moreNodes.TLEI > connectivity.TLEI, "节点增加时 MCI、HCI、TLEI 上升");

const moreFloors = calculateConnectivityScore({ ...connectionFixture, connectedFloors: 30 }, preset);
check(moreFloors.MSCR > connectivity.MSCR && moreFloors.VCI > connectivity.VCI && moreFloors.TLEI > connectivity.TLEI, "连通楼层数增加时 MSCR、VCI、TLEI 上升");

const narrowCorridors = calculateConnectivityScore({
  ...connectionFixture,
  corridors: [verifiedCorridor("C1", 100, 8), verifiedCorridor("C2", 800, 1.5)]
}, preset);
check(narrowCorridors.Wf < connectivity.Wf && narrowCorridors.TLEI < connectivity.TLEI, "狭窄连廊占比增加时 Wf、TLEI 下降", `Wf ${connectivity.Wf}→${narrowCorridors.Wf}`);

// A2 连接数据模式与优先级测试
const threeCorridors = calculateCorridorWidthEfficiency({
  corridors: [
    verifiedCorridor("A2-1", 100, 1.5),
    verifiedCorridor("A2-2", 100, 4, { coefficient: 9 }),
    verifiedCorridor("A2-3", 100, 8)
  ],
  corridorAreaByWidthClass: [{ range: "<2.0m", area: 9999, coefficient: 0.5, dataSource: "不应命中的汇总样例", verified: true }],
  legacyWf: 1.4
}, preset);
check(near(threeCorridors.Wf, 1595 / 1350, 0.00001) && threeCorridors.totalCorridorArea === 1350 && threeCorridors.weightedEffectiveArea === 1595, "三条示例连廊正确计算 Wf、总面积和加权有效面积", `Wf=${threeCorridors.Wf}`);
check(threeCorridors.inputMode === "verified-detail" && threeCorridors.warnings.some((message) => message.includes("已采用自动系数")), "手工 coefficient 冲突时 warning 并采用宽度自动系数");

const mediumOnly = calculateCorridorWidthEfficiency({ corridors: [verifiedCorridor("M1", 100, 4)] }, preset);
const moreNarrowArea = calculateCorridorWidthEfficiency({ corridors: [verifiedCorridor("M1", 100, 4), verifiedCorridor("N1", 1000, 1.5)] }, preset);
const moreWideArea = calculateCorridorWidthEfficiency({ corridors: [verifiedCorridor("M1", 100, 4), verifiedCorridor("W1", 1000, 8)] }, preset);
check(moreNarrowArea.Wf < mediumOnly.Wf, "狭窄连廊面积占比增加时 Wf 下降", `${mediumOnly.Wf}→${moreNarrowArea.Wf}`);
check(moreWideArea.Wf > mediumOnly.Wf, "较宽连廊面积占比增加时 Wf 上升", `${mediumOnly.Wf}→${moreWideArea.Wf}`);

const detailPriority = calculateCorridorWidthEfficiency({
  corridors: [verifiedCorridor("P1", 100, 4)],
  corridorAreaByWidthClass: [{ range: "<2.0m", area: 1000, coefficient: 0.5, dataSource: "汇总样例", verified: true }],
  legacyWf: 1.4
}, preset);
check(detailPriority.inputMode === "verified-detail" && detailPriority.Wf === 1, "verified corridors[] 优先于汇总面积数据");

const summaryPriority = calculateCorridorWidthEfficiency({
  corridors: [],
  corridorAreaByWidthClass: [{ range: "2.0-3.5m", area: 1000, coefficient: 0.8, dataSource: "汇总样例", verified: true }],
  legacyWf: 1.4
}, preset);
check(summaryPriority.inputMode === "width-class-summary" && summaryPriority.Wf === 0.8, "汇总面积数据优先于 legacyWf");

const defaultEstimate = calculateConnectivityScore({ ...connectionFixture, corridors: [], corridorAreaByWidthClass: [], legacyWf: 1.4 }, preset);
check(defaultEstimate.inputMode === "representative-width-estimate" && defaultEstimate.Wf === 1.2, "无已核验连廊数据时默认 Wf=1.2 且使用 representative-width-estimate");
check(Number.isFinite(defaultEstimate.TLEI_research) && !defaultEstimate.notEvaluable, "典型宽度估算可正常计算 TLEI_research", `actual=${defaultEstimate.TLEI_research}`);

const unverifiedSummary = calculateCorridorWidthEfficiency({
  corridorAreaByWidthClass: [{ range: "2.0-3.5m", area: 1000, coefficient: 0.8, dataSource: "未核验汇总", verified: false }],
  legacyWf: 1.4
}, preset);
check(unverifiedSummary.inputMode === "representative-width-estimate" && unverifiedSummary.Wf === 1.2, "未核验宽度区间汇总不覆盖默认估算");

const falselyVerifiedEstimate = calculateCorridorWidthEfficiency({
  representativeWidthEstimate: { representativeWidth: 7, Wf: 1.2, dataSource: "异常测试", verified: true }
}, preset);
check(falselyVerifiedEstimate.Wf === null && falselyVerifiedEstimate.errors.some((message) => message.includes("不得标记为 verified=true")), "代表宽度估算不得标记为 verified");

const appSource = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
check(appSource.includes("Wf 当前采用典型7m连廊估算值1.20") && appSource.includes("结果已生成"), "页面明确显示典型7m专业估算和结果已生成状态");
check(!appSource.includes("notEvaluable") && !appSource.includes("数据待补齐"), "页面不再出现 notEvaluable 或数据待补齐文案");

const comparisonResults = Object.values(data.schemes).map((scheme) => calculateScheme(scheme.inputs, data.idealWeights, preset));
const recommended = comparisonResults.reduce((best, result) => result.compositeScore > best.compositeScore ? result : best, comparisonResults[0]);
check(comparisonResults.every((result) => Number.isFinite(result.compositeScore)) && Number.isFinite(recommended.compositeScore), "四方案能够正常生成综合评分和推荐方案");

const idealVertical = preset.facility.idealVerticalMix;
const groundOnlyVertical = Object.fromEntries(["A1", "A2", "A3", "A4"].map((activity) => [activity, { underground: 0, ground: 1, upper: 0 }]));
const idealFacility = calculateFacilityLayoutScore({ ...schemeOne, facilities: researchFacilities(idealVertical) }, preset);
const skewedFacility = calculateFacilityLayoutScore({ ...schemeOne, facilities: researchFacilities(groundOnlyVertical) }, preset);
check(idealFacility.LA > skewedFacility.LA, "设施配比更接近理想配比时 LA 上升", `${skewedFacility.LA}→${idealFacility.LA}`);

// 辅助函数：人工 Fi 优先，禁止与面积换算重复累计。
const floorUnits = calculateConnectedFloorUnits([
  { baseLevel: "ground", areaM2: 9000 },
  { baseLevel: "underground", areaM2: 3100 },
  { baseLevel: "upper", areaM2: 20000, connectedFloorUnits: 2 }
], preset);
check(floorUnits.totalUnits === 7, "楼层单位 ceil 换算与人工 Fi 优先规则", `actual=${floorUnits.totalUnits}`);

// 四、异常测试
const emptyInput = calculateCapacityScore({ ...schemeOne, groundArea: "" }, data.idealWeights, preset);
check(emptyInput.errors.some((message) => message.includes("不能为空")), "空值返回中文错误");

const negativeInput = calculateCapacityScore({ ...schemeOne, undergroundArea: -1 }, data.idealWeights, preset);
check(negativeInput.errors.some((message) => message.includes("不能为负数")), "负数返回中文错误");

const badWeights = calculateDistributionEfficiency(
  { underground: 0.3, ground: 0.5, upper: 0.2 },
  { underground: 0.3, ground: 0.5, upper: 0.3 }
);
check(badWeights.D === null && badWeights.errors.some((message) => message.includes("权重之和必须为 1")), "权重和异常时拒绝静默归一化");

const zeroFar = calculateCapacityScore({ ...schemeOne, floorAreaRatio: 0 }, data.idealWeights, preset);
check(zeroFar.C === null && zeroFar.errors.some((message) => message.includes("必须大于 0")), "R=0 时 C 不可计算");

const projectionWarning = calculateConnectivityScore({ ...connectionFixture, projectionArea: 200000, influenceArea: 100000, totalBaseArea: 250000 }, preset);
check(projectionWarning.warnings.some((message) => message.includes("投影面积")), "P>A 时返回 warning");

const surfaceWarning = calculateConnectivityScore({ ...connectionFixture, projectionArea: 200000, totalBaseArea: 150000 }, preset);
check(surfaceWarning.warnings.some((message) => message.includes("总面积")), "S<P 时返回 warning");

const zeroSystems = calculateConnectivityScore({ ...connectionFixture, systemCount: 0 }, preset);
check(zeroSystems.errors.some((message) => message.includes("N_sys") && message.includes("必须大于 0")), "N_sys=0 时返回中文错误");

const zeroCorridor = calculateCorridorWidthEfficiency([verifiedCorridor("Z1", 0, 3)], preset);
check(zeroCorridor.Wf === null && zeroCorridor.errors.some((message) => message.includes("总面积必须大于 0")), "连廊总面积=0 时 Wf 不可计算");

const missingActivityFacilities = researchFacilities(idealVertical).filter((facility) => facility.activityType !== "A3");
const missingActivity = calculateFacilityLayoutScore({ ...schemeOne, facilities: missingActivityFacilities }, preset);
check(missingActivity.notEvaluable && missingActivity.missingActivityTypes.includes("A3") && missingActivity.warnings.some((message) => message.includes("样本不足")), "某活动类型为 0 时返回 notEvaluable 和样本不足 warning");

if (failures > 0) {
  console.error(`\n公式校核失败：${failures} 项。`);
  process.exitCode = 1;
} else {
  console.log("\n全部 research-formula-v2 公式校核通过。\n");
}
