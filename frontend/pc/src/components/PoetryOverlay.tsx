/** 诗人作品浮层 — 古风卷轴 */

interface Poem {
  title: string
  content: string
  genre?: string
  mood_tags?: string[]
}

interface Props {
  poetName: string
  poems: Poem[]
  total?: number
  onClose: () => void
  onSelectPoem: (poem: Poem) => void
}

const styles = {
  backdrop: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(44,44,44,0.6)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  scroll: {
    background: '#F8F4EE', border: '1px solid #C4B5A0', borderRadius: 4,
    width: '72%', maxWidth: 720, height: '82%',
    display: 'flex', flexDirection: 'column' as const,
    boxShadow: '0 12px 50px rgba(0,0,0,.4)', position: 'relative' as const,
  },
  axis: { height: 4, background: 'linear-gradient(90deg,#8B7355,#C4B5A0,#8B7355)', borderRadius: '2px 2px 0 0' },
  header: { padding: '20px 28px 12px', borderBottom: '1px solid #D4C5A9', textAlign: 'center' as const, position: 'relative' as const },
  title: { fontSize: 18, fontWeight: 600, color: '#5B4A3E', letterSpacing: 2, fontFamily: 'serif' },
  subtitle: { fontSize: 11, color: '#999', marginTop: 4 },
  closeBtn: {
    position: 'absolute' as const, top: 20, right: 20,
    padding: '4px 12px', border: '1px solid #C4B5A0',
    background: '#FFFEF9', borderRadius: 3, fontSize: 11,
    cursor: 'pointer', color: '#5B4A3E', fontFamily: 'serif',
  },
  list: { flex: 1, overflow: 'auto', padding: '12px 24px' },
  poemCard: {
    padding: '10px 14px', margin: '6px 0', border: '1px solid #E5DDD0',
    borderRadius: 3, cursor: 'pointer', background: '#FFFEF9',
  },
  index: { fontSize: 11, color: '#C4B5A0', fontWeight: 600, minWidth: 24 },
  poemTitle: { fontSize: 14, fontWeight: 600, color: '#5B4A3E', fontFamily: 'serif' },
  genre: { fontSize: 11, color: '#B8A88C', marginLeft: 'auto' as const },
  excerpt: { fontSize: 11, color: '#666', marginLeft: 32, marginTop: 3, lineHeight: 1.5 } as const,
  moodTag: {
    display: 'inline-block', fontSize: 9, padding: '0 5px', margin: '0 2px',
    borderRadius: 6, background: '#EDE7DB', color: '#8B7355',
  } as const,
  empty: { textAlign: 'center' as const, padding: 40, fontSize: 12, color: '#aaa' } as const,
}

/** 取内容前 60 字作为摘要 */
function excerpt(content: string): string {
  const clean = content.replace(/[，。！？、；：""（）《》]/g, ' ').trim()
  return clean.length > 60 ? clean.slice(0, 60) + '……' : clean
}

export default function PoetryOverlay({ poetName, poems, total, onClose, onSelectPoem }: Props) {
  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.scroll} onClick={e => e.stopPropagation()}>
        <div style={styles.axis} />
        <div style={styles.header}>
          <div style={styles.title}>
            {poetName}<span style={{ fontSize: 14, color: '#8B7355', marginLeft: 8 }}>诗文集</span>
          </div>
          <div style={styles.subtitle}>
            收录诗词 {poems.length} 首{total && total > poems.length ? `（共 ${total} 首，显示前 ${poems.length} 首）` : ''}
          </div>
          <button onClick={onClose} style={styles.closeBtn}>闭卷 ✕</button>
        </div>
        <div style={styles.list}>
          {poems.length === 0 ? (
            <div style={styles.empty}>暂无收录作品</div>
          ) : (
            poems.map((poem, idx) => (
              <div key={poem.title + idx} style={styles.poemCard}
                onClick={() => onSelectPoem(poem)}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={styles.index}>{String(idx + 1).padStart(2, '0')}</span>
                  <span style={styles.poemTitle}>{poem.title}</span>
                  <span style={styles.genre}>{poem.genre}</span>
                  {poem.mood_tags?.slice(0, 3).map(t => (
                    <span key={t} style={styles.moodTag}>{t}</span>
                  ))}
                </div>
                <div style={styles.excerpt}>{excerpt(poem.content)}</div>
              </div>
            ))
          )}
        </div>
        <div style={{ ...styles.axis, borderRadius: '0 0 2px 2px' }} />
      </div>
    </div>
  )
}
