import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import rehypePrism from 'rehype-prism-plus';
import remarkBreaks from 'remark-breaks';
import { getProblem, addRecord, updateLatest, updateTags, uploadImage, deleteRecord } from '../api';
import StatusBadge, { STATUS_MAP } from '../components/StatusBadge';
import DifficultyBadge from '../components/DifficultyBadge';

export default function ProblemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [notes, setNotes] = useState('');
  const [remarks, setRemarks] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [activeTab, setActiveTab] = useState('desc');

  const load = () => getProblem(id).then(r => {
    const p = r.data;
    setProblem(p);
    const latest = p.records?.[0];
    setNotes(latest?.notes || '');
    setRemarks(latest?.remarks || '');
    setTagInput(p.tags.join(', '));
  });

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatus = async (status) => {
    await addRecord(id, { status, notes, remarks });
    load();
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
    <div style={{ padding: '28px 36px', maxWidth: 1400, margin: '0 auto' }}>

      {/* 返回 */}
      <button
        onClick={() => navigate('/')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', color: '#888', cursor: 'pointer',
          fontSize: 13, padding: '6px 0', marginBottom: 20,
          transition: 'color .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#185FA5'}
        onMouseLeave={e => e.currentTarget.style.color = '#888'}
      >
        ← 返回列表
      </button>

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
      </div>

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
                  <span style={{ color: '#aaa' }}>{r.attempted_at?.slice(0, 10)}</span>
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
