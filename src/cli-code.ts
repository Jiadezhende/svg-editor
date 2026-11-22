import core from '../plugins/core/index';
import coreManifest from '../plugins/core/package.json' with { type: 'json' };
import { createAssembler, readPluginManifest } from './bootstrap';
import { runCli } from './runCli';

const assembler = createAssembler((message) => { process.stderr.write(`${message}\n`); });
assembler.registerPlugin(readPluginManifest(coreManifest), core);
await runCli(assembler.getAssemblyResult().client);
