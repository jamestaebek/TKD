'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function RegisterClubPage() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState(1)

    const [form, setForm] = useState({
        // Info club
        name: '',
        registration_number: '',
        country: 'Colombia',
        state: '',
        city: '',
        address: '',
        phone: '',
        email: '',
        whatsapp: '',
        instagram: '',
        facebook: '',
        website: '',
        // Entrenador
        coach_name: '',
        coach_email: '',
        coach_phone: '',
        coach_birth_date: '',
        // Representante legal
        legal_rep_name: '',
        legal_rep_email: '',
        legal_rep_phone: '',
    })

    const update = (field: string, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }))

    const handleSubmit = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('clubs').insert({
            ...form,
            user_id: user.id,
            status: 'pending',
        })

        if (!error) router.push('/dashboard')
        setLoading(false)
    }

    return (
        <main className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold mb-2">
                    <span className="text-blue-500">TKD</span> — Registro del club
                </h1>

                {/* Steps */}
                <div className="flex gap-2 mb-8 mt-4">
                    {['Info del club', 'Entrenador', 'Representante'].map((s, i) => (
                        <div
                            key={i}
                            className={`flex-1 py-2 text-center text-sm rounded-lg font-medium cursor-pointer transition ${step === i + 1
                                    ? 'bg-blue-600 text-white'
                                    : step > i + 1
                                        ? 'bg-green-700 text-white'
                                        : 'bg-gray-800 text-gray-400'
                                }`}
                            onClick={() => step > i + 1 && setStep(i + 1)}
                        >
                            {step > i + 1 ? '✓ ' : ''}{s}
                        </div>
                    ))}
                </div>

                {/* Step 1 — Info del club */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Nombre del club *</label>
                            <input
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                placeholder="Club Taekwondo..."
                                value={form.name}
                                onChange={e => update('name', e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">País *</label>
                                <input
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    value={form.country}
                                    onChange={e => update('country', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Departamento *</label>
                                <input
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Cundinamarca"
                                    value={form.state}
                                    onChange={e => update('state', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Ciudad *</label>
                                <input
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Bogotá"
                                    value={form.city}
                                    onChange={e => update('city', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Teléfono *</label>
                                <input
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="+57 300..."
                                    value={form.phone}
                                    onChange={e => update('phone', e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Dirección *</label>
                            <input
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                placeholder="Calle 123..."
                                value={form.address}
                                onChange={e => update('address', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Correo del club *</label>
                            <input
                                type="email"
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                placeholder="club@email.com"
                                value={form.email}
                                onChange={e => update('email', e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">WhatsApp</label>
                                <input
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="+57 300..."
                                    value={form.whatsapp}
                                    onChange={e => update('whatsapp', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Instagram</label>
                                <input
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="@club"
                                    value={form.instagram}
                                    onChange={e => update('instagram', e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Registro oficial (opcional)</label>
                            <input
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                placeholder="Número de registro"
                                value={form.registration_number}
                                onChange={e => update('registration_number', e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => setStep(2)}
                            disabled={!form.name || !form.city || !form.phone || !form.email || !form.address}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed mt-4"
                        >
                            Siguiente →
                        </button>
                    </div>
                )}

                {/* Step 2 — Entrenador */}
                {step === 2 && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Nombre completo del entrenador *</label>
                            <input
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                placeholder="Juan Pérez"
                                value={form.coach_name}
                                onChange={e => update('coach_name', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Correo del entrenador *</label>
                            <input
                                type="email"
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                placeholder="entrenador@email.com"
                                value={form.coach_email}
                                onChange={e => update('coach_email', e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Teléfono</label>
                                <input
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="+57 300..."
                                    value={form.coach_phone}
                                    onChange={e => update('coach_phone', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Fecha de nacimiento *</label>
                                <input
                                    type="date"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    value={form.coach_birth_date}
                                    onChange={e => update('coach_birth_date', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-700 transition"
                            >
                                ← Atrás
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                disabled={!form.coach_name || !form.coach_email || !form.coach_birth_date}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3 — Representante legal */}
                {step === 3 && (
                    <div className="space-y-4">
                        <p className="text-gray-400 text-sm bg-gray-900 p-4 rounded-xl">
                            El representante legal es opcional. Si el entrenador es también el representante, puedes omitir este paso.
                        </p>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Nombre del representante legal</label>
                            <input
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                placeholder="María García"
                                value={form.legal_rep_name}
                                onChange={e => update('legal_rep_name', e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Correo</label>
                                <input
                                    type="email"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="rep@email.com"
                                    value={form.legal_rep_email}
                                    onChange={e => update('legal_rep_email', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Teléfono</label>
                                <input
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="+57 300..."
                                    value={form.legal_rep_phone}
                                    onChange={e => update('legal_rep_phone', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setStep(2)}
                                className="flex-1 bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-700 transition"
                            >
                                ← Atrás
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-40"
                            >
                                {loading ? 'Guardando...' : 'Registrar club ✓'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    )
}