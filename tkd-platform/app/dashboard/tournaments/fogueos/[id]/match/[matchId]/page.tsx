'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/Toast'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Round {
    round_number: number
    score_blue: number
    score_red: number
    gj_blue: number   // GJ applied to blue → red gets +1
    gj_red: number    // GJ applied to red  → blue gets +1
    winner: 'blue' | 'red' | 'draw' | null
    status: 'pending' | 'in_progress' | 'finished'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FEEDBACK_TAGS = [
    'Buena guardia', 'Mejorar pateo', 'Buen timing',
    'Faltó potencia', 'Excelente giro', 'Trabajar defensa',
    'Buena velocidad', 'Mejorar distancia', 'Buen contraataque',
]

// C2 — tabla de puntos corregida
const SCORING_ACTIONS: { label: string; points: number }[] = [
    { label: 'Pateo al peto', points: 2 },
    { label: 'Pateo al casco', points: 3 },
    { label: 'Puño directo', points: 1 },
    { label: 'Pateo giro / peto', points: 4 },
    { label: 'Pateo giro / casco', points: 6 },
]

const MAX_GJ = 5

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countWords(text: string): number {
    const trimmed = text.trim()
    return trimmed ? trimmed.split(/\s+/).length : 0
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// BUG-2 — parsear texto a segundos
//   "2:00" → 120  "1:30" → 90  "0:30" → 30
//   "2"    → 120  (sin ":" y < 10 ⇒ minutos)
//   "90"   →  90  (sin ":" y ≥ 10 ⇒ segundos)
function parseTime(str: string): number {
    const trimmed = str.trim()
    if (!trimmed) return 0
    if (trimmed.includes(':')) {
        const [mStr, sStr] = trimmed.split(':')
        const m = parseInt(mStr, 10) || 0
        const s = Math.min(parseInt(sStr, 10) || 0, 59)
        return m * 60 + s
    }
    const n = parseInt(trimmed, 10) || 0
    return n < 10 ? n * 60 : n
}

function shortName(a: Record<string, unknown> | null): string {
    if (!a) return '?'
    const fn = (a.first_name as string) ?? ''
    const ln = (a.last_name as string) ?? ''
    return `${fn}${ln ? ` ${ln[0]}.` : ''}`
}

function playAlertSound() {
    try {
        const AudioCtx = window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.5, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1)
        osc.start()
        osc.stop(ctx.currentTime + 1)
    } catch { /* silencioso */ }
}

// ─── FeedbackSection ─────────────────────────────────────────────────────────

function FeedbackSection({
    side, athleteName, selectedTags, freeText, onToggleTag, onTextChange,
}: {
    side: 'blue' | 'red'
    athleteName: string
    selectedTags: string[]
    freeText: string
    onToggleTag: (tag: string) => void
    onTextChange: (text: string) => void
}) {
    const wordCount = countWords(freeText)
    const isOver = wordCount > 10

    return (
        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-4 space-y-3">
            <h3 className={`text-sm font-semibold ${side === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
                Feedback para {athleteName}
            </h3>
            <div className="flex flex-wrap gap-2">
                {FEEDBACK_TAGS.map(tag => (
                    <button
                        key={tag}
                        onClick={() => onToggleTag(tag)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition ${selectedTags.includes(tag)
                            ? side === 'blue'
                                ? 'bg-blue-900/40 border-blue-500 text-blue-300'
                                : 'bg-red-900/40 border-red-500 text-red-300'
                            : 'bg-[#13131f] border-[#2e2e3e] text-gray-400 hover:border-gray-500'
                            }`}
                    >
                        {tag}
                    </button>
                ))}
            </div>
            <div>
                <textarea
                    rows={2}
                    maxLength={300}
                    placeholder="Observaciones adicionales (máx. 10 palabras)..."
                    value={freeText}
                    onChange={e => onTextChange(e.target.value)}
                    className={`w-full bg-[#07070f] border rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition resize-none ${isOver ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'}`}
                />
                <div className={`text-xs text-right mt-1 ${isOver ? 'text-red-400' : 'text-gray-600'}`}>
                    {wordCount} / 10 palabras
                </div>
            </div>
        </div>
    )
}

// ─── GJ Circles ──────────────────────────────────────────────────────────────

