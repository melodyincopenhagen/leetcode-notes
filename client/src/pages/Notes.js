import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import rehypePrism from 'rehype-prism-plus';
import remarkBreaks from 'remark-breaks';
import { getNotes, getNote, createNote, updateNote, deleteNote } from '../api';

const border = '#e0e0e0';

// ── 把扁平列表组装成树 ────────────────────────────────────
function buildTree(nodes) {
  const map = {};
  nodes.forEach(n => { map[n.id] = { ...n, children: [] }; });
  const roots = [];
  nodes.forEach(n => {
    if (n.parent_id != null && map[n.parent_id]) {
      map[n.parent_id].children.push(map[n.id]);
    } else {
      roots.push(map[n.id]);
    }
  });
  return roots;
}

export default function Notes() {
  const [allNodes, setAllNodes] = useState([]);   // 扁平列表（完整树用）
  const [searchResults, setSearchResults] = useState(null); // null=不在搜索模式
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const searchTimer = useRef(null);

  // 展开状态：folderID -> boolean
  const [expanded, setExpanded] = useState({});

  // 新建弹窗状态
  const [creating, setCreating] = useState(null); // null | { parentId, isFolder }
  const [newTitle, setNewTitle] = useState('');

  const loadAll = useCallback(() => {
    getNotes('').then(r => setAllNodes(r.data));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    if (!val.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimer.current = setTimeout(() => {
      getNotes(val.trim()).then(r => setSearchResults(r.data));
    }, 300);
  };

  const toggleExpand = (id) => {
    setExpanded(e => ({ ...e, [id]: !e[id] }));
  };

  // 新建：parentId=null 表示根级
  const startCreate = (parentId, isFolder) => {
    // 若 parentId 是文件夹，自动展开
    if (parentId != null) setExpanded(e => ({ ...e, [parentId]: true }));
    setCreating({ parentId: parentId ?? null, isFolder: !!isFolder });
    setNewTitle('');
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const r = await createNote({
      title: newTitle.trim(),
      content: '',
      parent_id: creating.parentId,
      is_folder: creating.isFolder,
    });
    setCreating(null);
    setNewTitle('');
    loadAll();
    if (!creating.isFolder) setSelectedId(r.data.id);
  };

  const handleDelete = async (node) => {
    const msg = node.is_folder
      ? `确认删除文件夹「${node.title}」及其所有内容？`
      : `确认删除笔记「${node.title}」？`;
    if (!window.confirm(msg)) return;
    await deleteNote(node.id);
    if (selectedId === node.id) setSelectedId(null);
    loadAll();
  };

  const tree = useMemo(() => buildTree(allNodes), [allNodes]);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', overflow: 'hidden', background: '#f7f7f5' }}>

      {/* ── 左侧目录树 ── */}
      <div style={{
        width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: `1px solid ${border}`, background: '#fff',
      }}>
        {/* 顶部工具栏 */}
        <div style={{ padding: '14px 12px 10px', borderBottom: `1px solid ${border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', flex: 1 }}>笔记</span>
            <IconBtn title="新建文件夹" onClick={() => startCreate(null, true)}>
              <FolderPlusIcon />
            </IconBtn>
            <IconBtn title="新建笔记" onClick={() => startCreate(null, false)} green>
              +
            </IconBtn>
          </div>
          {/* 搜索 */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#bbb', fontSize: 12, pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="搜索笔记标题..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px 6px 26px', borderRadius: 6,
                border: `1px solid ${border}`, fontSize: 12, outline: 'none',
                background: '#f9f9f7', color: '#1a1a1a', boxSizing: 'border-box',
                transition: 'border .15s',
              }}
              onFocus={e => e.target.style.borderColor = '#1D9E75'}
              onBlur={e => e.target.style.borderColor = border}
            />
          </div>
        </div>

        {/* 树/搜索结果 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {searchResults !== null ? (
            searchResults.length === 0 ? (
              <Empty text={`没有匹配"${search}"的笔记`} />
            ) : (
              searchResults.map(n => (
                <SearchResultItem
                  key={n.id}
                  node={n}
                  active={selectedId === n.id}
                  onClick={() => setSelectedId(n.id)}
                />
              ))
            )
          ) : (
            <>
              {tree.length === 0 && !isCreatingHere(creating, null) && (
                <Empty text="还没有笔记，点击右上角新建" />
              )}
              {tree.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  expanded={expanded}
                  onSelect={id => setSelectedId(id)}
                  onToggle={toggleExpand}
                  onDelete={handleDelete}
                  onNewNote={id => startCreate(id, false)}
                  onNewFolder={id => startCreate(id, true)}
                  creating={creating}
                  newTitle={newTitle}
                  setNewTitle={setNewTitle}
                  handleCreate={handleCreate}
                  cancelCreate={() => setCreating(null)}
                />
              ))}
              {/* 根级新建输入框 */}
              {isCreatingHere(creating, null) && (
                <InlineCreate
                  indent={8}
                  isFolder={creating.isFolder}
                  value={newTitle}
                  onChange={setNewTitle}
                  onConfirm={handleCreate}
                  onCancel={() => setCreating(null)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 右侧编辑区 ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selectedId ? (
          <NoteEditor
            key={selectedId}
            noteId={selectedId}
            onUpdated={loadAll}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>📝</div>
            <div style={{ fontSize: 13 }}>选择一条笔记开始编辑</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 树节点（递归） ────────────────────────────────────────
function TreeNode({ node, depth, selectedId, expanded, onSelect, onToggle, onDelete,
  onNewNote, onNewFolder, creating, newTitle, setNewTitle, handleCreate, cancelCreate }) {
  const [hover, setHover] = useState(false);
  const isOpen = !!expanded[node.id];
  const isActive = selectedId === node.id;
  const indent = depth * 14 + 8;

  return (
    <div>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => {
          if (node.is_folder) onToggle(node.id);
          else onSelect(node.id);
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          paddingLeft: indent, paddingRight: 6, paddingTop: 5, paddingBottom: 5,
          cursor: 'pointer', userSelect: 'none',
          background: isActive ? '#f0faf5' : hover ? '#f5f5f3' : 'transparent',
          borderLeft: isActive ? '2px solid #1D9E75' : '2px solid transparent',
          transition: 'background .1s',
        }}
      >
        {/* 展开箭头 / 占位 */}
        <span style={{
          width: 14, fontSize: 10, color: '#bbb', flexShrink: 0,
          transform: node.is_folder ? (isOpen ? 'rotate(90deg)' : 'rotate(0deg)') : 'none',
          transition: 'transform .15s',
          display: 'inline-block',
        }}>
          {node.is_folder ? '▶' : ''}
        </span>

        {/* 图标 */}
        <span style={{ fontSize: 13, flexShrink: 0 }}>
          {node.is_folder ? (isOpen ? '📂' : '📁') : '📄'}
        </span>

        {/* 标题 */}
        <span style={{
          flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: isActive ? 600 : 400,
          color: isActive ? '#1D9E75' : '#1a1a1a',
        }}>
          {node.title}
        </span>

        {/* 操作按钮（hover时显示） */}
        {hover && (
          <div style={{ display: 'flex', gap: 1, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {node.is_folder && (
              <>
                <MiniBtn title="在此文件夹下新建笔记" onClick={() => onNewNote(node.id)}>📄</MiniBtn>
                <MiniBtn title="在此文件夹下新建子文件夹" onClick={() => onNewFolder(node.id)}>📁</MiniBtn>
              </>
            )}
            <MiniBtn title="删除" onClick={() => onDelete(node)} red>×</MiniBtn>
          </div>
        )}
      </div>

      {/* 子节点（文件夹展开时） */}
      {node.is_folder && isOpen && (
        <div>
          {node.children.length === 0 && !isCreatingHere(creating, node.id) && (
            <div style={{ paddingLeft: indent + 32, fontSize: 11, color: '#ccc', paddingTop: 3, paddingBottom: 3 }}>空</div>
          )}
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
              onDelete={onDelete}
              onNewNote={onNewNote}
              onNewFolder={onNewFolder}
              creating={creating}
              newTitle={newTitle}
              setNewTitle={setNewTitle}
              handleCreate={handleCreate}
              cancelCreate={cancelCreate}
            />
          ))}
          {/* 在此文件夹内新建的输入框 */}
          {isCreatingHere(creating, node.id) && (
            <InlineCreate
              indent={indent + 28}
              isFolder={creating.isFolder}
              value={newTitle}
              onChange={setNewTitle}
              onConfirm={handleCreate}
              onCancel={cancelCreate}
            />
          )}
        </div>
      )}
    </div>
  );
}

// 根级新建输入框（在 Notes 组件底部渲染）
function isCreatingHere(creating, parentId) {
  if (!creating) return false;
  return creating.parentId === parentId;
}

function InlineCreate({ indent, isFolder, value, onChange, onConfirm, onCancel }) {
  return (
    <div style={{ paddingLeft: indent, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 12 }}>{isFolder ? '📁' : '📄'}</span>
        <input
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder={isFolder ? '文件夹名称...' : '笔记标题...'}
          style={{
            flex: 1, fontSize: 12, padding: '3px 6px', borderRadius: 5,
            border: '1px solid #1D9E75', outline: 'none', background: '#fff',
          }}
        />
        <MiniBtn onClick={onConfirm} title="确认" style={{ color: '#1D9E75', fontWeight: 700 }}>✓</MiniBtn>
        <MiniBtn onClick={onCancel} title="取消">✕</MiniBtn>
      </div>
    </div>
  );
}

function SearchResultItem({ node, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '7px 12px', cursor: 'pointer', fontSize: 13,
        background: active ? '#f0faf5' : hover ? '#f5f5f3' : 'transparent',
        borderLeft: active ? '2px solid #1D9E75' : '2px solid transparent',
        color: active ? '#1D9E75' : '#1a1a1a',
        fontWeight: active ? 600 : 400,
      }}
    >
      📄 {node.title}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#ccc', fontSize: 12 }}>{text}</div>
  );
}

function IconBtn({ title, onClick, green, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26, height: 26, borderRadius: 6, border: 'none',
        background: green ? (hover ? '#17a86a' : '#1D9E75') : (hover ? '#eee' : '#f5f5f3'),
        color: green ? '#fff' : '#555',
        cursor: 'pointer', fontSize: green ? 18 : 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'background .15s',
      }}
    >{children}</button>
  );
}

function MiniBtn({ title, onClick, red, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 20, height: 20, borderRadius: 4, border: 'none', padding: 0,
        background: hover ? (red ? '#fde8e8' : '#eee') : 'transparent',
        color: hover ? (red ? '#c0392b' : '#333') : '#aaa',
        cursor: 'pointer', fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .1s',
      }}
    >{children}</button>
  );
}

function FolderPlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.586a1 1 0 0 1 .707.293L7.5 3.5H13A1.5 1.5 0 0 1 14.5 5v1H1V3.5z"/>
      <path d="M0 6h16v6.5A1.5 1.5 0 0 1 14.5 14h-13A1.5 1.5 0 0 1 0 12.5V6zm8 3a.5.5 0 0 0-1 0v1.5H5.5a.5.5 0 0 0 0 1H7V13a.5.5 0 0 0 1 0v-1.5h1.5a.5.5 0 0 0 0-1H8V9z"/>
    </svg>
  );
}

// ── 笔记编辑器 ────────────────────────────────────────────
function NoteEditor({ noteId, onUpdated }) {
  const [note, setNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [preview, setPreview] = useState('edit');
  const timer = useRef(null);
  const previewOptions = useMemo(() => ({
    remarkPlugins: [remarkBreaks],
    rehypePlugins: [[rehypePrism, { ignoreMissing: true }]],
  }), []);

  useEffect(() => {
    getNote(noteId).then(r => {
      setNote(r.data);
      setTitle(r.data.title);
      const c = r.data.content || '';
      setContent(c);
      setPreview(c.trim() ? 'preview' : 'edit');
    });
  }, [noteId]);

  const saveContent = useCallback(async (newContent, currentTitle) => {
    setSaving(true);
    try {
      await updateNote(noteId, { title: currentTitle, content: newContent });
      onUpdated();
    } catch (e) { console.error(e); }
    setSaving(false);
  }, [noteId, onUpdated]);

  const handleContentChange = (val) => {
    setContent(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveContent(val, title), 1000);
  };

  const handleTitleSave = async () => {
    if (!title.trim()) return;
    setEditingTitle(false);
    await updateNote(noteId, { title: title.trim(), content });
    onUpdated();
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        const form = new FormData();
        form.append('image', file);
        try {
          const r = await fetch('http://localhost:3001/api/upload', { method: 'POST', body: form });
          const data = await r.json();
          const imgMd = `\n![image](http://localhost:3001${data.url})\n`;
          const newContent = content + imgMd;
          setContent(newContent);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => saveContent(newContent, title), 1000);
        } catch (err) { console.error(err); }
      }
    }
  };

  if (!note) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 14 }}>
      加载中...
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 标题栏 */}
      <div style={{
        padding: '14px 28px', borderBottom: `1px solid ${border}`,
        background: '#fff', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') { setTitle(note.title); setEditingTitle(false); }
            }}
            onBlur={handleTitleSave}
            style={{
              fontSize: 19, fontWeight: 700, color: '#1a1a1a',
              border: 'none', borderBottom: '2px solid #1D9E75', outline: 'none',
              background: 'transparent', flex: 1, padding: '2px 0',
            }}
          />
        ) : (
          <h2
            onClick={() => setEditingTitle(true)}
            title="点击编辑标题"
            style={{
              margin: 0, fontSize: 19, fontWeight: 700, color: '#1a1a1a',
              cursor: 'text', flex: 1,
              borderBottom: '2px solid transparent', transition: 'border-color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#e0e0e0'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
          >
            {title}
          </h2>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {saving && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#1D9E75', fontSize: 12 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1D9E75', display: 'inline-block', animation: 'pulse 1s infinite' }} />
              保存中...
            </span>
          )}
          <span style={{ fontSize: 11, color: '#bbb' }}>{note.updated_at?.slice(0, 10)} 更新</span>
        </div>
      </div>

      {/* 编辑器 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }} onPaste={handlePaste}>
        <div style={{ fontSize: 11, color: '#bbb', marginBottom: 6 }}>支持 Markdown，可直接粘贴图片</div>
        <MDEditor
          value={content}
          onChange={handleContentChange}
          preview={preview}
          onTabChange={setPreview}
          data-color-mode="light"
          previewOptions={previewOptions}
          minHeight={400}
        />
      </div>
    </div>
  );
}
