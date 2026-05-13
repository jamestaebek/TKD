'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/Toast'

interface Round {
    round_number: number
    score_blue: number
    score_red: number
    winner: 'blue' | 'red' | 'draw' | null
    status: 'pending' | 'in_progress' | 'finished'
}

const FEEDBACK_TAGS = [
    'Buena guardia', 'Mejorar pateo', 'Buen timing',
    'Faltó potencia', 'Excelente giro', 'Trabajar defensa',
    'Buena velocidad', 'Mejorar distancia', 'Buen contraataque',
]

const SCORING_ACTIONS: { label: string; points: number }[] = [
    { label: 'Peto', points: 2 },
    { label: 'Casco', points: 3 },
    { label: 'Puño directo', points: 1 },
    { label: 'Pateo c/ giro', points: 5 },
]

function countWords(text: string): number {
    const trimmed = text.trim()
    return trimmed ? trimmed.split(/\s+/).length : 0
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function playAlertSound() {
    try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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
    } catch { /* silencioso en entornos sin AudioContext */ }
}

function FeedbackSection({
    side,
    athleteName,
    selectedTags,
    freeText,
    onToggleTag,
    onTextChange,
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
                    className={`w-full bg-[#07070f] border rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition resize-none ${isOver ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                        }`}
                />
                <div className={`text-xs text-right mt-1 ${isOver ? 'text-red-400' : 'text-gray-600'}`}>
                    {wordCount} / 10 palabras
                </div>
            </div>
        </div>
    )
}

