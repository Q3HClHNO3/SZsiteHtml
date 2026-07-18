# research-formula-v2 数据审计

审计日期：2026-07-15  
数据粒度：`schemes.json` 中四个方案  
结论：**Needs revision / 可计算容量与连接基础项，但 Wf/TLEI 和设施指标缺少研究级输入。**

## 高优先级冲突

### 1. 方案一影响域面积与旧 MPR 不一致

- 当前输入：P=`135547.10㎡`，A=`1193121.75㎡`，按公式 MPR=`0.11361`。
- 旧 JSON：MPR=`0.70`。
- 人工回归基准：A=`193121.75㎡` 时 MPR=`0.70187`。
- 风险：方案一 HCI、TLEI 将被显著低估。
- 处理：未修改源数据；需人工确认 A 是否多录入前导数字 `1`。
- 严重度：High；置信度：High。

### 2. 四方案均缺少 corridors[]

- 现有字段只有人工最终值 `corridorWidthFactor=1.4`。
- v2 要求 Wf 按每条连廊长度、宽度、面积实时计算。
- 处理：旧 Wf 不参与研究计算；Wf/TLEI 返回 notEvaluable。
- 严重度：High；置信度：High。

### 3. 四方案均缺少逐设施记录

- `facilities[]` 当前均为0条。
- 旧汇总比例已迁移到 `legacyFacilityRatios`，但缺少 `baseLevel`、`functionalDomain`、`activityType`、`operationType`、`effectiveAreaM2`。
- 处理：FE、D_vert、LA、FLI 返回 notEvaluable；不能用旧比例补值。
- 严重度：High；置信度：High。

## 指标一致性检查

| 方案 | MPR 旧/重算 | MCI旧/重算 个/万㎡ | MSCR旧/重算 层单位/系统 | MLI旧/重算 | 旧TLEI更接近* |
|---|---|---|---|---|---|
| 方案一 | 0.70 / **0.11361** | 0.17 / 0.16550 | 6.51 / 6.66667 | 1.34 / 1.33728 | legacy-platform；但受 A 冲突影响 |
| 方案二 | 0.59 / 0.58667 | 0.14 / 0.13959 | 11.88 / 12.00000 | 1.90 / 1.89693 | legacy-platform |
| 方案三 | 0.69 / 0.68846 | 0.13 / 0.12678 | 12.22 / 12.33333 | 1.78 / 1.77972 | legacy-platform |
| 方案三优化 | 0.69 / 0.68846 | 0.12 / 0.11657 | 14.60 / 14.66667 | 1.94 / 1.93567 | legacy-platform |

\* 仅为口径识别，临时使用旧人工 Wf=1.4；不代表该 Wf 满足 v2 数据要求。除方案一外，MPR/MCI/MLI/MSCR 的小偏差主要来自旧值舍入。旧 TLEI 虽普遍更接近 legacy 公式，但仍存在明显残差，不能据此修改研究公式。

## 规则检查

| 检查 | 结果 |
|---|---|
| 权重和是否为1 | 通过：0.5+0.3+0.2=1 |
| 公共空间面积负数或0 | 通过：四方案三层面积均>0 |
| P>A | 四方案均未触发；方案一因 A 可疑而不能视为口径已确认 |
| S<P | 四方案均未触发 |
| `totalBaseArea` 与三层面积合计 | 通过；方案二仅有浮点尾差 |
| N、S 与旧 MCI | 基本一致，旧值为两位小数舍入 |
| Fi、N_sys 与旧 MSCR | 基本一致但非完全相等；需确认旧值是否使用更细 F_i |
| 设施必填字段 | 0/4方案满足；全部缺失逐设施字段 |

## 四方案当前可用性

- 容量 D、有效面积、C：可计算。
- MPR/MCI/HCI/MLI/MSCR/VCI：可计算，但方案一 A 需确认。
- Wf/TLEI：不可计算，缺 corridors。
- FE/D_vert/LA/FLI：不可计算，缺逐设施数据。
- 综合评分与推荐方案：不可计算，避免以缺失值或旧平台值替代。

## 建议补数顺序

1. 确认方案一 influenceArea。
2. 为四方案补充 corridors：length、width、可选 area/coefficient。
3. 提供每个连续系统的 F_i 数组；当前汇总 connectedFloors 可继续作为人工 ΣF_i，但无法审计系统内分布。
4. 导入逐设施清单，并确认 functionalDomain 与 activityType 独立编码。
