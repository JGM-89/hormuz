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

export async function pushFile(path, content) {
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

export async function pushSnapshot(vessels, transitHistory, historicalData, aisHealth = null, commodities = null, aircraft = null) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return; // silently skip if not configured
  }

  try {
    // Always push live snapshot — even with 0 vessels, the frontend needs aisHealth status
    await pushFile('live/vessels.json', {
      timestamp: Date.now(),
      vessels: Object.fromEntries(vessels),
      recentTransits: transitHistory.slice(-50),
      aisHealth,
    });

    // Push commodity prices so GitHub Pages site gets real data
    if (commodities && commodities.length > 0) {
      await pushFile('live/commodities.json', {
        timestamp: Date.now(),
        commodities,
      });
    }

    // Push aircraft data so GitHub Pages site gets real aircraft positions
    if (aircraft && aircraft.length > 0) {
      await pushFile('live/aircraft.json', {
        timestamp: Date.now(),
        aircraft,
      });
    }

    // Historical data (content changes slowly)
    if (historicalData) {
      await pushFile('history/daily.json', {
        timestamp: Date.now(),
        ...historicalData,
      });
    }

    console.log(`[GitHub] Pushed snapshot (${vessels.size} vessels, ${commodities?.length || 0} commodities, ${aircraft?.length || 0} aircraft, AIS: ${aisHealth?.status || '?'})`);
  } catch (err) {
    console.error(`[GitHub] Push failed: ${err.message}`);
  }
}

export function isGitHubConfigured() {
  return !!(GITHUB_TOKEN && GITHUB_REPO);
}
