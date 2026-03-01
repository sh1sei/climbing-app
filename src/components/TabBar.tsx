'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const TAB_ITEMS = [
  { key: 'home', label: 'ホーム', path: '/', requireAuth: false },
  { key: 'post', label: '投稿', path: '/routes/new', requireAuth: true },
  { key: 'favorites', label: '保存', path: '/favorites', requireAuth: true },
  { key: 'mypage', label: 'マイページ', path: '/mypage', requireAuth: true },
] as const

type TabKey = typeof TAB_ITEMS[number]['key']

/* アイコンSVG */
function TabIcon({ tabKey, active }: { tabKey: TabKey; active: boolean }) {
  const color = active ? '#C9A96E' : '#999999'
  const size = 56
  const stroke = active ? 2.4 : 2

  switch (tabKey) {
    case 'home':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          <path d="M9 21V12h6v9" />
        </svg>
      )
    case 'post':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      )
    case 'favorites':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      )
    case 'mypage':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
  }
}

export default function TabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  // ログインページやセットアップページではタブバーを非表示
  const hiddenPaths = ['/login']
  if (hiddenPaths.some(p => pathname.startsWith(p))) return null

  const getActiveTab = (): TabKey => {
    if (pathname === '/') return 'home'
    if (pathname.startsWith('/routes/new')) return 'post'
    if (pathname.startsWith('/favorites')) return 'favorites'
    if (pathname.startsWith('/user/') || pathname.startsWith('/mypage')) return 'mypage'
    return 'home'
  }

  const activeTab = getActiveTab()

  const handleTabClick = (item: typeof TAB_ITEMS[number]) => {
    // 未ログインで認証必要タブはタップ無効
    if (item.requireAuth && !userId) return

    if (item.key === 'mypage' && userId) {
      router.push(`/user/${userId}`)
      return
    }

    router.push(item.path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="w-full flex items-center justify-around h-24 px-2">
        {TAB_ITEMS.map((item) => {
          const isActive = activeTab === item.key
          const isDisabled = item.requireAuth && !userId
          return (
            <button
              key={item.key}
              onClick={() => handleTabClick(item)}
              disabled={isDisabled}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${
                isDisabled ? 'opacity-35 cursor-default' : ''
              }`}
            >
              <TabIcon tabKey={item.key} active={isActive && !isDisabled} />
              <span className={`text-lg ${
                isDisabled
                  ? 'text-text-sub'
                  : isActive
                    ? 'text-primary font-bold'
                    : 'text-text-sub'
              }`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
