import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/auth/login')

    return (
        <main className="min-h-screen bg-gray-950 text-white p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold">
                        <span className="text-blue-500">TKD</span> Dashboard
                    </h1>
                    <p className="text-gray-400">Bienvenido, {user.email}</p>
                </div>
                <div className="bg-gray-900 rounded-2xl p-8 text-center">
                    <div className="text-5xl mb-4">🥋</div>
                    <h2 className="text-xl font-semibold mb-2">Tu club aún no está registrado</h2>
                    <p className="text-gray-400 mb-6">Completa el registro de tu club para empezar</p>
                    <a href="/dashboard/club/register" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition">
                        Registrar mi club
                    </a>
                </div>
            </div>
        </main>
    )
}