'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
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
    belt_levels: { name: string; default_level: string } | null
}


export default function FogueoAthletesPage() {
    const params = useParams()
    const fogueoId = params.id as string
    const supabase = createClient()
    const { toasts, removeToast, toast } = useToast()

    const [userEmail, setUserEmail] = useState('')
    const [clubId, setClubId] = useState('')
    const [fogueoName, setFogueoName] = useState('')
    const [myAthletes, setMyAthletes] = useState<Athlete[]>([])
    const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')

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
                .from('fogueos').select('name').eq('id', fogueoId).single()
            if (fog) setFogueoName(fog.name)

            const { data: athletes } = await supabase
                .from('athletes')
                .select('*, belt_levels(name, default_level)')
                .eq('club_id', club.id)
                .eq('status', 'active')
                .order('first_name')
            if (athletes) setMyAthletes(athletes)

            const { data: enrolled } = await supabase
                .from('fogueo_athletes')
                .select('athlete_id')
                .eq('fogueo_id', fogueoId)
                .eq('club_id', club.id)

            const ids = new Set((enrolled ?? []).map((e: { athlete_id: string }) => e.athlete_id))
            setEnrolledIds(ids)
            setSelected(new Set(ids))

            setLoading(false)
        }
        load()
    }, [fogueoId])

    const toggleAthlete = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const toAdd = [...selected].filter(id => !enrolledIds.has(id))
            const toRemove = [...enrolledIds].filter(id => !selected.has(id))

            if (toRemove.length > 0) {
                const { error } = await supabase
                    .from('fogueo_athletes')
                    .delete()
                    .eq('fogueo_id', fogueoId)
                    .eq('club_id', clubId)
                    .in('athlete_id', toRemove)
                if (error) throw error
            }

            if (toAdd.length > 0) {
                const { error } = await supabase
                    .from('fogueo_athletes')
                    .insert(toAdd.map(athlete_id => ({
                        fogueo_id: fogueoId,
                        athlete_id,
                        club_id: clubId,
                    })))
                if (error) throw error
            }

            setEnrolledIds(new Set(selected))
            const n = selected.size
            toast.success(`${n} atleta${n !== 1 ? 's' : ''} confirmado${n !== 1 ? 's' : ''} para el fogueo`)
        } catch {
            toast.error('Error al guardar. Intenta de nuevo.')
        } finally {
            setSaving(false)
        }
    }

    const filtered = myAthletes.filter(a => {
        if (!search) return true
        return `${a.first_name} ${a.last_name}`.toLowerCase().includes(search.toLowerCase())
    })

    const hasChanges =
        [...selected].some(id => !enrolledIds.has(id)) ||
        [...enrolledIds].some(id => !selected.has(id))

    if (loading) return (
        <div className="flex min-h-screen bg-[#07070f] text-white items-center justify-center">
            <div className="text-gray-500 text-sm">Cargando atletas...</div>
        </div>
    )

    return (
        <>
            <div className="flex min-h-screen bg-[#07070f] text-white">
                <Sidebar userEmail={userEmail} />
                <main className="flex-1 p-6">
                    <div className="max-w-2xl mx-auto">

                        {/* Header */}
                        <div className="flex items-center gap-3 mb-6">
                            <Link
                                href={`/dashboard/tournaments/fogueos/${fogueoId}`}
                                className="text-gray-500 hover:text-white transition text-sm"
                            >
                                ← Volver
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold">
                                    <span className="text-blue-500">TKD</span> — Mis atletas en el fogueo
                                </h1>
                                {fogueoName && (
                                    <p className="text-xs text-gray-500 mt-0.5">{fogueoName}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">

                            {/* Info */}
                            <div className="bg-blue-900/20 border border-blue-900/40 rounded-xl p-4">
                                <p className="text-xs text-blue-400">
                                    Selecciona los atletas de tu club que participarán en este fogueo.
                                    Puedes agregar o quitar atletas en cualquier momento, incluso el día del evento.
                                </p>
                            </div>

                            {/* List */}
                            <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-sm font-medium text-gray-400">
                                        Atletas activos ({selected.size} seleccionados)
                                    </h2>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setSelected(new Set(myAthletes.map(a => a.id)))}
                                            className="text-xs text-blue-400 hover:text-blue-300 transition"
                                        >
                                            Todos
                                        </button>
                                        <button
                                            onClick={() => setSelected(new Set())}
                                            className="text-xs text-gray-500 hover:text-white transition"
                                        >
                                            Ninguno
                                        </button>
                                    </div>
                                </div>

                                <input
                                    type="text"
                                    className="w-full bg-[#07070f] border border-[#1e1e2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition mb-3"
                                    placeholder="Buscar atleta..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />

                                {myAthletes.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500 text-sm mb-3">No tienes atletas activos</p>
                                        <Link
                                            href="/dashboard/athletes/new"
                                            className="text-xs text-blue-400 hover:text-blue-300 transition"
                                        >
                                            + Registrar atleta →
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                                        {filtered.map(a => {
                                            const age = calculateAge(a.birth_date)
                                            const isSelected = selected.has(a.id)
                                            const wasEnrolled = enrolledIds.has(a.id)
                                            const changed = isSelected !== wasEnrolled
                                            return (
                                                <div
                                                    key={a.id}
                                                    onClick={() => toggleAthlete(a.id)}
                                                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition ${isSelected
                                                        ? 'bg-blue-900/20 border border-blue-900/40'
                                                        : 'hover:bg-[#13131f] border border-transparent'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => { }}
                                                        className="w-4 h-4 flex-shrink-0"
                                                    />
                                                    <div className="w-8 h-8 rounded-lg bg-[#13132a] flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                                                        {a.first_name[0]}{a.last_name[0]}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-white">
                                                                {a.first_name} {a.last_name}
                                                            </span>
                                                            {changed && (
                                                                <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${isSelected
                                                                    ? 'bg-green-900/40 text-green-400'
                                                                    : 'bg-red-900/40 text-red-400'
                                                                    }`}>
                                                                    {isSelected ? '+ agregando' : '− quitando'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {age} años · {a.training_weight ? `${a.training_weight}kg` : '—'} · {a.gender === 'M' ? 'M' : 'F'} · <span className="capitalize">{(a.belt_levels as any)?.default_level ?? '—'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {filtered.length === 0 && (
                                            <p className="text-gray-500 text-sm text-center py-4">Sin atletas que coincidan</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Unsaved changes warning */}
                            {hasChanges && (
                                <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-3">
                                    <p className="text-xs text-yellow-400">
                                        ⚠ Tienes cambios sin guardar — presiona "Guardar" para confirmar.
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <Link
                                    href={`/dashboard/tournaments/fogueos/${fogueoId}`}
                                    className="flex-1 bg-[#0d0d1a] border border-[#1e1e2e] text-white py-3 rounded-xl text-sm font-medium hover:bg-[#13131f] transition text-center"
                                >
                                    Cancelar
                                </Link>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !hasChanges}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium transition disabled:opacity-40"
                                >
                                    {saving
                                        ? 'Guardando...'
                                        : `Guardar (${selected.size} atleta${selected.size !== 1 ? 's' : ''})`}
                                </button>
                            </div>

                        </div>
                    </div>
                </main>
            </div>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </>
    )
}
