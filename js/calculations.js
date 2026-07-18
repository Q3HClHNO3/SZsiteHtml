export const FORMULA_VERSION = "research-formula-v2";

const LAYERS = ["underground", "ground", "upper"];
const ACTIVITIES = ["A1", "A2", "A3", "A4"];
const FACILITY_FIELDS = ["baseLevel", "functionalDomain", "activityType", "operationType", "effectiveAreaM2"];

const round = (value, digits = 5) => value === null || value === undefined || value === ""
  ? null
  : (Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null);
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value)));
const isMissing = (value) => value === null || value === undefined || String(value).trim() === "";
const hasOwn = (source, key) => Object.prototype.hasOwnProperty.call(source || {}, key);
const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);
const fieldValue = (source, primary, ...aliases) => hasOwn(source, primary)
  ? source[primary]
  : firstDefined(...aliases.map((key) => source?.[key]));

function packageResult(result, explanation, errors = [], warnings = []) {
  return { ...result, result, explanation, errors: [...new Set(errors)], warnings: [...new Set(warnings)], formulaVersion: FORMULA_VERSION };
}

function validateNumber(label, value, { positive = false, nonNegative = false } = {}) {
  if (isMissing(value)) return [`${label}不能为空。`];
  if (!Number.isFinite(Number(value))) return [`${label}必须为有效数字。`];
  if (positive && Number(value) <= 0) return [`${label}必须大于 0。`];
  if (nonNegative && Number(value) < 0) return [`${label}不能为负数。`];
  return [];
}

function requirePreset(preset, section) {
  if (!preset || preset.formulaVersion !== FORMULA_VERSION) {
    return { value: null, errors: [`缺少 ${FORMULA_VERSION} 公式 preset，无法计算${section}。`] };
  }
  return { value: preset, errors: [] };
}

function readAreas(inputs = {}) {
  return {
    underground: fieldValue(inputs, "undergroundArea"),
    ground: fieldValue(inputs, "groundArea", "surfaceArea"),
    upper: fieldValue(inputs, "upperArea", "elevatedArea")
  };
}

function readWeights(weights = {}) {
  return {
    underground: fieldValue(weights, "underground"),
    ground: fieldValue(weights, "ground", "surface"),
    upper: fieldValue(weights, "upper", "elevated")
  };
}

/**
 * 输入：各层实际占比 p_i、理想权重 w_i、参与评价层数 n。
 * 输出：D = 1 - sqrt(Σ((w_i-p_i)^2)/n)，范围 0-1。
 * 权重和异常时默认拒绝计算；仅 options.normalizeWeightsConfirmed=true 时按用户确认归一化。
 */
export function calculateDistributionEfficiency(actualRatios = {}, idealWeights = {}, options = {}) {
  const weights = readWeights(idealWeights);
  const ratios = {
    underground: fieldValue(actualRatios, "underground"),
    ground: fieldValue(actualRatios, "ground", "surface"),
    upper: fieldValue(actualRatios, "upper", "elevated")
  };
  const errors = [];
  const warnings = [];
  for (const layer of LAYERS) {
    errors.push(...validateNumber(`${layer} 实际占比`, ratios[layer], { nonNegative: true }));
    errors.push(...validateNumber(`${layer} 理想权重`, weights[layer], { nonNegative: true }));
  }
  const ratioSum = LAYERS.reduce((sum, layer) => sum + Number(ratios[layer] || 0), 0);
  const weightSum = LAYERS.reduce((sum, layer) => sum + Number(weights[layer] || 0), 0);
  if (Math.abs(ratioSum - 1) > 0.001) errors.push(`各层实际占比之和必须为 1，当前为 ${round(ratioSum)}。`);

  let appliedWeights = { ...weights };
  let normalizedByConfirmation = false;
  if (Math.abs(weightSum - 1) > 0.001) {
    if (options.normalizeWeightsConfirmed === true && weightSum > 0) {
      appliedWeights = Object.fromEntries(LAYERS.map((layer) => [layer, Number(weights[layer]) / weightSum]));
      normalizedByConfirmation = true;
      warnings.push(`理想权重原始合计为 ${round(weightSum)}，已按用户确认归一化并在计算过程中留痕。`);
    } else {
      errors.push(`理想权重之和必须为 1，当前为 ${round(weightSum)}；未获得用户确认，不执行自动归一化。`);
    }
  }

  const squaredDifferences = Object.fromEntries(LAYERS.map((layer) => {
    const difference = Number(appliedWeights[layer] || 0) - Number(ratios[layer] || 0);
    return [layer, difference ** 2];
  }));
  const n = Number(options.layerCount || LAYERS.length);
  const meanSquaredDifference = n > 0 ? LAYERS.reduce((sum, layer) => sum + squaredDifferences[layer], 0) / n : null;
  const euclideanRmsDistance = meanSquaredDifference === null ? null : Math.sqrt(meanSquaredDifference);
  const canCalculate = errors.length === 0;
  const D = canCalculate ? clamp01(1 - euclideanRmsDistance) : null;
  const result = {
    D: round(D), actualRatios: ratios, idealWeights: appliedWeights,
    squaredDifferences, meanSquaredDifference: round(meanSquaredDifference), euclideanRmsDistance: round(euclideanRmsDistance),
    layerCount: n, normalizedByConfirmation
  };
  return packageResult(result, {
    inputs: `p地下=${round(ratios.underground)}，p地表=${round(ratios.ground)}，p地上=${round(ratios.upper)}；w地下=${round(appliedWeights.underground)}，w地表=${round(appliedWeights.ground)}，w地上=${round(appliedWeights.upper)}；n=${n}。`,
    formula: "D = 1 - sqrt(Σ((w_i-p_i)^2)/n)，并将 D 控制在 0-1。",
    intermediate: `平方差：地下=${round(squaredDifferences.underground, 8)}、地表=${round(squaredDifferences.ground, 8)}、地上=${round(squaredDifferences.upper, 8)}；均方差=${round(meanSquaredDifference, 8)}；欧氏均方根距离=${round(euclideanRmsDistance, 8)}。`,
    result: canCalculate ? `分布效能指数 D=${round(D, 8)}。` : "D 未计算：请先修正权重或占比错误。",
    interpretation: normalizedByConfirmation
      ? "本次使用用户确认后的归一化权重；原始权重未被静默修改。"
      : "实际分布越接近理想权重，欧氏均方根距离越小，D 越接近 1。",
    note: `${FORMULA_VERSION} 真实研究公式。`
  }, errors, warnings);
}

