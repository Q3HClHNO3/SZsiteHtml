import { readFileSync } from "node:fs";
import {
  FORMULA_VERSION,
  calculateCapacityScore,
  calculateConnectivityScore,
  calculateDistributionEfficiency,
  calculateScheme
} from "../js/calculations.js";

const data = JSON.parse(readFileSync(new URL("../data/schemes.json", import.meta.url), "utf8"));
let failures = 0;

function check(condition, message, detail = "") {
  const passed = Boolean(condition);
  console.log(`${passed ? "PASS" : "FAIL"}  ${message}${detail ? ` | ${detail}` : ""}`);
  if (!passed) failures += 1;
}

console.log(`公式版本：${FORMULA_VERSION}\n`);

for (const [name, scheme] of Object.entries(data.schemes)) {
  const result = calculateScheme(scheme.inputs, data.idealWeights);
  const metrics = {
    D: result.capacity.D,
    C: result.capacity.C,
    HCI: result.connectivity.HCI,
    VCI: result.connectivity.VCI,
    TLEI: result.connectivity.TLEI
  };
  const allFinite = Object.values(metrics).every(Number.isFinite);
  check(allFinite && result.errors.length === 0, `${name}核心指标可正常计算`, JSON.stringify(metrics));
}

const source = data.schemes["方案一"].inputs;
const baselineCapacity = calculateCapacityScore(source, data.idealWeights);
const changedCapacity = calculateCapacityScore({
  ...source,
  groundArea: 90000,
  undergroundArea: 65000,
  upperArea: 35000
}, data.idealWeights);
check(
  baselineCapacity.D !== changedCapacity.D && baselineCapacity.C !== changedCapacity.C,
  "修改三层面积后 D 和 C 同时变化",
  `D ${baselineCapacity.D}→${changedCapacity.D}，C ${baselineCapacity.C}→${changedCapacity.C}`
);

const totalBaseSurfaceArea = baselineCapacity.totalBaseSurfaceArea;
const baselineConnectivity = calculateConnectivityScore({ ...source, totalBaseSurfaceArea });
const changedConnectivity = calculateConnectivityScore({ ...source, totalBaseSurfaceArea, connectionNodes: Number(source.connectionNodes) + 10 });
check(
  baselineConnectivity.HCI !== changedConnectivity.HCI && baselineConnectivity.TLEI !== changedConnectivity.TLEI,
  "修改连接节点数后 HCI 和 TLEI 同时变化",
  `HCI ${baselineConnectivity.HCI}→${changedConnectivity.HCI}，TLEI ${baselineConnectivity.TLEI}→${changedConnectivity.TLEI}`
);

const negativeCapacity = calculateCapacityScore({ ...source, groundArea: -1 }, data.idealWeights);
check(negativeCapacity.errors.some((message) => message.includes("不能为负数")), "负数输入返回中文错误提示", negativeCapacity.errors.join("；"));

const emptyConnectivity = calculateConnectivityScore({ ...source, projectionArea: "" });
check(emptyConnectivity.errors.some((message) => message.includes("不能为空")), "空值输入返回中文错误提示", emptyConnectivity.errors.join("；"));

const invalidWeights = calculateDistributionEfficiency(
  { ground: 0.5, underground: 0.3, upper: 0.2 },
  { ground: 0.5, underground: 0.3, upper: 0.3 }
);
check(invalidWeights.errors.some((message) => message.includes("权重之和应为 1")), "权重和不等于 1 时返回中文错误提示", invalidWeights.errors.join("；"));

if (failures > 0) {
  console.error(`\n公式校核失败：${failures} 项。`);
  process.exitCode = 1;
} else {
  console.log("\n全部公式校核通过。\n");
}
