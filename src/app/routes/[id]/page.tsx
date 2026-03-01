'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient, ADMIN_EMAIL } from '@/lib/supabase'
import { deleteImage } from '@/lib/upload'
import { useParams, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

/* ========== 型定義 ========== */

type RouteDetail = {
  id: string
  grade: string
  tags: string[]
  image_url: string
  description: string | null
  hold_type: string[] | null
  style: string | null
  created_at: string
  user_id: string
  gyms: { name: string }[]
  walls: { name: string }[]
}

type Ascent = {
  id: string
  user_id: string
  recommended: boolean
  created_at: string
  profiles: { nickname: string }[]
}

/* ========== コンポーネント ========== */

export default function RouteDetailPage() {
  const params = useParams()
  const routeId = params.id as string
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [route, setRoute] = useState<RouteDetail | null>(null)
  const [ascents, setAscents] = useState<Ascent[]>([])
  const [posterNickname, setPosterNickname] = useState('')
  const [myAscent, setMyAscent] = useState<Ascent | null>(null)
  const [recommended, setRecommended] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [showFullImage, setShowFullImage] = useState(false)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const lastDistance = useRef<number | null>(null)
  const lastCenter = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)
  const lastTouch = useRef<{ x: number; y: number } | null>(null)
  const supabase = createClient()

  /* ===== 初期化 ===== */
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUser(user)

      const { data: routeData } = await supabase
        .from('routes')
        .select('id, grade, tags, image_url, description, hold_type, style, created_at, user_id, gyms(name), walls(name)')
        .eq('id', routeId)
        .single()

      if (routeData) {
        setRoute(routeData as unknown as RouteDetail)

        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', routeData.user_id)
          .single()
        if (profile) setPosterNickname(profile.nickname)
      }

      // お気に入り数取得
      const { count } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('route_id', routeId)
      setFavoriteCount(count || 0)

      // 自分がお気に入り済みか
      if (user) {
        const { data: fav } = await supabase
          .from('favorites')
          .select('id')
          .eq('route_id', routeId)
          .eq('user_id', user.id)
          .maybeSingle()
        setIsFavorited(!!fav)
      }

      await fetchAscents(user?.id)
      setLoading(false)
    }
    init()
  }, [])

  /* ===== 完登記録取得 ===== */
  const fetchAscents = async (userId?: string) => {
    const { data: ascentsData } = await supabase
      .from('ascents')
      .select('id, user_id, recommended, created_at')
      .eq('route_id', routeId)
      .order('created_at', { ascending: false })

    if (ascentsData) {
      const ascentsWithProfile = await Promise.all(
        ascentsData.map(async (ascent: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nickname')
            .eq('id', ascent.user_id)
            .single()
          return { ...ascent, profiles: profile ? [profile] : [] }
        })
      )
      setAscents(ascentsWithProfile as Ascent[])

      if (userId) {
        const mine = ascentsWithProfile.find((a: any) => a.user_id === userId)
        if (mine) {
          setMyAscent(mine as Ascent)
          setRecommended(mine.recommended)
        }
      }
    }
  }

  /* ===== お気に入りトグル ===== */
  const toggleFavorite = async () => {
    if (!user) return

    if (isFavorited) {
      await supabase
        .from('favorites')
        .delete()
        .eq('route_id', routeId)
        .eq('user_id', user.id)
      setIsFavorited(false)
      setFavoriteCount(prev => prev - 1)
    } else {
      await supabase
        .from('favorites')
        .insert({ route_id: routeId, user_id: user.id })
      setIsFavorited(true)
      setFavoriteCount(prev => prev + 1)
    }
  }

  /* ===== 完登記録 ===== */
  const handleAscent = async () => {
    if (!user) {
      setMessage('ログインが必要です')
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('ascents').insert({
      route_id: routeId,
      user_id: user.id,
      recommended,
    })

    if (error) {
      if (error.code === '23505') {
        setMessage('既に完登記録があります')
      } else {
        setMessage('記録に失敗しました')
      }
      setSubmitting(false)
      return
    }

    setMessage('完登記録しました！')
    await fetchAscents(user.id)
    setSubmitting(false)
  }

  const handleDeleteAscent = async () => {
    if (!myAscent) return
    if (!confirm('完登記録を取り消しますか？')) return

    await supabase.from('ascents').delete().eq('id', myAscent.id)
    setMyAscent(null)
    setRecommended(false)
    setMessage('記録を取り消しました')
    await fetchAscents(user?.id)
  }

  const handleDeleteRoute = async () => {
    if (!confirm('この課題を削除しますか？完登記録もすべて削除されます。')) return

    await deleteImage(route!.image_url)
    await supabase.from('routes').delete().eq('id', routeId)
    router.push('/')
  }

  /* ===== 画像拡大 ===== */
  const openImage = () => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
    setShowFullImage(true)
  }

  const closeImage = () => setShowFullImage(false)

  const getDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.sqrt((t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2)

  const getCenter = (t1: React.Touch, t2: React.Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  })

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      lastDistance.current = getDistance(e.touches[0], e.touches[1])
      lastCenter.current = getCenter(e.touches[0], e.touches[1])
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging.current = true
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDistance.current && lastCenter.current) {
      e.preventDefault()
      const newDistance = getDistance(e.touches[0], e.touches[1])
      const ratio = newDistance / lastDistance.current
      setScale((prev) => Math.min(Math.max(prev * ratio, 1), 5))
      lastDistance.current = newDistance
      const newCenter = getCenter(e.touches[0], e.touches[1])
      setTranslate((prev) => ({
        x: prev.x + (newCenter.x - lastCenter.current!.x),
        y: prev.y + (newCenter.y - lastCenter.current!.y),
      }))
      lastCenter.current = newCenter
    } else if (e.touches.length === 1 && isDragging.current && lastTouch.current && scale > 1) {
      const dx = e.touches[0].clientX - lastTouch.current.x
      const dy = e.touches[0].clientY - lastTouch.current.y
      setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  const handleTouchEnd = () => {
    lastDistance.current = null
    lastCenter.current = null
    isDragging.current = false
    lastTouch.current = null
    if (scale <= 1) setTranslate({ x: 0, y: 0 })
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((prev) => {
      const newScale = Math.min(Math.max(prev * delta, 1), 5)
      if (newScale <= 1) setTranslate({ x: 0, y: 0 })
      return newScale
    })
  }

  const getRecommendCount = () => ascents.filter((a) => a.recommended).length

  // 全属性タグをまとめる
  const allTags: string[] = [
    ...(route?.tags || []),
    ...(route?.hold_type || []),
    ...(route?.style ? [route.style] : []),
  ]

  /* ===== ローディング ===== */
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

  if (!route) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <p className="text-text-sub text-sm">課題が見つかりません</p>
      </div>
    )
  }

  const recommendCount = getRecommendCount()
  const canEdit = user && (user.id === route.user_id || user.email === ADMIN_EMAIL)

  /* ========== UI ========== */
  return (
    <div className="min-h-screen bg-bg pb-32">

      {/* ===== 1. 属性タグ ===== */}
      {allTags.length > 0 && (
        <div className="bg-card border-b border-border">
          <div className="w-full max-w-screen-sm mx-auto px-4 py-3 flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs font-medium bg-primary-light text-primary border border-border"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== 2. 画像 ===== */}
      <div className="w-full max-w-screen-sm mx-auto">
        <img
          src={route.image_url}
          alt="課題写真"
          onClick={openImage}
          className="w-full cursor-pointer"
        />
        <p className="text-center text-[10px] text-text-sub mt-1">タップで拡大</p>
      </div>

      {/* フルスクリーン拡大 */}
      {showFullImage && (
        <div
          className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center"
          style={{ touchAction: 'none' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <button
            onClick={closeImage}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center text-lg z-[1001]"
          >
            ✕
          </button>
          <img
            src={route.image_url}
            alt="課題写真（拡大）"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
              transition: lastDistance.current ? 'none' : 'transform 0.1s',
            }}
          />
        </div>
      )}

      <div className="w-full max-w-screen-sm mx-auto px-4">

        {/* ===== 3. 投稿者名、グレード、お気に入り数、完登者数 ===== */}
        <div className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-text-main">{route.grade}</p>
              <p className="text-sm text-text-sub mt-0.5">
                {route.gyms?.[0]?.name} / {route.walls?.[0]?.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-text-main">♡ {favoriteCount}</p>
                <p className="text-[10px] text-text-sub">保存</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-text-main">✓ {ascents.length}</p>
                <p className="text-[10px] text-text-sub">完登</p>
              </div>
              {recommendCount > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-text-main">👍 {recommendCount}</p>
                  <p className="text-[10px] text-text-sub">おすすめ</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-text-sub mt-2">
            投稿:
            <a href={`/user/${route.user_id}`} className="text-primary ml-1 hover:underline">
              {posterNickname}
            </a>
            <span className="mx-1">・</span>
            {new Date(route.created_at).toLocaleDateString('ja-JP')}
          </p>
        </div>

        {/* ===== 4. 一文 + お気に入りボタン ===== */}
        <div className="mt-4 flex items-center justify-between border-t border-b border-border py-3">
          <p className="text-sm text-text-main flex-1">
            {route.description || ''}
          </p>
          {user && (
            <button
              onClick={toggleFavorite}
              className={`ml-3 flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                isFavorited
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-text-sub border-border hover:border-primary'
              }`}
            >
              {isFavorited ? '♥' : '♡'} 保存
            </button>
          )}
        </div>

        {/* ===== 5. 完登記録フォーム ===== */}
        <div className="mt-6">
          <h2 className="text-base font-bold text-text-main">完登記録（{ascents.length}人）</h2>

          {user && !myAscent && (
            <div className="mt-4 p-4 bg-primary-light rounded-xl">
              {/* おすすめ */}
              <p className="text-sm font-bold text-text-main mb-3">この課題をおすすめする？</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRecommended(true)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    recommended
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-text-main border-border hover:border-primary'
                  }`}
                >
                  👍 おすすめ！
                </button>
                <button
                  onClick={() => setRecommended(false)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    !recommended
                      ? 'bg-card text-text-main border-text-sub'
                      : 'bg-card text-text-main border-border hover:border-primary'
                  }`}
                >
                  しない
                </button>
              </div>

              {/* 登録ボタン */}
              <button
                onClick={handleAscent}
                disabled={submitting}
                className={`mt-5 w-full py-3 rounded-xl text-sm font-bold transition-colors ${
                  submitting
                    ? 'bg-border text-text-sub cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary-dark'
                }`}
              >
                {submitting ? '記録中...' : '完登を記録する'}
              </button>
            </div>
          )}

          {myAscent && (
            <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
              <p className="text-sm text-green-700">
                ✅ 完登済み
                {myAscent.recommended && ' 👍 おすすめ'}
              </p>
              <button
                onClick={handleDeleteAscent}
                className="mt-2 px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                記録を取り消す
              </button>
            </div>
          )}

          {message && (
            <p className="mt-2 text-sm text-text-sub">{message}</p>
          )}
        </div>

        {/* ===== 6. 完登者一覧 ===== */}
        {ascents.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-text-main mb-3">完登者</h3>
            <div className="space-y-0">
              {ascents.map((ascent) => (
                <div
                  key={ascent.id}
                  className="flex items-center justify-between py-3 border-b border-border"
                >
                  <a
                    href={`/user/${ascent.user_id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {ascent.profiles?.[0]?.nickname}
                  </a>
                  <div className="flex items-center gap-2">
                    {ascent.recommended && <span className="text-sm">👍</span>}
                    <span className="text-[11px] text-text-sub">
                      {new Date(ascent.created_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 7. 編集・削除ボタン ===== */}
        {canEdit && (
          <div className="mt-8 flex gap-3">
            <a
              href={`/routes/${route.id}/edit`}
              className="flex-1 py-3 text-center rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary-dark transition-colors"
            >
              編集する
            </a>
            <button
              onClick={handleDeleteRoute}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              削除する
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
