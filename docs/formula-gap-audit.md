# research-demo-v1 → research-formula-v2 公式差异审计

审计日期：2026-07-15  
目标版本：`research-formula-v2`  
唯一目标依据：本次人工确认的数学规范，不以旧 JSON 展示值反推或修正研究公式。

## 总体差异

| 模块 | research-demo-v1 当前实现 | research-formula-v2 目标 | 字段/单位差异 | 预期影响 |
|---|---|---|---|---|
| 版本与配置 | 公式版本为 `research-demo-v1`；多项系数直接写在 JS | 公式版本为 `research-formula-v2`；研究系数放入 `config/formula-presets.json` | 新增 preset；方案权重仍从 `schemes.json` 读取 | 公式可追溯、可按城市/项目替换 |
| 返回契约 | 返回 result/explanation/errors/formulaVersion | 保留契约，并增加 warnings、研究值与展示评分区分 | UI 需读取 warnings 与原始值 | 异常不再静默，展示更透明 |
| 旧值校核 | 旧 JSON 值与当前值比较，偏差 20% warning | 继续保留，仅作为差异比较 | 旧值不作为公式正确性依据 | v2 偏差可能显著增大 |

## A. 基面容量

| 项目 | 当前实现 | 目标研究公式 | 差异与风险 |
|---|---|---|---|
| 实际占比 | `Pi=Ai/ΣAi` | 不变 | 字段继续兼容 `surfaceArea/groundArea`、`elevatedArea/upperArea` |
| 分布效能 D | `D=1-0.5×Σ|Pi-Wi|` | `D=1-sqrt(Σ((Wi-Pi)^2)/n)` | 从 L1 距离改为均方根欧氏偏差，D 将变化 |
| 权重处理 | 权重和异常时返回错误，但内部仍归一化后计算 | 权重和不等于 1 时返回中文错误，禁止静默归一化 | v2 默认不计算有效 D/C；如未来允许归一化必须由 UI 显式确认 |
| 有效面积 | `Σ(Ai_m2×Ni)`，单位㎡ | 先换算 `Ai_10k=Ai_m2/10000`，同时返回㎡与万㎡ | 新增 `effectiveAreaM2`、`effectiveArea10k` |
| 容量 C | `(A_effective/A_reference)×R×D` | `(A_effective_10k×D)/R` | 删除参考面积，R 从分子移到分母；C 量级与方向改变 |
| 方案一回归 | v1 约 D=0.752、C=3.24 | D≈0.82327、A_effective≈170388㎡、C≈2.87449 | 应以人工确认回归值为准 |

## B. 立体连接效率

| 项目 | 当前实现 | 目标研究公式 | 差异与风险 |
|---|---|---|---|
| MPR | `P/A` | `P/A` | 公式一致；方案一 A 字段存在冲突 |
| MCI | `N/(S/10000)`，个/万㎡ | 不变 | 单位保持“个/万㎡” |
| HCI | 对 MPR、MCI 按 0.6/1.5 基准归一化后加权 | `HCI=MPR×MCI` | 删除全部内部归一化，数值将按研究量纲变化 |
| MLI | 直接读取人工 `multiLevelIndex` | `MLI=S/P` | v2 由面积实时计算；旧输入只用于审计 |
| MSCR | `Fi/N_sys` 后进入归一化 | `ΣFi/N_sys`，层单位/连续系统 | 需支持 `connectedFloorUnits[]`；当前只有汇总 `connectedFloors` |
| VCI | MLI、MSCR 归一化加权并映射到 0–10 | `VCI=MLI×MSCR` | 删除归一化；量级取决于真实层单位 |
| Wf | 当前直接读取 `corridorWidthFactor` | 按每条连廊面积加权实时计算 | 当前四方案均缺少 `corridors[]`；旧 Wf=1.4 只能作为 legacy fallback/warning，不能冒充实时结果 |
| TLEI | v1 归一化综合后映射 0–3 | 默认 `sqrt(Wf×HCI×VCI)`；兼容 `Wf×sqrt(HCI×VCI)` | 同时返回两种口径，默认 PPT 研究公式；旧 JSON 更可能接近 legacy |

## C. 设施模块

| 项目 | 当前实现 | 目标研究公式 | 差异与风险 |
|---|---|---|---|
| 数据粒度 | `facilities` 为 A1-A4 总体比例对象 | `facilities[]` 为逐设施记录 | 四方案均缺 `baseLevel`、`functionalDomain`、`activityType`、`operationType`、`effectiveAreaM2`，无法计算真实 FE/LA/FLI |
| FE | 全局比例规则加权并 clamp 到 0-1 | 设施模块数×功能权重×潜在使用指数×区位系数，除以公共空间 100㎡模块有效量 | 不得 clamp；需公共空间面积与 Ni，量纲统一为 VM |
| LA | 各层适配度与跨层均衡度规则加权 | `LA=sqrt(D_func×D_vert)` | 理想总体配比与垂直矩阵转入 preset |
| 缺失活动类型 | 未单独处理 | 返回 `notEvaluable`，warnings 指明样本不足 | 不能把缺失类型垂直比例自动填 0 |
| FLI | 规则评分 0-1 | `(FE×LA)/U` | 不 clamp；U=容积率且必须 >0 |
| 展示评分 | 原始 FLI 直接用于图表/综合分 | 原始研究值与 `displayScore` 分离 | 综合评分需使用 displayScore，不能覆盖 FLI |

## 数据字段迁移清单

| v2 字段 | 当前字段/状态 | 处理策略 |
|---|---|---|
| `presetId` | 缺失 | 默认读取 `default-research`，允许方案级覆盖 |
| `idealWeights` | 顶层 `schemes.json.idealWeights` | 继续按现有项目值读取，不写入统一城市权重 |
| `effectiveFactors` | 仅有总体 `effectiveCoefficient`；分层系数在旧 raw 表 | 分层 Ni 从 preset 读取；总体系数不进入 v2 研究公式 |
| `connectedFloorUnits` / `Fi[]` | 仅 `connectedFloors` 汇总 | 支持数组；缺失时把人工汇总值作为单项 Fi，禁止重复自动计算 |
| `floors[]` | 缺失 | 可选，用 `calculateConnectedFloorUnits()` 计算；与人工 Fi 二选一 |
| `corridors[]` | 缺失 | 真实 Wf 不可评估；返回 warning/notEvaluable。回归测试使用显式 corridor 或 coefficient 数据 |
| `facilities[]` | 当前为总体比例对象 | 真实设施模块不可评估；保留旧比例仅供 data audit 与旧值对比 |

## 单位与量纲审计

- 容量面积输入：㎡；研究 C 使用万㎡，必须显式除以 10000。
- MCI：个/万㎡，公式为 `N×10000/S`。
- MSCR：层单位/连续系统，不是百分比。
- 连廊长度、宽度：m；连廊面积：㎡。
- FE 分子设施面积与分母公共空间面积均转换为 100㎡模块 VM，保持工程量纲一致。
- D、MPR、HCI、MLI、VCI、Wf、TLEI、D_func、D_vert、LA、FLI 为无量纲指标或无量纲评分；FE/FLI 不强制限定 0-1。

## 实施门槛

1. 容量与连接基础公式可按现有面积和节点字段实施。
2. 方案一影响域面积冲突必须在 data audit 中保留，不能静默改值。
3. 四方案缺少 corridors 和逐设施 records，因此真实 Wf、FE、LA、FLI 在生产数据上必须返回 warnings/notEvaluable；测试通过显式样例验证公式。
4. v2 结果不得为匹配旧 JSON 而调整公式、归一化或权重。
