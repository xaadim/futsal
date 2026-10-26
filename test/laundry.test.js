import test from 'node:test';
import assert from 'node:assert/strict';
import { dateInParis, mondayOnOrAfter, nextLaundryDate, projectLaundry, rotateQueue } from '../src/laundry.js';

test('calcule le jour métier dans le fuseau Europe/Paris', () => {
  assert.equal(dateInParis(new Date('2026-10-26T22:30:00Z')), '2026-10-26');
  assert.equal(dateInParis(new Date('2026-10-26T23:30:00Z')), '2026-10-27');
});

test('démarre le jour même si c’est lundi, sinon au lundi suivant', () => {
  assert.equal(mondayOnOrAfter('2026-10-26'), '2026-10-26');
  assert.equal(mondayOnOrAfter('2026-10-27'), '2026-11-02');
});

test('un tour fait avancer la date et envoie le joueur en fin de file', () => {
  assert.equal(nextLaundryDate('2026-10-26'), '2026-11-02');
  assert.deepEqual(rotateQueue([{ id: 1 }, { id: 2 }, { id: 3 }]), [{ id: 2 }, { id: 3 }, { id: 1 }]);
});

test('projette les tours à venir et conserve les validations passées', () => {
  const queue = [{ id: 2, name: 'B' }, { id: 1, name: 'A' }];
  const schedule = projectLaundry('2026-10-26', '2026-11-02', queue, [
    { date: '2026-10-26', user_id: 1, name: 'A', action: 'done' },
  ], 3);
  assert.deepEqual(schedule, [
    { date: '2026-10-26', user_id: 1, name: 'A', action: 'done' },
    { date: '2026-11-02', user_id: 2, name: 'B' },
    { date: '2026-11-09', user_id: 1, name: 'A' },
  ]);
});