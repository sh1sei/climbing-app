'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

/* ========== 型定義 ========== */

type FavoriteRoute = {
  id: string
  grade: string
  image_url: string
  poster_nickname: string
  favorite_count: number
  ascent_count: number
}

/* ========== コンポーネント ========== */

export default function FavoritesPage() {
  const [routes, setRoutes] = useState<FavoriteRoute[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 自分のお気に入り一覧を取得
      const { data: favData } = await supabase
        .from('favorites')
        .select('route_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!favData || favData.length === 0) {
        setRoutes([])
        setLoading(false)
        return
      }

      const routeIds = favData.map((f) => f.route_id)

      // routes_with_counts ビューから課題情報を取得
      const { data: routesData } = await supabase
        .from('routes_with_counts')
        .select('id, grade, image_url, poster_nickname, favorite_count, ascent_count')
        .in('id', routeIds)

      if (routesData) {
        // お気に入り順（新しい順）を維持
        const routeMap = new Map(routesData.map((r) => [r.id, r]))
        const ordered = routeIds
          .map((id) => routeMap.get(id))
          .filter(Boolean) as FavoriteRoute[]
        setRoutes(ordered)
      }

      setLoading(false)
    }
    init()
  }, [])

  /* ========== ローディング ========== */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-text-sub text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  /* ========== メインUI ========== */
  return (
    <div className="min-h-screen bg-bg pb-32">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="w-full max-w-screen-sm mx-auto px-4 h-14 flex items-center justify-center">
          <h1 className="text-lg font-bold text-text-main">保存した課題</h1>
        </div>
      </header>

      <main className="w-full max-w-screen-sm mx-auto px-4 pt-4">
        {routes.length === 0 ? (
          <p className="text-center text-text-sub text-sm py-16">
            まだ課題を保存していません
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {routes.map((route) => (
              <a
                key={route.id}
                href={`/routes/${route.id}`}
                className="block bg-card rounded-xl overflow-hidden border border-border hover:shadow-md transition-shadow"
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={route.image_url}
                    alt="課題写真"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2.5">
                  <p className="text-xs text-text-sub truncate">
                    {route.poster_nickname}
                  </p>
                  <p className="text-base font-bold text-text-main mt-0.5">
                    {route.grade}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-text-sub flex items-center gap-0.5">
                      ♡ {route.favorite_count}
                    </span>
                    <span className="text-xs text-text-sub flex items-center gap-0.5">
                      ✓ {route.ascent_count}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
