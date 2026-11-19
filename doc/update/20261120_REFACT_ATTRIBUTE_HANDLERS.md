# 第四批：静态 AttributeHandler 与有序匹配

日期：2026-11-20。按契约与注入、命令接入、公共扩展验收三步实施，每步独立提交。

实现已完成，停在第四批验收点。第一、二步提交分别为 `cd71e73`、`cf2c4fc`；第三步提交包含最终测试、ADR 和计划更新。

## 第一步：契约、注册表与注入（已完成）

- AttributeHandler 描述类的静态 handlerName、matches、apply、display；直接注册类，不实例化。
- AttributeHandlers 只公开 register/resolve，按注册顺序首次匹配。模型、key 和别名的判断全部由 Handler 提供，不建立第二份属性映射。
- 注册检查静态类、非空名称和方法；拒绝同名，类继承的 Function.apply 不视作有效 apply 实现。
- Workspace 必传注册表依赖，宿主提供独立空表；模型、工厂及 Document 不依赖 Handler。
- 公共入口导出契约和注册表，所有现有 Workspace 装配点已显式传入依赖。

验证：npm run typecheck 通过；全量 46 个测试文件、450 个测试通过。覆盖空表、直接注册静态类、无效声明、重复注册、顺序优先、首次命中停止、匹配异常及会话隔离。

## 第二步：SetCommand 与局部恢复（已完成）

- SetCommand 定位原 Shape 后调用 resolve，首个命中使用 Handler.apply/display，零命中使用 Shape.set/display。
- 匹配只读，失败直接传播；匹配完成后保存模型快照，旧值展示、领域修改、新值展示和回显计算统一在 try/catch 内，失败恢复快照，成功后才更新撤销记录。
- 保留输入 key 作为回显名称；display 返回 null 不触发回退。undo 直接恢复快照及保存的旧展示值，redo 再次执行并重新匹配。
- Handler 不参与结构操作，内部部件由所属复合模型 capture 覆盖。Invoker 和历史结构不变。

验证：类型检查通过；全量 47 个测试文件、462 个测试通过。新增 12 个用例覆盖特殊 fill、label/title 别名、普通 Group 不误匹配、默认回退、内部部件整体撤销、部分失败、回显失败、redo 失败重试、匹配失败、null 展示及有效撤销记录保留。框架失败与历史测试通过 Client 执行。

## 第三步：公共扩展验收与文档（已完成）

- PublicExtension 中的静态 MarkerAttributesHandler 只依赖公共入口，直接注册类即可为 Marker 提供 horizontal/left 别名；测试通过内置 set 调用，验证回显和 undo/redo。
- TypeScript 验证静态契约缺少 display 时不能注册；测试静态类构造函数私有，无需实例化。默认宿主保持空 Handler 表，既有 CLI 全量回归不变。
- App 回放验证 Handler 报告 EditorError 后恢复模型，输出 error 并继续 undo/redo；意外程序错误按现有框架规则传播。
- 更新 AGENTS、README 和后续计划；[属性处理器 ADR](../adr/20261120_ATTRIBUTE_HANDLER_CONTRACT.md)明确静态契约、调用位置、顺序优先、别名、错误及局部恢复边界。

最终验证：npm run typecheck 通过；npm test -- --reporter=dot 通过，47 个测试文件、464 个测试通过；git diff --check 通过。与第三批 443 个测试的基线相比，新增 21 个测试。

## 后续与边界

匹配条件和展示必须只读，复合模型 capture 覆盖私有部件。默认路径、文件系统或任意外部对象不属于本批恢复范围。注册表只存有序静态类，不枚举具体属性；模型、Document 和 ShapeFactory 不依赖它。

第四批完成，等待验收。第五批 Parser 与 Shape 解析分离、树装饰及插件发现尚未实施，不提前推进，也不实现正式业务插件。
