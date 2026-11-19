# 第四批：静态 AttributeHandler 与有序匹配

日期：2026-11-20。按契约与注入、命令接入、公共扩展验收三步实施，每步独立提交。

## 第一步：契约、注册表与注入（已完成）

- AttributeHandler 描述类的静态 handlerName、matches、apply、display；直接注册类，不实例化。
- AttributeHandlers 只公开 register/resolve，按注册顺序首次匹配。模型、key 和别名的判断全部由 Handler 提供，不建立第二份属性映射。
- 注册检查静态类、非空名称和方法；拒绝同名，类继承的 Function.apply 不视作有效 apply 实现。
- Workspace 必传注册表依赖，宿主提供独立空表；模型、工厂及 Document 不依赖 Handler。
- 公共入口导出契约和注册表，所有现有 Workspace 装配点已显式传入依赖。

验证：npm run typecheck 通过；全量 46 个测试文件、450 个测试通过。覆盖空表、直接注册静态类、无效声明、重复注册、顺序优先、首次命中停止、匹配异常及会话隔离。

## 后续步骤

第二步接入 SetCommand 和局部失败恢复；第三步完成独立公共扩展、契约 ADR 和计划更新，完成后停在第四批验收点。