/**
 * 输入：各层面积 A_i（㎡）与 preset 中的有效系数 N_i。
 * 输出：effectiveAreaM2 与 effectiveArea10k；显式执行 ㎡→万㎡转换。
 */
export function calculateEffectiveArea(inputs = {}, preset) {
  const presetState = requirePreset(preset, "有效公共空间面积");
  const areas = readAreas(inputs);
  const factors = presetState.value?.capacity?.effectiveFactors || {};
  const errors = [...presetState.errors];
  for (const layer of LAYERS) {
    errors.push(...validateNumber(`${layer} 公共空间面积`, areas[layer], { nonNegative: true }));
    errors.push(...validateNumber(`${layer} 有效系数 N_i`, factors[layer], { nonNegative: true }));
    if (Number(factors[layer]) > 1) errors.push(`${layer} 有效系数 N_i 应在 0-1 之间。`);
  }
  const layerEffectiveM2 = Object.fromEntries(LAYERS.map((layer) => [layer, Number(areas[layer] || 0) * Number(factors[layer] || 0)]));
  const effectiveAreaM2 = LAYERS.reduce((sum, layer) => sum + layerEffectiveM2[layer], 0);
  const effectiveArea10k = effectiveAreaM2 / 10000;
  const result = { effectiveAreaM2: round(effectiveAreaM2, 2), effectiveArea10k: round(effectiveArea10k, 8), areas, effectiveFactors: factors, layerEffectiveM2 };
  return packageResult(result, {
    inputs: `面积：地下=${round(areas.underground, 2)}㎡、地表=${round(areas.ground, 2)}㎡、地上=${round(areas.upper, 2)}㎡；N_i=${JSON.stringify(factors)}。`,
    formula: "A_i_10k=A_i_m2/10000；A_effective_10k=Σ(A_i_10k×N_i)。",
    intermediate: `各层有效面积：地下=${round(layerEffectiveM2.underground, 2)}㎡、地表=${round(layerEffectiveM2.ground, 2)}㎡、地上=${round(layerEffectiveM2.upper, 2)}㎡。`,
    result: `A_effective=${round(effectiveAreaM2, 2)}㎡；平方米转万平方米：${round(effectiveAreaM2, 2)}/10000=${round(effectiveArea10k, 8)}万㎡。`,
    interpretation: "万平方米转换仅改变面积单位，不引入额外归一化。",
    note: `${FORMULA_VERSION}；N_i 来自 formula preset。`
  }, errors);
}

/** 输入：A_i、N_i、w_i、R；输出 actualRatios、D、有效面积和 C=(A_effective_10k×D)/R。 */
export function calculateCapacityScore(inputs = {}, idealWeights = {}, preset, options = {}) {
  const areas = readAreas(inputs);
  const errors = [];
  const warnings = [];
  for (const layer of LAYERS) errors.push(...validateNumber(`${layer} 公共空间面积`, areas[layer], { nonNegative: true }));
  const totalAreaM2 = LAYERS.reduce((sum, layer) => sum + Number(areas[layer] || 0), 0);
  if (totalAreaM2 <= 0) errors.push("公共空间总面积必须大于 0。");
  const actualRatios = Object.fromEntries(LAYERS.map((layer) => [layer, totalAreaM2 > 0 ? Number(areas[layer]) / totalAreaM2 : null]));
  const distribution = calculateDistributionEfficiency(actualRatios, idealWeights, { ...options, layerCount: LAYERS.length });
  const effective = calculateEffectiveArea(inputs, preset);
  const R = inputs.floorAreaRatio;
  errors.push(...distribution.errors, ...effective.errors, ...validateNumber("片区综合容积率 R", R, { positive: true }));
  warnings.push(...distribution.warnings, ...effective.warnings);
  if (hasOwn(inputs, "effectiveCoefficient")) warnings.push("旧字段 effectiveCoefficient 不参与 research-formula-v2 容量公式；分层 N_i 从 preset 读取。");
  const canCalculate = errors.length === 0;
  const C = canCalculate ? (effective.effectiveArea10k * distribution.D) / Number(R) : null;
  const ratiosWithAliases = { ...actualRatios, surface: actualRatios.ground, elevated: actualRatios.upper };
  const result = {
    actualRatios: ratiosWithAliases, D: distribution.D,
    effectiveAreaM2: effective.effectiveAreaM2, effectiveArea10k: effective.effectiveArea10k,
    effectivePublicSpaceArea: effective.effectiveAreaM2, weightedArea: effective.effectiveAreaM2,
    totalBaseSurfaceArea: round(totalAreaM2, 2), totalBaseArea: round(totalAreaM2, 2), C: round(C, 8), floorAreaRatio: Number(R)
  };
  return packageResult(result, {
    inputs: `各层面积：地下=${round(areas.underground, 2)}㎡、地表=${round(areas.ground, 2)}㎡、地上=${round(areas.upper, 2)}㎡；理想权重=${JSON.stringify(distribution.idealWeights)}；R=${round(R)}。`,
    formula: "p_i=A_i/ΣA_i；D=1-sqrt(Σ((w_i-p_i)^2)/n)；A_effective_10k=Σ((A_i_m2/10000)×N_i)；C=(A_effective_10k×D)/R。",
    intermediate: `实际占比：地下=${round(actualRatios.underground, 8)}、地表=${round(actualRatios.ground, 8)}、地上=${round(actualRatios.upper, 8)}。${distribution.explanation.intermediate} ${effective.explanation.result} 容积率 R=${round(R)}。`,
    result: canCalculate ? `D=${round(distribution.D, 8)}；有效面积=${effective.effectiveAreaM2}㎡=${effective.effectiveArea10k}万㎡；C=${round(C, 8)}。` : "C 未计算：请先修正输入错误。",
    interpretation: "C 表示单位开发强度下的公共空间容量效能；R 位于分母，不使用 A_reference。",
    note: `${FORMULA_VERSION} 真实研究公式。`
  }, [...new Set(errors)], [...new Set(warnings)]);
}

