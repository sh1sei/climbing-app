'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

type Gym = {
  id: string
  name: string
  latitude: number
  longitude: number
  image_url: string | null
}

export default function AdminGyms() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [name, setName] = useState('')
  const [coords, setCoords] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchGyms()
  }, [])

  const fetchGyms = async () => {
    const { data } = await supabase
      .from('gyms')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setGyms(data)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleAdd = async () => {
    const parts = coords.split(',').map((s) => s.trim())
    if (!name.trim() || parts.length !== 2 || isNaN(Number(parts[0])) || isNaN(Number(parts[1]))) {
      setMessage('ジム名と緯度,経度を正しく入力してください')
      return
    }

    setLoading(true)
    let imageUrl: string | null = null

    if (image) {
      const ext = image.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('gym-images')
        .upload(fileName, image)

      if (uploadError) {
        setMessage('画像のアップロードに失敗しました')
        setLoading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('gym-images')
        .getPublicUrl(fileName)
      imageUrl = urlData.publicUrl
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
    setMessage('登録しました！')
    setLoading(false)
    fetchGyms()
  }

  const handleDelete = async (gym: Gym) => {
    if (!confirm(`${gym.name}を削除しますか？`)) return

    if (gym.image_url) {
      const imagePath = gym.image_url.split('/gym-images/')[1]
      if (imagePath) {
        await supabase.storage.from('gym-images').remove([imagePath])
      }
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

      // 古い画像を削除
      if (gym.image_url) {
        const oldPath = gym.image_url.split('/gym-images/')[1]
        if (oldPath) {
          await supabase.storage.from('gym-images').remove([oldPath])
        }
      }

      // 新しい画像をアップロード
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('gym-images')
        .upload(fileName, file)

      if (uploadError) {
        alert('画像のアップロードに失敗しました')
        return
      }

      const { data: urlData } = supabase.storage
        .from('gym-images')
        .getPublicUrl(fileName)

      await supabase
        .from('gyms')
        .update({ image_url: urlData.publicUrl })
        .eq('id', gym.id)

      fetchGyms()
    }
    input.click()
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 16px' }}>
      <h1>ジム管理</h1>

      <div style={{ marginTop: '24px' }}>
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ジム名"
            style={{ padding: '8px', width: '100%', fontSize: '16px' }}
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            value={coords}
            onChange={(e) => setCoords(e.target.value)}
            placeholder="緯度, 経度（例: 35.6812, 139.7671）"
            style={{ padding: '8px', width: '100%', fontSize: '16px' }}
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold' }}>ジム画像（任意）</label>
          <div style={{ marginTop: '4px' }}>
            <input type="file" accept="image/*" onChange={handleImageChange} />
          </div>
          {preview && (
            <img
              src={preview}
              alt="プレビュー"
              style={{ marginTop: '8px', maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
            />
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={loading}
          style={{
            padding: '10px 24px',
            fontSize: '16px',
            backgroundColor: loading ? '#ccc' : '#4285F4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '登録中...' : 'ジムを登録'}
        </button>
        {message && <p style={{ marginTop: '8px', color: '#666' }}>{message}</p>}
      </div>

      <h2 style={{ marginTop: '40px' }}>登録済みジム</h2>
      {gyms.length === 0 ? (
        <p style={{ color: '#999' }}>まだジムが登録されていません</p>
      ) : (
        gyms.map((gym) => (
          <div
            key={gym.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{gym.name}</strong>
                <p style={{ fontSize: '14px', color: '#666' }}>
                  {gym.latitude}, {gym.longitude}
                </p>
              </div>
              <button
                onClick={() => handleDelete(gym)}
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#ff4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                削除
              </button>
            </div>
            {gym.image_url ? (
              <div style={{ marginTop: '8px' }}>
                <img
                  src={gym.image_url}
                  alt={gym.name}
                  style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px' }}
                />
                <button
                  onClick={() => handleImageUpdate(gym)}
                  style={{
                    marginTop: '4px',
                    padding: '4px 12px',
                    fontSize: '12px',
                    backgroundColor: '#4285F4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  画像を変更
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleImageUpdate(gym)}
                style={{
                  marginTop: '8px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  backgroundColor: '#4285F4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                画像を追加
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
