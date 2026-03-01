'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { uploadImage, deleteImage } from '@/lib/upload'

/* ========== 型定義 ========== */

type Gym = {
  id: string
  name: string
  latitude: number
  longitude: number
  image_url: string | null
}

type Wall = {
  id: string
  name: string
  gym_id: string
}

/* ========== コンポーネント ========== */

export default function AdminGyms() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [wallsByGym, setWallsByGym] = useState<Record<string, Wall[]>>({})
  const [name, setName] = useState('')
  const [coords, setCoords] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [newWallNames, setNewWallNames] = useState<Record<string, string>>({})
  const [expandedGym, setExpandedGym] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchGyms()
  }, [])

  const fetchGyms = async () => {
    const { data } = await supabase
      .from('gyms')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      setGyms(data)
      // 全ジムの壁を取得
      const { data: wallsData } = await supabase
        .from('walls')
        .select('id, name, gym_id')
        .order('name')
      if (wallsData) {
        const grouped: Record<string, Wall[]> = {}
        wallsData.forEach((w) => {
          if (!grouped[w.gym_id]) grouped[w.gym_id] = []
          grouped[w.gym_id].push(w)
        })
        setWallsByGym(grouped)
      }
    }
  }

  /* ===== ジム関連 ===== */

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleAddGym = async () => {
    const parts = coords.split(',').map((s) => s.trim())
    if (!name.trim() || parts.length !== 2 || isNaN(Number(parts[0])) || isNaN(Number(parts[1]))) {
      setMessage('ジム名と緯度,経度を正しく入力してください')
      return
    }

    setLoading(true)
    let imageUrl: string | null = null

    if (image) {
      try {
        const { url } = await uploadImage(image, 'gyms')
        imageUrl = url
      } catch {
        setMessage('画像のアップロードに失敗しました')
        setLoading(false)
        return
      }
    }

    const { error } = await supabase.from('gyms').insert({
      name: name.trim(),
      latitude: parseFloat(parts[0]),
      longitude: parseFloat(parts[1]),
      image_url: imageUrl,
    })

    if (error) {
      setMessage('登録に失敗しました')
      setLoading(false)
      return
    }

    setName('')
    setCoords('')
    setImage(null)
    setPreview(null)
    setMessage('ジムを登録しました！')
    setLoading(false)
    fetchGyms()
  }

  const handleDeleteGym = async (gym: Gym) => {
    const walls = wallsByGym[gym.id] || []
    const confirmMsg = walls.length > 0
      ? `${gym.name}を削除しますか？\n壁が${walls.length}件あります。先に壁を削除してください。`
      : `${gym.name}を削除しますか？`

    if (walls.length > 0) {
      alert(`${gym.name}には壁が${walls.length}件あります。先に壁を削除してください。`)
      return
    }

    if (!confirm(confirmMsg)) return

    if (gym.image_url) {
      await deleteImage(gym.image_url)
    }

    await supabase.from('gyms').delete().eq('id', gym.id)
    fetchGyms()
  }

  const handleImageUpdate = async (gym: Gym) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      if (gym.image_url) {
        await deleteImage(gym.image_url)
      }

      try {
        const { url } = await uploadImage(file, 'gyms')

        await supabase
          .from('gyms')
          .update({ image_url: url })
          .eq('id', gym.id)

        fetchGyms()
      } catch {
        alert('画像のアップロードに失敗しました')
      }
    }
    input.click()
  }

  /* ===== 壁関連 ===== */

  const handleAddWall = async (gymId: string) => {
    const wallName = newWallNames[gymId]?.trim()
    if (!wallName) return

    const { error } = await supabase.from('walls').insert({
      gym_id: gymId,
      name: wallName,
    })

    if (error) {
      alert('壁の登録に失敗しました')
      return
    }

    setNewWallNames((prev) => ({ ...prev, [gymId]: '' }))
    fetchGyms()
  }

  const handleDeleteWall = async (wall: Wall) => {
    if (!confirm(`壁「${wall.name}」を削除しますか？`)) return
    await supabase.from('walls').delete().eq('id', wall.id)
    fetchGyms()
  }

  /* ========== UI ========== */
  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="text-text-sub hover:text-primary transition-colors text-sm">
            ← ホーム
          </a>
          <h1 className="text-lg font-bold text-text-main">ジム・壁管理</h1>
          <div className="w-10"></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* ジム登録フォーム */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-bold text-text-main mb-4">新しいジムを登録</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ジム名"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg text-text-main text-sm focus:outline-none focus:border-primary transition-colors"
            />
            <input
              type="text"
              value={coords}
              onChange={(e) => setCoords(e.target.value)}
              placeholder="緯度, 経度（例: 35.6812, 139.7671）"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg text-text-main text-sm focus:outline-none focus:border-primary transition-colors"
            />
            <div>
              <p className="text-xs text-text-sub mb-1">ジム画像（任意）</p>
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="プレビュー" className="w-full max-h-40 object-cover rounded-lg border border-border" />
                  <button
                    onClick={() => { setImage(null); setPreview(null) }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-full h-20 rounded-lg border-2 border-dashed border-border bg-primary-light cursor-pointer hover:border-primary transition-colors">
                  <span className="text-xs text-text-sub">タップして画像を選択</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>
            <button
              onClick={handleAddGym}
              disabled={loading}
              className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
                loading
                  ? 'bg-border text-text-sub cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary-dark'
              }`}
            >
              {loading ? '登録中...' : 'ジムを登録'}
            </button>
          </div>
          {message && (
            <p className="mt-2 text-xs text-primary">{message}</p>
          )}
        </div>

        {/* 登録済みジム一覧 */}
        <h2 className="text-sm font-bold text-text-main mt-8 mb-3">
          登録済みジム（{gyms.length}件）
        </h2>

        {gyms.length === 0 ? (
          <p className="text-center text-text-sub text-sm py-8">まだジムが登録されていません</p>
        ) : (
          <div className="space-y-3">
            {gyms.map((gym) => {
              const walls = wallsByGym[gym.id] || []
              const isExpanded = expandedGym === gym.id

              return (
                <div key={gym.id} className="bg-card rounded-xl border border-border overflow-hidden">
                  {/* ジム情報ヘッダー */}
                  <div
                    className="p-4 cursor-pointer hover:bg-primary-light/30 transition-colors"
                    onClick={() => setExpandedGym(isExpanded ? null : gym.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-text-main">{gym.name}</span>
                          <span className="text-xs text-text-sub bg-primary-light px-2 py-0.5 rounded-full">
                            壁 {walls.length}
                          </span>
                        </div>
                        <p className="text-xs text-text-sub mt-0.5">
                          {gym.latitude}, {gym.longitude}
                        </p>
                      </div>
                      <span className={`text-text-sub text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </div>
                  </div>

                  {/* 展開エリア */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* ジム画像 */}
                      <div className="p-4 border-b border-border">
                        {gym.image_url ? (
                          <div>
                            <img
                              src={gym.image_url}
                              alt={gym.name}
                              className="w-full max-h-36 object-cover rounded-lg"
                            />
                            <button
                              onClick={() => handleImageUpdate(gym)}
                              className="mt-2 px-3 py-1.5 text-xs font-medium bg-primary-light text-primary border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors"
                            >
                              画像を変更
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleImageUpdate(gym)}
                            className="px-3 py-1.5 text-xs font-medium bg-primary-light text-primary border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors"
                          >
                            画像を追加
                          </button>
                        )}
                      </div>

                      {/* 壁一覧 */}
                      <div className="p-4">
                        <p className="text-xs font-bold text-text-main mb-2">壁一覧</p>
                        {walls.length === 0 ? (
                          <p className="text-xs text-text-sub mb-3">壁がまだありません</p>
                        ) : (
                          <div className="space-y-1.5 mb-3">
                            {walls.map((wall) => (
                              <div
                                key={wall.id}
                                className="flex items-center justify-between py-1.5 px-3 bg-bg rounded-lg"
                              >
                                <span className="text-sm text-text-main">{wall.name}</span>
                                <button
                                  onClick={() => handleDeleteWall(wall)}
                                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                                >
                                  削除
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 壁追加 */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newWallNames[gym.id] || ''}
                            onChange={(e) => setNewWallNames((prev) => ({ ...prev, [gym.id]: e.target.value }))}
                            placeholder="壁名を入力"
                            className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg text-text-main text-sm focus:outline-none focus:border-primary transition-colors"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddWall(gym.id)
                            }}
                          />
                          <button
                            onClick={() => handleAddWall(gym.id)}
                            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                          >
                            追加
                          </button>
                        </div>
                      </div>

                      {/* ジム削除 */}
                      <div className="p-4 border-t border-border">
                        <button
                          onClick={() => handleDeleteGym(gym)}
                          className="px-4 py-2 text-xs font-medium bg-red-50 text-red-500 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          ジムを削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
