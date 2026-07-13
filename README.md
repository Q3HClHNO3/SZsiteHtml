# 高强度城市片区基面系统辅助设计决策平台 Demo

这是一个面向城市设计/规划作品集展示的前端 Demo，用于把高强度片区方案参数转化为容量、连接效率、设施布局与方案对比结果。

## 项目结构

- `index.html`：页面结构、基础样式、侧栏与右侧评估面板容器。
- `data/schemes.json`：项目元信息、四个示例方案及原始参数。
- `assets/images/`：模型视图资源；包含五张 SVG 占位图源文件及页面使用的同名 JPG 导出文件。
- `docs/formula-spec.md`：公式、参数、单位、归一化基准与数据来源规范。
- `tests/formula-check.js`：四方案计算、参数敏感性与异常输入校核脚本。
- `js/app.js`：界面渲染、参数编辑、方案切换、计算过程展示、方案对比、报告导出、面试展示模式与数据校验。
- `js/calculations.js`：核心计算函数与优化建议生成函数。

## 本地运行

由于页面通过 `fetch("./data/schemes.json")` 读取本地 JSON，建议在项目目录启动静态服务：

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

## 核心计算函数

当前 Demo 已从静态结果展示升级为参数驱动计算。`js/calculations.js` 中的纯函数根据当前方案 `inputs` 实时重算，`raw` 只保留旧展示值用于偏差校核：

- `calculateDistributionEfficiency(actualRatios, idealWeights)`：比较三层实际占比 P 与理想权重 W，返回 D、总偏差和中文解释。
- `calculateEffectiveArea(inputs)`：按三层面积和有效系数计算有效公共空间面积。
- `calculateCapacityScore(inputs, idealWeights)`：返回三层实际占比、D、有效公共空间面积、C 和完整计算过程。新字段 `groundArea/upperArea/effectiveFactors` 与现有 `surfaceArea/elevatedArea/effectiveCoefficient` 均可使用。
- `calculateHorizontalConnectivity(inputs)`：计算 MPR、MCI（个/万㎡）和归一化 HCI。
- `calculateVerticalConnectivity(inputs)`：计算 MSCR（层/系统）、VCI 及其归一化值。
- `calculateConnectivityScore(inputs)`：汇总 HCI、VCI 与 Wf，生成 TLEI。
- `calculateFacilityLayoutScore(inputs)`：根据地下、地表、地上三层四类设施分布进行规则评分，返回 FLI、FE、LA、诊断和计算过程。
- `calculateScheme(inputs, idealWeights)`：汇总三类评估结果，并按 D 30%、C 30%、TLEI 30%、FLI 10% 生成综合评分。
- `generateOptimizationAdvice(results)`：根据指标阈值生成城市设计优化建议。

每个函数均返回平铺指标、`result`、`explanation`、`errors` 和 `formulaVersion`。当前版本为 `research-demo-v1`。

## 公式成熟度

以下部分已整理为可复算的研究公式：

- D：`D = 1 - 0.5 × Σ|Pi-Wi|`，范围为 0-1。
- 有效面积：`A_effective = Σ(Ai×Ni)×N_overall`。
- C：`C = (A_effective/A_reference)×R×D`，通过面积比消除面积量纲。
- MPR：投影面积与影响域面积之比。
- MCI：连接节点数除以总基面面积，并换算为“个/万㎡”。
- MSCR：连通楼层数除以连续基面系统数，单位为“层/系统”。

以下部分仍含 Demo 研究假设：

- HCI、VCI、TLEI 的归一化基准与组合权重，需要通过真实案例样本、规范阈值或专家调查标定。
- FLI、FE、LA 仍为 Demo 规则评分，后续应替换为服务半径、网络可达性、业态匹配、客流与运营模型。
- 综合评分仍采用 D 30%、C 30%、TLEI 30%、FLI 10% 的演示权重。

详细公式、单位和数据来源见 `docs/formula-spec.md`。替换真实公式时应保留函数输出契约，并更新 `FORMULA_VERSION`、规范文档和测试预期。

