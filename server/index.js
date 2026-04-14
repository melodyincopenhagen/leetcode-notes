const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const db = require('./db');
const { syncToDb } = require('./sync');

function getSession() {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  return cfg.leetcode_session;
}

// 每天 12 点自动同步
function scheduleDaily() {
  const now = new Date();
  const noon = new Date(now);
  noon.setHours(12, 0, 0, 0);
  if (noon <= now) noon.setDate(noon.getDate() + 1);
  const ms = noon - now;
  console.log(`[sync] 下次自动同步：${noon.toLocaleString()}（${Math.round(ms/60000)} 分钟后）`);
  setTimeout(() => {
    syncToDb(getSession()).catch(console.error);
    scheduleDaily();
  }, ms);
}

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── 图片上传 ──────────────────────────────────────────────
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ── 手动触发同步 ──────────────────────────────────────────
app.post('/api/sync', async (req, res) => {
  try {
    const result = await syncToDb(getSession());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 题目列表（支持过滤） ───────────────────────────────────
app.get('/api/problems', (req, res) => {
  const { difficulty, status, tag, sort } = req.query;

  let query = `
    SELECT
      p.*,
      r.status,
      r.notes,
      r.remarks,
      r.attempted_at,
      GROUP_CONCAT(DISTINCT t.name) AS tags
    FROM problems p
    LEFT JOIN (
      SELECT r1.* FROM records r1
      INNER JOIN (
        SELECT problem_id, MAX(attempted_at) AS max_at FROM records GROUP BY problem_id
      ) r2 ON r1.problem_id = r2.problem_id AND r1.attempted_at = r2.max_at
    ) r ON p.id = r.problem_id
    LEFT JOIN problem_tags pt ON p.id = pt.problem_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;

  const conditions = [];
  const params = {};

  if (difficulty) { conditions.push("p.difficulty = @difficulty"); params.difficulty = difficulty; }
  if (status === 'none') {
    conditions.push("r.status IS NULL");
  } else if (status) {
    conditions.push("r.status = @status"); params.status = status;
  }
  if (tag) { conditions.push("t.name = @tag"); params.tag = tag; }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' GROUP BY p.id';

  if (sort === 'last_attempt') {
    query += ' ORDER BY r.attempted_at DESC NULLS LAST';
  } else if (sort === 'title') {
    query += ' ORDER BY p.title ASC';
  } else {
    query += ' ORDER BY p.leetcode_id ASC';
  }

  const rows = db.prepare(query).all(params);
  res.json(rows.map(r => ({ ...r, tags: r.tags ? r.tags.split(',') : [] })));
});

// ── 单题详情 ──────────────────────────────────────────────
app.get('/api/problems/:id', (req, res) => {
  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
  if (!problem) return res.status(404).json({ error: 'Not found' });

  const records = db.prepare('SELECT * FROM records WHERE problem_id = ? ORDER BY attempted_at DESC').all(req.params.id);
  const tags = db.prepare(`
    SELECT t.name FROM tags t
    JOIN problem_tags pt ON t.id = pt.tag_id
    WHERE pt.problem_id = ?
  `).all(req.params.id).map(r => r.name);

  res.json({ ...problem, records, tags });
});

// ── 添加/更新记录 ─────────────────────────────────────────
app.post('/api/problems/:id/records', (req, res) => {
  const { status, notes, remarks } = req.body;
  const validStatuses = ['forgotten', 'know_idea', 'minor_error', 'perfect'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const result = db.prepare(`
    INSERT INTO records (problem_id, status, notes, remarks)
    VALUES (?, ?, ?, ?)
  `).run(req.params.id, status, notes || '', remarks || '');

  res.json({ id: result.lastInsertRowid });
});

// ── 删除记录 ──────────────────────────────────────────────
app.delete('/api/records/:recordId', (req, res) => {
  const result = db.prepare('DELETE FROM records WHERE id = ?').run(req.params.recordId);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ── 更新笔记/备注（最新一条记录） ────────────────────────────
app.patch('/api/problems/:id/latest', (req, res) => {
  const { notes, remarks } = req.body;
  const latest = db.prepare('SELECT id FROM records WHERE problem_id = ? ORDER BY attempted_at DESC LIMIT 1').get(req.params.id);
  if (!latest) return res.status(404).json({ error: 'No record' });

  db.prepare('UPDATE records SET notes = COALESCE(@notes, notes), remarks = COALESCE(@remarks, remarks) WHERE id = @id')
    .run({ notes, remarks, id: latest.id });
  res.json({ ok: true });
});

// ── 标签管理 ──────────────────────────────────────────────
app.get('/api/tags', (req, res) => {
  res.json(db.prepare(
    'SELECT name FROM tags WHERE id IN (SELECT DISTINCT tag_id FROM problem_tags) ORDER BY name'
  ).all().map(r => r.name));
});

app.put('/api/problems/:id/tags', (req, res) => {
  const { tags } = req.body;
  if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be array' });

  const problemId = parseInt(req.params.id);

  const upsertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const clearTags = db.prepare('DELETE FROM problem_tags WHERE problem_id = ?');
  const insertPT = db.prepare('INSERT OR IGNORE INTO problem_tags (problem_id, tag_id) VALUES (?, ?)');

  db.transaction(() => {
    clearTags.run(problemId);
    for (const name of tags) {
      upsertTag.run(name.trim());
      const tag = getTag.get(name.trim());
      insertPT.run(problemId, tag.id);
    }
  })();

  res.json({ ok: true });
});

// ── 统计 ──────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM problems').get().count;

  const statusCounts = db.prepare(`
    SELECT r.status, COUNT(*) as count
    FROM (
      SELECT r1.* FROM records r1
      INNER JOIN (
        SELECT problem_id, MAX(attempted_at) AS max_at FROM records GROUP BY problem_id
      ) r2 ON r1.problem_id = r2.problem_id AND r1.attempted_at = r2.max_at
    ) r
    GROUP BY r.status
  `).all();

  const untouched = db.prepare(`
    SELECT COUNT(*) as count FROM problems p
    WHERE NOT EXISTS (SELECT 1 FROM records r WHERE r.problem_id = p.id)
  `).get().count;

  res.json({ total, statusCounts, untouched });
});

// ── 热力图（每天提交次数） ────────────────────────────────
app.get('/api/heatmap', (req, res) => {
  const rows = db.prepare(`
    SELECT DATE(attempted_at, '-7 hours') AS day, COUNT(*) AS count
    FROM records
    GROUP BY DATE(attempted_at, '-7 hours')
    ORDER BY day ASC
  `).all();
  res.json(rows);
});

// ── 随机题目 ──────────────────────────────────────────────
app.get('/api/random', (req, res) => {
  const { difficulty, status, tag } = req.query;

  let query = `
    SELECT p.id FROM problems p
    LEFT JOIN (
      SELECT r1.* FROM records r1
      INNER JOIN (
        SELECT problem_id, MAX(attempted_at) AS max_at FROM records GROUP BY problem_id
      ) r2 ON r1.problem_id = r2.problem_id AND r1.attempted_at = r2.max_at
    ) r ON p.id = r.problem_id
    LEFT JOIN problem_tags pt ON p.id = pt.problem_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;

  const conditions = [];
  const params = {};

  if (difficulty) { conditions.push("p.difficulty = @difficulty"); params.difficulty = difficulty; }
  if (status === 'none') {
    conditions.push("r.status IS NULL");
  } else if (status) {
    conditions.push("r.status = @status"); params.status = status;
  }
  if (tag) { conditions.push("t.name = @tag"); params.tag = tag; }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' GROUP BY p.id ORDER BY RANDOM() LIMIT 1';

  const row = db.prepare(query).get(params);
  if (!row) return res.status(404).json({ error: 'No problems found' });
  res.json({ id: row.id });
});

// ── 笔记树（全量，前端自行组装树） ───────────────────────
app.get('/api/notes', (req, res) => {
  const { search } = req.query;
  if (search) {
    // 搜索时只返回匹配的笔记（不含文件夹），扁平列表
    const rows = db.prepare(
      "SELECT id, parent_id, is_folder, title, sort_order, updated_at FROM notes WHERE is_folder=0 AND title LIKE ? ORDER BY title ASC"
    ).all(`%${search}%`);
    return res.json(rows);
  }
  // 正常返回所有节点（文件夹+笔记），前端组树
  const rows = db.prepare(
    "SELECT id, parent_id, is_folder, title, sort_order, updated_at FROM notes ORDER BY is_folder DESC, sort_order ASC, title ASC"
  ).all();
  res.json(rows);
});

// ── 单条笔记详情 ──────────────────────────────────────────
app.get('/api/notes/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Not found' });
  res.json(note);
});

