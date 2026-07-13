export const FORMULA_VERSION = "research-demo-v1";

const DEFAULT_WEIGHTS = { ground: 0.5, underground: 0.3, upper: 0.2 };
const DEFAULT_EFFECTIVE_FACTORS = { ground: 1, underground: 0.8, upper: 0.6 };
const FACILITY_TARGET = { functional: 0.3, experiential: 0.32, social: 0.16, spontaneous: 0.22 };
const FACILITY_LABELS = { functional: "功能性", experiential: "体验性", social: "社会性", spontaneous: "自发性" };
const LAYER_LABELS = { underground: "地下层", ground: "地表层", upper: "地上层" };
const NORMALIZATION = { mprReference: 0.6, mciReference: 1.5, mliReference: 3, mscrReference: 8, tleiScale: 3 };

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const round = (value, digits = 3) => Number((Number(value) || 0).toFixed(digits));
const safeDivide = (value, total) => Number(total) > 0 ? Number(value) / Number(total) : 0;
const isMissing = (value) => value === null || value === undefined || String(value).trim() === "";
const firstValue = (...values) => values.find((value) => !isMissing(value));
const numberOf = (...values) => Number(firstValue(...values)) || 0;
const fieldValue = (source, primary, ...aliases) => Object.prototype.hasOwnProperty.call(source, primary)
  ? source[primary]
  : firstValue(...aliases.map((key) => source[key]));

function packageResult(result, explanation, errors = []) {
  return { ...result, result, explanation, errors, formulaVersion: FORMULA_VERSION };
}

function validateNonNegative(entries) {
  return entries.flatMap(([label, value]) => {
    if (isMissing(value)) return [`${label}不能为空。`];
    if (!Number.isFinite(Number(value))) return [`${label}必须为有效数字。`];
    if (Number(value) < 0) return [`${label}不能为负数。`];
    return [];
  });
}

function readWeights(weights = DEFAULT_WEIGHTS) {
  const values = {
    ground: firstValue(weights.ground, weights.surface, DEFAULT_WEIGHTS.ground),
    underground: firstValue(weights.underground, DEFAULT_WEIGHTS.underground),
    upper: firstValue(weights.upper, weights.elevated, DEFAULT_WEIGHTS.upper)
  };
  const errors = validateNonNegative([
    ["地表层理想权重", values.ground], ["地下层理想权重", values.underground], ["地上层理想权重", values.upper]
  ]);
  const total = Object.values(values).reduce((sum, value) => sum + Number(value || 0), 0);
  if (Math.abs(total - 1) > 0.001) errors.push(`理想权重之和应为 1，当前为 ${round(total, 3)}。`);
  const normalized = total > 0
    ? Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value) / total]))
    : { ...DEFAULT_WEIGHTS };
  return { weights: normalized, originalTotal: total, errors };
}

function readAreas(inputs) {
  return {
    ground: fieldValue(inputs, "groundArea", "surfaceArea"),
    underground: inputs.undergroundArea,
    upper: fieldValue(inputs, "upperArea", "elevatedArea")
  };
}

function normalizeFacilityDistribution(distribution = {}) {
  const values = Object.fromEntries(Object.keys(FACILITY_TARGET).map((key) => [key, numberOf(distribution[key])]));
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  return total > 0
    ? Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value / total]))
    : { ...FACILITY_TARGET };
}

/**
 * 输入：三层实际占比 P、理想权重 W（均为 0-1 无量纲比例）。
 * 输出：0-1 的分布效能 D；P 越接近 W，D 越接近 1。
 */
