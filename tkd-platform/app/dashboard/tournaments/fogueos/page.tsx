import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default async function FogueosPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: club } = await supabase
        .from('clubs').select('id, name').eq('user_id', user.id).single()
    if (!club) redirect('/dashboard/club/register')

    const { data: invitedRows } = await supabase
        .from('fogueo_clubs')
        .select('fogueo_id')
        .eq('club_id', club.id)
    const invitedIds = (invitedRows ?? []).map(r => r.fogueo_id)

    const { data: fogueos } = await supabase
        .from('fogueos')
        .select(`
      *,
      clubs(name, logo_url),
      fogueo_clubs(count),
      fogueo_athletes(count)
    `)
        .or(`club_id.eq.${club.id},visibility.neq.invite_only${invitedIds.length > 0 ? `,id.in.(${invitedIds.join(',')})` : ''}`)
        .order('event_date', { ascending: true })

    const today = new Date().toISOString().split('T')[0]

    const myFogueos = fogueos?.filter(f => f.club_id === club.id) ?? []
    const otherFogueos = fogueos?.filter(f => f.club_id !== club.id) ?? []

    const statusBadge = (f: any) => {
        if (f.event_date === today) return { label: 'Hoy', style: 'bg-yellow-900/40 text-yellow-400' }
        if (f.event_date > today && f.status === 'open') return { label: 'Abierto', style: 'bg-green-900/40 text-green-400' }
        if (f.status === 'in_progress') return { label: 'En curso', style: 'bg-blue-900/40 text-blue-400' }
        if (f.status === 'finished') return { label: 'Finalizado', style: 'bg-gray-800 text-gray-500' }
        return { label: 'Cerrado', style: 'bg-gray-800 text-gray-500' }
    }

    const FogueoCard = ({ f }: { f: any }) => {
        const status = statusBadge(f)
        const isOrganizer = f.club_id === club.id
        return (
            <div className="flex items-center gap-3 py-3 border-b border-[#13131f] last:border-0">
                <div className="w-10 h-10 rounded-xl bg-[#13132a] flex items-center justify-center text-lg flex-shrink-0">
                    {(f.clubs as any)?.logo_url
                        ? <img src={(f.clubs as any).logo_url} alt="" className="w-full h-full rounded-xl object-cover" />
                        : '🥋'}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-medium text-white">{f.name}</div>
                        {isOrganizer && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400">Organizador</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                        {(f.clubs as any)?.name} · {new Date(f.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })} · {f.start_time?.slice(0, 5)} · {f.location}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.style}`}>{status.label}</span>
                    <Link
                        href={`/dashboard/tournaments/fogueos/${f.id}`}
                        className="text-xs text-blue-400 hover:text-blue-300 transition px-2 py-1 rounded-lg hover:bg-blue-900/20"
                    >
                        {isOrganizer ? 'Gestionar →' : 'Ver →'}
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-[#07070f] text-white">
            <Sidebar userEmail={user.email ?? ''} />
            <main className="flex-1 p-6">
                <div className="max-w-5xl mx-auto">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                                <Link href="/dashboard/tournaments" className="hover:text-white transition">Torneos</Link>
                                <span>›</span>
                                <span className="text-white">Fogueos</span>
                            </div>
                            <h1 className="text-2xl font-bold">
                                <span className="text-blue-500">TKD</span> — Fogueos / Sparrings
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">Encuentros de práctica entre clubes</p>
                        </div>
                        <Link href="/dashboard/tournaments/fogueos/new" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">
                            + Crear fogueo
                        </Link>
                    </div>

                    {/* Mis fogueos */}
                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5 mb-4">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Mis fogueos</div>
                        {myFogueos.length > 0 ? (
                            myFogueos.map(f => <FogueoCard key={f.id} f={f} />)
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-gray-500 text-sm mb-3">No has creado fogueos aún</p>
                                <Link href="/dashboard/tournaments/fogueos/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm transition">
                                    Crear primer fogueo
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Fogueos de otros clubes */}
                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">
                            Fogueos disponibles ({otherFogueos.length})
                        </div>
                        {otherFogueos.length > 0 ? (
                            otherFogueos.map(f => <FogueoCard key={f.id} f={f} />)
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-gray-500 text-sm">No hay fogueos disponibles de otros clubes</p>
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    )
}