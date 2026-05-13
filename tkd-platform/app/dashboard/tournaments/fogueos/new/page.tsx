'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/Toast'
import { calculateAge } from '@/lib/utils/age'

interface Athlete {
    id: string
    first_name: string
    last_name: string
    birth_date: string
    gender: string
    training_weight: number | null
    status: string
    belt_levels: { name: string; default_level: string } | null
}

interface Club {
    id: string
    name: string
    city: string
    email: string
    coach_name: string
    coach_email: string
}


export default function NewFogueoPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const { toasts, removeToast, toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [userEmail, setUserEmail] = useState('')
    const [clubId, setClubId] = useState('')
    const [myClub, setMyClub] = useState<Club | null>(null)
    const [athletes, setAthletes] = useState<Athlete[]>([])
    const [selectedAthletes, setSelectedAthletes] = useState<string[]>([])
    const [allClubs, setAllClubs] = useState<Club[]>([])
    const [invitedClubs, setInvitedClubs] = useState<string[]>([])
    const [clubSearch, setClubSearch] = useState('')
    const [athleteSearch, setAthleteSearch] = useState('')
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [step, setStep] = useState(0)
    const [scoringType, setScoringType] = useState<'conventional' | 'electronic'>('conventional')
    const [roundDurationSeconds, setRoundDurationSeconds] = useState<number>(120)

    const [form, setForm] = useState({
        name: '',
        event_date: '',
        start_time: '',
        location: '',
        visibility: 'public',
    })

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserEmail(user.email ?? '')

            const { data: club } = await supabase
                .from('clubs').select('*').eq('user_id', user.id).single()
            if (!club) return
            setClubId(club.id)
            setMyClub(club)

            const { data: athleteData } = await supabase
                .from('athletes')
                .select('*, belt_levels(name, default_level)')
                .eq('club_id', club.id)
                .eq('status', 'active')
                .order('first_name')
            if (athleteData) setAthletes(athleteData)

            const { data: clubData } = await supabase
                .from('clubs')
                .select('id, name, city, email, coach_name, coach_email')
                .eq('status', 'active')
                .neq('id', club.id)
                .order('name')
            if (clubData) setAllClubs(clubData)
        }
        load()
    }, [])

    const update = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
        setErrors(prev => ({ ...prev, [field]: '' }))
    }

    const toggleAthlete = (id: string) => {
        setSelectedAthletes(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        )
    }

    const toggleInvite = (clubId: string) => {
        setInvitedClubs(prev =>
            prev.includes(clubId) ? prev.filter(c => c !== clubId) : [...prev, clubId]
        )
    }

    const validate = () => {
        const e: Record<string, string> = {}
        if (!form.name.trim()) e.name = 'El nombre es obligatorio'
        if (!form.event_date) e.event_date = 'La fecha es obligatoria'
        if (!form.start_time) e.start_time = 'La hora es obligatoria'
        if (!form.location.trim()) e.location = 'El lugar es obligatorio'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleSubmit = async () => {
        if (!validate()) return
        setLoading(true)
        try {
            // Crear fogueo
            const { data: fogueo, error } = await supabase
                .from('fogueos')
                .insert({
                    club_id: clubId,
                    name: form.name,
                    event_date: form.event_date,
                    start_time: form.start_time,
                    location: form.location,
                    visibility: form.visibility,
                    status: 'open',
                    scoring_type: scoringType,
                    round_duration_seconds: roundDurationSeconds,
                })
                .select().single()

            if (error || !fogueo) {
                toast.error('Error al crear el fogueo. Intenta de nuevo.')
                setLoading(false)
                return
            }

            // Agregar club organizador
            await supabase.from('fogueo_clubs').insert({
                fogueo_id: fogueo.id,
                club_id: clubId,
                status: 'confirmed',
            })

            // Agregar atletas seleccionados
            if (selectedAthletes.length > 0) {
                await supabase.from('fogueo_athletes').insert(
                    selectedAthletes.map(aid => ({
                        fogueo_id: fogueo.id,
                        athlete_id: aid,
                        club_id: clubId,
                    }))
                )
            }

            // Invitar clubes seleccionados
            if (invitedClubs.length > 0) {
                await supabase.from('fogueo_clubs').insert(
                    invitedClubs.map(cid => ({
                        fogueo_id: fogueo.id,
                        club_id: cid,
                        status: 'pending',
                    }))
                )

                // Enviar emails de invitación
                const invitedClubData = allClubs.filter(c => invitedClubs.includes(c.id))
                for (const club of invitedClubData) {
                    const emailTarget = club.coach_email || club.email
                    if (!emailTarget) continue
                    await fetch('/api/email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'club_invited',
                            to: emailTarget,
                            coachName: club.coach_name,
                            clubName: myClub?.name ?? '',
                            fogueoName: form.name,
                            fogueoDate: new Date(form.event_date).toLocaleDateString('es-CO', {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                            }),
                            location: form.location,
                        }),
                    })
                }
            }

            toast.success('Fogueo creado exitosamente')
            setTimeout(() => router.push(`/dashboard/tournaments/fogueos/${fogueo.id}`), 1000)
        } catch {
            toast.error('Error de conexión. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    const filteredClubs = allClubs.filter(c =>
        !clubSearch ||
        c.name.toLowerCase().includes(clubSearch.toLowerCase()) ||
        c.city.toLowerCase().includes(clubSearch.toLowerCase())
    )

    const filteredAthletes = athletes.filter(a =>
        !athleteSearch ||
        `${a.first_name} ${a.last_name}`.toLowerCase().includes(athleteSearch.toLowerCase())
    )

    return (
        <>
            <div className="flex min-h-screen bg-[#07070f] text-white">
                <Sidebar userEmail={userEmail} />
                <main className="flex-1 p-6">
                    <div className="max-w-2xl mx-auto">

                        <div className="flex items-center gap-3 mb-6">
                            <Link href="/dashboard/tournaments/fogueos" className="text-gray-500 hover:text-white transition text-sm">
                                ← Volver
                            </Link>
                            <h1 className="text-2xl font-bold">
                                <span className="text-blue-500">TKD</span> — Crear fogueo
                            </h1>
                        </div>

                        {/* Steps */}
                        <div className="flex gap-2 mb-6">
                            {['Tipo', 'Evento', 'Clubes', 'Atletas'].map((s, i) => (
                                <div
                                    key={i}
                                    className={`flex-1 py-2 text-center text-xs rounded-lg font-medium transition cursor-pointer ${step === i ? 'bg-blue-600 text-white'
                                        : step > i ? 'bg-green-800 text-white'
                                            : 'bg-[#0d0d1a] text-gray-500 border border-[#1e1e2e]'
                                        }`}
                                    onClick={() => step > i && setStep(i)}
                                >
                                    {step > i ? '✓ ' : ''}{s}
                                </div>
                            ))}
                        </div>

                        <div className="space-y-5">

                            {/* Step 0 — Tipo de fogueo */}
                            {step === 0 && (
                                <div className="space-y-4">
                                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5 space-y-4">
                                        <h2 className="text-sm font-medium text-gray-400">Sistema de puntuación</h2>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => setScoringType('conventional')}
                                                className={`p-4 rounded-xl border text-left transition ${scoringType === 'conventional' ? 'border-amber-500 bg-amber-900/20' : 'border-[#1e1e2e] hover:border-gray-500'}`}
                                            >
                                                <div className="text-3xl mb-2">🥋</div>
                                                <div className="text-sm font-semibold text-white mb-1">Convencional</div>
                                                <div className="text-xs text-gray-500">Puntos registrados manualmente</div>
                                            </button>
                                            <div className="p-4 rounded-xl border border-[#1e1e2e] opacity-50 cursor-not-allowed relative">
                                                <div className="absolute top-2 right-2 text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full">Próximamente</div>
                                                <div className="text-3xl mb-2">⚡</div>
                                                <div className="text-sm font-semibold text-white mb-1">Electrónico WayChamp</div>
                                                <div className="text-xs text-gray-500">Sistema electrónico integrado</div>
                                            </div>
                                        </div>
                                        {scoringType === 'conventional' && (
                                            <div className="space-y-2">
                                                <label className="text-sm text-gray-400 block">Duración por ronda</label>
                                                <select
                                                    value={roundDurationSeconds}
                                                    onChange={e => setRoundDurationSeconds(Number(e.target.value))}
                                                    className="w-full bg-[#07070f] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition"
                                                >
                                                    <option value={60}>1 minuto</option>
                                                    <option value={120}>2 minutos</option>
                                                    <option value={180}>3 minutos</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setStep(1)}
                                        className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-semibold transition"
                                    >
                                        Siguiente → Información del evento
                                    </button>
                                </div>
                            )}

                            {/* Step 1 — Info del evento */}
                            {step === 1 && (
                                <div className="space-y-4">
                                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5 space-y-4">
                                        <h2 className="text-sm font-medium text-gray-400">Información del evento</h2>
                                        <div>
                                            <label className="text-sm text-gray-400 mb-1 block">Nombre del encuentro *</label>
                                            <input
                                                type="text"
                                                className={`w-full bg-[#07070f] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.name ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'}`}
                                                placeholder="Ej: Encuentro Deportivo Mayo 2026"
                                                value={form.name}
                                                onChange={e => update('name', e.target.value)}
                                            />
                                            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm text-gray-400 mb-1 block">Fecha *</label>
                                                <input
                                                    type="date"
                                                    className={`w-full bg-[#07070f] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.event_date ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'}`}
                                                    value={form.event_date}
                                                    onChange={e => update('event_date', e.target.value)}
                                                />
                                                {errors.event_date && <p className="text-red-400 text-xs mt-1">{errors.event_date}</p>}
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-400 mb-1 block">Hora *</label>
                                                <input
                                                    type="time"
                                                    className={`w-full bg-[#07070f] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.start_time ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'}`}
                                                    value={form.start_time}
                                                    onChange={e => update('start_time', e.target.value)}
                                                />
                                                {errors.start_time && <p className="text-red-400 text-xs mt-1">{errors.start_time}</p>}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 mb-1 block">Lugar *</label>
                                            <input
                                                type="text"
                                                className={`w-full bg-[#07070f] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.location ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'}`}
                                                placeholder="Ej: Coliseo El Salitre, Bogotá"
                                                value={form.location}
                                                onChange={e => update('location', e.target.value)}
                                            />
                                            {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location}</p>}
                                        </div>
                                    </div>

                                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5 space-y-3">
                                        <h2 className="text-sm font-medium text-gray-400">Visibilidad</h2>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => update('visibility', 'public')}
                                                className={`p-3 rounded-xl border text-left transition ${form.visibility === 'public' ? 'border-blue-500 bg-blue-900/20' : 'border-[#1e1e2e] hover:border-gray-500'}`}
                                            >
                                                <div className="text-sm font-medium text-white mb-1">🌎 Público</div>
                                                <div className="text-xs text-gray-500">Todos los clubes pueden ver y unirse</div>
                                            </button>
                                            <button
                                                onClick={() => update('visibility', 'invite_only')}
                                                className={`p-3 rounded-xl border text-left transition ${form.visibility === 'invite_only' ? 'border-blue-500 bg-blue-900/20' : 'border-[#1e1e2e] hover:border-gray-500'}`}
                                            >
                                                <div className="text-sm font-medium text-white mb-1">🔒 Solo invitados</div>
                                                <div className="text-xs text-gray-500">Solo los clubes que invites</div>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button onClick={() => setStep(0)} className="flex-1 bg-[#0d0d1a] border border-[#1e1e2e] text-white py-3 rounded-xl font-semibold hover:bg-[#13131f] transition">
                                            ← Atrás
                                        </button>
                                        <button
                                            onClick={() => validate() && setStep(2)}
                                            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
                                        >
                                            Siguiente → Invitar clubes
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2 — Invitar clubes */}
                            {step === 2 && (
                                <div className="space-y-4">
                                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-sm font-medium text-gray-400">
                                                Invitar clubes {invitedClubs.length > 0 && <span className="text-blue-400">({invitedClubs.length} seleccionados)</span>}
                                            </h2>
                                            {form.visibility === 'public' && (
                                                <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded-lg">
                                                    Fogueo público — todos pueden unirse
                                                </span>
                                            )}
                                        </div>

                                        <input
                                            type="text"
                                            className="w-full bg-[#07070f] border border-[#1e1e2e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                                            placeholder="Buscar club por nombre o ciudad..."
                                            value={clubSearch}
                                            onChange={e => setClubSearch(e.target.value)}
                                        />

                                        {filteredClubs.length > 0 ? (
                                            <div className="space-y-1 max-h-72 overflow-y-auto">
                                                {filteredClubs.map(c => {
                                                    const invited = invitedClubs.includes(c.id)
                                                    return (
                                                        <div
                                                            key={c.id}
                                                            onClick={() => toggleInvite(c.id)}
                                                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${invited ? 'bg-blue-900/20 border border-blue-900/40' : 'hover:bg-[#13131f] border border-transparent'
                                                                }`}
                                                        >
                                                            <div className="w-9 h-9 rounded-lg bg-[#13132a] flex items-center justify-center text-sm font-bold text-blue-400 flex-shrink-0">
                                                                {c.name[0]}{c.name.split(' ')[1]?.[0] ?? ''}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm text-white">{c.name}</div>
                                                                <div className="text-xs text-gray-500">{c.city} · {c.coach_name}</div>
                                                            </div>
                                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition ${invited ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                                                                }`}>
                                                                {invited && <span className="text-white text-xs">✓</span>}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 text-sm text-center py-4">No hay clubes que coincidan</p>
                                        )}

                                        {invitedClubs.length > 0 && (
                                            <div className="bg-blue-900/20 border border-blue-900/40 rounded-xl p-3">
                                                <p className="text-xs text-blue-400">
                                                    ✓ Se enviará invitación por email a {invitedClubs.length} club{invitedClubs.length > 1 ? 'es' : ''}
                                                </p>
                                            </div>
                                        )}

                                        {form.visibility === 'public' && invitedClubs.length === 0 && (
                                            <div className="bg-[#0d1220] border border-blue-900/20 rounded-xl p-3">
                                                <p className="text-xs text-gray-500">
                                                    Este fogueo es público. Puedes invitar clubes específicos o dejar que se unan solos.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-3">
                                        <button onClick={() => setStep(1)} className="flex-1 bg-[#0d0d1a] border border-[#1e1e2e] text-white py-3 rounded-xl font-semibold hover:bg-[#13131f] transition">
                                            ← Atrás
                                        </button>
                                        <button onClick={() => setStep(3)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition">
                                            Siguiente → Mis atletas
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 3 — Mis atletas */}
                            {step === 3 && (
                                <div className="space-y-4">
                                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-sm font-medium text-gray-400">
                                                Mis atletas {selectedAthletes.length > 0 && <span className="text-blue-400">({selectedAthletes.length} seleccionados)</span>}
                                            </h2>
                                            <div className="flex gap-2">
                                                <button onClick={() => setSelectedAthletes(athletes.map(a => a.id))} className="text-xs text-blue-400 hover:text-blue-300 transition">
                                                    Todos
                                                </button>
                                                <button onClick={() => setSelectedAthletes([])} className="text-xs text-gray-500 hover:text-white transition">
                                                    Ninguno
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-3">
                                            <p className="text-xs text-yellow-400">
                                                ⚠ El día del evento podrás agregar o quitar atletas desde la gestión del fogueo.
                                            </p>
                                        </div>

                                        <input
                                            type="text"
                                            className="w-full bg-[#07070f] border border-[#1e1e2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                                            placeholder="Buscar atleta..."
                                            value={athleteSearch}
                                            onChange={e => setAthleteSearch(e.target.value)}
                                        />

                                        {athletes.length > 0 ? (
                                            <div className="space-y-1 max-h-64 overflow-y-auto">
                                                {filteredAthletes.map(a => {
                                                    const age = calculateAge(a.birth_date)
                                                    const level = (a.belt_levels as any)?.default_level ?? ''
                                                    const selected = selectedAthletes.includes(a.id)
                                                    return (
                                                        <div
                                                            key={a.id}
                                                            onClick={() => toggleAthlete(a.id)}
                                                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition ${selected ? 'bg-blue-900/20 border border-blue-900/40' : 'hover:bg-[#13131f] border border-transparent'
                                                                }`}
                                                        >
                                                            <input type="checkbox" checked={selected} onChange={() => { }} className="w-4 h-4 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm text-white">{a.first_name} {a.last_name}</div>
                                                                <div className="text-xs text-gray-500">
                                                                    {age} años · {a.training_weight ? `${a.training_weight}kg` : '—'} · {a.gender === 'M' ? 'M' : 'F'} · <span className="capitalize">{level}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 text-sm text-center py-4">No tienes atletas activos</p>
                                        )}
                                    </div>

                                    {/* Resumen */}
                                    <div className="bg-[#0d1220] border border-blue-900/40 rounded-2xl p-4 space-y-2">
                                        <div className="text-xs font-medium text-blue-400 mb-2">Resumen del fogueo</div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div><span className="text-gray-500">Evento:</span> <span className="text-white">{form.name}</span></div>
                                            <div><span className="text-gray-500">Fecha:</span> <span className="text-white">{form.event_date}</span></div>
                                            <div><span className="text-gray-500">Hora:</span> <span className="text-white">{form.start_time}</span></div>
                                            <div><span className="text-gray-500">Lugar:</span> <span className="text-white truncate">{form.location}</span></div>
                                            <div><span className="text-gray-500">Visibilidad:</span> <span className="text-white">{form.visibility === 'public' ? 'Público' : 'Solo invitados'}</span></div>
                                            <div><span className="text-gray-500">Clubes invitados:</span> <span className="text-white">{invitedClubs.length}</span></div>
                                            <div><span className="text-gray-500">Mis atletas:</span> <span className="text-white">{selectedAthletes.length}</span></div>
                                            <div><span className="text-gray-500">Tipo:</span> <span className="text-white">{scoringType === 'conventional' ? 'Convencional' : 'Electrónico'}</span></div>
                                            <div><span className="text-gray-500">Duración ronda:</span> <span className="text-white">{roundDurationSeconds / 60} min</span></div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button onClick={() => setStep(2)} className="flex-1 bg-[#0d0d1a] border border-[#1e1e2e] text-white py-3 rounded-xl font-semibold hover:bg-[#13131f] transition">
                                            ← Atrás
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={loading}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-40"
                                        >
                                            {loading ? 'Creando...' : 'Crear fogueo ✓'}
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </main>
            </div>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </>
    )
}
