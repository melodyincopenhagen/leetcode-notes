const SERVER = 'http://localhost:3001';

// ── 安装时设置每天 12 点触发 ───────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('dailySync', {
    when: nextNoon(),
    periodInMinutes: 24 * 60
  });
  console.log('[LN] 定时同步已设置，下次同步：', new Date(nextNoon()).toLocaleString());
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailySync') syncAll();
});

// ── 接收 popup 的手动触发 ──────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'MANUAL_SYNC') {
    syncAll().then(r => sendResponse(r)).catch(e => sendResponse({ error: e.message }));
    return true; // keep channel open for async
  }
});

// ── 主同步函数 ─────────────────────────────────────────────
async function syncAll() {
  try {
    const problems = await fetchSolvedProblems();
    if (!problems.length) return { synced: 0 };

    const resp = await fetch(`${SERVER}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problems })
    });
    const data = await resp.json();

    chrome.storage.local.set({ lastSync: new Date().toISOString(), lastCount: data.synced });

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'LeetCode Notes',
      message: `同步完成，共 ${data.synced} 题`
    });

    return data;
  } catch (e) {
    console.error('[LN] 同步失败', e);
    return { error: e.message };
  }
}

// ── 抓取 LeetCode 已解决题目 ──────────────────────────────
async function fetchSolvedProblems() {
  // 1. 先获取用户名
  const meResp = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{ userStatus { username } }`
    })
  });
  const meData = await meResp.json();
  const username = meData?.data?.userStatus?.username;
  if (!username) throw new Error('未登录 LeetCode，请先登录');

  // 2. 拉取全部已通过题目
  const acResp = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query userSolvedProblems($username: String!, $limit: Int, $skip: Int) {
          allQuestionsCount { difficulty count }
          matchedUser(username: $username) {
            submitStats {
              acSubmissionNum { difficulty count }
            }
            profile { realName }
          }
        }
      `,
      variables: { username, limit: 3000, skip: 0 }
    })
  });

  // 3. 通过 submissions API 获取题目列表（分页拉取）
  const problems = [];
  let offset = 0;
  const limit = 20;

  while (true) {
    const subResp = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query submissionList($offset: Int!, $limit: Int!, $lastKey: String) {
            submissionList(offset: $offset, limit: $limit, lastKey: $lastKey) {
              lastKey
              hasNext
              submissions {
                id
                statusDisplay
                title
                titleSlug
                timestamp
              }
            }
          }
        `,
        variables: { offset, limit }
      })
    });

    const subData = await subResp.json();
    const list = subData?.data?.submissionList;
    if (!list) break;

    const accepted = list.submissions.filter(s => s.statusDisplay === 'Accepted');

    for (const sub of accepted) {
      if (problems.find(p => p.title_slug === sub.titleSlug)) continue;
      // 获取题目详情
      const detail = await fetchProblemDetail(sub.titleSlug);
      problems.push({
        leetcode_id: detail.questionFrontendId ? parseInt(detail.questionFrontendId) : null,
        title: sub.title,
        title_slug: sub.titleSlug,
        difficulty: detail.difficulty || 'Medium',
        description: detail.content || null
      });
    }

    if (!list.hasNext) break;
    offset += limit;

    // 避免请求过快
    await sleep(300);
  }

  return problems.filter(p => p.leetcode_id);
}

async function fetchProblemDetail(titleSlug) {
  try {
    const resp = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query questionData($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              questionFrontendId
              difficulty
              content
            }
          }
        `,
        variables: { titleSlug }
      })
    });
    const data = await resp.json();
    return data?.data?.question || {};
  } catch {
    return {};
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function nextNoon() {
  const now = new Date();
  const noon = new Date(now);
  noon.setHours(12, 0, 0, 0);
  if (noon <= now) noon.setDate(noon.getDate() + 1);
  return noon.getTime();
}
