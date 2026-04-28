'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

interface Athlete {
    id: string
    first_name: string
    last_name: string
    birth_date: string
    gender: string
    email: string | null
    photo_url: string | null
    training_weight: number | null
    status: string
    doc_type: string
    doc_number: string
    belt_levels: { name: string; default_level: string } | null
}

function calculateAge(birthDate: string): number {
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
    return '-'
}

const levelColors: Record<string, string> = {
    principiante: 'bg-green-900/40 text-green-400',
    avanzado: 'bg-blue-900/40 text-blue-400',
    negro: 'bg-gray-800 text-gray-300',
}

export default function AthletesPage() {
    const router = useRouter()
    const supabase = createClient()
    const [athletes, setAthletes] = useState<Athlete[]>([])
    const [loading, setLoading] = useState(true)
    const [userEmail, setUserEmail] = useState('')
    const [clubId, setClubId] = useState('')
    const [search, setSearch] = useState('')
    const [filterGender, setFilterGender] = useState('')
    const [filterLevel, setFilterLevel] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserEmail(user.email ?? '')
            const { data: club } = await supabase
                .from('clubs').select('id').eq('user_id', user.id).single()
            if (!club) return
            setClubId(club.id)
            const { data } = await supabase
                .from('athletes')
                .select('*, belt_levels(name, default_level)')
                .eq('club_id', club.id)
                .order('created_at', { ascending: false })
            if (data) setAthletes(data)
            setLoading(false)
        }
        load()
    }, [])

    const toggleStatus = async (id: string, current: string) => {
        const newStatus = current === 'active' ? 'suspended' : 'active'
        const { error } = await supabase
            .from('athletes').update({ status: newStatus }).eq('id', id)
        if (!error) {
            setAthletes(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
        }
    }

    const deleteAthlete = async (id: string) => {
        const { error } = await supabase.from('athletes').delete().eq('id', id)
        if (!error) {
            setAthletes(prev => prev.filter(a => a.id !== id))
            setConfirmDelete(null)
        }
    }

    const filtered = athletes.filter(a => {
        const fullName = `${a.first_name} ${a.last_name}`.toLowerCase()
        const matchSearch = !search || fullName.includes(search.toLowerCase()) ||
            a.doc_number?.includes(search) || a.email?.toLowerCase().includes(search.toLowerCase())
        const matchGender = !filterGender || a.gender === filterGender
        const matchLevel = !filterLevel || (a.belt_levels?.default_level ?? '') === filterLevel
        const matchStatus = !filterStatus || a.status === filterStatus
        return matchSearch && matchGender && matchLevel && matchStatus
    })

    return (
        <div className="flex min-h-screen bg-[#07070f] text-white">
            <Sidebar userEmail={userEmail} />
            <main className="flex-1 p-6">
                <div className="max-w-7xl mx-auto">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold">
                                <span className="text-blue-500">TKD</span> — Atletas
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">
                                {filtered.length} de {athletes.length} atletas
                            </p>
                        </div>
                        <Link
                            href="/dashboard/athletes/new"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
                        >
                            + Registrar atleta
                        </Link>
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-wrap gap-3 mb-5">
                        {/* Búsqueda */}
                        <div className="relative flex-1 min-w-48">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                            </svg>
                            <input
                                className="w-full bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
                                placeholder="Buscar por nombre, documento o correo..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                            value={filterGender}
                            onChange={e => setFilterGender(e.target.value)}
                        >
                            <option value="">Todos los géneros</option>
                            <option value="M">Masculino</option>
                            <option value="F">Femenino</option>
                        </select>

                        <select
                            className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                            value={filterLevel}
                            onChange={e => setFilterLevel(e.target.value)}
                        >
                            <option value="">Todos los niveles</option>
                            <option value="principiante">Principiante</option>
                            <option value="avanzado">Avanzado</option>
                            <option value="negro">Negro</option>
                        </select>

                        <select
                            className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="">Todos los estados</option>
                            <option value="active">Activo</option>
                            <option value="suspended">Suspendido</option>
                        </select>

                        {(search || filterGender || filterLevel || filterStatus) && (
                            <button
                                onClick={() => { setSearch(''); setFilterGender(''); setFilterLevel(''); setFilterStatus('') }}
                                className="text-xs text-gray-500 hover:text-white transition px-3"
                            >
                                Limpiar filtros ✕
                            </button>
                        )}
                    </div>

                    {/* Tabla */}
                    {loading ? (
                        <div className="text-center py-20 text-gray-500">Cargando atletas...</div>
                    ) : filtered.length > 0 ? (
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[#1e1e2e]">
                                        {['Atleta', 'Edad / Categoría', 'Género', 'Cinturón / Nivel', 'Peso', 'Estado', 'Acciones'].map(h => (
                                            <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wider px-4 py-3 font-medium">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(a => {
                                        const age = calculateAge(a.birth_date)
                                        const ageGroup = getAgeGroup(age)
                                        const level = a.belt_levels?.default_level ?? ''
                                        return (
                                            <tr key={a.id} className={`border-b border-[#13131f] hover:bg-[#13131f] transition ${a.status === 'suspended' ? 'opacity-60' : ''
                                                }`}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        {a.photo_url ? (
                                                            <img src={a.photo_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                                                        ) : (
                                                            <div className="w-9 h-9 rounded-lg bg-[#13132a] flex items-center justify-center text-sm font-bold text-blue-400 flex-shrink-0">
                                                                {a.first_name[0]}{a.last_name[0]}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="text-sm font-medium text-white">{a.first_name} {a.last_name}</div>
                                                            <div className="text-xs text-gray-500">{a.email ?? '—'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-sm text-white">{age} años</div>
                                                    <div className="text-xs text-gray-500">{ageGroup}</div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-300">
                                                    {a.gender === 'M' ? 'Masculino' : 'Femenino'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-sm text-white">{a.belt_levels?.name ?? '—'}</div>
                                                    {level && (
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${levelColors[level] ?? ''}`}>
                                                            {level.charAt(0).toUpperCase() + level.slice(1)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-300">
                                                    {a.training_weight ? `${a.training_weight} kg` : '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => toggleStatus(a.id, a.status)}
                                                        className={`text-xs px-3 py-1 rounded-full transition cursor-pointer ${a.status === 'active'
                                                                ? 'bg-green-900/40 text-green-400 hover:bg-green-900/70'
                                                                : 'bg-red-900/40 text-red-400 hover:bg-red-900/70'
                                                            }`}
                                                    >
                                                        {a.status === 'active' ? 'Activo' : 'Suspendido'}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => router.push(`/dashboard/athletes/${a.id}/edit`)}
                                                            className="text-xs text-blue-400 hover:text-blue-300 transition px-2 py-1 rounded-lg hover:bg-blue-900/20"
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDelete(a.id)}
                                                            className="text-xs text-red-400 hover:text-red-300 transition px-2 py-1 rounded-lg hover:bg-red-900/20"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-12 text-center">
                            <div className="text-5xl mb-4">🥋</div>
                            {athletes.length === 0 ? (
                                <>
                                    <h2 className="text-lg font-semibold mb-2">No hay atletas registrados</h2>
                                    <p className="text-gray-500 text-sm mb-6">Registra el primer atleta de tu club</p>
                                    <Link href="/dashboard/athletes/new" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition">
                                        + Registrar primer atleta
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-lg font-semibold mb-2">Sin resultados</h2>
                                    <p className="text-gray-500 text-sm">No hay atletas que coincidan con los filtros</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Modal confirmar eliminación */}
                {confirmDelete && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-6 max-w-sm w-full mx-4">
                            <h3 className="text-lg font-semibold mb-2">¿Eliminar atleta?</h3>
                            <p className="text-gray-400 text-sm mb-6">Esta acción no se puede deshacer. El atleta será eliminado permanentemente.</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="flex-1 bg-[#13131f] border border-[#1e1e2e] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#1a1a2e] transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => deleteAthlete(confirmDelete)}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-medium transition"
                                >
                                    Sí, eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}