设施分层数据可在方案 `inputs` 中按以下结构补充；未提供时，Demo 会把全局 `facilities` 比例映射到三层并在诊断中明确提示：

```json
{
  "facilityDistribution": {
    "underground": { "functional": 0.35, "experiential": 0.3, "social": 0.15, "spontaneous": 0.2 },
    "ground": { "functional": 0.25, "experiential": 0.35, "social": 0.18, "spontaneous": 0.22 },
    "upper": { "functional": 0.3, "experiential": 0.3, "social": 0.17, "spontaneous": 0.23 }
  }
}
```

## 功能说明

- 参数可编辑与保存：在“参数修改”中调整当前方案的基础参数、连接参数和设施配比。
- 基础数据校验：参数不能为空、不能为负数；设施占比应在 0%-100% 且合计接近 100%；权重合计应为 1。
- 查看计算过程：容量评估、连接效率评估、设施布局评估均支持展示输入参数、公式逻辑、中间值和最终结果。
- 新旧结果校核：计算过程同时显示原始 JSON 展示值与当前计算值，相对偏差超过 20% 时显示 WARNING。
- 指标解释：每个评估模块提供 D、C、HCI、VCI、TLEI、FLI 的含义、输入、输出和使用场景。
- 方案对比：对比方案一、方案二、方案三、方案三优化，并自动高亮综合评分最高的推荐方案。
- 优化建议：基于容量、连接和设施指标阈值生成针对性城市设计建议。
- 导出评估报告：左下角按钮可生成并下载 HTML 报告，同时打开新页面用于面试展示。
- 面试展示模式：顶部按钮开启后，隐藏过细表格，突出项目背景、当前方案、核心指标、方案对比、推荐方案和优化建议。

## 模型图片资源

所有模型图片路径统一配置在 `js/app.js` 的 `MODEL_IMAGES` 常量中，页面和预览弹窗不再直接引用中文图片名。默认资源位于：

```text
assets/images/model-empty.jpg
assets/images/scheme-1.jpg
assets/images/scheme-2.jpg
assets/images/scheme-3.jpg
assets/images/scheme-3-optimized.jpg
```

替换为真实项目截图时，建议先裁切为统一的 16:9 比例（当前占位图为 1600×900），再用相同文件名覆盖对应 JPG，即可保持代码与方案映射不变。如需改名或使用 PNG/WebP，只修改 `MODEL_IMAGES`，无需改动展示函数。对应 `.svg` 文件是可编辑的占位图源稿，可在替换真实截图后保留或删除。

当配置路径不存在或资源加载失败时，主模型区和预览弹窗会隐藏图片元素，显示“模型视图待导入”卡片，并列出当前方案、当前模块及缺失路径；浏览器控制台同时输出 warning，便于定位资源问题。

## 面试演示建议

1. 先点击“导入模型”，说明这是面向 CAD / Rhino / GIS 参数接入的产品原型。
2. 切换不同方案，展示核心指标卡片随方案参数变化。
3. 打开“基面系统容量评估”，点击“查看计算过程”，说明 Demo 如何把基面面积转成可解释指标。
4. 进入“方案对比”，展示推荐方案自动识别和高亮逻辑。
5. 开启“面试展示模式”，用更少表格讲清项目背景、核心指标、推荐方案和优化建议。
6. 点击“导出评估报告”，生成可独立打开的 HTML 汇报材料。

## 测试与校核

在项目目录运行：

```bash
node tests/formula-check.js
```

测试会检查四个方案的 D、C、HCI、VCI、TLEI，验证面积和连接节点变化是否引起指标变化，并检查负数、空值及权重和不等于 1 时的中文错误提示。若系统没有全局 Node，可使用任意支持 ES Modules 的 Node.js 18+ 环境。

页面校核路径：打开任一评估模块，点击“查看计算过程”，检查公式版本、输入、中间值、当前值、原始 JSON 值和偏差 warning。超过 20% 不代表计算错误，但必须核对单位、数据口径、归一化基准和公式版本。
