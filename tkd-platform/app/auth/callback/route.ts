import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const oauthError = searchParams.get('error')

    if (oauthError) {
        const desc = searchParams.get('error_description') ?? oauthError
        return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(desc)}`)
    }

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
            return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
        }
    }

    return NextResponse.redirect(`${origin}/dashboard`)
}