import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import JoinFogueoButton from '@/components/JoinFogueoButton'
import FinalizeFogueoButton from '@/components/FinalizeFogueoButton'

export default async function FogueoDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: club } = await supabase
        .from('clubs').select('id, name').eq('user_id', user.id).single()
    if (!club) redirect('/dashboard/club/register')

    const { data: fogueo } = await supabase
        .from('fogueos')
        .select('*, clubs(name, logo_url, coach_name)')
        .eq('id', id)
        .single()

    if (!fogueo) redirect('/dashboard/tournaments/fogueos')

    const isOrganizer = fogueo.club_id === club.id
    const today = new Date().toISOString().split('T')[0]
    const isToday = fogueo.event_date === today

    const { data: fogueoClubs } = await supabase
        .from('fogueo_clubs')
        .select('*, clubs(id, name, logo_url)')
        .eq('fogueo_id', id)

    const { data: myAthletes } = await supabase
        .from('fogueo_athletes')
        .select('*, athletes(id, first_name, last_name, birth_date, gender, training_weight, belt_levels(name, default_level))')
        .eq('fogueo_id', id)
        .eq('club_id', club.id)

    const { data: pyramids } = await supabase
        .from('fogueo_pyramids')
        .select('*, fogueo_matches(count)')
        .eq('fogueo_id', id)
        .order('created_at')

    const totalAthletes = await supabase
        .from('fogueo_athletes')
        .select('*', { count: 'exact', head: true })
        .eq('fogueo_id', id)

    const sortModeLabels: Record<string, string> = {
        level_gender_weight: 'Nivel + Género + Peso',
        level_gender: 'Nivel + Género',
        gender_only: 'Solo género',
        category: 'Por categoría oficial',
        age_only: 'Por edad',
        manual: 'Manual',
    }

    const statusColors: Record<string, string> = {
        pending: 'bg-gray-800 text-gray-400',
        in_progress: 'bg-blue-900/40 text-blue-400',
        finished: 'bg-green-900/40 text-green-400',
    }

    return (
        <div className="flex min-h-screen bg-[#07070f] text-white">
            <Sidebar userEmail={user.email ?? ''} />
            <main className="flex-1 p-6">
                <div className="max-w-5xl mx-auto space-y-5">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                                <Link href="/dashboard/tournaments" className="hover:text-white transition">Torneos</Link>
                                <span>›</span>
                                <Link href="/dashboard/tournaments/fogueos" className="hover:text-white transition">Fogueos</Link>
                                <span>›</span>
                                <span className="text-white truncate max-w-48">{fogueo.name}</span>
                            </div>
                            <h1 className="text-2xl font-bold">{fogueo.name}</h1>
                            <p className="text-gray-500 text-sm mt-1">
                                {new Date(fogueo.event_date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {fogueo.start_time?.slice(0, 5)} · {fogueo.location}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {isOrganizer && fogueo.status !== 'finished' && (
                                <FinalizeFogueoButton
                                    fogueoId={id}
                                    fogueoName={fogueo.name}
                                />
                            )}
                            {isOrganizer && (
                                <Link
                                    href={`/dashboard/tournaments/fogueos/${id}/bracket`}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
                                >
                                    Gestionar brackets →
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Alert día del evento */}
                    {isToday && (
                        <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-2xl p-4 flex items-center gap-3">
                            <span className="text-2xl">🔥</span>
                            <div>
                                <div className="text-sm font-medium text-yellow-400">¡Hoy es el día del evento!</div>
                                <div className="text-xs text-gray-500 mt-0.5">El listado completo de atletas ya está disponible para todos los clubes participantes.</div>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'Clubes', value: fogueoClubs?.length ?? 0, color: 'text-blue-400' },
                            { label: 'Atletas totales', value: totalAthletes.count ?? 0, color: 'text-green-400' },
                            { label: 'Mis atletas', value: myAthletes?.length ?? 0, color: 'text-yellow-400' },
                            { label: 'Pirámides', value: pyramids?.length ?? 0, color: 'text-purple-400' },
                        ].map(s => (
                            <div key={s.label} className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl p-4">
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{s.label}</div>
                                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">

                        {/* Clubes participantes */}
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Clubes participantes</div>
                            {fogueoClubs && fogueoClubs.length > 0 ? (
                                <div className="space-y-3">
                                    {fogueoClubs.map(fc => (
                                        <div key={fc.id} className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[#13132a] flex items-center justify-center text-xs overflow-hidden flex-shrink-0">
                                                {(fc.clubs as any)?.logo_url
                                                    ? <img src={(fc.clubs as any).logo_url} alt="" className="w-full h-full object-cover" />
                                                    : '🥋'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-white truncate">{(fc.clubs as any)?.name}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {fc.club_id === fogueo.club_id && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400">Organizador</span>
                                                )}
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${fc.status === 'confirmed' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'
                                                    }`}>
                                                    {fc.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm text-center py-4">Sin clubes confirmados</p>
                            )}

                            {!isOrganizer && !fogueoClubs?.find(fc => fc.club_id === club.id) && (
                                <JoinFogueoButton fogueoId={id} clubId={club.id} />
                            )}
                        </div>

                        {/* Mis atletas */}
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-xs text-gray-500 uppercase tracking-wider">Mis atletas confirmados</div>
                                <Link
                                    href={`/dashboard/tournaments/fogueos/${id}/athletes`}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                                >
                                    Editar →
                                </Link>
                            </div>
                            {myAthletes && myAthletes.length > 0 ? (
                                <div className="space-y-2">
                                    {myAthletes.map(ma => {
                                        const a = (ma.athletes as any)
                                        if (!a) return null
                                        return (
                                            <div key={ma.id} className="flex items-center gap-2 py-1.5 border-b border-[#13131f] last:border-0">
                                                <div className="w-7 h-7 rounded-lg bg-[#13132a] flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                                                    {a.first_name?.[0]}{a.last_name?.[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-white">{a.first_name} {a.last_name}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {a.training_weight ? `${a.training_weight}kg` : '—'} · {a.gender === 'M' ? 'M' : 'F'} · <span className="capitalize">{(a.belt_levels as any)?.default_level ?? '—'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-gray-500 text-sm mb-3">No has confirmado atletas</p>
                                    <Link
                                        href={`/dashboard/tournaments/fogueos/${id}/athletes`}
                                        className="text-xs text-blue-400 hover:text-blue-300 transition"
                                    >
                                        Agregar atletas →
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pirámides */}
                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wider">Pirámides / Brackets</div>
                            {isOrganizer && (
                                <Link
                                    href={`/dashboard/tournaments/fogueos/${id}/bracket`}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                                >
                                    + Nueva pirámide
                                </Link>
                            )}
                        </div>

                        {pyramids && pyramids.length > 0 ? (
                            <div className="grid grid-cols-3 gap-3">
                                {pyramids.map((p, i) => (
                                    <Link
                                        key={p.id}
                                        href={`/dashboard/tournaments/fogueos/${id}/bracket?pyramid=${p.id}`}
                                        className="bg-[#13131f] border border-[#1e1e2e] hover:border-blue-500/50 rounded-xl p-4 transition"
                                    >
                                        <div className="text-sm font-medium text-white mb-1">Fogueo {i + 1}</div>
                                        <div className="text-xs text-gray-500 mb-2">{sortModeLabels[p.sort_mode]}</div>
                                        <div className="flex items-center justify-between">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[p.status] ?? 'bg-gray-800 text-gray-400'}`}>
                                                {p.status === 'pending' ? 'Pendiente' : p.status === 'in_progress' ? 'En curso' : 'Finalizado'}
                                            </span>
                                            <span className="text-xs text-gray-600">
                                                {(p.fogueo_matches as any)?.[0]?.count ?? 0} combates
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-gray-500 text-sm mb-3">
                                    {isOrganizer ? 'No hay pirámides creadas aún' : 'El organizador aún no ha creado los brackets'}
                                </p>
                                {isOrganizer && (
                                    <Link
                                        href={`/dashboard/tournaments/fogueos/${id}/bracket`}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm transition"
                                    >
                                        Crear primera pirámide
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    )
}