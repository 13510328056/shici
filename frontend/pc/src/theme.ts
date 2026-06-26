/* 古风主题 — 中国古代风雅致色调 */
export const theme = {
  /* ─── 色彩系统 ─── */
  bg: '#F5F0EA',           // 宣纸底
  panelBg: '#FFFEF9',       // 牙白面板
  sidebarBg: '#FFFCF7',     // 侧栏底
  headerBg: '#FFFEF9',      // 顶栏
  statusBg: '#F8F4EE',      // 状态栏

  text: '#2C2C2C',          // 墨色正文
  textSecondary: '#7A7266',  // 褐色辅文
  textMuted: '#B0A89C',     // 淡褐说明
  textTitle: '#5B4A3E',     // 深檀标题

  accent: '#C23B22',        // 朱红强调
  accentLight: '#F5E6E2',   // 朱红淡底
  gold: '#B8860B',          // 金色
  goldLight: '#F8F0DC',     // 金色淡底
  jade: '#4A6670',          // 黛青
  jadeLight: '#E8F0F2',     // 黛青淡底

  border: '#E5DDD0',        // 淡墨边框
  borderDark: '#D4C5A9',    // 深框
  divider: '#EDE8E0',       // 分割线

  /* ─── 字号 ─── */
  fsSmall: 11,
  fsBody: 12,
  fsTitle: 13,

  /* ─── 间距 ─── */
  panelPadding: '12px 16px',
  headerPadding: '14px 18px 10px',
} as const

/* ─── 共用样式 ─── */
export const sharedStyles = {
  /* 面板标题（带装饰线） */
  sectionTitle: {
    fontSize: theme.fsTitle,
    fontWeight: 600,
    color: theme.textTitle,
    letterSpacing: 1,
    paddingBottom: 6,
    marginBottom: 8,
    borderBottom: `2px solid ${theme.border}`,
    position: 'relative' as const,
  } as React.CSSProperties,

  /* 古风按钮 */
  classicBtn: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 4,
    border: `1px solid ${theme.borderDark}`,
    background: theme.panelBg,
    color: theme.text,
    fontSize: theme.fsBody,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: 0.5,
  } as React.CSSProperties,

  /* 朱红按钮（强调） */
  accentBtn: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 4,
    border: 'none',
    background: theme.accent,
    color: '#fff',
    fontSize: theme.fsBody,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: 0.5,
  } as React.CSSProperties,

  /* 诗人名标签 */
  poetTag: (bgColor: string) => ({
    display: 'inline-block',
    padding: '3px 10px',
    margin: '3px',
    borderRadius: 3,
    border: 'none',
    background: bgColor,
    color: '#fff',
    fontSize: theme.fsBody,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: 0.5,
  } as React.CSSProperties),

  /* 未选中诗人标签 */
  poetTagInactive: {
    display: 'inline-block',
    padding: '3px 10px',
    margin: '3px',
    borderRadius: 3,
    border: `1px solid ${theme.borderDark}`,
    background: theme.panelBg,
    color: theme.textSecondary,
    fontSize: theme.fsBody,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: 0.5,
  } as React.CSSProperties,

  /* 输入框 */
  input: {
    padding: '4px 8px',
    border: `1px solid ${theme.borderDark}`,
    borderRadius: 3,
    fontSize: theme.fsBody,
    fontFamily: 'inherit',
    background: theme.panelBg,
    color: theme.text,
  } as React.CSSProperties,

  /* 面板 */
  panel: {
    padding: theme.panelPadding,
    borderBottom: `1px solid ${theme.divider}`,
    background: theme.panelBg,
  } as React.CSSProperties,

  /* 图层项 */
  layerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 0',
    fontSize: theme.fsBody,
    color: theme.textSecondary,
  } as React.CSSProperties,
}