export function calculateDistributionEfficiency(actualRatios = {}, idealWeights = DEFAULT_WEIGHTS) {
  const actual = {
    ground: firstValue(actualRatios.ground, actualRatios.surface),
    underground: actualRatios.underground,
    upper: firstValue(actualRatios.upper, actualRatios.elevated)
  };
  const errors = validateNonNegative([
    ["地表层实际占比", actual.ground], ["地下层实际占比", actual.underground], ["地上层实际占比", actual.upper]
  ]);
  const actualTotal = Object.values(actual).reduce((sum, value) => sum + Number(value || 0), 0);
  if (Math.abs(actualTotal - 1) > 0.001) errors.push(`各层实际占比之和应为 1，当前为 ${round(actualTotal, 3)}。`);
  const weightData = readWeights(idealWeights);
  errors.push(...weightData.errors);
  const absoluteDeviation = Object.keys(weightData.weights).reduce((sum, key) => {
    return sum + Math.abs(Number(actual[key] || 0) - weightData.weights[key]);
  }, 0);
  const D = round(clamp(1 - absoluteDeviation / 2));
  const result = { D, absoluteDeviation: round(absoluteDeviation), actualRatios: actual, idealWeights: weightData.weights };
  return packageResult(result, {
    inputs: `P地表=${round(actual.ground)}，P地下=${round(actual.underground)}，P地上=${round(actual.upper)}；W地表=${round(weightData.weights.ground)}，W地下=${round(weightData.weights.underground)}，W地上=${round(weightData.weights.upper)}。`,
    formula: "D = 1 - 0.5 × Σ|Pi-Wi|，并将结果约束在 0-1。",
    intermediate: `三层占比绝对偏差总和为 ${round(absoluteDeviation)}。`,
    result: `分布效能指数 D=${D}。`,
    interpretation: "D 越接近 1，表示三层公共空间实际分布越接近研究设定的理想权重。",
    note: "研究公式可校核版本；理想权重需由课题、专家或样本标定。"
  }, errors);
}

/**
 * 输入：三层面积 Ai（㎡）及各层有效系数 Ni（0-1）。
 * 输出：有效公共空间面积 A_effective（㎡）。
 */
export function calculateEffectiveArea(inputs = {}) {
  const areas = readAreas(inputs);
  const configured = typeof inputs.effectiveFactors === "object" ? inputs.effectiveFactors : {};
  const factors = {
    ground: firstValue(configured.ground, configured.surface, DEFAULT_EFFECTIVE_FACTORS.ground),
    underground: firstValue(configured.underground, DEFAULT_EFFECTIVE_FACTORS.underground),
    upper: firstValue(configured.upper, configured.elevated, DEFAULT_EFFECTIVE_FACTORS.upper)
  };
  const overallFactor = firstValue(typeof inputs.effectiveFactors === "number" ? inputs.effectiveFactors : null, inputs.effectiveCoefficient, 1);
  const errors = validateNonNegative([
    ["地表层公共空间面积", areas.ground], ["地下层公共空间面积", areas.underground], ["地上层公共空间面积", areas.upper],
    ["地表层有效系数", factors.ground], ["地下层有效系数", factors.underground], ["地上层有效系数", factors.upper], ["总体有效系数", overallFactor]
  ]);
  Object.entries(factors).forEach(([key, value]) => {
    if (Number(value) > 1) errors.push(`${LAYER_LABELS[key]}有效系数应在 0-1 之间。`);
  });
  const layerEffectiveAreas = Object.fromEntries(Object.keys(areas).map((key) => [key, Number(areas[key] || 0) * Number(factors[key] || 0)]));
  const effectiveArea = Object.values(layerEffectiveAreas).reduce((sum, value) => sum + value, 0) * Number(overallFactor || 0);
  const result = { effectiveArea: round(effectiveArea, 2), effectivePublicSpaceArea: round(effectiveArea, 2), areas, effectiveFactors: factors, overallFactor: Number(overallFactor), layerEffectiveAreas };
  return packageResult(result, {
    inputs: `地表/地下/地上面积分别为 ${numberOf(areas.ground)}、${numberOf(areas.underground)}、${numberOf(areas.upper)}㎡；有效系数分别为 ${factors.ground}、${factors.underground}、${factors.upper}。`,
    formula: "A_effective = Σ(Ai × Ni) × N_overall。",
    intermediate: `三层折算面积分别为 ${round(layerEffectiveAreas.ground, 2)}、${round(layerEffectiveAreas.underground, 2)}、${round(layerEffectiveAreas.upper, 2)}㎡。`,
    result: `有效公共空间面积 A_effective=${round(effectiveArea, 2)}㎡。`,
    interpretation: "有效系数用于折算不同标高公共空间的可使用程度，面积本身仍保持平方米量纲。",
    note: "Ni 当前为研究参数，真实项目应由开放时长、可达性或使用效率标定。"
  }, errors);
}

/**
 * 输入：面积、容积率 R、有效系数 N、理想权重 W、建设用地面积。
 * 输出：P、D、A_effective 与无量纲容量指数 C。
 */
