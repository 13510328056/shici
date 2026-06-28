export default function Seal({ text }: { text: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 5px', fontSize: 10,
      color: '#c23a3a', border: '1.5px solid #c23a3a', borderRadius: 2,
      fontFamily: '"Ma Shan Zheng",serif', lineHeight: 1,
      transform: 'rotate(-2deg)', letterSpacing: 1,
    }}>
      {text}
    </span>
  )
}
