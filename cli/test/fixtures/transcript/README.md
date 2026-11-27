# CLI 回放样例

这些文件由 `cli/scripts/verify-transcripts.mjs` 使用。脚本分别启动配置装配和代码装配，比较标准输出与保存的 SVG；`phase1` 组还会与 `final` 标签中的实际程序输出逐字节比较。

| 文件 | 场景 | 说明 |
| --- | --- | --- |
| `phase1.txt` / `phase1.out` / `phase1.plugins.json` | Phase 1 基础会话 | 只装配 `core`，覆盖六种图形与基础命令；结果与 `final` 一致。配置中的模块路径相对本目录。 |
| `box.txt` / `box.out` | Box 会话 | 完整配置，覆盖复合图形的创建、嵌套、属性、保存与读回。 |
| `commands.txt` / `commands.out` | 查询命令会话 | 覆盖 `stats`、`dir` 及其与文档、撤销历史的关系。 |
| `other.svg` | 外部 SVG 读入样例 | 脚本把它复制到临时工作目录，供基础会话读取。 |

## 使用

```bash
cd cli
npm run verify:transcripts
```

## 录制

```bash
cd cli
node scripts/verify-transcripts.mjs --record
```

`.out` 是期望输出，不应手工编辑。修改 CLI 输出后重新录制，并审查生成差异；`phase1.out` 还会与 `final` 基线比较，不能随意改动。
