// Validation d'une correction de match par un admin : score + buteurs.
// Les buteurs sont facultatifs (« inconnu »), mais il ne peut pas y en avoir plus que de buts.
export function normalizeMatchEdit(match, body) {
  const int = (x) => Number.isInteger(x) && x >= 0 && x < 100;
  if (!body || !int(body.sa) || !int(body.sb)) return { error: 'score' };
  const goals = (Array.isArray(body.goals) ? body.goals : [])
    .slice(0, 60)
    .filter((g) => g && (g.team === match.a || g.team === match.b))
    .map((g) => ({ team: g.team, p: g.og ? '' : String(g.p || '').trim().slice(0, 30), og: g.og ? 1 : 0 }));
  const count = (t) => goals.filter((g) => g.team === t).length;
  if (count(match.a) > body.sa || count(match.b) > body.sb) return { error: 'buteurs' };
  return { sa: body.sa, sb: body.sb, goals };
}
