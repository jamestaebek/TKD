'use client'

import { useState, useEffect } from 'react'
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

interface Errors { [key: string]: string }

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
                className={`w-full bg-gray-900 border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors[field] ? 'border-red-500' : 'border-gray-700 focus:border-blue-500'
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

export default function EditClubPage() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [saved, setSaved] = useState(false)
    const [clubId, setClubId] = useState<string>('')
    const [errors, setErrors] = useState<Errors>({})

    const [form, setForm] = useState<FormData>({
        name: '', country: '', city: '', address: '',
        phone: '', email: '', instagram: '', facebook: '',
        website: '', registration_number: '', logo_url: '',
        coach_name: '', coach_email: '', coach_phone: '', coach_birth_date: '',
        legal_rep_name: '', legal_rep_email: '', legal_rep_phone: '',
    })

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: club } = await supabase
                .from('clubs').select('*').eq('user_id', user.id).single()
            if (club) {
                setClubId(club.id)
                setForm({
                    name: club.name ?? '',
                    country: club.country ?? '',
                    city: club.city ?? '',
                    address: club.address ?? '',
                    phone: club.phone ?? '',
                    email: club.email ?? '',
                    instagram: club.instagram ?? '',
                    facebook: club.facebook ?? '',
                    website: club.website ?? '',
                    registration_number: club.registration_number ?? '',
                    logo_url: club.logo_url ?? '',
                    coach_name: club.coach_name ?? '',
                    coach_email: club.coach_email ?? '',
                    coach_phone: club.coach_phone ?? '',
                    coach_birth_date: club.coach_birth_date ?? '',
                    legal_rep_name: club.legal_rep_name ?? '',
                    legal_rep_email: club.legal_rep_email ?? '',
                    legal_rep_phone: club.legal_rep_phone ?? '',
                })
            }
        }
        load()
    }, [])

    const update = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
        setErrors(prev => ({ ...prev, [field]: '' }))
        setSaved(false)
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const { data: { user } } = await supabase.auth.getUser()
        const ext = file.name.split('.').pop()
        const path = `logos/${user?.id}.${ext}`
        const { error } = await supabase.storage
            .from('club-assets').upload(path, file, { upsert: true })
        if (!error) {
            const { data } = supabase.storage.from('club-assets').getPublicUrl(path)
            update('logo_url', data.publicUrl)
        }
        setUploading(false)
    }

    const handleSave = async () => {
        setLoading(true)
        const { error } = await supabase
            .from('clubs').update({ ...form, updated_at: new Date().toISOString() })
            .eq('id', clubId)
        if (!error) setSaved(true)
        setLoading(false)
    }

    const fieldProps = { form, errors, update }

    return (
        <main className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition">
                        ← Volver
                    </button>
                    <h1 className="text-2xl font-bold">
                        <span className="text-blue-500">TKD</span> — Editar club
                    </h1>
                </div>

                <div className="space-y-6">
                    {/* Logo */}
                    <div className="bg-gray-900 rounded-2xl p-6">
                        <h2 className="font-semibold mb-4">Logo del club</h2>
                        <div className="flex items-center gap-4">
                            {form.logo_url ? (
                                <img src={form.logo_url} alt="Logo" className="w-20 h-20 rounded-xl object-cover border border-gray-700" />
                            ) : (
                                <div className="w-20 h-20 rounded-xl bg-gray-800 flex items-center justify-center text-3xl">🥋</div>
                            )}
                            <label className="cursor-pointer bg-gray-800 border border-dashed border-gray-600 rounded-xl px-4 py-3 text-gray-400 hover:border-blue-500 hover:text-blue-400 transition text-sm">
                                {uploading ? 'Subiendo...' : '+ Cambiar logo'}
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </label>
                        </div>
                    </div>

                    {/* Info del club */}
                    <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
                        <h2 className="font-semibold">Información del club</h2>
                        <Field label="Nombre del club *" field="name" placeholder="Club Taekwondo..." {...fieldProps} />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">País *</label>
                                <CountrySelect value={form.country} onChange={v => update('country', v)} />
                            </div>
                            <Field label="Ciudad *" field="city" placeholder="Bogotá" {...fieldProps} />
                        </div>
                        <Field label="Dirección *" field="address" placeholder="Calle 123..." {...fieldProps} />
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Teléfono *</label>
                            <PhoneInput value={form.phone} onChange={v => update('phone', v)} />
                        </div>
                        <Field label="Correo del club *" field="email" type="email" placeholder="club@email.com" {...fieldProps} />
                        <Field label="Sitio web" field="website" placeholder="https://miclub.com" {...fieldProps} />
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Instagram" field="instagram" placeholder="@club" {...fieldProps} />
                            <Field label="Facebook" field="facebook" placeholder="facebook.com/club" {...fieldProps} />
                        </div>
                        <Field label="Registro oficial (opcional)" field="registration_number" placeholder="Número de registro" {...fieldProps} />
                    </div>

                    {/* Entrenador */}
                    <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
                        <h2 className="font-semibold">Entrenador</h2>
                        <Field label="Nombre completo *" field="coach_name" placeholder="Juan Pérez" {...fieldProps} />
                        <Field label="Correo *" field="coach_email" type="email" placeholder="entrenador@email.com" {...fieldProps} />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Teléfono</label>
                                <PhoneInput value={form.coach_phone} onChange={v => update('coach_phone', v)} />
                            </div>
                            <Field label="Fecha de nacimiento *" field="coach_birth_date" type="date" {...fieldProps} />
                        </div>
                    </div>

                    {/* Representante legal */}
                    <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
                        <h2 className="font-semibold">Representante legal <span className="text-gray-500 text-sm font-normal">(opcional)</span></h2>
                        <Field label="Nombre" field="legal_rep_name" placeholder="María García" {...fieldProps} />
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Correo" field="legal_rep_email" type="email" placeholder="rep@email.com" {...fieldProps} />
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Teléfono</label>
                                <PhoneInput value={form.legal_rep_phone} onChange={v => update('legal_rep_phone', v)} />
                            </div>
                        </div>
                    </div>

                    {/* Guardar */}
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-semibold text-lg transition ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                            } disabled:opacity-40`}
                    >
                        {loading ? 'Guardando...' : saved ? '✓ Cambios guardados' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </main>
    )
}