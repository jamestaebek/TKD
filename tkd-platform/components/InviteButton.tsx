'use client'

import { useState } from 'react'

interface Props {
    token: string
}

export default function InviteButton({ token }: Props) {
    const [copied, setCopied] = useState(false)

    const copyLink = async () => {
        const url = `${window.location.origin}/register/athlete/${token}`
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
    }

    return (
        <button
            onClick={copyLink}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${copied
                    ? 'bg-green-600 text-white'
                    : 'bg-[#0d0d1a] border border-[#1e1e2e] text-gray-300 hover:border-blue-500 hover:text-blue-400'
                }`}
        >
            {copied ? (
                <>✓ Link copiado!</>
            ) : (
                <>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                    Copiar link de registro
                </>
            )}
        </button>
    )
}