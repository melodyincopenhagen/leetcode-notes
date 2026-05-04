# LeetCode Notes

A local note-taking system for LeetCode practice. Sync solved problems from LeetCode, track your progress, organize problems into favorites, write Markdown notes, manage a standalone notebook, and visualize your activity with a progress ring and heatmap.

## Project Structure

```
leetcode_notes/
├── server/       # Node.js backend (Express + SQLite)
├── client/       # React frontend
├── extension/    # Chrome extension (syncs data from LeetCode)
└── start.sh      # Quick start script for the backend
```

## Getting Started

### 1. Configure LeetCode Session

```bash
cp server/config.example.json server/config.json
```

Edit `server/config.json` and paste your LeetCode session cookie.

To get it: log in to leetcode.com → open DevTools → Application → Cookies → copy the value of `LEETCODE_SESSION`.

### 2. Start the Backend

```bash
cd server
npm install
node index.js
# or simply run ./start.sh
```

The backend listens on http://localhost:3001

**Auto-start on boot (recommended):**

```bash
npm install -g pm2
cd server
pm2 start index.js --name leetcode-notes
pm2 startup   # follow the printed instructions
pm2 save
```

### 3. Start the Frontend

```bash
cd client
npm install
npm start
```

The frontend is available at http://localhost:3000

### 4. Install the Chrome Extension (Optional)

1. Open Chrome → navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `extension/` directory
5. Make sure you are logged in to leetcode.com

### 5. Sync Data

There are two ways to sync problems from LeetCode:
- **Web UI**: Click "↻ Sync New" on the homepage for a fast incremental sync (stops at the first already-synced problem). Use the smaller "Full" button to force a full rescan when needed.
- **Chrome extension**: Click the extension icon → "Sync Now"
- The backend also auto-syncs daily at 12:00 PM (requires the server to be running)

## Features

### Problem Management

| Feature | Description |
|---------|-------------|
| Problem Sync | Pull solved problems and descriptions from LeetCode (incremental by default, with a full-rescan option) |
| Search | Search by problem number or title |
| Filter & Sort | Filter by difficulty, status, tag, or favorite; sort by number, title, or last attempt |
| Random Pick | Randomly pick a problem from the current filtered results |
| LeetCode Link | Jump directly to the original problem on LeetCode from the detail page |

### Progress Tracking

| Feature | Description |
|---------|-------------|
| Status Marking | Forgotten / Remembered the idea / Minor errors / Perfect |
| Attempt History | Each status mark is timestamped; individual records can be deleted |
| Stats Overview | Homepage shows counts per status and a progress bar |
| Progress Ring | LeetCode-style ring with per-difficulty solved/total and an Attempting count |
| Heatmap | Submission heatmap on the homepage, displayed side-by-side with the progress ring |
| Pacific Time | All timestamps are displayed in Pacific Time with automatic PST/PDT handling |

### Notes

| Feature | Description |
|---------|-------------|
| Problem Notes | Write Markdown notes on each problem's detail page with syntax highlighting |
| Remarks | Plain-text remarks field per problem |
| Tags | Custom tags, comma-separated (e.g. Array, Two Pointers) |
| Favorites | Group problems into named favorite lists; a problem can belong to multiple lists. Create, rename, and delete favorites from the problem detail page; filter by favorite from the homepage |
| Image Paste | Ctrl+V to paste screenshots directly; images are auto-uploaded |
| Auto-save | Notes are automatically saved 1 second after editing |

### Standalone Notebook

| Feature | Description |
|---------|-------------|
| Folder Management | Create folders and subfolders in a tree structure |
| Markdown Editor | Full Markdown support with image paste |
| Search | Search notes by title |

## Data Storage

- Database: `server/leetcode.db` (SQLite, single file, excluded via .gitignore)
- Images: `server/uploads/`
- Config: `server/config.json` (contains sensitive data, excluded via .gitignore)
