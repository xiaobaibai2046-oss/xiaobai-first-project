import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker, {trigger} from './worker.mjs';
const env = {GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: 'test-only-placeholder'};
const scheduled = Date.parse('2026-11-02T02:08:00Z');
function mock(runs, {lookupStatus = 200, dispatchStatus = 204} = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, options});
    return calls.length === 1
      ? new Response(JSON.stringify({workflow_runs: runs}), {status: lookupStatus})
      : new Response(null, {status: dispatchStatus});
  };
  return {calls, fetcher};
}
test('dispatches original main workflow when the schedule was missed', async () => {
  const m = mock([{status: 'completed', conclusion: 'success', created_at: '2026-10-30T15:54:00Z'}]);
  assert.equal((await trigger(env, scheduled, m.fetcher)).status, 'dispatched');
  assert.equal(m.calls.length, 2);
  assert.match(m.calls[0].url, /stock-signals.yml\/runs\?branch=main/);
  assert.equal(m.calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(m.calls[1].options.body), {ref: 'main'});
});
test('does not queue more scans while one is active', async () => {
  for (const status of ['queued', 'in_progress', 'waiting']) {
    const m = mock([{status}]);
    assert.equal((await trigger(env, scheduled, m.fetcher)).status, 'already_running');
    assert.equal(m.calls.length, 1);
  }
});
test('completed current slot is enough but previous slot is not', async () => {
  for (const [created_at, expected] of [['2026-11-02T02:05:00Z', 'already_completed'], ['2026-11-02T01:50:00Z', 'dispatched']]) {
    const m = mock([{status: 'completed', conclusion: 'success', created_at}]);
    assert.equal((await trigger(env, scheduled, m.fetcher)).status, expected);
  }
});
test('a failed run can be retried', async () => {
  const m = mock([{status: 'completed', conclusion: 'failure', created_at: '2026-11-02T02:05:00Z'}]);
  assert.equal((await trigger(env, scheduled, m.fetcher)).status, 'dispatched');
});
test('lookup permission errors do not dispatch or expose tokens', async () => {
  const m = mock([], {lookupStatus: 403});
  await assert.rejects(trigger(env, scheduled, m.fetcher), /lookup failed: HTTP 403/);
  assert.equal(m.calls.length, 1);
});
test('dispatch rejection is reported rather than treated as success', async () => {
  const m = mock([], {dispatchStatus: 401});
  await assert.rejects(trigger(env, scheduled, m.fetcher), /dispatch failed: HTTP 401/);
});
test('invalid configuration and malformed lookup fail closed', async () => {
  await assert.rejects(trigger({...env, GITHUB_REPOSITORY: '../other/url'}, scheduled), /configuration/);
  await assert.rejects(trigger({...env, GITHUB_TOKEN: ''}, scheduled), /configuration/);
  await assert.rejects(trigger(env, scheduled, async () => new Response('{}')), /Unexpected/);
});
test('public HTTP requests cannot start scans', async () => {
  assert.equal((await worker.fetch()).status, 405);
});
