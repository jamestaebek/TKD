'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
    const supabase = createClient()
    const router = useRouter()

    const logout = async () => {
        await supabase.auth.signOut()
        router.push('/')
    }

    return (
        <button
            onClick={logout}
            className="text-sm text-red-400 hover:text-red-300 transition"
        >
            Cerrar sesión
        </button>
    )
}