/** 可选辅助函数。人工 F_i 优先；否则按 preset 中的面积基准换算楼层单位。 */
export function calculateConnectedFloorUnits(floors = [], preset) {
  const presetState = requirePreset(preset, "连通楼层单位");
  const references = presetState.value?.connectivity?.connectedFloorUnitReferenceM2 || {};
  const errors = [...presetState.errors];
  const warnings = [];
  if (!Array.isArray(floors) || floors.length === 0) errors.push("楼层数据 floors 不能为空。" );
  const details = Array.isArray(floors) ? floors.map((floor, index) => {
    const manual = firstDefined(floor.connectedFloorUnits, floor.Fi);
    if (!isMissing(manual)) {
      errors.push(...validateNumber(`第 ${index + 1} 层人工 F_i`, manual, { nonNegative: true }));
      if (!isMissing(floor.areaM2)) warnings.push(`第 ${index + 1} 层已有人工 F_i，面积自动换算未重复执行。`);
      return { index, source: "manual", units: Number(manual), areaM2: floor.areaM2 ?? null };
    }
    const areaM2 = firstDefined(floor.areaM2, floor.area);
    errors.push(...validateNumber(`第 ${index + 1} 层面积`, areaM2, { nonNegative: true }));
    const reference = floor.baseLevel === "underground" ? references.underground : references.aboveGround;
    errors.push(...validateNumber(`第 ${index + 1} 层换算基准`, reference, { positive: true }));
    return { index, source: "area", units: Number(reference) > 0 ? Math.ceil(Number(areaM2 || 0) / Number(reference)) : null, areaM2, referenceAreaM2: reference };
  }) : [];
  const totalUnits = details.every((item) => Number.isFinite(item.units)) ? details.reduce((sum, item) => sum + item.units, 0) : null;
  return packageResult({ totalUnits, details }, {
    inputs: `共 ${details.length} 条楼层记录；地上基准=${references.aboveGround}㎡/单位，地下基准=${references.underground}㎡/单位。`,
    formula: `若存在人工 F_i 则优先使用；否则地上 ceil(area/${references.aboveGround})，地下 ceil(area/${references.underground})。`,
    intermediate: details.map((item) => `#${item.index + 1}:${item.units ?? "不可计算"}单位(${item.source})`).join("；"),
    result: `ΣF_i=${totalUnits ?? "不可计算"}。`,
    interpretation: "人工统计与面积换算二选一，不重复累计。",
    note: `${FORMULA_VERSION} 辅助换算。`
  }, errors, warnings);
}

function coefficientForWidth(width, bands = []) {
  return bands.find((band) => {
    const aboveMin = band.min === null || Number(width) >= Number(band.min);
    const belowMax = band.max === null || (band.includeMax ? Number(width) <= Number(band.max) : Number(width) < Number(band.max));
    return aboveMin && belowMax;
  })?.coefficient;
}

/**
 * 输入已核验 corridors、已核验宽度区间汇总或代表宽度估算；按优先级输出 W_f。
 * 数据优先级：verified corridors > verified corridorAreaByWidthClass > representative-width-estimate > legacyWf（仅历史对照）。
 */
