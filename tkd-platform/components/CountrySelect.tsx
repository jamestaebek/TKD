'use client'

const COUNTRIES = [
    'Colombia', 'México', 'Argentina', 'Chile', 'Perú', 'Ecuador',
    'Venezuela', 'Bolivia', 'Paraguay', 'Uruguay', 'Brasil',
    'Estados Unidos', 'España', 'Panamá', 'Costa Rica', 'Guatemala',
    'Honduras', 'El Salvador', 'Nicaragua', 'Cuba', 'República Dominicana',
]

interface Props {
    value: string
    onChange: (value: string) => void
}

export default function CountrySelect({ value, onChange }: Props) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
        >
            <option value="">Selecciona un país</option>
            {COUNTRIES.map(c => (
                <option key={c} value={c}>{c}</option>
            ))}
        </select>
    )
}