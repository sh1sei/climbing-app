'use client'

import { useEffect, useState } from 'react'
import { createClient, ADMIN_EMAIL } from '@/lib/supabase'
import { deleteImage } from '@/lib/upload'
import { useParams } from 'next/navigation'
import Link from 'next/link'
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .single()
      if (profile) {
        setNickname(profile.nickname)
        setNewNickname(profile.nickname)
      }

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
      await deleteImage(route.image_url)
      await supabase.from('ascents').delete().eq('route_id', route.id)
      await supabase.from('favorites').delete().eq('route_id', route.id)
      await supabase.from('routes').delete().eq('id', route.id)
      deletedCount++
    }

    setBulkDeleting(false)
    setBulkDeleteMessage(`${deletedCount}件の課題を削除しました`)
    setTimeout(() => setBulkDeleteMessage(''), 3000)

    setMyRoutes((prev) => prev.filter((r) => r.created_at >= cutoffISO))
  }

  /* ========== ローディング ========== */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-text-sub text-2xl">読み込み中...</p>
        </div>
      </div>
    )
  }

  /* ========== メインUI ========== */
  return (
    <div className="min-h-screen bg-bg pb-48">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="w-full px-4 h-24 flex items-center justify-center">
          <h1 className="text-3xl font-bold text-text-main">マイページ</h1>
        </div>
      </header>

      <div className="w-full px-4">

        {/* ニックネーム */}
        <div className="mt-6 p-6 bg-card rounded-xl border border-border">
          {isOwner && editingNickname ? (
            <div>
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="w-full px-4 py-4 rounded-xl border border-border bg-bg text-text-main text-2xl focus:outline-none focus:border-primary transition-colors"
              />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleNicknameUpdate}
                  style={{ paddingTop: '12px', paddingBottom: '12px' }}
                  className="px-8 text-2xl font-medium bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
                >
                  保存
                </button>
                <button
                  onClick={() => { setEditingNickname(false); setNewNickname(nickname) }}
                  style={{ paddingTop: '12px', paddingBottom: '12px' }}
                  className="px-8 text-2xl font-medium bg-card text-text-main border border-border rounded-xl hover:border-primary transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold text-text-main">{nickname}</span>
              {isOwner && (
                <button
                  onClick={() => setEditingNickname(true)}
                  className="px-5 py-2 text-xl font-medium bg-primary-light text-primary border border-border rounded-xl hover:border-primary transition-colors"
                >
                  変更
                </button>
              )}
            </div>
          )}
          {nicknameMessage && (
            <p className="mt-3 text-xl text-primary">{nicknameMessage}</p>
          )}
        </div>

        {/* 統計 */}
        <div className="mt-6 flex gap-3">
          <div className="flex-1 text-center bg-primary-light rounded-xl border border-border" style={{ paddingTop: '24px', paddingBottom: '24px' }}>
            <p className="text-5xl font-bold text-text-main">{myAscents.length}</p>
            <p className="text-xl text-text-sub mt-1">完登数</p>
          </div>
          <div className="flex-1 text-center bg-primary-light rounded-xl border border-border" style={{ paddingTop: '24px', paddingBottom: '24px' }}>
            <p className="text-5xl font-bold text-text-main">{myRoutes.length}</p>
            <p className="text-xl text-text-sub mt-1">投稿数</p>
          </div>
        </div>

        {/* 管理者メニュー */}
        {isOwner && currentUser?.email === ADMIN_EMAIL && (
          <div className="mt-6 p-6 bg-card rounded-xl border border-border">
            <p className="text-xl font-bold text-text-sub mb-4">管理者メニュー</p>
            <div className="flex gap-3">
              <Link
                href="/admin/gyms"
                style={{ paddingTop: '16px', paddingBottom: '16px' }}
                className="flex-1 text-center text-2xl font-medium bg-primary-light text-primary border border-border rounded-xl hover:border-primary transition-colors"
              >
                ジム・壁管理
              </Link>
            </div>
          </div>
        )}

        {/* タブ */}
        <div className="mt-8 flex border-b-2 border-border">
          <button
            onClick={() => setActiveTab('ascents')}
            style={{ paddingTop: '16px', paddingBottom: '16px' }}
            className={`flex-1 text-2xl font-bold transition-colors ${
              activeTab === 'ascents'
                ? 'text-primary border-b-3 border-primary -mb-[2px]'
                : 'text-text-sub'
            }`}
          >
            完登履歴
          </button>
          <button
            onClick={() => setActiveTab('routes')}
            style={{ paddingTop: '16px', paddingBottom: '16px' }}
            className={`flex-1 text-2xl font-bold transition-colors ${
              activeTab === 'routes'
                ? 'text-primary border-b-3 border-primary -mb-[2px]'
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
              <p className="text-center text-text-sub text-2xl" style={{ paddingTop: '48px', paddingBottom: '48px' }}>まだ完登記録がありません</p>
            ) : (
              myAscents.map((ascent) => (
                <Link
                  key={ascent.id}
                  href={`/routes/${ascent.route_id}`}
                  className="flex gap-4 border-b border-border last:border-b-0 hover:bg-primary-light/30 transition-colors -mx-1 px-1 rounded"
                  style={{ paddingTop: '16px', paddingBottom: '16px' }}
                >
                  <img
                    src={ascent.route_image_url}
                    alt="課題"
                    style={{ width: '80px', height: '80px' }}
                    className="object-cover rounded-xl flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-text-main">{ascent.route_grade}</span>
                      <div className="flex items-center gap-2">
                        {ascent.recommended && <span className="text-2xl">👍</span>}
                      </div>
                    </div>
                    <p className="text-xl text-text-sub mt-1 truncate">
                      {ascent.gym_name} / {ascent.wall_name}
                    </p>
                    <p className="text-lg text-text-sub mt-1">
                      {new Date(ascent.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* 投稿した課題 */}
        {activeTab === 'routes' && (
          <div className="mt-4">
            {myRoutes.length === 0 ? (
              <p className="text-center text-text-sub text-2xl" style={{ paddingTop: '48px', paddingBottom: '48px' }}>まだ課題を投稿していません</p>
            ) : (
              <>
                {myRoutes.map((route) => (
                  <Link
                    key={route.id}
                    href={`/routes/${route.id}`}
                    className="flex gap-4 border-b border-border last:border-b-0 hover:bg-primary-light/30 transition-colors -mx-1 px-1 rounded"
                    style={{ paddingTop: '16px', paddingBottom: '16px' }}
                  >
                    <img
                      src={route.image_url}
                      alt="課題"
                      style={{ width: '80px', height: '80px' }}
                      className="object-cover rounded-xl flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-2xl font-bold text-text-main">{route.grade}</span>
                      <p className="text-xl text-text-sub mt-1 truncate">
                        {route.gym_name} / {route.wall_name}
                      </p>
                      <p className="text-lg text-text-sub mt-1">
                        {new Date(route.created_at).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </Link>
                ))}

                {/* 一括削除（本人のみ） */}
                {isOwner && (
                  <div className="mt-8 p-6 bg-card rounded-xl border border-border">
                    <p className="text-xl font-bold text-text-main mb-4">古い投稿の一括削除</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={bulkDeleteDays}
                        onChange={(e) => setBulkDeleteDays(e.target.value)}
                        min="1"
                        style={{ width: '80px' }}
                        className="px-3 py-3 rounded-xl border border-border bg-bg text-text-main text-2xl text-center focus:outline-none focus:border-primary transition-colors"
                      />
                      <span className="text-xl text-text-sub">日以前の課題を</span>
                      <button
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                        className={`px-6 py-3 text-xl font-medium rounded-xl transition-colors ${
                          bulkDeleting
                            ? 'bg-border text-text-sub cursor-not-allowed'
                            : 'bg-primary-light text-primary border border-border hover:border-primary'
                        }`}
                      >
                        {bulkDeleting ? '削除中...' : '一括削除'}
                      </button>
                    </div>
                    {bulkDeleteMessage && (
                      <p className="mt-3 text-xl text-primary">{bulkDeleteMessage}</p>
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
