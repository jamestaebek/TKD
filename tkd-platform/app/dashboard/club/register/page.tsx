'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import PhoneInput from '@/components/PhoneInput'
import CountrySelect from '@/components/CountrySelect'

interface FormData {
    name: string
    country: string
    city: string
    address: string
    phone: string
    email: string
    instagram: string
    facebook: string
    website: string
    registration_number: string
    logo_url: string
    coach_name: string
    coach_email: string
    coach_phone: string
    coach_birth_date: string
    legal_rep_name: string
    legal_rep_email: string
    legal_rep_phone: string
}

interface Errors {
    [key: string]: string
}

interface FieldProps {
    label: string
    field: keyof FormData
    type?: string
    placeholder?: string
    form: FormData
    errors: Errors
    update: (field: string, value: string) => void
}

function Field({ label, field, type = 'text', placeholder, form, errors, update }: FieldProps) {
    return (
        <div>
            <label className="text-sm text-gray-400 mb-1 block">{label}</label>
            <input
                type={type}
                className={`w-full bg-gray-900 border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors[field] ? 'border-red-500 focus:border-red-400' : 'border-gray-700 focus:border-blue-500'
                    }`}
                placeholder={placeholder}
                value={form[field]}
                onChange={e => {
                    const val = field === 'coach_name' || field === 'legal_rep_name' || field === 'name'
                        ? e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')
                        : e.target.value
                    update(field, val)
                }}
            />
            {errors[field] && <p className="text-red-400 text-xs mt-1">{errors[field]}</p>}
        </div>
    )
}

export default function RegisterClubPage() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [step, setStep] = useState(1)
    const [errors, setErrors] = useState<Errors>({})

    const [form, setForm] = useState<FormData>({
        name: '', country: 'Colombia', city: '', address: '',
        phone: '', email: '', instagram: '', facebook: '',
        website: '', registration_number: '', logo_url: '',
        coach_name: '', coach_email: '', coach_phone: '', coach_birth_date: '',
        legal_rep_name: '', legal_rep_email: '', legal_rep_phone: '',
    })

    const update = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
        setErrors(prev => ({ ...prev, [field]: '' }))
    }

    const validateEmail = (email: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

    const validateStep1 = () => {
        const e: Errors = {}
        if (!form.name.trim()) e.name = 'El nombre del club es obligatorio'
        if (!form.country) e.country = 'Selecciona un país'
        if (!form.city.trim()) e.city = 'La ciudad es obligatoria'
        if (!form.address.trim()) e.address = 'La dirección es obligatoria'
        if (!form.phone.trim()) e.phone = 'El teléfono es obligatorio'
        if (!form.email.trim()) e.email = 'El correo es obligatorio'
        else if (!validateEmail(form.email)) e.email = 'Ingresa un correo válido'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const validateStep2 = () => {
        const e: Errors = {}
        if (!form.coach_name.trim()) e.coach_name = 'El nombre del entrenador es obligatorio'
        if (!form.coach_email.trim()) e.coach_email = 'El correo es obligatorio'
        else if (!validateEmail(form.coach_email)) e.coach_email = 'Ingresa un correo válido'
        if (!form.coach_birth_date) e.coach_birth_date = 'La fecha de nacimiento es obligatoria'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const { data: { user } } = await supabase.auth.getUser()
        const ext = file.name.split('.').pop()
        const path = `logos/${user?.id}.${ext}`
        const { error } = await supabase.storage
            .from('club-assets')
            .upload(path, file, { upsert: true })
        if (!error) {
            const { data } = supabase.storage.from('club-assets').getPublicUrl(path)
            update('logo_url', data.publicUrl)
        }
        setUploading(false)
    }

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

    const fieldProps = { form, errors, update }

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
                            className={`flex-1 py-2 text-center text-sm rounded-lg font-medium transition ${step === i + 1 ? 'bg-blue-600 text-white'
                                : step > i + 1 ? 'bg-green-700 text-white cursor-pointer'
                                    : 'bg-gray-800 text-gray-400'
                                }`}
                            onClick={() => step > i + 1 && setStep(i + 1)}
                        >
                            {step > i + 1 ? '✓ ' : ''}{s}
                        </div>
                    ))}
                </div>

                {/* Step 1 */}
                {step === 1 && (
                    <div className="space-y-4">
                        {/* Logo */}
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Logo del club (opcional)</label>
                            <div className="flex items-center gap-4">
                                {form.logo_url && (
                                    <img src={form.logo_url} alt="Logo" className="w-16 h-16 rounded-xl object-cover" />
                                )}
                                <label className="cursor-pointer bg-gray-900 border border-dashed border-gray-700 rounded-xl px-4 py-3 text-gray-400 hover:border-blue-500 hover:text-blue-400 transition text-sm">
                                    {uploading ? 'Subiendo...' : '+ Seleccionar imagen'}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                </label>
                            </div>
                        </div>

                        <Field label="Nombre del club *" field="name" placeholder="Club Taekwondo..." {...fieldProps} />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">País *</label>
                                <CountrySelect value={form.country} onChange={v => update('country', v)} />
                                {errors.country && <p className="text-red-400 text-xs mt-1">{errors.country}</p>}
                            </div>
                            <Field label="Ciudad *" field="city" placeholder="Bogotá" {...fieldProps} />
                        </div>

                        <Field label="Dirección *" field="address" placeholder="Calle 123..." {...fieldProps} />

                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Teléfono *</label>
                            <PhoneInput value={form.phone} onChange={v => update('phone', v)} />
                            {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                        </div>

                        <Field label="Correo del club *" field="email" type="email" placeholder="club@email.com" {...fieldProps} />
                        <Field label="Sitio web" field="website" placeholder="https://miclub.com" {...fieldProps} />

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Instagram" field="instagram" placeholder="@club" {...fieldProps} />
                            <Field label="Facebook" field="facebook" placeholder="facebook.com/club" {...fieldProps} />
                        </div>

                        <Field label="Registro oficial (opcional)" field="registration_number" placeholder="Número de registro" {...fieldProps} />

                        <button
                            onClick={() => validateStep1() && setStep(2)}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition mt-4"
                        >
                            Siguiente →
                        </button>
                    </div>
                )}

                {/* Step 2 */}
                {step === 2 && (
                    <div className="space-y-4">
                        <Field label="Nombre completo del entrenador *" field="coach_name" placeholder="Juan Pérez" {...fieldProps} />
                        <Field label="Correo del entrenador *" field="coach_email" type="email" placeholder="entrenador@email.com" {...fieldProps} />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Teléfono</label>
                                <PhoneInput value={form.coach_phone} onChange={v => update('coach_phone', v)} />
                            </div>
                            <Field label="Fecha de nacimiento *" field="coach_birth_date" type="date" {...fieldProps} />
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setStep(1)} className="flex-1 bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-700 transition">
                                ← Atrás
                            </button>
                            <button
                                onClick={() => validateStep2() && setStep(3)}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3 */}
                {step === 3 && (
                    <div className="space-y-4">
                        <p className="text-gray-400 text-sm bg-gray-900 p-4 rounded-xl">
                            El representante legal es opcional. Si el entrenador es también el representante, puedes omitir este paso.
                        </p>
                        <Field label="Nombre del representante legal" field="legal_rep_name" placeholder="María García" {...fieldProps} />
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Correo" field="legal_rep_email" type="email" placeholder="rep@email.com" {...fieldProps} />
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Teléfono</label>
                                <PhoneInput value={form.legal_rep_phone} onChange={v => update('legal_rep_phone', v)} />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setStep(2)} className="flex-1 bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-700 transition">
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