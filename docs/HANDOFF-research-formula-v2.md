# research-formula-v2 阶段交接说明

封版日期：2026-07-15  
工作分支：`research-formula-v2`  
公式版本：`research-formula-v2`  
公式依据：人工确认的研究数学规范；旧 JSON 展示值仅用于差异审计。

## 1. 当前已实现功能

- 四方案参数驱动计算：修改并保存参数后，重新计算容量、连接和设施模块。
- 公式配置化：有效系数、设施权重、活动/运营评分、理想配比、连廊宽度系数及展示分参考值统一由 `config/formula-presets.json` 提供。
- 研究计算过程：结果面板可查看输入值、中间值、公式、最终值、中文解释及公式版本。
- 研究值分层展示：明确区分研究原始指标、归一化展示评分和旧平台展示值。
- 数据校验：空值、负数、权重和、容积率、面积关系、系统数、连廊及设施样本异常均返回中文 errors 或 warnings。
- 方案对比：展示四方案核心指标；研究数据不完整时保持 `notEvaluable`，不生成虚假综合评分或推荐方案。
- TLEI 口径切换：连接模块支持 `ppt-research` 与 `legacy-platform`，并保留两种结果用于审计。
- 作品集展示能力：模型图片、占位兜底、计算过程、面试展示模式和 HTML 评估报告导出均可使用。
- 版本保护：`js/calculations.research-demo-v1.js` 保留升级前快照，v2 实现位于 `js/calculations.js`。

## 2. 三组公式正式口径

### 2.1 基面容量

```text
p_i = A_i / ΣA_i
D = 1 - sqrt(Σ((w_i-p_i)^2)/n)
A_i_10k = A_i_m2 / 10000
A_effective_10k = Σ(A_i_10k×N_i)
C = (A_effective_10k×D)/R
```

- D 限制在 0-1；权重和必须为 1，默认禁止静默归一化。
- 输入面积为㎡，C 计算时显式转换为万㎡。
- R 位于分母；v2 不使用 `A_reference`。
- 当前项目理想权重 `w_i` 继续从 `schemes.json` 读取，不由 preset 覆盖。

### 2.2 立体连接效率

```text
MPR = P/A
MCI = N×10000/S                         [个/万㎡]
HCI = MPR×MCI
MLI = S/P
MSCR = ΣF_i/N_sys                       [层单位/连续系统]
VCI = MLI×MSCR
W_f = Σ(A_corridor_i×C_i)/ΣA_corridor_i
```

- HCI、VCI 使用研究原始量，不在公式内部增加归一化。
- Wf 必须由逐连廊长度、宽度和面积实时计算；旧 `corridorWidthFactor` 不进入研究公式。
- 人工 F_i 优先；没有人工值时按 preset 的地上 4000㎡、地下 2000㎡基准向上取整，二者不得重复累计。

### 2.3 设施布局

```text
1 VM = 100㎡
n_ij = effectiveAreaM2/100
UI_ij = activityScore×operationScore
FE = Σ_i[(Σ_j(n_ij×f_j×UI_ij))×W_i] / Σ_i(A_i_VM×N_i)
D_func = 1 - sqrt(Σ_j((p_j-p_j_ideal)^2)/4)
D_vert = 1 - sqrt(Σ_iΣ_j((p_ij-p_ij_ideal)^2)/12)
LA = sqrt(D_func×D_vert)
FLI = (FE×LA)/U
```

- 公共空间面积转换为 100㎡模块，以便与设施模块 `n_ij` 保持量纲一致。
- D_func、D_vert、LA 限制在 0-1；FE、FLI 不强制限制在 0-1。
- `displayScore` 仅用于图表展示，不得覆盖 FE、LA、FLI 研究原始值。
- 任一 A1-A4 类型没有样本时，D_vert、LA、FLI 返回 `notEvaluable`，不得以 0 代替。

## 3. TLEI 尚未锁定的两个口径

```text
ppt-research:    TLEI = sqrt(W_f×HCI×VCI)
legacy-platform: TLEI = W_f×sqrt(HCI×VCI)
```

- 当前默认口径为 `ppt-research`，因为它是本阶段收到的 PPT 研究公式。
- `legacy-platform` 仅用于兼容旧平台及识别历史数据口径。
- 四方案旧 TLEI 均更接近 legacy 口径，但仍存在残差，不能据此判定旧平台的完整算法。
- 下一阶段需由研究负责人书面锁定最终发布口径；锁定前必须同时保留两种结果和口径标签。

