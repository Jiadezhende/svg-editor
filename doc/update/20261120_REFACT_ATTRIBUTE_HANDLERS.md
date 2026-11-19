# 第四批：静态 AttributeHandler 与有序匹配

日期：2026-11-20。按契约与注入、命令接入、公共扩展验收三步实施，每步独立提交。

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

## 后续步骤

第三步完成独立公共扩展、契约 ADR 和计划更新，完成后停在第四批验收点。
