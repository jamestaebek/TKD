export function calculateAge(birthDate: string): number {
    if (!birthDate) return 0
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
}

export function getAgeGroup(age: number): string {
    if (age >= 9 && age <= 11) return 'Pre-cadete'
    if (age >= 12 && age <= 14) return 'Cadete'
    if (age >= 15 && age <= 17) return 'Junior'
    if (age >= 18) return 'Senior'
    return 'Infantil'
}

export function getWeightCategory(weight: number): string {
    if (weight <= 33) return '-33kg'
    if (weight <= 37) return '-37kg'
    if (weight <= 41) return '-41kg'
    if (weight <= 45) return '-45kg'
    if (weight <= 48) return '-48kg'
    if (weight <= 51) return '-51kg'
    if (weight <= 55) return '-55kg'
    if (weight <= 59) return '-59kg'
    if (weight <= 63) return '-63kg'
    if (weight <= 68) return '-68kg'
    if (weight <= 73) return '-73kg'
    if (weight <= 78) return '-78kg'
    return '+78kg'
}
