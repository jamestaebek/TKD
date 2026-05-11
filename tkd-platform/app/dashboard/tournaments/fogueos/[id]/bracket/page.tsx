'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/Toast'

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
}

interface PyramidGroup {
    groupId: string
    label: string
    sortMode: string
    pyramids: Pyramid[]
}

function calculateAge(birthDate: string): number {
    if (!birthDate) return 0
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
}

function getAgeGroup(age: number): string {
    if (age >= 9 && age <= 11) return 'Pre-cadete'
    if (age >= 12 && age <= 14) return 'Cadete'
    if (age >= 15 && age <= 17) return 'Junior'
    if (age >= 18) return 'Senior'
    return 'Infantil'
}

function getWeightCategory(weight: number): string {
    if (weight <= 33) return '-33kg'
    if (weight <= 37) return '-37kg'
    if (weight <= 41) return '-41kg'
    if (weight <= 45) return '-45kg'
    if (weight <= 48) return '-48kg'
    if (weight <= 51) return '-51kg'
    if (weight <= 55) return '-55kg'
    if (weight <= 59) return '-59kg'
    if (weight <= 63) return '-63kg'
    if (weight <= 68) return '-68kg'
    if (weight <= 73) return '-73kg'
    if (weight <= 78) return '-78kg'
    return '+78kg'
}

