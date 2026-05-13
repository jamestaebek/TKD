import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resend, FROM_EMAIL } from '@/lib/email/resend'
import { athleteApprovedEmail, athleteRejectedEmail, athleteRegisteredEmail, clubRemovedFromFogueoEmail, clubInvitedToFogueoEmail } from '@/lib/email/templates'

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: userClub } = await supabase
        .from('clubs')
        .select('id')
        .eq('user_id', user.id)
        .single()

    if (!userClub) {
        return NextResponse.json({ error: 'Sin club registrado' }, { status: 403 })
    }

    try {
        const { type, to, athleteName, clubName, coachName, ...body } = await request.json()
        if (!type || !to) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
        }
        if (['approved', 'rejected', 'registered'].includes(type) && (!athleteName || !clubName)) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
        }
        if (type === 'club_invited' && (!coachName || !body.fogueoName || !body.fogueoDate || !body.location)) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
        }
        if (type === 'club_removed' && (!coachName || !clubName || !body.fogueoName)) {
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
            case 'club_removed':
                html = clubRemovedFromFogueoEmail(coachName, clubName, body.fogueoName)
                subject = `Tu club fue retirado del fogueo ${body.fogueoName}`
                break
            case 'club_invited':
                html = clubInvitedToFogueoEmail(coachName, clubName, body.fogueoName, body.fogueoDate, body.location)
                subject = `Invitación al fogueo ${body.fogueoName} 🥋`
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