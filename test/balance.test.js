import test from 'node:test';
import assert from 'node:assert/strict';
import { balance } from '../src/balance.js';

const rng = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

test('balance les niveaux entre équipes et conserve tous les joueurs', () => {
  const players = [
    { name: 'A', level: 4 }, { name: 'B', level: 4 }, { name: 'C', level: 4 },
    { name: 'D', level: 1 }, { name: 'E', level: 1 }, { name: 'F', level: 1 },
  ];
  const teams = balance(players, 3, rng(7));
  const sums = teams.map((team) => team.reduce((sum, name) => sum + players.find((p) => p.name === name).level, 0));
  assert.deepEqual(sums, [5, 5, 5]);
  assert.deepEqual(teams.flat().sort(), players.map((p) => p.name).sort());
});

test('équilibre des joueurs de niveaux extrêmes en deux équipes', () => {
  const players = [
    { name: 'A', level: 4 }, { name: 'B', level: 4 },
    { name: 'C', level: 1 }, { name: 'D', level: 1 },
  ];
  const teams = balance(players, 2, rng(11));
  const sums = teams.map((team) => team.reduce((sum, name) => sum + players.find((p) => p.name === name).level, 0));
  assert.deepEqual(sums, [5, 5]);
});