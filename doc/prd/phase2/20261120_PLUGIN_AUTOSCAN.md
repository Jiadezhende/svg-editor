# 插件贡献自动扫描

- 时间：2026-11-20
- 所属阶段：phase2

## 需求背景

内置 shapes、commands 包原先各自维护一份 `index.ts` 注册表，把类文件再列一遍。新增一个图形、命令、Handler 或装饰器时，除了新增类文件，还要修改这份表；表与类文件可能不一致，属于重复声明。希望把“发现并注册”交给宿主：类文件是实现的唯一来源，宿主扫描后自动注册。

本需求只解决注册表重复，不改变扩展点接口、装配原子性和 `SvgWriter` 的统一写出路径。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 扫描位置 | 领域内核 / 宿主 | 宿主 | 内核不依赖文件系统；扫描结果仍通过公共 ExtensionContext 暂存和校验 |
| contributes 声明 | 删除 / 保留 | 所有包保留，只删 `index.ts` | Phase 2 要求清单声明与 mismatch 报错；类文件作为实现真源，清单作为发布契约 |
| 扫描范围 | 包根目录 / 递归 / 固定类别目录 | 包根目录 `.ts`/`.js`，按文件名排序 | 一个文件一个贡献类，顺序稳定，规则简单；辅助代码放子目录 |
| SVG 映射 | 每类都写 / 仅复合类型 | `SvgWriter` 不变；普通 Shape 无需映射，复合类型可用同模块 named export `mapping` | 普通元素已有统一写出；复合模型的私有部件结构是领域特例 |
| 发现方式 | 包根目录扫描 / 自定义入口 | 统一扫描包根目录 | 所有发现包使用同一注册规则 |
| 扫描失败 | 跳过文件 / 丢弃整包 | 丢弃整包并继续 | 与现有单包原子装配和失败隔离一致 |

## 职责边界

- 负责：宿主读取包清单、扫描包根目录、把扫描结果转换为标准 `ExtensionPlugin`、按文件名稳定排序、沿用既有清单校验和原子装配。
- 不负责：配置注册、白名单、禁用、options；复合模型统一写出协议；领域内核的文件系统访问。这些仍属于后续交付或单独设计。

## Cases 处理策略

| 场景 | 输入 / 前置状态 | 预期行为 / 输出 |
| --- | --- | --- |
| 正常扫描 | 包根目录有默认导出的 Shape/Command/Handler/Decorator | 按文件名排序暂存、校验并注册；命令参与 help |
| 清单包含 `main` | `main` 指向额外入口，包根目录包含有效贡献 | 按根目录中的贡献完成注册，`main` 字段不参与发现 |
| 清单不一致 | `contributes` 与扫描得到的名称集合不同 | 拒绝整包，报告 `error: plugin manifest mismatch: <name> (...)` |
| 非法贡献 | 扫描文件默认导出不是四类贡献之一 | 拒绝整包，报告 `error: plugin failed to load: <name> (...)` |
| 重复名称 | 跨包同类名称重复 | 拒绝后一个包，保留先前有效会话，报告 `error: duplicate registration: <category>/<name>` |
| 复合映射 | Shape 模块另导出 `mapping` | 与默认导出的 Shape 一起注册；没有 mapping 的普通图形不需要写出代码 |
| 空目录 | 发现目录不存在或没有包 | 仅保留 help、undo、redo、exit、quit 五个框架入口 |
| 单包失败 | 加载、扫描、清单或装配任一环节失败 | 丢弃该包全部暂存贡献，继续加载后续包 |

## 接口契约

`package.json`：

- `name`：非空字符串，作为插件标识。
- `contributes`：必填对象，可含 `shapes`、`commands`、`attributes`、`decorators` 名称数组；缺省类别视为空。
- 目录发现读取 `name` 和 `contributes`，`main` 字段不参与发现。

扫描模式：

- 只读取包根目录的 `.ts`、`.mts`、`.js`、`.mjs` 文件，按文件名升序；跳过 `index.*`、`*.d.ts`、`*.test.*`。
- 每个文件必须默认导出一个贡献类；Shape/Command/TreeDecorator 按继承关系识别，Handler 按 `handlerName`、`matches`、`apply`、`display` 静态成员识别。
- Shape 模块可同时 named export `mapping: SvgShapeMapping`，扫描器把它与默认导出的 Shape 配对注册；其他模块的 `mapping` 不参与。
- 扫描结果转换为 `ExtensionPlugin`，仍只调用 `ExtensionContext` 的四个注册方法，不绕过暂存、清单校验和重名检查。

错误前缀沿用现有约定：`error: plugin failed to load`、`error: plugin manifest mismatch`、`error: duplicate registration`、`error: plugin failed to activate`。
