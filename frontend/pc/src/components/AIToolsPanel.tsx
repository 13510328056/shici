/** AI 创作辅助面板 — 对仗/格律/仿写/意境 */

import { theme as T } from '../theme'

const ST = {
  panel: { padding: '6px 12px', borderBottom: '1px solid ' + T.border } as const,
  sectionTitle: { fontSize: 12, fontWeight: 600, color: T.textTitle, marginBottom: 4 } as const,
  animBtn: {
    padding: '2px 10px', margin: '0 4px', borderRadius: 3,
    border: '1px solid ' + T.borderDark, background: T.panelBg,
    fontSize: T.fsBody, cursor: 'pointer', fontFamily: 'inherit',
  } as const,
  label: { fontSize: 11, color: '#888', marginBottom: 4 } as const,
  input: {
    padding: '3px 6px', border: '1px solid #d0cdc4',
    borderRadius: 4, fontSize: 12, fontFamily: 'serif',
  } as const,
  textarea: {
    width: '100%', padding: '4px 6px', border: '1px solid #d0cdc4',
    borderRadius: 4, fontSize: 12, fontFamily: 'serif', resize: 'vertical' as const,
  } as const,
  select: {
    padding: '2px 4px', border: '1px solid #d0cdc4',
    borderRadius: 4, fontSize: 11,
  } as const,
}

