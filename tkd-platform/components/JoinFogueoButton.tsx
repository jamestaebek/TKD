'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
    fogueoId: string
    clubId: string
}

export default function JoinFogueoButton({ fogueoId, clubId }: Props) {
    const supabase = createClient()
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleJoin = async () => {
        setLoading(true)
        try {
            const { error } = await supabase.from('fogueo_clubs').insert({
                fogueo_id: fogueoId,
                club_id: clubId,
                status: 'confirmed',
            })
            if (error) {
                console.error('Error joining:', error)
                alert('Error al unirse. Intenta de nuevo.')
            } else {
                router.refresh()
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm transition disabled:opacity-40 cursor-pointer"
        >
            {loading ? 'Uniéndose...' : 'Unirme a este fogueo'}
        </button>
    )
}