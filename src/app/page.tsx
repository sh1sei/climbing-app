'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

/* ========== 型定義 ========== */

type Gym = {
  id: string
  name: string
  latitude: number
  longitude: number
}

type Wall = {
  id: string
  gym_id: string
  name: string
}

type RouteWithCounts = {
  id: string
  grade: string
  tags: string[]
  image_url: string
  description: string | null
  hold_type: string[] | null
  style: string | null
  created_at: string
  gym_id: string
  wall_id: string
  user_id: string
  gym_name: string
  wall_name: string
  poster_nickname: string
  ascent_count: number
  recommend_count: number
  favorite_count: number
}

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

const HOLD_TYPES = ['カチ', 'ピンチ', 'ポッケ', 'スローパー', 'ボリューム']
const STYLES = ['ショート', 'ストレニ']
const STYLE_LABELS: Record<string, string> = {
  'ショート': 'ショートハード系',
  'ストレニ': 'ストレニアス系',
}

type SortType = 'new' | 'repeat' | 'recommend'
const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'new', label: '新課題順' },
  { value: 'repeat', label: 'リピート順' },
  { value: 'recommend', label: 'おすすめ順' },
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

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [gyms, setGyms] = useState<Gym[]>([])
  const [walls, setWalls] = useState<Wall[]>([])
  const [routes, setRoutes] = useState<RouteWithCounts[]>([])
  const [filteredRoutes, setFilteredRoutes] = useState<RouteWithCounts[]>([])
  const [loading, setLoading] = useState(true)

  // フィルター状態
  const [selectedGymId, setSelectedGymId] = useState<string>('all')
  const [selectedWallId, setSelectedWallId] = useState<string>('all')
  const [gradeFrom, setGradeFrom] = useState<string>('')
  const [gradeTo, setGradeTo] = useState<string>('')
  const [sortType, setSortType] = useState<SortType>('new')
  const [activeHoldTypes, setActiveHoldTypes] = useState<string[]>([])
  const [activeStyles, setActiveStyles] = useState<string[]>([])
  const [isCampus, setIsCampus] = useState(false)
  const [hideCompleted, setHideCompleted] = useState(false)
  const [myAscentRouteIds, setMyAscentRouteIds] = useState<Set<string>>(new Set())

  // ドロップダウン状態（1つだけ開く or null）
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  /* ===== 初期化 ===== */
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', user.id)
          .single()
        if (!profile) {
          router.push('/setup-profile')
          return
        }
        setNickname(profile.nickname)

        // 自分の完登済み課題IDを取得
        const { data: ascentsData } = await supabase
          .from('ascents')
          .select('route_id')
          .eq('user_id', user.id)
        if (ascentsData) {
          setMyAscentRouteIds(new Set(ascentsData.map((a: any) => a.route_id)))
        }
      }

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

      const { data: wallsData } = await supabase
        .from('walls')
        .select('id, gym_id, name')
        .order('name')
      if (wallsData) setWalls(wallsData)

      await fetchRoutes(initialGymId)
      setLoading(false)
    }
    init()
  }, [])

  /* ===== ドロップダウン制御 ===== */
  const filterBarRef = useRef<HTMLDivElement>(null)

  const toggleDropdown = useCallback((name: string) => {
    setActiveDropdown(prev => prev === name ? null : name)
  }, [])

  // フィルターバーの外側クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* ===== データ取得 ===== */
  const fetchRoutes = async (gymId?: string) => {
    let query = supabase
      .from('routes_with_counts')
      .select('*')

    const targetGymId = gymId ?? selectedGymId
    if (targetGymId && targetGymId !== 'all') {
      query = query.eq('gym_id', targetGymId)
    }

    const { data } = await query
    if (data) {
      setRoutes(data as RouteWithCounts[])
      applyFilters(data as RouteWithCounts[], {
        gradeFrom, gradeTo, sortType, activeHoldTypes, activeStyles, isCampus, hideCompleted,
        wallId: selectedWallId,
      })
    }
  }

  /* ===== フィルター適用 ===== */
  type FilterParams = {
    gradeFrom: string
    gradeTo: string
    sortType: SortType
    activeHoldTypes: string[]
    activeStyles: string[]
    isCampus: boolean
    hideCompleted: boolean
    wallId: string
  }

  const applyFilters = (data: RouteWithCounts[], params: FilterParams) => {
    let result = [...data]

    if (params.gradeFrom || params.gradeTo) {
      const fromIndex = params.gradeFrom ? GRADES.indexOf(params.gradeFrom) : 0
      const toIndex = params.gradeTo ? GRADES.indexOf(params.gradeTo) : GRADES.length - 1
      result = result.filter((r) => {
        const idx = GRADES.indexOf(r.grade)
        if (idx === -1) return true
        return idx >= fromIndex && idx <= toIndex
      })
    }

    if (params.wallId && params.wallId !== 'all') {
      result = result.filter((r) => r.wall_id === params.wallId)
    }

    if (params.activeHoldTypes.length > 0) {
      result = result.filter((r) => r.hold_type && r.hold_type.some(ht => params.activeHoldTypes.includes(ht)))
    }

    if (params.activeStyles.length > 0) {
      result = result.filter((r) => {
        if (!r.style) return false
        return params.activeStyles.some(s => STYLE_LABELS[s] === r.style)
      })
    }

    if (params.isCampus) {
      result = result.filter((r) => r.tags && r.tags.includes('キャンパ課題'))
    }

    if (params.hideCompleted && myAscentRouteIds.size > 0) {
      result = result.filter((r) => !myAscentRouteIds.has(r.id))
    }

    switch (params.sortType) {
      case 'new':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'repeat':
        result.sort((a, b) => b.ascent_count - a.ascent_count)
        break
      case 'recommend':
        result.sort((a, b) => b.recommend_count - a.recommend_count)
        break
    }

    setFilteredRoutes(result)
  }

  /* ===== フィルターハンドラ ===== */
  const currentFilterParams = (): FilterParams => ({
    gradeFrom, gradeTo, sortType, activeHoldTypes, activeStyles, isCampus, hideCompleted,
    wallId: selectedWallId,
  })

  const handleGymChange = async (gymId: string) => {
    setSelectedGymId(gymId)
    setSelectedWallId('all')
    setActiveDropdown(null)
    await fetchRoutes(gymId)
  }

  const handleWallChange = (wallId: string) => {
    setSelectedWallId(wallId)
    setActiveDropdown(null)
    applyFilters(routes, { ...currentFilterParams(), wallId })
  }

  const handleGradeFromChange = (value: string) => {
    setGradeFrom(value)
    setActiveDropdown(null)
    applyFilters(routes, { ...currentFilterParams(), gradeFrom: value })
  }

  const handleGradeToChange = (value: string) => {
    setGradeTo(value)
    setActiveDropdown(null)
    applyFilters(routes, { ...currentFilterParams(), gradeTo: value })
  }

  const handleSortChange = (value: SortType) => {
    setSortType(value)
    setActiveDropdown(null)
    applyFilters(routes, { ...currentFilterParams(), sortType: value })
  }

  const toggleHoldType = (ht: string) => {
    const next = activeHoldTypes.includes(ht)
      ? activeHoldTypes.filter(h => h !== ht)
      : [...activeHoldTypes, ht]
    setActiveHoldTypes(next)
    applyFilters(routes, { ...currentFilterParams(), activeHoldTypes: next })
  }

  const toggleStyle = (s: string) => {
    const next = activeStyles.includes(s)
      ? activeStyles.filter(x => x !== s)
      : [...activeStyles, s]
    setActiveStyles(next)
    applyFilters(routes, { ...currentFilterParams(), activeStyles: next })
  }

  const toggleCampus = () => {
    const next = !isCampus
    setIsCampus(next)
    applyFilters(routes, { ...currentFilterParams(), isCampus: next })
  }

  const toggleHideCompleted = () => {
    const next = !hideCompleted
    setHideCompleted(next)
    applyFilters(routes, { ...currentFilterParams(), hideCompleted: next })
  }

  /* ===== 現在のジムの壁リスト ===== */
  const currentWalls = selectedGymId === 'all'
    ? walls
    : walls.filter(w => w.gym_id === selectedGymId)

  const selectedGymName = selectedGymId === 'all'
    ? 'ジム'
    : gyms.find(g => g.id === selectedGymId)?.name || 'ジム'

  const selectedWallName = selectedWallId === 'all'
    ? '壁'
    : currentWalls.find(w => w.id === selectedWallId)?.name || '壁'

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
      {/* ===== ヘッダー ===== */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="w-full px-4 h-24 flex items-center justify-between">
          <h1 className="text-6xl font-bold text-primary tracking-wide">カベログ</h1>
          {user ? (
            <a
              href={`/user/${user.id}`}
              className="text-2xl text-text-sub hover:text-primary transition-colors"
            >
              {nickname}
            </a>
          ) : (
            <a
              href="/login"
              className="text-2xl text-primary font-medium hover:text-primary-dark transition-colors"
            >
              ログイン
            </a>
          )}
        </div>
      </header>

      {/* ===== フィルターバー（横スクロール） ===== */}
      <div className="sticky top-24 z-40 bg-card border-b border-border overflow-x-clip overflow-y-visible">
        <div className="w-full">
          <div ref={filterBarRef} className="flex items-center gap-3 px-4 py-5 overflow-x-auto overflow-y-visible scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* グレードFrom */}
            <div className="relative shrink-0">
              <button
                onClick={() => toggleDropdown('gradeFrom')}
                className={`px-10 py-6 rounded-full text-5xl font-medium border transition-colors whitespace-nowrap ${
                  gradeFrom
                    ? 'bg-primary text-white border-primary'
                    : 'bg-primary-light text-text-main border-border hover:border-primary'
                }`}
              >
                {gradeFrom || '5級-'}
              </button>
              {activeDropdown === 'gradeFrom' && (
                <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto min-w-[200px]">
                  <button
                    onClick={() => handleGradeFromChange('')}
                    className="block w-full px-5 py-4 text-xl text-left hover:bg-primary-light"
                  >
                    下限なし
                  </button>
                  {GRADES.map(g => (
                    <button
                      key={g}
                      onClick={() => handleGradeFromChange(g)}
                      className={`block w-full px-5 py-4 text-xl text-left hover:bg-primary-light ${
                        gradeFrom === g ? 'bg-primary-light text-primary font-bold' : ''
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-text-sub text-2xl shrink-0">〜</span>

            {/* グレードTo */}
            <div className="relative shrink-0">
              <button
                onClick={() => toggleDropdown('gradeTo')}
                className={`px-10 py-6 rounded-full text-5xl font-medium border transition-colors whitespace-nowrap ${
                  gradeTo
                    ? 'bg-primary text-white border-primary'
                    : 'bg-primary-light text-text-main border-border hover:border-primary'
                }`}
              >
                {gradeTo || '三段+'}
              </button>
              {activeDropdown === 'gradeTo' && (
                <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto min-w-[200px]">
                  <button
                    onClick={() => handleGradeToChange('')}
                    className="block w-full px-5 py-4 text-xl text-left hover:bg-primary-light"
                  >
                    上限なし
                  </button>
                  {GRADES.map(g => (
                    <button
                      key={g}
                      onClick={() => handleGradeToChange(g)}
                      className={`block w-full px-5 py-4 text-xl text-left hover:bg-primary-light ${
                        gradeTo === g ? 'bg-primary-light text-primary font-bold' : ''
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ソート */}
            <div className="relative shrink-0">
              <button
                onClick={() => toggleDropdown('sort')}
                className="px-10 py-6 rounded-full text-5xl font-medium border bg-primary-light text-text-main border-border hover:border-primary transition-colors whitespace-nowrap"
              >
                {SORT_OPTIONS.find(o => o.value === sortType)?.label} ▼
              </button>
              {activeDropdown === 'sort' && (
                <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-50 min-w-[220px]">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleSortChange(opt.value)}
                      className={`block w-full px-5 py-4 text-xl text-left hover:bg-primary-light whitespace-nowrap ${
                        sortType === opt.value ? 'bg-primary-light text-primary font-bold' : ''
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ジム */}
            <div className="relative shrink-0">
              <button
                onClick={() => toggleDropdown('gym')}
                className={`px-10 py-6 rounded-full text-5xl font-medium border transition-colors whitespace-nowrap ${
                  selectedGymId !== 'all'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-primary-light text-text-main border-border hover:border-primary'
                }`}
              >
                {selectedGymName} ▼
              </button>
              {activeDropdown === 'gym' && (
                <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto min-w-[220px]">
                  <button
                    onClick={() => handleGymChange('all')}
                    className={`block w-full px-5 py-4 text-xl text-left hover:bg-primary-light whitespace-nowrap ${
                      selectedGymId === 'all' ? 'bg-primary-light text-primary font-bold' : ''
                    }`}
                  >
                    すべて
                  </button>
                  {gyms.map(gym => (
                    <button
                      key={gym.id}
                      onClick={() => handleGymChange(gym.id)}
                      className={`block w-full px-5 py-4 text-xl text-left hover:bg-primary-light whitespace-nowrap ${
                        selectedGymId === gym.id ? 'bg-primary-light text-primary font-bold' : ''
                      }`}
                    >
                      {gym.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 壁 */}
            <div className="relative shrink-0">
              <button
                onClick={() => toggleDropdown('wall')}
                className={`px-10 py-6 rounded-full text-5xl font-medium border transition-colors whitespace-nowrap ${
                  selectedWallId !== 'all'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-primary-light text-text-main border-border hover:border-primary'
                }`}
              >
                {selectedWallName} ▼
              </button>
              {activeDropdown === 'wall' && (
                <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto min-w-[200px]">
                  <button
                    onClick={() => handleWallChange('all')}
                    className={`block w-full px-5 py-4 text-xl text-left hover:bg-primary-light whitespace-nowrap ${
                      selectedWallId === 'all' ? 'bg-primary-light text-primary font-bold' : ''
                    }`}
                  >
                    すべて
                  </button>
                  {currentWalls.map(wall => (
                    <button
                      key={wall.id}
                      onClick={() => handleWallChange(wall.id)}
                      className={`block w-full px-5 py-4 text-xl text-left hover:bg-primary-light whitespace-nowrap ${
                        selectedWallId === wall.id ? 'bg-primary-light text-primary font-bold' : ''
                      }`}
                    >
                      {wall.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ホールドタイプ（複数選択ドロップダウン） */}
            <div className="relative shrink-0">
              <button
                onClick={() => toggleDropdown('holdType')}
                className={`px-10 py-6 rounded-full text-5xl font-medium border transition-colors whitespace-nowrap ${
                  activeHoldTypes.length > 0
                    ? 'bg-primary text-white border-primary'
                    : 'bg-primary-light text-text-main border-border hover:border-primary'
                }`}
              >
                ホールド ▼
              </button>
              {activeDropdown === 'holdType' && (
                <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-50 min-w-[220px]">
                  {HOLD_TYPES.map(ht => (
                    <button
                      key={ht}
                      onClick={() => toggleHoldType(ht)}
                      className={`flex items-center gap-3 w-full px-5 py-4 text-xl text-left hover:bg-primary-light whitespace-nowrap ${
                        activeHoldTypes.includes(ht) ? 'text-primary font-bold' : ''
                      }`}
                    >
                      <span className={`w-7 h-7 rounded border flex items-center justify-center text-base ${
                        activeHoldTypes.includes(ht)
                          ? 'bg-primary border-primary text-white'
                          : 'border-border bg-white'
                      }`}>
                        {activeHoldTypes.includes(ht) && '✓'}
                      </span>
                      {ht}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 課題系統（複数選択ドロップダウン） */}
            <div className="relative shrink-0">
              <button
                onClick={() => toggleDropdown('style')}
                className={`px-10 py-6 rounded-full text-5xl font-medium border transition-colors whitespace-nowrap ${
                  activeStyles.length > 0
                    ? 'bg-primary text-white border-primary'
                    : 'bg-primary-light text-text-main border-border hover:border-primary'
                }`}
              >
                系統 ▼
              </button>
              {activeDropdown === 'style' && (
                <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-50 min-w-[260px]">
                  {STYLES.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleStyle(s)}
                      className={`flex items-center gap-3 w-full px-5 py-4 text-xl text-left hover:bg-primary-light whitespace-nowrap ${
                        activeStyles.includes(s) ? 'text-primary font-bold' : ''
                      }`}
                    >
                      <span className={`w-7 h-7 rounded border flex items-center justify-center text-base ${
                        activeStyles.includes(s)
                          ? 'bg-primary border-primary text-white'
                          : 'border-border bg-white'
                      }`}>
                        {activeStyles.includes(s) && '✓'}
                      </span>
                      {STYLE_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* キャンパ */}
            <button
              onClick={() => toggleCampus()}
              className={`shrink-0 px-10 py-6 rounded-full text-5xl font-medium border transition-colors whitespace-nowrap ${
                isCampus
                  ? 'bg-primary text-white border-primary'
                  : 'bg-primary-light text-text-main border-border hover:border-primary'
              }`}
            >
              キャンパ
            </button>

            {/* 完登非表示（ログイン時のみ） */}
            {user && (
              <button
                onClick={() => toggleHideCompleted()}
                className={`shrink-0 px-10 py-6 rounded-full text-5xl font-medium border transition-colors whitespace-nowrap ${
                  hideCompleted
                    ? 'bg-primary text-white border-primary'
                    : 'bg-primary-light text-text-main border-border hover:border-primary'
                }`}
              >
                完登非表示
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== 課題一覧（2列グリッド） ===== */}
      <main className="w-full pt-[2px]">
        {filteredRoutes.length === 0 ? (
          <p className="text-center text-text-sub py-12 text-2xl">
            {routes.length === 0 ? 'まだ課題が投稿されていません' : '条件に一致する課題がありません'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-[2px]">
            {filteredRoutes.map((route) => (
              <a
                key={route.id}
                href={`/routes/${route.id}`}
                className="block bg-card overflow-hidden"
              >
                <div className="aspect-[5/2] overflow-hidden">
                  <img
                    src={route.image_url}
                    alt="課題写真"
                    className="w-full h-full object-cover object-[center_70%]"
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
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
