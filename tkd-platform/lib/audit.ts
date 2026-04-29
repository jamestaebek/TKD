import { createClient } from '@/lib/supabase/client'

type AuditAction =
    | 'athlete_approved'
    | 'athlete_rejected'
    | 'athlete_suspended'
    | 'athlete_created'
    | 'athlete_updated'
    | 'athlete_deleted'
    | 'club_updated'
    | 'club_registered'

interface AuditParams {
    action: AuditAction
    entity_type: string
    entity_id?: string
    club_id: string
    details?: Record<string, unknown>
}

export async function logAudit(params: AuditParams) {
    try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('audit_logs').insert({
            user_id: user.id,
            club_id: params.club_id,
            action: params.action,
            entity_type: params.entity_type,
            entity_id: params.entity_id ?? null,
            details: params.details ?? null,
        })
    } catch (e) {
        console.error('Audit log error:', e)
    }
}