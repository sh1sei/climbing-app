'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient, ADMIN_EMAIL } from '@/lib/supabase'
import { deleteImage } from '@/lib/upload'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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
  const [isFavorited, setIsFavorited] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [isRecommended, setIsRecommended] = useState(false)
  const [recommendCount, setRecommendCount] = useState(0)
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
      const { count: favCount } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('route_id', routeId)
      setFavoriteCount(favCount || 0)

      // おすすめ数取得（新テーブル）
      const { count: recCount } = await supabase
        .from('recommends')
        .select('*', { count: 'exact', head: true })
        .eq('route_id', routeId)
      setRecommendCount(recCount || 0)

      // 自分がお気に入り済みか
      if (user) {
        const { data: fav } = await supabase
          .from('favorites')
          .select('id')
          .eq('route_id', routeId)
          .eq('user_id', user.id)
          .maybeSingle()
        setIsFavorited(!!fav)

        // 自分がおすすめ済みか
        const { data: rec } = await supabase
          .from('recommends')
          .select('id')
          .eq('route_id', routeId)
          .eq('user_id', user.id)
          .maybeSingle()
        setIsRecommended(!!rec)
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
      .select('id, user_id, created_at')
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

  /* ===== おすすめトグル（新テーブル） ===== */
  const toggleRecommend = async () => {
    if (!user) return

    if (isRecommended) {
      await supabase
        .from('recommends')
        .delete()
        .eq('route_id', routeId)
        .eq('user_id', user.id)
      setIsRecommended(false)
      setRecommendCount(prev => prev - 1)
    } else {
      await supabase
        .from('recommends')
        .insert({ route_id: routeId, user_id: user.id })
      setIsRecommended(true)
      setRecommendCount(prev => prev + 1)
    }
  }

  /* ===== 完登記録 ===== */
  const handleAscent = async () => {
    if (!user) {
      setMessage('ログインが必要です')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('ascents').insert({
      route_id: routeId,
      user_id: user.id,
    })

    if (error) {
      if (error.code === '23505') {
        setMessage('既に完登記録があります')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('記録に失敗しました')
        setTimeout(() => setMessage(''), 3000)
      }
      setSubmitting(false)
      return
    }

    setMessage('完登記録しました！')
    setTimeout(() => setMessage(''), 3000)
    await fetchAscents(user.id)
    setSubmitting(false)
  }

  const handleDeleteAscent = async () => {
    if (!myAscent) return
    if (!confirm('完登記録を取り消しますか？')) return

    await supabase.from('ascents').delete().eq('id', myAscent.id)
    setMyAscent(null)
    setMessage('記録を取り消しました')
    setTimeout(() => setMessage(''), 3000)
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
          <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-text-sub text-2xl">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!route) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <p className="text-text-sub text-2xl">課題が見つかりません</p>
      </div>
    )
  }

  const canEdit = user && (user.id === route.user_id || user.email === ADMIN_EMAIL)

  /* ========== UI ========== */
  return (
    <div className="min-h-screen bg-bg" style={{ paddingBottom: '200px' }}>

      {/* ===== 1. 画像 ===== */}
      <div className="w-full">
        <img
          src={route.image_url}
          alt="課題写真"
          loading="lazy"
          onClick={openImage}
          className="w-full cursor-pointer object-cover"
          style={{ maxHeight: '60vh' }}
        />
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
            className="absolute top-4 right-4 w-14 h-14 bg-white/20 text-white rounded-full flex items-center justify-center text-2xl z-[1001]"
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

      {/* ===== 2. 属性タグ ===== */}
      {allTags.length > 0 && (
        <div className="bg-card border-b border-border">
          <div className="w-full px-4 py-3 flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <span
                key={tag}
                className="px-5 py-2 rounded-full text-2xl font-medium bg-primary-light text-primary border border-border"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== 3. グレード｜投稿者+投稿日｜保存数+完投数（3カラム） ===== */}
      <div className="bg-card border-b border-border">
        <div className="w-full px-4 py-4 grid grid-cols-3 items-center">
          {/* グレード */}
          <div>
            <p className="text-5xl font-bold text-text-main">{route.grade}</p>
          </div>
          {/* 投稿者 + 投稿日 */}
          <div className="text-center">
            <Link
              href={`/user/${route.user_id}`}
              className="text-2xl text-primary hover:underline"
            >
              {posterNickname}
            </Link>
            <p className="text-xl text-text-sub mt-1">
              {new Date(route.created_at).toLocaleDateString('ja-JP')}
            </p>
          </div>
          {/* 保存数 + 完投数 */}
          <div className="flex items-center justify-end gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-text-main">♡ {favoriteCount}</p>
              <p className="text-lg text-text-sub">保存</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-text-main">✓ {ascents.length}</p>
              <p className="text-lg text-text-sub">完登</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 4. 課題の説明文 ===== */}
      {route.description && (
        <div className="bg-card border-b border-border">
          <p className="w-full px-4 py-4 text-2xl text-text-main">
            {route.description}
          </p>
        </div>
      )}

      {/* ===== 5. お気に入り｜おすすめ（2カラム） ===== */}
      <div style={{ height: '16px' }}></div>
      <div className="bg-card border-b border-border">
        <div className="w-full px-4 py-4 grid grid-cols-2 gap-3">
          {/* お気に入り保存ボタン */}
          {user ? (
            <button
              onClick={toggleFavorite}
              style={{ paddingTop: '40px', paddingBottom: '40px' }}
              className={`w-full rounded-xl text-2xl font-medium border transition-colors ${
                isFavorited
                  ? 'bg-primary text-white border-primary'
                  : 'bg-primary-light text-text-main border-border hover:border-primary'
              }`}
            >
              {isFavorited ? '♥ 保存済' : '♡ 保存'}
            </button>
          ) : (
            <div />
          )}

          {/* おすすめボタン */}
          {user ? (
            <button
              onClick={toggleRecommend}
              style={{ paddingTop: '40px', paddingBottom: '40px' }}
              className={`w-full rounded-xl text-2xl font-medium border transition-colors ${
                isRecommended
                  ? 'bg-primary text-white border-primary'
                  : 'bg-primary-light text-text-main border-border hover:border-primary'
              }`}
            >
              {isRecommended ? '👍 済' : '👍 おすすめ'}
              <span className="ml-1 text-xl">{recommendCount}</span>
            </button>
          ) : (
            <div className="flex items-center justify-center" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
              <p className="text-2xl text-text-main">👍 {recommendCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== 5b. 完登者一覧 ===== */}
      <div style={{ height: '16px' }}></div>
      <div className="bg-card border-b border-border">
        <div className="w-full px-4 py-4">
          <h3 className="text-2xl font-bold text-text-main mb-3">完登者（{ascents.length}人）</h3>
          <div className="overflow-y-auto border border-border rounded-xl px-4 py-3" style={{ maxHeight: '144px' }}>
            {ascents.length === 0 ? (
              <p className="text-xl text-text-sub text-center py-4">完登者なし</p>
            ) : (
              <div className="space-y-2">
                {ascents.map((ascent) => (
                  <div
                    key={ascent.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
                  >
                    <Link
                      href={`/user/${ascent.user_id}`}
                      className="text-xl text-primary hover:underline truncate"
                    >
                      {ascent.profiles?.[0]?.nickname}
                    </Link>
                    <span className="text-lg text-text-sub shrink-0 ml-2">
                      {new Date(ascent.created_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== 6. 完登を記録 ===== */}
      <div style={{ height: '16px' }}></div>
      <div className="w-full px-4">
        {user && !myAscent && (
          <button
            onClick={handleAscent}
            disabled={submitting}
            style={{ paddingTop: '48px', paddingBottom: '48px' }}
            className={`w-full rounded-xl text-3xl font-bold transition-colors ${
              submitting
                ? 'bg-border text-text-sub cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            {submitting ? '記録中...' : '完登を記録する'}
          </button>
        )}

        {myAscent && (
          <div
            className="px-5 bg-primary-light rounded-xl border border-primary flex flex-col items-center justify-center"
            style={{ paddingTop: '48px', paddingBottom: '48px' }}
          >
            <p className="text-2xl text-primary font-bold">✅ 完登済み</p>
            <button
              onClick={handleDeleteAscent}
              className="mt-4 px-5 py-2.5 text-xl text-text-sub border border-border rounded-lg hover:border-primary transition-colors"
            >
              記録を取り消す
            </button>
          </div>
        )}

        {!user && (
          <Link
            href="/login"
            style={{ paddingTop: '48px', paddingBottom: '48px' }}
            className="block w-full rounded-xl text-3xl font-bold text-center bg-primary text-white hover:bg-primary-dark transition-colors"
          >
            ログインして記録する
          </Link>
        )}

        {message && (
          <p className="mt-3 text-xl text-text-sub">{message}</p>
        )}
      </div>

      {/* ===== 7. 課題編集｜課題削除 ===== */}
      {canEdit && (
        <>
          <div style={{ height: '16px' }}></div>
          <div className="w-full px-4 flex gap-3">
            <Link
              href={`/routes/${route.id}/edit`}
              style={{ paddingTop: '24px', paddingBottom: '24px' }}
              className="flex-1 text-center rounded-xl text-2xl font-bold bg-primary text-white hover:bg-primary-dark transition-colors"
            >
              編集する
            </Link>
            <button
              onClick={handleDeleteRoute}
              style={{ paddingTop: '24px', paddingBottom: '24px' }}
              className="flex-1 rounded-xl text-2xl font-bold border border-border text-text-sub hover:border-primary transition-colors"
            >
              削除する
            </button>
          </div>
        </>
      )}
    </div>
  )
}
