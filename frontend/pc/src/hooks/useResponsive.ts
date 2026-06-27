/** 响应式断点 hook */
import { useState, useEffect } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

export function useResponsive(): { bp: Breakpoint; isMobile: boolean; isTablet: boolean; isDesktop: boolean } {
  const [bp, setBp] = useState<Breakpoint>(() => getBreakpoint())

  useEffect(() => {
    const onResize = () => setBp(getBreakpoint())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return { bp, isMobile: bp === 'mobile', isTablet: bp === 'tablet', isDesktop: bp === 'desktop' }
}

function getBreakpoint(): Breakpoint {
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}
