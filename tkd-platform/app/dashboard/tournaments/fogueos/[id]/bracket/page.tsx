'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/Toast'
import { calculateAge, getAgeGroup, getWeightCategory } from '@/lib/utils/age'

interface Athlete {
    id: string
    first_name: string
    last_name: string
    birth_date: string
    gender: string
    training_weight: number | null
    club_id: string
    club_name?: string
    belt_levels: { name: string; default_level: string; sort_order: number } | null
}

interface Match {
    id: string
    round_number: number
    match_number: number
    global_match_number: number
    display_number: number | null
    is_pre_match: boolean
    athlete_blue_id: string | null
    athlete_red_id: string | null
    winner_id: string | null
    score_blue: number
    score_red: number
    status: string
    is_bye: boolean
}

interface Pyramid {
    id: string
    name: string
    sort_mode: string
    status: string
    subtitle: string
    gender_group: string | null
    parent_group_id: string | null
    has_pre_match: boolean
    pre_match_count: number
    group_key: string | null
    group_label: string | null
}

interface PyramidGroup {
    groupId: string
    label: string
    sortMode: string
    pyramids: Pyramid[]
}

interface BracketConfig {
    bracketSize: number
    preMatchCount: number
    byeCount: number
    useOutbracket: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAgeCategory(birthDate: string): string {
    if (!birthDate) return 'Infantil'
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    if (age >= 9 && age <= 11) return 'Pre-cadete'
    if (age >= 12 && age <= 14) return 'Cadete'
    if (age >= 15 && age <= 17) return 'Junior'
    if (age >= 18) return 'Senior'
    return 'Infantil'
}

interface AthleteGroup {
    key: string
    label: string
    gender: 'M' | 'F' | 'mixed'
    athletes: Athlete[]
    bracketSize: number
    preMatchCount: number
    byeCount: number
    useOutbracket: boolean
    mergedFrom?: string[]
    mergedMessage?: string
}

function groupAthletes(
    athletes: Athlete[],
    sortMode: string,
    separateGender: boolean,
): AthleteGroup[] {
    type RawGroup = { key: string; label: string; gender: 'M' | 'F' | 'mixed'; athletes: Athlete[]; mergedFrom: string[] }

    const rawMap = new Map<string, { label: string; athletes: Athlete[] }>()

    for (const a of athletes) {
        let key: string
        let label: string
        switch (sortMode) {
            case 'age_only':
            case 'category': {
                const cat = getAgeCategory(a.birth_date)
                key = cat.toLowerCase().replace(' ', '-')
                label = cat
                break
            }
            case 'level_gender': {
                const lvl = a.belt_levels?.default_level ?? 'sin-nivel'
                key = lvl
                label = lvl.charAt(0).toUpperCase() + lvl.slice(1)
                break
            }
            case 'level_gender_weight': {
                const lvl = a.belt_levels?.default_level ?? 'sin-nivel'
                const wcat = a.training_weight ? getWeightCategory(a.training_weight) : 'sin-peso'
                key = `${lvl}--${wcat}`
                label = `${lvl.charAt(0).toUpperCase() + lvl.slice(1)} · ${wcat}`
                break
            }
            default:
                key = 'grupo'
                label = 'Grupo'
        }
        if (!rawMap.has(key)) rawMap.set(key, { label, athletes: [] })
        rawMap.get(key)!.athletes.push(a)
    }

    // Split by gender if requested
    const flat: RawGroup[] = []
    for (const [key, { label, athletes: grpAthletes }] of rawMap) {
        if (separateGender) {
            const males = grpAthletes.filter(a => a.gender === 'M')
            const females = grpAthletes.filter(a => a.gender === 'F')
            if (males.length > 0) flat.push({ key: `${key}-M`, label: `${label} · Masculino`, gender: 'M', athletes: males, mergedFrom: [] })
            if (females.length > 0) flat.push({ key: `${key}-F`, label: `${label} · Femenino`, gender: 'F', athletes: females, mergedFrom: [] })
        } else {
            flat.push({ key, label, gender: 'mixed', athletes: grpAthletes, mergedFrom: [] })
        }
    }

    // Merge groups with < 2 athletes into nearest same-gender group
    let changed = true
    while (changed) {
        changed = false
        const smallIdx = flat.findIndex(g => g.athletes.length < 2)
        if (smallIdx === -1) break

        const small = flat[smallIdx]
        let bestIdx = -1
        let bestDist = Infinity

        for (let i = 0; i < flat.length; i++) {
            if (i === smallIdx) continue
            const sameGender = !separateGender || flat[i].gender === small.gender
            if (!sameGender) continue
            const dist = Math.abs(i - smallIdx)
            if (dist < bestDist) { bestDist = dist; bestIdx = i }
        }

        // If no same-gender group found, fall back to any nearest group
        if (bestIdx === -1) {
            for (let i = 0; i < flat.length; i++) {
                if (i === smallIdx) continue
                const dist = Math.abs(i - smallIdx)
                if (dist < bestDist) { bestDist = dist; bestIdx = i }
            }
        }

        if (bestIdx !== -1) {
            flat[bestIdx].athletes = [...flat[bestIdx].athletes, ...small.athletes]
            flat[bestIdx].mergedFrom = [...flat[bestIdx].mergedFrom, small.label]
            flat.splice(smallIdx, 1)
        } else {
            flat.splice(smallIdx, 1)
        }
        changed = true
    }

    return flat.map(g => {
        const cfg = getBracketConfig(g.athletes.length)
        return {
            key: g.key,
            label: g.label,
            gender: g.gender,
            athletes: g.athletes,
            bracketSize: cfg.bracketSize,
            preMatchCount: cfg.preMatchCount,
            byeCount: cfg.byeCount,
            useOutbracket: cfg.useOutbracket,
            ...(g.mergedFrom.length > 0 ? {
                mergedFrom: g.mergedFrom,
                mergedMessage: `Se unieron aquí: ${g.mergedFrom.join(', ')} (tenían menos de 2 atletas)`,
            } : {}),
        }
    })
}

// Largest power of 2 that is <= n
function prevPowerOf2(n: number): number {
    let p = 1
    while (p * 2 <= n) p *= 2
    return p
}

// Smallest power of 2 that is >= n
function nextPowerOf2(n: number): number {
    if (n <= 1) return 1
    let p = 1
    while (p < n) p *= 2
    return p
}

/**
 * Decides whether to use outbracket (lower bracket + pre-matches) or
 * standard BYEs (upper bracket + empty slots).
 *
 * Rule: use outbracket when it produces fewer "idle" slots than BYEs.
 *   9 athletes → lower=8, upper=16  → byes=7, pre=1  → outbracket (7>1)
 *  27 athletes → lower=16, upper=32 → byes=5, pre=11 → BYEs (5<11)
 *  33 athletes → lower=32, upper=64 → byes=31, pre=1 → outbracket (31>1)
 *  36 athletes → lower=32, upper=64 → byes=28, pre=4 → outbracket (28>4)
 */
function getBracketConfig(n: number): BracketConfig {
    const lower = prevPowerOf2(n)
    const upper = nextPowerOf2(n)

    if (n === lower || n === upper) {
        return { bracketSize: n, preMatchCount: 0, byeCount: 0, useOutbracket: false }
    }

    const byesNeeded = upper - n
    const preMatchsNeeded = n - lower

    if (byesNeeded > preMatchsNeeded) {
        return { bracketSize: lower, preMatchCount: preMatchsNeeded, byeCount: 0, useOutbracket: true }
    }
    return { bracketSize: upper, preMatchCount: 0, byeCount: byesNeeded, useOutbracket: false }
}

/**
 * BUG-5/BUG-6 — distribuye atletas y BYEs en el bracket de forma uniforme.
 *
 * Estrategia: los matches con BYE se intercalan con matches reales.
 * - Si los BYEs son minoría: ocupan posiciones impares (M2, M4, ...).
 * - Si los BYEs son mayoría: los matches reales ocupan posiciones impares
 *   y el resto recibe BYE.
 *
 * Esto garantiza que ningún match enfrente BYE vs BYE y que los BYEs se
 * distribuyan a lo largo de la ronda 1.
 */
function distributeSlots(
    athletes: Athlete[],
    bracketSize: number,
): (Athlete | null)[] {
    const total = athletes.length
    const byeCount = bracketSize - total
    const totalMatches = bracketSize / 2

    if (byeCount === 0) {
        const slots: (Athlete | null)[] = []
        athletes.forEach(a => slots.push(a))
        return slots
    }

    const realCount = totalMatches - byeCount
    const byeMatchIndices = new Set<number>()

    if (byeCount <= realCount) {
        for (let i = 0; i < byeCount; i++) {
            byeMatchIndices.add(1 + 2 * i)
        }
    } else {
        const realIndices = new Set<number>()
        for (let i = 0; i < realCount; i++) {
            realIndices.add(1 + 2 * i)
        }
        for (let m = 0; m < totalMatches; m++) {
            if (!realIndices.has(m)) byeMatchIndices.add(m)
        }
    }

    const slots: (Athlete | null)[] = new Array(bracketSize).fill(null)
    let athleteIdx = 0

    for (let matchIdx = 0; matchIdx < totalMatches; matchIdx++) {
        const blueSlot = matchIdx * 2
        const redSlot = matchIdx * 2 + 1

        if (byeMatchIndices.has(matchIdx)) {
            slots[blueSlot] = athletes[athleteIdx++] ?? null
            slots[redSlot] = null
        } else {
            slots[blueSlot] = athletes[athleteIdx++] ?? null
            slots[redSlot] = athletes[athleteIdx++] ?? null
        }
    }

    return slots
}

function generateSubtitle(sortMode: string, athletes: Athlete[]): string {
    if (athletes.length === 0) return ''
    switch (sortMode) {
        case 'level_gender_weight': {
            const levels = [...new Set(athletes.map(a => a.belt_levels?.default_level ?? ''))].filter(Boolean)
            const weights = athletes.filter(a => a.training_weight).map(a => getWeightCategory(a.training_weight!))
            const uniqueWeights = [...new Set(weights)].slice(0, 3)
            return `${levels.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')} · ${uniqueWeights.join(', ')}`
        }
        case 'level_gender': {
            const levels = [...new Set(athletes.map(a => a.belt_levels?.default_level ?? ''))].filter(Boolean)
            const genders = [...new Set(athletes.map(a => a.gender === 'M' ? 'Masculino' : 'Femenino'))]
            return `${levels.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')} · ${genders.join(' y ')}`
        }
        case 'gender_only': {
            const genders = [...new Set(athletes.map(a => a.gender === 'M' ? 'Masculino' : 'Femenino'))]
            return genders.join(' y ')
        }
        case 'age_only': {
            const ages = athletes.map(a => calculateAge(a.birth_date))
            const minAge = Math.min(...ages)
            const maxAge = Math.max(...ages)
            const groups = [...new Set(ages.map(getAgeGroup))]
            return `${minAge}-${maxAge} años · ${groups.join(', ')}`
        }
        case 'category': {
            const categories = [...new Set(athletes.map(a => getAgeGroup(calculateAge(a.birth_date))))]
            return categories.join(', ')
        }
        default:
            return `${athletes.length} atletas · selección manual`
    }
}

// Progressive disclosure: returns rounds to show and the first locked round.
// Always receives only main-bracket matches (round >= 1); round 0 is handled separately.
function getVisibleRounds(matches: Match[]): { visible: number[]; nextLocked: number | null } {
    const allRounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b)
    const visible: number[] = []