## 4. 当前已知数据问题

1. 方案一 `influenceArea=1193121.75㎡`，当前 MPR=`0.11361`；旧 MPR 与人工回归基准对应的面积为 `193121.75㎡`。需确认是否多录入前导数字 `1`。
2. 四方案均缺少 `corridors[]`，现有 `corridorWidthFactor=1.4` 只是旧人工值。因此 Wf 和两种 TLEI 均为 `notEvaluable`。
3. 四方案 `facilities[]` 均为空，旧比例仅保存在 `legacyFacilityRatios`。因此 FE、D_vert、LA、FLI 均为 `notEvaluable`。
4. 当前 `connectedFloors` 作为人工统计的 `ΣF_i` 使用；尚无逐连续系统 F_i 数组，无法审计系统内分布。
5. 旧 MCI、MLI、MSCR 与重算值的小偏差主要来自旧值舍入；旧结果不能作为修改研究公式的依据。
6. 当前 Git 仓库尚无初始 commit，工作树中的项目文件均显示为未跟踪。封版提交前应排除 `.DS_Store` 并明确首个基线提交范围。

## 5. 设施数据仍缺少的字段

每条逐设施记录必须提供：

```json
{
  "baseLevel": "underground | ground | upper",
  "functionalDomain": "dining | cultureEntertainment | retail | sports | park | health | government",
  "activityType": "A1 | A2 | A3 | A4",
  "operationType": "T1 | T2 | T3 | T4",
  "effectiveAreaM2": 0
}
```

- `functionalDomain` 与 `activityType` 是两个独立维度，禁止混用或互相推断。
- `effectiveAreaM2` 应来自可追溯的图纸、GIS、BIM 或人工设施清单。
- 每个方案需覆盖 A1-A4 四类样本，否则垂直布局匹配度不可评价。

## 6. 下一阶段建议

1. 先由数据负责人确认方案一影响域面积，并记录修订依据。
2. 按方案导入逐连廊清单，至少包含 length、width；仅在有可靠统计时提供 area 或 coefficient。
3. 补充每个连续基面系统的人工 F_i，明确其与楼层面积自动换算的互斥关系。
4. 建立逐设施数据模板和字段字典，完成 A1-A4、功能领域、运营时段与垂直层次编码校核。
5. 数据补齐后生成四方案完整研究基准，复核 Wf、TLEI、FE、LA、FLI、综合评分和推荐方案。
6. 由研究负责人锁定 TLEI 正式发布口径，再升级公式版本、规范、测试和报告说明。
7. 建立首个 Git 基线提交，后续所有公式变更必须通过版本号、审计文档和回归测试留痕。

## 7. 禁止回退或擅自修改事项

- 禁止回退到 `research-demo-v1` 公式，或删除 v1 快照和 v2 差异审计。
- 禁止为匹配旧 JSON 展示值而反推、缩放、归一化或修改研究公式。
- 禁止将 C 中的 R 改回乘数，禁止恢复 `A_reference`。
- 禁止将 HCI、VCI 在公式内部额外归一化，或将 MSCR 显示为百分比。
- 禁止使用人工最终 Wf 代替逐连廊实时计算。
- 禁止在未书面锁定前删除任一 TLEI 口径，或隐藏口径差异。
- 禁止静默归一化不合计为 1 的权重；若用户确认归一化，必须在 explanation 和 warnings 留痕。
- 禁止以 0、旧汇总比例或旧平台值填补缺失的 corridors、设施样本和研究指标。
- 禁止混用 `functionalDomain` 与 `activityType`，或对缺少活动类型的设施布局强行评分。
- 禁止用 `displayScore` 覆盖或持久化替代研究原始指标。
- 禁止重复累计人工 F_i 与面积换算楼层单位。
- 任何公式、单位、preset 或数据口径调整，都必须同步更新 `formula-spec.md`、审计文档、README 和自动测试，并升级公式版本。

## 8. 封版校核入口

```bash
node tests/formula-check.js
```

封版前必须同时确认：JavaScript 语法检查通过、全部公式测试通过、`git diff --check` 无空白错误，以及本交接说明与三个审计/规范文档保持一致。