export function calculateCapacityScore(inputs = {}, idealWeights) {
  const areas = readAreas(inputs);
  const areaErrors = validateNonNegative([
    ["地表层公共空间面积", areas.ground], ["地下层公共空间面积", areas.underground], ["地上层公共空间面积", areas.upper]
  ]);
  const totalBaseSurfaceArea = Object.values(areas).reduce((sum, value) => sum + Number(value || 0), 0);
  if (totalBaseSurfaceArea <= 0) areaErrors.push("三层公共空间总面积必须大于 0。");
  const actualRatios = Object.fromEntries(Object.entries(areas).map(([key, value]) => [key, safeDivide(value, totalBaseSurfaceArea)]));
  const distribution = calculateDistributionEfficiency(actualRatios, idealWeights || inputs.idealWeights || DEFAULT_WEIGHTS);
  const effective = calculateEffectiveArea(inputs);
  const referenceArea = firstValue(inputs.constructionLandArea, inputs.landArea);
  const floorAreaRatio = inputs.floorAreaRatio;
  const errors = [...areaErrors, ...distribution.errors, ...effective.errors, ...validateNonNegative([
    ["建设用地面积", referenceArea], ["容积率", floorAreaRatio]
  ])];
  if (Number(referenceArea) <= 0) errors.push("建设用地面积必须大于 0。");
  const effectiveAreaRatio = safeDivide(effective.effectiveArea, referenceArea);
  // A_effective/A_reference 消除面积量纲；R 与 D 均无量纲，因此 C 无量纲。
  const C = round(effectiveAreaRatio * Number(floorAreaRatio || 0) * distribution.D, 2);
  const ratios = { ...actualRatios, surface: actualRatios.ground, elevated: actualRatios.upper };
  const result = {
    C, D: distribution.D, actualRatios: ratios, idealWeights: distribution.idealWeights,
    effectiveFactors: effective.effectiveFactors, effectivePublicSpaceArea: effective.effectiveArea,
    weightedArea: effective.effectiveArea, totalBaseSurfaceArea: round(totalBaseSurfaceArea, 2), totalBaseArea: round(totalBaseSurfaceArea, 2),
    effectiveAreaRatio: round(effectiveAreaRatio)
  };
  return packageResult(result, {
    inputs: `地表/地下/地上面积为 ${numberOf(areas.ground)}/${numberOf(areas.underground)}/${numberOf(areas.upper)}㎡，容积率 R=${numberOf(floorAreaRatio)}，建设用地面积=${numberOf(referenceArea)}㎡。`,
    formula: "Pi=Ai/ΣAi；D=1-0.5×Σ|Pi-Wi|；A_effective=Σ(Ai×Ni)；C=(A_effective/A_reference)×R×D。",
    intermediate: `总基面面积=${round(totalBaseSurfaceArea, 2)}㎡，A_effective=${effective.effectiveArea}㎡，面积比=${round(effectiveAreaRatio)}，D=${distribution.D}。`,
    result: `P地表=${round(actualRatios.ground)}，P地下=${round(actualRatios.underground)}，P地上=${round(actualRatios.upper)}；C=${C}。`,
    interpretation: "C 以建设用地面积消除面积量纲，再由容积率表达开发强度、由 D 修正立体分布质量。当前参考面积口径仍需结合真实课题统一。",
    note: "research-demo-v1：D 与量纲处理可校核；参考面积及 Ni 的标定仍属于研究假设。"
  }, [...new Set(errors)]);
}

/**
 * 输入：投影面积 P（㎡）、影响域 A（㎡）、节点数 N（个）、总基面面积 S（㎡）。
 * 输出：MPR、MCI（个/万㎡）与 0-1 的 HCI。
 */