export function calculateCorridorWidthEfficiency(input = {}, preset) {
  const presetState = requirePreset(preset, "连廊宽度效能");
  const bands = presetState.value?.connectivity?.corridorWidthEfficiency || [];
  const errors = [...presetState.errors];
  const warnings = [];
  const data = Array.isArray(input) ? { corridors: input } : (input || {});
  const corridors = Array.isArray(data.corridors) ? data.corridors : [];
  const verifiedCorridors = corridors.filter((corridor) => corridor?.verified === true);
  const summary = Array.isArray(data.corridorAreaByWidthClass) ? data.corridorAreaByWidthClass : [];
  const verifiedSummary = summary.filter((item) => item?.verified === true);
  const representativeEstimate = data.representativeWidthEstimate || presetState.value?.connectivity?.representativeWidthEstimate || {
    representativeWidth: 7,
    Wf: 1.2,
    dataStatus: "estimated",
    dataSource: "基于典型常规连廊宽度7m的专业估算",
    verified: false
  };
  const legacyWf = data.legacyWf;
  let details = [];
  let totalArea = null;
  let weightedEffectiveArea = null;
  let Wf = null;
  let inputMode = "not-evaluable";

  if (corridors.length > verifiedCorridors.length) {
    warnings.push(`${corridors.length - verifiedCorridors.length} 条未核验连廊未进入正式 W_f 计算。`);
  }
  if (summary.length > verifiedSummary.length) {
    warnings.push(`${summary.length - verifiedSummary.length} 条未核验宽度区间汇总未进入正式 W_f 计算。`);
  }

  if (verifiedCorridors.length > 0) {
    inputMode = "verified-detail";
    details = verifiedCorridors.map((corridor, index) => {
      errors.push(...validateNumber(`第 ${index + 1} 条已核验连廊长度`, corridor.length, { nonNegative: true }));
      errors.push(...validateNumber(`第 ${index + 1} 条已核验连廊宽度`, corridor.width, { nonNegative: true }));
      if (isMissing(corridor.id)) warnings.push(`第 ${index + 1} 条已核验连廊缺少 id。`);
      if (isMissing(corridor.name)) warnings.push(`第 ${index + 1} 条已核验连廊缺少 name。`);
      if (!LAYERS.includes(corridor.level)) warnings.push(`第 ${index + 1} 条已核验连廊 level 未填写或无效。`);
      if (isMissing(corridor.elevation) || !Number.isFinite(Number(corridor.elevation))) warnings.push(`第 ${index + 1} 条已核验连廊 elevation 未填写或无效。`);
      if (isMissing(corridor.dataSource)) warnings.push(`第 ${index + 1} 条已核验连廊缺少 dataSource。`);

      const computedArea = Number(corridor.length || 0) * Number(corridor.width || 0);
      const area = isMissing(corridor.area) ? computedArea : Number(corridor.area);
      errors.push(...validateNumber(`第 ${index + 1} 条已核验连廊面积`, area, { nonNegative: true }));
      if (!isMissing(corridor.area) && Math.abs(area - computedArea) > Math.max(1, computedArea * 0.01)) {
        warnings.push(`第 ${index + 1} 条连廊提供面积与 length×width 不一致，本次按提供的 area=${area}㎡计算。`);
      }

      const automaticCoefficient = coefficientForWidth(corridor.width, bands);
      errors.push(...validateNumber(`第 ${index + 1} 条连廊自动宽度系数`, automaticCoefficient, { nonNegative: true }));
      if (!isMissing(corridor.coefficient) && Number(corridor.coefficient) !== Number(automaticCoefficient)) {
        warnings.push(`第 ${index + 1} 条连廊手工 coefficient=${corridor.coefficient} 与宽度自动系数 ${automaticCoefficient} 不一致，已采用自动系数。`);
      }
      const coefficient = automaticCoefficient;
      return {
        index, id: corridor.id ?? null, name: corridor.name ?? null, level: corridor.level ?? null,
        elevation: isMissing(corridor.elevation) ? null : Number(corridor.elevation),
        length: Number(corridor.length), width: Number(corridor.width), area,
        computedArea, coefficient, providedCoefficient: corridor.coefficient ?? null,
        weightedArea: area * Number(coefficient || 0), dataSource: corridor.dataSource ?? null, verified: true
      };
    });
  } else if (verifiedSummary.length > 0) {
    inputMode = "width-class-summary";
    details = verifiedSummary.map((item, index) => {
      if (isMissing(item.range)) errors.push(`第 ${index + 1} 条宽度区间汇总缺少 range。`);
      errors.push(...validateNumber(`第 ${index + 1} 条宽度区间面积`, item.area, { nonNegative: true }));
      errors.push(...validateNumber(`第 ${index + 1} 条宽度区间系数`, item.coefficient, { nonNegative: true }));
      if (isMissing(item.dataSource)) warnings.push(`第 ${index + 1} 条宽度区间汇总缺少 dataSource。`);
      return {
        index, range: item.range ?? null, area: Number(item.area), coefficient: Number(item.coefficient),
        weightedArea: Number(item.area || 0) * Number(item.coefficient || 0), dataSource: item.dataSource ?? null, verified: true
      };
    });
  } else if (representativeEstimate && typeof representativeEstimate === "object") {
    inputMode = "representative-width-estimate";
    const representativeWidth = Number(representativeEstimate.representativeWidth ?? 7);
    const automaticCoefficient = coefficientForWidth(representativeWidth, bands);
    errors.push(...validateNumber("代表性连廊宽度", representativeWidth, { positive: true }));
    errors.push(...validateNumber("代表宽度自动系数", automaticCoefficient, { positive: true }));
    if (representativeEstimate.verified === true) errors.push("representative-width-estimate 属于专业估算，不得标记为 verified=true。" );
    if (!isMissing(representativeEstimate.Wf) && Number(representativeEstimate.Wf) !== Number(automaticCoefficient)) {
      warnings.push(`代表宽度估算 Wf=${representativeEstimate.Wf} 与宽度自动系数 ${automaticCoefficient} 不一致，已采用自动系数。`);
    }
    if (isMissing(representativeEstimate.dataSource)) warnings.push("代表宽度估算缺少 dataSource。" );
    if (errors.length === 0) Wf = automaticCoefficient;
    details = [{
      representativeWidth,
      coefficient: automaticCoefficient,
      dataStatus: representativeEstimate.dataStatus || "estimated",
      dataSource: representativeEstimate.dataSource || "基于典型常规连廊宽度7m的专业估算",
      verified: false
    }];
    warnings.push("W_f 当前采用典型7m连廊估算值1.20，属于专业估算口径，后续可使用Rhino/CAD实测数据替换。" );
  } else if (!isMissing(legacyWf)) {
    inputMode = "legacy";
    errors.push(...validateNumber("历史兼容 legacyWf", legacyWf, { positive: true }));
    if (errors.length === 0) Wf = Number(legacyWf);
    warnings.push("当前仅有 legacyWf；该值只用于历史兼容 TLEI，不得作为正式研究 W_f。" );
  } else {
    warnings.push("缺少可用连廊口径，W_f 暂不可评估。" );
  }

  if (["verified-detail", "width-class-summary"].includes(inputMode)) {
    totalArea = details.reduce((sum, item) => sum + Number(item.area || 0), 0);
    if (totalArea <= 0) errors.push("连廊总面积必须大于 0，W_f 不可计算。" );
    weightedEffectiveArea = details.reduce((sum, item) => sum + Number(item.weightedArea || 0), 0);
    if (errors.length === 0) Wf = weightedEffectiveArea / totalArea;
  }

  const modeDescription = {
    "verified-detail": "已核验逐条连廊明细",
    "width-class-summary": "宽度区间面积汇总",
    "representative-width-estimate": "典型常规连廊代表宽度专业估算",
    legacy: "旧平台历史兼容值",
    "not-evaluable": "无可用连廊数据"
  }[inputMode];
  return packageResult({
    Wf: round(Wf), totalCorridorArea: round(totalArea, 2), weightedEffectiveArea: round(weightedEffectiveArea, 2),
    weightedCorridorArea: round(weightedEffectiveArea, 2), inputMode, corridorDetails: details,
    researchEligible: ["verified-detail", "width-class-summary", "representative-width-estimate"].includes(inputMode) && Number.isFinite(Wf),
    estimated: inputMode === "representative-width-estimate",
    dataStatus: inputMode === "representative-width-estimate" ? details[0]?.dataStatus : "verified",
    representativeWidth: inputMode === "representative-width-estimate" ? details[0]?.representativeWidth : null,
    dataSource: inputMode === "representative-width-estimate" ? details[0]?.dataSource : null,
    verified: inputMode === "representative-width-estimate" ? false : ["verified-detail", "width-class-summary"].includes(inputMode),
    widthMix: null, areaShareSum: null
  }, {
    inputs: `${modeDescription}；记录数=${details.length}。`,
    formula: inputMode === "representative-width-estimate"
      ? "代表性宽度7m落入5.0m≤width≤7.0m区间，W_f=1.20。"
      : "A_corridor_i=length_i×width_i（如提供 area 则按 area）；W_f=Σ(A_i×C_i)/ΣA_i。",
    intermediate: inputMode === "representative-width-estimate"
      ? `代表性宽度=${details[0]?.representativeWidth}m；自动宽度系数=${details[0]?.coefficient}。`
      : `ΣA=${round(totalArea, 2)}㎡；Σ(A×C)=${round(weightedEffectiveArea, 2)}㎡。`,
    result: `inputMode=${inputMode}；W_f=${round(Wf)}。`,
    interpretation: inputMode === "legacy"
      ? "legacyWf 仅用于历史兼容，不能生成正式研究 TLEI。"
      : inputMode === "representative-width-estimate"
        ? "当前 W_f 是典型7m连廊专业估算值，可用于产品原型，后续可由实测面积加权结果替换。"
        : "正式 W_f 使用已核验明细或宽度区间面积汇总。",
    note: `${FORMULA_VERSION}；宽度效率分段来自 formula preset，手工 coefficient 不覆盖自动结果。`
  }, errors, warnings);
}

