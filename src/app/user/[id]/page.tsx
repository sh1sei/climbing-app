'use client'

import { useEffect, useState } from 'react'
import { createClient, ADMIN_EMAIL } from '@/lib/supabase'
import { deleteImage } from '@/lib/upload'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

/* ========== 型定義 ========== */

type Gym = {
  id: string
  name: string
}

type MyAscent = {
  id: string
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
  // リクエスト関連
  const [gyms, setGyms] = useState<Gym[]>([])
  const [showGymRequest, setShowGymRequest] = useState(false)
  const [showWallRequest, setShowWallRequest] = useState(false)
  const [reqGymName, setReqGymName] = useState('')
  const [reqCoords, setReqCoords] = useState('')
  const [reqWallNames, setReqWallNames] = useState('')
  const [reqGymNote, setReqGymNote] = useState('')
  const [reqWallGymId, setReqWallGymId] = useState('')
  const [reqWallName, setReqWallName] = useState('')
  const [reqWallNote, setReqWallNote] = useState('')
  const [existingWalls, setExistingWalls] = useState<string[]>([])
  const [requestMessage, setRequestMessage] = useState('')
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const isOwner = currentUser?.id === userId

  /* ===== ログアウト ===== */
  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }
  
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
        .select('id, created_at, route_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (ascentsData && ascentsData.length > 0) {
        const routeIds = ascentsData.map((a: any) => a.route_id)
        const { data: routesForAscents } = await supabase
          .from('routes')
          .select('id, grade, image_url, gyms(name), walls(name)')
          .in('id', routeIds)

        const routeMap = new Map(
          (routesForAscents || []).map((r: any) => [r.id, r])
        )

        const formatted = ascentsData.map((a: any) => {
          const routeData = routeMap.get(a.route_id) as any
          return {
            id: a.id,
            created_at: a.created_at,
            route_id: a.route_id,
            route_grade: routeData?.grade || '',
            route_image_url: routeData?.image_url || '',
            gym_name: routeData?.gyms?.[0]?.name || '',
            wall_name: routeData?.walls?.[0]?.name || '',
          }
        })
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

      // ジム一覧取得（壁追加リクエスト用）
      const { data: gymsData } = await supabase
        .from('gyms')
        .select('id, name')
        .order('name')
      if (gymsData) setGyms(gymsData)

      setLoading(false)
    }
    init()
  }, [])

  /* ===== ジム追加リクエスト ===== */
  const handleGymRequest = async () => {
    if (!reqGymName.trim()) {
      setRequestMessage('ジム名を入力してください')
      setTimeout(() => setRequestMessage(''), 3000)
      return
    }

    setRequestSubmitting(true)

    let latitude: number | null = null
    let longitude: number | null = null

    if (reqCoords.trim()) {
      const parts = reqCoords.split(',').map((s) => s.trim())
      if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
        latitude = parseFloat(parts[0])
        longitude = parseFloat(parts[1])
      }
    }

    const wallNamesArray = reqWallNames
      .split(/[,、\n]/)
      .map(s => s.trim())
      .filter(Boolean)

    const { error } = await supabase.from('gym_requests').insert({
      user_id: currentUser!.id,
      gym_name: reqGymName.trim(),
      latitude,
      longitude,
      wall_names: wallNamesArray.length > 0 ? wallNamesArray : null,
      note: reqGymNote.trim() || null,
    })

    setRequestSubmitting(false)
    if (error) {
      setRequestMessage('送信に失敗しました')
    } else {
      setRequestMessage('ジム追加リクエストを送信しました！')
      setReqGymName('')
      setReqCoords('')
      setReqWallNames('')
      setReqGymNote('')
      setShowGymRequest(false)
    }
    setTimeout(() => setRequestMessage(''), 3000)
  }

  /* ===== 壁追加リクエスト ===== */
  const handleWallGymChange = async (gymId: string) => {
    setReqWallGymId(gymId)
    setExistingWalls([])
    if (gymId) {
      const { data } = await supabase
        .from('walls')
        .select('name')
        .eq('gym_id', gymId)
        .order('name')
      if (data) setExistingWalls(data.map((w: any) => w.name))
    }
  }

  const handleWallRequest = async () => {
    if (!reqWallGymId || !reqWallName.trim()) {
      setRequestMessage('ジムと壁の名前を入力してください')
      setTimeout(() => setRequestMessage(''), 3000)
      return
    }
    setRequestSubmitting(true)

    const { error } = await supabase.from('wall_requests').insert({
      user_id: currentUser!.id,
      gym_id: reqWallGymId,
      wall_name: reqWallName.trim(),
      note: reqWallNote.trim() || null,
    })

    setRequestSubmitting(false)
    if (error) {
      setRequestMessage('送信に失敗しました')
    } else {
      setRequestMessage('壁追加リクエストを送信しました！')
      setReqWallGymId('')
      setReqWallName('')
      setReqWallNote('')
      setShowWallRequest(false)
    }
    setTimeout(() => setRequestMessage(''), 3000)
  }

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
      await supabase.from('recommends').delete().eq('route_id', route.id)
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
    <div className="min-h-screen bg-bg pb-80">
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
              <div className="grid grid-cols-2 gap-[2px]">
                {myAscents.map((ascent) => (
                  <Link
                    key={ascent.id}
                    href={`/routes/${ascent.route_id}`}
                    className="block bg-card overflow-hidden rounded-xl"
                  >
                    <div className="aspect-[3/2] overflow-hidden">
                      <img
                        src={ascent.route_image_url}
                        alt="課題"
                        loading="lazy"
                        className="w-full h-full object-cover object-[center_70%] rounded-xl"
                      />
                    </div>
                    <div className="px-3 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-3xl font-bold text-text-main shrink-0">{ascent.route_grade}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xl text-text-sub">
                          {new Date(ascent.created_at).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
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
                <div className="grid grid-cols-2 gap-[2px]">
                  {myRoutes.map((route) => (
                    <Link
                      key={route.id}
                      href={`/routes/${route.id}`}
                      className="block bg-card overflow-hidden rounded-xl"
                    >
                      <div className="aspect-[3/2] overflow-hidden">
                        <img
                          src={route.image_url}
                          alt="課題"
                          loading="lazy"
                          className="w-full h-full object-cover object-[center_70%] rounded-xl"
                        />
                      </div>
                      <div className="px-3 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-3xl font-bold text-text-main shrink-0">{route.grade}</p>
                        </div>
                        <span className="text-xl text-text-sub shrink-0 ml-2">
                          {new Date(route.created_at).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

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

        {/* リクエスト */}
        {isOwner && (
          <div className="mt-8">
            <p className="text-2xl font-bold text-text-main mb-4">ジム・壁の追加リクエスト</p>

            {requestMessage && (
              <p className="mb-4 text-xl text-primary font-medium">{requestMessage}</p>
            )}

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => { setShowGymRequest(!showGymRequest); setShowWallRequest(false) }}
                className={`flex-1 py-3 rounded-xl text-xl font-medium border transition-colors ${
                  showGymRequest ? 'bg-primary text-white border-primary' : 'bg-primary-light text-primary border-border hover:border-primary'
                }`}
              >
                ジム追加
              </button>
              <button
                onClick={() => { setShowWallRequest(!showWallRequest); setShowGymRequest(false) }}
                className={`flex-1 py-3 rounded-xl text-xl font-medium border transition-colors ${
                  showWallRequest ? 'bg-primary text-white border-primary' : 'bg-primary-light text-primary border-border hover:border-primary'
                }`}
              >
                壁追加
              </button>
            </div>

            {/* ジム追加リクエストフォーム */}
            {showGymRequest && (
              <div className="p-5 bg-card rounded-xl border border-border space-y-4">
                <div>
                  <label className="block text-xl font-bold text-text-main mb-2">ジム名 *</label>
                  <input
                    type="text"
                    value={reqGymName}
                    onChange={(e) => setReqGymName(e.target.value)}
                    placeholder="ジム名"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-text-main text-xl focus:outline-none focus:border-primary transition-colors placeholder:text-text-sub/50"
                  />
                </div>
                <div>
                  <label className="block text-xl font-bold text-text-main mb-2">緯度, 経度</label>
                  <input
                    type="text"
                    value={reqCoords}
                    onChange={(e) => setReqCoords(e.target.value)}
                    placeholder="例：35.6812, 139.7671"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-text-main text-xl focus:outline-none focus:border-primary transition-colors placeholder:text-text-sub/50"
                  />
                </div>
                <div>
                  <label className="block text-xl font-bold text-text-main mb-2">壁の名前（カンマ区切り）</label>
                  <input
                    type="text"
                    value={reqWallNames}
                    onChange={(e) => setReqWallNames(e.target.value)}
                    placeholder="例：正面壁, 奥壁, スラブ壁"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-text-main text-xl focus:outline-none focus:border-primary transition-colors placeholder:text-text-sub/50"
                  />
                </div>
                <div>
                  <label className="block text-xl font-bold text-text-main mb-2">備考</label>
                  <input
                    type="text"
                    value={reqGymNote}
                    onChange={(e) => setReqGymNote(e.target.value)}
                    placeholder="補足情報があれば"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-text-main text-xl focus:outline-none focus:border-primary transition-colors placeholder:text-text-sub/50"
                  />
                </div>
                <button
                  onClick={handleGymRequest}
                  disabled={requestSubmitting}
                  style={{ paddingTop: '14px', paddingBottom: '14px' }}
                  className={`w-full rounded-xl text-2xl font-bold transition-colors ${
                    requestSubmitting
                      ? 'bg-border text-text-sub cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary-dark'
                  }`}
                >
                  {requestSubmitting ? '送信中...' : 'リクエストを送信'}
                </button>
              </div>
            )}

            {/* 壁追加リクエストフォーム */}
            {showWallRequest && (
              <div className="p-5 bg-card rounded-xl border border-border space-y-4">
                <div>
                  <label className="block text-xl font-bold text-text-main mb-2">ジム *</label>
                  <select
                    value={reqWallGymId}
                    onChange={(e) => handleWallGymChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-text-main text-xl focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="">ジムを選択</option>
                    {gyms.map((gym) => (
                      <option key={gym.id} value={gym.id}>{gym.name}</option>
                    ))}
                  </select>
                </div>
                {existingWalls.length > 0 && (
                  <div className="p-3 bg-bg rounded-xl">
                    <p className="text-lg text-text-sub mb-2">登録済みの壁：</p>
                    <div className="flex flex-wrap gap-2">
                      {existingWalls.map((name) => (
                        <span key={name} className="px-3 py-1 rounded-full text-lg bg-primary-light text-primary border border-border">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xl font-bold text-text-main mb-2">壁の名前 *</label>
                  <input
                    type="text"
                    value={reqWallName}
                    onChange={(e) => setReqWallName(e.target.value)}
                    placeholder="例：スラブ壁"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-text-main text-xl focus:outline-none focus:border-primary transition-colors placeholder:text-text-sub/50"
                  />
                </div>
                <div>
                  <label className="block text-xl font-bold text-text-main mb-2">備考</label>
                  <input
                    type="text"
                    value={reqWallNote}
                    onChange={(e) => setReqWallNote(e.target.value)}
                    placeholder="補足情報があれば"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-text-main text-xl focus:outline-none focus:border-primary transition-colors placeholder:text-text-sub/50"
                  />
                </div>
                <button
                  onClick={handleWallRequest}
                  disabled={requestSubmitting}
                  style={{ paddingTop: '14px', paddingBottom: '14px' }}
                  className={`w-full rounded-xl text-2xl font-bold transition-colors ${
                    requestSubmitting
                      ? 'bg-border text-text-sub cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary-dark'
                  }`}
                >
                  {requestSubmitting ? '送信中...' : 'リクエストを送信'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ログアウト */}
        {isOwner && (
          <div className="mt-8">
            <button
              onClick={handleLogout}
              style={{ paddingTop: '16px', paddingBottom: '16px' }}
              className="w-full rounded-xl text-2xl font-medium border border-border text-text-sub hover:border-primary transition-colors"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