export function calculateHorizontalConnectivity(inputs = {}) {
  const P = fieldValue(inputs, "projectionArea", "groundArea", "surfaceArea");
  const A = fieldValue(inputs, "influenceArea", "constructionLandArea", "landArea");
  const N = inputs.connectionNodes;
  const S = firstValue(inputs.totalBaseSurfaceArea, inputs.totalBaseArea);
  const errors = validateNonNegative([["立体基面投影面积", P], ["影响域面积", A], ["连接节点数", N], ["立体基面总面积", S]]);
  if (Number(A) <= 0) errors.push("影响域面积必须大于 0。");
  if (Number(S) <= 0) errors.push("立体基面总面积必须大于 0。");
  const MPR = safeDivide(P, A);
  const MCI = safeDivide(N, Number(S) / 10000);
  const normalizedMPR = clamp(MPR / NORMALIZATION.mprReference);
  const normalizedMCI = clamp(MCI / NORMALIZATION.mciReference);
  const HCI = round(normalizedMPR * 0.6 + normalizedMCI * 0.4);
  const result = { MPR: round(MPR), MCI: round(MCI), HCI, normalizedMPR: round(normalizedMPR), normalizedMCI: round(normalizedMCI) };
  return packageResult(result, {
    inputs: `P=${numberOf(P)}㎡，A=${numberOf(A)}㎡，N=${numberOf(N)}个，S=${numberOf(S)}㎡。`,
    formula: `MPR=P/A；MCI=N/(S/10000)；HCI=0.6×min(MPR/${NORMALIZATION.mprReference},1)+0.4×min(MCI/${NORMALIZATION.mciReference},1)。`,
    intermediate: `MPR=${round(MPR)}，MCI=${round(MCI)}个/万㎡；归一化值为 ${round(normalizedMPR)}、${round(normalizedMCI)}。`,
    result: `水平连接指数 HCI=${HCI}。`,
    interpretation: "MPR 与 MCI 保留原始研究含义，只有进入 HCI 时才按显式基准归一化，避免单位量级支配结果。",
    note: "0.6 与 1.5 为 research-demo-v1 校核基准，需用案例样本或规范阈值重新标定。"
  }, [...new Set(errors)]);
}

/**
 * 输入：层阶度 MLI、连通楼层数 Fi、连续基面系统数。
 * 输出：MSCR（层/系统）、0-10 的 VCI 及其 0-1 归一化值。
 */
export function calculateVerticalConnectivity(inputs = {}) {
  const MLI = fieldValue(inputs, "mli", "multiLevelIndex");
  const Fi = inputs.connectedFloors;
  const systems = fieldValue(inputs, "continuousSystems", "systemCount");
  const errors = validateNonNegative([["层阶度 MLI", MLI], ["连通楼层数 Fi", Fi], ["连续基面系统数", systems]]);
  if (Number(systems) <= 0) errors.push("连续基面系统数必须大于 0。");
  const MSCR = safeDivide(Fi, systems);
  const normalizedMLI = clamp(Number(MLI || 0) / NORMALIZATION.mliReference);
  const normalizedMSCR = clamp(MSCR / NORMALIZATION.mscrReference);
  const normalizedVCI = normalizedMLI * 0.5 + normalizedMSCR * 0.5;
  const VCI = round(normalizedVCI * 10, 2);
  const result = { MLI: round(MLI, 2), MSCR: round(MSCR), VCI, normalizedMLI: round(normalizedMLI), normalizedMSCR: round(normalizedMSCR), normalizedVCI: round(normalizedVCI) };
  return packageResult(result, {
    inputs: `MLI=${numberOf(MLI)}，Fi=${numberOf(Fi)}层，连续基面系统数=${numberOf(systems)}。`,
    formula: `MSCR=Fi/连续基面系统数；VCI=10×[0.5×min(MLI/${NORMALIZATION.mliReference},1)+0.5×min(MSCR/${NORMALIZATION.mscrReference},1)]。`,
    intermediate: `MSCR=${round(MSCR)}层/系统；MLI、MSCR 归一化值为 ${round(normalizedMLI)}、${round(normalizedMSCR)}。`,
    result: `垂直连接指数 VCI=${VCI}（0-10）。`,
    interpretation: "VCI 保留 0-10 展示尺度；进入 TLEI 时使用 0-1 的 normalizedVCI，避免与 HCI 量级冲突。",
    note: "MLI=3、MSCR=8层/系统为 research-demo-v1 归一化基准，需由真实样本校准。"
  }, [...new Set(errors)]);
}

/**
 * 输入：水平、垂直连接参数和连廊宽度效能因子 Wf。
 * 输出：MPR、MCI、HCI、MLI、MSCR、VCI、TLEI。
 */
