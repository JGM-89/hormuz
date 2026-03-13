/**
 * Pushes JSON snapshot files to a GitHub repo's `data` branch
 * using the GitHub Contents API. No git binary needed.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // e.g., "username/hormuz"
const GITHUB_BRANCH = process.env.GITHUB_DATA_BRANCH || 'data';

let lastSha = {}; // track SHA per file for updates

async function githubAPI(path, method = 'GET', body = null) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'hormuz-tracker',
  };
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url + `?ref=${GITHUB_BRANCH}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  if (!res.ok && method === 'GET' && res.status === 404) {
    return null; // file doesn't exist yet
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${method} ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

async function pushFile(path, content) {
  const encoded = Buffer.from(JSON.stringify(content)).toString('base64');

  // Get current SHA if we don't have it cached
  if (!lastSha[path]) {
    try {
      const existing = await githubAPI(path);
      if (existing) lastSha[path] = existing.sha;
    } catch {
      // file doesn't exist yet, that's fine
    }
  }

  const body = {
    message: `Update ${path}`,
    content: encoded,
    branch: GITHUB_BRANCH,
  };
  if (lastSha[path]) body.sha = lastSha[path];

  const result = await githubAPI(path, 'PUT', body);
  if (result?.content?.sha) {
    lastSha[path] = result.content.sha;
  }
  return result;
}

export async function pushSnapshot(vessels, stats, transitHistory, historicalData, aisHealth = null) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return; // silently skip if not configured
  }

  try {
    // Live snapshot (updates every 15s)
    await pushFile('live/vessels.json', {
      timestamp: Date.now(),
      vessels: Object.fromEntries(vessels),
      stats,
      recentTransits: transitHistory.slice(-50),
      aisHealth,
    });

    // Historical data (updates every 15s too, but content changes slowly)
    if (historicalData) {
      await pushFile('history/daily.json', {
        timestamp: Date.now(),
        ...historicalData,
      });
    }

    console.log(`[GitHub] Pushed snapshot (${vessels.size} vessels)`);
  } catch (err) {
    console.error(`[GitHub] Push failed: ${err.message}`);
  }
}

export function isGitHubConfigured() {
  return !!(GITHUB_TOKEN && GITHUB_REPO);
}
