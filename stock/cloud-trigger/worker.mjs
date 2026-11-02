// Independent backup trigger. Secrets stay in the Worker, never in the website.
const active = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);
const workflow = 'stock-signals.yml';
export async function trigger(env, scheduledTime, request = fetch) {
  const repo = env.GITHUB_REPOSITORY;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '') || !env.GITHUB_TOKEN) {
    throw Error('Missing repository or GitHub secret configuration');
  }
  // Backup runs three minutes after the original GitHub schedule, using UTC.
  const slot = Number(scheduledTime) - 3 * 60 * 1000;
  if (!Number.isFinite(slot)) throw Error('Invalid scheduled time');
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'stock-free-backup-trigger'
  };
  const base = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}`;
  const response = await request(`${base}/runs?branch=main&per_page=10`, {
    headers, signal: AbortSignal.timeout(15000)
  });
  // Fail closed on API errors: never blindly enqueue duplicate work.
  if (!response.ok) throw Error(`GitHub run lookup failed: HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.workflow_runs)) throw Error('Unexpected GitHub run response');
  const runs = data.workflow_runs;
  if (runs.some(run => active.has(run.status))) return {status: 'already_running'};
  if (runs.some(run => Date.parse(run.created_at) >= slot &&
      run.status === 'completed' && run.conclusion === 'success')) {
    return {status: 'already_completed'};
  }
  const dispatched = await request(`${base}/dispatches`, {
    method: 'POST', headers: {...headers, 'Content-Type': 'application/json'},
    body: JSON.stringify({ref: 'main'}), signal: AbortSignal.timeout(15000)
  });
  if (dispatched.status !== 204) throw Error(`GitHub dispatch failed: HTTP ${dispatched.status}`);
  return {status: 'dispatched'};
}
export default {
  async scheduled(controller, env) {
    const result = await trigger(env, controller.scheduledTime);
    console.log(JSON.stringify({at: new Date(controller.scheduledTime).toISOString(), ...result}));
  },
  async fetch() {
    // No public endpoint can start a scan or expose the GitHub secret.
    return new Response('Scheduled trigger only', {status: 405});
  }
};