/** 输入连接字段、F_i 与 corridors；输出 MPR、MCI、HCI、MLI、MSCR、VCI、Wf 和两种 TLEI。 */
export function calculateConnectivityScore(inputs = {}, preset, options = {}) {
  const P = inputs.projectionArea;
  const A = inputs.influenceArea;
  const N = inputs.connectionNodes;
  const S = firstDefined(inputs.totalBaseSurfaceArea, inputs.totalBaseArea);
  const Nsys = firstDefined(inputs.continuousSystems, inputs.systemCount);
  const errors = [
    ...validateNumber("立体基面投影面积 P", P, { positive: true }),
    ...validateNumber("影响域面积 A", A, { positive: true }),
    ...validateNumber("连接节点数 N", N, { nonNegative: true }),
    ...validateNumber("立体基面总面积 S", S, { positive: true }),
    ...validateNumber("连续基面系统数 N_sys", Nsys, { positive: true })
  ];
  const warnings = [];
  if (Number(P) > Number(A)) warnings.push(`投影面积 P=${P}㎡ 大于影响域面积 A=${A}㎡，请核对数据口径。`);
  if (Number(S) < Number(P)) warnings.push(`立体基面总面积 S=${S}㎡ 小于投影面积 P=${P}㎡，请核对面积统计。`);

  let floorUnits = null;
  const manualFi = firstDefined(inputs.connectedFloorUnits, inputs.Fi, inputs.connectedFloors);
  if (Array.isArray(manualFi)) {
    floorUnits = manualFi.reduce((sum, value, index) => {
      errors.push(...validateNumber(`F_${index + 1}`, value, { nonNegative: true }));
      return sum + Number(value || 0);
    }, 0);
    if (Array.isArray(inputs.floors) && inputs.floors.length) warnings.push("已提供人工 F_i 数组，floors 面积换算未重复执行。" );
  } else if (!isMissing(manualFi)) {
    errors.push(...validateNumber("人工统计 ΣF_i", manualFi, { nonNegative: true }));
    floorUnits = Number(manualFi);
    if (Array.isArray(inputs.floors) && inputs.floors.length) warnings.push("已提供人工 ΣF_i，floors 面积换算未重复执行。" );
  } else if (Array.isArray(inputs.floors)) {
    const calculatedUnits = calculateConnectedFloorUnits(inputs.floors, preset);
    errors.push(...calculatedUnits.errors);
    warnings.push(...calculatedUnits.warnings);
    floorUnits = calculatedUnits.totalUnits;
  } else {
    errors.push("缺少人工 F_i/ΣF_i 或 floors 数据，MSCR 不可计算。" );
  }

  const corridor = calculateCorridorWidthEfficiency({
    corridors: inputs.corridors,
    corridorAreaByWidthClass: inputs.corridorAreaByWidthClass,
    representativeWidthEstimate: inputs.representativeWidthEstimate,
    legacyWf: inputs.legacyWf
  }, preset);
  errors.push(...corridor.errors);
  warnings.push(...corridor.warnings);
  if (!isMissing(inputs.corridorWidthFactor)) warnings.push("旧字段 corridorWidthFactor 仅用于旧平台审计，不参与 research-formula-v2 的 W_f 计算。" );

  const MPR = Number(A) > 0 ? Number(P) / Number(A) : null;
  const MCI = Number(S) > 0 ? Number(N) * 10000 / Number(S) : null;
  const HCI = Number.isFinite(MPR) && Number.isFinite(MCI) ? MPR * MCI : null;
  const MLI = Number(P) > 0 ? Number(S) / Number(P) : null;
  const MSCR = Number(Nsys) > 0 && Number.isFinite(floorUnits) ? floorUnits / Number(Nsys) : null;
  const VCI = Number.isFinite(MLI) && Number.isFinite(MSCR) ? MLI * MSCR : null;
  const Wf = corridor.Wf;
  const researchWfAvailable = corridor.researchEligible === true;
  const TLEI_research = researchWfAvailable && Number.isFinite(HCI) && Number.isFinite(VCI) ? Math.sqrt(Wf * HCI * VCI) : null;
  const TLEI_ppt = TLEI_research;
  const TLEI_legacy = Number.isFinite(Wf) && Number.isFinite(HCI) && Number.isFinite(VCI) ? Wf * Math.sqrt(HCI * VCI) : null;
  const configuredMode = options.tleMode || inputs.tleMode || preset?.connectivity?.tleMode || "ppt-research";
  if (!["ppt-research", "legacy-platform"].includes(configuredMode)) errors.push(`未知 TLEI 口径：${configuredMode}。`);
  const TLEI = configuredMode === "legacy-platform" ? TLEI_legacy : TLEI_research;
  const notEvaluable = !Number.isFinite(TLEI_research);
  const historicalCompatibilityOnly = corridor.inputMode === "legacy" && Number.isFinite(TLEI_legacy);
  const result = {
    MPR: round(MPR, 8), MCI: round(MCI, 8), HCI: round(HCI, 8), MLI: round(MLI, 8),
    MSCR: round(MSCR, 8), VCI: round(VCI, 8), Wf: round(Wf, 8),
    TLEI: round(TLEI, 8), TLEI_research: round(TLEI_research, 8), TLEI_ppt: round(TLEI_ppt, 8), TLEI_legacy: round(TLEI_legacy, 8),
    tleMode: configuredMode, connectedFloorUnitsTotal: floorUnits, notEvaluable, historicalCompatibilityOnly,
    inputMode: corridor.inputMode, dataStatus: corridor.dataStatus, representativeWidth: corridor.representativeWidth,
    dataSource: corridor.dataSource, verified: corridor.verified, totalCorridorArea: corridor.totalCorridorArea,
    weightedEffectiveArea: corridor.weightedEffectiveArea, corridorDataStatus: inputs.corridorDataStatus || "unknown"
  };
  return packageResult(result, {
    inputs: `P=${round(P, 2)}㎡，A=${round(A, 2)}㎡，N=${round(N)}，S=${round(S, 2)}㎡，ΣF_i=${round(floorUnits)}，N_sys=${round(Nsys)}；${corridor.explanation.inputs}`,
    formula: "MPR=P/A；MCI=N×10000/S；HCI=MPR×MCI；MLI=S/P；MSCR=ΣF_i/N_sys；VCI=MLI×MSCR；TLEI_research=sqrt(W_f×HCI×VCI)；TLEI_legacy=W_f×sqrt(HCI×VCI)。",
    intermediate: `MPR=${round(MPR, 8)}；MCI=${round(MCI, 8)}个/万㎡；HCI=${round(HCI, 8)}；MLI=${round(MLI, 8)}；MSCR=${round(MSCR, 8)}层单位/系统；VCI=${round(VCI, 8)}；W_f=${round(Wf, 8)}。`,
    result: `正式研究公式=${round(TLEI_research, 8)}；旧平台兼容公式=${round(TLEI_legacy, 8)}；inputMode=${corridor.inputMode}；当前 tleMode=${configuredMode}，TLEI=${round(TLEI, 8)}。`,
    interpretation: "默认使用 PPT 研究公式。两种口径相差 sqrt(W_f) 与 W_f 的位置，不为匹配旧 JSON 修改真实公式。",
    note: `${FORMULA_VERSION} 真实研究公式；${historicalCompatibilityOnly ? "当前只有历史兼容 Wf，正式研究 TLEI 不可评估。" : notEvaluable ? "当前连接基础指标不足，研究 TLEI 不可评估。" : corridor.inputMode === "representative-width-estimate" ? "Wf=1.20，基于典型7m连廊宽度估算；正式研究与历史兼容 TLEI 均已计算。" : "正式研究与历史兼容 TLEI 均已计算。"}`
  }, [...new Set(errors)], [...new Set(warnings)]);
}

