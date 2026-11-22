import { createAssembler, readPluginManifest } from './bootstrap';
import { loadPluginConfig } from './pluginConfig';
import { runCli } from './runCli';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--config' || !args[1].trim() || args[1].startsWith('--')) {
  process.stderr.write('usage: npm run cli -- --config <path>\n');
  process.exitCode = 2;
} else {
  const assembler = createAssembler((message) => { process.stderr.write(`${message}\n`); });
  await loadPluginConfig(assembler, args[1], async () => {
    const { default: core } = await import('../plugins/core/index');
    const { default: manifest } = await import('../plugins/core/package.json', { with: { type: 'json' } });
    assembler.registerPlugin(readPluginManifest(manifest), core);
  });
  await runCli(assembler.getAssemblyResult().client);
}
