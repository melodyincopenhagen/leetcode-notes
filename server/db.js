const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'leetcode.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leetcode_id INTEGER UNIQUE NOT NULL,
    title TEXT NOT NULL,
    title_slug TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('forgotten', 'know_idea', 'minor_error', 'perfect')),
    notes TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    attempted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (problem_id) REFERENCES problems(id)
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS problem_tags (
    problem_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (problem_id, tag_id),
    FOREIGN KEY (problem_id) REFERENCES problems(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER DEFAULT NULL,
    is_folder INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES notes(id)
  );
`);

// 迁移：给旧 notes 表补充新列（如果还不存在）
const notesCols = db.pragma('table_info(notes)').map(c => c.name);
if (!notesCols.includes('parent_id')) {
  db.exec("ALTER TABLE notes ADD COLUMN parent_id INTEGER DEFAULT NULL");
}
if (!notesCols.includes('is_folder')) {
  db.exec("ALTER TABLE notes ADD COLUMN is_folder INTEGER NOT NULL DEFAULT 0");
}
if (!notesCols.includes('sort_order')) {
  db.exec("ALTER TABLE notes ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
}

module.exports = db;