export default function AIToolsPanel() {
  const apiCall = async (url: string, body: object) => {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return r.json()
  }

  return (
    <div style={ST.panel}>
      <div style={ST.sectionTitle}>AI 创作辅助</div>

      {/* 对仗推荐 */}
      <div style={ST.label}>对仗推荐</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <input type="text" id="ai-input" placeholder="输入字词" style={{ flex: 1, ...ST.input }} />
        <button onClick={async () => {
          const v = (document.getElementById('ai-input') as HTMLInputElement).value
          if (!v) return
          const d = await apiCall('/api/v1/ai/antithesis/recommend', { input_text: v })
          const el = document.getElementById('ai-results')
          if (el) el.innerHTML = (d.candidates || []).map((c: any) =>
            '<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:8px;border:1px solid #e0dcd4;font-size:12px">' +
            c.word + ' <small style="color:#888">' + c.category + '</small></span>'
          ).join('') || '<span style="font-size:11px;color:#aaa">无推荐</span>'
        }} style={ST.animBtn}>推荐</button>
      </div>
      <div id="ai-results" style={{ minHeight: 20, marginBottom: 6 }} />

      {/* 格律校验 */}
      <div style={ST.label}>格律校验</div>
      <textarea id="rhythm-input" placeholder="输入诗句" rows={2} style={ST.textarea} />
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <select id="rhythm-genre" style={ST.select}>
          <option value="七绝">七绝</option><option value="七律">七律</option>
          <option value="五绝" selected>五绝</option><option value="五律">五律</option>
        </select>
        <button onClick={async () => {
          const c = (document.getElementById('rhythm-input') as HTMLTextAreaElement).value
          const g = (document.getElementById('rhythm-genre') as HTMLSelectElement).value
          if (!c) return
          const d = await apiCall('/api/v1/ai/rhythm/check', { content: c, genre: g, rhyme_system: '平水韵' })
          const el = document.getElementById('rhythm-results')
          if (!el) return
          if (d.passed) {
            el.innerHTML = '<span style="font-size:12px;color:#4CAF50">格律无误</span>'
          } else {
            el.innerHTML = '<div style="font-size:12px;color:#E91E63">发现 ' + d.errors.length + ' 处问题：</div>' +
              d.errors.map((e: any) =>
                '<div style="font-size:11px;color:#666;padding:2px 0"><span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#fdd;margin-right:4px;font-size:10px">' +
                e.type + '</span>' + String(e.message || '').slice(0, 50) + '</div>'
              ).join('')
          }
        }} style={ST.animBtn}>校验</button>
      </div>
      <div id="rhythm-results" style={{ minHeight: 20, marginTop: 4, marginBottom: 6 }} />

      {/* 仿写改写 */}
      <div style={ST.label}>仿写改写</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        <select id="rw-mode" style={{ flex: 1, minWidth: 60, ...ST.select }}>
          <option value="style">风格仿写</option><option value="expand">短句扩写</option>
          <option value="convert">体裁互转</option><option value="perspective">视角改写</option>
        </select>
        <select id="rw-style" style={{ width: 80, ...ST.select }}>
          <option value="唐诗雄浑">唐诗雄浑</option><option value="宋词婉约">宋词婉约</option>
          <option value="边塞豪放">边塞豪放</option>
        </select>
        <select id="rw-genre" style={{ width: 60, ...ST.select }}>
          <option value="七绝">七绝</option><option value="七律">七律</option>
          <option value="五绝" selected>五绝</option>
        </select>
      </div>
      <textarea id="rw-input" placeholder="输入诗句或关键词" rows={2} style={ST.textarea} />
      <button onClick={async () => {
        const mode = (document.getElementById('rw-mode') as HTMLSelectElement).value
        const style = (document.getElementById('rw-style') as HTMLSelectElement).value
        const genre = (document.getElementById('rw-genre') as HTMLSelectElement).value
        const input = (document.getElementById('rw-input') as HTMLTextAreaElement).value
        let url = '', body: any = {}
        if (mode === 'style') { url = '/api/v1/ai/rewrite/style'; body = { content: input, style, genre } }
        else if (mode === 'expand') { url = '/api/v1/ai/rewrite/expand'; body = { input, genre } }
        else if (mode === 'convert') { url = '/api/v1/ai/rewrite/convert'; body = { content: input, from_genre: genre, to_genre: genre === '五绝' ? '七绝' : '五绝' } }
        else { url = '/api/v1/ai/rewrite/perspective'; body = { content: input, perspective: style === '唐诗雄浑' ? '隐士' : '游子' } }
        try {
          const d = await apiCall(url, body)
          const el = document.getElementById('rw-results')
          if (el) el.innerHTML = '<div style="font-size:12px;line-height:1.8;color:#333;padding:6px;background:#f5f0ea;border-radius:4px">' +
            (d.result || d.error || '无结果') + '</div>' +
            (d.note ? '<div style="font-size:10px;color:#888;margin-top:2px">' + d.note + '</div>' : '')
        } catch (_) { /* 静默 */ }
      }} style={{ ...ST.animBtn, width: '100%', marginTop: 4 }}>生成</button>
      <div id="rw-results" style={{ minHeight: 20, marginTop: 4, marginBottom: 4 }} />

      {/* 意境匹配 */}
      <div style={ST.label}>意境匹配创作</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        <select id="mood-select" style={{ flex: 1, minWidth: 80, ...ST.select }}>
          {['山水', '送别', '思乡', '边塞', '田园', '怀古', '登临', '闺怨'].map(m =>
            <option key={m} value={m} selected={m === '山水'}>{m}</option>)}
        </select>
        <select id="mood-season" style={{ width: 60, ...ST.select }}>
          <option value="">四季</option><option value="春">春</option><option value="夏">夏</option>
          <option value="秋">秋</option><option value="冬">冬</option>
        </select>
        <select id="mood-level" style={{ width: 60, ...ST.select }}>
          <option value="入门">入门</option><option value="进阶">进阶</option>
        </select>
      </div>
      <button onClick={async () => {
        const mood = (document.getElementById('mood-select') as HTMLSelectElement).value
        const season = (document.getElementById('mood-season') as HTMLSelectElement).value
        const level = (document.getElementById('mood-level') as HTMLSelectElement).value
        const d = await apiCall('/api/v1/ai/mood/generate', { mood_tag: mood, season, level })
        const el = document.getElementById('mood-results')
        if (!el) return
        el.innerHTML = '<div style="font-size:12px;font-weight:600;margin-bottom:4px">【' + d.mood + '】' + d.description + '</div>' +
          '<div style="font-size:11px;color:#666;margin-bottom:4px">推荐意象：' + d.recommended_imagery.join('、') + '</div>' +
          (d.framework?.tips?.length
            ? '<div style="font-size:11px;color:#555">创作提示：<ul style="margin:2px 0;padding-left:16px">' +
              d.framework.tips.map((t: string) => '<li>' + t + '</li>').join('') + '</ul></div>'
            : '')
      }} style={{ ...ST.animBtn, width: '100%', marginTop: 2 }}>生成创作框架</button>
      <div id="mood-results" style={{ minHeight: 20, marginTop: 6, fontSize: 12, lineHeight: 1.6 }} />
    </div>
  )
}
