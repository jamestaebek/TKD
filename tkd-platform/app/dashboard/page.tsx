import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/auth/login')

    const { data: club } = await supabase
        .from('clubs')
        .select('*')
        .eq('user_id', user.id)
        .single()

    if (!club) redirect('/dashboard/club/register')

    const { count: athleteCount } = await supabase
        .from('athletes')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', club.id)

    return (
        <main className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        {club.logo_url ? (
                            <img
                                src={club.logo_url}
                                alt="Logo"
                                className="w-16 h-16 rounded-xl object-cover border border-gray-700"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-xl bg-gray-800 flex items-center justify-center text-2xl">
                                🥋
                            </div>
                        )}
                        <div>
                            <h1 className="text-3xl font-bold">
                                <span className="text-blue-500">TKD</span> Dashboard
                            </h1>
                            <p className="text-gray-400 text-sm mt-1">{club.name}</p>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                        <p className="text-gray-400 text-sm">{user.email}</p>
                        <p className="text-gray-500 text-xs">{club.city}, {club.country}</p>
                        <LogoutButton />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gray-900 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm mb-1">Atletas</p>
                        <p className="text-3xl font-bold text-blue-400">{athleteCount ?? 0}</p>
                    </div>
                    <div className="bg-gray-900 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm mb-1">Torneos</p>
                        <p className="text-3xl font-bold text-purple-400">0</p>
                    </div>
                    <div className="bg-gray-900 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm mb-1">Inscritos</p>
                        <p className="text-3xl font-bold text-amber-400">0</p>
                    </div>
                    <div className="bg-gray-900 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm mb-1">Medallas</p>
                        <p className="text-3xl font-bold text-green-400">0</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <Link href="/dashboard/athletes/new" className="bg-blue-600 hover:bg-blue-700 transition rounded-2xl p-6 text-center">
                        <div className="text-3xl mb-2">🥋</div>
                        <h3 className="font-semibold text-lg">Registrar atleta</h3>
                        <p className="text-blue-200 text-sm mt-1">Agrega un deportista al club</p>
                    </Link>
                    <Link href="/dashboard/athletes" className="bg-gray-900 hover:bg-gray-800 transition rounded-2xl p-6 text-center">
                        <div className="text-3xl mb-2">👥</div>
                        <h3 className="font-semibold text-lg">Ver atletas</h3>
                        <p className="text-gray-400 text-sm mt-1">{athleteCount ?? 0} registrados</p>
                    </Link>
                    <Link href="/dashboard/club/edit" className="bg-gray-900 hover:bg-gray-800 transition rounded-2xl p-6 text-center">
                        <div className="text-3xl mb-2">⚙️</div>
                        <h3 className="font-semibold text-lg">Mi club</h3>
                        <p className="text-gray-400 text-sm mt-1">Editar información</p>
                    </Link>
                </div>

                {/* Club info */}
                <div className="bg-gray-900 rounded-2xl p-6">
                    <h2 className="font-semibold text-lg mb-4">Información del club</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-400">Entrenador</p>
                            <p className="font-medium">{club.coach_name}</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Correo entrenador</p>
                            <p className="font-medium">{club.coach_email}</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Teléfono</p>
                            <p className="font-medium">{club.phone}</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Dirección</p>
                            <p className="font-medium">{club.address}</p>
                        </div>
                    </div>
                </div>

            </div>
        </main>
    )
}