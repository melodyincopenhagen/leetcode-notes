import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import rehypePrism from 'rehype-prism-plus';
import remarkBreaks from 'remark-breaks';
import {
  getProblem, addRecord, updateLatest, updateTags, uploadImage, deleteRecord, getRandom,
  getFavorites, createFavorite, addProblemToFavorite, removeProblemFromFavorite, getSimilar,
} from '../api';
import StatusBadge, { STATUS_MAP } from '../components/StatusBadge';
import DifficultyBadge from '../components/DifficultyBadge';
import { formatDatePT } from '../utils/time';

export default function ProblemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [notes, setNotes] = useState('');
  const [remarks, setRemarks] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [activeTab, setActiveTab] = useState('desc');
  const [allFavorites, setAllFavorites] = useState([]);
  const [showFavPicker, setShowFavPicker] = useState(false);
  const [markQueue, setMarkQueue] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('markQueue') || '[]'); }
    catch { return []; }
  });
  // 同一批"标记队列"中已经处理的数量（用于显示 X/N）
  const [queueIndex, setQueueIndex] = useState(() => {
    const n = parseInt(sessionStorage.getItem('markQueueIndex') || '0', 10);
    return isNaN(n) ? 0 : n;
  });
  const [queueTotal, setQueueTotal] = useState(() => {
    const n = parseInt(sessionStorage.getItem('markQueueTotal') || '0', 10);
    return isNaN(n) ? 0 : n;
  });

  // 同步刚完成跳转到第一题时，初始化 total = queue.length + 1（含当前题）
  useEffect(() => {
    if (queueTotal === 0 && markQueue.length > 0) {
      const total = markQueue.length + 1;
      setQueueTotal(total);
      setQueueIndex(1);
      sessionStorage.setItem('markQueueTotal', String(total));
      sessionStorage.setItem('markQueueIndex', '1');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFavorites = () => getFavorites().then(r => setAllFavorites(r.data));
  useEffect(() => { loadFavorites(); }, []);

  const load = () => getProblem(id).then(r => {
    const p = r.data;
    setProblem(p);
    const latest = p.records?.[0];
    setNotes(latest?.notes || '');
    setRemarks(latest?.remarks || '');
    setTagInput(p.tags.join(', '));
  });

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceQueue = () => {
    if (markQueue.length === 0) {
      // 队列结束，清理
      sessionStorage.removeItem('markQueue');
      sessionStorage.removeItem('markQueueIndex');
      sessionStorage.removeItem('markQueueTotal');
      setQueueTotal(0);
      setQueueIndex(0);
      navigate('/');
      return;
    }
    const [next, ...rest] = markQueue;
    sessionStorage.setItem('markQueue', JSON.stringify(rest));
    const newIndex = queueIndex + 1;
    sessionStorage.setItem('markQueueIndex', String(newIndex));
    setMarkQueue(rest);
    setQueueIndex(newIndex);
    navigate(`/problems/${next}`);
  };

  const exitQueue = () => {
    sessionStorage.removeItem('markQueue');
    sessionStorage.removeItem('markQueueIndex');
    sessionStorage.removeItem('markQueueTotal');
    setMarkQueue([]);
    setQueueTotal(0);
    setQueueIndex(0);
  };

  const handleStatus = async (status) => {
    await addRecord(id, { status, notes, remarks });
    if (queueTotal > 0) {
      advanceQueue();
    } else {
      load();
    }
  };

  const saveRemarks = async () => {
    try {
      await updateLatest(id, { remarks });
    } catch (e) {
      if (e.response?.status === 404) alert('请先标记一个状态再保存备注');
      else console.error(e);
    }
  };

  const saveTags = async () => {
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    await updateTags(id, tags);
    load();
  };

  if (!problem) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#888', fontSize: 14 }}>
      加载中...
    </div>
  );

  const latestRecord = problem.records?.[0];

  return (
    <div style={{
      padding: '28px 36px', maxWidth: 1400, margin: '0 auto',
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 24, alignItems: 'start',
    }}>
      <div style={{ minWidth: 0 }}>

      {/* 标记队列进度条 */}
      {queueTotal > 0 && (
        <div style={{
          background: '#fff8e1', border: '1px solid #f0d68c',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ fontSize: 13, color: '#7a5a00' }}>
            正在标记新同步的题：<b>{queueIndex}/{queueTotal}</b>
            {markQueue.length > 0 && <span style={{ color: '#a07a30', marginLeft: 6 }}>（剩余 {markQueue.length} 题）</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={advanceQueue} style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid #d0a35e',
              background: '#fff', color: '#7a5a00', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>跳过 →</button>
            <button onClick={exitQueue} style={{
              padding: '5px 10px', borderRadius: 6, border: '1px solid #e0e0e0',
              background: '#fff', color: '#888', cursor: 'pointer', fontSize: 12,
            }}>退出</button>
          </div>
        </div>
      )}

      {/* 顶部操作栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: '#888', cursor: 'pointer',
            fontSize: 13, padding: '6px 0',
            transition: 'color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#185FA5'}
          onMouseLeave={e => e.currentTarget.style.color = '#888'}
        >
          ← 返回列表
        </button>
        <button
          onClick={async () => {
            try {
              const r = await getRandom();
              if (String(r.data.id) === String(id)) {
                const r2 = await getRandom();
                navigate(`/problems/${r2.data.id}`);
              } else {
                navigate(`/problems/${r.data.id}`);
              }
            } catch {
              alert('没有可随机的题目');
            }
          }}
          style={{
            padding: '7px 13px', background: '#185FA5', color: '#fff',
            border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13,
            fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >
          🎲 随机一题
        </button>
      </div>

      {/* 标题区 */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '24px 28px',
        boxShadow: '0 1px 3px rgba(0,0,0,.06)', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            background: '#f1efe8', color: '#555', borderRadius: 8,
            padding: '4px 10px', fontSize: 13, fontWeight: 600, flexShrink: 0, marginTop: 3,
          }}>
            #{problem.leetcode_id}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.4 }}>
              {problem.title}
            </h1>
            {problem.title_slug && (
              <a
                href={`https://leetcode.com/problems/${problem.title_slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#888', textDecoration: 'none', marginTop: 4, display: 'inline-block', transition: 'color .15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#185FA5'}
                onMouseLeave={e => e.currentTarget.style.color = '#888'}
              >
                leetcode.com/problems/{problem.title_slug} ↗
              </a>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <DifficultyBadge difficulty={problem.difficulty} />
            {latestRecord && <StatusBadge status={latestRecord.status} />}
          </div>
        </div>

        {/* 标签 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder="输入标签，逗号分隔（如：数组, 双指针）"
            style={{
              flex: 1, padding: '7px 12px', borderRadius: 8,
              border: '1px solid #e0e0e0', fontSize: 13, outline: 'none',
              background: '#f9f9f7', transition: 'border .15s', color: '#1a1a1a',
            }}
            onKeyDown={e => e.key === 'Enter' && saveTags()}
            onFocus={e => e.target.style.borderColor = '#1D9E75'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'}
          />
          <ActionButton onClick={saveTags} color="#1D9E75">保存标签</ActionButton>
        </div>

        {/* 已有标签展示 */}
        {problem.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {problem.tags.map(t => (
              <span key={t} style={{
                background: '#f1efe8', color: '#555',
                borderRadius: 5, padding: '3px 9px', fontSize: 12, fontWeight: 500,
              }}>#{t}</span>
            ))}
          </div>
        )}

        {/* 收藏夹 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <span style={{ fontSize: 12, color: '#888', marginRight: 4 }}>收藏夹：</span>
          {problem.favorites?.map(f => (
            <span key={f.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#fff4d6', color: '#9a6b00',
              borderRadius: 5, padding: '3px 4px 3px 9px', fontSize: 12, fontWeight: 500,
            }}>
              ★ {f.name}
              <button
                onClick={async () => {
                  await removeProblemFromFavorite(id, f.id);
                  load();
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9a6b00', fontSize: 14, padding: '0 4px', lineHeight: 1,
                }}
                title="从此收藏夹移除"
              >×</button>
            </span>
          ))}
          {(!problem.favorites || problem.favorites.length === 0) && (
            <span style={{ fontSize: 12, color: '#bbb' }}>未加入任何收藏夹</span>
          )}
          <button
            onClick={() => setShowFavPicker(true)}
            style={{
              background: '#fff', border: '1px dashed #d0a35e', color: '#9a6b00',
              borderRadius: 5, padding: '3px 10px', fontSize: 12, cursor: 'pointer',
            }}
          >+ 加入收藏夹</button>
        </div>
      </div>

      {showFavPicker && (
        <FavoritePicker
          problemId={id}
          allFavorites={allFavorites}
          currentIds={new Set((problem.favorites || []).map(f => f.id))}
          onClose={() => setShowFavPicker(false)}
          onChanged={() => { load(); loadFavorites(); }}
        />
      )}

      {/* 状态 + 历史 */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '20px 28px',
        boxShadow: '0 1px 3px rgba(0,0,0,.06)', marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          标记本次状态
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: problem.records.length > 0 ? 20 : 0 }}>
          {Object.entries(STATUS_MAP).map(([val, s]) => {
            const active = latestRecord?.status === val;
            return (
              <button
                key={val}
                onClick={() => handleStatus(val)}
                style={{
                  padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: active ? s.color : s.bg,
                  color: active ? '#fff' : s.color,
                  border: `1.5px solid ${active ? s.color : s.color + '66'}`,
                  transition: 'all .15s',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* 历史记录 */}
        {problem.records.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              尝试历史
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {problem.records.map(r => (
                <div key={r.id} style={{
                  display: 'flex', gap: 6, alignItems: 'center',
                  background: '#f9f9f7', border: '1px solid #e0e0e0',
                  borderRadius: 8, padding: '5px 10px', fontSize: 12,
                }}>
                  <span style={{ color: '#aaa' }}>{formatDatePT(r.attempted_at)}</span>
                  <StatusBadge status={r.status} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('确认删除这条记录？')) deleteRecord(r.id).then(load);
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#c8bfb0', fontSize: 15, padding: '0 2px', lineHeight: 1,
                      transition: 'color .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#9c3a2a'}
                    onMouseLeave={e => e.currentTarget.style.color = '#c8bfb0'}
                    title="删除"
                  >×</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 内容区 Tabs */}
      <div style={{
        background: '#fff', borderRadius: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}>
        {/* Tab 头 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', padding: '0 12px' }}>
          {[['desc', '📄 题目描述'], ['notes', '✏️ 我的笔记'], ['remarks', '💬 备注']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? '#1D9E75' : '#888',
              borderBottom: activeTab === key ? '2px solid #1D9E75' : '2px solid transparent',
              marginBottom: -1, fontSize: 13, transition: 'color .15s',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* 题目描述 */}
        {activeTab === 'desc' && (
          <div style={{ padding: '24px 28px', lineHeight: 1.8, fontSize: 14, minHeight: 200 }}>
            {problem.description
              ? <div className="problem-desc" dangerouslySetInnerHTML={{ __html: problem.description }} />
              : <span style={{ color: '#888' }}>暂无描述，请用插件同步</span>
            }
          </div>
        )}

        {/* 笔记编辑器 */}
        {activeTab === 'notes' && (
          <div style={{ padding: '20px 24px' }}>
            <NotesEditor problemId={id} initialNotes={notes} remarks={remarks} onNotesChange={setNotes} />
          </div>
        )}

        {/* 备注 */}
        {activeTab === 'remarks' && (
          <div style={{ padding: '20px 28px' }}>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="备注（纯文本）..."
              style={{
                width: '100%', height: 220, padding: '12px 14px', borderRadius: 8,
                border: '1px solid #e0e0e0', fontSize: 14, resize: 'vertical',
                outline: 'none', background: '#f9f9f7', color: '#1a1a1a',
                lineHeight: 1.7, transition: 'border .15s',
              }}
              onFocus={e => e.target.style.borderColor = '#1D9E75'}
              onBlur={e => e.target.style.borderColor = '#e0e0e0'}
            />
            <div style={{ marginTop: 10 }}>
              <ActionButton onClick={saveRemarks} color="#1D9E75">保存备注</ActionButton>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* 右侧 Similar Questions 边栏 */}
      <SimilarSidebar problemId={id} navigate={navigate} />
    </div>
  );
}

function SimilarSidebar({ problemId, navigate }) {
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = (refresh = false) => {
    setLoading(true);
    setError(null);
    getSimilar(problemId, refresh)
      .then(r => setList(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(false); }, [problemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const diffColor = (d) => d === 'Easy' ? '#1D9E75' : d === 'Hard' ? '#c8412b' : '#d99022';

  return (
    <aside style={{
      background: '#fff', borderRadius: 14, padding: '18px 18px 14px',
      boxShadow: '0 1px 3px rgba(0,0,0,.06)', position: 'sticky', top: 16,
      maxHeight: 'calc(100vh - 32px)', overflow: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>🔗 Similar Questions</div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          title="重新抓取"
          style={{
            background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            color: '#888', fontSize: 14, padding: 2,
          }}
        >↻</button>
      </div>

      {loading && !list && <div style={{ color: '#888', fontSize: 12 }}>加载中...</div>}
      {error && <div style={{ color: '#c8412b', fontSize: 12 }}>加载失败：{error}</div>}
      {list && list.length === 0 && <div style={{ color: '#aaa', fontSize: 12 }}>没有非会员的相似题</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list?.map(q => {
          const handleClick = (e) => {
            if (q.solved && q.internal_id) {
              e.preventDefault();
              navigate(`/problems/${q.internal_id}`);
            }
            // 否则保持 <a> 的默认行为：跳到 leetcode
          };
          const href = q.solved && q.internal_id
            ? `/problems/${q.internal_id}`
            : `https://leetcode.com/problems/${q.title_slug}/`;
          const external = !q.solved || !q.internal_id;

          return (
            <a
              key={q.title_slug}
              href={href}
              onClick={handleClick}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8,
                background: q.solved ? '#f0f8f4' : '#f9f9f7',
                border: `1px solid ${q.solved ? '#cce8da' : '#ececec'}`,
                textDecoration: 'none', color: '#1a1a1a',
                transition: 'background .12s, border .12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = q.solved ? '#e3f2eb' : '#f1efe8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = q.solved ? '#f0f8f4' : '#f9f9f7'; }}
            >
              <span style={{
                fontSize: 11, color: '#888', fontWeight: 600, minWidth: 36,
              }}>{q.leetcode_id != null ? `#${q.leetcode_id}` : '#?'}</span>
              <span style={{
                flex: 1, fontSize: 12.5, lineHeight: 1.35, color: '#1a1a1a',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }} title={q.title}>{q.title}</span>
              <span style={{
                fontSize: 10.5, fontWeight: 700, color: diffColor(q.difficulty),
                background: diffColor(q.difficulty) + '1a',
                padding: '2px 6px', borderRadius: 4, flexShrink: 0,
              }}>{q.difficulty?.[0] || '?'}</span>
              <span
                title={q.solved ? '已做过 — 点击查看笔记' : '未做 — 点击去 LeetCode'}
                style={{
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  color: q.solved ? '#1D9E75' : '#aaa',
                  minWidth: 14, textAlign: 'center',
                }}
              >{q.solved ? '✓' : '○'}</span>
            </a>
          );
        })}
      </div>
    </aside>
  );
}

function NotesEditor({ problemId, initialNotes, remarks, onNotesChange }) {
  const [value, setValue] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(initialNotes.trim() ? 'preview' : 'edit');
  const timer = useRef(null);
  const previewOptions = useMemo(() => ({
    remarkPlugins: [remarkBreaks],
    rehypePlugins: [[rehypePrism, { ignoreMissing: true }]],
  }), []);

  const handleChange = (newVal) => {
    setValue(newVal);
    onNotesChange(newVal);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateLatest(problemId, { notes: newVal, remarks });
      } catch (e) {
        if (e.response?.status !== 404) console.error(e);
      }
      setSaving(false);
    }, 1000);
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        const r = await uploadImage(file);
        const imgMd = `\n![image](http://localhost:3001${r.data.url})\n`;
        setValue(v => v + imgMd);
        onNotesChange(value + imgMd);
      }
    }
  };

  return (
    <div onPaste={handlePaste}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>支持 Markdown，可直接粘贴图片</span>
        {saving && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#1D9E75', fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', display: 'inline-block', animation: 'pulse 1s infinite' }} />
            保存中...
          </span>
        )}
      </div>
      <MDEditor
        value={value}
        onChange={handleChange}
        minHeight={300}
        preview={preview}
        onTabChange={setPreview}
        data-color-mode="light"
        previewOptions={previewOptions}
        style={{ height: 'auto' }}
      />
    </div>
  );
}

