'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PhoneInput from '@/components/PhoneInput'
import CountrySelect from '@/components/CountrySelect'
import { calculateAge, getAgeGroup } from '@/lib/utils/age'

interface FormData {
    first_name: string
    last_name: string
    birth_date: string
    gender: string
    nationality: string
    doc_type: string
    doc_number: string
    doc_country: string
    email: string
    phone: string
    guardian_name: string
    guardian_phone: string
    belt_id: string
    training_weight: string
    photo_url: string
}

interface Errors { [key: string]: string }

interface BeltLevel {
    id: number
    name: string
    kup: string | null
    dan: number | null
    default_level: string
    can_upgrade_to: string | null
}

interface FieldProps {
    label: string
    field: keyof FormData
    type?: string
    placeholder?: string
    form: FormData
    errors: Errors
    update: (field: string, value: string) => void
    onlyLetters?: boolean
    onlyNumbers?: boolean
}

function Field({ label, field, type = 'text', placeholder, form, errors, update, onlyLetters, onlyNumbers }: FieldProps) {
    return (
        <div>
            <label className="text-sm text-gray-400 mb-1 block">{label}</label>
            <input
                type={type}
                className={`w-full bg-[#0d0d1a] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors[field] ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                    }`}
                placeholder={placeholder}
                value={form[field]}
                onChange={e => {
                    let val = e.target.value
                    if (onlyLetters) val = val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')
                    if (onlyNumbers) val = val.replace(/[^0-9]/g, '')
                    update(field, val)
                }}
            />
            {errors[field] && <p className="text-red-400 text-xs mt-1">{errors[field]}</p>}
        </div>
    )
}


function getLevel(beltId: string, belts: BeltLevel[]): string {
    const belt = belts.find(b => b.id === parseInt(beltId))
    if (!belt) return ''
    return belt.default_level
}

