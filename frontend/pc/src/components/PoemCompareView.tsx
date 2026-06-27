/** 多诗对比视图 — 横向逐句对比 */

interface PoemItem {
  title: string
  content: string
  author?: string
  genre?: string
  mood_tags?: string[]
  dynasty?: string
}

interface Props {
  poems: PoemItem[]
  onClose: () => void
}

const styles = {
  backdrop: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(44,44,44,0.6)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    background: '#F8F4EE', border: '1px solid #C4B5A0', borderRadius: 4,
    width: '85%', maxWidth: 960, maxHeight: '85%',
    display: 'flex', flexDirection: 'column' as const,
    boxShadow: '0 12px 50px rgba(0,0,0,.4)',
  },
  header: {
    padding: '16px 24px', borderBottom: '1px solid #D4C5A9',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: 600, color: '#5B4A3E', fontFamily: 'serif' },
  body: { flex: 1, overflow: 'auto', padding: '16px 24px', display: 'flex', gap: 16 },
  col: { flex: 1, minWidth: 0, border: '1px solid #E5DDD0', borderRadius: 4, background: '#FFFEF9', padding: 12 },
  colHeader: { fontSize: 13, fontWeight: 600, color: '#5B4A3E', paddingBottom: 8, borderBottom: '1px solid #E5DDD0', marginBottom: 8, fontFamily: 'serif' },
  meta: { fontSize: 10, color: '#888', marginBottom: 6 },
  content: { fontSize: 13, lineHeight: 2, fontFamily: 'serif', color: '#333', whiteSpace: 'pre-wrap' as const },
  closeBtn: {
    padding: '4px 12px', border: '1px solid #C4B5A0',
    background: '#FFFEF9', borderRadius: 3, fontSize: 11,
    cursor: 'pointer', color: '#5B4A3E', fontFamily: 'serif',
  },
  empty: { fontSize: 11, color: '#aaa', textAlign: 'center' as const, padding: 40 },
  tag: {
    display: 'inline-block', fontSize: 9, padding: '0 5px', margin: '0 1px',
    borderRadius: 6, background: '#EDE7DB', color: '#8B7355',
  } as const,
}

export default function PoemCompareView({ poems, onClose }: Props) {
  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.card} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>📖 多诗对比 ({poems.length} 首)</span>
          <button onClick={onClose} style={styles.closeBtn}>关闭 ✕</button>
        </div>
        <div style={styles.body}>
          {poems.map((p, i) => (
            <div key={i} style={styles.col}>
              <div style={styles.colHeader}>{p.title}</div>
              <div style={styles.meta}>
                {p.author} · {p.genre || ''} · {p.dynasty || ''}
                {p.mood_tags?.map(t => <span key={t} style={styles.tag}>{t}</span>)}
              </div>
              <div style={styles.content}>{p.content}</div>
            </div>
          ))}
          {poems.length === 0 && <div style={styles.empty}>暂无诗词可选择对比</div>}
        </div>
      </div>
    </div>
  )
}
