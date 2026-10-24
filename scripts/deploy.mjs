// Déploiement Cloudflare (Workers Builds) :
//   node scripts/deploy.mjs           production : migrations de la base prod + wrangler deploy
//   node scripts/deploy.mjs preview   test (branche develop) : migrations de la base dev + version de prévisualisation
//   ajouter --dry-run pour simuler sans rien modifier à distance
// Variables de build : D1_DATABASE_ID (prod), D1_DATABASE_ID_DEV (dev), SETUP_KEY (installation, facultative après)
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const preview = process.argv.includes('preview');
const dry = process.argv.includes('--dry-run');
const varName = preview ? 'D1_DATABASE_ID_DEV' : 'D1_DATABASE_ID';
const id = process.env[varName];
if (!id) {
  console.error(`Variable ${varName} manquante (Settings > Build > Variables and secrets).`);
  process.exit(1);
}
const cfg = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
cfg.d1_databases = [{ binding: 'DB', database_name: preview ? 'futsal-dev' : 'futsal-prod', database_id: id, migrations_dir: 'migrations' }];
writeFileSync('wrangler.generated.jsonc', JSON.stringify(cfg, null, 2));

const wrangler = (args) => {
  const r = spawnSync('npx', ['wrangler', ...args, '-c', 'wrangler.generated.jsonc'], { stdio: 'inherit', env: process.env });
  if (r.status) process.exit(r.status);
};
const vars = process.env.SETUP_KEY ? ['--var', `SETUP_KEY:${process.env.SETUP_KEY}`] : [];
if (dry) {
  wrangler(['deploy', '--dry-run', '--outdir', '.wrangler/dry', ...vars]);
} else {
  wrangler(['d1', 'migrations', 'apply', 'DB', '--remote']);
  if (preview) wrangler(['versions', 'upload', '--preview-alias', 'dev', ...vars]);
  else wrangler(['deploy', ...vars]);
}
