import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function ResultsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    return (
        <div className="flex min-h-screen bg-[#07070f] text-white">
            <Sidebar userEmail={user.email ?? ''} />
            <main className="flex-1 p-6">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold">
                            <span className="text-blue-500">TKD</span> — Resultados
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Historial de resultados de fogueos</p>
                    </div>

                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                        <div className="text-4xl mb-4">🏆</div>
                        <h2 className="text-lg font-semibold text-white mb-2">Próximamente</h2>
                        <p className="text-gray-500 text-sm max-w-sm">
                            Los resultados de los fogueos estarán disponibles aquí.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