function nextPowerOf2(n: number): number {
    if (n <= 1) return 1
    let p = 1
    while (p < n) p *= 2
    return p
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

export default function BracketPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const supabase = createClient()
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

            // Cargar atletas del fogueo
            const { data: fa } = await supabase
                .from('fogueo_athletes')
                .select('*, athletes(*, belt_levels(name, default_level, sort_order)), clubs(name)')
                .eq('fogueo_id', fogueoId)
            if (fa) {
                const athletes = fa.map(f => ({
                    ...(f.athletes as any),
                    club_id: f.club_id,
                    club_name: (f.clubs as any)?.name ?? '',
                }))
                setAllAthletes(athletes)
            }

            // Cargar pirámides
            const { data: pyrs } = await supabase
                .from('fogueo_pyramids').select('*')
                .eq('fogueo_id', fogueoId).order('created_at')
            if (pyrs && pyrs.length > 0) {
                setPyramids(pyrs)
                const groups = buildPyramidGroups(pyrs)
                setPyramidGroups(groups)
                setActiveGroupId(groups[0]?.groupId ?? null)
                // Cargar matches de todos
                for (const p of pyrs) {
                    await loadMatchesForPyramid(p.id)
                }
            }

            // Cargar clubes disponibles e inscritos
            const { data: fc } = await supabase
                .from('fogueo_clubs')
                .select('*, clubs(id, name, city, logo_url)')
                .eq('fogueo_id', fogueoId)
            if (fc) setJoinedClubs(fc)

            const { data: allClubs } = await supabase
                .from('clubs').select('id, name, city').eq('status', 'active')
            if (allClubs) setAvailableClubs(allClubs)

            setLoading(false)
        }
        load()
    }, [fogueoId])

    const buildPyramidGroups = (pyrs: Pyramid[]): PyramidGroup[] => {
        const groups: PyramidGroup[] = []
        const processed = new Set<string>()

        pyrs.forEach((p, idx) => {
            if (processed.has(p.id)) return
            if (p.parent_group_id) {
                // Es parte de un grupo de género
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
                    label: `Fogueo ${groups.length + 1} · ${SORT_MODE_LABELS[p.sort_mode]}`,
                    sortMode: p.sort_mode,
                    pyramids: [p],
                })
            }
        })
        return groups
    }

    const loadMatchesForPyramid = async (pyramidId: string) => {
        const { data } = await supabase
            .from('fogueo_matches').select('*')
            .eq('pyramid_id', pyramidId)
            .order('global_match_number')
        if (data) {
            setMatchesByPyramid(prev => ({ ...prev, [pyramidId]: data }))
        }
    }

    const getAthleteById = (id: string | null) => {
        if (!id) return null
        return allAthletes.find(a => a.id === id) ?? null
    }

    const sortAthletes = (athletes: Athlete[], mode: string): Athlete[] => {
        const sorted = [...athletes]
        switch (mode) {
            case 'level_gender_weight':
                return sorted.sort((a, b) => {
                    const la = (a.belt_levels as any)?.sort_order ?? 0
                    const lb = (b.belt_levels as any)?.sort_order ?? 0
                    if (la !== lb) return la - lb
                    if (a.gender !== b.gender) return a.gender.localeCompare(b.gender)
                    return (a.training_weight ?? 0) - (b.training_weight ?? 0)
                })
            case 'level_gender':
                return sorted.sort((a, b) => {
                    const la = (a.belt_levels as any)?.sort_order ?? 0
                    const lb = (b.belt_levels as any)?.sort_order ?? 0
                    if (la !== lb) return la - lb
                    return a.gender.localeCompare(b.gender)
                })
            case 'gender_only':
                return sorted.sort((a, b) => a.gender.localeCompare(b.gender))
            case 'age_only':
                return sorted.sort((a, b) => calculateAge(a.birth_date) - calculateAge(b.birth_date))
            default:
                return sorted.sort(() => Math.random() - 0.5)
        }
    }

    const createSingleBracket = async (
        athletes: Athlete[],
        mode: string,
        pyramidName: string,
        genderGroup: string | null,
        parentGroupId: string | null,
    ): Promise<Pyramid | null> => {
        const subtitle = generateSubtitle(mode, athletes)
        const { data: pyramid, error } = await supabase
            .from('fogueo_pyramids').insert({
                fogueo_id: fogueoId,
                name: pyramidName,
                sort_mode: mode,
                status: 'pending',
                subtitle,
                gender_group: genderGroup,
                parent_group_id: parentGroupId,
            }).select().single()

        if (error || !pyramid) return null

        const total = athletes.length
        const bracketSize = nextPowerOf2(total)
        const rounds = Math.log2(bracketSize)

        // Distribuir atletas en slots con BYEs balanceados
        const slots: (Athlete | null)[] = new Array(bracketSize).fill(null)
        for (let i = 0; i < total; i++) slots[i] = athletes[i]

        // Interleave BYEs — distribuirlos al final del bracket
        const finalSlots: (Athlete | null)[] = []
        for (let i = 0; i < bracketSize; i += 2) {
            finalSlots.push(slots[i] ?? null)
            finalSlots.push(slots[i + 1] ?? null)
        }

        const matchesToCreate: any[] = []
        let matchCounter = 1

        // Ronda 1
        const round1: any[] = []
        for (let i = 0; i < bracketSize; i += 2) {
            const blue = finalSlots[i]
            const red = finalSlots[i + 1]
            const isBye = !blue || !red
            round1.push({
                pyramid_id: pyramid.id,
                round_number: 1,
                match_number: Math.floor(i / 2) + 1,
                global_match_number: matchCounter++,
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

        // Rounds siguientes
        let prevCount = bracketSize / 2
        for (let r = 2; r <= rounds; r++) {
            const count = prevCount / 2
            for (let m = 1; m <= count; m++) {
                matchesToCreate.push({
                    pyramid_id: pyramid.id,
                    round_number: r,
                    match_number: m,
                    global_match_number: matchCounter++,
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

        // Avanzar BYEs automáticamente
        for (const m of round1) {
            if (m.is_bye && m.winner_id) {
                await advanceWinnerDB(pyramid.id, 1, m.match_number, m.winner_id)
            }
        }

        return pyramid
    }

    const advanceWinnerDB = async (
        pyramidId: string,
        currentRound: number,
        currentMatchNum: number,
        winnerId: string
    ) => {
        const nextRound = currentRound + 1
        const nextMatchNum = Math.ceil(currentMatchNum / 2)
        const isBlueInNext = currentMatchNum % 2 !== 0

        const { data: nextMatch } = await supabase
            .from('fogueo_matches')
            .select('*')
            .eq('pyramid_id', pyramidId)
            .eq('round_number', nextRound)
            .eq('match_number', nextMatchNum)
            .single()

        if (!nextMatch) return

        const update = isBlueInNext
            ? { athlete_blue_id: winnerId }
            : { athlete_red_id: winnerId }

        await supabase.from('fogueo_matches').update(update).eq('id', nextMatch.id)

        // Si el otro lado ya tiene atleta verificar si es BYE
        const otherSide = isBlueInNext ? nextMatch.athlete_red_id : nextMatch.athlete_blue_id
        if (!otherSide) return

        // Ambos lados tienen atleta — si uno es BYE avanzar
        const updatedBlue = isBlueInNext ? winnerId : nextMatch.athlete_blue_id
        const updatedRed = isBlueInNext ? nextMatch.athlete_red_id : winnerId
        if (updatedBlue && updatedRed) {
            // Match completo — no es BYE, esperar resultado
        }
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
                // Crear DOS pirámides separadas
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
                    const p = await createSingleBracket(
                        males, sortMode,
                        `Fogueo ${fogueoNum} — Masculino`,
                        'M', groupId
                    )
                    if (p) newPyramids.push({ ...p, subtitle: generateSubtitle(sortMode, males) })
                } else if (males.length === 1) {
                    toast.warning(`Solo hay 1 atleta masculino — se necesitan al menos 2`)
                }

                if (females.length >= 2) {
                    const p = await createSingleBracket(
                        females, sortMode,
                        `Fogueo ${fogueoNum} — Femenino`,
                        'F', groupId
                    )
                    if (p) newPyramids.push({ ...p, subtitle: generateSubtitle(sortMode, females) })
                } else if (females.length === 1) {
                    toast.warning(`Solo hay 1 atleta femenina — se necesitan al menos 2`)
                }

                if (newPyramids.length > 0) {
                    setPyramids(prev => {
                        const updated = [...prev, ...newPyramids]
                        const groups = buildPyramidGroups(updated)
                        setPyramidGroups(groups)
                        setActiveGroupId(groupId)
                        return updated
                    })
                    for (const p of newPyramids) await loadMatchesForPyramid(p.id)
                    toast.success(`Fogueo ${fogueoNum} creado: ${males.length > 0 ? males.length + ' masculinos' : ''} ${females.length > 0 ? '· ' + females.length + ' femeninas' : ''}`)
                }
            } else {
                // Una sola pirámide
                const sorted = sortAthletes(athletes, sortMode)
                const p = await createSingleBracket(
                    sorted, sortMode,
                    `Fogueo ${fogueoNum}`,
                    null, null
                )
                if (p) {
                    const newP = { ...p, subtitle: generateSubtitle(sortMode, sorted) }
                    setPyramids(prev => {
                        const updated = [...prev, newP]
                        const groups = buildPyramidGroups(updated)
                        setPyramidGroups(groups)
                        setActiveGroupId(p.id)
                        return updated
                    })
                    await loadMatchesForPyramid(p.id)
                    const byeCount = nextPowerOf2(sorted.length) - sorted.length
                    toast.success(`Fogueo ${fogueoNum} generado · ${byeCount > 0 ? byeCount + ' BYE(s) · ' : ''}Match 1–${sorted.length - 1}`)
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

    const updateMatchWinner = async (match: Match, pyramidId: string, winnerId: string, isBlue: boolean) => {
        if (match.is_bye) return

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

        // Actualizar estado local
        setMatchesByPyramid(prev => ({
            ...prev,
            [pyramidId]: prev[pyramidId].map(m =>
                m.id === match.id
                    ? { ...m, winner_id: winnerId, status: 'finished', score_blue: isBlue ? 1 : 0, score_red: isBlue ? 0 : 1 }
                    : m
            )
        }))

        // Avanzar ganador
        await advanceWinnerDB(pyramidId, match.round_number, match.match_number, winnerId)
        await loadMatchesForPyramid(pyramidId)
        toast.success(`Match ${match.global_match_number} · Ganador registrado ✓`)
    }

    const joinFogueo = async () => {
        if (!clubId) return
        const already = joinedClubs.find(fc => fc.club_id === clubId)
        if (already) { toast.warning('Tu club ya está inscrito en este fogueo'); return }

        const { error } = await supabase.from('fogueo_clubs').insert({
            fogueo_id: fogueoId,
            club_id: clubId,
            status: 'confirmed',
        })

        if (!error) {
            toast.success('¡Te uniste al fogueo! El organizador fue notificado.')
            // Enviar email al organizador
            if (fogueo?.clubs?.email) {
                await fetch('/api/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'club_joined',
                        to: fogueo.clubs.email,
                        clubName: 'Tu club',
                        fogueoName: fogueo.name,
                    }),
                })
            }
            const { data: fc } = await supabase
                .from('fogueo_clubs')
                .select('*, clubs(id, name, city, logo_url)')
                .eq('fogueo_id', fogueoId)
            if (fc) setJoinedClubs(fc)
        } else {
            toast.error('Error al unirse al fogueo')
        }
    }

    const getRoundName = (round: number, totalRounds: number) => {
        if (round === totalRounds) return 'Final'
        if (round === totalRounds - 1) return 'Semifinal'
        if (round === totalRounds - 2) return 'Cuartos'
        if (round === totalRounds - 3) return 'Octavos'
        return `Ronda ${round}`
    }

    const activeGroup = pyramidGroups.find(g => g.groupId === activeGroupId)
    const isJoined = joinedClubs.some(fc => fc.club_id === clubId)

    const filteredAthletes = allAthletes.filter(a => {
        if (!athleteFilter) return true
        return `${a.first_name} ${a.last_name}`.toLowerCase().includes(athleteFilter.toLowerCase())
    })

    const filteredClubs = availableClubs.filter(c => {
        const joined = joinedClubs.some(fc => fc.club_id === c.id)
        if (joined) return false
        if (!clubFilter) return true
        return c.name.toLowerCase().includes(clubFilter.toLowerCase()) ||
            c.city.toLowerCase().includes(clubFilter.toLowerCase())
    })

    const previewSize = nextPowerOf2(selectedAthletes.length)
    const previewByes = previewSize - selectedAthletes.length
    const previewMatches = previewSize - 1

    const BracketView = ({ pyramid }: { pyramid: Pyramid }) => {
        const matches = matchesByPyramid[pyramid.id] ?? []
        const rounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b)
        const totalRounds = rounds.length
        const genderLabel = pyramid.gender_group === 'M' ? 'Masculino' : pyramid.gender_group === 'F' ? 'Femenino' : null

        return (
            <div className={`mb-6 ${pyramid.gender_group ? 'border border-[#1e1e2e] rounded-2xl p-4' : ''}`}>
                {genderLabel && (
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium mb-4 ${pyramid.gender_group === 'M'
                        ? 'bg-blue-900/30 text-blue-400 border border-blue-900/40'
                        : 'bg-pink-900/30 text-pink-400 border border-pink-900/40'
                        }`}>
                        {genderLabel} · {matches.filter(m => !m.is_bye && m.round_number === 1).length + matches.filter(m => m.is_bye).length} atletas · Match {matches[0]?.global_match_number}–{matches[matches.length - 1]?.global_match_number}
                    </div>
                )}

                {matches.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">Sin matches generados</div>
                ) : (
                    <div className="flex gap-3 overflow-x-auto pb-4">
                        {rounds.map(round => (
                            <div key={round} className="flex-shrink-0" style={{ minWidth: '185px' }}>
                                <div className="flex items-center justify-between text-xs text-gray-500 uppercase tracking-wider mb-3 px-1">
                                    <span>{getRoundName(round, totalRounds)}</span>
                                    <span className="text-gray-600">{matches.filter(m => m.round_number === round && !m.is_bye).length}c</span>
                                </div>
                                <div className="space-y-2">
                                    {matches.filter(m => m.round_number === round).map(match => {
                                        const blue = getAthleteById(match.athlete_blue_id)
                                        const red = getAthleteById(match.athlete_red_id)
                                        const blueWon = match.winner_id === match.athlete_blue_id
                                        const redWon = match.winner_id === match.athlete_red_id

                                        if (match.is_bye) {
                                            const byeAthlete = blue ?? red
                                            return (
                                                <div key={match.id} className="bg-[#0d0d1a] border border-dashed border-[#2e2e3e] rounded-xl p-2.5 opacity-60">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-medium text-gray-600">BYE</span>
                                                        <span className="text-xs text-gray-700">M{match.global_match_number}</span>
                                                    </div>
                                                    {byeAthlete && (
                                                        <div className="text-xs text-gray-400">{byeAthlete.first_name} {byeAthlete.last_name[0]}. avanza →</div>
                                                    )}
                                                </div>
                                            )
                                        }

                                        return (
                                            <div key={match.id} className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl overflow-hidden">
                                                <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#13131f] border-b border-[#1e1e2e]">
                                                    <span className="text-xs font-bold text-yellow-400">Match {match.global_match_number}</span>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${match.status === 'finished' ? 'bg-green-900/40 text-green-400' : 'text-gray-600'
                                                        }`}>
                                                        {match.status === 'finished' ? '✓ Finalizado' : 'Pendiente'}
                                                    </span>
                                                </div>
                                                <div
                                                    className={`flex items-center gap-2 px-3 py-2 border-b border-[#1e1e2e] transition ${isOrganizer && blue && match.status !== 'finished' ? 'cursor-pointer hover:bg-blue-900/30' : ''
                                                        } ${blueWon ? 'bg-blue-900/40' : 'bg-[#0d1220]'}`}
                                                    onClick={() => isOrganizer && blue && match.status !== 'finished' && updateMatchWinner(match, pyramid.id, blue.id, true)}
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-xs truncate ${blueWon ? 'text-blue-300 font-medium' : 'text-gray-300'}`}>
                                                            {blue ? `${blue.first_name} ${blue.last_name[0]}.` : 'Por definir'}
                                                        </div>
                                                        {blue && <div className="text-xs text-gray-600 truncate">{blue.club_name} · {blue.training_weight ? `${blue.training_weight}kg` : '—'}</div>}
                                                    </div>
                                                    {blueWon && <span className="text-blue-400 text-xs">✓</span>}
                                                </div>
                                                <div
                                                    className={`flex items-center gap-2 px-3 py-2 transition ${isOrganizer && red && match.status !== 'finished' ? 'cursor-pointer hover:bg-red-900/30' : ''
                                                        } ${redWon ? 'bg-red-900/40' : 'bg-[#1a0d0d]'}`}
                                                    onClick={() => isOrganizer && red && match.status !== 'finished' && updateMatchWinner(match, pyramid.id, red.id, false)}
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-xs truncate ${redWon ? 'text-red-300 font-medium' : 'text-gray-300'}`}>
                                                            {red ? `${red.first_name} ${red.last_name[0]}.` : 'Por definir'}
                                                        </div>
                                                        {red && <div className="text-xs text-gray-600 truncate">{red.club_name} · {red.training_weight ? `${red.training_weight}kg` : '—'}</div>}
                                                    </div>
                                                    {redWon && <span className="text-red-400 text-xs">✓</span>}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}

                        {matches.some(m => m.winner_id && m.round_number === totalRounds && !m.is_bye) && (
                            <div className="flex-shrink-0" style={{ minWidth: '130px' }}>
                                <div className="text-xs text-yellow-400 uppercase tracking-wider mb-3 px-1">
                                    {pyramid.gender_group === 'M' ? 'Campeón M' : pyramid.gender_group === 'F' ? 'Campeona F' : 'Campeón'}
                                </div>
                                <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-4 text-center">
                                    {(() => {
                                        const finalMatch = matches.find(m => m.round_number === totalRounds && !m.is_bye)
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
                )}
            </div>
        )
    }

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
                                <h1 className="text-xl font-bold"><span className="text-blue-500">TKD</span> — Brackets · {fogueo?.name}</h1>
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
                                {!isOrganizer && isJoined && (
                                    <span className="text-xs px-3 py-2 rounded-xl bg-green-900/40 text-green-400 border border-green-900/40">✓ Inscrito</span>
                                )}
                                {isOrganizer && (
                                    <button onClick={() => { setView('new_pyramid'); setSelectedAthletes([]) }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                                        + Nueva pirámide
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Vista bracket */}
                        {view === 'bracket' && (
                            <>
                                {pyramidGroups.length > 0 ? (
                                    <>
                                        {/* Tabs de grupos */}
                                        <div className="flex gap-2 flex-wrap mb-5">
                                            {pyramidGroups.map((group, i) => (
                                                <button
                                                    key={group.groupId}
                                                    onClick={() => setActiveGroupId(group.groupId)}
                                                    className={`text-left px-3 py-2 rounded-xl border transition ${activeGroupId === group.groupId
                                                        ? 'bg-blue-900/40 border-blue-500/50 text-blue-400'
                                                        : 'bg-[#0d0d1a] border-[#1e1e2e] text-gray-400 hover:border-gray-500'
                                                        }`}
                                                >
                                                    <div className="text-xs font-medium">Fogueo {i + 1} · {SORT_MODE_LABELS[group.sortMode]}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5 max-w-48 truncate">
                                                        {group.pyramids[0]?.subtitle ?? ''}
                                                    </div>
                                                </button>
                                            ))}
                                            {isOrganizer && (
                                                <button
                                                    onClick={() => { setView('new_pyramid'); setSelectedAthletes([]) }}
                                                    className="px-3 py-2 rounded-xl border border-dashed border-[#2e2e3e] text-gray-600 hover:border-blue-500/50 hover:text-blue-400 transition text-xs"
                                                >
                                                    + Nueva
                                                </button>
                                            )}
                                        </div>

                                        {/* Contenido del grupo activo */}
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
                                                        {activeGroup.pyramids.reduce((sum, p) => sum + (matchesByPyramid[p.id]?.filter(m => !m.is_bye).length ?? 0), 0)} combates
                                                    </span>
                                                </div>

                                                {activeGroup.pyramids.map(p => (
                                                    <BracketView key={p.id} pyramid={p} />
                                                ))}

                                                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap pt-3 border-t border-[#1e1e2e]">
                                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Azul (arriba)</div>
                                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div>Rojo (abajo)</div>
                                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-500"></div>Número de match</div>
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
                                            <button onClick={() => { setView('new_pyramid'); setSelectedAthletes([]) }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm transition">
                                                Crear primera pirámide
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Vista nueva pirámide */}
                        {view === 'new_pyramid' && (
                            <div className="space-y-4 max-w-3xl">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setView('bracket')} className="text-gray-500 hover:text-white transition text-sm">← Volver</button>
                                    <h2 className="text-lg font-semibold">Nueva pirámide — Fogueo {pyramidGroups.length + 1}</h2>
                                </div>

                                {/* Modo de sorteo */}
                                <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                                    <h3 className="text-sm font-medium text-gray-400 mb-4">Modo de sorteo</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {SORT_MODES.map(mode => (
                                            <button
                                                key={mode.id}
                                                onClick={() => setSortMode(mode.id)}
                                                className={`p-3 rounded-xl border text-left transition ${sortMode === mode.id ? 'border-blue-500 bg-blue-900/20' : 'border-[#1e1e2e] hover:border-gray-500'
                                                    }`}
                                            >
                                                <div className="text-sm font-medium text-white mb-0.5">{mode.label}</div>
                                                <div className="text-xs text-gray-500">{mode.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Preview */}
                                {selectedAthletes.length >= 2 && (
                                    <div className="bg-[#0d1220] border border-blue-900/40 rounded-xl p-4">
                                        <div className="text-xs font-medium text-blue-400 mb-2">Vista previa del bracket</div>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div><span className="text-gray-500">Atletas:</span> <span className="text-white font-medium">{selectedAthletes.length}</span></div>
                                            <div>
                                                <span className="text-gray-500">Bracket:</span>{' '}
                                                <span className="text-white font-medium">
                                                    {sortMode === 'gender_only'
                                                        ? `${allAthletes.filter(a => selectedAthletes.includes(a.id) && a.gender === 'M').length}M + ${allAthletes.filter(a => selectedAthletes.includes(a.id) && a.gender === 'F').length}F`
                                                        : `${previewSize} slots`}
                                                </span>
                                            </div>
                                            <div><span className="text-gray-500">BYEs:</span> <span className="text-white font-medium">{sortMode === 'gender_only' ? 'Auto' : previewByes}</span></div>
                                            <div><span className="text-gray-500">Matches:</span> <span className="text-white font-medium">Match 1–{previewMatches}</span></div>
                                        </div>
                                    </div>
                                )}

                                {/* Selección de atletas */}
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

                                    {fogueo?.event_date <= today ? (
                                        <div className="space-y-1 max-h-72 overflow-y-auto">
                                            {filteredAthletes.map(a => {
                                                const age = calculateAge(a.birth_date)
                                                const level = (a.belt_levels as any)?.default_level ?? ''
                                                const selected = selectedAthletes.includes(a.id)
                                                return (
                                                    <div
                                                        key={a.id}
                                                        onClick={() => setSelectedAthletes(prev => prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id])}
                                                        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition ${selected ? 'bg-blue-900/20 border border-blue-900/40' : 'hover:bg-[#13131f] border border-transparent'}`}
                                                    >
                                                        <input type="checkbox" checked={selected} onChange={() => { }} className="w-4 h-4 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm text-white">{a.first_name} {a.last_name}</div>
                                                            <div className="text-xs text-gray-500">
                                                                {age}a · {a.training_weight ? `${a.training_weight}kg` : '—'} · {a.gender === 'M' ? 'M' : 'F'} · <span className="capitalize">{level}</span> · {a.club_name}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-4 text-center">
                                            <p className="text-yellow-400 text-sm">El listado completo estará disponible el día del evento</p>
                                            <p className="text-gray-500 text-xs mt-1">
                                                {new Date(fogueo?.event_date + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Invitar clubes */}
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

                                <div className="flex gap-3">
                                    <button onClick={() => setView('bracket')} className="flex-1 bg-[#0d0d1a] border border-[#1e1e2e] text-white py-3 rounded-xl text-sm font-medium hover:bg-[#13131f] transition">
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={generateBracket}
                                        disabled={generating || selectedAthletes.length < 2}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium transition disabled:opacity-40"
                                    >
                                        {generating ? 'Generando...' : `Generar Fogueo ${pyramidGroups.length + 1} →`}
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </main>
            </div>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </>
    )
}

