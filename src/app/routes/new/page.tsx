'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { uploadImage } from '@/lib/upload'
import { useRouter } from 'next/navigation'

/* ========== 型定義 ========== */

type Gym = { id: string; name: string; latitude: number; longitude: number }
type Wall = { id: string; name: string; gym_id: string }

/* ========== 定数 ========== */

const GRADES = [
  '5級-','5級','5級+',
  '4級-','4級','4級+',
  '3級-','3級','3級+',
  '2級-','2級','2級+',
  '1級-','1級','1級+',
  '初段-','初段','初段+',
  '二段-','二段','二段+',
  '三段-','三段','三段+',
]

const TAGS = ['キャンパ課題', '足限定ホールドあり', 'マッチなし']
const HOLD_TYPES = ['カチ', 'ピンチ', 'ポッケ', 'スローパー', 'ボリューム']
const STYLES = [
  { value: 'ショートハード系', label: 'ショートハード系' },
  { value: 'ストレニアス系', label: 'ストレニアス系' },
]

/* ========== ユーティリティ ========== */

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/* ========== コンポーネント ========== */

export default function NewRoute() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [walls, setWalls] = useState<Wall[]>([])
  const [selectedGymId, setSelectedGymId] = useState('')
  const [selectedWallId, setSelectedWallId] = useState('')
  const [grade, setGrade] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [holdTypes, setHoldTypes] = useState<string[]>([])
  const [style, setStyle] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()
  const router = useRouter()

  /* ===== ジム取得 + GPS自動選択 ===== */
  useEffect(() => {
    const fetchGyms = async () => {
      const { data } = await supabase
        .from('gyms')
        .select('id, name, latitude, longitude')
        .order('name')
      if (!data) return

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 300000,
          })
        })
        const userLat = position.coords.latitude
        const userLon = position.coords.longitude
        const sorted = [...data].sort((a, b) => {
          const distA = getDistanceKm(userLat, userLon, a.latitude, a.longitude)
          const distB = getDistanceKm(userLat, userLon, b.latitude, b.longitude)
          return distA - distB
        })
        setGyms(sorted)
        const nearest = sorted[0]
        if (nearest && getDistanceKm(userLat, userLon, nearest.latitude, nearest.longitude) < 2) {
          setSelectedGymId(nearest.id)
        }
      } catch {
        setGyms(data)
      }
    }
    fetchGyms()
  }, [])

  /* ===== 壁取得 ===== */
  useEffect(() => {
    const fetchWalls = async () => {
      if (!selectedGymId) {
        setWalls([])
        setSelectedWallId('')
        return
      }
      const { data } = await supabase
        .from('walls')
        .select('id, name, gym_id')
        .eq('gym_id', selectedGymId)
        .order('name')
      if (data) setWalls(data)
      setSelectedWallId('')
    }
    fetchWalls()
  }, [selectedGymId])

  /* ===== ハンドラー ===== */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async () => {
    if (!selectedGymId || !selectedWallId || !grade || !image) {
      setMessage('ジム・壁・グレード・写真は必須です')
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessage('ログインが必要です')
      setLoading(false)
      return
    }

    let imageUrl: string
    try {
      const { url } = await uploadImage(image, 'routes')
      imageUrl = url
    } catch {
      setMessage('画像のアップロードに失敗しました')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('routes').insert({
      gym_id: selectedGymId,
      wall_id: selectedWallId,
      grade,
      tags: selectedTags,
      image_url: imageUrl,
      user_id: user.id,
      description: description || null,
      hold_type: holdTypes.length > 0 ? holdTypes : null,
      style: style || null,
    })

    if (insertError) {
      setMessage('課題の登録に失敗しました')
      setLoading(false)
      return
    }

    setMessage('投稿完了しました！')
    setImage(null)
    setPreview(null)
    setGrade('')
    setSelectedTags([])
    setHoldTypes([])
    setStyle('')
    setDescription('')
    setLoading(false)
  }

  /* ===== 共通スタイル ===== */
  const chipBase = 'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap'
  const chipActive = 'bg-primary text-white border-primary'
  const chipInactive = 'bg-primary-light text-text-main border-border hover:border-primary'

  /* ========== UI ========== */
  return (
    <div className="min-h-screen bg-bg pb-32">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="w-full max-w-screen-sm mx-auto px-4 h-14 flex items-center justify-center">
          <h1 className="text-lg font-bold text-text-main">課題を投稿</h1>
        </div>
      </header>

      <div className="w-full max-w-screen-sm mx-auto px-4 pt-6 space-y-6">

        {/* 1. ジム */}
        <div>
          <label className="block text-sm font-bold text-text-main mb-2">ジム</label>
          <select
            value={selectedGymId}
            onChange={(e) => setSelectedGymId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-card text-text-main text-sm focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">ジムを選択</option>
            {gyms.map((gym) => (
              <option key={gym.id} value={gym.id}>{gym.name}</option>
            ))}
          </select>
        </div>

        {/* 2. 壁 */}
        <div>
          <label className="block text-sm font-bold text-text-main mb-2">壁</label>
          <select
            value={selectedWallId}
            onChange={(e) => setSelectedWallId(e.target.value)}
            disabled={!selectedGymId}
            className={`w-full px-4 py-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:border-primary transition-colors ${
              !selectedGymId ? 'text-text-sub opacity-50 cursor-not-allowed' : 'text-text-main'
            }`}
          >
            <option value="">壁を選択</option>
            {walls.map((wall) => (
              <option key={wall.id} value={wall.id}>{wall.name}</option>
            ))}
          </select>
        </div>

        {/* 3. 画像 */}
        <div>
          <label className="block text-sm font-bold text-text-main mb-2">写真</label>
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="プレビュー"
                className="w-full rounded-xl border border-border object-cover max-h-80"
              />
              <button
                onClick={() => { setImage(null); setPreview(null) }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed border-border bg-primary-light cursor-pointer hover:border-primary transition-colors">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-sm text-text-sub mt-2">タップして写真を選択</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* 4. グレード */}
        <div>
          <label className="block text-sm font-bold text-text-main mb-2">グレード</label>
          <div className="flex flex-wrap gap-2">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => setGrade(grade === g ? '' : g)}
                className={`${chipBase} ${grade === g ? chipActive : chipInactive}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* 5. 属性タグ */}
        <div className="space-y-4">
          {/* 特殊属性 */}
          <div>
            <label className="block text-sm font-bold text-text-main mb-2">特殊属性</label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`${chipBase} ${selectedTags.includes(tag) ? chipActive : chipInactive}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* ホールドタイプ（複数選択可） */}
          <div>
            <label className="block text-sm font-bold text-text-main mb-2">ホールドタイプ</label>
            <div className="flex flex-wrap gap-2">
              {HOLD_TYPES.map((ht) => (
                <button
                  key={ht}
                  onClick={() => setHoldTypes(prev =>
                    prev.includes(ht) ? prev.filter(h => h !== ht) : [...prev, ht]
                  )}
                  className={`${chipBase} ${holdTypes.includes(ht) ? chipActive : chipInactive}`}
                >
                  {ht}
                </button>
              ))}
            </div>
          </div>

          {/* 課題系統 */}
          <div>
            <label className="block text-sm font-bold text-text-main mb-2">課題系統</label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(style === s.value ? '' : s.value)}
                  className={`${chipBase} ${style === s.value ? chipActive : chipInactive}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 6. 一文 */}
        <div>
          <label className="block text-sm font-bold text-text-main mb-2">
            ひとこと <span className="text-text-sub font-normal">（任意・30文字まで）</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => {
              if (e.target.value.length <= 30) setDescription(e.target.value)
            }}
            placeholder="例：ランジが核心！"
            className="w-full px-4 py-3 rounded-xl border border-border bg-card text-text-main text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-text-sub/50"
          />
          <p className="text-xs text-text-sub mt-1 text-right">{description.length}/30</p>
        </div>

        {/* 7. 投稿ボタン */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-3.5 rounded-xl text-sm font-bold transition-colors ${
            loading
              ? 'bg-border text-text-sub cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary-dark active:bg-primary-dark'
          }`}
        >
          {loading ? '投稿中...' : '投稿する'}
        </button>

        {/* メッセージ */}
        {message && (
          <p className={`text-center text-sm font-medium ${
            message === '投稿完了しました！' ? 'text-green-600' : 'text-red-500'
          }`}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