export function calculateConnectivityScore(inputs = {}) {
  const totalBaseSurfaceArea = firstValue(inputs.totalBaseSurfaceArea, inputs.totalBaseArea,
    numberOf(inputs.groundArea, inputs.surfaceArea) + numberOf(inputs.undergroundArea) + numberOf(inputs.upperArea, inputs.elevatedArea));
  const horizontal = calculateHorizontalConnectivity({ ...inputs, totalBaseSurfaceArea });
  const vertical = calculateVerticalConnectivity(inputs);
  const Wf = fieldValue(inputs, "widthEfficiencyFactor", "corridorWidthFactor");
  const errors = [...horizontal.errors, ...vertical.errors, ...validateNonNegative([["连廊宽度效能因子 Wf", Wf]])];
  const normalizedTLEI = clamp((horizontal.HCI * 0.5 + vertical.normalizedVCI * 0.5) * Number(Wf || 0));
  const TLEI = round(normalizedTLEI * NORMALIZATION.tleiScale, 2);
  const result = {
    MPR: horizontal.MPR, MCI: horizontal.MCI, HCI: horizontal.HCI,
    MLI: vertical.MLI, MSCR: vertical.MSCR, VCI: vertical.VCI, TLEI,
    normalizedVCI: vertical.normalizedVCI, normalizedTLEI: round(normalizedTLEI), Wf: Number(Wf || 0)
  };
  return packageResult(result, {
    inputs: `${horizontal.explanation.inputs} ${vertical.explanation.inputs} Wf=${numberOf(Wf)}。`,
    formula: `${horizontal.explanation.formula} ${vertical.explanation.formula} TLEI=${NORMALIZATION.tleiScale}×min([0.5×HCI+0.5×VCI归一化]×Wf,1)。`,
    intermediate: `MPR=${horizontal.MPR}，MCI=${horizontal.MCI}个/万㎡，MSCR=${vertical.MSCR}层/系统，HCI=${horizontal.HCI}，VCI归一化=${vertical.normalizedVCI}。`,
    result: `HCI=${horizontal.HCI}，VCI=${vertical.VCI}，TLEI=${TLEI}。`,
    interpretation: "TLEI 在统一的 0-1 尺度上综合水平与垂直连接，再由 Wf 修正连廊有效宽度，最终映射到 0-3 展示尺度。",
    note: "research-demo-v1：基础比率可复算；归一化基准、权重和 TLEI 展示尺度仍需样本校准。"
  }, [...new Set(errors)]);
}

/**
 * 输入：三层四类设施比例；输出：FLI、FE、LA 与诊断。
 * 当前为 Demo 规则评分，不属于研究实证公式。
 */
export function calculateFacilityLayoutScore(inputs = {}) {
  const globalDistribution = normalizeFacilityDistribution(inputs.facilities);
  const providedLayers = inputs.facilityDistribution || inputs.facilityLayers;
  const layers = {};
  for (const layer of ["underground", "ground", "upper"]) {
    const source = providedLayers?.[layer] || (layer === "ground" ? providedLayers?.surface : null) || (layer === "upper" ? providedLayers?.elevated : null);
    layers[layer] = normalizeFacilityDistribution(source || globalDistribution);
  }
  const layerScores = Object.fromEntries(Object.entries(layers).map(([layer, distribution]) => {
    const deviation = Object.keys(FACILITY_TARGET).reduce((sum, key) => sum + Math.abs(distribution[key] - FACILITY_TARGET[key]), 0);
    return [layer, round(clamp(1 - deviation / 2))];
  }));
  const balance = Object.keys(FACILITY_TARGET).reduce((sum, type) => {
    const values = Object.values(layers).map((layer) => layer[type]);
    return sum + 1 - (Math.max(...values) - Math.min(...values));
  }, 0) / Object.keys(FACILITY_TARGET).length;
  const averageFit = Object.values(layerScores).reduce((sum, value) => sum + value, 0) / 3;
  const FLI = round(clamp(averageFit * 0.65 + balance * 0.35), 2);
  const FE = round(clamp(globalDistribution.functional * 0.45 + globalDistribution.experiential * 0.35 + averageFit * 0.35), 2);
  const LA = round(clamp(globalDistribution.social * 0.4 + globalDistribution.spontaneous * 0.35 + balance * 0.45), 2);
  const diagnosis = [];
  const weakest = Object.entries(layerScores).sort((a, b) => a[1] - b[1])[0];
  if (weakest[1] < 0.78) diagnosis.push(`${LAYER_LABELS[weakest[0]]}设施结构与目标配比偏差较大。`);
  Object.entries(globalDistribution).forEach(([type, value]) => {
    if (value < FACILITY_TARGET[type] * 0.7) diagnosis.push(`${FACILITY_LABELS[type]}设施占比偏低。`);
  });
  if (!providedLayers) diagnosis.push("当前未提供分层设施数据，本次按全局比例映射到三层。");
  if (!diagnosis.length) diagnosis.push("三层设施类型与跨层分布较为均衡。");
  const result = { FLI, FE, LA, diagnosis, layerScores, crossLayerBalance: round(balance), facilityDistribution: layers, idealFacilities: FACILITY_TARGET };
  return packageResult(result, {
    inputs: `功能性/体验性/社会性/自发性全局比例为 ${round(globalDistribution.functional)}/${round(globalDistribution.experiential)}/${round(globalDistribution.social)}/${round(globalDistribution.spontaneous)}。`,
    formula: "FLI=各层目标适配度×65%+跨层均衡度×35%；FE、LA 为规则加权评分。",
    intermediate: `地下/地表/地上适配度=${layerScores.underground}/${layerScores.ground}/${layerScores.upper}，跨层均衡度=${round(balance)}。`,
    result: `FLI=${FLI}，FE=${FE}，LA=${LA}。`,
    interpretation: diagnosis.join(" "),
    note: "Demo 规则评分，后续应替换为服务半径、网络可达性、业态匹配和客流数据模型。"
  });
}