    for (let i = 0; i < allRounds.length; i++) {
        const round = allRounds[i]
        visible.push(round)
        const realInRound = matches.filter(m => m.round_number === round && !m.is_bye)
        const allDone = realInRound.length > 0 && realInRound.every(m => m.status === 'finished')
        if (!allDone) {
            const nextLocked = i + 1 < allRounds.length ? allRounds[i + 1] : null
            return { visible, nextLocked }
        }
    }
    return { visible, nextLocked: null }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SORT_MODES = [
    { id: 'level_gender_weight', label: 'Nivel + Género + Peso', desc: 'Más equilibrado' },
    { id: 'level_gender', label: 'Nivel + Género', desc: 'Sin restricción de peso' },
    { id: 'gender_only', label: 'Solo género', desc: 'Crea 2 pirámides automáticamente' },
    { id: 'category', label: 'Por categoría', desc: 'Según categoría inscrita' },
    { id: 'age_only', label: 'Por edad', desc: 'Respeta rangos de edad' },
    { id: 'manual', label: 'Manual', desc: 'Total libertad' },
]

const SORT_MODE_LABELS: Record<string, string> = {
    level_gender_weight: 'Nivel + Género + Peso',
    level_gender: 'Nivel + Género',
    gender_only: 'Solo género',
    category: 'Por categoría',
    age_only: 'Por edad',
    manual: 'Manual',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BracketPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const supabase = useMemo(() => createClient(), [])
    const { toasts, removeToast, toast } = useToast()
    const fogueoId = params.id as string

    const [userEmail, setUserEmail] = useState('')
    const [clubId, setClubId] = useState('')
    const [fogueo, setFogueo] = useState<any>(null)
    const [pyramids, setPyramids] = useState<Pyramid[]>([])
    const [pyramidGroups, setPyramidGroups] = useState<PyramidGroup[]>([])
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
    const [matchesByPyramid, setMatchesByPyramid] = useState<Record<string, Match[]>>({})
    const [allAthletes, setAllAthletes] = useState<Athlete[]>([])
    const [selectedAthletes, setSelectedAthletes] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [view, setView] = useState<'bracket' | 'new_pyramid'>('bracket')
    const [sortMode, setSortMode] = useState('level_gender_weight')
    const [athleteFilter, setAthleteFilter] = useState('')
    const [clubFilter, setClubFilter] = useState('')
    const [isOrganizer, setIsOrganizer] = useState(false)
    const [availableClubs, setAvailableClubs] = useState<any[]>([])
    const [joinedClubs, setJoinedClubs] = useState<any[]>([])
    const today = new Date().toISOString().split('T')[0]

    // ── Step 3 — preview interactivo de grupos ───────────────────────────────
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [separateGender, setSeparateGender] = useState(true)
    const [groups, setGroups] = useState<AthleteGroup[]>([])
    const [dragAthleteId, setDragAthleteId] = useState<string | null>(null)
    const [dragFromKey, setDragFromKey] = useState<string | null>(null)
    const [moveModal, setMoveModal] = useState<{ athleteId: string; fromKey: string } | null>(null)
    const [dragOverKey, setDragOverKey] = useState<string | null>(null)
    const [moveTargetKey, setMoveTargetKey] = useState<string>('')
    const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null)

    // ── Load ────────────────────────────────────────────────────────────────

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserEmail(user.email ?? '')

            const { data: club } = await supabase
                .from('clubs').select('id').eq('user_id', user.id).single()
            if (!club) return
            setClubId(club.id)

            const { data: fog } = await supabase
                .from('fogueos').select('*').eq('id', fogueoId).single()
            if (fog) { setFogueo(fog); setIsOrganizer(fog.club_id === club.id) }

            // No club_id filter — load athletes from ALL enrolled clubs
            const { data: fa } = await supabase
                .from('fogueo_athletes')
                .select('*, athletes(*, belt_levels(name, default_level, sort_order))')
                .eq('fogueo_id', fogueoId)
            if (fa) {
                const clubIds = [...new Set(fa.map(f => f.club_id))]
                const { data: clubsData } = await supabase
                    .from('clubs').select('id, name').in('id', clubIds)
                const clubMap: Record<string, string> = {}
                clubsData?.forEach(c => { clubMap[c.id] = c.name })
                const athletes = fa.map(f => ({
                    ...(f.athletes as any),
                    club_id: f.club_id,
                    club_name: clubMap[f.club_id] ?? '',
                }))
                setAllAthletes(athletes)
            }

            const { data: pyrs } = await supabase
                .from('fogueo_pyramids').select('*')
                .eq('fogueo_id', fogueoId).order('created_at')
            if (pyrs && pyrs.length > 0) {
                setPyramids(pyrs)
                const groups = buildPyramidGroups(pyrs)
                setPyramidGroups(groups)

                // Si la URL trae ?pyramid=UUID, activar la pirámide correspondiente.
                // En modo gender_only la pirámide vive bajo parent_group_id; en el
                // resto, la pirámide ES el grupo (groupId === pyramid.id).
                const pyramidParam = searchParams.get('pyramid')
                console.log('pyramid param:', pyramidParam)
                console.log('all pyramids:', pyrs.map(p => p.id))

                if (pyramidParam) {
                    const found = pyrs.find(p => p.id === pyramidParam)
                    console.log('found pyramid:', found)
                    if (found) {
                        const groupId = found.parent_group_id ?? found.id
                        console.log('setting activeGroupId:', groupId)
                        setActiveGroupId(groupId)
                    } else {
                        setActiveGroupId(groups[0]?.groupId ?? null)
                    }
                } else {
                    setActiveGroupId(groups[0]?.groupId ?? null)
                }

                await Promise.all(pyrs.map(p => loadMatchesForPyramid(p.id)))
            }

            const { data: fc } = await supabase
                .from('fogueo_clubs').select('*, clubs(id, name, city, logo_url)')
                .eq('fogueo_id', fogueoId)
            if (fc) setJoinedClubs(fc)

            const { data: allClubs } = await supabase
                .from('clubs').select('id, name, city').eq('status', 'active')
            if (allClubs) setAvailableClubs(allClubs)

