'use client'

import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
    id: string
    type: ToastType
    message: string
}

const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
}

const colors: Record<ToastType, string> = {
    success: 'bg-green-900/90 border-green-700 text-green-100',
    error: 'bg-red-900/90 border-red-700 text-red-100',
    warning: 'bg-yellow-900/90 border-yellow-700 text-yellow-100',
    info: 'bg-blue-900/90 border-blue-700 text-blue-100',
}

const iconColors: Record<ToastType, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-yellow-600',
    info: 'bg-blue-600',
}

interface Props {
    toasts: ToastMessage[]
    onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: Props) {
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    )
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        setTimeout(() => setVisible(true), 10)
        const timer = setTimeout(() => {
            setVisible(false)
            setTimeout(() => onRemove(toast.id), 300)
        }, 4000)
        return () => clearTimeout(timer)
    }, [toast.id, onRemove])

    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm transition-all duration-300 ${colors[toast.type]} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${iconColors[toast.type]}`}>
                {icons[toast.type]}
            </div>
            <p className="text-sm flex-1">{toast.message}</p>
            <button
                onClick={() => onRemove(toast.id)}
                className="text-xs opacity-60 hover:opacity-100 transition flex-shrink-0"
            >
                ✕
            </button>
        </div>
    )
}