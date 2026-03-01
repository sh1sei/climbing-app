'use client'

import { useEffect, useState } from 'react'
import { createClient, ADMIN_EMAIL } from '@/lib/supabase'
import { uploadImage, deleteImage } from '@/lib/upload'
import { useParams, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

/* ========== 型定義 ========== */

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

/* ========== コンポーネント ========== */

export default function EditRoutePage() {
  const params = useParams()
  const routeId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [walls, setWalls] = useState<Wall[]>([])
  const [selectedWallId, setSelectedWallId] = useState('')
  const [grade, setGrade] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [holdTypes, setHoldTypes] = useState<string[]>([])
  const [style, setStyle] = useState('')
  const [description, setDescription] = useState('')
  const [currentImageUrl, setCurrentImageUrl] = useState('')
  const [newImage, setNewImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [gymName, setGymName] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)

      const { data: routeData } = await supabase
        .from('routes')
        .select('id, grade, tags, image_url, description, hold_type, style, user_id, gym_id, wall_id, gyms(name)')
        .eq('id', routeId)
        .single()

      if (!routeData) {
        router.push('/')
        return
      }

      if (routeData.user_id !== user.id && user.email !== ADMIN_EMAIL) {
        router.push('/')
        return
      }

      setGrade(routeData.grade)
      setSelectedTags(routeData.tags || [])
      setHoldTypes(routeData.hold_type || [])
      setStyle(routeData.style || '')
      setDescription(routeData.description || '')
      setCurrentImageUrl(routeData.image_url)
      setSelectedWallId(routeData.wall_id)
      setGymName((routeData as any).gyms?.[0]?.name || '')

      const { data: wallsData } = await supabase
        .from('walls')
        .select('id, name, gym_id')
        .eq('gym_id', routeData.gym_id)
        .order('name')
      if (wallsData) setWalls(wallsData)

      setLoading(false)
    }
    init()
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNewImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async () => {
    if (!selectedWallId || !grade) {
      setMessage('壁とグレードを選択してください')
      return
    }

    setSubmitting(true)

    let imageUrl = currentImageUrl

    if (newImage && user) {
      await deleteImage(currentImageUrl)

      try {
        const { url } = await uploadImage(newImage, 'routes')
        imageUrl = url
      } catch {
        setMessage('画像のアップロードに失敗しました')
        setSubmitting(false)
        return
      }
    }

    const { error } = await supabase
      .from('routes')
      .update({
        wall_id: selectedWallId,
        grade,
        tags: selectedTags,
        image_url: imageUrl,
        description: description || null,
        hold_type: holdTypes.length > 0 ? holdTypes : null,
        style: style || null,
      })
      .eq('id', routeId)

    if (error) {
      setMessage('更新に失敗しました')
      setSubmitting(false)
      return
    }

    router.push(`/routes/${routeId}`)
  }

  /* ===== 共通スタイル ===== */
  const chipBase = 'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap'
  const chipActive = 'bg-primary text-white border-primary'
  const chipInactive = 'bg-primary-light text-text-main border-border hover:border-primary'

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
    <div className="min-h-screen bg-bg pb-28">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <a href={`/routes/${routeId}`} className="text-text-sub hover:text-primary transition-colors text-sm">
            ← 戻る
          </a>
          <h1 className="text-lg font-bold text-text-main">課題を編集</h1>
          <div className="w-10"></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4">
        <p className="text-sm text-text-sub mb-6">{gymName}</p>

        <div className="space-y-6">

          {/* 画像 */}
          <div>
            <label className="block text-sm font-bold text-text-main mb-2">写真</label>
            <div className="relative">
              <img
                src={preview || currentImageUrl}
                alt="課題写真"
                className="w-full rounded-xl border border-border object-cover max-h-80"
              />
              {newImage && (
                <button
                  onClick={() => { setNewImage(null); setPreview(null) }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              )}
            </div>
            <label className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-primary-light text-primary text-sm font-medium rounded-lg border border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors">
              写真を変更
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
            {newImage && (
              <p className="text-xs text-primary mt-1">新しい画像が選択されています</p>
            )}
          </div>

          {/* 壁 */}
          <div>
            <label className="block text-sm font-bold text-text-main mb-2">壁</label>
            <select
              value={selectedWallId}
              onChange={(e) => setSelectedWallId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-text-main text-sm focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">壁を選択</option>
              {walls.map((wall) => (
                <option key={wall.id} value={wall.id}>{wall.name}</option>
              ))}
            </select>
          </div>

          {/* グレード */}
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

          {/* 属性タグ */}
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

          {/* 一文 */}
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

          {/* 更新ボタン */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`w-full py-3.5 rounded-xl text-sm font-bold transition-colors ${
              submitting
                ? 'bg-border text-text-sub cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-dark active:bg-primary-dark'
            }`}
          >
            {submitting ? '更新中...' : '更新する'}
          </button>

          {message && (
            <p className="text-center text-sm font-medium text-red-500">{message}</p>
          )}
        </div>
      </div>
    </div>
  )
}