export default function MatchPage() {
    const params = useParams()
    const fogueoId = params.id as string
    const matchId = params.matchId as string
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const { toasts, removeToast, toast } = useToast()

    const [userEmail, setUserEmail] = useState('')
    const [fogueoName, setFogueoName] = useState('')
    const [match, setMatch] = useState<Record<string, unknown> | null>(null)
    const [blueAthlete, setBlueAthlete] = useState<Record<string, unknown> | null>(null)
    const [redAthlete, setRedAthlete] = useState<Record<string, unknown> | null>(null)
    const [roundDuration, setRoundDuration] = useState(120)
    const [saving, setSaving] = useState(false)

    const [rounds, setRounds] = useState<Round[]>([
        { round_number: 1, score_blue: 0, score_red: 0, winner: null, status: 'pending' },
        { round_number: 2, score_blue: 0, score_red: 0, winner: null, status: 'pending' },
        { round_number: 3, score_blue: 0, score_red: 0, winner: null, status: 'pending' },
    ])
    const [currentRound, setCurrentRound] = useState(1)
    const [timerSeconds, setTimerSeconds] = useState(120)
    const [timerRunning, setTimerRunning] = useState(false)
    const [timeUp, setTimeUp] = useState(false)
    const [matchFinished, setMatchFinished] = useState(false)
    const [lastScoreBlue, setLastScoreBlue] = useState<number[]>([])
    const [lastScoreRed, setLastScoreRed] = useState<number[]>([])
    const [selectedTags, setSelectedTags] = useState<{ blue: string[]; red: string[] }>({ blue: [], red: [] })
    const [freeText, setFreeText] = useState<{ blue: string; red: string }>({ blue: '', red: '' })

    // ── Load ────────────────────────────────────────────────────────────────

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserEmail(user.email ?? '')

            const { data: fog } = await supabase
                .from('fogueos')
                .select('id, name, scoring_type, round_duration_seconds')
                .eq('id', fogueoId)
                .single()
            if (fog) {
                setFogueoName((fog as Record<string, unknown>).name as string)
                const duration = ((fog as Record<string, unknown>).round_duration_seconds as number) ?? 120
                setRoundDuration(duration)
                setTimerSeconds(duration)
            }

            const { data: m } = await supabase
                .from('fogueo_matches')
                .select('*')
                .eq('id', matchId)
                .single()
            if (!m) {
                toast.error('Match no encontrado')
                return
            }
            setMatch(m as Record<string, unknown>)
            if ((m as Record<string, unknown>).status === 'finished') {
                toast.warning('Este match ya fue finalizado')
            }

            const athleteIds = [
                (m as Record<string, unknown>).athlete_blue_id,
                (m as Record<string, unknown>).athlete_red_id,
            ].filter(Boolean) as string[]

            if (athleteIds.length > 0) {
                const { data: athleteRows } = await supabase
                    .from('athletes')
                    .select('id, first_name, last_name, training_weight, club_id')
                    .in('id', athleteIds)

                const clubIds = [...new Set((athleteRows ?? []).map((a: Record<string, unknown>) => a.club_id as string))]
                const { data: clubRows } = await supabase
                    .from('clubs')
                    .select('id, name')
                    .in('id', clubIds)

                const clubMap: Record<string, string> = {}
                ;(clubRows ?? []).forEach((c: Record<string, unknown>) => { clubMap[c.id as string] = c.name as string })

                ;(athleteRows ?? []).forEach((a: Record<string, unknown>) => {
                    const enriched = { ...a, club_name: clubMap[a.club_id as string] ?? '' }
                    if (a.id === (m as Record<string, unknown>).athlete_blue_id) setBlueAthlete(enriched)
                    if (a.id === (m as Record<string, unknown>).athlete_red_id) setRedAthlete(enriched)
                })
            }
        }
        load()
    }, [fogueoId, matchId, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Timer ────────────────────────────────────────────────────────────────

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

    const resetTimer = () => {
        setTimerRunning(false)
        setTimerSeconds(roundDuration)
        setTimeUp(false)
    }

    // ── Scoring ──────────────────────────────────────────────────────────────

    const addScore = (side: 'blue' | 'red', points: number) => {
        const curRound = rounds.find(r => r.round_number === currentRound)
        if (!curRound || curRound.status === 'finished' || matchFinished) return
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
        }
    }

    const getMatchWinner = (): 'blue' | 'red' => {
        const blueWins = rounds.filter(r => r.winner === 'blue').length
        const redWins = rounds.filter(r => r.winner === 'red').length
        return blueWins >= redWins ? 'blue' : 'red'
    }

    const toggleTag = (side: 'blue' | 'red', tag: string) => {
        setSelectedTags(prev => ({
            ...prev,
            [side]: prev[side].includes(tag)
                ? prev[side].filter(t => t !== tag)
                : [...prev[side], tag],
        }))
    }

    // ── Save ─────────────────────────────────────────────────────────────────

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
            const totalBlue = rounds.reduce((sum, r) => sum + r.score_blue, 0)
            const totalRed = rounds.reduce((sum, r) => sum + r.score_red, 0)

            // 1. Update fogueo_matches
            await supabase.from('fogueo_matches').update({
                winner_id: winnerId,
                score_blue: totalBlue,
                score_red: totalRed,
                status: 'finished',
            }).eq('id', matchId)

            // 2. Save round data
            const finishedRounds = rounds.filter(r => r.status === 'finished')
            if (finishedRounds.length > 0) {
                await supabase.from('match_rounds').insert(
                    finishedRounds.map(r => ({
                        match_id: matchId,
                        round_number: r.round_number,
                        score_blue: r.score_blue,
                        score_red: r.score_red,
                        winner: r.winner,
                    }))
                )
            }

            // 3. Save feedback
            const feedbackEntries: Record<string, unknown>[] = []
            if ((selectedTags.blue.length > 0 || freeText.blue.trim()) && match.athlete_blue_id) {
                feedbackEntries.push({
                    match_id: matchId,
                    athlete_id: match.athlete_blue_id,
                    tags: selectedTags.blue,
                    notes: freeText.blue.trim(),
                })
            }
            if ((selectedTags.red.length > 0 || freeText.red.trim()) && match.athlete_red_id) {
                feedbackEntries.push({
                    match_id: matchId,
                    athlete_id: match.athlete_red_id,
                    tags: selectedTags.red,
                    notes: freeText.red.trim(),
                })
            }
            if (feedbackEntries.length > 0) {
                await supabase.from('match_feedback').insert(feedbackEntries)
            }

            // 4. Advance winner in bracket
            const nextBracketRound = (match.round_number as number) + 1
            const nextMatchNum = Math.ceil((match.match_number as number) / 2)
            const isBlueSlot = (match.match_number as number) % 2 === 1
            await supabase.from('fogueo_matches')
                .update(isBlueSlot ? { athlete_blue_id: winnerId } : { athlete_red_id: winnerId })
                .eq('pyramid_id', match.pyramid_id)
                .eq('round_number', nextBracketRound)
                .eq('match_number', nextMatchNum)

            const winnerName = matchWinner === 'blue'
                ? (blueAthlete ? `${blueAthlete.first_name} ${blueAthlete.last_name}` : 'Azul')
                : (redAthlete ? `${redAthlete.first_name} ${redAthlete.last_name}` : 'Rojo')
            toast.success(`¡${winnerName} avanza!`)
            setTimeout(() => router.push(`/dashboard/tournaments/fogueos/${fogueoId}/bracket`), 1500)
        } catch (e) {
            console.error(e)
            toast.error('Error al guardar el match')
        } finally {
            setSaving(false)
        }
    }

    // ── Derived state ────────────────────────────────────────────────────────

    const currentRoundData = rounds.find(r => r.round_number === currentRound) ?? rounds[0]
    const blueWins = rounds.filter(r => r.winner === 'blue').length
    const redWins = rounds.filter(r => r.winner === 'red').length
    const blueName = blueAthlete
        ? `${blueAthlete.first_name} ${blueAthlete.last_name}`
        : 'Por definir'
    const redName = redAthlete
        ? `${redAthlete.first_name} ${redAthlete.last_name}`
        : 'Por definir'

    return (
        <>
            <div className="flex min-h-screen bg-[#07070f] text-white">
                <Sidebar userEmail={userEmail} />
                <main className="flex-1 p-4 overflow-auto">
                    <div className="max-w-3xl mx-auto space-y-4">

                        {/* Header */}
                        <div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1 flex-wrap">
                                <Link href="/dashboard/tournaments/fogueos" className="hover:text-white transition">Fogueos</Link>
                                <span>›</span>
                                <Link href={`/dashboard/tournaments/fogueos/${fogueoId}`} className="hover:text-white transition">{fogueoName || '…'}</Link>
                                <span>›</span>
                                <Link href={`/dashboard/tournaments/fogueos/${fogueoId}/bracket`} className="hover:text-white transition">Brackets</Link>
                                <span>›</span>
                                <span className="text-gray-300">Match {(match?.display_number as number) ?? '—'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-white">{fogueoName}</h1>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400">Convencional</span>
                            </div>
                        </div>

                        {/* Scoreboard */}
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                            <div className="flex items-center justify-between gap-4">

                                {/* Blue side */}
                                <div className="flex-1 text-left min-w-0">
                                    <div className="text-sm font-semibold text-blue-300 truncate">{blueName}</div>
                                    <div className="text-xs text-gray-500 truncate">
                                        {blueAthlete?.club_name as string ?? ''}
                                        {blueAthlete?.training_weight ? ` · ${blueAthlete.training_weight}kg` : ''}
                                    </div>
                                    <div className="flex gap-1 mt-2">
                                        {rounds.map(r => (
                                            <div
                                                key={r.round_number}
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
                                        {redAthlete?.club_name as string ?? ''}
                                        {redAthlete?.training_weight ? ` · ${redAthlete.training_weight}kg` : ''}
                                    </div>
                                    <div className="flex gap-1 mt-2 justify-end">
                                        {rounds.map(r => (
                                            <div
                                                key={r.round_number}
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
                                        disabled={matchFinished || currentRoundData.status === 'finished'}
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
                                    className="px-5 py-2 bg-[#1e1e2e] hover:bg-[#2a2a3e] text-white rounded-xl text-sm transition"
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

                        {/* Scoring buttons */}
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
                                            onClick={() => addScore('blue', action.points)}
                                            disabled={currentRoundData.status === 'finished'}
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
                                </div>

                                {/* Red column */}
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-red-400 uppercase tracking-wider px-1">
                                        🔴 {(redAthlete?.first_name as string) ?? 'Rojo'}
                                    </div>
                                    {SCORING_ACTIONS.map(action => (
                                        <button
                                            key={action.label}
                                            onClick={() => addScore('red', action.points)}
                                            disabled={currentRoundData.status === 'finished'}
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
                                </div>
                            </div>
                        )}

                        {/* Finalizar ronda */}
                        {!matchFinished && (
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
                                    side="blue"
                                    athleteName={blueName}
                                    selectedTags={selectedTags.blue}
                                    freeText={freeText.blue}
                                    onToggleTag={(tag) => toggleTag('blue', tag)}
                                    onTextChange={(text) => setFreeText(prev => ({ ...prev, blue: text }))}
                                />

                                <FeedbackSection
                                    side="red"
                                    athleteName={redName}
                                    selectedTags={selectedTags.red}
                                    freeText={freeText.red}
                                    onToggleTag={(tag) => toggleTag('red', tag)}
                                    onTextChange={(text) => setFreeText(prev => ({ ...prev, red: text }))}
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
