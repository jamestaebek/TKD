import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: club } = await supabase
        .from('clubs').select('*').eq('user_id', user.id).single()
    if (!club) redirect('/dashboard/club/register')

    const { count: athleteCount } = await supabase
        .from('athletes').select('*', { count: 'exact', head: true })
        .eq('club_id', club.id).eq('status', 'active')

    const { count: pendingCount } = await supabase
        .from('athletes').select('*', { count: 'exact', head: true })
        .eq('club_id', club.id).eq('status', 'pending')

    const { data: trophies } = await supabase
        .from('club_trophies').select('*').eq('club_id', club.id)
        .order('event_date', { ascending: false }).limit(3)

    const { data: activity } = await supabase
        .from('platform_activity').select('*')
        .order('created_at', { ascending: false }).limit(4)

    const { data: ranking } = await supabase
        .from('club_ranking').select('*').limit(5)

    const { data: platformStats } = await supabase
        .from('platform_stats').select('*').single()

    const { data: allClubs } = await supabase
        .from('clubs')
        .select('id, name, city, latitude, longitude')
        .eq('status', 'active')
        .not('latitude', 'is', null)

    const myRank = ranking?.findIndex(r => r.id === club.id) ?? -1
    const myRankNum = myRank >= 0 ? myRank + 1 : null
    const gold = trophies?.filter(t => t.medal_type === 'gold').length ?? 0
    const silver = trophies?.filter(t => t.medal_type === 'silver').length ?? 0
    const bronze = trophies?.filter(t => t.medal_type === 'bronze').length ?? 0

    const medalColors: Record<string, string> = {
        gold: 'text-yellow-400 bg-yellow-900/30',
        silver: 'text-slate-300 bg-slate-800/50',
        bronze: 'text-orange-400 bg-orange-900/30',
    }
    const medalLabels: Record<string, string> = {
        gold: 'Oro', silver: 'Plata', bronze: 'Bronce'
    }
    const activityColors: Record<string, string> = {
        tournament_open: 'bg-purple-500',
        tournament_closing: 'bg-yellow-500',
        club_ranking_up: 'bg-green-500',
        club_medal: 'bg-yellow-400',
        new_tournament: 'bg-blue-500',
    }

    return (
        <div className="flex min-h-screen bg-[#07070f] text-white">
            <Sidebar userEmail={user.email ?? ''} />
            <main className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-6xl mx-auto space-y-5">

                    {/* Hero */}
                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-6 flex items-center gap-5">
                        {club.logo_url ? (
                            <img src={club.logo_url} alt="Logo" className="w-20 h-20 rounded-xl object-cover border-2 border-[#2a2a4a]" />
                        ) : (
                            <div className="w-20 h-20 rounded-xl bg-[#13132a] border border-[#2a2a4a] flex items-center justify-center text-4xl">🥋</div>
                        )}
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-white">{club.name}</h1>
                            <p className="text-sm text-gray-500 mt-1">{club.city}, {club.country} · Entrenador: {club.coach_name}</p>
                            <div className="flex items-center gap-1.5 mt-2 bg-green-950 text-green-400 text-xs px-3 py-1 rounded-full w-fit border border-green-900">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"></span>
                                Club activo
                            </div>
                        </div>
                        {myRankNum && (
                            <div className="text-right">
                                <div className="text-4xl font-bold text-yellow-400">#{myRankNum}</div>
                                <div className="text-xs text-gray-500 mt-1">Ranking nacional</div>
                            </div>
                        )}
                    </div>

                    {/* Counter */}
                    <div className="bg-[#0d0d1a] border border-blue-900/40 rounded-2xl p-5 flex items-center gap-6">
                        <div className="flex-1">
                            <div className="text-4xl font-bold text-blue-400">
                                {(platformStats?.total_athletes ?? 0).toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">Atletas registrados en la plataforma</div>
                            <div className="flex items-center gap-1 mt-2 text-xs text-blue-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"></span>
                                En vivo · {platformStats?.total_clubs ?? 0} clubes activos
                            </div>
                        </div>
                        <div className="text-right border-l border-[#1e1e2e] pl-6">
                            <div className="text-xs text-gray-600">Tu club aporta</div>
                            <div className="text-3xl font-bold text-blue-400 mt-1">{athleteCount ?? 0}</div>
                            <div className="text-xs text-gray-600 mt-1">atletas activos</div>
                        </div>
                    </div>

                    {/* Pendientes alert */}
                    {pendingCount && pendingCount > 0 ? (
                        <Link href="/dashboard/athletes" className="block bg-yellow-900/20 border border-yellow-900/40 hover:border-yellow-500/50 rounded-2xl p-4 transition">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">⏳</span>
                                <div>
                                    <div className="text-sm font-medium text-yellow-400">
                                        {pendingCount} solicitud{pendingCount > 1 ? 'es' : ''} pendiente{pendingCount > 1 ? 's' : ''} de aprobación
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">Atletas que se registraron por link — haz clic para revisar</div>
                                </div>
                                <div className="ml-auto text-yellow-400 text-sm">Ver →</div>
                            </div>
                        </Link>
                    ) : null}

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'Atletas activos', value: athleteCount ?? 0, color: 'text-blue-400', trend: pendingCount ? `${pendingCount} pendientes` : '✓ al día', trendColor: pendingCount ? 'text-yellow-400' : 'text-green-400' },
                            { label: 'Torneos', value: 0, color: 'text-purple-400', trend: 'próximo disponible', trendColor: 'text-gray-500' },
                            { label: 'Inscritos', value: 0, color: 'text-yellow-400', trend: 'sin torneo activo', trendColor: 'text-gray-500' },
                            { label: 'Medallas', value: trophies?.length ?? 0, color: 'text-green-400', trend: `${gold}🥇 ${silver}🥈 ${bronze}🥉`, trendColor: 'text-yellow-400' },
                        ].map(s => (
                            <div key={s.label} className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl p-4">
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{s.label}</div>
                                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                                <div className={`text-xs mt-1.5 ${s.trendColor}`}>{s.trend}</div>
                            </div>
                        ))}
                    </div>

                    {/* Mapa + Feed */}
                    <div className="grid grid-cols-5 gap-4">
                        <div className="col-span-3 bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Clubes en Colombia</div>
                            <div className="flex items-center justify-center h-40 bg-[#0a0a14] rounded-xl relative overflow-hidden">
                                <svg viewBox="0 0 200 220" className="h-36 opacity-20 absolute">
                                    <path fill="#3b82f6" d="M95 10 Q110 8 120 15 L130 25 Q140 30 138 45 L135 55 Q145 60 148 75 L145 90 Q150 100 145 110 L140 125 Q145 135 140 148 L130 158 Q120 170 110 175 L100 185 Q90 190 82 185 L72 178 Q62 170 58 158 L50 145 Q42 132 45 118 L48 105 Q42 92 45 80 L50 68 Q48 55 55 45 L62 35 Q70 20 80 14 Z" />
                                </svg>
                                {allClubs?.map(c => {
                                    if (!c.latitude || !c.longitude) return null
                                    const x = ((c.longitude - (-79)) / ((-67) - (-79)) * 160 + 20)
                                    const y = ((12.5 - c.latitude) / (12.5 - (-4.5)) * 180 + 20)
                                    const isMe = c.id === club.id
                                    return (
                                        <div
                                            key={c.id}
                                            title={c.name}
                                            className={`absolute rounded-full transition-all ${isMe
                                                    ? 'w-3 h-3 bg-yellow-400 ring-2 ring-yellow-400/30'
                                                    : 'w-2 h-2 bg-blue-500 opacity-70 hover:opacity-100'
                                                }`}
                                            style={{
                                                left: `${x}px`,
                                                top: `${y}px`,
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        />
                                    )
                                })}
                            </div>
                            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
                                    Tu club — {club.city}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                                    Otros clubes ({Math.max((allClubs?.length ?? 1) - 1, 0)})
                                </span>
                            </div>
                        </div>

                        <div className="col-span-2 bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Actividad reciente</div>
                            <div className="space-y-3">
                                {activity?.map(item => (
                                    <div key={item.id} className="flex items-start gap-2.5">
                                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${activityColors[item.type] ?? 'bg-gray-500'}`} />
                                        <div>
                                            <div className="text-xs text-gray-400 leading-relaxed">{item.message}</div>
                                            <div className="text-xs text-gray-600 mt-0.5">
                                                {new Date(item.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!activity || activity.length === 0) && (
                                    <div className="text-xs text-gray-600">Sin actividad reciente</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Acciones */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { href: '/dashboard/athletes/new', icon: '＋', label: 'Registrar atleta', sub: 'Agrega un deportista', iconBg: 'bg-blue-950', iconColor: 'text-blue-400' },
                            { href: '/dashboard/athletes', icon: '👥', label: 'Ver atletas', sub: `${athleteCount ?? 0} activos`, iconBg: 'bg-green-950', iconColor: 'text-green-400' },
                            { href: '/dashboard/tournaments', icon: '🏆', label: 'Ver torneos', sub: 'Inscribe tus atletas', iconBg: 'bg-purple-950', iconColor: 'text-purple-400' },
                        ].map(a => (
                            <Link key={a.href} href={a.href} className="bg-[#0d0d1a] border border-[#1e1e2e] hover:border-blue-500/50 rounded-xl p-5 transition group">
                                <div className={`w-9 h-9 ${a.iconBg} rounded-lg flex items-center justify-center text-base mb-3`}>
                                    <span className={a.iconColor}>{a.icon}</span>
                                </div>
                                <div className="text-sm font-medium text-white group-hover:text-blue-400 transition">{a.label}</div>
                                <div className="text-xs text-gray-500 mt-1">{a.sub}</div>
                            </Link>
                        ))}
                    </div>

                    {/* Vitrina + Ranking */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Vitrina de logros</div>
                            {trophies && trophies.length > 0 ? (
                                <div className="space-y-3">
                                    {trophies.map(t => (
                                        <div key={t.id} className="flex items-center gap-3 py-2 border-b border-[#13131f] last:border-0">
                                            <div className="text-xl w-7 text-center">
                                                {t.medal_type === 'gold' ? '🥇' : t.medal_type === 'silver' ? '🥈' : '🥉'}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm text-gray-200">{t.title}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{t.event_name}</div>
                                            </div>
                                            <div className={`text-xs px-2 py-0.5 rounded-full ${medalColors[t.medal_type]}`}>
                                                {medalLabels[t.medal_type]}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <div className="text-3xl mb-2">🏆</div>
                                    <div className="text-sm text-gray-500">Aún no hay logros registrados</div>
                                    <div className="text-xs text-gray-600 mt-1">Los trofeos aparecerán aquí</div>
                                </div>
                            )}
                        </div>

                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Ranking de clubes</div>
                            <div className="space-y-2">
                                {ranking?.map((r, i) => (
                                    <div
                                        key={r.id}
                                        className={`flex items-center gap-3 py-2 px-2 rounded-lg ${r.id === club.id ? 'bg-[#13131f] border border-yellow-900/40' : ''}`}
                                    >
                                        <div className={`text-xs font-bold w-5 ${i < 3 ? 'text-yellow-400' : 'text-gray-600'}`}>{i + 1}</div>
                                        <div className="w-7 h-7 rounded-lg bg-[#13132a] flex items-center justify-center text-xs overflow-hidden flex-shrink-0">
                                            {r.logo_url ? <img src={r.logo_url} alt="" className="w-full h-full object-cover" /> : '🥋'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-xs truncate ${r.id === club.id ? 'text-yellow-400 font-medium' : 'text-gray-300'}`}>
                                                {r.name} {r.id === club.id ? '← tú' : ''}
                                            </div>
                                            <div className="text-xs text-gray-600">{r.city}</div>
                                        </div>
                                        <div className={`text-xs font-medium ${r.id === club.id ? 'text-yellow-400' : 'text-gray-500'}`}>
                                            {r.points} pts
                                        </div>
                                    </div>
                                ))}
                                {(!ranking || ranking.length === 0) && (
                                    <div className="text-xs text-gray-600 text-center py-4">Sin datos de ranking aún</div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    )
}