/**
 * 输入：容量、连接、设施三类计算结果。
 * 输出：建议数组；数组附带 result、explanation、errors、formulaVersion 元数据。
 */
export function generateOptimizationAdvice(results) {
  const advice = [];
  const ratios = results.capacity.actualRatios;
  if (ratios.surface > 0.58) advice.push("地表基面承担公共活动比例偏高，建议将部分活动导入地下站城界面或二层慢行平台。");
  if (ratios.underground < 0.24) advice.push("地下基面开发不足，可结合轨道站厅和地下商业廊道组织连续公共基面。");
  if (ratios.elevated < 0.16) advice.push("空中基面比例偏低，建议补充二层连廊、屋顶公共平台及跨街节点。");
  if (results.capacity.D < 0.9) advice.push("基面分布均衡性仍有提升空间，应校准地下、地表、地上三类基面的功能分工。");
  if (results.capacity.C < 3) advice.push("容量指数偏低，建议提高有效基面利用系数并释放垂直公共空间容量。");
  if (results.connectivity.TLEI < 1.8) advice.push("立体链接效能不足，宜增加转换节点并优化连廊净宽与标高衔接。");
  if (results.connectivity.HCI < 0.2) advice.push("水平连接指数偏弱，可在核心步行路径与轨道出入口之间补充连接节点。");
  if (results.facility.FLI < 0.75) advice.push("设施配置存在偏置，应补足体验性、社会性交往和自发活动空间。");
  if (!advice.length) advice.push("当前方案较为均衡，建议进入客流仿真、服务半径和分时运营校核。");
  return Object.assign(advice, {
    result: advice.slice(),
    explanation: {
      inputs: `D=${results.capacity.D}，C=${results.capacity.C}，HCI=${results.connectivity.HCI}，TLEI=${results.connectivity.TLEI}，FLI=${results.facility.FLI}。`,
      formula: "按容量、分布、连接和设施指标阈值匹配对应城市设计建议。",
      intermediate: `共触发 ${advice.length} 条阈值规则。`,
      result: `生成 ${advice.length} 条优化建议。`,
      interpretation: "建议用于定位方案短板，不替代规范审查、仿真或专家决策。",
      note: "research-demo-v1 规则建议，阈值应随真实样本和课题目标更新。"
    },
    errors: [],
    formulaVersion: FORMULA_VERSION
  });
}

/** 汇总三个模块并生成 Demo 综合评分。 */
export function calculateScheme(inputs = {}, idealWeights) {
  const capacity = calculateCapacityScore({ ...inputs, idealWeights }, idealWeights);
  const connectivity = calculateConnectivityScore({ ...inputs, totalBaseSurfaceArea: capacity.totalBaseSurfaceArea });
  const facility = calculateFacilityLayoutScore(inputs);
  const normalizedC = clamp(capacity.C / 4.8);
  const normalizedTLEI = clamp(connectivity.TLEI / NORMALIZATION.tleiScale);
  const compositeScore = round((capacity.D * 0.3 + normalizedC * 0.3 + normalizedTLEI * 0.3 + facility.FLI * 0.1) * 100, 1);
  const grade = compositeScore >= 88 ? "优" : compositeScore >= 78 ? "良" : compositeScore >= 68 ? "中" : "待优化";
  return { capacity, connectivity, facility, compositeScore, grade, errors: [...capacity.errors, ...connectivity.errors, ...facility.errors], formulaVersion: FORMULA_VERSION };
}