function FavoritePicker({ problemId, allFavorites, currentIds, onClose, onChanged }) {
  const [newName, setNewName] = useState('');
  const handleToggle = async (f) => {
    if (currentIds.has(f.id)) {
      await removeProblemFromFavorite(problemId, f.id);
    } else {
      await addProblemToFavorite(problemId, f.id);
    }
    onChanged();
  };
  const handleCreateAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const r = await createFavorite(name);
      await addProblemToFavorite(problemId, r.data.id);
      setNewName('');
      onChanged();
    } catch (e) {
      alert(e.response?.data?.error || '创建失败');
    }
  };
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: '20px 24px',
        width: 400, maxHeight: '80vh', overflow: 'auto',
        boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>选择收藏夹</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 18 }}>×</button>
        </div>

        {allFavorites.length === 0 && (
          <div style={{ color: '#888', fontSize: 13, padding: '8px 0 14px' }}>暂无收藏夹，新建一个吧 ↓</div>
        )}

        <div style={{ marginBottom: 14 }}>
          {allFavorites.map(f => {
            const checked = currentIds.has(f.id);
            return (
              <label key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                background: checked ? '#fff4d6' : 'transparent',
              }}>
                <input type="checkbox" checked={checked} onChange={() => handleToggle(f)} />
                <span style={{ fontSize: 13 }}>★ {f.name}</span>
                <span style={{ fontSize: 12, color: '#aaa', marginLeft: 'auto' }}>{f.count} 题</span>
              </label>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, paddingTop: 10, borderTop: '1px solid #e0e0e0' }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateAndAdd()}
            placeholder="新建并加入"
            style={{
              flex: 1, padding: '7px 12px', borderRadius: 7,
              border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', background: '#f9f9f7',
            }}
          />
          <button onClick={handleCreateAndAdd} style={{
            padding: '7px 14px', background: '#1D9E75', color: '#fff',
            border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>新建</button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ onClick, color, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '7px 16px', background: hover ? color : color + 'cc',
        color: '#fff', border: 'none', borderRadius: 8,
        cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .15s',
      }}
    >{children}</button>
  );
}