/** 输入逐设施 records 与公共空间面积；输出 FE、D_func、D_vert、LA、FLI 和独立 displayScore。 */
export function calculateFacilityLayoutScore(inputs = {}, preset) {
  const presetState = requirePreset(preset, "设施布局");
  const config = presetState.value?.facility || {};
  const facilities = inputs.facilities;
  const errors = [...presetState.errors];
  const warnings = [];
  if (!Array.isArray(facilities)) errors.push("facilities 必须为逐设施数组，旧版汇总比例不能用于 research-formula-v2。" );
  if (Array.isArray(facilities) && facilities.length === 0) warnings.push("设施明细为空，FE、LA、FLI 研究值暂不可评估。" );
  const validFacilities = [];
  if (Array.isArray(facilities)) facilities.forEach((facility, index) => {
    const missingFields = FACILITY_FIELDS.filter((field) => isMissing(facility[field]));
    if (missingFields.length) {
      errors.push(`第 ${index + 1} 条设施缺少字段：${missingFields.join("、")}。`);
      return;
    }
    if (!LAYERS.includes(facility.baseLevel)) errors.push(`第 ${index + 1} 条设施 baseLevel 无效。`);
    if (!ACTIVITIES.includes(facility.activityType)) errors.push(`第 ${index + 1} 条设施 activityType 无效。`);
    if (!(facility.functionalDomain in (config.functionalWeights || {}))) errors.push(`第 ${index + 1} 条设施 functionalDomain 无对应权重。`);
    if (!(facility.operationType in (config.operationScores || {}))) errors.push(`第 ${index + 1} 条设施 operationType 无对应评分。`);
    errors.push(...validateNumber(`第 ${index + 1} 条设施有效面积`, facility.effectiveAreaM2, { nonNegative: true }));
    validFacilities.push(facility);
  });

  const moduleArea = config.moduleAreaM2;
  errors.push(...validateNumber("设施模块面积", moduleArea, { positive: true }));
  const facilityDetails = validFacilities.map((facility, index) => {
    const modules = Number(facility.effectiveAreaM2) / Number(moduleArea || 1);
    const activityScore = config.activityScores?.[facility.activityType];
    const operationScore = config.operationScores?.[facility.operationType];
    const functionalWeight = config.functionalWeights?.[facility.functionalDomain];
    const locationCoefficient = config.baseLevelCoefficients?.[facility.baseLevel];
    const potentialUseIndex = Number(activityScore) * Number(operationScore);
    const weightedContribution = modules * Number(functionalWeight) * potentialUseIndex * Number(locationCoefficient);
    return { index, ...facility, modules, activityScore, operationScore, functionalWeight, locationCoefficient, potentialUseIndex, weightedContribution };
  });

  const areas = readAreas(inputs);
  const capacityFactors = preset?.capacity?.effectiveFactors || {};
  const publicSpaceModulesEffective = LAYERS.reduce((sum, layer) => {
    errors.push(...validateNumber(`${layer} 公共空间面积`, areas[layer], { nonNegative: true }));
    errors.push(...validateNumber(`${layer} 有效系数`, capacityFactors[layer], { nonNegative: true }));
    return sum + (Number(areas[layer] || 0) / Number(moduleArea || 1)) * Number(capacityFactors[layer] || 0);
  }, 0);
  if (publicSpaceModulesEffective <= 0) errors.push("有效公共空间 100㎡模块总量必须大于 0。" );
  const numerator = facilityDetails.reduce((sum, facility) => sum + facility.weightedContribution, 0);
  const FE = facilityDetails.length > 0 && errors.length === 0 ? numerator / publicSpaceModulesEffective : null;

  const modulesByActivity = Object.fromEntries(ACTIVITIES.map((activity) => [activity, 0]));
  const modulesByActivityAndLayer = Object.fromEntries(ACTIVITIES.map((activity) => [activity, Object.fromEntries(LAYERS.map((layer) => [layer, 0]))]));
  facilityDetails.forEach((facility) => {
    modulesByActivity[facility.activityType] += facility.modules;
    modulesByActivityAndLayer[facility.activityType][facility.baseLevel] += facility.modules;
  });
  const totalFacilityModules = Object.values(modulesByActivity).reduce((sum, value) => sum + value, 0);
  const actualOverallMix = Object.fromEntries(ACTIVITIES.map((activity) => [activity, totalFacilityModules > 0 ? modulesByActivity[activity] / totalFacilityModules : null]));
  const overallSquaredDifferences = Object.fromEntries(ACTIVITIES.map((activity) => [activity, totalFacilityModules > 0
    ? (actualOverallMix[activity] - Number(config.idealOverallMix?.[activity])) ** 2
    : null]));
  const D_func = totalFacilityModules > 0
    ? clamp01(1 - Math.sqrt(Object.values(overallSquaredDifferences).reduce((sum, value) => sum + value, 0) / ACTIVITIES.length))
    : null;

  const missingActivityTypes = ACTIVITIES.filter((activity) => modulesByActivity[activity] <= 0);
  missingActivityTypes.forEach((activity) => warnings.push(`${activity} 活动类型设施总数为 0，该类型样本不足，垂直配比暂不可评估。`));
  const actualVerticalMix = {};
  let verticalSquaredDifferenceSum = 0;
  for (const activity of ACTIVITIES) {
    actualVerticalMix[activity] = {};
    for (const layer of LAYERS) {
      if (modulesByActivity[activity] <= 0) {
        actualVerticalMix[activity][layer] = null;
      } else {
        const ratio = modulesByActivityAndLayer[activity][layer] / modulesByActivity[activity];
        actualVerticalMix[activity][layer] = ratio;
        verticalSquaredDifferenceSum += (ratio - Number(config.idealVerticalMix?.[activity]?.[layer])) ** 2;
      }
    }
  }
  const D_vert = missingActivityTypes.length === 0
    ? clamp01(1 - Math.sqrt(verticalSquaredDifferenceSum / (LAYERS.length * ACTIVITIES.length)))
    : null;
  const LA = Number.isFinite(D_func) && Number.isFinite(D_vert) ? clamp01(Math.sqrt(D_func * D_vert)) : null;
  const U = inputs.floorAreaRatio;
  errors.push(...validateNumber("片区综合开发强度 U（容积率）", U, { positive: true }));
  const FLI = Number.isFinite(FE) && Number.isFinite(LA) && Number(U) > 0 ? FE * LA / Number(U) : null;
  const displayReference = Number(config.displayScoreReference);
  const displayScore = Number.isFinite(FLI) && displayReference > 0 ? Math.min(100, Math.max(0, FLI / displayReference * 100)) : null;
  const notEvaluable = !Number.isFinite(FE) || !Number.isFinite(LA) || !Number.isFinite(FLI);
  const diagnostics = [
    `设施记录=${facilityDetails.length}条，总设施模块=${round(totalFacilityModules, 3)}VM。`,
    `公共空间有效模块=${round(publicSpaceModulesEffective, 3)}VM。`,
    missingActivityTypes.length ? `样本不足：${missingActivityTypes.join("、")}。` : "A1-A4 均有样本。"
  ];
  const result = {
    FE: round(FE, 8), D_func: round(D_func, 8), D_vert: round(D_vert, 8), LA: round(LA, 8), FLI: round(FLI, 8),
    displayScore: round(displayScore, 2), diagnostics, notEvaluable, missingActivityTypes,
    actualOverallMix, actualVerticalMix, facilityDetails, publicSpaceModulesEffective: round(publicSpaceModulesEffective, 5), numerator: round(numerator, 5)
  };
  return packageResult(result, {
    inputs: `逐设施记录=${facilityDetails.length}条；公共空间面积：地下=${round(areas.underground, 2)}㎡、地表=${round(areas.ground, 2)}㎡、地上=${round(areas.upper, 2)}㎡；U=${round(U)}。`,
    formula: "n_ij=effectiveAreaM2/100；UI_ij=activityScore×operationScore；FE=Σ[(Σ(n_ij×f_j×UI_ij))×W_i]/Σ(A_i_VM×N_i)；LA=sqrt(D_func×D_vert)；FLI=(FE×LA)/U。",
    intermediate: `FE分子=${round(numerator, 5)}；公共空间分母=${round(publicSpaceModulesEffective, 5)}VM；D_func=${round(D_func, 8)}；D_vert=${round(D_vert, 8)}；缺样本=${missingActivityTypes.join("、") || "无"}。`,
    result: `FE=${round(FE, 8)}；LA=${round(LA, 8)}；FLI=${round(FLI, 8)}；displayScore=${round(displayScore, 2)}。`,
    interpretation: notEvaluable
      ? "设施研究指标暂不可评估；不得以旧汇总比例或 0 值替代缺失活动类型的垂直分布。"
      : "FE、FLI 保留原始研究值且不 clamp；displayScore 仅用于图表展示。",
    note: `${FORMULA_VERSION}；公共空间面积转换为 100㎡模块，与设施模块 n_ij 保持量纲一致。`
  }, [...new Set(errors)], [...new Set(warnings)]);
}

