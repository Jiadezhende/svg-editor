# ADR 4 · 插件激活返回贡献，宿主统一接纳

代码装配对已分类的贡献继续调用 `registerPlugin(manifest, contributions)`。配置装配解析模块，从所属包的 `package.json` 取得清单，把入口默认导出的同步 `activate(options)` 和选项交给同一个方法。代码装配同样可传激活函数。宿主仅需取得一份分类贡献，无需为每类扩展提供独立的写入接口。

宿主验证清单字段，再执行入口激活、比较声明及实际名称集合、校验候选会话。清单名称包含每种类别的贡献集合，同包多个互斥命令形式可以共享命令名。候选失败时丢弃整包，已接纳的会话和后续插件继续可用。候选回滚的范围仅涵盖返回的贡献和宿主会话。

解析与求值分开，以顶层模块能否解析来识别 `plugin not found`。已找到包的入口或依赖求值失败报告 `plugin failed to load`，入口缺默认导出单独报告。配置结构错误启用 Core 后继续启动。 [代码装配](../../cli/src/cli-code.ts) [配置加载](../../cli/src/pluginConfig.ts) [宿主验收测试](../../cli/test/host/PluginConfig.test.ts)
