# 第五批：SVG 编排与模型数据构造

日期：2026-11-20。分三步实施并分别提交：模型数据契约、Reader 复合读回、Writer 校验与整体验收。只使用测试复合模型，不实现正式业务插件。

## 第一步：模型数据契约（已完成）

- Shape.parse(id, attributes, readChildren) 默认复用属性规格解析、默认值及构造校验，返回 ShapeParseResult：shape 和仍应成为文档成员的 children。
- readChildren 由解析器提供，返回已解析的子 Shape；默认叶子不请求，普通容器保留全部成员，特殊模型可消费必要部件并返回剩余成员。模型不接触 XML、ShapeNode 或 Document。
- protected parseValues 供特殊类复用属性解析；Shape.checkId 统一构造与持久化的 id 校验规则。
- ShapeFactory.parse 通过内部类注册表调用可覆写解析能力，create 的已解析属性构造方式不变，definition 不暴露构造或解析函数。

验证：类型检查通过；全量 48 个测试文件、467 个测试通过。测试通过公共入口验证默认解析、叶子不请求递归、容器保留引用和特殊类覆写。

## 后续步骤

Reader 实现类型选择、缓存递归结果、内部部件与文档成员分离及全输入 id 校验；Writer 校验最终映射结果，再完成公共扩展、读写失败和文档验收。
