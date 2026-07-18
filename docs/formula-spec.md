# research-formula-v2 公式规范

版本：`research-formula-v2`  
配置：`config/formula-presets.json`  
公式依据：人工确认的研究数学规范；旧 JSON 只用于差异比较。

## 1. 基面容量

### 参数与单位

| 参数 | 含义 | 单位 | 约束 | 来源 |
|---|---|---:|---|---|
| `A_ground` | 地表公共空间面积 | ㎡ | ≥0 | CAD/GIS/设计总图 |
| `A_underground` | 地下公共空间面积 | ㎡ | ≥0 | 地下空间图纸 |
| `A_upper` | 空中/地上公共空间面积 | ㎡ | ≥0 | 连廊、平台、屋顶统计 |
| `N_i` | 垂直层次有效系数 | 无量纲 | 0-1 | formula preset |
| `w_i` | 各层理想权重 | 无量纲 | 合计必须为1 | 当前项目 `schemes.json.idealWeights` |
| `R` | 片区综合容积率 | 无量纲 | >0 | 技术经济指标 |
| `n` | 参与评价层数 | 层类数 | 当前为3 | 研究定义 |

```text
p_i = A_i / ΣA_i
D = 1 - sqrt(Σ((w_i-p_i)^2)/n), D∈[0,1]
A_i_10k = A_i_m2 / 10000
A_effective_10k = Σ(A_i_10k×N_i)
C = (A_effective_10k×D)/R
```

权重和不等于1时默认拒绝计算。只有用户显式确认 `normalizeWeightsConfirmed=true` 时才允许归一化，并必须在 explanation/warnings 留痕。C 删除 `A_reference`，R 位于分母，表示单位开发强度下的公共空间容量效能。

## 2. 立体连接效率

| 参数 | 含义 | 单位/约束 |
|---|---|---|
| `P` | 立体基面投影面积 | ㎡，>0 |
| `A` | 影响域面积 | ㎡，>0；P>A warning |
| `N` | 连接节点数 | 个，≥0 |
| `S` | 立体基面总面积 | ㎡，>0；S<P warning |
| `F_i` | 连续系统连接楼层单位 | 层单位 |
| `N_sys` | 连续基面系统数 | 个，>0 |
| `corridors[]` | 逐条连廊记录 | length/width(m)，area(㎡，可选)，仅 verified=true 进入正式计算 |
| `corridorAreaByWidthClass[]` | 宽度区间面积汇总 | area(㎡)、coefficient；仅 verified=true 进入正式计算 |
| `representativeWidthEstimate` | 典型常规连廊宽度估算 | representativeWidth=7m、Wf=1.20、verified=false |
| `legacyWf` | 旧平台历史值 | 仅作历史对照，不覆盖当前 Wf |

```text
MPR = P/A
MCI = N/(S/10000) = N×10000/S             [个/万㎡]
HCI = MPR×MCI
MLI = S/P
MSCR = ΣF_i/N_sys                          [层单位/连续系统]
VCI = MLI×MSCR
```

人工 F_i 优先；无人工值时，地上楼层 `ceil(area/4000)`，地下楼层 `ceil(area/2000)`。两个基准存入 preset，不允许人工值与面积换算重复累计。

### 连廊宽度效能

```text
A_corridor_i = length_i×width_i
W_f = Σ(A_corridor_i×C_i)/ΣA_corridor_i
```

宽度系数来自 preset：`<2m:0.5`、`[2,3.5):0.8`、`[3.5,5):1.0`、`[5,7]:1.2`、`>7m:1.4`。手工 coefficient 与宽度自动结果不一致时返回 warning，并采用自动结果。

Wf 数据优先级为：已核验 `corridors[]` > 已核验 `corridorAreaByWidthClass[]` > `representative-width-estimate` > `legacyWf`（仅历史对照）。状态标签依次为 `verified-detail`、`width-class-summary`、`representative-width-estimate`。

代表宽度估算模式使用典型常规连廊宽度7m。该宽度落入 `[5,7]m` 区间，因此自动系数和当前 `W_f` 均为1.20。估算值可代入不变的研究 TLEI 公式，但必须标记 `dataStatus=estimated`、`verified=false`；旧 `corridorWidthFactor` 和 `legacyWf` 仅保留审计。

综合展示分与研究原始指标分开：当容量和连接指标可计算但设施明细缺失时，综合展示分仅对已有的 D、容量展示分和连接展示分按原权重归一化；设施研究指标仍保持缺失状态，不以旧比例或0补值。

```text
TLEI_research = sqrt(W_f×HCI×VCI)          默认 ppt-research
TLEI_legacy = W_f×sqrt(HCI×VCI)            legacy-platform
```

两种结果同时返回，不为匹配旧平台修改 PPT 研究公式。

## 3. 设施功能效能 FE

逐设施记录必须包含：`baseLevel`、`functionalDomain`、`activityType`、`operationType`、`effectiveAreaM2`。functionalDomain 与 activityType 是独立维度。

活动评分、运营评分、功能权重、区位系数均来自 preset。

```text
1 VM = 100㎡有效功能面积
n_ij = effectiveAreaM2/100
UI_ij = activityScore×operationScore
A_i_VM = A_i_m2/100

FE = Σ_i[(Σ_j(n_ij×f_j×UI_ij))×W_i] / Σ_i(A_i_VM×N_i)
```

**公共空间面积转换为100㎡模块，是为了与设施模块 n_ij 保持量纲一致的工程实现约定。** FE 不 clamp 到0-1。

## 4. 设施复合指数 LA

```text
D_func = 1 - sqrt(Σ_j((p_j-p_j_ideal)^2)/4)
D_vert = 1 - sqrt(Σ_iΣ_j((p_ij-p_ij_ideal)^2)/12)
LA = sqrt(D_func×D_vert)
```

理想总体配比与理想垂直矩阵来自 preset。对每种活动类型 j，`Σ_i p_ij=1`。若某活动类型没有设施，D_vert 与 LA 返回 `notEvaluable`，warnings 显示“该类型样本不足”，不自动填0。

## 5. 设施布局指数 FLI

```text
U = 容积率，U>0
FLI = (FE×LA)/U
displayScore = clamp(FLI/displayScoreReference×100, 0, 100)
```

FE、FLI 原始研究值不得 clamp。`displayScore` 只用于图表和综合展示，不覆盖原始指标。

## 6. 配置与替换

- `N_i`、设施区位系数、功能权重、活动/运营评分、理想配比矩阵、连廊宽度系数均在 `formula-presets.json`。
- 项目 `w_i` 继续从 `schemes.json` 读取，不统一成城市默认值。
- 新城市或项目应新增 preset，并通过方案 `presetId` 或项目配置选择。
- 修改公式时升级 `FORMULA_VERSION`，同步本文件与 `tests/formula-check.js`。
