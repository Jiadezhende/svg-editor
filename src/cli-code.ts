import stats from '../plugins/stats/index';
import statsManifest from '../plugins/stats/package.json' with { type: 'json' };
import dir from '../plugins/dir/index';
import dirManifest from '../plugins/dir/package.json' with { type: 'json' };
import star from '../plugins/modified-star/index';
import starManifest from '../plugins/modified-star/package.json' with { type: 'json' };
import core from '../plugins/core/index';
import coreManifest from '../plugins/core/package.json' with { type: 'json' };
import { createAssembler, readPluginManifest } from './bootstrap';
import { runCli } from './runCli';

const assembler = createAssembler((message) => { process.stderr.write(`${message}\n`); });
assembler.registerPlugin(readPluginManifest(coreManifest), core);
assembler.registerPlugin(readPluginManifest(statsManifest), stats);
assembler.registerPlugin(readPluginManifest(dirManifest), dir);
assembler.registerPlugin(readPluginManifest(starManifest), star);
await runCli(assembler.getAssemblyResult().client);
