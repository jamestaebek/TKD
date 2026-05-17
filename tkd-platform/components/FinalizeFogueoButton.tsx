'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
    fogueoId: string
    fogueoName: string
}

export default function FinalizeFogueoButton({ fogueoId }: Props) {
    const supabase = createClient()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [confirm, setConfirm] = useState(false)

    const handleFinalize = async () => {
        if (!confirm) {
            setConfirm(true)
            return
        }
        setLoading(true)
        await supabase
            .from('fogueos')
            .update({ status: 'finished' })
            .eq('id', fogueoId)
        router.refresh()
        setLoading(false)
        setConfirm(false)
    }

    return (
        <button
            onClick={handleFinalize}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${confirm
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-[#0d0d1a] border border-[#1e1e2e] text-gray-400 hover:border-red-500 hover:text-red-400'
                }`}
        >
            {loading
                ? 'Finalizando...'
                : confirm
                    ? '¿Confirmar finalizar?'
                    : 'Finalizar fogueo'}
        </button>
    )
}
