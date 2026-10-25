import { balance } from './balance.js';
import { buildImport, fetchSupabase } from './import.js';

// Supabase (clés publiques) : surchargeables par les variables SUPABASE_URL / SUPABASE_KEY
const SB_URL = 'https://fuaihkklnygbbiketvjb.supabase.co';
const SB_KEY = 'sb_publishable_gpkEUB2YbT1Q6jGO3AoUPQ_EpH6CpZQ';

const TEAMS = ['jaune', 'orange', 'vert', 'bleu'];
const YEAR = 31536000;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const newCode = () => {
  let s = '';
  crypto.getRandomValues(new Uint8Array(10)).forEach((x, i) => { s += ALPHA[x % 32]; if (i === 4) s += '-'; });
  return s;
};
const cookie = (t, age) => `fsid=${t}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
const J = (o, s = 200, h = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...h } });
const bad = (s, e) => J({ error: e }, s);
const lvl = (x) => Math.min(5, Math.max(1, parseInt(x, 10) || 3));

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const p = u.pathname.split('/').filter(Boolean);
    if (p[0] !== 'api') return new Response('Not found', { status: 404 });
    try {
      return await route(req, env, u, p);
    } catch (e) {
      console.error(e);
      return bad(500, 'server');
    }
  },
};

async function route(req, env, u, p) {
  const DB = env.DB;
  const m = req.method;
  const r = p[1];
  const q = (s, ...a) => DB.prepare(s).bind(...a);
  const bump = () => q('UPDATE meta SET v = v + 1');
  const body = () => req.json().catch(() => ({}));
  if (m !== 'GET' && !(req.headers.get('content-type') || '').includes('json')) return bad(415, 'type');

  // L'application affiche le formulaire de première installation tant qu'il n'y a aucun admin
  if (r === 'setup' && m === 'GET') {
    return J({ needsAdmin: (await q("SELECT COUNT(*) c FROM users WHERE role = 'admin'").first()).c === 0 });
  }

  // Premier admin : une seule fois, protégé par le secret SETUP_KEY
  if (r === 'bootstrap' && m === 'POST') {
    const b = await body();
    if (!env.SETUP_KEY || b.key !== env.SETUP_KEY) return bad(403, 'key');
    if ((await q("SELECT COUNT(*) c FROM users WHERE role = 'admin'").first()).c > 0) return bad(409, 'deja-installe');
    const code = newCode();
    await DB.batch([
      q('INSERT INTO users (name, role, level, code_hash, created_at) VALUES (?, ?, ?, ?, ?)',
        String(b.name || 'Admin').trim().slice(0, 30), 'admin', 3, await sha(norm(code)), Date.now()),
      bump(),
    ]);
    return J({ code });
  }

  // Connexion avec le code d'activation
  if (r === 'login' && m === 'POST') {
    const ip = req.headers.get('CF-Connecting-IP') || 'local';
    const now = Date.now();
    const n = (await q('SELECT COUNT(*) c FROM attempts WHERE ip = ? AND ts > ?', ip, now - 600000).first()).c;
    if (n >= 10) return bad(429, 'trop-essais');
    const b = await body();
    const us = await q('SELECT id, name, role FROM users WHERE code_hash = ?', await sha(norm(b.code))).first();
    if (!us) {
      await q('INSERT INTO attempts (ip, ts) VALUES (?, ?)', ip, now).run();
      await q('DELETE FROM attempts WHERE ts < ?', now - 3600000).run();
      return bad(401, 'code');
    }
    const tok = hex(crypto.getRandomValues(new Uint8Array(32)));
    await q('INSERT INTO devices (token_hash, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)', await sha(tok), us.id, now, now).run();
    return J({ me: us }, 200, { 'Set-Cookie': cookie(tok, YEAR) });
  }

  // Tout le reste exige d'être connecté
  const tok = (req.headers.get('Cookie') || '').match(/(?:^|; )fsid=([a-f0-9]{64})/)?.[1];
  const th = tok ? await sha(tok) : null;
  const row = th
    ? await q('SELECT u.id, u.name, u.role, d.last_seen ls FROM devices d JOIN users u ON u.id = d.user_id WHERE d.token_hash = ?', th).first()
    : null;
  if (!row) return bad(401, 'auth');
  const me = { id: row.id, name: row.name, role: row.role };
  let renew = null;
  if (Date.now() - row.ls > 86400000) {
    await q('UPDATE devices SET last_seen = ? WHERE token_hash = ?', Date.now(), th).run();
    renew = cookie(tok, YEAR);
  }
  const res = await authed();
  if (renew) res.headers.append('Set-Cookie', renew);
  return res;

  async function authed() {
    const admin = me.role === 'admin';

    if (r === 'logout' && m === 'POST') {
      await q('DELETE FROM devices WHERE token_hash = ?', th).run();
      return J({ ok: 1 }, 200, { 'Set-Cookie': cookie('x', 0) });
    }

    if (r === 'state' && m === 'GET') {
      const v = (await q('SELECT v FROM meta').first()).v;
      const used = (await q('SELECT (SELECT COUNT(*) FROM matches) + (SELECT COUNT(*) FROM sessions) c').first()).c;
      const imported = await q("SELECT value FROM app_settings WHERE name = 'supabase_imported'").first();
      const canImportSupabase = imported?.value !== '1' && used === 0;
      if (u.searchParams.get('v') === String(v)) return J({ v, same: true, canImportSupabase });
      const users = (await q('SELECT id, name, role, level FROM users ORDER BY name COLLATE NOCASE').all()).results
        .map((x) => (admin ? x : { id: x.id, name: x.name }));
      const sessions = (await q(
        "SELECT s.id, s.date, s.host_user, u.name host_name, s.teams, CASE WHEN s.status = 'active' THEN s.live END live, s.status, s.max " +
        'FROM sessions s LEFT JOIN users u ON u.id = s.host_user ORDER BY s.id').all()).results
        .map((s) => ({ ...s, teams: JSON.parse(s.teams), live: s.live ? JSON.parse(s.live) : null }));
      const matches = (await q('SELECT id, ts, date, a, b, sa, sb, session_id FROM matches ORDER BY ts').all()).results;
      const goals = (await q('SELECT match_id, team, player p, own_goal og FROM goals ORDER BY id').all()).results;
      return J({ v, me, users, sessions, matches, goals, canImportSupabase });
    }

    // Générateur d'équipes équilibrées (les niveaux restent côté serveur)
    if (r === 'teams' && p[2] === 'generate' && m === 'POST') {
      const b = await body();
      const names = (Array.isArray(b.names) ? b.names : []).slice(0, 40).map((x) => String(x).slice(0, 30));
      const k = Math.min(3, Math.max(2, parseInt(b.k, 10) || 2));
      const rows = (await q(`SELECT name, level FROM users WHERE name IN (${names.map(() => '?').join(',') || "''"})`, ...names).all()).results;
      const lv = Object.fromEntries(rows.map((x) => [x.name, x.level]));
      return J({ teams: balance(names.map((n) => ({ name: n, level: lv[n] || 3 })), k) });
    }

    if (r === 'session' && m === 'POST') {
      const b = await body();
      if (p[2] === 'start') {
        const tm = b.teams;
        if (!tm || typeof tm !== 'object' || Array.isArray(tm)) return bad(400, 'equipes');
        const ks = Object.keys(tm);
        const date = typeof b.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(b.date)
          ? new Date(`${b.date}T00:00:00Z`) : null;
        if (ks.length < 2 || ks.length > 3 || ks.some((k) => !TEAMS.includes(k)) ||
          !date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== b.date) return bad(400, 'equipes');
        if (ks.some((k) => !Array.isArray(tm[k]) || tm[k].length > 30 ||
          tm[k].some((name) => typeof name !== 'string' || !name.trim() || name.trim().length > 30))) return bad(400, 'joueurs');
        const names = ks.flatMap((k) => tm[k].map((name) => name.trim()));
        if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) return bad(400, 'joueurs');
        if (names.length) {
          const known = (await q(`SELECT name FROM users WHERE name IN (${names.map(() => '?').join(',')})`, ...names).all()).results;
          if (known.length !== names.length) return bad(400, 'joueurs');
        }
        const clean = {};
        ks.forEach((k) => { clean[k] = tm[k].map((name) => name.trim()); });
        try {
          const x = await DB.batch([
            q('INSERT INTO sessions (date, host_user, teams, live, created_at) VALUES (?, ?, ?, ?, ?)',
              b.date, me.id, JSON.stringify(clean), JSON.stringify(b.live || null), Date.now()),
            bump(),
          ]);
          return J({ id: x[0].meta.last_row_id });
        } catch (e) {
          return bad(409, 'session-en-cours');
        }
      }
      if (p[2] === 'live') {
        const x = await DB.batch([
          q("UPDATE sessions SET live = ? WHERE id = ? AND host_user = ? AND status = 'active'", JSON.stringify(b.live || null), b.id, me.id),
          bump(),
        ]);
        return x[0].meta.changes ? J({ ok: 1 }) : bad(403, 'organisateur');
      }
      if (p[2] === 'end') {
        const s = await q('SELECT host_user FROM sessions WHERE id = ?', b.id).first();
        if (!s || (s.host_user !== me.id && !admin)) return bad(403, 'droits');
        await DB.batch([q("UPDATE sessions SET status = 'ended' WHERE id = ?", b.id), bump()]);
        return J({ ok: 1 });
      }
    }

    // Enregistrement d'un match : uniquement par l'organisateur de la session
    if (r === 'match' && m === 'POST') {
      const b = await body();
      const s = await q('SELECT * FROM sessions WHERE id = ?', b.sid).first();
      if (!s || s.host_user !== me.id) return bad(403, 'organisateur');
      if (await q('SELECT 1 x FROM matches WHERE session_id = ? AND ts = ?', s.id, b.ts).first()) return J({ ok: 1, dup: 1 });
      if (s.status !== 'active') return bad(409, 'session-terminee');
      const tm = JSON.parse(s.teams);
      const okScore = [b.sa, b.sb].every((x) => Number.isInteger(x) && x >= 0 && x < 100);
      if (!(b.a in tm) || !(b.b in tm) || b.a === b.b || !okScore || !Number.isInteger(b.ts)) return bad(400, 'match');
      const n = (await q('SELECT COUNT(*) c FROM matches WHERE session_id = ?', s.id).first()).c;
      if (n >= s.max) return bad(409, 'limite');
      const gl = (Array.isArray(b.goals) ? b.goals : []).slice(0, 60).filter((g) => g && (g.team === b.a || g.team === b.b));
      if (gl.some((g) => g.p != null && typeof g.p !== 'string' ||
        (typeof g.p === 'string' && g.p.trim() && !tm[g.team].includes(g.p.trim())))) return bad(400, 'buteur');
      const st = [
        q('INSERT INTO matches (ts, date, a, b, sa, sb, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)', b.ts, s.date, b.a, b.b, b.sa, b.sb, s.id),
        ...gl.map((g) => q('INSERT INTO goals (match_id, team, player, own_goal) VALUES ((SELECT id FROM matches WHERE session_id = ? AND ts = ?), ?, ?, ?)',
          s.id, b.ts, g.team, String(g.p || '').trim().slice(0, 30), g.og ? 1 : 0)),
        bump(),
      ];
      if (n + 1 >= s.max) st.push(q("UPDATE sessions SET status = 'ended' WHERE id = ?", s.id));
      try {
        await DB.batch(st);
      } catch (e) {
        if (await q('SELECT 1 x FROM matches WHERE session_id = ? AND ts = ?', s.id, b.ts).first()) return J({ ok: 1, dup: 1 });
        throw e;
      }
      return J({ ok: 1 });
    }

    // --- Administration ---
    if (r === 'import-supabase' && m === 'POST') {
      if (!admin) return bad(403, 'admin');
      const used = (await q('SELECT (SELECT COUNT(*) FROM matches) + (SELECT COUNT(*) FROM sessions) c').first()).c;
      const imported = await q("SELECT value FROM app_settings WHERE name = 'supabase_imported'").first();
      if (used > 0 || imported?.value === '1') return bad(409, 'base-non-vide');
      let data;
      try { data = await fetchSupabase(env.SUPABASE_URL || SB_URL, env.SUPABASE_KEY || SB_KEY); } catch (e) { return bad(502, 'supabase'); }
      const have = (await q('SELECT name FROM users').all()).results.map((x) => x.name);
      const { sql, codes, stats } = await buildImport({ ...data, skip: have });
      if (sql) await DB.exec(sql);
      await DB.batch([q("UPDATE app_settings SET value = '1' WHERE name = 'supabase_imported'"), bump()]);
      return J({ codes, stats });
    }
    if (r === 'matches' && m === 'DELETE') {
      if (!admin) return bad(403, 'admin');
      await DB.batch([q('DELETE FROM goals WHERE match_id = ?', +p[2]), q('DELETE FROM matches WHERE id = ?', +p[2]), bump()]);
      return J({ ok: 1 });
    }

    if (r === 'users') {
      if (!admin) return bad(403, 'admin');
      if (m === 'POST' && !p[2]) {
        const b = await body();
        const name = String(b.name || '').trim().slice(0, 30);
        if (!name) return bad(400, 'nom');
        const code = newCode();
        try {
          const x = await DB.batch([
            q('INSERT INTO users (name, role, level, code_hash, created_at) VALUES (?, ?, ?, ?, ?)',
              name, b.role === 'admin' ? 'admin' : 'player', lvl(b.level), await sha(norm(code)), Date.now()),
            bump(),
          ]);
          return J({ id: x[0].meta.last_row_id, name, code });
        } catch (e) {
          return bad(409, 'nom-existant');
        }
      }
      const id = +p[2];
      if (m === 'POST' && p[3] === 'code') {
        const code = newCode();
        await DB.batch([
          q('UPDATE users SET code_hash = ? WHERE id = ?', await sha(norm(code)), id),
          q('DELETE FROM devices WHERE user_id = ? AND token_hash <> ?', id, th),
          bump(),
        ]);
        return J({ code });
      }
      if (m === 'PATCH') {
        const b = await body();
        const sets = [];
        const a = [];
        if (b.level != null) { sets.push('level = ?'); a.push(lvl(b.level)); }
        if (b.role) {
          if (id === me.id && b.role !== 'admin') return bad(400, 'soi-meme');
          sets.push('role = ?'); a.push(b.role === 'admin' ? 'admin' : 'player');
        }
        if (!sets.length) return bad(400, 'rien');
        await DB.batch([q(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...a, id), bump()]);
        return J({ ok: 1 });
      }
      if (m === 'DELETE') {
        if (id === me.id) return bad(400, 'soi-meme');
        if (await q("SELECT 1 x FROM sessions WHERE host_user = ? AND status = 'active'", id).first()) return bad(409, 'session-active');
        await DB.batch([q('DELETE FROM devices WHERE user_id = ?', id), q('DELETE FROM users WHERE id = ?', id), bump()]);
        return J({ ok: 1 });
      }
    }
    return bad(404, 'inconnu');
  }
}