            setLoading(false)
        }
        load()
    }, [fogueoId])

    // ── Pyramid group builder ────────────────────────────────────────────────

    const buildPyramidGroups = (pyrs: Pyramid[]): PyramidGroup[] => {
        const groups: PyramidGroup[] = []
        const processed = new Set<string>()

        pyrs.forEach(p => {
            if (processed.has(p.id)) return
            if (p.parent_group_id) {
                if (!groups.find(g => g.groupId === p.parent_group_id)) {
                    const siblings = pyrs.filter(s => s.parent_group_id === p.parent_group_id)
                    siblings.forEach(s => processed.add(s.id))
                    groups.push({
                        groupId: p.parent_group_id,
                        label: `Fogueo ${groups.length + 1} · Solo género`,
                        sortMode: 'gender_only',
                        pyramids: siblings,
                    })
                }
            } else {
                processed.add(p.id)
                groups.push({
                    groupId: p.id,
                    label: p.group_label ?? `Fogueo ${groups.length + 1} · ${SORT_MODE_LABELS[p.sort_mode]}`,
                    sortMode: p.sort_mode,
                    pyramids: [p],
                })
            }
        })
        return groups
    }

    // ── Match loader ─────────────────────────────────────────────────────────

    const loadMatchesForPyramid = async (pyramidId: string) => {
        const { data } = await supabase
            .from('fogueo_matches').select('*')
            .eq('pyramid_id', pyramidId)
            .order('global_match_number')
        if (data) setMatchesByPyramid(prev => ({ ...prev, [pyramidId]: data }))
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    const getAthleteById = (id: string | null): Athlete | null => {
        if (!id) return null
        return allAthletes.find(a => a.id === id) ?? null
    }

    const sortAthletes = (athletes: Athlete[], mode: string): Athlete[] => {
        const s = [...athletes]
        switch (mode) {
            case 'level_gender_weight':
                return s.sort((a, b) => {
                    const la = (a.belt_levels as any)?.sort_order ?? 0
                    const lb = (b.belt_levels as any)?.sort_order ?? 0
                    if (la !== lb) return la - lb
                    if (a.gender !== b.gender) return a.gender.localeCompare(b.gender)
                    return (a.training_weight ?? 0) - (b.training_weight ?? 0)
                })
            case 'level_gender':
                return s.sort((a, b) => {
                    const la = (a.belt_levels as any)?.sort_order ?? 0
                    const lb = (b.belt_levels as any)?.sort_order ?? 0
                    if (la !== lb) return la - lb
                    return a.gender.localeCompare(b.gender)
                })
            case 'gender_only':
                return s.sort((a, b) => a.gender.localeCompare(b.gender))
            case 'age_only':
                return s.sort((a, b) => calculateAge(a.birth_date) - calculateAge(b.birth_date))
            default:
                return s.sort(() => Math.random() - 0.5)
        }
    }

    const getRoundName = (round: number, totalRounds: number) => {
        if (round === totalRounds) return 'Final'
        if (round === totalRounds - 1) return 'Semifinal'
        if (round === totalRounds - 2) return 'Cuartos'
        if (round === totalRounds - 3) return 'Octavos'
        return `Ronda ${round}`
    }

    // ── Advance winner ───────────────────────────────────────────────────────

    const advanceWinnerDB = async (
        pyramidId: string,
        currentRound: number,
        currentMatchNum: number,
        winnerId: string
    ) => {
        let nextRound: number
        let nextMatchNum: number
        let isBlueInNext: boolean

        if (currentRound === 0) {
            // Pre-match k feeds R1 match k, always as blue
            nextRound = 1
            nextMatchNum = currentMatchNum
            isBlueInNext = true
        } else {
            nextRound = currentRound + 1
            nextMatchNum = Math.ceil(currentMatchNum / 2)
            isBlueInNext = currentMatchNum % 2 !== 0
        }

        const { data: nextMatch } = await supabase
            .from('fogueo_matches')
            .select('*')
            .eq('pyramid_id', pyramidId)
            .eq('round_number', nextRound)
            .eq('match_number', nextMatchNum)
            .maybeSingle()

        if (!nextMatch) return

        const update = isBlueInNext
            ? { athlete_blue_id: winnerId }
            : { athlete_red_id: winnerId }

        await supabase.from('fogueo_matches').update(update).eq('id', nextMatch.id)
    }

    // ── Bracket generation ───────────────────────────────────────────────────

    const createSingleBracket = async (
        athletes: Athlete[],
        mode: string,
        pyramidName: string,
        genderGroup: string | null,
        parentGroupId: string | null,
        groupKey?: string,
        groupLabel?: string,
    ): Promise<Pyramid | null> => {
        if (!isOrganizer) {
            toast.error('Solo el organizador puede crear brackets')
            return null
        }
        const config = getBracketConfig(athletes.length)
        const { bracketSize, preMatchCount, useOutbracket } = config

        const totalRealMatches = athletes.length - 1
        const sortDesc = generateSubtitle(mode, athletes)
        const preMatchStr = preMatchCount > 0
            ? ` · ${preMatchCount} pre-match${preMatchCount !== 1 ? 'es' : ''}`
            : ''
        const subtitle = `${athletes.length} atletas${preMatchStr} · Match 1–${totalRealMatches}${sortDesc ? ' · ' + sortDesc : ''}`

        const { data: pyramid, error } = await supabase
            .from('fogueo_pyramids').insert({
                fogueo_id: fogueoId,
                name: pyramidName,
                sort_mode: mode,
                status: 'pending',
                subtitle,
                gender_group: genderGroup,
                parent_group_id: parentGroupId,
                has_pre_match: preMatchCount > 0,
                pre_match_count: preMatchCount,
                group_key: groupKey ?? null,
                group_label: groupLabel ?? null,
            }).select().single()

        if (error || !pyramid) return null

        const matchesToCreate: any[] = []
        let globalCounter = 1
        let displayCounter = 1

        if (useOutbracket) {
            // ── Outbracket path ──────────────────────────────────────────────
            // directCount athletes go straight into the main bracket.
            // preMatchCount * 2 athletes play pre-matches; their winners take
            // the blue slot of R1 matches 1..preMatchCount.
            const directCount = athletes.length - preMatchCount * 2
            const rounds = Math.log2(bracketSize)

            // Pre-matches (round_number=0, is_pre_match=true, display_number=null)
            for (let k = 1; k <= preMatchCount; k++) {
                const blueIdx = directCount + 2 * (k - 1)
                const redIdx = blueIdx + 1
                matchesToCreate.push({
                    pyramid_id: pyramid.id,
                    round_number: 0,
                    match_number: k,
                    global_match_number: globalCounter++,
                    display_number: null,
                    is_pre_match: true,
                    athlete_blue_id: athletes[blueIdx]?.id ?? null,
                    athlete_red_id: athletes[redIdx]?.id ?? null,
                    winner_id: null,
                    status: 'pending',
                    score_blue: 0,
                    score_red: 0,
                    is_bye: false,
                })
            }

            // R1 matches
            const r1MatchCount = bracketSize / 2
            for (let k = 1; k <= r1MatchCount; k++) {
                if (k <= preMatchCount) {
                    // Blue slot reserved for pre-match winner; red = direct athlete k-1
                    matchesToCreate.push({
                        pyramid_id: pyramid.id,
                        round_number: 1,
                        match_number: k,
                        global_match_number: globalCounter++,
                        display_number: displayCounter++,
                        is_pre_match: false,
                        athlete_blue_id: null,
                        athlete_red_id: athletes[k - 1]?.id ?? null,
                        winner_id: null,
                        status: 'pending',
                        score_blue: 0,
                        score_red: 0,
                        is_bye: false,
                    })
                } else {
                    // Direct match: pair athletes from the direct pool
                    const offset = preMatchCount + 2 * (k - preMatchCount - 1)
                    matchesToCreate.push({
                        pyramid_id: pyramid.id,
                        round_number: 1,
                        match_number: k,
                        global_match_number: globalCounter++,
                        display_number: displayCounter++,
                        is_pre_match: false,
                        athlete_blue_id: athletes[offset]?.id ?? null,
                        athlete_red_id: athletes[offset + 1]?.id ?? null,
                        winner_id: null,
                        status: 'pending',
                        score_blue: 0,
                        score_red: 0,
                        is_bye: false,
                    })
                }
            }

            // Rounds 2+ (all real matches)
            let prevCount = bracketSize / 2
            for (let r = 2; r <= rounds; r++) {
                const count = prevCount / 2
                for (let m = 1; m <= count; m++) {
                    matchesToCreate.push({
                        pyramid_id: pyramid.id,
                        round_number: r,
                        match_number: m,
                        global_match_number: globalCounter++,
                        display_number: displayCounter++,
                        is_pre_match: false,
                        athlete_blue_id: null,
                        athlete_red_id: null,
                        winner_id: null,
                        status: 'pending',
                        score_blue: 0,
                        score_red: 0,
                        is_bye: false,
                    })
                }
                prevCount = count
            }

            await supabase.from('fogueo_matches').insert(matchesToCreate)

        } else {
            // ── Standard BYE path ────────────────────────────────────────────
            // BUG-5/BUG-6 — los BYEs se distribuyen intercalados (no agrupados al final)
            // para evitar matches BYE-vs-BYE.
            const rounds = Math.log2(bracketSize)

            const finalSlots = distributeSlots(athletes, bracketSize)

            const round1: any[] = []
            for (let i = 0; i < bracketSize; i += 2) {
                const blue = finalSlots[i] ?? null
                const red = finalSlots[i + 1] ?? null
                // Ambos null no debería ocurrir con distributeSlots — saltar por seguridad
                if (!blue && !red) continue
                const isBye = !blue || !red
                round1.push({
                    pyramid_id: pyramid.id,
                    round_number: 1,
                    match_number: Math.floor(i / 2) + 1,
                    global_match_number: globalCounter++,
                    display_number: isBye ? null : displayCounter++,
                    is_pre_match: false,
                    athlete_blue_id: blue?.id ?? null,
                    athlete_red_id: red?.id ?? null,
                    winner_id: isBye ? (blue?.id ?? red?.id ?? null) : null,
                    status: isBye ? 'finished' : 'pending',
                    score_blue: 0,
                    score_red: 0,
                    is_bye: isBye,
                })
            }
            matchesToCreate.push(...round1)

            let prevCount = bracketSize / 2
            for (let r = 2; r <= rounds; r++) {
                const count = prevCount / 2
                for (let m = 1; m <= count; m++) {
                    matchesToCreate.push({
                        pyramid_id: pyramid.id,
                        round_number: r,
                        match_number: m,
                        global_match_number: globalCounter++,
                        display_number: displayCounter++,
                        is_pre_match: false,
                        athlete_blue_id: null,
                        athlete_red_id: null,
                        winner_id: null,
                        status: 'pending',
                        score_blue: 0,
                        score_red: 0,
                        is_bye: false,
                    })
                }
                prevCount = count
            }

            await supabase.from('fogueo_matches').insert(matchesToCreate)

            // Advance BYE winners so later slots are pre-populated
            for (const m of round1) {
                if (m.is_bye && m.winner_id) {
                    await advanceWinnerDB(pyramid.id, 1, m.match_number, m.winner_id)
                }
            }
        }

        return pyramid
    }

    const generateBracket = useCallback(async () => {
        if (selectedAthletes.length < 2) {
            toast.error('Selecciona al menos 2 atletas')
            return
        }
        setGenerating(true)

        try {
            const athletes = allAthletes.filter(a => selectedAthletes.includes(a.id))
            const fogueoNum = pyramidGroups.length + 1

            if (sortMode === 'gender_only') {
                const males = sortAthletes(athletes.filter(a => a.gender === 'M'), sortMode)
                const females = sortAthletes(athletes.filter(a => a.gender === 'F'), sortMode)

                if (males.length === 0 && females.length === 0) {
                    toast.error('No hay atletas para separar por género')
                    setGenerating(false)
                    return
                }

                const groupId = crypto.randomUUID()
                const newPyramids: Pyramid[] = []

                if (males.length >= 2) {
                    const p = await createSingleBracket(males, sortMode, `Fogueo ${fogueoNum} — Masculino`, 'M', groupId)
                    if (p) newPyramids.push(p)
                } else if (males.length === 1) {
                    toast.warning('Solo hay 1 atleta masculino — se necesitan al menos 2')
                }

                if (females.length >= 2) {
                    const p = await createSingleBracket(females, sortMode, `Fogueo ${fogueoNum} — Femenino`, 'F', groupId)
                    if (p) newPyramids.push(p)
                } else if (females.length === 1) {
                    toast.warning('Solo hay 1 atleta femenina — se necesitan al menos 2')
                }

                if (newPyramids.length > 0) {
                    setPyramids(prev => {
                        const updated = [...prev, ...newPyramids]
                        const groups = buildPyramidGroups(updated)
                        setPyramidGroups(groups)
                        setActiveGroupId(groupId)
                        return updated
                    })
                    await Promise.all(newPyramids.map(p => loadMatchesForPyramid(p.id)))
                    const mPart = males.length >= 2 ? `${males.length}M` : ''
                    const fPart = females.length >= 2 ? `${females.length}F` : ''
                    toast.success(`Fogueo ${fogueoNum} creado: ${[mPart, fPart].filter(Boolean).join(' · ')}`)
                }
            } else {
                const sorted = sortAthletes(athletes, sortMode)
                const p = await createSingleBracket(sorted, sortMode, `Fogueo ${fogueoNum}`, null, null)
                if (p) {
                    setPyramids(prev => {
                        const updated = [...prev, p]
                        const groups = buildPyramidGroups(updated)
                        setPyramidGroups(groups)
                        setActiveGroupId(p.id)
                        return updated
                    })
                    await loadMatchesForPyramid(p.id)
                    const cfg = getBracketConfig(sorted.length)
                    const preStr = cfg.useOutbracket ? ` · ${cfg.preMatchCount} pre-match${cfg.preMatchCount !== 1 ? 'es' : ''}` : ''
                    toast.success(`Fogueo ${fogueoNum} generado · ${sorted.length} atletas${preStr}`)
                }
            }

            setView('bracket')
            setSelectedAthletes([])
        } catch (e) {
            console.error(e)
            toast.error('Error al generar el bracket')
        } finally {
            setGenerating(false)
        }
    }, [selectedAthletes, sortMode, allAthletes, pyramidGroups])

    // ── Generate all groups ───────────────────────────────────────────────────

    const handleGenerateAll = useCallback(async () => {
        if (groups.length === 0) return
        setGenerating(true)
        try {
            const newPyramids: Pyramid[] = []
            let skipped = 0

            for (const group of groups) {
                if (group.athletes.length < 2) {
                    toast.warning(`${group.label}: necesita al menos 2 atletas (omitido)`)
                    skipped++
                    continue
                }
                const sorted = sortAthletes(group.athletes, sortMode)
                const p = await createSingleBracket(
                    sorted,
                    sortMode,
                    group.label,
                    group.gender === 'mixed' ? null : group.gender,
                    null,
                    group.key,
                    group.label,
                )
                if (p) newPyramids.push(p)
            }

            if (newPyramids.length > 0) {
                setPyramids(prev => {
                    const updated = [...prev, ...newPyramids]
                    const pGroups = buildPyramidGroups(updated)
                    setPyramidGroups(pGroups)
                    setActiveGroupId(newPyramids[0].id)
                    return updated
                })
                await Promise.all(newPyramids.map(p => loadMatchesForPyramid(p.id)))
                const total = newPyramids.length
                toast.success(`${total} bracket${total !== 1 ? 's' : ''} generados${skipped > 0 ? ` · ${skipped} omitido${skipped !== 1 ? 's' : ''}` : ''}`)
            }

            setView('bracket')
            setSelectedAthletes([])
            setGroups([])
            setStep(1)
        } catch (e) {
            console.error(e)
            toast.error('Error al generar los brackets')
        } finally {
            setGenerating(false)
        }
    }, [groups, sortMode, pyramidGroups])

    // ── Mark winner ──────────────────────────────────────────────────────────

    const updateMatchWinner = async (
        match: Match,
        pyramidId: string,
        winnerId: string,
        isBlue: boolean,
    ) => {
        if (match.is_bye) return
        if (updatingMatchId) return
        setUpdatingMatchId(match.id)
        try {

        const { error } = await supabase
            .from('fogueo_matches')
            .update({
                winner_id: winnerId,
                status: 'finished',
                score_blue: isBlue ? 1 : 0,
                score_red: isBlue ? 0 : 1,
            })
            .eq('id', match.id)

        if (error) { toast.error('Error al guardar el resultado'); return }

        setMatchesByPyramid(prev => ({
            ...prev,
            [pyramidId]: prev[pyramidId].map(m =>
                m.id === match.id
                    ? { ...m, winner_id: winnerId, status: 'finished', score_blue: isBlue ? 1 : 0, score_red: isBlue ? 0 : 1 }
                    : m
            ),
        }))

        await advanceWinnerDB(pyramidId, match.round_number, match.match_number, winnerId)
        await loadMatchesForPyramid(pyramidId)

        const label = match.is_pre_match ? 'Pre-match' : `Match ${match.display_number}`
        toast.success(`${label} · Ganador registrado ✓`)
        } finally {
            setUpdatingMatchId(null)
        }
    }

    // ── Join fogueo ──────────────────────────────────────────────────────────

    const joinFogueo = async () => {
        if (!clubId) return
        if (fogueo?.visibility === 'invite_only') {
            toast.error('Este fogueo es solo por invitación.')
            return
        }
        if (joinedClubs.some(fc => fc.club_id === clubId)) {
            toast.warning('Tu club ya está inscrito en este fogueo')
            return
        }
        const { error } = await supabase.from('fogueo_clubs').insert({
            fogueo_id: fogueoId,
            club_id: clubId,
            status: 'confirmed',
        })
        if (!error) {
            toast.success('¡Te uniste al fogueo!')
            const { data: fc } = await supabase
                .from('fogueo_clubs').select('*, clubs(id, name, city, logo_url)')
                .eq('fogueo_id', fogueoId)
            if (fc) setJoinedClubs(fc)
        } else {
            toast.error('Error al unirse al fogueo')
        }
    }

    // ── Move athlete between groups ───────────────────────────────────────────

    const moveAthleteToGroup = (athleteId: string, fromKey: string, toKey: string) => {
        if (fromKey === toKey) return
        setGroups(prev => {
            const updated: AthleteGroup[] = prev.map(g => ({ ...g, athletes: [...g.athletes] }))
            const fromGroup = updated.find(g => g.key === fromKey)
            const toGroup = updated.find(g => g.key === toKey)
            if (!fromGroup || !toGroup) return prev

            const athlete = fromGroup.athletes.find(a => a.id === athleteId)
            if (!athlete) return prev

            fromGroup.athletes = fromGroup.athletes.filter(a => a.id !== athleteId)
            toGroup.athletes = [...toGroup.athletes, athlete]

            return updated
                .filter(g => g.athletes.length > 0)
                .map(g => {
                    const cfg = getBracketConfig(g.athletes.length)
                    return { ...g, bracketSize: cfg.bracketSize, preMatchCount: cfg.preMatchCount, byeCount: cfg.byeCount, useOutbracket: cfg.useOutbracket }
                })
        })
    }

    // ── Derived ──────────────────────────────────────────────────────────────

    const activeGroup = pyramidGroups.find(g => g.groupId === activeGroupId)
    const isJoined = joinedClubs.some(fc => fc.club_id === clubId)

    const filteredAthletes = allAthletes.filter(a => {
        if (!athleteFilter) return true
        return `${a.first_name} ${a.last_name}`.toLowerCase().includes(athleteFilter.toLowerCase())
    })

    const filteredClubs = availableClubs.filter(c => {
        if (joinedClubs.some(fc => fc.club_id === c.id)) return false
        if (!clubFilter) return true
        return c.name.toLowerCase().includes(clubFilter.toLowerCase()) ||
            c.city.toLowerCase().includes(clubFilter.toLowerCase())
    })

    const previewConfig = selectedAthletes.length >= 2
        ? getBracketConfig(selectedAthletes.length)
        : null
    const previewMatches = Math.max(0, selectedAthletes.length - 1)

    // ── Match card renderer (shared by pre-match and main bracket) ───────────

    const MatchCard = ({ match, pyramidId, isPreMatch = false }: {
        match: Match
        pyramidId: string
        isPreMatch?: boolean
    }) => {
        const blue = getAthleteById(match.athlete_blue_id)
        const red = getAthleteById(match.athlete_red_id)
        const blueWon = match.winner_id != null && match.winner_id === match.athlete_blue_id
        const redWon = match.winner_id != null && match.winner_id === match.athlete_red_id

        return (
            <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl overflow-hidden" style={{ minWidth: '185px' }}>
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1e1e2e]"
                    style={{ background: isPreMatch ? '#2a1800' : '#13131f' }}>
                    <span className="text-xs font-bold"
                        style={{ color: isPreMatch ? '#F59E0B' : '#BA7517' }}>
                        {isPreMatch ? `Pre-match ${match.match_number}` : `Match ${match.display_number}`}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${match.status === 'finished'
                        ? 'bg-green-900/40 text-green-400'
                        : 'text-gray-600'}`}>
                        {match.status === 'finished' ? '✓ Finalizado' : 'Pendiente'}
                    </span>
                </div>

                {/* Blue */}
                <div
                    className={`flex items-center gap-2 px-3 py-2 border-b border-[#1e1e2e] transition ${isOrganizer && blue && match.status !== 'finished' && updatingMatchId !== match.id ? 'cursor-pointer hover:bg-blue-900/30' : ''} ${updatingMatchId === match.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ background: blueWon ? '#1e3a5f' : '#0d1220' }}
                    onClick={() => isOrganizer && blue && match.status !== 'finished' && !updatingMatchId && updateMatchWinner(match, pyramidId, blue.id, true)}
                >
                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-xs truncate" style={{ color: blueWon ? '#93c5fd' : '#d1d5db', fontWeight: blueWon ? 600 : 400 }}>
                            {blue ? `${blue.first_name} ${blue.last_name[0]}.` : 'Por definir'}
                        </div>
                        {blue && (
                            <div className="text-xs text-gray-600 truncate">
                                {blue.club_name}{blue.training_weight ? ` · ${blue.training_weight}kg` : ''}
                            </div>
                        )}
                    </div>
                    {blueWon && <span className="text-xs flex-shrink-0" style={{ color: '#93c5fd' }}>✓</span>}
                </div>

                {/* Red */}
                <div
                    className={`flex items-center gap-2 px-3 py-2 transition ${isOrganizer && red && match.status !== 'finished' && updatingMatchId !== match.id ? 'cursor-pointer hover:bg-red-900/30' : ''} ${updatingMatchId === match.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ background: redWon ? '#3a1a1a' : '#1a0d0d' }}
                    onClick={() => isOrganizer && red && match.status !== 'finished' && !updatingMatchId && updateMatchWinner(match, pyramidId, red.id, false)}
                >
                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-xs truncate" style={{ color: redWon ? '#fca5a5' : '#d1d5db', fontWeight: redWon ? 600 : 400 }}>
                            {red ? `${red.first_name} ${red.last_name[0]}.` : 'Por definir'}
                        </div>
                        {red && (
                            <div className="text-xs text-gray-600 truncate">
                                {red.club_name}{red.training_weight ? ` · ${red.training_weight}kg` : ''}
                            </div>
                        )}
                    </div>
                    {redWon && <span className="text-xs flex-shrink-0" style={{ color: '#fca5a5' }}>✓</span>}
                </div>
                {fogueo?.scoring_type === 'conventional' &&
                    match.status !== 'finished' &&
                    match.athlete_blue_id &&
                    match.athlete_red_id && (
                        <Link
                            href={`/dashboard/tournaments/fogueos/${fogueoId}/match/${match.id}`}
                            className="w-full text-center text-xs py-1.5 bg-amber-900/20 border-t border-amber-900/40 text-amber-400 hover:bg-amber-900/30 transition block"
                        >
                            Iniciar combate →
                        </Link>
                    )}
            </div>
        )
    }

    // ── BracketView sub-component ────────────────────────────────────────────

    const BracketView = ({ pyramid }: { pyramid: Pyramid }) => {
        const allMatches = matchesByPyramid[pyramid.id] ?? []

        // Pre-matches (round 0) always shown, never locked
        const preMatches = allMatches.filter(m => m.round_number === 0)
        // Main bracket matches (round >= 1) subject to progressive disclosure
        const mainMatches = allMatches.filter(m => m.round_number >= 1)

        const allMainRounds = [...new Set(mainMatches.map(m => m.round_number))].sort((a, b) => a - b)
        const totalRounds = allMainRounds[allMainRounds.length - 1] ?? 1

        const { visible: visibleRounds, nextLocked } = getVisibleRounds(mainMatches)

        // Athlete count: unique IDs across pre-matches AND R1 of main bracket
        const athleteIdsInPyramid = new Set<string>([
            ...mainMatches.filter(m => m.round_number === 1 && m.athlete_blue_id != null).map(m => m.athlete_blue_id!),
            ...mainMatches.filter(m => m.round_number === 1 && m.athlete_red_id != null).map(m => m.athlete_red_id!),
            ...preMatches.filter(m => m.athlete_blue_id != null).map(m => m.athlete_blue_id!),
            ...preMatches.filter(m => m.athlete_red_id != null).map(m => m.athlete_red_id!),
        ])
        const athleteCount = athleteIdsInPyramid.size

        const maxDisplayNum = mainMatches
            .filter(m => !m.is_bye && m.display_number != null)
            .reduce((max, m) => Math.max(max, m.display_number!), 0)

        const genderLabel = pyramid.gender_group === 'M'
            ? 'Masculino'
            : pyramid.gender_group === 'F'
                ? 'Femenino'
                : null

        return (
            <div className={`mb-6 ${pyramid.gender_group ? 'border border-[#1e1e2e] rounded-2xl p-4' : ''}`}>
                {/* Gender header */}
                {genderLabel && (
                    <div
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold mb-4"
                        style={pyramid.gender_group === 'M'
                            ? { background: '#0C2340', color: '#93c5fd', border: '1px solid #1e3a5f' }
                            : { background: '#3a0e1a', color: '#f9a8d4', border: '1px solid #5f1e2e' }}
                    >
                        <span>{genderLabel}</span>
                        <span className="opacity-50 font-normal">·</span>
                        <span className="font-normal text-xs opacity-80">{athleteCount} atletas</span>
                        {(pyramid.pre_match_count ?? 0) > 0 && (
                            <>
                                <span className="opacity-50 font-normal">·</span>
                                <span className="font-normal text-xs" style={{ color: '#F59E0B', opacity: 0.9 }}>
                                    {pyramid.pre_match_count} pre-match{pyramid.pre_match_count !== 1 ? 'es' : ''}
                                </span>
                            </>
                        )}
                        {maxDisplayNum > 0 && (
                            <>
                                <span className="opacity-50 font-normal">·</span>
                                <span className="font-normal text-xs opacity-80">Match 1–{maxDisplayNum}</span>
                            </>
                        )}
                    </div>
                )}

                {allMatches.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">Sin matches generados</div>
                ) : (
                    <>
                        {/* Pre-match section — amber, always visible */}
                        {preMatches.length > 0 && (
                            <div className="rounded-xl mb-4 p-4"
                                style={{ background: '#1a1000', border: '1px solid #7a5c00' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#F59E0B' }}>
                                        Pre-match — Outbracket
                                    </span>
                                </div>
                                <p className="text-xs mb-3" style={{ color: '#92400e' }}>
                                    El ganador de cada pre-match entra al Match correspondiente como azul
                                </p>
                                <div className="flex gap-3 flex-wrap">
                                    {preMatches.map(match => (
                                        <MatchCard key={match.id} match={match} pyramidId={pyramid.id} isPreMatch />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Main bracket — progressive disclosure */}
                        <div className="flex gap-3 overflow-x-auto pb-4">
                            {visibleRounds.map(round => {
                                // BUG visual — render unificado ordenado por match_number.
                                // En R1 se intercalan reales y BYEs; en R2+ los BYEs no se muestran.
                                const roundMatches = mainMatches
                                    .filter(m => m.round_number === round && (round === 1 || !m.is_bye))
                                    .sort((a, b) => a.match_number - b.match_number)
                                const realCount = roundMatches.filter(m => !m.is_bye).length
                                return (
                                    <div key={round} className="flex-shrink-0" style={{ minWidth: '185px' }}>
                                        <div className="flex items-center justify-between text-xs text-gray-500 uppercase tracking-wider mb-3 px-1">
                                            <span>{getRoundName(round, totalRounds)}</span>
                                            <span className="text-gray-600">{realCount}c</span>
                                        </div>
                                        <div className="space-y-2">
                                            {roundMatches.map(match => {
                                                if (!match.is_bye) {
                                                    return <MatchCard key={match.id} match={match} pyramidId={pyramid.id} />
                                                }
                                                const byeAthlete = getAthleteById(match.winner_id)
                                                return (
                                                    <div key={match.id} className="rounded-xl overflow-hidden"
                                                        style={{ minWidth: '185px', background: '#1a1200', border: '1px dashed #7a5c00' }}>
                                                        <div className="flex items-center justify-between px-2.5 py-1.5 border-b"
                                                            style={{ borderColor: '#7a5c00', background: '#221600' }}>
                                                            <span className="text-xs font-bold" style={{ color: '#F59E0B' }}>BYE</span>
                                                            <span className="text-xs" style={{ color: '#7a5c00' }}>auto ✓</span>
                                                        </div>
                                                        <div className="px-3 py-2.5">
                                                            <div className="text-xs font-medium text-gray-300 truncate">
                                                                {byeAthlete ? `${byeAthlete.first_name} ${byeAthlete.last_name}` : '—'}
                                                            </div>
                                                            {byeAthlete && (
                                                                <div className="text-xs text-gray-600 truncate mt-0.5">{byeAthlete.club_name}</div>
                                                            )}
                                                            <div className="text-xs mt-1.5" style={{ color: '#92400e' }}>
                                                                Avanza a ronda 2 →
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Locked round placeholder */}
                            {nextLocked !== null && (
                                <div className="flex-shrink-0" style={{ minWidth: '185px' }}>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 px-1">
                                        {getRoundName(nextLocked, totalRounds)}
                                    </div>
                                    <div className="bg-[#13131f] border border-dashed border-[#2e2e3e] rounded-xl p-5 text-center">
                                        <div className="text-gray-600 text-base mb-2">🔒</div>
                                        <div className="text-gray-600 text-xs leading-relaxed">
                                            Se desbloquea al terminar ronda anterior
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Champion column */}
                            {mainMatches.some(m => m.winner_id && m.round_number === totalRounds && !m.is_bye) && (
                                <div className="flex-shrink-0" style={{ minWidth: '130px' }}>
                                    <div className="text-xs text-yellow-400 uppercase tracking-wider mb-3 px-1">
                                        {pyramid.gender_group === 'M' ? 'Campeón M' : pyramid.gender_group === 'F' ? 'Campeona F' : 'Campeón'}
                                    </div>
                                    <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-4 text-center">
                                        {(() => {
                                            const finalMatch = mainMatches.find(m => m.round_number === totalRounds && !m.is_bye)
                                            const champ = getAthleteById(finalMatch?.winner_id ?? null)
                                            return champ ? (
                                                <>
                                                    <div className="text-xl mb-2">🏆</div>
                                                    <div className="text-xs font-medium text-yellow-400">{champ.first_name} {champ.last_name}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{champ.club_name}</div>
                                                </>
                                            ) : <div className="text-xs text-gray-600 py-2">Por definir</div>
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        )
    }

    // ── Render ───────────────────────────────────────────────────────────────

    if (loading) return (
        <div className="flex min-h-screen bg-[#07070f] text-white items-center justify-center">
            <div className="text-gray-500">Cargando brackets...</div>
        </div>
    )

    return (
        <>
            <div className="flex min-h-screen bg-[#07070f] text-white">
                <Sidebar userEmail={userEmail} />
                <main className="flex-1 p-6 overflow-x-auto">
                    <div className="max-w-7xl mx-auto">

                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                                    <Link href="/dashboard/tournaments/fogueos" className="hover:text-white transition">Fogueos</Link>
                                    <span>›</span>
                                    <Link href={`/dashboard/tournaments/fogueos/${fogueoId}`} className="hover:text-white transition truncate max-w-32">{fogueo?.name}</Link>
                                    <span>›</span>
                                    <span className="text-white">Brackets</span>
                                </div>
                                <h1 className="text-xl font-bold">
                                    <span className="text-blue-500">TKD</span> — Brackets · {fogueo?.name}
                                </h1>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {allAthletes.length} atletas · {joinedClubs.length} clubes · {pyramidGroups.length} fogueo{pyramidGroups.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {!isOrganizer && isJoined && (
                                    <span className="text-xs px-3 py-2 rounded-xl bg-green-900/40 text-green-400 border border-green-900/40">
                                        ✓ Inscrito
                                    </span>
                                )}
                                {!isOrganizer && !isJoined && (
                                    <button onClick={joinFogueo}
                                        className="text-xs px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition">
                                        Unirme al fogueo
                                    </button>
                                )}
                                {isOrganizer && (
                                    <button
                                        onClick={() => { setView('new_pyramid'); setSelectedAthletes([]); setStep(1); setGroups([]) }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                                        + Nueva pirámide
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Bracket view */}
                        {view === 'bracket' && (
                            <>
                                {pyramidGroups.length > 0 ? (
                                    <>
                                        <div className="flex gap-2 flex-wrap mb-5">
                                            {pyramidGroups.map((group, i) => (
                                                <button
                                                    key={group.groupId}
                                                    onClick={() => setActiveGroupId(group.groupId)}
                                                    className={`text-left px-3 py-2 rounded-xl border transition ${activeGroupId === group.groupId
                                                        ? 'bg-blue-900/40 border-blue-500/50 text-blue-400'
                                                        : 'bg-[#0d0d1a] border-[#1e1e2e] text-gray-400 hover:border-gray-500'}`}
                                                >
                                                    <div className="text-xs font-medium">{group.label}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5 max-w-48 truncate">
                                                        {group.pyramids[0]?.subtitle ?? ''}
                                                    </div>
                                                </button>
                                            ))}
                                            {isOrganizer && (
                                                <button
                                                    onClick={() => { setView('new_pyramid'); setSelectedAthletes([]); setStep(1); setGroups([]) }}
                                                    className="px-3 py-2 rounded-xl border border-dashed border-[#2e2e3e] text-gray-600 hover:border-blue-500/50 hover:text-blue-400 transition text-xs">
                                                    + Nueva
                                                </button>
                                            )}
                                        </div>

                                        {activeGroup && (
                                            <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                                                <div className="flex items-center gap-3 mb-4 flex-wrap">
                                                    <span className="text-sm font-medium text-white">
                                                        Fogueo {pyramidGroups.findIndex(g => g.groupId === activeGroupId) + 1}
                                                    </span>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400">
                                                        {SORT_MODE_LABELS[activeGroup.sortMode]}
                                                    </span>
                                                    <span className="text-xs text-gray-500">{activeGroup.pyramids[0]?.subtitle}</span>
                                                    <span className="ml-auto text-xs text-gray-600">
                                                        {activeGroup.pyramids.reduce((sum, p) =>
                                                            sum + (matchesByPyramid[p.id]?.filter(m => !m.is_bye && !m.is_pre_match).length ?? 0), 0
                                                        )} combates
                                                    </span>
                                                </div>

                                                {activeGroup.pyramids.map(p => (
                                                    <BracketView key={p.id} pyramid={p} />
                                                ))}

                                                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap pt-3 border-t border-[#1e1e2e]">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500" />Azul (arriba)
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-red-500" />Rojo (abajo)
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-yellow-500" />Número de match
                                                    </div>
                                                    {isOrganizer && <span className="text-gray-600">· Clic en atleta para marcar ganador</span>}
                                                    <span className="ml-auto text-gray-600">Resultados via WayChamp PSS</span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-12 text-center">
                                        <div className="text-4xl mb-3">🥋</div>
                                        <p className="text-gray-500 text-sm mb-4">No hay pirámides creadas aún</p>
                                        {isOrganizer && (
                                            <button
                                                onClick={() => { setView('new_pyramid'); setSelectedAthletes([]); setStep(1); setGroups([]) }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm transition">
                                                Crear primera pirámide
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* New pyramid view */}
                        {view === 'new_pyramid' && (
                            <>
                                {step < 2 ? (
                                    /* ── Step 1: Sort mode + athlete selection + gender toggle ── */
                                    <div className="space-y-4 max-w-3xl">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => { setView('bracket'); setStep(1); setGroups([]) }} className="text-gray-500 hover:text-white transition text-sm">← Volver</button>
                                            <h2 className="text-lg font-semibold">Nueva pirámide — Fogueo {pyramidGroups.length + 1}</h2>
                                        </div>

                                        {/* Sort mode */}
                                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                                            <h3 className="text-sm font-medium text-gray-400 mb-4">Modo de sorteo</h3>
                                            <div className="grid grid-cols-3 gap-3">
                                                {SORT_MODES.map(mode => (
                                                    <button
                                                        key={mode.id}
                                                        onClick={() => setSortMode(mode.id)}
                                                        className={`p-3 rounded-xl border text-left transition ${sortMode === mode.id
                                                            ? 'border-blue-500 bg-blue-900/20'
                                                            : 'border-[#1e1e2e] hover:border-gray-500'}`}
                                                    >
                                                        <div className="text-sm font-medium text-white mb-0.5">{mode.label}</div>
                                                        <div className="text-xs text-gray-500">{mode.desc}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Preview */}
                                        {selectedAthletes.length >= 2 && previewConfig && (
                                            <div className="bg-[#0d1220] border border-blue-900/40 rounded-xl p-4">
                                                <div className="text-xs font-medium text-blue-400 mb-2">Vista previa del bracket</div>
                                                <div className="grid grid-cols-2 gap-3 text-xs">
                                                    <div>
                                                        <span className="text-gray-500">Atletas:</span>{' '}
                                                        <span className="text-white font-medium">{selectedAthletes.length}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Bracket:</span>{' '}
                                                        <span className="text-white font-medium">
                                                            {sortMode === 'gender_only'
                                                                ? `${allAthletes.filter(a => selectedAthletes.includes(a.id) && a.gender === 'M').length}M + ${allAthletes.filter(a => selectedAthletes.includes(a.id) && a.gender === 'F').length}F`
                                                                : `${previewConfig.bracketSize} slots`}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        {previewConfig.useOutbracket ? (
                                                            <>
                                                                <span className="text-gray-500">Outbracket:</span>{' '}
                                                                <span className="font-medium" style={{ color: '#F59E0B' }}>
                                                                    {previewConfig.preMatchCount} pre-match{previewConfig.preMatchCount !== 1 ? 'es' : ''}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="text-gray-500">BYEs:</span>{' '}
                                                                <span className="text-white font-medium">
                                                                    {sortMode === 'gender_only' ? 'Auto' : previewConfig.byeCount}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Matches:</span>{' '}
                                                        <span className="text-white font-medium">Match 1–{previewMatches}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Athlete selection */}
                                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-sm font-medium text-gray-400">
                                                    Atletas · {selectedAthletes.length} seleccionados de {allAthletes.length}
                                                </h3>
                                                <div className="flex gap-3">
                                                    <button onClick={() => setSelectedAthletes(allAthletes.map(a => a.id))} className="text-xs text-blue-400 hover:text-blue-300 transition">Todos</button>
                                                    <button onClick={() => setSelectedAthletes([])} className="text-xs text-gray-500 hover:text-white transition">Ninguno</button>
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                className="w-full bg-[#07070f] border border-[#1e1e2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition mb-3"
                                                placeholder="Buscar atleta..."
                                                value={athleteFilter}
                                                onChange={e => setAthleteFilter(e.target.value)}
                                            />
                                            {fogueo?.event_date <= today || isOrganizer ? (
                                                <div className="space-y-1 max-h-72 overflow-y-auto">
                                                    {filteredAthletes.map(a => {
                                                        const age = calculateAge(a.birth_date)
                                                        const level = (a.belt_levels as any)?.default_level ?? ''
                                                        const isSelected = selectedAthletes.includes(a.id)
                                                        return (
                                                            <div
                                                                key={a.id}
                                                                onClick={() => setSelectedAthletes(prev =>
                                                                    prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id]
                                                                )}
                                                                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition ${isSelected
                                                                    ? 'bg-blue-900/20 border border-blue-900/40'
                                                                    : 'hover:bg-[#13131f] border border-transparent'}`}
                                                            >
                                                                <input type="checkbox" checked={isSelected} onChange={() => { }} className="w-4 h-4 flex-shrink-0" />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-sm text-white">{a.first_name} {a.last_name}</div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {age}a · {a.training_weight ? `${a.training_weight}kg` : '—'} · {a.gender === 'M' ? 'M' : 'F'} · <span className="capitalize">{level}</span> · {a.club_name}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                    {filteredAthletes.length === 0 && (
                                                        <p className="text-gray-500 text-sm text-center py-4">Sin atletas que coincidan</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-4 text-center">
                                                    <p className="text-yellow-400 text-sm">El listado completo estará disponible el día del evento</p>
                                                    <p className="text-gray-500 text-xs mt-1">
                                                        {fogueo?.event_date
                                                            ? new Date(fogueo.event_date + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
                                                            : ''}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Invite clubs */}
                                        {isOrganizer && filteredClubs.length > 0 && (
                                            <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                                                <h3 className="text-sm font-medium text-gray-400 mb-3">Invitar clubes al evento</h3>
                                                <input
                                                    type="text"
                                                    className="w-full bg-[#07070f] border border-[#1e1e2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition mb-3"
                                                    placeholder="Buscar club por nombre o ciudad..."
                                                    value={clubFilter}
                                                    onChange={e => setClubFilter(e.target.value)}
                                                />
                                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                                    {filteredClubs.map(c => (
                                                        <div key={c.id} className="flex items-center gap-3 py-2 border-b border-[#13131f] last:border-0">
                                                            <div className="w-8 h-8 rounded-lg bg-[#13132a] flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                                                                {c.name[0]}{c.name.split(' ')[1]?.[0] ?? ''}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm text-white truncate">{c.name}</div>
                                                                <div className="text-xs text-gray-500">{c.city}</div>
                                                            </div>
                                                            <button
                                                                onClick={async () => {
                                                                    await supabase.from('fogueo_clubs').insert({ fogueo_id: fogueoId, club_id: c.id, status: 'pending' })
                                                                    toast.success(`Invitación enviada a ${c.name}`)
                                                                    const { data: fc } = await supabase.from('fogueo_clubs').select('*, clubs(id, name, city, logo_url)').eq('fogueo_id', fogueoId)
                                                                    if (fc) setJoinedClubs(fc)
                                                                }}
                                                                className="text-xs text-blue-400 hover:text-blue-300 transition px-2 py-1 rounded-lg hover:bg-blue-900/20 flex-shrink-0"
                                                            >
                                                                Invitar
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 1 — Gender toggle for grouped modes */}
                                        {!['gender_only', 'manual'].includes(sortMode) && selectedAthletes.length >= 2 && (
                                            <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                                                <h3 className="text-sm font-medium text-white mb-1">¿Separar masculino y femenino en brackets separados?</h3>
                                                <p className="text-xs text-gray-500 mb-4">Cada categoría se dividirá en dos brackets según el género</p>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => {
                                                            const sel = allAthletes.filter(a => selectedAthletes.includes(a.id))
                                                            setSeparateGender(true)
                                                            setGroups(groupAthletes(sel, sortMode, true))
                                                            setStep(2)
                                                        }}
                                                        className="flex-1 py-3 rounded-xl text-sm font-medium border border-blue-500 bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 transition"
                                                    >
                                                        Sí, separar
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const sel = allAthletes.filter(a => selectedAthletes.includes(a.id))
                                                            setSeparateGender(false)
                                                            setGroups(groupAthletes(sel, sortMode, false))
                                                            setStep(2)
                                                        }}
                                                        className="flex-1 py-3 rounded-xl text-sm font-medium border border-[#1e1e2e] text-gray-400 hover:border-gray-500 hover:text-white transition"
                                                    >
                                                        No, mezclar
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Bottom buttons */}
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => { setView('bracket'); setStep(1); setGroups([]) }}
                                                className="flex-1 bg-[#0d0d1a] border border-[#1e1e2e] text-white py-3 rounded-xl text-sm font-medium hover:bg-[#13131f] transition">
                                                Cancelar
                                            </button>
                                            {['gender_only', 'manual'].includes(sortMode) && (
                                                <button
                                                    onClick={generateBracket}
                                                    disabled={generating || selectedAthletes.length < 2}
                                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium transition disabled:opacity-40">
                                                    {generating ? 'Generando...' : `Generar Fogueo ${pyramidGroups.length + 1} →`}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* ── Step 2: Group preview ── */
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setStep(1)} className="text-gray-500 hover:text-white transition text-sm">← Atrás</button>
                                            <h2 className="text-lg font-semibold">Preview de grupos · Fogueo {pyramidGroups.length + 1}</h2>
                                            <span className="text-xs text-gray-500">{groups.length} grupo{groups.length !== 1 ? 's' : ''} · {selectedAthletes.length} atletas</span>
                                        </div>

                                        {/* Group cards */}
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            {groups.map(group => {
                                                const isDragOver = dragOverKey === group.key
                                                const headerBg = group.gender === 'M' ? '#0c1f3f' : group.gender === 'F' ? '#2d0f1c' : '#13131f'
                                                const headerBorder = group.gender === 'M' ? '#1e3a5f' : group.gender === 'F' ? '#5f1e30' : '#1e1e2e'
                                                const headerColor = group.gender === 'M' ? '#93c5fd' : group.gender === 'F' ? '#f9a8d4' : '#d1d5db'
                                                return (
                                                    <div key={group.key}
                                                        className="rounded-2xl border overflow-hidden transition-colors"
                                                        style={{
                                                            background: isDragOver ? (group.gender === 'M' ? '#0c2448' : group.gender === 'F' ? '#3a1224' : '#1a1a2e') : '#0d0d1a',
                                                            borderColor: isDragOver ? headerBorder : '#1e1e2e',
                                                        }}
                                                        onDragOver={e => { e.preventDefault(); setDragOverKey(group.key) }}
                                                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverKey(null) }}
                                                        onDrop={() => {
                                                            if (dragAthleteId && dragFromKey && dragFromKey !== group.key) {
                                                                moveAthleteToGroup(dragAthleteId, dragFromKey, group.key)
                                                            }
                                                            setDragAthleteId(null); setDragFromKey(null); setDragOverKey(null)
                                                        }}
                                                    >
                                                        {/* Card header */}
                                                        <div className="px-4 py-3 border-b" style={{ background: headerBg, borderColor: headerBorder }}>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-semibold" style={{ color: headerColor }}>{group.label}</span>
                                                                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: headerBorder, color: headerColor }}>
                                                                    {group.athletes.length}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs mt-1" style={{ color: '#6b7280' }}>
                                                                {group.athletes.length >= 2
                                                                    ? group.useOutbracket
                                                                        ? `bracket de ${group.bracketSize} + ${group.preMatchCount} pre-match${group.preMatchCount !== 1 ? 'es' : ''}`
                                                                        : group.byeCount > 0
                                                                            ? `bracket de ${group.bracketSize} · ${group.byeCount} BYE${group.byeCount !== 1 ? 's' : ''}`
                                                                            : `bracket de ${group.bracketSize} · perfecto`
                                                                    : <span style={{ color: '#ef4444' }}>Mínimo 2 atletas</span>
                                                                }
                                                            </div>
                                                        </div>

                                                        {/* Merge warning — amber block below header */}
                                                        {group.mergedMessage && (
                                                            <div className="px-3 py-2 border-b text-xs"
                                                                style={{ background: '#1a1000', borderColor: '#7a5c00', color: '#F59E0B' }}>
                                                                {group.mergedMessage}
                                                            </div>
                                                        )}

                                                        {/* Athlete chips */}
                                                        <div className="p-3 flex flex-wrap gap-1.5 min-h-[56px]">
                                                            {group.athletes.map(a => (
                                                                <div
                                                                    key={a.id}
                                                                    draggable
                                                                    onDragStart={() => { setDragAthleteId(a.id); setDragFromKey(group.key) }}
                                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-grab select-none border border-[#1e1e2e]"
                                                                    style={{ background: '#13131f' }}
                                                                >
                                                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                                        style={{ background: a.gender === 'M' ? '#3b82f6' : '#ec4899' }} />
                                                                    <span className="text-gray-200">{a.first_name} {a.last_name[0]}.</span>
                                                                    <span className="text-gray-500">{calculateAge(a.birth_date)}a</span>
                                                                    {a.training_weight && <span className="text-gray-500">{a.training_weight}kg</span>}
                                                                    <button
                                                                        onClick={e => { e.stopPropagation(); setMoveModal({ athleteId: a.id, fromKey: group.key }); setMoveTargetKey('') }}
                                                                        className="text-gray-600 hover:text-blue-400 transition ml-0.5 flex-shrink-0"
                                                                        title="Mover a otro grupo"
                                                                    >⇄</button>
                                                                </div>
                                                            ))}
                                                            {group.athletes.length === 0 && (
                                                                <p className="text-gray-600 text-xs py-2 w-full text-center">Sin atletas — arrastra aquí</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Summary + generate */}
                                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                                            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Resumen</h3>
                                            <div className="space-y-2 mb-4">
                                                {groups.map(g => (
                                                    <div key={g.key} className="flex items-center justify-between text-xs py-1 border-b border-[#13131f] last:border-0">
                                                        <span className="text-gray-300">{g.label}</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-gray-500">{g.athletes.length} atletas</span>
                                                            <span style={{ color: g.athletes.length < 2 ? '#ef4444' : g.useOutbracket ? '#F59E0B' : '#6b7280' }}>
                                                                {g.athletes.length < 2 ? 'insuficiente' : g.useOutbracket ? `outbracket ${g.bracketSize}` : `bracket ${g.bracketSize}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {groups.some(g => (g.mergedFrom?.length ?? 0) > 0) && (
                                                <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-3 mb-4">
                                                    Algunos grupos fueron fusionados automáticamente por tener menos de 2 atletas.
                                                </div>
                                            )}
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => setStep(1)}
                                                    className="flex-1 bg-[#0d0d1a] border border-[#1e1e2e] text-white py-3 rounded-xl text-sm font-medium hover:bg-[#13131f] transition">
                                                    ← Atrás
                                                </button>
                                                <button
                                                    onClick={handleGenerateAll}
                                                    disabled={generating || groups.filter(g => g.athletes.length >= 2).length === 0}
                                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium transition disabled:opacity-40">
                                                    {generating
                                                        ? 'Generando...'
                                                        : (() => {
                                                            const n = groups.filter(g => g.athletes.length >= 2).length
                                                            return `Generar ${n} bracket${n !== 1 ? 's' : ''} →`
                                                        })()
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Move modal */}
                                {moveModal && (() => {
                                    const athlete = allAthletes.find(a => a.id === moveModal.athleteId)
                                    return (
                                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
                                            onClick={() => setMoveModal(null)}>
                                            <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-6 w-80 mx-4"
                                                onClick={e => e.stopPropagation()}>
                                                <h3 className="text-sm font-medium text-white mb-1">Mover atleta</h3>
                                                <p className="text-xs text-gray-400 mb-4">
                                                    {athlete ? `${athlete.first_name} ${athlete.last_name}` : ''}
                                                </p>
                                                <select
                                                    className="w-full bg-[#07070f] border border-[#1e1e2e] rounded-xl px-3 py-2 text-sm text-white mb-4 focus:outline-none focus:border-blue-500"
                                                    value={moveTargetKey}
                                                    onChange={e => setMoveTargetKey(e.target.value)}
                                                >
                                                    <option value="" disabled>Seleccionar grupo destino</option>
                                                    {groups.filter(g => g.key !== moveModal.fromKey).map(g => (
                                                        <option key={g.key} value={g.key}>{g.label} ({g.athletes.length})</option>
                                                    ))}
                                                </select>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => setMoveModal(null)}
                                                        className="flex-1 py-2 rounded-xl text-sm border border-[#1e1e2e] text-gray-400 hover:text-white transition">
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (moveTargetKey) {
                                                                moveAthleteToGroup(moveModal.athleteId, moveModal.fromKey, moveTargetKey)
                                                                setMoveModal(null)
                                                                setMoveTargetKey('')
                                                            }
                                                        }}
                                                        disabled={!moveTargetKey}
                                                        className="flex-1 py-2 rounded-xl text-sm bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-40">
                                                        Confirmar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </>
                        )}

                    </div>
                </main>
            </div>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </>
    )
}
