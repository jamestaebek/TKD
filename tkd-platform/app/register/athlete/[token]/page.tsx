'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import PhoneInput from '@/components/PhoneInput'
import CountrySelect from '@/components/CountrySelect'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/Toast'
import { calculateAge, getAgeGroup } from '@/lib/utils/age'
import { Turnstile } from '@marsidev/react-turnstile'

interface Club {
    id: string
    name: string
    logo_url: string | null
    city: string
    country: string
    coach_name: string
}

interface BeltLevel {
    id: number
    name: string
    kup: string | null
    dan: number | null
    default_level: string
    can_upgrade_to: string | null
}

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
    return belt?.default_level ?? ''
}

export default function AthleteRegisterPage() {
    const params = useParams()
    const token = params.token as string
    const supabase = useMemo(() => createClient(), [])
    const { toasts, removeToast, toast } = useToast()

    const [club, setClub] = useState<Club | null>(null)
    const [belts, setBelts] = useState<BeltLevel[]>([])
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [notFound, setNotFound] = useState(false)
    const [errors, setErrors] = useState<Errors>({})
    const [captchaToken, setCaptchaToken] = useState<string | null>(null)

    const [form, setForm] = useState<FormData>({
        first_name: '', last_name: '', birth_date: '', gender: '',
        nationality: 'Colombia', doc_type: '', doc_number: '', doc_country: 'CO',
        email: '', phone: '', guardian_name: '', guardian_phone: '',
        belt_id: '', training_weight: '',
    })

    useEffect(() => {
        const load = async () => {
            const { data: clubData } = await supabase
                .from('clubs').select('id, name, logo_url, city, country, coach_name')
                .eq('invite_token', token).single()
            if (!clubData) { setNotFound(true); return }
            setClub(clubData)
            const { data: beltData } = await supabase
                .from('belt_levels').select('*').order('sort_order')
            if (beltData) setBelts(beltData)
        }
        load()
    }, [token])

    const update = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
        setErrors(prev => ({ ...prev, [field]: '' }))
    }

    const age = calculateAge(form.birth_date)
    const ageGroup = getAgeGroup(age)
    const isMinor = age > 0 && age < 18
    const level = getLevel(form.belt_id, belts)

    const validateStep1 = () => {
        const e: Errors = {}
        if (!form.first_name.trim()) e.first_name = 'El nombre es obligatorio'
        if (!form.last_name.trim()) e.last_name = 'El apellido es obligatorio'
        if (!form.birth_date) e.birth_date = 'La fecha de nacimiento es obligatoria'
        else if (age < 5) e.birth_date = 'Edad mínima 5 años'
        if (!form.gender) e.gender = 'Selecciona el género'
        if (!form.nationality.trim()) e.nationality = 'La nacionalidad es obligatoria'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const validateStep2 = () => {
        const e: Errors = {}
        if (!form.doc_type) e.doc_type = 'Selecciona el tipo de documento'
        if (!form.doc_number.trim()) e.doc_number = 'El número de documento es obligatorio'
        if (!form.belt_id) e.belt_id = 'Selecciona el cinturón'
        if (!form.training_weight) e.training_weight = 'El peso es obligatorio'
        else if (parseFloat(form.training_weight) < 20 || parseFloat(form.training_weight) > 150)
            e.training_weight = 'Peso debe ser entre 20 y 150 kg'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const validateStep3 = () => {
        const e: Errors = {}
        if (!form.email.trim()) e.email = 'El correo es obligatorio'
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Ingresa un correo válido'
        if (isMinor && !form.guardian_name.trim())
            e.guardian_name = 'El nombre del acudiente es obligatorio para menores'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const checkRateLimit = async (): Promise<boolean> => {
        try {
            const ipRes = await fetch('/api/get-ip')
            const ipData = await ipRes.json()
            const ip = ipData.ip ?? 'unknown'

            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

            const { count } = await supabase
                .from('invite_attempts')
                .select('*', { count: 'exact', head: true })
                .eq('ip_address', ip)
                .eq('was_successful', false)
                .gte('created_at', tenMinutesAgo)

            if ((count ?? 0) >= 10) {
                toast.error('Demasiados intentos fallidos. Espera 10 minutos e intenta de nuevo.')
                return false
            }
            return true
        } catch {
            return true
        }
    }

    const handleSubmit = async () => {
        if (!validateStep3()) return
        if (!club) return

        if (!captchaToken) {
            toast.error('Completa la verificación de seguridad.')
            return
        }

        // Verificar CAPTCHA en servidor
        try {
            const captchaRes = await fetch('/api/verify-captcha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: captchaToken }),
            })
            const captchaData = await captchaRes.json()
            if (!captchaData.success) {
                toast.error('Verificación de seguridad fallida. Intenta de nuevo.')
                setCaptchaToken(null)
                return
            }
        } catch {
            toast.error('Error al verificar seguridad. Intenta de nuevo.')
            return
        }

        // Verificar rate limit por IP
        const allowed = await checkRateLimit()
        if (!allowed) return

        setLoading(true)
        try {
            // Obtener IP para registrar en el intento
            let clientIp = 'unknown'
            try {
                const ipRes = await fetch('/api/get-ip')
                const ipData = await ipRes.json()
                clientIp = ipData.ip ?? 'unknown'
            } catch { /* silencioso */ }

            // Registrar intento con IP
            await supabase.from('invite_attempts').insert({
                invite_token: token,
                ip_address: clientIp,
                was_successful: false,
            })

            const { error } = await supabase.from('athletes').insert({
                club_id: club.id,
                first_name: form.first_name,
                last_name: form.last_name,
                birth_date: form.birth_date,
                gender: form.gender,
                nationality: form.nationality,
                doc_type: form.doc_type,
                doc_number: form.doc_number,
                doc_country: form.doc_country,
                email: form.email,
                phone: form.phone || null,
                guardian_name: form.guardian_name || null,
                guardian_phone: form.guardian_phone || null,
                belt_id: form.belt_id ? parseInt(form.belt_id) : null,
                training_weight: form.training_weight ? parseFloat(form.training_weight) : null,
                status: 'pending',
                registration_source: 'invite',
            })

            if (error) {
                if (error.code === '23505') {
                    toast.error('Este documento ya está registrado en este club.')
                } else {
                    toast.error('Error al enviar el registro. Intenta de nuevo.')
                }
            } else {
                // Marcar intento como exitoso
                await supabase
                    .from('invite_attempts')
                    .update({ was_successful: true })
                    .eq('invite_token', token)
                    .eq('ip_address', clientIp)
                    .eq('was_successful', false)
                setSubmitted(true)
            }
        } catch {
            toast.error('Error de conexión. Verifica tu internet e intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    const fieldProps = { form, errors, update }

    if (notFound) return (
        <main className="min-h-screen bg-[#07070f] flex items-center justify-center text-white">
            <div className="text-center">
                <div className="text-5xl mb-4">❌</div>
                <h1 className="text-xl font-bold mb-2">Link inválido</h1>
                <p className="text-gray-500">Este link de registro no es válido o ha expirado.</p>
            </div>
        </main>
    )

    if (!club) return (
        <main className="min-h-screen bg-[#07070f] flex items-center justify-center text-white">
            <div className="text-gray-500 text-sm">Cargando...</div>
        </main>
    )

    if (submitted) return (
        <main className="min-h-screen bg-[#07070f] flex items-center justify-center text-white p-6">
            <div className="text-center max-w-md">
                {club.logo_url && (
                    <img src={club.logo_url} alt="" className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 border border-[#1e1e2e]" />
                )}
                <div className="text-5xl mb-4">🎉</div>
                <h1 className="text-2xl font-bold mb-2">¡Registro enviado!</h1>
                <p className="text-gray-400 mb-2">
                    Tu solicitud fue enviada al club <span className="text-white font-medium">{club.name}</span>.
                </p>
                <p className="text-gray-500 text-sm">
                    El entrenador {club.coach_name} revisará tu información y te confirmará cuando estés aprobado.
                </p>
            </div>
        </main>
    )

    return (
        <>
            <main className="min-h-screen bg-[#07070f] text-white py-8 px-4">
                <div className="max-w-lg mx-auto">

                    <div className="flex items-center gap-4 mb-8 bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                        {club.logo_url ? (
                            <img src={club.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-[#1e1e2e]" />
                        ) : (
                            <div className="w-14 h-14 rounded-xl bg-[#13132a] flex items-center justify-center text-2xl">🥋</div>
                        )}
                        <div>
                            <h1 className="text-lg font-bold text-white">{club.name}</h1>
                            <p className="text-sm text-gray-500">{club.city}, {club.country}</p>
                            <p className="text-xs text-blue-400 mt-0.5">Entrenador: {club.coach_name}</p>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold mb-2">Registro de atleta</h2>
                    <p className="text-gray-500 text-sm mb-6">Completa tus datos para unirte al club</p>

                    <div className="flex gap-2 mb-8">
                        {['Datos personales', 'Deportivo', 'Contacto'].map((s, i) => (
                            <div key={i}
                                className={`flex-1 py-2 text-center text-xs rounded-lg font-medium transition ${step === i + 1 ? 'bg-blue-600 text-white'
                                        : step > i + 1 ? 'bg-green-800 text-white cursor-pointer'
                                            : 'bg-[#0d0d1a] text-gray-500 border border-[#1e1e2e]'
                                    }`}
                                onClick={() => step > i + 1 && setStep(i + 1)}
                            >
                                {step > i + 1 ? '✓ ' : ''}{s}
                            </div>
                        ))}
                    </div>

                    {step === 1 && (
                        <div className="space-y-4">
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
                                {errors.nationality && <p className="text-red-400 text-xs mt-1">{errors.nationality}</p>}
                            </div>
                            <button
                                onClick={() => validateStep1() && setStep(2)}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition mt-2"
                            >
                                Siguiente →
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
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
                                <p className="text-gray-600 text-xs mt-1">Peso de referencia, no el de competencia</p>
                            </div>
                            {form.birth_date && form.belt_id && form.training_weight && (
                                <div className="bg-[#0d1a0d] border border-green-900/40 rounded-xl p-4">
                                    <p className="text-xs text-green-400 font-medium mb-1">Tu categoría calculada:</p>
                                    <p className="text-sm text-white font-semibold">
                                        {level.charAt(0).toUpperCase() + level.slice(1)} · {ageGroup} · {form.training_weight}kg · {form.gender === 'M' ? 'Masculino' : 'Femenino'}
                                    </p>
                                </div>
                            )}
                            <div className="flex gap-3 mt-2">
                                <button onClick={() => setStep(1)} className="flex-1 bg-[#0d0d1a] border border-[#1e1e2e] text-white py-3 rounded-xl font-semibold hover:bg-[#13131f] transition">
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

                    {step === 3 && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Correo electrónico *</label>
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
                                    <p className="text-xs text-yellow-400 font-medium">
                                        Eres menor de edad — datos del acudiente
                                    </p>
                                    <Field label="Nombre del acudiente *" field="guardian_name" placeholder="María García" onlyLetters {...fieldProps} />
                                    <div>
                                        <label className="text-sm text-gray-400 mb-1 block">Teléfono del acudiente</label>
                                        <PhoneInput value={form.guardian_phone} onChange={v => update('guardian_phone', v)} />
                                    </div>
                                </div>
                            )}

                            {/* CAPTCHA */}
                            <div>
                                <Turnstile
                                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                                    onSuccess={t => setCaptchaToken(t)}
                                    onError={() => {
                                        setCaptchaToken(null)
                                        toast.error('Error en verificación de seguridad. Recarga la página.')
                                    }}
                                    onExpire={() => setCaptchaToken(null)}
                                    options={{ theme: 'dark' }}
                                />
                                {!captchaToken && (
                                    <p className="text-yellow-400 text-xs mt-1">Completa la verificación de seguridad</p>
                                )}
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button onClick={() => setStep(2)} className="flex-1 bg-[#0d0d1a] border border-[#1e1e2e] text-white py-3 rounded-xl font-semibold hover:bg-[#13131f] transition">
                                    ← Atrás
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !captchaToken}
                                    className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-40"
                                >
                                    {loading ? 'Enviando...' : 'Enviar registro ✓'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </>
    )
}