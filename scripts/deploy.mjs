// Déploiement Cloudflare (Workers Builds). La configuration est générée à partir des variables de build :
//   node scripts/deploy.mjs           production : migrations de la base prod puis wrangler deploy
//   node scripts/deploy.mjs preview   branche de test : migrations de la base dev puis wrangler preview
//   ajouter --dry-run : génère les fichiers et simule, sans rien modifier à distance
// Variables de build : D1_DATABASE_ID (prod), D1_DATABASE_ID_DEV (dev), SETUP_KEY (installation, facultative ensuite)
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const preview = process.argv.includes('preview');
const dry = process.argv.includes('--dry-run');
const prodId = process.env.D1_DATABASE_ID;
const devId = process.env.D1_DATABASE_ID_DEV;
const need = preview ? 'D1_DATABASE_ID_DEV' : 'D1_DATABASE_ID';
if (!(preview ? devId : prodId)) {
  console.error(`Variable ${need} manquante (Settings > Build > Variables and secrets).`);
  process.exit(1);
}
const db = (id, name) => [{ binding: 'DB', database_name: name, database_id: id, migrations_dir: 'migrations' }];
const base = () => JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const write = (f, c) => writeFileSync(f, JSON.stringify(c, null, 2));
const vars = process.env.SETUP_KEY ? { SETUP_KEY: process.env.SETUP_KEY } : undefined;
const wrangler = (args) => {
  const r = spawnSync('npx', ['wrangler', ...args], { stdio: 'inherit', env: process.env });
  if (r.status) process.exit(r.status);
};

if (!preview) {
  const cfg = base();
  cfg.d1_databases = db(prodId, 'futsal-prod');
  if (vars) cfg.vars = vars;
  write('wrangler.generated.jsonc', cfg);
  if (dry) wrangler(['deploy', '--dry-run', '--outdir', '.wrangler/dry', '-c', 'wrangler.generated.jsonc']);
  else {
    wrangler(['d1', 'migrations', 'apply', 'DB', '--remote', '-c', 'wrangler.generated.jsonc']);
    wrangler(['deploy', '-c', 'wrangler.generated.jsonc']);
  }
} else {
  // Worker Previews : le bloc « previews » ne reprend rien de la production et pointe vers la base dev
  const cfg = base();
  if (prodId) cfg.d1_databases = db(prodId, 'futsal-prod');
  if (vars) cfg.vars = vars;
  cfg.previews = { d1_databases: db(devId, 'futsal-dev'), ...(vars ? { vars } : {}) };
  write('wrangler.generated.jsonc', cfg);
  // « migrations apply » ne lit que la base du niveau supérieur : fichier dédié pour la base dev
  const mig = base();
  mig.d1_databases = db(devId, 'futsal-dev');
  write('wrangler.migrate-dev.jsonc', mig);
  const branch = (process.env.WORKERS_CI_BRANCH || 'develop').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'develop';
  if (dry) console.log(`Simulation : preview « ${branch} » liée à la base dev ${devId}`);
  else {
    wrangler(['d1', 'migrations', 'apply', 'DB', '--remote', '-c', 'wrangler.migrate-dev.jsonc']);
    wrangler(['preview', '--name', branch, '-c', 'wrangler.generated.jsonc']);
  }
}
