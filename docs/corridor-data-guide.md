# 连廊数据采集与 Wf/TLEI 填写指南

适用公式版本：`research-formula-v2`  
数据模板：`data/corridor-data-template.json`

## 1. 数据使用原则

连接数据按以下优先级使用：

1. `verified: true` 的逐条 `corridors[]`；
2. `verified: true` 的 `corridorAreaByWidthClass[]` 宽度区间面积汇总；
3. `representative-width-estimate` 典型7m连廊专业估算，默认 `Wf=1.20`；
4. `legacyWf`，只用于历史对照。

前两种模式是已核验数据。没有已核验数据时，系统使用典型7m常规连廊估算，明确标记为 `estimated`、`verified=false`，并代入不变的研究公式生成 TLEI。未核验逐条或区间汇总不会覆盖估算值；未来实测数据核验后会自动取得更高优先级。

## 2. 从 Rhino 获取数据

推荐流程：

1. 按方案和标高整理连廊图层，例如地下、地表、空中。
2. 确认每条连廊的中心线或有效通行边界，排除建筑内部非公共通道。
3. 使用 `Length` 获取中心线长度，单位统一为 m。
4. 从有效通行边界量取净宽。宽度变化明显的连廊应拆成多段，不能用最大宽度代表全段。
5. 若已有封闭面，可用 `Area` 获取面积，并检查 Rhino 文件单位。
6. 导出 CSV，保留对象 ID、图层、标高、长度、宽度、面积和来源文件名。
7. 人工复核后将 `verified` 改为 `true`。

若 Rhino 面积与 `length × width` 不一致，系统会按提供的 area 计算并产生 warning。应在 `dataSource` 或外部审计记录中说明异形连廊、局部拓宽等原因。

## 3. 从 CAD 获取数据

1. 确认图纸单位，统一转换为 m 和㎡。
2. 用多段线长度或 `LIST`/属性面板获取连廊长度。
3. 从有效通行边界量取净宽，不使用结构轴线宽度代替净宽。
4. 对宽度变化的通道分段编号。
5. 有闭合边界时读取 Hatch/Polyline Area；没有可靠面积时留空，由系统计算 `length × width`。
6. 通过数据提取功能或人工表格导出每条记录，并保存图纸编号、版本日期和图层作为 `dataSource`。

## 4. 从 Excel 整理数据

建议列：

| 列 | 必填 | 说明 |
|---|---|---|
| id | 是 | 方案内唯一编号 |
| name | 是 | 可读名称 |
| level | 是 | underground / ground / upper |
| elevation | 是 | 标高，单位m |
| length | 是 | 长度，单位m |
| width | 是 | 有效净宽，单位m |
| area | 否 | 面积，单位㎡；空白时自动计算 |
| coefficient | 否 | 可用于复核，但不能覆盖宽度自动系数 |
| dataSource | 建议 | 图纸、模型、表格或测量来源 |
| verified | 是 | 复核通过后填 true |

不要把空白单元格转换为0。尚未获得的数据应保持 `null`，尚未核验的记录必须保持 `verified: false`。

## 5. corridors 填写方式

结构：

```json
{
  "id": "真实记录编号",
  "name": "真实连廊名称",
  "level": "underground | ground | upper",
  "elevation": null,
  "length": null,
  "width": null,
  "area": null,
  "coefficient": null,
  "dataSource": "真实数据来源",
  "verified": false
}
```

规则：

- `area` 未提供时，系统自动使用 `length × width`。
- 系数始终按 width 自动确定。
- 如果手工 coefficient 与自动结果不一致，系统返回 warning，并采用自动结果。
- 只有 `verified: true` 的记录进入正式研究计算。

宽度分段：

| 有效净宽 | 系数 |
|---|---:|
| width < 2.0m | 0.5 |
| 2.0m ≤ width < 3.5m | 0.8 |
| 3.5m ≤ width < 5.0m | 1.0 |
| 5.0m ≤ width ≤ 7.0m | 1.2 |
| width > 7.0m | 1.4 |

## 6. 宽度区间汇总模式

无法获得逐条几何数据，但能从 CAD/GIS/统计表获得各宽度区间总面积时，可填写：

```json
{
  "range": "2.0m ≤ width < 3.5m",
  "area": null,
  "coefficient": 0.8,
  "dataSource": "真实汇总表或图纸来源"
}
```

每个区间只填写真实统计面积。Wf 仍按下式计算：

```text
Wf = Σ(A_i×C_i) / ΣA_i
```

汇总模式可生成正式研究 Wf，但不能提供逐条连廊的名称、标高和空间追溯能力。报告中必须标明 `inputMode=width-class-summary`。

## 7. 为什么旧 Wf=1.4 不能作为正式结果

旧平台只保存了人工最终值，没有提供对应的连廊长度、宽度、面积和核验来源。无法判断该值是否代表全部连廊、仅代表最宽连廊，或是否包含旧平台的其他修正。因此：

- `legacyWf=1.4` 可以保留历史比较；
- 不得用它生成正式 `TLEI_research`；
- 不得用旧 TLEI 反推或修改研究公式；
- 当前产品原型的正式展示 Wf 使用明确标注的典型7m专业估算；取得已核验明细或宽度区间面积后必须由真实面积加权结果覆盖。

## 8. 典型7m连廊专业估算

短期不等待模型逐条复核时，四方案统一采用典型常规连廊宽度7m。按正式宽度分段，`5.0m≤width≤7.0m` 对应效率系数1.2，因此：

```text
representativeWidth = 7m
Wf = 1.20
dataStatus = estimated
verified = false
```

这一统一假设用于求职展示和产品原型，并控制四方案的连廊宽度变量。方案差异主要来自覆盖范围、连接节点、层阶度和楼层连通率；不得据此宣称某方案连廊宽度质量更优。后续取得 Rhino/CAD 数据后，使用已核验逐条面积加权或区间面积汇总覆盖估算值。

## 9. 两种 TLEI 的区别

正式研究公式：

```text
TLEI_research = sqrt(Wf×HCI×VCI)
```

旧平台兼容公式：

```text
TLEI_legacy = Wf×sqrt(HCI×VCI)
```

两者只改变 Wf 在平方根内外的位置。系统同时返回二者，但综合评价只使用正式 `TLEI_research`。`TLEI_legacy` 只用于说明外部团队原平台历史结果与本人自研 Demo 的差异。

## 10. 导入前检查清单

- 所有长度单位已转换为m；
- 所有面积单位已转换为㎡；
- 宽度为有效净宽；
- 宽度变化段已拆分；
- 每条记录有唯一ID；
- `level` 和 `elevation` 已核对；
- `dataSource` 可追溯；
- 只有复核完成的记录标记为 `verified: true`；
- 没有把缺失值填成0；
- 没有用旧Wf替代真实明细。