function GjCircles({
    count, onRemove, disabled,
}: {
    count: number
    onRemove: () => void
    disabled: boolean
}) {
    return (
        <div className="flex gap-1">
            {Array.from({ length: MAX_GJ }).map((_, i) => {
                const filled = i < count
                return (
                    <div
                        key={i}
                        title={filled ? 'Clic para borrar este GJ' : ''}
                        onClick={() => {
                            // C3: only filled circles trigger remove; disabled check for add, not remove
                            if (filled && !disabled) onRemove()
                        }}
                        className={`w-4 h-4 rounded-full border transition ${filled
                            ? 'bg-orange-500 border-orange-400 cursor-pointer hover:bg-orange-300'
                            : 'border-gray-600 opacity-30 cursor-default'
                            }`}
                    />
                )
            })}
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MatchPage() {
    const params = useParams()
    const fogueoId = params.id as string
    const matchId = params.matchId as string
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const { toasts, removeToast, toast } = useToast()

    // C1 — header state
    const [userEmail, setUserEmail] = useState('')
    const [fogueoName, setFogueoName] = useState('')
    const [pyramidLabel, setPyramidLabel] = useState('')
    const [pyramidId, setPyramidId] = useState('')
    const [match, setMatch] = useState<Record<string, unknown> | null>(null)
    const [blueAthlete, setBlueAthlete] = useState<Record<string, unknown> | null>(null)
    const [redAthlete, setRedAthlete] = useState<Record<string, unknown> | null>(null)

    // BUG-2 — el entrenador ingresa los tiempos antes de cada match
    const [roundDurationInput, setRoundDurationInput] = useState('2:00')
    const [restDurationInput, setRestDurationInput] = useState('0:30')
    const [roundDuration, setRoundDuration] = useState(120)
    const [restDuration, setRestDuration] = useState(30)
    const [configSaved, setConfigSaved] = useState(false)

    // rounds with GJ (C2/C3)
    const [rounds, setRounds] = useState<Round[]>([
        { round_number: 1, score_blue: 0, score_red: 0, gj_blue: 0, gj_red: 0, winner: null, status: 'pending' },
        { round_number: 2, score_blue: 0, score_red: 0, gj_blue: 0, gj_red: 0, winner: null, status: 'pending' },
        { round_number: 3, score_blue: 0, score_red: 0, gj_blue: 0, gj_red: 0, winner: null, status: 'pending' },
    ])
    const [currentRound, setCurrentRound] = useState(1)
    const [timerSeconds, setTimerSeconds] = useState(120)
    const [timerRunning, setTimerRunning] = useState(false)
    const [timeUp, setTimeUp] = useState(false)
    const [matchFinished, setMatchFinished] = useState(false)

    // rest between rounds
    const [inRest, setInRest] = useState(false)
    const [restSeconds, setRestSeconds] = useState(30)

    // undo stacks
    const [lastScoreBlue, setLastScoreBlue] = useState<number[]>([])
    const [lastScoreRed, setLastScoreRed] = useState<number[]>([])

    // feedback
    const [selectedTags, setSelectedTags] = useState<{ blue: string[]; red: string[] }>({ blue: [], red: [] })
    const [freeText, setFreeText] = useState<{ blue: string; red: string }>({ blue: '', red: '' })
    const [saving, setSaving] = useState(false)

    // BUG-4 — historial de eventos del combate
    const [history, setHistory] = useState<string[]>([])
    const addToHistory = (text: string) => {
        setHistory(prev => [text, ...prev].slice(0, 20))
    }

    // ── Load ──────────────────────────────────────────────────────────────────

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserEmail(user.email ?? '')

            // BUG-2 — NO leer round_duration_seconds; los tiempos se ingresan
            // antes de cada match desde la pantalla de configuración inicial.
            const { data: fog } = await supabase
                .from('fogueos')
                .select('id, name, scoring_type')
                .eq('id', fogueoId)
                .single()
            if (fog) {
                const fogData = fog as Record<string, unknown>
                setFogueoName(fogData.name as string)
            }

            // C1 — join with fogueo_pyramids to get group_label
            const { data: matchData } = await supabase
                .from('fogueo_matches')
                .select(`*, fogueo_pyramids(id, name, group_label, gender_group)`)
                .eq('id', matchId)
                .single()

            if (!matchData) {
                toast.error('Match no encontrado')
                return
            }
            const m = matchData as Record<string, unknown>
            setMatch(m)

            const pyramid = m.fogueo_pyramids as Record<string, unknown> | null
            setPyramidLabel(
                (pyramid?.group_label as string | null) ??
                (pyramid?.name as string | null) ??
                ''
            )
            setPyramidId(
                (pyramid?.id as string | undefined) ??
                (m.pyramid_id as string | undefined) ??
                ''
            )

            if (m.status === 'finished') toast.warning('Este match ya fue finalizado')

            const athleteIds = [m.athlete_blue_id, m.athlete_red_id].filter(Boolean) as string[]
            if (athleteIds.length > 0) {
                const { data: athleteRows } = await supabase
                    .from('athletes')
                    .select('id, first_name, last_name, training_weight, club_id')
                    .in('id', athleteIds)

                const clubIds = [...new Set((athleteRows ?? []).map(
                    (a: Record<string, unknown>) => a.club_id as string
                ))]
                const { data: clubRows } = await supabase
                    .from('clubs').select('id, name').in('id', clubIds)

                const clubMap: Record<string, string> = {}
                ;(clubRows ?? []).forEach((c: Record<string, unknown>) => {
                    clubMap[c.id as string] = c.name as string
                })
                ;(athleteRows ?? []).forEach((a: Record<string, unknown>) => {
                    const enriched = { ...a, club_name: clubMap[a.club_id as string] ?? '' }
                    if (a.id === m.athlete_blue_id) setBlueAthlete(enriched)
                    if (a.id === m.athlete_red_id) setRedAthlete(enriched)
                })
            }
        }
        load()
    }, [fogueoId, matchId, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Timer ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!timerRunning) return
        const id = setInterval(() => {
            setTimerSeconds(s => (s > 0 ? s - 1 : 0))
        }, 1000)
        return () => clearInterval(id)
    }, [timerRunning])

    useEffect(() => {
        if (timerSeconds === 0 && timerRunning) {
            setTimerRunning(false)
            setTimeUp(true)
            playAlertSound()
        }
    }, [timerSeconds]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Rest timer ────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!inRest) return
        const id = setInterval(() => {
            setRestSeconds(s => (s > 0 ? s - 1 : 0))
        }, 1000)
        return () => clearInterval(id)
    }, [inRest])

    useEffect(() => {
        if (restSeconds === 0 && inRest) setInRest(false)
    }, [restSeconds]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Config ────────────────────────────────────────────────────────────────

    // BUG-2 — parsea los dos campos, valida y arranca el combate
    const startCombat = () => {
        const rd = parseTime(roundDurationInput)
        const rest = parseTime(restDurationInput)
        if (!rd || !rest || Number.isNaN(rd) || Number.isNaN(rest)) {
            toast.error('Ingresa un tiempo válido')
            return
        }
        setRoundDuration(rd)
        setRestDuration(rest)
        setTimerSeconds(rd)
        setConfigSaved(true)
    }

    const resetTimer = () => {
        setTimerRunning(false)
        setTimerSeconds(roundDuration)
        setTimeUp(false)
    }

    // ── Scoring ───────────────────────────────────────────────────────────────

    // C5 — guard: only when timer is running
    const canScore = timerRunning && !inRest && !matchFinished &&
        (rounds.find(r => r.round_number === currentRound)?.status !== 'finished')

    const addScore = (side: 'blue' | 'red', points: number, label: string) => {
        if (!canScore) return
        setRounds(prev => prev.map(r =>
            r.round_number === currentRound
                ? {
                    ...r,
                    score_blue: side === 'blue' ? r.score_blue + points : r.score_blue,
                    score_red: side === 'red' ? r.score_red + points : r.score_red,
                }
                : r
        ))
        if (side === 'blue') setLastScoreBlue(prev => [...prev, points])
        else setLastScoreRed(prev => [...prev, points])
        addToHistory(`${side === 'blue' ? 'Azul' : 'Rojo'} — ${label} +${points}`)
    }

    // BUG-2 — al alcanzar 5 GJ se termina la ronda inmediatamente
    const addGj = (penalized: 'blue' | 'red') => {
        if (!canScore) return
        const curRound = rounds.find(r => r.round_number === currentRound)
        if (!curRound) return
        const currentGj = penalized === 'blue' ? curRound.gj_blue : curRound.gj_red
        if (currentGj >= MAX_GJ) return

        const newGj = currentGj + 1
        const updatedRound: Round = penalized === 'blue'
            ? { ...curRound, gj_blue: newGj, score_red: curRound.score_red + 1 }
            : { ...curRound, gj_red: newGj, score_blue: curRound.score_blue + 1 }

        addToHistory(
            `GJ — ${penalized === 'blue' ? 'Azul' : 'Rojo'} penalizado → ${penalized === 'blue' ? 'Rojo' : 'Azul'} +1`
        )

        if (newGj >= MAX_GJ) {
            const winner: Round['winner'] =
                updatedRound.score_blue > updatedRound.score_red ? 'blue' :
                    updatedRound.score_red > updatedRound.score_blue ? 'red' : 'draw'
            const finishedRound: Round = { ...updatedRound, winner, status: 'finished' }
            const newRounds = rounds.map(r => r.round_number === currentRound ? finishedRound : r)
            endRoundWithFinalState(newRounds)
        } else {
            setRounds(prev => prev.map(r => r.round_number === currentRound ? updatedRound : r))
        }
    }

    // C3 — remove GJ (correction, not tied to timer)
    const removeGj = (penalized: 'blue' | 'red') => {
        const curRound = rounds.find(r => r.round_number === currentRound)
        if (!curRound || curRound.status === 'finished' || matchFinished) return
        const currentGj = penalized === 'blue' ? curRound.gj_blue : curRound.gj_red
        if (currentGj <= 0) return

        setRounds(prev => prev.map(r => {
            if (r.round_number !== currentRound) return r
            return penalized === 'blue'
                ? { ...r, gj_blue: Math.max(0, r.gj_blue - 1), score_red: Math.max(0, r.score_red - 1) }
                : { ...r, gj_red: Math.max(0, r.gj_red - 1), score_blue: Math.max(0, r.score_blue - 1) }
        }))
        addToHistory(`↩ GJ ${penalized === 'blue' ? 'Azul' : 'Rojo'} borrado`)
    }

    const undoScore = (side: 'blue' | 'red') => {
        const curRound = rounds.find(r => r.round_number === currentRound)
        if (!curRound || curRound.status === 'finished' || matchFinished) return
        if (side === 'blue') {
            const last = lastScoreBlue[lastScoreBlue.length - 1]
            if (last === undefined) return
            setRounds(prev => prev.map(r =>
                r.round_number === currentRound
                    ? { ...r, score_blue: Math.max(0, r.score_blue - last) }
                    : r
            ))
            setLastScoreBlue(prev => prev.slice(0, -1))
        } else {
            const last = lastScoreRed[lastScoreRed.length - 1]
            if (last === undefined) return
            setRounds(prev => prev.map(r =>
                r.round_number === currentRound
                    ? { ...r, score_red: Math.max(0, r.score_red - last) }
                    : r
            ))
            setLastScoreRed(prev => prev.slice(0, -1))
        }
        addToHistory(`↩ Punto ${side === 'blue' ? 'azul' : 'rojo'} deshecho`)
    }

    // BUG-2 — cierre de ronda compartido entre finishRound y addGj (5 GJ)
    function endRoundWithFinalState(newRounds: Round[]) {
        setRounds(newRounds)
        setTimerRunning(false)

        const blueWins = newRounds.filter(r => r.winner === 'blue').length
        const redWins = newRounds.filter(r => r.winner === 'red').length

        if (blueWins >= 2 || redWins >= 2 || currentRound === 3) {
            setMatchFinished(true)
        } else {
            const next = currentRound + 1
            setCurrentRound(next)
            setTimerSeconds(roundDuration)
            setTimeUp(false)
            setLastScoreBlue([])
            setLastScoreRed([])
            setRestSeconds(restDuration)
            setInRest(true)
        }
    }

    const finishRound = () => {
        const curRound = rounds.find(r => r.round_number === currentRound)
        if (!curRound || curRound.status === 'finished') return

        const winner: Round['winner'] =
            curRound.score_blue > curRound.score_red ? 'blue' :
                curRound.score_red > curRound.score_blue ? 'red' : 'draw'

        const newRounds = rounds.map(r =>
            r.round_number === currentRound ? { ...r, winner, status: 'finished' as const } : r
        )
        endRoundWithFinalState(newRounds)
    }

    const getMatchWinner = (): 'blue' | 'red' => {
        const bw = rounds.filter(r => r.winner === 'blue').length
        const rw = rounds.filter(r => r.winner === 'red').length
        return bw >= rw ? 'blue' : 'red'
    }

    const toggleTag = (side: 'blue' | 'red', tag: string) => {
        setSelectedTags(prev => ({
            ...prev,
            [side]: prev[side].includes(tag)
                ? prev[side].filter(t => t !== tag)
                : [...prev[side], tag],
        }))
    }

    // ── Save ──────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!match) return
        if (countWords(freeText.blue) > 10 || countWords(freeText.red) > 10) {
            toast.error('El feedback no puede exceder 10 palabras')
            return
        }
        setSaving(true)
        try {
            const matchWinner = getMatchWinner()
            const winnerId = matchWinner === 'blue'
                ? match.athlete_blue_id as string
                : match.athlete_red_id as string
            const totalBlue = rounds.reduce((s, r) => s + r.score_blue, 0)
            const totalRed = rounds.reduce((s, r) => s + r.score_red, 0)

            await supabase.from('fogueo_matches').update({
                winner_id: winnerId,
                score_blue: totalBlue,
                score_red: totalRed,
                status: 'finished',
            }).eq('id', matchId)

            const finishedRounds = rounds.filter(r => r.status === 'finished')
            if (finishedRounds.length > 0) {
                await supabase.from('match_rounds').insert(
                    finishedRounds.map(r => ({
                        match_id: matchId,
                        round_number: r.round_number,
                        score_blue: r.score_blue,
                        score_red: r.score_red,
                        gj_blue: r.gj_blue,
                        gj_red: r.gj_red,
                        winner: r.winner,
                    }))
                )
            }

            const feedbackEntries: Record<string, unknown>[] = []
            if ((selectedTags.blue.length > 0 || freeText.blue.trim()) && match.athlete_blue_id) {
                feedbackEntries.push({
                    match_id: matchId, athlete_id: match.athlete_blue_id,
                    tags: selectedTags.blue, notes: freeText.blue.trim(),
                })
            }
            if ((selectedTags.red.length > 0 || freeText.red.trim()) && match.athlete_red_id) {
                feedbackEntries.push({
                    match_id: matchId, athlete_id: match.athlete_red_id,
                    tags: selectedTags.red, notes: freeText.red.trim(),
                })
            }
            if (feedbackEntries.length > 0) {
                await supabase.from('match_feedback').insert(feedbackEntries)
            }

            const nextBracketRound = (match.round_number as number) + 1
            const nextMatchNum = Math.ceil((match.match_number as number) / 2)
            const isBlueSlot = (match.match_number as number) % 2 === 1
            await supabase.from('fogueo_matches')
                .update(isBlueSlot ? { athlete_blue_id: winnerId } : { athlete_red_id: winnerId })
                .eq('pyramid_id', match.pyramid_id)
                .eq('round_number', nextBracketRound)
                .eq('match_number', nextMatchNum)

            const winnerName = matchWinner === 'blue' ? shortName(blueAthlete) : shortName(redAthlete)
            toast.success(`¡${winnerName} avanza!`)
            setTimeout(
                () => router.push(
                    `/dashboard/tournaments/fogueos/${fogueoId}/bracket?pyramid=${pyramidId}`
                ),
                1500
            )
        } catch (e) {
            console.error(e)
            toast.error('Error al guardar el match')
        } finally {
            setSaving(false)
        }
    }

    // ── Derived ───────────────────────────────────────────────────────────────

    const currentRoundData = rounds.find(r => r.round_number === currentRound) ?? rounds[0]
    const blueWins = rounds.filter(r => r.winner === 'blue').length
    const redWins = rounds.filter(r => r.winner === 'red').length
    const blueName = blueAthlete
        ? `${blueAthlete.first_name as string} ${blueAthlete.last_name as string}`
        : 'Por definir'
    const redName = redAthlete
        ? `${redAthlete.first_name as string} ${redAthlete.last_name as string}`
        : 'Por definir'

    // ── JSX ───────────────────────────────────────────────────────────────────

    return (
        <>
            <div className="flex min-h-screen bg-[#07070f] text-white">
                <Sidebar userEmail={userEmail} />
                <main className="flex-1 p-4 overflow-auto">
                    <div className="max-w-3xl mx-auto space-y-4">

                        {/* C1 — Header actualizado */}
                        <div>
                            <div className="text-xs text-gray-500 mb-1">
                                {[fogueoName, pyramidLabel, match ? `Match ${match.display_number as number}` : null]
                                    .filter(Boolean).join(' · ')}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-xl font-bold text-white">
                                    {blueAthlete && redAthlete
                                        ? `${shortName(blueAthlete)} vs ${shortName(redAthlete)}`
                                        : fogueoName || '…'}
                                </h1>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 flex-shrink-0">
                                    Convencional
                                </span>
                            </div>
                            <div className="mt-1">
                                <Link
                                    href={`/dashboard/tournaments/fogueos/${fogueoId}/bracket`}
                                    className="text-xs text-gray-600 hover:text-gray-400 transition"
                                >
                                    ← Volver al bracket
                                </Link>
                            </div>
                        </div>

                        {/* BUG-2 — pantalla inicial: tiempos editables + iniciar */}
                        {!configSaved && (
                            <div className="bg-[#0d0d1a] border border-amber-900/40 rounded-2xl p-5 space-y-4">
                                <h2 className="text-sm font-semibold text-amber-400">Configuración del combate</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center bg-[#07070f] border border-blue-900/40 rounded-xl p-3">
                                        <div className="text-xs text-blue-400 uppercase tracking-wider mb-1">Azul</div>
                                        <div className="text-sm font-semibold text-blue-300">{blueName}</div>
                                    </div>
                                    <div className="text-center bg-[#07070f] border border-red-900/40 rounded-xl p-3">
                                        <div className="text-xs text-red-400 uppercase tracking-wider mb-1">Rojo</div>
                                        <div className="text-sm font-semibold text-red-300">{redName}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Duración de ronda</label>
                                        <input
                                            type="text"
                                            value={roundDurationInput}
                                            onChange={e => setRoundDurationInput(e.target.value)}
                                            placeholder="ej: 2:00"
                                            className="w-full bg-[#07070f] border border-[#1e1e2e] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition"
                                        />
                                        <div className="text-xs text-gray-600 mt-1">
                                            formato M:SS (ej: 1:30 = 1 minuto 30 segundos)
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Descanso entre rondas</label>
                                        <input
                                            type="text"
                                            value={restDurationInput}
                                            onChange={e => setRestDurationInput(e.target.value)}
                                            placeholder="ej: 0:30"
                                            className="w-full bg-[#07070f] border border-[#1e1e2e] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition"
                                        />
                                        <div className="text-xs text-gray-600 mt-1">formato M:SS</div>
                                    </div>
                                </div>
                                <button
                                    onClick={startCombat}
                                    className="w-full py-2.5 bg-amber-700 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition"
                                >
                                    Iniciar combate →
                                </button>
                            </div>
                        )}

                        {/* Scoreboard */}
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                            <div className="flex items-center justify-between gap-4">
                                {/* Blue side */}
                                <div className="flex-1 text-left min-w-0">
                                    <div className="text-sm font-semibold text-blue-300 truncate">{blueName}</div>
                                    <div className="text-xs text-gray-500 truncate">
                                        {(blueAthlete?.club_name as string) ?? ''}
                                        {blueAthlete?.training_weight ? ` · ${blueAthlete.training_weight}kg` : ''}
                                    </div>
                                    <div className="flex gap-1 mt-2">
                                        {rounds.map(r => (
                                            <div key={r.round_number}
                                                className={`w-3 h-3 rounded-full transition-all ${r.winner === 'blue' ? 'bg-green-500'
                                                    : r.round_number === currentRound && r.status !== 'finished' ? 'bg-blue-500 animate-pulse'
                                                        : 'bg-gray-700'}`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Score */}
                                <div className="flex items-center gap-4 flex-shrink-0">
                                    <span className="text-5xl font-black tabular-nums" style={{ color: '#93c5fd' }}>
                                        {currentRoundData.score_blue}
                                    </span>
                                    <span className="text-2xl text-gray-600 font-light">—</span>
                                    <span className="text-5xl font-black tabular-nums" style={{ color: '#fca5a5' }}>
                                        {currentRoundData.score_red}
                                    </span>
                                </div>

                                {/* Red side */}
                                <div className="flex-1 text-right min-w-0">
                                    <div className="text-sm font-semibold text-red-300 truncate">{redName}</div>
                                    <div className="text-xs text-gray-500 truncate">
                                        {(redAthlete?.club_name as string) ?? ''}
                                        {redAthlete?.training_weight ? ` · ${redAthlete.training_weight}kg` : ''}
                                    </div>
                                    <div className="flex gap-1 mt-2 justify-end">
                                        {rounds.map(r => (
                                            <div key={r.round_number}
                                                className={`w-3 h-3 rounded-full transition-all ${r.winner === 'red' ? 'bg-green-500'
                                                    : r.round_number === currentRound && r.status !== 'finished' ? 'bg-red-500 animate-pulse'
                                                        : 'bg-gray-700'}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center gap-6 mt-3 pt-3 border-t border-[#1e1e2e]">
                                <span className="text-xs text-blue-400">{blueWins} ronda{blueWins !== 1 ? 's' : ''} ganada{blueWins !== 1 ? 's' : ''}</span>
                                <span className="text-xs text-gray-600">vs</span>
                                <span className="text-xs text-red-400">{redWins} ronda{redWins !== 1 ? 's' : ''} ganada{redWins !== 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        {/* Timer */}
                        <div className={`bg-[#0d0d1a] border rounded-2xl p-5 text-center transition ${timeUp ? 'border-red-500 animate-pulse' : 'border-[#1e1e2e]'}`}>
                            <div className={`text-6xl font-black tabular-nums mb-4 ${timeUp ? 'text-red-400' : 'text-white'}`}>
                                {formatTime(timerSeconds)}
                            </div>
                            <div className="flex justify-center gap-3 mb-4">
                                {!timerRunning ? (
                                    <button
                                        onClick={() => { setTimerRunning(true); setTimeUp(false) }}
                                        disabled={!configSaved || matchFinished || currentRoundData.status === 'finished' || inRest}
                                        className="px-5 py-2 bg-green-700 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40"
                                    >
                                        ▶ Iniciar
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setTimerRunning(false)}
                                        className="px-5 py-2 bg-yellow-700 hover:bg-yellow-600 text-white rounded-xl text-sm font-semibold transition"
                                    >
                                        ⏸ Pausar
                                    </button>
                                )}
                                <button
                                    onClick={resetTimer}
                                    disabled={!configSaved}
                                    className="px-5 py-2 bg-[#1e1e2e] hover:bg-[#2a2a3e] text-white rounded-xl text-sm transition disabled:opacity-40"
                                >
                                    ↺ Reiniciar
                                </button>
                            </div>

                            {/* Round selector */}
                            <div className="flex justify-center gap-2">
                                {rounds.map(r => (
                                    <button
                                        key={r.round_number}
                                        onClick={() => {
                                            if (r.round_number <= currentRound) {
                                                setCurrentRound(r.round_number)
                                                setLastScoreBlue([])
                                                setLastScoreRed([])
                                            }
                                        }}
                                        disabled={r.round_number > currentRound}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-30 ${currentRound === r.round_number
                                            ? 'bg-amber-700 text-white'
                                            : r.status === 'finished'
                                                ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                                                : 'bg-[#1e1e2e] text-gray-400'
                                            }`}
                                    >
                                        {r.status === 'finished' ? '✓ ' : ''}R{r.round_number}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* BUG-4 — Historial de eventos (siempre visible durante el combate) */}
                        {configSaved && (
                            <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-3">
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                    Historial
                                </div>
                                <div
                                    className="space-y-0.5 overflow-y-auto"
                                    style={{ maxHeight: '100px', fontSize: '11px' }}
                                >
                                    {history.length === 0 ? (
                                        <div className="text-gray-600 italic">Sin eventos aún</div>
                                    ) : (
                                        history.map((entry, idx) => {
                                            const isUndo = entry.startsWith('↩')
                                            const isGj = !isUndo && entry.startsWith('GJ')
                                            const isBlue = !isUndo && !isGj && entry.startsWith('Azul')
                                            const isRed = !isUndo && !isGj && entry.startsWith('Rojo')
                                            const color = isUndo
                                                ? 'text-gray-500'
                                                : isGj
                                                    ? 'text-amber-400'
                                                    : isBlue
                                                        ? 'text-blue-300'
                                                        : isRed
                                                            ? 'text-red-300'
                                                            : 'text-gray-400'
                                            return (
                                                <div key={idx} className={color}>
                                                    {entry}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Descanso entre rondas */}
                        {inRest && (
                            <div className="bg-[#0d0d1a] border border-amber-900/40 rounded-2xl p-5 text-center">
                                <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Descanso</div>
                                <div className="text-5xl font-black tabular-nums text-amber-400 mb-3">
                                    {formatTime(restSeconds)}
                                </div>
                                <div className="text-xs text-gray-500 mb-3">Próxima: Ronda {currentRound}</div>
                                <button
                                    onClick={() => setInRest(false)}
                                    className="px-4 py-1.5 bg-amber-900/30 text-amber-400 rounded-xl text-xs hover:bg-amber-900/50 transition"
                                >
                                    Saltar descanso →
                                </button>
                            </div>
                        )}

                        {/* C2/C3/C5 — Scoring buttons + GJ */}
                        {!matchFinished && (
                            <div className="grid grid-cols-2 gap-4">
                                {/* Blue column */}
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider px-1">
                                        🔵 {(blueAthlete?.first_name as string) ?? 'Azul'}
                                    </div>
                                    {SCORING_ACTIONS.map(action => (
                                        <button
                                            key={action.label}
                                            onClick={() => addScore('blue', action.points, action.label)}
                                            disabled={!canScore} // C5
                                            className="w-full flex items-center justify-between px-4 py-3 bg-blue-900/20 border border-blue-900/40 text-blue-300 rounded-xl hover:bg-blue-900/30 transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                                        >
                                            <span>{action.label}</span>
                                            <span className="text-blue-400 font-bold">+{action.points}</span>
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => undoScore('blue')}
                                        disabled={lastScoreBlue.length === 0 || currentRoundData.status === 'finished'}
                                        className="w-full py-2 bg-[#1e1e2e] text-gray-400 rounded-xl hover:bg-[#2a2a3e] text-xs transition disabled:opacity-30"
                                    >
                                        ↩ Deshacer{lastScoreBlue.length > 0 ? ` (-${lastScoreBlue[lastScoreBlue.length - 1]})` : ''}
                                    </button>

                                    {/* GJ para azul */}
                                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl px-3 py-2.5 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-orange-400 font-medium">GJ azul</span>
                                            <span className="text-xs text-gray-600">+1 a rojo</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => addGj('blue')}
                                                disabled={!canScore || currentRoundData.gj_blue >= MAX_GJ}
                                                className="text-xs px-2 py-1 bg-orange-900/30 border border-orange-900/50 text-orange-400 rounded-lg hover:bg-orange-900/50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                + GJ
                                            </button>
                                            <GjCircles
                                                count={currentRoundData.gj_blue}
                                                onRemove={() => removeGj('blue')}
                                                disabled={currentRoundData.status === 'finished' || matchFinished}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Red column */}
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-red-400 uppercase tracking-wider px-1">
                                        🔴 {(redAthlete?.first_name as string) ?? 'Rojo'}
                                    </div>
                                    {SCORING_ACTIONS.map(action => (
                                        <button
                                            key={action.label}
                                            onClick={() => addScore('red', action.points, action.label)}
                                            disabled={!canScore} // C5
                                            className="w-full flex items-center justify-between px-4 py-3 bg-red-900/20 border border-red-900/40 text-red-300 rounded-xl hover:bg-red-900/30 transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                                        >
                                            <span>{action.label}</span>
                                            <span className="text-red-400 font-bold">+{action.points}</span>
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => undoScore('red')}
                                        disabled={lastScoreRed.length === 0 || currentRoundData.status === 'finished'}
                                        className="w-full py-2 bg-[#1e1e2e] text-gray-400 rounded-xl hover:bg-[#2a2a3e] text-xs transition disabled:opacity-30"
                                    >
                                        ↩ Deshacer{lastScoreRed.length > 0 ? ` (-${lastScoreRed[lastScoreRed.length - 1]})` : ''}
                                    </button>

                                    {/* GJ para rojo */}
                                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl px-3 py-2.5 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-orange-400 font-medium">GJ rojo</span>
                                            <span className="text-xs text-gray-600">+1 a azul</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => addGj('red')}
                                                disabled={!canScore || currentRoundData.gj_red >= MAX_GJ}
                                                className="text-xs px-2 py-1 bg-orange-900/30 border border-orange-900/50 text-orange-400 rounded-lg hover:bg-orange-900/50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                + GJ
                                            </button>
                                            <GjCircles
                                                count={currentRoundData.gj_red}
                                                onRemove={() => removeGj('red')}
                                                disabled={currentRoundData.status === 'finished' || matchFinished}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Finalizar ronda */}
                        {!matchFinished && !inRest && (
                            <button
                                onClick={finishRound}
                                disabled={currentRoundData.status === 'finished'}
                                className="w-full py-3 bg-amber-700 hover:bg-amber-600 text-white rounded-xl font-semibold transition disabled:opacity-40"
                            >
                                Finalizar ronda {currentRound}
                            </button>
                        )}

                        {/* Match finalizado — feedback + guardar */}
                        {matchFinished && (
                            <div className="space-y-4">
                                <div className="bg-[#0d0d1a] border border-amber-900/40 rounded-2xl p-4 text-center">
                                    <div className="text-lg font-bold text-amber-400">¡Match finalizado!</div>
                                    <div className="text-sm text-gray-400 mt-1">
                                        Ganador:{' '}
                                        <span className={`font-semibold ${getMatchWinner() === 'blue' ? 'text-blue-300' : 'text-red-300'}`}>
                                            {getMatchWinner() === 'blue' ? blueName : redName}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                        {rounds.filter(r => r.status === 'finished')
                                            .map(r => `R${r.round_number}: ${r.score_blue}–${r.score_red}`)
                                            .join(' · ')}
                                    </div>
                                </div>

                                <FeedbackSection
                                    side="blue" athleteName={blueName}
                                    selectedTags={selectedTags.blue} freeText={freeText.blue}
                                    onToggleTag={tag => toggleTag('blue', tag)}
                                    onTextChange={text => setFreeText(prev => ({ ...prev, blue: text }))}
                                />
                                <FeedbackSection
                                    side="red" athleteName={redName}
                                    selectedTags={selectedTags.red} freeText={freeText.red}
                                    onToggleTag={tag => toggleTag('red', tag)}
                                    onTextChange={text => setFreeText(prev => ({ ...prev, red: text }))}
                                />

                                <button
                                    onClick={handleSave}
                                    disabled={saving || countWords(freeText.blue) > 10 || countWords(freeText.red) > 10}
                                    className="w-full py-3 bg-green-700 hover:bg-green-600 text-white rounded-xl font-semibold transition disabled:opacity-40"
                                >
                                    {saving ? 'Guardando...' : 'Guardar y declarar ganador ✓'}
                                </button>
                            </div>
                        )}

                    </div>
                </main>
            </div>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </>
    )
}
