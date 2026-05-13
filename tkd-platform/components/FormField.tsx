'use client'

interface FormFieldProps {
    label: string
    field: string
    type?: string
    placeholder?: string
    value: string
    error?: string
    onChange: (value: string) => void
    onlyLetters?: boolean
    onlyNumbers?: boolean
    disabled?: boolean
}

export default function FormField({
    label, field, type = 'text', placeholder,
    value, error, onChange, onlyLetters, onlyNumbers, disabled
}: FormFieldProps) {
    return (
        <div>
            <label className="text-sm text-gray-400 mb-1 block">{label}</label>
            <input
                type={type}
                disabled={disabled}
                className={`w-full bg-[#0d0d1a] border rounded-xl px-4 py-3 text-white
          focus:outline-none transition disabled:opacity-50 ${error ? 'border-red-500' : 'border-[#1e1e2e] focus:border-blue-500'
                    }`}
                placeholder={placeholder}
                value={value}
                onChange={e => {
                    let val = e.target.value
                    if (onlyLetters) val = val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')
                    if (onlyNumbers) val = val.replace(/[^0-9]/g, '')
                    onChange(val)
                }}
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
    )
}
