/** 诗词阅读浮层 — 古风书卷 */

interface Props {
  visible: boolean
  onClose: () => void
}

const styles = {
  backdrop: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(44,44,44,0.6)', zIndex: 9999,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: {
    background: '#F8F4EE', border: '1px solid #C4B5A0', borderRadius: 4,
    maxWidth: '80%', maxHeight: '80%', overflow: 'auto',
    boxShadow: '0 12px 50px rgba(0,0,0,.4)', width: 600,
  },
  axis: { height: 4, background: 'linear-gradient(90deg,#8B7355,#C4B5A0,#8B7355)' },
  content: { padding: '28px 32px 20px' },
  footer: { textAlign: 'center' as const, padding: '0 32px 20px' },
  closeBtn: {
    padding: '6px 24px', border: '1px solid #C4B5A0',
    background: '#FFFEF9', borderRadius: 3, fontSize: 12,
    cursor: 'pointer', color: '#5B4A3E', fontFamily: 'serif', letterSpacing: 1,
  },
}

export default function PoemReadingOverlay({ visible, onClose }: Props) {
  return (
    <div style={{ display: visible ? 'flex' : 'none', ...styles.backdrop }}
      onClick={onClose}>
      <div style={styles.scroll} onClick={e => e.stopPropagation()}>
        <div style={styles.axis} />
        <div style={styles.content}>
          <div id="poem-view" />
        </div>
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.closeBtn}>合卷</button>
        </div>
        <div style={styles.axis} />
      </div>
    </div>
  )
}
