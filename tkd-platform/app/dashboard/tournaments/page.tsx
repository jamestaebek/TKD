import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default async function TournamentsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: club } = await supabase
        .from('clubs').select('id, name').eq('user_id', user.id).single()
    if (!club) redirect('/dashboard/club/register')

    const { data: fogueos } = await supabase
        .from('fogueos')
        .select('*, clubs(name)')
        .order('event_date', { ascending: true })

    const today = new Date().toISOString().split('T')[0]

    const getStatus = (fogueo: any) => {
        if (fogueo.event_date === today) return { label: 'Hoy', style: 'bg-yellow-900/40 text-yellow-400' }
        if (fogueo.event_date > today) return { label: 'Abierto', style: 'bg-green-900/40 text-green-400' }
        return { label: 'Cerrado', style: 'bg-gray-800 text-gray-500' }
    }

    return (
        <div className="flex min-h-screen bg-[#07070f] text-white">
            <Sidebar userEmail={user.email ?? ''} />
            <main className="flex-1 p-6">
                <div className="max-w-5xl mx-auto">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold">
                                <span className="text-blue-500">TKD</span> — Torneos
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">Fogueos y torneos oficiales</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <Link href="/dashboard/tournaments/fogueos" className="bg-[#0d0d1a] border border-blue-500/50 rounded-2xl p-5 hover:border-blue-500 transition group">
                            <div className="text-2xl mb-3">🥋</div>
                            <h2 className="text-lg font-semibold text-white group-hover:text-blue-400 transition">Fogueos / Sparrings</h2>
                            <p className="text-gray-500 text-sm mt-1">Encuentros de práctica entre clubes. Brackets libres sin restricción de categoría.</p>
                            <div className="mt-3 text-xs text-blue-400">Ver fogueos →</div>
                        </Link>
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5 opacity-60 cursor-not-allowed">
                            <div className="text-2xl mb-3">🏆</div>
                            <h2 className="text-lg font-semibold text-white">Torneos oficiales</h2>
                            <p className="text-gray-500 text-sm mt-1">Torneos con categorías oficiales, pesaje y brackets reglamentados.</p>
                            <div className="mt-3 text-xs text-gray-600">Próximamente →</div>
                        </div>
                    </div>

                    {/* Fogueos recientes */}
                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wider">Fogueos activos</div>
                            <Link href="/dashboard/tournaments/fogueos/new" className="text-xs text-blue-400 hover:text-blue-300 transition">
                                + Crear fogueo
                            </Link>
                        </div>

                        {fogueos && fogueos.length > 0 ? (
                            <div className="space-y-3">
                                {fogueos.slice(0, 5).map(f => {
                                    const status = getStatus(f)
                                    const isOrganizer = f.club_id === club.id
                                    return (
                                        <div key={f.id} className="flex items-center gap-3 py-3 border-b border-[#13131f] last:border-0">
                                            <div className="w-10 h-10 rounded-xl bg-[#13132a] flex items-center justify-center text-lg flex-shrink-0">🥋</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-sm font-medium text-white truncate">{f.name}</div>
                                                    {isOrganizer && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 flex-shrink-0">Organizador</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    {(f.clubs as any)?.name} · {new Date(f.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })} · {f.location}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${status.style}`}>{status.label}</span>
                                                <Link href={`/dashboard/tournaments/fogueos/${f.id}`} className="text-xs text-blue-400 hover:text-blue-300 transition px-2 py-1 rounded-lg hover:bg-blue-900/20">
                                                    Ver →
                                                </Link>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-3xl mb-3">🥋</div>
                                <p className="text-gray-500 text-sm mb-4">No hay fogueos activos</p>
                                <Link href="/dashboard/tournaments/fogueos/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm transition">
                                    Crear primer fogueo
                                </Link>
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    )
}