'use client'

import { useEffect, useState } from 'react'
import { createClient, ADMIN_EMAIL } from '@/lib/supabase'
import { deleteImage } from '@/lib/upload'
import { useParams } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

/* ========== 型定義 ========== */

type MyAscent = {
  id: string
  recommended: boolean
  created_at: string
  route_id: string
  route_grade: string
  route_image_url: string
  gym_name: string
  wall_name: string
}

type MyRoute = {
  id: string
  grade: string
  image_url: string
  created_at: string
  gym_name: string
  wall_name: string
}

/* ========== コンポーネント ========== */

export default function UserPage() {
  const params = useParams()
  const userId = params.id as string
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [nickname, setNickname] = useState('')
  const [newNickname, setNewNickname] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [myAscents, setMyAscents] = useState<MyAscent[]>([])
  const [myRoutes, setMyRoutes] = useState<MyRoute[]>([])
  const [activeTab, setActiveTab] = useState<'ascents' | 'routes'>('ascents')
  const [loading, setLoading] = useState(true)
  const [nicknameMessage, setNicknameMessage] = useState('')
  const [bulkDeleteDays, setBulkDeleteDays] = useState('90')
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteMessage, setBulkDeleteMessage] = useState('')
  const supabase = createClient()

  const isOwner = currentUser?.id === userId

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUser(user)

      // ニックネーム取得
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .single()
      if (profile) {
        setNickname(profile.nickname)
        setNewNickname(profile.nickname)
      }

      // 完登履歴取得
      const { data: ascentsData } = await supabase
        .from('ascents')
        .select('id, recommended, created_at, route_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (ascentsData) {
        const formatted = await Promise.all(
          ascentsData.map(async (a: any) => {
            const { data: routeData } = await supabase
              .from('routes')
              .select('id, grade, image_url, gyms(name), walls(name)')
              .eq('id', a.route_id)
              .single()
            return {
              id: a.id,
              recommended: a.recommended,
              created_at: a.created_at,
              route_id: a.route_id,
              route_grade: routeData?.grade || '',
              route_image_url: routeData?.image_url || '',
              gym_name: (routeData as any)?.gyms?.[0]?.name || '',
              wall_name: (routeData as any)?.walls?.[0]?.name || '',
            }
          })
        )
        setMyAscents(formatted)
      }

      // 投稿した課題取得
      const { data: routesData } = await supabase
        .from('routes')
        .select('id, grade, image_url, created_at, gyms(name), walls(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (routesData) {
        const formatted = routesData.map((r: any) => ({
          id: r.id,
          grade: r.grade,
          image_url: r.image_url,
          created_at: r.created_at,
          gym_name: r.gyms?.[0]?.name || '',
          wall_name: r.walls?.[0]?.name || '',
        }))
        setMyRoutes(formatted)
      }

      setLoading(false)
    }
    init()
  }, [])

  const handleNicknameUpdate = async () => {
    if (!newNickname.trim()) {
      setNicknameMessage('ニックネームを入力してください')
      return
    }
    if (newNickname.trim() === nickname) {
      setEditingNickname(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ nickname: newNickname.trim() })
      .eq('id', userId)

    if (error) {
      setNicknameMessage('更新に失敗しました')
      return
    }

    setNickname(newNickname.trim())
    setEditingNickname(false)
    setNicknameMessage('更新しました！')
    setTimeout(() => setNicknameMessage(''), 2000)
  }

  /* ========== 古い投稿の一括削除 ========== */
  const handleBulkDelete = async () => {
    const days = parseInt(bulkDeleteDays)
    if (isNaN(days) || days <= 0) return

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffISO = cutoffDate.toISOString()

    const oldRoutes = myRoutes.filter((r) => r.created_at < cutoffISO)

    if (oldRoutes.length === 0) {
      setBulkDeleteMessage('該当する課題がありません')
      setTimeout(() => setBulkDeleteMessage(''), 3000)
      return
    }

    if (!confirm(`${days}日以前の課題 ${oldRoutes.length}件を削除しますか？\n画像・完登記録もすべて削除されます。この操作は元に戻せません。`)) {
      return
    }

    setBulkDeleting(true)
    let deletedCount = 0

    for (const route of oldRoutes) {
      // R2から画像削除
      await deleteImage(route.image_url)
      // DBから課題削除（ascentsはカスケードで消えるか手動削除）
      await supabase.from('ascents').delete().eq('route_id', route.id)
      await supabase.from('favorites').delete().eq('route_id', route.id)
      await supabase.from('routes').delete().eq('id', route.id)
      deletedCount++
    }

    setBulkDeleting(false)
    setBulkDeleteMessage(`${deletedCount}件の課題を削除しました`)
    setTimeout(() => setBulkDeleteMessage(''), 3000)

    // 一覧を更新
    setMyRoutes((prev) => prev.filter((r) => r.created_at >= cutoffISO))
  }

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
        <div className="w-full max-w-screen-sm mx-auto px-4 h-14 flex items-center">
          <a href="/" className="text-text-sub hover:text-primary transition-colors text-sm">
            ← ホーム
          </a>
        </div>
      </header>

      <div className="w-full max-w-screen-sm mx-auto px-4">

        {/* ニックネーム */}
        <div className="mt-4 p-4 bg-card rounded-xl border border-border">
          {isOwner && editingNickname ? (
            <div>
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg text-text-main text-base focus:outline-none focus:border-primary transition-colors"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleNicknameUpdate}
                  className="px-5 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  保存
                </button>
                <button
                  onClick={() => { setEditingNickname(false); setNewNickname(nickname) }}
                  className="px-5 py-2 text-sm font-medium bg-card text-text-main border border-border rounded-lg hover:border-primary transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-text-main">{nickname}</span>
              {isOwner && (
                <button
                  onClick={() => setEditingNickname(true)}
                  className="px-3 py-1 text-xs font-medium bg-primary-light text-primary border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors"
                >
                  変更
                </button>
              )}
            </div>
          )}
          {nicknameMessage && (
            <p className="mt-2 text-xs text-primary">{nicknameMessage}</p>
          )}
        </div>

        {/* 統計 */}
        <div className="mt-4 flex gap-3">
          <div className="flex-1 text-center py-4 bg-primary-light rounded-xl border border-primary/10">
            <p className="text-2xl font-bold text-text-main">{myAscents.length}</p>
            <p className="text-xs text-text-sub mt-0.5">完登数</p>
          </div>
          <div className="flex-1 text-center py-4 bg-primary-light rounded-xl border border-primary/10">
            <p className="text-2xl font-bold text-text-main">{myRoutes.length}</p>
            <p className="text-xs text-text-sub mt-0.5">投稿数</p>
          </div>
        </div>

        {/* 管理者メニュー */}
        {isOwner && currentUser?.email === ADMIN_EMAIL && (
          <div className="mt-4 p-4 bg-card rounded-xl border border-border">
            <p className="text-xs font-bold text-text-sub mb-3">管理者メニュー</p>
            <div className="flex gap-3">
              <a
                href="/admin/gyms"
                className="flex-1 py-2.5 text-center text-sm font-medium bg-primary-light text-primary border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors"
              >
                ジム・壁管理
              </a>
            </div>
          </div>
        )}

        {/* タブ */}
        <div className="mt-6 flex border-b-2 border-border">
          <button
            onClick={() => setActiveTab('ascents')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === 'ascents'
                ? 'text-primary border-b-2 border-primary -mb-[2px]'
                : 'text-text-sub'
            }`}
          >
            完登履歴
          </button>
          <button
            onClick={() => setActiveTab('routes')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === 'routes'
                ? 'text-primary border-b-2 border-primary -mb-[2px]'
                : 'text-text-sub'
            }`}
          >
            投稿した課題
          </button>
        </div>

        {/* 完登履歴 */}
        {activeTab === 'ascents' && (
          <div className="mt-4">
            {myAscents.length === 0 ? (
              <p className="text-center text-text-sub text-sm py-12">まだ完登記録がありません</p>
            ) : (
              myAscents.map((ascent) => (
                <a
                  key={ascent.id}
                  href={`/routes/${ascent.route_id}`}
                  className="flex gap-3 py-3 border-b border-border last:border-b-0 hover:bg-primary-light/30 transition-colors -mx-1 px-1 rounded"
                >
                  <img
                    src={ascent.route_image_url}
                    alt="課題"
                    className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-text-main">{ascent.route_grade}</span>
                      <div className="flex items-center gap-1.5">
                        {ascent.recommended && <span className="text-sm">👍</span>}
                      </div>
                    </div>
                    <p className="text-xs text-text-sub mt-0.5 truncate">
                      {ascent.gym_name} / {ascent.wall_name}
                    </p>
                    <p className="text-[11px] text-text-sub mt-0.5">
                      {new Date(ascent.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        )}

        {/* 投稿した課題 */}
        {activeTab === 'routes' && (
          <div className="mt-4">
            {myRoutes.length === 0 ? (
              <p className="text-center text-text-sub text-sm py-12">まだ課題を投稿していません</p>
            ) : (
              <>
                {myRoutes.map((route) => (
                  <a
                    key={route.id}
                    href={`/routes/${route.id}`}
                    className="flex gap-3 py-3 border-b border-border last:border-b-0 hover:bg-primary-light/30 transition-colors -mx-1 px-1 rounded"
                  >
                    <img
                      src={route.image_url}
                      alt="課題"
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-base font-bold text-text-main">{route.grade}</span>
                      <p className="text-xs text-text-sub mt-0.5 truncate">
                        {route.gym_name} / {route.wall_name}
                      </p>
                      <p className="text-[11px] text-text-sub mt-0.5">
                        {new Date(route.created_at).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </a>
                ))}

                {/* 一括削除（本人のみ） */}
                {isOwner && (
                  <div className="mt-6 p-4 bg-card rounded-xl border border-border">
                    <p className="text-xs font-bold text-text-main mb-3">古い投稿の一括削除</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={bulkDeleteDays}
                        onChange={(e) => setBulkDeleteDays(e.target.value)}
                        min="1"
                        className="w-20 px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-sm text-center focus:outline-none focus:border-primary transition-colors"
                      />
                      <span className="text-sm text-text-sub">日以前の課題を</span>
                      <button
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                        className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                          bulkDeleting
                            ? 'bg-border text-text-sub cursor-not-allowed'
                            : 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100'
                        }`}
                      >
                        {bulkDeleting ? '削除中...' : '一括削除'}
                      </button>
                    </div>
                    {bulkDeleteMessage && (
                      <p className="mt-2 text-xs text-primary">{bulkDeleteMessage}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
