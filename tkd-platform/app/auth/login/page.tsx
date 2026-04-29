'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/Toast'

export default function LoginPage() {
    const supabase = createClient()
    const router = useRouter()
    const { toasts, removeToast, toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ email: '', password: '' })
    const [errors, setErrors] = useState<Record<string, string>>({})

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
    }

    const validate = () => {
        const e: Record<string, string> = {}
        if (!form.email.trim()) e.email = 'El correo es obligatorio'
        if (!form.password) e.password = 'La contraseña es obligatoria'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleLogin = async () => {
        if (!validate()) return
        setLoading(true)
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: form.email,
                password: form.password,
            })
            if (error) {
                if (error.message.includes('Invalid login')) {
                    toast.error('Correo o contraseña incorrectos.')
                } else if (error.message.includes('Email not confirmed')) {
                    toast.error('Confirma tu correo antes de ingresar.')
                } else {
                    toast.error(error.message)
                }
            } else {
                router.push('/dashboard')
            }
        } catch {
            toast.error('Error de conexión. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <main className="min-h-screen bg-[#07070f] flex items-center justify-center text-white p-6">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold">
                            <span className="text-blue-500">TKD</span> Platform
                        </h1>
                        <p className="text-gray-500 mt-2">Bienvenido de vuelta</p>
                    </div>

                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-6 space-y-4">

                        {/* Google */}
                        <button
                            onClick={signInWithGoogle}
                            className="flex items-center justify-center gap-3 w-full bg-white text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Iniciar con Google
                        </button>

                        <div className="relative my-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-[#1e1e2e]"></div>
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="bg-[#0d0d1a] px-3 text-gray-500">o con tu correo</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Correo electrónico</label>
                            <input
                                type="email"
                                className={`w-full bg-[#07070f] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.email ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                                    }`}
                                placeholder="club@email.com"
                                value={form.email}
                                onChange={e => {
                                    setForm(prev => ({ ...prev, email: e.target.value }))
                                    setErrors(prev => ({ ...prev, email: '' }))
                                }}
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                            />
                            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                        </div>

                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Contraseña</label>
                            <input
                                type="password"
                                className={`w-full bg-[#07070f] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.password ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                                    }`}
                                placeholder="Tu contraseña"
                                value={form.password}
                                onChange={e => {
                                    setForm(prev => ({ ...prev, password: e.target.value }))
                                    setErrors(prev => ({ ...prev, password: '' }))
                                }}
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                            />
                            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                        </div>

                        <div className="flex justify-end">
                            <Link href="/auth/reset-password" className="text-xs text-gray-500 hover:text-blue-400 transition">
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>

                        <button
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-40"
                        >
                            {loading ? 'Ingresando...' : 'Iniciar sesión'}
                        </button>

                        <p className="text-center text-sm text-gray-500">
                            ¿No tienes cuenta?{' '}
                            <Link href="/auth/register" className="text-blue-400 hover:text-blue-300 transition">
                                Regístrate aquí
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </>
    )
}