// ── 新建笔记或文件夹 ─────────────────────────────────────
app.post('/api/notes', (req, res) => {
  const { title, content, parent_id, is_folder } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });
  // 计算 sort_order（同级末尾）
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM notes WHERE parent_id IS ?'
  ).get(parent_id ?? null).m;
  const result = db.prepare(
    'INSERT INTO notes (title, content, parent_id, is_folder, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(title.trim(), content || '', parent_id ?? null, is_folder ? 1 : 0, maxOrder + 1);
  res.json({ id: result.lastInsertRowid });
});

// ── 更新笔记内容/标题 ────────────────────────────────────
app.put('/api/notes/:id', (req, res) => {
  const { title, content } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });
  const result = db.prepare(
    "UPDATE notes SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title.trim(), content ?? '', req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ── 移动节点（改 parent_id） ─────────────────────────────
app.patch('/api/notes/:id/move', (req, res) => {
  const { parent_id } = req.body;
  const id = parseInt(req.params.id);
  // 防止把节点移进自己的子树
  if (parent_id != null) {
    let cur = parseInt(parent_id);
    while (cur != null) {
      if (cur === id) return res.status(400).json({ error: 'Cannot move into own subtree' });
      const row = db.prepare('SELECT parent_id FROM notes WHERE id = ?').get(cur);
      cur = row?.parent_id ?? null;
    }
  }
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM notes WHERE parent_id IS ?'
  ).get(parent_id ?? null).m;
  db.prepare('UPDATE notes SET parent_id = ?, sort_order = ? WHERE id = ?')
    .run(parent_id ?? null, maxOrder + 1, id);
  res.json({ ok: true });
});

// ── 删除笔记（递归删除子节点） ──────────────────────────
app.delete('/api/notes/:id', (req, res) => {
  const deleteSubtree = (id) => {
    const children = db.prepare('SELECT id FROM notes WHERE parent_id = ?').all(id);
    for (const c of children) deleteSubtree(c.id);
    db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  };
  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Not found' });
  deleteSubtree(parseInt(req.params.id));
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  scheduleDaily();
});
