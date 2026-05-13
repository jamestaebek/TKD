'use client'

import { useState } from 'react'

const COUNTRIES = [
    { code: 'CO', name: 'Colombia', dial: '+57' },
    { code: 'MX', name: 'México', dial: '+52' },
    { code: 'AR', name: 'Argentina', dial: '+54' },
    { code: 'CL', name: 'Chile', dial: '+56' },
    { code: 'PE', name: 'Perú', dial: '+51' },
    { code: 'EC', name: 'Ecuador', dial: '+593' },
    { code: 'VE', name: 'Venezuela', dial: '+58' },
    { code: 'BO', name: 'Bolivia', dial: '+591' },
    { code: 'PY', name: 'Paraguay', dial: '+595' },
    { code: 'UY', name: 'Uruguay', dial: '+598' },
    { code: 'BR', name: 'Brasil', dial: '+55' },
    { code: 'US', name: 'Estados Unidos', dial: '+1' },
    { code: 'ES', name: 'España', dial: '+34' },
    { code: 'PA', name: 'Panamá', dial: '+507' },
    { code: 'CR', name: 'Costa Rica', dial: '+506' },
]

interface Props {
    value: string
    onChange: (value: string) => void
    placeholder?: string
}

export default function PhoneInput({ value, onChange, placeholder }: Props) {
    const [dialCode, setDialCode] = useState('+57')
    const number = value.replace(/^\+\d+\s?/, '')

    const handleDial = (dial: string) => {
        setDialCode(dial)
        onChange(`${dial} ${number}`)
    }

    const handleNumber = (n: string) => {
        const onlyNumbers = n.replace(/[^0-9]/g, '')
        onChange(`${dialCode} ${onlyNumbers}`)
    }

    return (
        <div className="flex gap-2">
            <select
                value={dialCode}
                onChange={e => handleDial(e.target.value)}
                className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl px-3 py-3 text-white focus:outline-none focus:border-blue-500 w-28"
            >
                {COUNTRIES.map(c => (
                    <option key={c.code} value={c.dial}>
                        {c.code} {c.dial}
                    </option>
                ))}
            </select>
            <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                className="flex-1 bg-[#0d0d1a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                placeholder={placeholder ?? '300 000 0000'}
                value={number}
                onChange={e => handleNumber(e.target.value)}
            />
        </div>
    )
}