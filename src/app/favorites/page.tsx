'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/* ========== 型定義 ========== */

type Gym = {
  id: string
  name: string
  latitude: number
  longitude: number
}

type FavoriteRoute = {
  id: string
  grade: string
  image_url: string
  gym_id: string
  poster_nickname: string
  favorite_count: number
  ascent_count: number
}

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

/* ========== FixedDropdown コンポーネント ========== */

function FixedDropdown({
  isOpen,
  buttonRef,
  children,
}: {
  isOpen: boolean
  buttonRef: React.RefObject<HTMLButtonElement | null>
  children: React.ReactNode
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)),
      })
    }
  }, [isOpen, buttonRef])

  if (!isOpen || !pos) return null

  return (
    <div
      className="fixed bg-card border border-border rounded-lg shadow-lg max-h-[100vh] overflow-y-auto min-w-[400px]"
      style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
    >
      {children}
    </div>
  )
}

/* ========== コンポーネント ========== */

export default function FavoritesPage() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [selectedGymId, setSelectedGymId] = useState<string>('all')
  const [routes, setRoutes] = useState<FavoriteRoute[]>([])
  const [filteredRoutes, setFilteredRoutes] = useState<FavoriteRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const gymRef = useRef<HTMLButtonElement | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // ジム取得 + GPS
      const { data: gymsData } = await supabase
        .from('gyms')
        .select('id, name, latitude, longitude')
        .order('name')

      let initialGymId = 'all'

      if (gymsData && gymsData.length > 0) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 300000,
            })
          })
          const userLat = position.coords.latitude
          const userLon = position.coords.longitude
          const sortedGyms = [...gymsData].sort((a, b) => {
            const distA = getDistanceKm(userLat, userLon, a.latitude, a.longitude)
            const distB = getDistanceKm(userLat, userLon, b.latitude, b.longitude)
            return distA - distB
          })
          setGyms(sortedGyms)
          const nearestGym = sortedGyms[0]
          const distance = getDistanceKm(userLat, userLon, nearestGym.latitude, nearestGym.longitude)
          if (distance < 2) {
            initialGymId = nearestGym.id
            setSelectedGymId(nearestGym.id)
          }
        } catch {
          setGyms(gymsData)
        }
      }

      // お気に入り一覧取得
      const { data: favData } = await supabase
        .from('favorites')
        .select('route_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!favData || favData.length === 0) {
        setRoutes([])
        setFilteredRoutes([])
        setLoading(false)
        return
      }

      const routeIds = favData.map((f) => f.route_id)

      const { data: routesData } = await supabase
        .from('routes_with_counts')
        .select('id, grade, image_url, gym_id, poster_nickname, favorite_count, ascent_count')
        .in('id', routeIds)

      if (routesData) {
        const routeMap = new Map(routesData.map((r) => [r.id, r]))
        const ordered = routeIds
          .map((id) => routeMap.get(id))
          .filter(Boolean) as FavoriteRoute[]
        setRoutes(ordered)
        applyFilter(ordered, initialGymId)
      }

      setLoading(false)
    }
    init()
  }, [])

  /* ===== フィルター ===== */
  const applyFilter = (data: FavoriteRoute[], gymId: string) => {
    if (gymId === 'all') {
      setFilteredRoutes(data)
    } else {
      setFilteredRoutes(data.filter((r) => r.gym_id === gymId))
    }
  }

  const handleGymChange = (gymId: string) => {
    setSelectedGymId(gymId)
    setActiveDropdown(null)
    applyFilter(routes, gymId)
  }

  /* ===== ドロップダウン制御 ===== */
  const toggleDropdown = useCallback((name: string) => {
    setActiveDropdown(prev => prev === name ? null : name)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (activeDropdown) {
        const target = e.target as HTMLElement
        if (target.closest('[data-dropdown-menu]')) return
        if (target.closest('[data-dropdown-button]')) return
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [activeDropdown])

  useEffect(() => {
    if (!activeDropdown) return
    const handleScroll = () => setActiveDropdown(null)
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [activeDropdown])

  /* ===== 表示用 ===== */
  const selectedGymName = selectedGymId === 'all'
    ? 'すべてのジム'
    : gyms.find(g => g.id === selectedGymId)?.name || 'ジム'

  const filterBtnBase = 'px-10 py-6 rounded-full text-5xl font-medium border transition-colors whitespace-nowrap'
  const filterBtnActive = 'bg-primary text-white border-primary'
  const filterBtnInactive = 'bg-primary-light text-text-main border-border hover:border-primary'

  const dropdownItemClass = (isActive: boolean) =>
    `block w-full px-8 py-6 text-5xl text-left hover:bg-primary-light whitespace-nowrap ${
      isActive ? 'bg-primary-light text-primary font-bold' : ''
    }`

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
    <div className="min-h-screen bg-bg pb-48 overflow-hidden">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="w-full px-4 h-24 flex items-center justify-center">
          <h1 className="text-3xl font-bold text-text-main">保存した課題</h1>
        </div>
      </header>

      {/* フィルターバー */}
      <div className="sticky top-24 z-40 bg-card border-b border-border">
        <div className="flex items-center gap-3 px-4 py-5 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          <button
            ref={gymRef}
            data-dropdown-button
            onClick={() => toggleDropdown('gym')}
            className={`shrink-0 ${filterBtnBase} ${
              selectedGymId !== 'all' ? filterBtnActive : filterBtnInactive
            }`}
          >
            {selectedGymName} ▼
          </button>
        </div>
      </div>

      {/* ジムドロップダウン */}
      <FixedDropdown isOpen={activeDropdown === 'gym'} buttonRef={gymRef}>
        <div data-dropdown-menu>
          <button onClick={() => handleGymChange('all')} className={dropdownItemClass(selectedGymId === 'all')}>
            すべて
          </button>
          {gyms.map(gym => (
            <button key={gym.id} onClick={() => handleGymChange(gym.id)} className={dropdownItemClass(selectedGymId === gym.id)}>
              {gym.name}
            </button>
          ))}
        </div>
      </FixedDropdown>

      {/* 課題一覧 */}
      <main className="w-full pt-4">
        {filteredRoutes.length === 0 ? (
          <p className="text-center text-text-sub py-12 text-2xl">
            {routes.length === 0 ? 'まだ課題を保存していません' : '条件に一致する課題がありません'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-[2px]">
            {filteredRoutes.map((route) => (
              <Link
                key={route.id}
                href={`/routes/${route.id}`}
                className="block bg-card overflow-hidden rounded-xl"
              >
                <div className="aspect-[3/2] overflow-hidden">
                  <img
                    src={route.image_url}
                    alt="課題写真"
                    loading="lazy"
                    className="w-full h-full object-cover object-[center_70%] rounded-xl"
                  />
                </div>
                <div className="px-3 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-3xl font-bold text-text-main shrink-0">{route.grade}</p>
                    <p className="text-2xl text-text-sub truncate">{route.poster_nickname}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-2xl text-text-sub">♡{route.favorite_count}</span>
                    <span className="text-2xl text-text-sub">✓{route.ascent_count}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
