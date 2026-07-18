# 高强度城市片区基面系统辅助设计决策平台

这是一个面向城市设计研究、方案比选和作品集展示的前端 Demo。当前公式版本为 `research-formula-v2`，由方案参数实时计算研究指标，并保留旧平台展示值用于差异审计。

## 项目结构

- `index.html`：页面结构和基础视觉样式。
- `data/schemes.json`：四个方案输入、项目理想权重和旧平台展示值。
- `data/corridor-data-template.json`：四方案连廊明细与宽度区间汇总空模板。
- `config/formula-presets.json`：有效系数、设施权重、活动/运营评分、理想配比和连廊宽度系数。
- `js/calculations.js`：`research-formula-v2` 真实研究公式。
- `js/calculations.research-demo-v1.js`：升级前 v1 公式快照。
- `js/app.js`：参数编辑、研究值展示、旧值对比、warning、报告导出和 TLEI 口径切换。
- `docs/formula-spec.md`：v2 数学公式、单位和配置规范。
- `docs/formula-gap-audit.md`：v1 与 v2 差异审计。
- `docs/data-audit.md`：四方案数据冲突和可用性审计。
- `docs/corridor-data-guide.md`：Rhino/CAD/Excel 连廊数据采集与填写指南。
- `tests/formula-check.js`：回归、敏感性和异常测试。
- `assets/images/`：模型占位资源与 SVG 源稿。

## 本地运行

```bash
python3 -m http.server 8000
```

访问 [http://localhost:8000](http://localhost:8000)。页面会同时读取 `schemes.json` 与 `formula-presets.json`，不能直接用 `file://` 打开。

## 公式来源与版本

`research-formula-v2` 完全按人工确认的研究数学规范实现，不通过旧 JSON 反推公式。旧值只用于偏差比较，不能作为公式正确性依据。

### 基面容量

```text
p_i = A_i/ΣA_i
D = 1-sqrt(Σ((w_i-p_i)^2)/n)
A_effective_10k = Σ((A_i_m2/10000)×N_i)
C = (A_effective_10k×D)/R
```

- 输入面积为㎡，C 计算显式转换为万㎡。
- R 位于分母，已删除旧版 `A_reference`。
- 项目 `w_i` 继续从 `schemes.json` 读取；权重和不等于1时拒绝计算，不静默归一化。

### 立体连接

```text
MPR=P/A
MCI=N×10000/S                         [个/万㎡]
HCI=MPR×MCI
MLI=S/P
MSCR=ΣF_i/N_sys                       [层单位/连续系统]
VCI=MLI×MSCR
W_f=Σ(A_corridor_i×C_i)/ΣA_corridor_i
```

TLEI 有两种明确口径：

- 默认 `ppt-research`：`sqrt(W_f×HCI×VCI)`。
- 兼容 `legacy-platform`：`W_f×sqrt(HCI×VCI)`。

界面连接模块始终展示研究公式与旧平台兼容结果。Wf 依次使用已核验 `corridors[]`、已核验 `corridorAreaByWidthClass[]`，否则使用 `representative-width-estimate`：典型7m常规连廊对应 `Wf=1.20`。该值明确标记为专业估算且 `verified=false`，后续可由 Rhino/CAD 实测面积加权结果替换；`legacyWf` 仅作历史对照。

### 设施指标

设施输入为逐设施数组，每条记录需要：

```json
{
  "baseLevel": "ground",
  "functionalDomain": "dining",
  "activityType": "A1",
  "operationType": "T3",
  "effectiveAreaM2": 500
}
```

`functionalDomain` 与 `activityType` 是两个独立维度。

```text
1 VM = 100㎡
n_ij = effectiveAreaM2/100
UI_ij = activityScore×operationScore
FE = Σ[(Σ(n_ij×f_j×UI_ij))×W_i] / Σ(A_i_VM×N_i)
LA = sqrt(D_func×D_vert)
FLI = (FE×LA)/U
```

公共空间面积转换为100㎡模块，是为了与设施模块 `n_ij` 保持量纲一致的工程实现约定。FE、FLI 不 clamp 到0-1；`displayScore` 仅用于图表展示，不覆盖研究原始值。若任一 A1-A4 类型没有样本，D_vert、LA、FLI 返回 `notEvaluable`。

## 公式配置

以下参数全部位于 `config/formula-presets.json`，没有写死在计算函数中：

- 三层有效系数 N_i；
- 设施基面区位系数 W_i；
- 功能权重 f_j；
- 活动支撑评分与运营时段评分；
- 设施理想总体配比与垂直配比；
- 连廊宽度效率系数；
- 人工缺失时的楼层单位面积换算基准。

不同城市或项目可新增 preset。项目理想权重 w_i 不放入统一 preset，继续由 `schemes.json` 提供。

## 原始指标、展示评分和旧值

- 研究原始指标：D、C、HCI、VCI、TLEI、FE、LA、FLI，直接来自 v2 公式。
- 归一化展示评分：仅用于卡片、图表和 Demo 综合展示。
- 旧平台展示值：保留在 `raw` 和 `legacyFacilityRatios` 中，仅作偏差审计。

研究指标缺失时仍在计算结果中保留明确状态和中文 warning，不以0或旧平台值填补。当前四方案统一采用典型7m连廊专业估算，连接指标可正常计算；综合展示分对当前已有的容量与连接展示指标按原权重归一化，因此可正常生成评价和推荐。逐设施记录仍缺失，FE/LA/FLI 的研究状态保持独立，不用旧汇总比例替代。

## 测试与校核

```bash
node tests/formula-check.js
```

测试覆盖：

- 方案一 D、有效面积、C 回归；
- MPR、MCI、HCI、MLI、MSCR、VCI 和两种 TLEI 回归；
- 面积、容积率、节点、楼层单位、连廊宽度和设施配比敏感性；
- 空值、负数、权重错误、R=0、P>A、S<P、N_sys=0、空连廊和缺活动类型。

页面校核：进入任一模块后点击“查看计算过程”，检查公式版本、输入、中间值、研究值、旧平台值、相对偏差、errors 和 warnings。

## 当前数据限制

详见 `docs/data-audit.md`。当前最重要的待确认项是：

1. 方案一 `influenceArea` 为 `1193121.75㎡`，但旧 MPR 和回归基准对应 `193121.75㎡`。
2. 四方案尚无已核验 `corridors[]`；当前统一使用典型7m连廊专业估算 `Wf=1.20`，后续可由 Rhino/CAD 模型数据替换。
3. 四方案尚无逐设施 records，FE/LA/FLI 不可评估。
4. 当前 `connectedFloors` 作为人工 ΣF_i 使用；若补充 floors 面积换算，不能重复累计。

## 模型图片

图片位于 `assets/images/`，路径由 `MODEL_IMAGES` 统一管理。真实截图建议保持16:9并覆盖对应 JPG；加载失败时页面会显示“模型视图待导入”并输出控制台 warning。
