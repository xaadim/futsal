import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatchEdit } from '../src/matchEdit.js';

const match = { a: 'jaune', b: 'vert' };

test('accepte un score corrigé avec ses buteurs', () => {
  const r = normalizeMatchEdit(match, { sa: 3, sb: 1, goals: [
    { team: 'jaune', p: 'Ali' }, { team: 'jaune', p: 'Ali' }, { team: 'vert', p: '', og: 1 },
  ] });
  assert.equal(r.error, undefined);
  assert.deepEqual([r.sa, r.sb, r.goals.length], [3, 1, 3]);
  assert.equal(r.goals[2].p, '');
  assert.equal(r.goals[2].og, 1);
});

test('refuse un score invalide', () => {
  for (const sa of [-1, 100, 1.5, '2', null, undefined]) assert.equal(normalizeMatchEdit(match, { sa, sb: 0 }).error, 'score');
  assert.equal(normalizeMatchEdit(match, null).error, 'score');
});

test('refuse plus de buteurs que de buts', () => {
  assert.equal(normalizeMatchEdit(match, { sa: 1, sb: 0, goals: [{ team: 'jaune', p: 'A' }, { team: 'jaune', p: 'B' }] }).error, 'buteurs');
  assert.equal(normalizeMatchEdit(match, { sa: 2, sb: 0, goals: [{ team: 'vert', p: 'A' }] }).error, 'buteurs');
});

test('ignore les buteurs d\'une équipe étrangère au match et accepte moins de buteurs que de buts', () => {
  const r = normalizeMatchEdit(match, { sa: 2, sb: 2, goals: [{ team: 'bleu', p: 'X' }, { team: 'jaune', p: 'Ali' }, null] });
  assert.equal(r.goals.length, 1);
  assert.equal(r.goals[0].team, 'jaune');
});
