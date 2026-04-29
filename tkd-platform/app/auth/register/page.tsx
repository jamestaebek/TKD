'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/Toast'

export default function RegisterPage() {
    const supabase = createClient()
    const router = useRouter()
    const { toasts, removeToast, toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const [form, setForm] = useState({
        email: '',
        password: '',
        confirmPassword: '',
    })

    const [errors, setErrors] = useState<Record<string, string>>({})

    const validate = () => {
        const e: Record<string, string> = {}
        if (!form.email.trim()) e.email = 'El correo es obligatorio'
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Correo inválido'
        if (!form.password) e.password = 'La contraseña es obligatoria'
        else if (form.password.length < 8) e.password = 'Mínimo 8 caracteres'
        else if (!/(?=.*[A-Z])/.test(form.password)) e.password = 'Debe tener al menos una mayúscula'
        else if (!/(?=.*[0-9])/.test(form.password)) e.password = 'Debe tener al menos un número'
        if (form.password !== form.confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleRegister = async () => {
        if (!validate()) return
        setLoading(true)
        try {
            const { error } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                }
            })
            if (error) {
                if (error.message.includes('already registered')) {
                    toast.error('Este correo ya está registrado. Inicia sesión.')
                } else {
                    toast.error(error.message)
                }
            } else {
                setSubmitted(true)
            }
        } catch {
            toast.error('Error de conexión. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    if (submitted) return (
        <main className="min-h-screen bg-[#07070f] flex items-center justify-center text-white p-6">
            <div className="text-center max-w-md">
                <div className="text-5xl mb-4">📧</div>
                <h1 className="text-2xl font-bold mb-2">Revisa tu correo</h1>
                <p className="text-gray-400 mb-2">
                    Enviamos un enlace de confirmación a <span className="text-white font-medium">{form.email}</span>
                </p>
                <p className="text-gray-500 text-sm">
                    Haz clic en el enlace para activar tu cuenta y acceder al dashboard.
                </p>
            </div>
        </main>
    )

    return (
        <>
            <main className="min-h-screen bg-[#07070f] flex items-center justify-center text-white p-6">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold">
                            <span className="text-blue-500">TKD</span> Platform
                        </h1>
                        <p className="text-gray-500 mt-2">Crea tu cuenta de club</p>
                    </div>

                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-6 space-y-4">
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Correo electrónico *</label>
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
                            />
                            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                        </div>

                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Contraseña *</label>
                            <input
                                type="password"
                                className={`w-full bg-[#07070f] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.password ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                                    }`}
                                placeholder="Mínimo 8 caracteres"
                                value={form.password}
                                onChange={e => {
                                    setForm(prev => ({ ...prev, password: e.target.value }))
                                    setErrors(prev => ({ ...prev, password: '' }))
                                }}
                            />
                            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                            <p className="text-gray-600 text-xs mt-1">Mínimo 8 caracteres, una mayúscula y un número</p>
                        </div>

                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Confirmar contraseña *</label>
                            <input
                                type="password"
                                className={`w-full bg-[#07070f] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.confirmPassword ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                                    }`}
                                placeholder="Repite la contraseña"
                                value={form.confirmPassword}
                                onChange={e => {
                                    setForm(prev => ({ ...prev, confirmPassword: e.target.value }))
                                    setErrors(prev => ({ ...prev, confirmPassword: '' }))
                                }}
                            />
                            {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
                        </div>

                        <button
                            onClick={handleRegister}
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-40 mt-2"
                        >
                            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                        </button>

                        <div className="relative my-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-[#1e1e2e]"></div>
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="bg-[#0d0d1a] px-3 text-gray-500">o</span>
                            </div>
                        </div>

                        <p className="text-center text-sm text-gray-500">
                            ¿Ya tienes cuenta?{' '}
                            <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 transition">
                                Inicia sesión
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </>
    )
}