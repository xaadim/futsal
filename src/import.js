// Reprise Supabase -> D1. Produit le SQL d'import (une instruction par ligne)
// et les codes d'activation des comptes créés. Fonctionne dans Workers et Node.
const TEAMS = ['jaune', 'orange', 'vert', 'bleu'];
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const sha = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, '0')).join('');
const norm = (c) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
const newCode = () => {
  let s = '';
  crypto.getRandomValues(new Uint8Array(10)).forEach((x, i) => { s += ALPHA[x % 32]; if (i === 4) s += '-'; });
  return s;
};
const v = (x) => (x == null ? 'NULL' : typeof x === 'number' ? String(Math.trunc(x)) : `'${String(x).replace(/[\r\n]+/g, ' ').replace(/'/g, "''")}'`);

export async function fetchSupabase(url, key) {
  const get = async (t) => {
    const all = [];
    for (let off = 0; ; off += 1000) {
      const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1000&offset=${off}`, { headers: { apikey: key } });
      if (!r.ok) throw new Error(`Supabase ${t}: HTTP ${r.status}`);
      const rows = await r.json();
      all.push(...rows);
      if (rows.length < 1000) return all;
    }
  };
  const [players, sessions, matches] = await Promise.all([get('players'), get('sessions'), get('matches')]);
  return { players, sessions, matches };
}

export async function buildImport({ players = [], sessions = [], matches = [], skip = [] }) {
  const out = [];
  const codes = [];
  const now = Date.now();
  const seen = new Set(skip.map((x) => String(x).trim().toLowerCase()));
  for (const p of players) {
    const name = String(p.name || '').trim().slice(0, 30);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const c = newCode();
    codes.push({ name, code: c });
    out.push(`INSERT OR IGNORE INTO users (name, role, level, code_hash, created_at) VALUES (${v(name)}, 'player', 3, ${v(await sha(norm(c)))}, ${now});`);
  }
  let maxId = 0;
  const known = new Set();
  for (const s of [...sessions].sort((a, b) => a.id - b.id)) {
    maxId = Math.max(maxId, s.id);
    known.add(s.id);
    let teams = s.teams;
    if (typeof teams === 'string') { try { teams = JSON.parse(teams); } catch { teams = {}; } }
    const clean = {};
    for (const k of TEAMS) if (teams && Array.isArray(teams[k])) clean[k] = teams[k].map(String);
    out.push(`INSERT OR IGNORE INTO sessions (id, date, host_user, teams, live, status, max, created_at) VALUES (${s.id}, ${v(s.date)}, 0, ${v(JSON.stringify(clean))}, NULL, 'ended', ${s.max || 12}, ${now});`);
  }
  // Matchs sans session : une session « historique » par date
  const synth = new Map();
  const used = new Set();
  let n = 0;
  for (const m of [...matches].sort((a, b) => a.ts - b.ts)) {
    let sid = m.session_id;
    if (!known.has(sid)) {
      if (!synth.has(m.date)) {
        synth.set(m.date, ++maxId);
        out.push(`INSERT OR IGNORE INTO sessions (id, date, host_user, teams, live, status, max, created_at) VALUES (${maxId}, ${v(m.date)}, 0, '{}', NULL, 'ended', 12, ${now});`);
      }
      sid = synth.get(m.date);
    }
    let ts = m.ts;
    while (used.has(`${sid}:${ts}`)) ts++;
    used.add(`${sid}:${ts}`);
    out.push(`INSERT OR IGNORE INTO matches (${m.id != null ? 'id, ' : ''}ts, date, a, b, sa, sb, session_id) VALUES (${m.id != null ? m.id + ', ' : ''}${ts}, ${v(m.date)}, ${v(m.a)}, ${v(m.b)}, ${m.sa}, ${m.sb}, ${sid});`);
    n++;
  }
  return { sql: out.join('\n'), codes, stats: { joueurs: codes.length, sessions: known.size, sessionsHistoriques: synth.size, matchs: n } };
}
