const db = require('./db');

const LEETCODE_GQL = 'https://leetcode.com/graphql';

function getHeaders(session) {
  return {
    'Content-Type': 'application/json',
    'Cookie': `LEETCODE_SESSION=${session}`,
    'Referer': 'https://leetcode.com',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  };
}

async function gql(session, query, variables = {}) {
  const resp = await fetch(LEETCODE_GQL, {
    method: 'POST',
    headers: getHeaders(session),
    body: JSON.stringify({ query, variables })
  });
  return resp.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 并发池：最多 concurrency 个 worker 同时执行 fn(item)
async function pMap(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchSolvedProblems(session, { full = false } = {}) {
  // 1. 验证登录
  const me = await gql(session, `{ userStatus { username isSignedIn } }`);
  const userStatus = me?.data?.userStatus;
  if (!userStatus?.isSignedIn) throw new Error('Cookie 已失效，请重新获取 LEETCODE_SESSION');

  const username = userStatus.username;
  console.log(`[sync] 登录用户: ${username}（模式：${full ? '全量' : '增量'}）`);

  // DB 里已存在的 slug -> { has_description }
  const existing = new Map();
  for (const row of db.prepare('SELECT title_slug, description FROM problems').all()) {
    existing.set(row.title_slug, { hasDescription: !!row.description });
  }

  const problems = [];
  const seenSlug = new Set();
  let offset = 0;
  const limit = 20;
  let stop = false;

  outer: while (!stop) {
    const data = await gql(session, `
      query submissionList($offset: Int!, $limit: Int!) {
        submissionList(offset: $offset, limit: $limit) {
          lastKey
          hasNext
          submissions {
            statusDisplay
            title
            titleSlug
          }
        }
      }
    `, { offset, limit });

    const list = data?.data?.submissionList;
    if (!list) break;

    const accepted = list.submissions.filter(s => s.statusDisplay === 'Accepted');

    for (const sub of accepted) {
      if (seenSlug.has(sub.titleSlug)) continue;
      seenSlug.add(sub.titleSlug);

      const known = existing.get(sub.titleSlug);

      // 增量模式：碰到第一道已存在且已有描述的题就停（按时间倒序，更老的也都同步过了）
      if (!full && known && known.hasDescription) {
        console.log(`[sync] 增量到达已知题 ${sub.titleSlug}，提前结束`);
        stop = true;
        break outer;
      }

      // 已知但缺描述：只补描述（leetcode_id 已经有了，但简化起见走同样的 upsert）
      // 未知：拉取详情
      const detail = await fetchProblemDetail(session, sub.titleSlug);
      if (!detail.questionFrontendId) continue;

      problems.push({
        leetcode_id: parseInt(detail.questionFrontendId),
        title: sub.title,
        title_slug: sub.titleSlug,
        difficulty: detail.difficulty || 'Medium',
        description: detail.content || null
      });

      console.log(`[sync] 已获取: #${detail.questionFrontendId} ${sub.title}`);
      await sleep(50);
    }

    if (!list.hasNext) break;
    offset += limit;
  }

  return problems;
}

async function fetchProblemDetail(session, titleSlug) {
  try {
    const data = await gql(session, `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionFrontendId
          difficulty
          content
        }
      }
    `, { titleSlug });
    return data?.data?.question || {};
  } catch {
    return {};
  }
}

async function syncToDb(session, opts = {}) {
  const problems = await fetchSolvedProblems(session, opts);
  if (!problems.length) {
    console.log('[sync] 无新题');
    return { synced: 0 };
  }

  const insert = db.prepare(`
    INSERT INTO problems (leetcode_id, title, title_slug, difficulty, description)
    VALUES (@leetcode_id, @title, @title_slug, @difficulty, @description)
    ON CONFLICT(leetcode_id) DO UPDATE SET
      title = excluded.title,
      difficulty = excluded.difficulty,
      description = COALESCE(excluded.description, problems.description),
      updated_at = datetime('now')
  `);

  db.transaction(() => { for (const p of problems) insert.run(p); })();
  console.log(`[sync] 完成，共同步 ${problems.length} 题`);
  return { synced: problems.length };
}

module.exports = { syncToDb };
