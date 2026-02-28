'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient, ADMIN_EMAIL } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type RouteDetail = {
  id: string
  grade: string
  tags: string[]
  image_url: string
  created_at: string
  user_id: string
  gyms: { name: string }[]
  walls: { name: string }[]
}

type Ascent = {
  id: string
  user_id: string
  feeling: number
  recommended: boolean
  created_at: string
  profiles: { nickname: string }[]
}

export default function RouteDetailPage() {
  const params = useParams()
  const routeId = params.id as string
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [route, setRoute] = useState<RouteDetail | null>(null)
  const [ascents, setAscents] = useState<Ascent[]>([])
  const [posterNickname, setPosterNickname] = useState('')
  const [myAscent, setMyAscent] = useState<Ascent | null>(null)
  const [feeling, setFeeling] = useState(0)
  const [recommended, setRecommended] = useState(false)
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

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUser(user)

      const { data: routeData } = await supabase
        .from('routes')
        .select('id, grade, tags, image_url, created_at, user_id, gyms(name), walls(name)')
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

      await fetchAscents(user?.id)
      setLoading(false)
    }
    init()
  }, [])

  const fetchAscents = async (userId?: string) => {
    const { data: ascentsData } = await supabase
      .from('ascents')
      .select('id, user_id, feeling, recommended, created_at')
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
          setFeeling(mine.feeling)
          setRecommended(mine.recommended)
        }
      }
    }
  }

  const handleAscent = async () => {
    if (!user) {
      setMessage('ログインが必要です')
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('ascents').insert({
      route_id: routeId,
      user_id: user.id,
      feeling,
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
    setFeeling(0)
    setRecommended(false)
    setMessage('記録を取り消しました')
    await fetchAscents(user?.id)
  }

  const handleDeleteRoute = async () => {
    if (!confirm('この課題を削除しますか？完登記録もすべて削除されます。')) return

    const imagePath = route!.image_url.split('/route-images/')[1]
    if (imagePath) {
      await supabase.storage.from('route-images').remove([imagePath])
    }

    await supabase.from('routes').delete().eq('id', routeId)
    router.push('/')
  }

  const openImage = () => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
    setShowFullImage(true)
  }

  const closeImage = () => {
    setShowFullImage(false)
  }

  const getDistance = (t1: React.Touch, t2: React.Touch) => {
    return Math.sqrt((t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2)
  }

  const getCenter = (t1: React.Touch, t2: React.Touch) => {
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
  }

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
    if (scale <= 1) {
      setTranslate({ x: 0, y: 0 })
    }
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

  const getFeelingColor = (value: number) => {
    if (value < 0) {
      const intensity = Math.abs(value) / 5
      return `rgba(59, 130, 246, ${0.2 + intensity * 0.6})`
    }
    if (value > 0) {
      const intensity = value / 5
      return `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`
    }
    return '#f0f0f0'
  }

  const getFeelingLabel = (value: number) => {
    if (value <= -4) return 'かなり甘い'
    if (value <= -2) return '甘い'
    if (value === -1) return 'やや甘い'
    if (value === 0) return '妥当'
    if (value === 1) return 'やや辛い'
    if (value <= 3) return '辛い'
    return 'かなり辛い'
  }

  const getAverageFeeling = () => {
    if (ascents.length === 0) return 0
    const sum = ascents.reduce((acc, a) => acc + a.feeling, 0)
    return Math.round((sum / ascents.length) * 10) / 10
  }

  const getRecommendCount = () => {
    return ascents.filter((a) => a.recommended).length
  }

  if (loading) return <p>読み込み中...</p>
  if (!route) return <p>課題が見つかりません</p>

  const avgFeeling = getAverageFeeling()
  const recommendCount = getRecommendCount()
  const canEdit = user && (user.id === route.user_id || user.email === ADMIN_EMAIL)

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
      <a href="/" style={{ color: '#4285F4', textDecoration: 'none' }}>← 一覧に戻る</a>

      <img
        src={route.image_url}
        alt="課題写真"
        onClick={openImage}
        style={{ width: '100%', borderRadius: '12px', marginTop: '12px', cursor: 'pointer' }}
      />
      <p style={{ textAlign: 'center', fontSize: '12px', color: '#999', marginTop: '4px' }}>
        タップで拡大
      </p>

      {showFullImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <button
            onClick={closeImage}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              backgroundColor: 'rgba(255,255,255,0.3)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '20px',
              cursor: 'pointer',
              zIndex: 1001,
            }}
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

      {/* 課題情報 */}
      <div style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{route.grade}</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {recommendCount > 0 && (
              <span style={{ fontSize: '14px' }}>👍 {recommendCount}</span>
            )}
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '14px',
                backgroundColor: getFeelingColor(avgFeeling),
              }}
            >
              体感: {getFeelingLabel(avgFeeling)}
            </span>
          </div>
        </div>
        <p style={{ fontSize: '16px', color: '#666', marginTop: '4px' }}>
          {route.gyms?.[0]?.name} / {route.walls?.[0]?.name}
        </p>
        {route.tags.length > 0 && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {route.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: '2px 10px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
          投稿者: <a href={`/user/${route.user_id}`} style={{ color: '#4285F4', textDecoration: 'none' }}>{posterNickname}</a> ・ {new Date(route.created_at).toLocaleDateString('ja-JP')}
        </p>
        {canEdit && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <a
              href={`/routes/${route.id}/edit`}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#4285F4',
                color: 'white',
                borderRadius: '4px',
                textDecoration: 'none',
              }}
            >
              編集する
            </a>
            <button
              onClick={handleDeleteRoute}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              削除する
            </button>
          </div>
        )}
      </div>

      {/* 完登記録セクション */}
      <div style={{ marginTop: '32px', borderTop: '1px solid #eee', paddingTop: '24px' }}>
        <h2 style={{ fontSize: '18px' }}>完登記録（{ascents.length}人）</h2>

        {user && !myAscent && (
          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
            {/* 体感グレード */}
            <p style={{ fontWeight: 'bold', marginBottom: '12px' }}>体感グレード</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#999' }}>
              <span>甘い</span>
              <span>妥当</span>
              <span>辛い</span>
            </div>
            <input
              type="range"
              min={-5}
              max={5}
              value={feeling}
              onChange={(e) => setFeeling(parseInt(e.target.value))}
              style={{ width: '100%', marginTop: '4px' }}
            />
            <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '16px' }}>
              <span
                style={{
                  padding: '4px 16px',
                  borderRadius: '16px',
                  backgroundColor: getFeelingColor(feeling),
                }}
              >
                {getFeelingLabel(feeling)}
              </span>
            </p>

            {/* おすすめ */}
            <div style={{ marginTop: '20px' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '12px' }}>この課題をおすすめする？</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setRecommended(true)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '16px',
                    borderRadius: '8px',
                    border: recommended ? '2px solid #4285F4' : '1px solid #ccc',
                    backgroundColor: recommended ? '#e8f0fe' : 'white',
                    color: recommended ? '#4285F4' : '#333',
                    cursor: 'pointer',
                  }}
                >
                  👍 おすすめ！
                </button>
                <button
                  onClick={() => setRecommended(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '16px',
                    borderRadius: '8px',
                    border: !recommended ? '2px solid #999' : '1px solid #ccc',
                    backgroundColor: !recommended ? '#f5f5f5' : 'white',
                    color: '#333',
                    cursor: 'pointer',
                  }}
                >
                  しない
                </button>
              </div>
            </div>

            {/* 登録ボタン */}
            <button
              onClick={handleAscent}
              disabled={submitting}
              style={{
                marginTop: '20px',
                padding: '12px',
                width: '100%',
                fontSize: '16px',
                backgroundColor: submitting ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? '記録中...' : '完登を記録する'}
            </button>
          </div>
        )}

        {myAscent && (
          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f0fff0', borderRadius: '12px' }}>
            <p>
              ✅ 完登済み（体感: {getFeelingLabel(myAscent.feeling)}）
              {myAscent.recommended && ' 👍 おすすめ'}
            </p>
            <button
              onClick={handleDeleteAscent}
              style={{
                marginTop: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              記録を取り消す
            </button>
          </div>
        )}

        {message && <p style={{ marginTop: '8px', color: '#666' }}>{message}</p>}

        {/* 完登者一覧 */}
        <div style={{ marginTop: '16px' }}>
          {ascents.map((ascent) => (
            <div
              key={ascent.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <a
                href={`/user/${ascent.user_id}`}
                style={{ fontSize: '14px', color: '#4285F4', textDecoration: 'none' }}
              >
                {ascent.profiles?.[0]?.nickname}
              </a>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {ascent.recommended && <span style={{ fontSize: '14px' }}>👍</span>}
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    backgroundColor: getFeelingColor(ascent.feeling),
                  }}
                >
                  {getFeelingLabel(ascent.feeling)}
                </span>
                <span style={{ fontSize: '12px', color: '#999' }}>
                  {new Date(ascent.created_at).toLocaleDateString('ja-JP')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
