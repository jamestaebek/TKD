import { useState, useCallback } from 'react'
import { ToastMessage, ToastType } from '@/components/Toast'

export function useToast() {
    const [toasts, setToasts] = useState<ToastMessage[]>([])

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = `${Date.now()}-${Math.random()}`
        setToasts(prev => [...prev, { id, type, message }])
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const toast = {
        success: (msg: string) => addToast(msg, 'success'),
        error: (msg: string) => addToast(msg, 'error'),
        warning: (msg: string) => addToast(msg, 'warning'),
        info: (msg: string) => addToast(msg, 'info'),
    }

    return { toasts, removeToast, toast }
}