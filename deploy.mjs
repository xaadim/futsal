// Wrapper entry-point : rend la commande `node deploy.mjs preview` disponible depuis
// n'importe quel dossier. Elle redirige vers le script réel situé dans ./scripts/.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const result = spawnSync(process.execPath, [join(process.cwd(), 'scripts', 'deploy.mjs'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd(),
});
process.exit(result.status ?? 0);
