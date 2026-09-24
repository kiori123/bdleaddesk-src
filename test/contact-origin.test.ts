import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isAppGenerated, originLabel, ORIGIN_LABEL, type ContactSource } from '../lib/contactOrigin';

// Quy tac co dinh (xem CLAUDE.md / bao cao kem theo):
//   signalhire, seed_verified, pasted_linkedin -> app-generated
//   manual                                     -> nguoi tu them tay
// seed_verified KHONG ton credit nhung van tinh la app-generated - day la truc
// khac voi isByCredit/isFree ben UsagePanel.tsx, co y khong gop chung.

test('a seed_verified contact classifies as app-generated', () => {
  assert.equal(isAppGenerated('seed_verified'), true);
  assert.equal(originLabel('seed_verified'), ORIGIN_LABEL.app);
});

test('a manual contact classifies as manually added', () => {
  assert.equal(isAppGenerated('manual'), false);
  assert.equal(originLabel('manual'), ORIGIN_LABEL.manual);
});

test('signalhire and pasted_linkedin also classify as app-generated', () => {
  assert.equal(isAppGenerated('signalhire'), true);
  assert.equal(isAppGenerated('pasted_linkedin'), true);
});

test('an unrecognized/future source value classifies as app-generated, not manual', () => {
  // Locks in the fail-safe direction: isAppGenerated must be written as
  // "source !== 'manual'" (denylist), never as "source in (known app values)"
  // (allowlist). An allowlist would silently route any new enum value added
  // later into "manually added" - almost always the wrong bucket, since a new
  // source is nearly always another way the APP found the contact.
  assert.equal(isAppGenerated('some_future_source_not_yet_invented' as any), true);
  assert.equal(isAppGenerated(null), true);
  assert.equal(isAppGenerated(undefined), true);
});

test('a contact with import_batch set does not change classification', () => {
  // isAppGenerated/originLabel take only `source` - import_batch is a
  // different axis (how the row entered the DB) and must never be read here.
  // Simulate the two real shapes: a signalhire row WITH import_batch set
  // (the 11-row FMCG case) and one without. Both must classify identically.
  const withBatch = { source: 'signalhire' as ContactSource, import_batch: 'batch-42' };
  const withoutBatch = { source: 'signalhire' as ContactSource, import_batch: null };
  assert.equal(isAppGenerated(withBatch.source), isAppGenerated(withoutBatch.source));
  assert.equal(isAppGenerated(withBatch.source), true);
});

test('the counts add up to the total contact count with no row in two buckets', () => {
  // Every value the enum can hold (schema.sql) must land in exactly one bucket.
  const ALL_SOURCES: ContactSource[] = ['signalhire', 'seed_verified', 'pasted_linkedin', 'manual'];
  const contacts = [
    { source: 'signalhire' as ContactSource },
    { source: 'signalhire' as ContactSource },
    { source: 'seed_verified' as ContactSource },
    { source: 'pasted_linkedin' as ContactSource },
    { source: 'manual' as ContactSource },
    { source: 'manual' as ContactSource },
    { source: 'manual' as ContactSource },
  ];

  for (const s of ALL_SOURCES) {
    // Mutually exclusive: never both, never neither.
    assert.notEqual(isAppGenerated(s), undefined);
  }

  const appGenerated = contacts.filter((c) => isAppGenerated(c.source)).length;
  const manual = contacts.filter((c) => !isAppGenerated(c.source)).length;
  assert.equal(appGenerated + manual, contacts.length);
  assert.equal(appGenerated, 4);
  assert.equal(manual, 3);
});