/** 输入研究结果；输出带版本与解释元数据的阈值建议数组。 */
export function generateOptimizationAdvice(results) {
  const advice = [];
  const ratios = results.capacity.actualRatios || {};
  if (Number(ratios.ground) > 0.58) advice.push("地表基面占比偏高，建议将部分公共活动导入地下或空中基面。" );
  if (Number(results.capacity.D) < 0.9) advice.push("实际基面分布与理想权重仍有偏差，应校准三层面积配置。" );
  if (results.connectivity.notEvaluable) advice.push("缺少有效连廊数据，需补充 corridors 后再判断 TLEI。" );
  else if (Number(results.connectivity.HCI) < 0.2) advice.push("水平连接效能偏低，可增加连接节点或提高有效投影覆盖。" );
  if (results.facility.notEvaluable) advice.push("逐设施样本不足，需补充 baseLevel、functionalDomain、activityType、operationType 和有效面积。" );
  if (!advice.length) advice.push("当前研究指标未触发阈值建议，建议继续进行规范、仿真和运营数据校核。" );
  return Object.assign(advice, {
    result: advice.slice(),
    explanation: {
      inputs: `D=${round(results.capacity.D)}，HCI=${round(results.connectivity.HCI)}，TLEI_research=${round(results.connectivity.TLEI_research)}，FLI=${round(results.facility.FLI)}。`,
      formula: "按 v2 研究指标可评估状态与阈值生成建议。",
      intermediate: `触发 ${advice.length} 条规则。`, result: `生成 ${advice.length} 条建议。`,
      interpretation: "缺失状态优先转化为补数建议，不将缺失数据解释为低绩效。", note: FORMULA_VERSION
    },
    errors: [], warnings: [], formulaVersion: FORMULA_VERSION
  });
}