export default function EditAthletePage() {
    const router = useRouter()
    const params = useParams()
    const athleteId = params.id as string
    const supabase = useMemo(() => createClient(), [])
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [saved, setSaved] = useState(false)
    const [belts, setBelts] = useState<BeltLevel[]>([])
    const [userEmail, setUserEmail] = useState('')
    const [clubId, setClubId] = useState('')
    const [errors, setErrors] = useState<Errors>({})

    const [form, setForm] = useState<FormData>({
        first_name: '', last_name: '', birth_date: '', gender: '',
        nationality: '', doc_type: '', doc_number: '', doc_country: 'CO',
        email: '', phone: '', guardian_name: '', guardian_phone: '',
        belt_id: '', training_weight: '', photo_url: '',
    })

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserEmail(user.email ?? '')

            const { data: club } = await supabase
                .from('clubs').select('id').eq('user_id', user.id).single()
            if (!club) return
            setClubId(club.id)

            const { data: beltData } = await supabase
                .from('belt_levels').select('*').order('sort_order')
            if (beltData) setBelts(beltData)

            const { data: athlete } = await supabase
                .from('athletes').select('*').eq('id', athleteId).eq('club_id', club.id).single()
            if (athlete) {
                setForm({
                    first_name: athlete.first_name ?? '',
                    last_name: athlete.last_name ?? '',
                    birth_date: athlete.birth_date ?? '',
                    gender: athlete.gender ?? '',
                    nationality: athlete.nationality ?? '',
                    doc_type: athlete.doc_type ?? '',
                    doc_number: athlete.doc_number ?? '',
                    doc_country: athlete.doc_country ?? 'CO',
                    email: athlete.email ?? '',
                    phone: athlete.phone ?? '',
                    guardian_name: athlete.guardian_name ?? '',
                    guardian_phone: athlete.guardian_phone ?? '',
                    belt_id: athlete.belt_id?.toString() ?? '',
                    training_weight: athlete.training_weight?.toString() ?? '',
                    photo_url: athlete.photo_url ?? '',
                })
            }
        }
        load()
    }, [athleteId])

    const update = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
        setErrors(prev => ({ ...prev, [field]: '' }))
        setSaved(false)
    }

    const age = calculateAge(form.birth_date)
    const ageGroup = getAgeGroup(age)
    const isMinor = age > 0 && age < 18
    const level = getLevel(form.belt_id, belts)

    const validate = () => {
        const e: Errors = {}
        if (!form.first_name.trim()) e.first_name = 'El nombre es obligatorio'
        if (!form.last_name.trim()) e.last_name = 'El apellido es obligatorio'
        if (!form.birth_date) e.birth_date = 'La fecha de nacimiento es obligatoria'
        if (!form.gender) e.gender = 'Selecciona el género'
        if (!form.doc_type) e.doc_type = 'Selecciona el tipo de documento'
        if (!form.doc_number.trim()) e.doc_number = 'El número de documento es obligatorio'
        if (!form.belt_id) e.belt_id = 'Selecciona el cinturón'
        if (!form.training_weight) e.training_weight = 'El peso es obligatorio'
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            e.email = 'Ingresa un correo válido'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const ext = file.name.split('.').pop()
        const path = `athletes/${clubId}/${athleteId}.${ext}`
        const { error } = await supabase.storage
            .from('club-assets').upload(path, file, { upsert: true })
        if (!error) {
            const { data } = supabase.storage.from('club-assets').getPublicUrl(path)
            update('photo_url', data.publicUrl)
        }
        setUploading(false)
    }

    const handleSave = async () => {
        if (!validate()) return
        setLoading(true)
        const { error } = await supabase.from('athletes').update({
            first_name: form.first_name,
            last_name: form.last_name,
            birth_date: form.birth_date,
            gender: form.gender,
            nationality: form.nationality,
            doc_type: form.doc_type,
            doc_number: form.doc_number,
            doc_country: form.doc_country,
            email: form.email || null,
            phone: form.phone || null,
            guardian_name: form.guardian_name || null,
            guardian_phone: form.guardian_phone || null,
            belt_id: form.belt_id ? parseInt(form.belt_id) : null,
            training_weight: form.training_weight ? parseFloat(form.training_weight) : null,
            photo_url: form.photo_url || null,
            updated_at: new Date().toISOString(),
        }).eq('id', athleteId).eq('club_id', clubId)
        if (!error) setSaved(true)
        setLoading(false)
    }

    const fieldProps = { form, errors, update }

    return (
        <div className="flex min-h-screen bg-[#07070f] text-white">
            <Sidebar userEmail={userEmail} />
            <main className="flex-1 p-6">
                <div className="max-w-2xl mx-auto">

                    <div className="flex items-center gap-3 mb-6">
                        <button
                            onClick={() => router.push('/dashboard/athletes')}
                            className="text-gray-500 hover:text-white transition text-sm"
                        >
                            ← Volver
                        </button>
                        <h1 className="text-2xl font-bold">
                            <span className="text-blue-500">TKD</span> — Editar atleta
                        </h1>
                    </div>

                    <div className="space-y-6">

                        {/* Foto */}
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                            <h2 className="text-sm font-medium text-gray-400 mb-4">Foto del atleta</h2>
                            <div className="flex items-center gap-4">
                                {form.photo_url ? (
                                    <img src={form.photo_url} alt="" className="w-20 h-20 rounded-xl object-cover border border-[#1e1e2e]" />
                                ) : (
                                    <div className="w-20 h-20 rounded-xl bg-[#13132a] border border-[#1e1e2e] flex items-center justify-center text-3xl">🥋</div>
                                )}
                                <label className="cursor-pointer bg-[#0d0d1a] border border-dashed border-[#2e2e3e] rounded-xl px-4 py-3 text-gray-500 hover:border-blue-500 hover:text-blue-400 transition text-sm">
                                    {uploading ? 'Subiendo...' : '+ Cambiar foto'}
                                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                </label>
                            </div>
                        </div>

                        {/* Datos personales */}
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5 space-y-4">
                            <h2 className="text-sm font-medium text-gray-400">Datos personales</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Nombre *" field="first_name" placeholder="Juan" onlyLetters {...fieldProps} />
                                <Field label="Apellido *" field="last_name" placeholder="Pérez" onlyLetters {...fieldProps} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-400 mb-1 block">Fecha de nacimiento *</label>
                                    <input
                                        type="date"
                                        className={`w-full bg-[#0d0d1a] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.birth_date ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                                            }`}
                                        value={form.birth_date}
                                        onChange={e => update('birth_date', e.target.value)}
                                    />
                                    {errors.birth_date && <p className="text-red-400 text-xs mt-1">{errors.birth_date}</p>}
                                    {form.birth_date && age >= 5 && (
                                        <p className="text-blue-400 text-xs mt-1">
                                            {age} años · <span className="font-medium">{ageGroup}</span>
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400 mb-1 block">Género *</label>
                                    <select
                                        className={`w-full bg-[#0d0d1a] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.gender ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                                            }`}
                                        value={form.gender}
                                        onChange={e => update('gender', e.target.value)}
                                    >
                                        <option value="">Seleccionar</option>
                                        <option value="M">Masculino</option>
                                        <option value="F">Femenino</option>
                                    </select>
                                    {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Nacionalidad *</label>
                                <CountrySelect value={form.nationality} onChange={v => update('nationality', v)} />
                            </div>
                        </div>

                        {/* Documento y deportivo */}
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5 space-y-4">
                            <h2 className="text-sm font-medium text-gray-400">Documento y deportivo</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-400 mb-1 block">Tipo de documento *</label>
                                    <select
                                        className={`w-full bg-[#0d0d1a] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.doc_type ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                                            }`}
                                        value={form.doc_type}
                                        onChange={e => update('doc_type', e.target.value)}
                                    >
                                        <option value="">Seleccionar</option>
                                        <option value="registro_civil">Registro Civil</option>
                                        <option value="tarjeta_identidad">Tarjeta de Identidad</option>
                                        <option value="cedula">Cédula de Ciudadanía</option>
                                        <option value="pasaporte">Pasaporte</option>
                                        <option value="id_extranjero">ID Extranjero</option>
                                    </select>
                                    {errors.doc_type && <p className="text-red-400 text-xs mt-1">{errors.doc_type}</p>}
                                </div>
                                <Field
                                    label="Número de documento *"
                                    field="doc_number"
                                    placeholder={form.doc_type === 'pasaporte' ? 'AB123456' : '1234567890'}
                                    onlyNumbers={form.doc_type !== 'pasaporte' && form.doc_type !== 'id_extranjero'}
                                    {...fieldProps}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Cinturón actual *</label>
                                <select
                                    className={`w-full bg-[#0d0d1a] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.belt_id ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                                        }`}
                                    value={form.belt_id}
                                    onChange={e => update('belt_id', e.target.value)}
                                >
                                    <option value="">Seleccionar cinturón</option>
                                    {belts.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.name} {b.kup ? `· ${b.kup}` : b.dan ? `· ${b.dan}er Dan` : ''}
                                        </option>
                                    ))}
                                </select>
                                {errors.belt_id && <p className="text-red-400 text-xs mt-1">{errors.belt_id}</p>}
                                {form.belt_id && (
                                    <p className="text-blue-400 text-xs mt-1">
                                        Nivel: <span className="font-medium capitalize">{level}</span>
                                        {belts.find(b => b.id === parseInt(form.belt_id))?.can_upgrade_to && (
                                            <span className="text-yellow-400 ml-2">
                                                {belts.find(b => b.id === parseInt(form.belt_id))?.name === 'Verde Franja Azul'
                                                    ? '· Puede competir en avanzados con autorización del entrenador'
                                                    : '· Puede competir en cinturones negros con autorización del entrenador'
                                                }
                                            </span>
                                        )}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Peso de entrenamiento (kg) *</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="20"
                                    max="150"
                                    className={`w-full bg-[#0d0d1a] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.training_weight ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                                        }`}
                                    placeholder="65.5"
                                    value={form.training_weight}
                                    onChange={e => update('training_weight', e.target.value)}
                                />
                                {errors.training_weight && <p className="text-red-400 text-xs mt-1">{errors.training_weight}</p>}
                            </div>
                            {form.birth_date && form.belt_id && form.training_weight && (
                                <div className="bg-[#0d1a0d] border border-green-900/40 rounded-xl p-4">
                                    <p className="text-xs text-green-400 font-medium mb-1">Categoría calculada:</p>
                                    <p className="text-sm text-white font-semibold">
                                        {level.charAt(0).toUpperCase() + level.slice(1)} · {ageGroup} · {form.training_weight}kg · {form.gender === 'M' ? 'Masculino' : 'Femenino'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Contacto */}
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5 space-y-4">
                            <h2 className="text-sm font-medium text-gray-400">Contacto</h2>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Correo electrónico</label>
                                <input
                                    type="email"
                                    className={`w-full bg-[#0d0d1a] border rounded-xl px-4 py-3 text-white focus:outline-none transition ${errors.email ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                                        }`}
                                    placeholder="atleta@email.com"
                                    value={form.email}
                                    onChange={e => {
                                        update('email', e.target.value)
                                        if (e.target.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) {
                                            setErrors(prev => ({ ...prev, email: 'Ingresa un correo válido' }))
                                        }
                                    }}
                                />
                                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Teléfono</label>
                                <PhoneInput value={form.phone} onChange={v => update('phone', v)} />
                            </div>
                            {isMinor && (
                                <div className="space-y-4 bg-[#0d0d1a] border border-yellow-900/40 rounded-xl p-4">
                                    <p className="text-xs text-yellow-400 font-medium">Menor de edad — datos del acudiente</p>
                                    <Field label="Nombre del acudiente" field="guardian_name" placeholder="María García" onlyLetters {...fieldProps} />
                                    <div>
                                        <label className="text-sm text-gray-400 mb-1 block">Teléfono del acudiente</label>
                                        <PhoneInput value={form.guardian_phone} onChange={v => update('guardian_phone', v)} />
                                    </div>
                                </div>
                            )}
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
        </div>
    )
}