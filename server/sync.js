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

async function fetchSolvedProblems(session) {
  // 1. 验证登录
  const me = await gql(session, `{ userStatus { username isSignedIn } }`);
  const userStatus = me?.data?.userStatus;
  if (!userStatus?.isSignedIn) throw new Error('Cookie 已失效，请重新获取 LEETCODE_SESSION');

  const username = userStatus.username;
  console.log(`[sync] 登录用户: ${username}`);

  // 2. 分页拉取已通过的提交记录
  const problems = [];
  let offset = 0;
  const limit = 20;

  while (true) {
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
      if (problems.find(p => p.title_slug === sub.titleSlug)) continue;

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
      await sleep(200);
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

async function syncToDb(session) {
  const problems = await fetchSolvedProblems(session);
  if (!problems.length) return { synced: 0 };

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