/** 汇总容量、连接、设施研究结果；展示综合分按当前可用模块权重归一化，研究指标缺失状态保持独立。 */
export function calculateScheme(inputs = {}, idealWeights = {}, preset, options = {}) {
  const capacity = calculateCapacityScore(inputs, idealWeights, preset, options);
  const connectivity = calculateConnectivityScore({ ...inputs, totalBaseSurfaceArea: capacity.totalBaseSurfaceArea }, preset, options);
  const facility = calculateFacilityLayoutScore(inputs, preset);
  const coreEvaluable = Number.isFinite(capacity.C) && Number.isFinite(connectivity.TLEI_research);
  const fullyEvaluable = coreEvaluable && Number.isFinite(facility.displayScore);
  const capacityReference = Number(preset?.display?.capacityReference);
  const connectivityReference = Number(preset?.connectivity?.displayScoreReference);
  const capacityDisplay = Number.isFinite(capacity.C) && capacityReference > 0
    ? Math.min(100, Math.max(0, capacity.C / capacityReference * 100))
    : null;
  const connectivityDisplay = Number.isFinite(connectivity.TLEI_research) && connectivityReference > 0
    ? Math.min(100, Math.max(0, connectivity.TLEI_research / connectivityReference * 100))
    : null;
  const weightedParts = [
    { value: Number(capacity.D) * 100, weight: 30 },
    { value: capacityDisplay, weight: 30 },
    { value: connectivityDisplay, weight: 30 },
    { value: facility.displayScore, weight: 10 }
  ].filter((part) => Number.isFinite(part.value));
  const availableWeight = weightedParts.reduce((sum, part) => sum + part.weight, 0);
  const compositeScore = coreEvaluable && availableWeight > 0
    ? round(weightedParts.reduce((sum, part) => sum + part.value * part.weight, 0) / availableWeight, 1)
    : null;
  const grade = !Number.isFinite(compositeScore) ? "暂不可评估" : compositeScore >= 88 ? "优" : compositeScore >= 78 ? "良" : compositeScore >= 68 ? "中" : "待优化";
  return {
    capacity, connectivity, facility, compositeScore, grade, fullyEvaluable, coreEvaluable,
    compositeCoverage: round(availableWeight / 100, 2),
    displayScores: { capacity: round(capacityDisplay, 2), connectivity: round(connectivityDisplay, 2), facility: facility.displayScore },
    errors: [...capacity.errors, ...connectivity.errors, ...facility.errors],
    warnings: [...capacity.warnings, ...connectivity.warnings, ...facility.warnings], formulaVersion: FORMULA_VERSION
  };
}
