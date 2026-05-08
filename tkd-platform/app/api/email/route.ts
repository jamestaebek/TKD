import { NextRequest, NextResponse } from 'next/server'
import { resend, FROM_EMAIL } from '@/lib/email/resend'
import { athleteApprovedEmail, athleteRejectedEmail, athleteRegisteredEmail } from '@/lib/email/templates'

export async function POST(request: NextRequest) {
    try {
        const { type, to, athleteName, clubName, coachName } = await request.json()

        if (!type || !to || !athleteName || !clubName) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
        }

        let html = ''
        let subject = ''

        switch (type) {
            case 'approved':
                html = athleteApprovedEmail(athleteName, clubName)
                subject = `¡Tu registro en ${clubName} fue aprobado! 🎉`
                break
            case 'rejected':
                html = athleteRejectedEmail(athleteName, clubName)
                subject = `Actualización de tu registro en ${clubName}`
                break
            case 'registered':
                html = athleteRegisteredEmail(athleteName, clubName, coachName)
                subject = `Solicitud recibida — ${clubName}`
                break
            default:
                return NextResponse.json({ error: 'Tipo de email inválido' }, { status: 400 })
        }

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject,
            html,
        })

        if (error) {
            return NextResponse.json({ error }, { status: 400 })
        }

        return NextResponse.json({ success: true, id: data?.id })
    } catch (e) {
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
    }
}