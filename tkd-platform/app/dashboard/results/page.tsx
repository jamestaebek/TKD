import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

// ─── Types ───────────────────────────────────────────────────────────────────

type AthleteRow = {
    id: string
    first_name: string
    last_name: string
    gender: string | null
    training_weight: number | null
    belt_levels: { name: string; default_level: string } | null
}

type MatchRow = {
    id: string
    pyramid_id: string
    round_number: number
    match_number: number
    winner_id: string | null
    score_blue: number | null
    score_red: number | null
    status: string
    is_bye: boolean
    athlete_blue_id: string | null
    athlete_red_id: string | null
}

type PyramidRow = {
    id: string
    fogueo_id: string
    name: string
    group_label: string | null
    gender_group: string | null
    status: string
}

type FogueoLite = {
    id: string
    name: string
    event_date: string
    scoring_type: string
}

type AthleteStats = {
    athlete: AthleteRow
    combates: number
    ganados: number
    perdidos: number
    puntos: number
    gj_recibidos: number
}

type FeedbackEntry = {
    tags: string[]
    notes: string
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ResultsPage({
    searchParams,
}: {
    searchParams: Promise<{ fogueo?: string }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: club } = await supabase
        .from('clubs').select('id, name').eq('user_id', user.id).single()
    if (!club) redirect('/dashboard/club/register')

    const { fogueo: selectedParam } = await searchParams

    // Fogueos finalizados accesibles para este club: organizados por el club
    // + aquellos en los que el club está inscrito vía fogueo_clubs.
    const { data: invitedRows } = await supabase
        .from('fogueo_clubs').select('fogueo_id').eq('club_id', club.id)
    const joinedIds = (invitedRows ?? []).map(r => r.fogueo_id as string)

    const orClause = joinedIds.length > 0
        ? `club_id.eq.${club.id},id.in.(${joinedIds.join(',')})`
        : `club_id.eq.${club.id}`

    const { data: fogueosData } = await supabase
        .from('fogueos')
        .select('id, name, event_date, scoring_type, status')
        .or(orClause)
        .eq('status', 'finished')
        .order('event_date', { ascending: false })

    const fogueos = (fogueosData ?? []) as FogueoLite[]

    // ── Sin fogueos finalizados → estado vacío ──────────────────────────────
    if (fogueos.length === 0) {
        return (
            <div className="flex min-h-screen bg-[#07070f] text-white">
                <Sidebar userEmail={user.email ?? ''} />
                <main className="flex-1 p-6">
                    <div className="max-w-5xl mx-auto">
                        <PageHeader />
                        <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                            <div className="text-4xl mb-4">🏆</div>
                            <h2 className="text-lg font-semibold text-white mb-2">
                                Aún no hay resultados
                            </h2>
                            <p className="text-gray-500 text-sm max-w-sm">
                                Cuando un fogueo en el que participe tu club finalice,
                                los resultados aparecerán aquí.
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    const selectedFogueoId = fogueos.find(f => f.id === selectedParam)?.id ?? fogueos[0].id
    const selectedFogueo = fogueos.find(f => f.id === selectedFogueoId)!

    // ── Datos del fogueo seleccionado ────────────────────────────────────────

    const { data: pyramidsData } = await supabase
        .from('fogueo_pyramids')
        .select('id, fogueo_id, name, group_label, gender_group, status')
        .eq('fogueo_id', selectedFogueoId)
        .order('name')
    const pyramids = (pyramidsData ?? []) as PyramidRow[]
    const pyramidIds = pyramids.map(p => p.id)

    const { data: matchesData } = pyramidIds.length > 0
        ? await supabase
            .from('fogueo_matches')
            .select('id, pyramid_id, round_number, match_number, winner_id, score_blue, score_red, status, is_bye, athlete_blue_id, athlete_red_id')
            .in('pyramid_id', pyramidIds)
        : { data: [] as MatchRow[] }
    const matches = (matchesData ?? []) as MatchRow[]

    // Atletas del club que participaron en este fogueo
    const { data: fogueoAthletesData } = await supabase
        .from('fogueo_athletes')
        .select('athlete_id, athletes(id, first_name, last_name, gender, training_weight, belt_levels(name, default_level))')
        .eq('fogueo_id', selectedFogueoId)
        .eq('club_id', club.id)
    const clubAthletes: AthleteRow[] = (fogueoAthletesData ?? [])
        .map((r: { athletes: unknown }) => r.athletes as AthleteRow | null)
        .filter((a): a is AthleteRow => !!a)
    const clubAthleteIds = new Set(clubAthletes.map(a => a.id))

    // Nombres de TODOS los atletas que aparecen en matches (para podio)
    const allAthleteIds = Array.from(new Set(
        matches.flatMap(m => [m.athlete_blue_id, m.athlete_red_id, m.winner_id])
            .filter((x): x is string => !!x)
    ))
    const { data: allAthletesData } = allAthleteIds.length > 0
        ? await supabase
            .from('athletes')
            .select('id, first_name, last_name, gender, training_weight, belt_levels(name, default_level)')
            .in('id', allAthleteIds)
        : { data: [] as AthleteRow[] }
    const allAthletes = (allAthletesData ?? []) as AthleteRow[]
    const athleteById = new Map(allAthletes.map(a => [a.id, a]))

    // GJ recibidos: vienen en match_rounds por ronda
    const matchIds = matches.map(m => m.id)
    const { data: roundsData } = matchIds.length > 0
        ? await supabase
            .from('match_rounds')
            .select('match_id, gj_blue, gj_red')
            .in('match_id', matchIds)
        : { data: [] as { match_id: string; gj_blue: number | null; gj_red: number | null }[] }
    const rounds = (roundsData ?? []) as { match_id: string; gj_blue: number | null; gj_red: number | null }[]
    const gjByMatch = new Map<string, { blue: number; red: number }>()
    for (const r of rounds) {
        const cur = gjByMatch.get(r.match_id) ?? { blue: 0, red: 0 }
        cur.blue += r.gj_blue ?? 0
        cur.red += r.gj_red ?? 0
        gjByMatch.set(r.match_id, cur)
    }

    // Feedback (solo para atletas del club)
    const { data: feedbackData } = matchIds.length > 0
        ? await supabase
            .from('match_feedback')
            .select('match_id, athlete_id, tags, notes')
            .in('match_id', matchIds)
        : { data: [] as { match_id: string; athlete_id: string; tags: string[] | null; notes: string | null }[] }
    const feedbackByAthlete = new Map<string, FeedbackEntry[]>()
    for (const f of (feedbackData ?? [])) {
        if (!clubAthleteIds.has(f.athlete_id as string)) continue
        const entry: FeedbackEntry = {
            tags: (f.tags as string[] | null) ?? [],
            notes: (f.notes as string | null) ?? '',
        }
        const arr = feedbackByAthlete.get(f.athlete_id as string) ?? []
        arr.push(entry)
        feedbackByAthlete.set(f.athlete_id as string, arr)
    }

    // ── Computar estadísticas por atleta del club ───────────────────────────

    const stats: AthleteStats[] = clubAthletes.map(a => {
        let combates = 0, ganados = 0, puntos = 0, gj = 0
        for (const m of matches) {
            if (m.is_bye) continue
            const isBlue = m.athlete_blue_id === a.id
            const isRed = m.athlete_red_id === a.id
            if (!isBlue && !isRed) continue
            combates++
            if (m.winner_id === a.id) ganados++
            puntos += isBlue ? (m.score_blue ?? 0) : (m.score_red ?? 0)
            const matchGj = gjByMatch.get(m.id)
            if (matchGj) gj += isBlue ? matchGj.blue : matchGj.red
        }
        return {
            athlete: a,
            combates,
            ganados,
            perdidos: combates - ganados,
            puntos,
            gj_recibidos: gj,
        }
    })
        .filter(s => s.combates > 0)
        .sort((a, b) => b.ganados - a.ganados || b.puntos - a.puntos)

    // ── Computar podio por pirámide ─────────────────────────────────────────

    type Podium = {
        pyramid: PyramidRow
        champion: AthleteRow | null
        finalist: AthleteRow | null
        third: AthleteRow[]
    }

    const podiums: Podium[] = pyramids.map(p => {
        const pMatches = matches.filter(m => m.pyramid_id === p.id && !m.is_bye && m.round_number > 0)
        if (pMatches.length === 0) {
            return { pyramid: p, champion: null, finalist: null, third: [] }
        }
        const maxRound = Math.max(...pMatches.map(m => m.round_number))
        const finalMatch = pMatches.find(m => m.round_number === maxRound && m.status === 'finished') ?? null
        const champion = finalMatch?.winner_id ? athleteById.get(finalMatch.winner_id) ?? null : null
        const finalistId = finalMatch && finalMatch.winner_id
            ? (finalMatch.winner_id === finalMatch.athlete_blue_id
                ? finalMatch.athlete_red_id
                : finalMatch.athlete_blue_id)
            : null
        const finalist = finalistId ? athleteById.get(finalistId) ?? null : null

        const semis = pMatches.filter(m => m.round_number === maxRound - 1 && m.status === 'finished')
        const third: AthleteRow[] = []
        for (const sm of semis) {
            if (!sm.winner_id) continue
            const loserId = sm.winner_id === sm.athlete_blue_id ? sm.athlete_red_id : sm.athlete_blue_id
            const loser = loserId ? athleteById.get(loserId) : null
            if (loser) third.push(loser)
        }

        return { pyramid: p, champion, finalist, third }
    })

    // ── Render ──────────────────────────────────────────────────────────────

    const fullName = (a: AthleteRow | null): string =>
        a ? `${a.first_name} ${a.last_name}` : '—'

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

    return (
        <div className="flex min-h-screen bg-[#07070f] text-white">
            <Sidebar userEmail={user.email ?? ''} />
            <main className="flex-1 p-6">
                <div className="max-w-5xl mx-auto space-y-5">

                    <PageHeader />

                    {/* SECCIÓN 1 — Tabs de fogueos finalizados */}
                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-4">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                            Fogueos finalizados
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {fogueos.map(f => {
                                const active = f.id === selectedFogueoId
                                return (
                                    <Link
                                        key={f.id}
                                        href={`/dashboard/results?fogueo=${f.id}`}
                                        className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition border ${active
                                            ? 'bg-blue-900/30 border-blue-700 text-blue-300'
                                            : 'bg-[#13131f] border-[#1e1e2e] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                                            }`}
                                    >
                                        <div>{f.name}</div>
                                        <div className="text-xs text-gray-500 font-normal mt-0.5">
                                            {formatDate(f.event_date)}
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>

                    {/* SECCIÓN 2 — Podio por pirámide */}
                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">
                            Podio · {selectedFogueo.name}
                        </div>
                        {podiums.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-6">
                                Este fogueo no tiene pirámides registradas.
                            </p>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                {podiums.map(p => {
                                    const genderBadge = p.pyramid.gender_group === 'M'
                                        ? { label: 'Masculino', style: 'bg-blue-900/40 text-blue-300' }
                                        : p.pyramid.gender_group === 'F'
                                            ? { label: 'Femenino', style: 'bg-pink-900/40 text-pink-300' }
                                            : null
                                    return (
                                        <div key={p.pyramid.id} className="bg-[#07070f] border border-[#1e1e2e] rounded-xl p-4">
                                            <div className="flex items-center justify-between gap-2 mb-3">
                                                <div className="text-sm font-semibold text-white truncate">
                                                    {p.pyramid.group_label ?? p.pyramid.name}
                                                </div>
                                                {genderBadge && (
                                                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${genderBadge.style}`}>
                                                        {genderBadge.label}
                                                    </span>
                                                )}
                                            </div>
                                            <PodiumRow icon="🥇" colorClass="text-amber-400" label="Campeón" athlete={p.champion} />
                                            <PodiumRow icon="🥈" colorClass="text-gray-300" label="Finalista" athlete={p.finalist} />
                                            {p.third.length > 0 ? (
                                                p.third.map((a, i) => (
                                                    <PodiumRow
                                                        key={a.id + i}
                                                        icon="🥉"
                                                        colorClass="text-orange-400"
                                                        label="Tercer lugar"
                                                        athlete={a}
                                                    />
                                                ))
                                            ) : (
                                                <PodiumRow icon="🥉" colorClass="text-orange-400" label="Tercer lugar" athlete={null} />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* SECCIÓN 3 — Estadísticas de mis atletas */}
                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">
                            Estadísticas — atletas de {club.name}
                        </div>
                        {stats.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-6">
                                Ningún atleta de tu club compitió en este fogueo.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-gray-500 uppercase tracking-wider">
                                            <th className="text-left font-medium py-2 px-2">Atleta</th>
                                            <th className="text-right font-medium py-2 px-2">Combates</th>
                                            <th className="text-right font-medium py-2 px-2">Ganados</th>
                                            <th className="text-right font-medium py-2 px-2">Perdidos</th>
                                            <th className="text-right font-medium py-2 px-2">Pts</th>
                                            <th className="text-right font-medium py-2 px-2">GJ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.map(s => (
                                            <tr key={s.athlete.id} className="border-t border-[#1e1e2e]">
                                                <td className="py-2.5 px-2">
                                                    <div className="text-white">{fullName(s.athlete)}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {s.athlete.belt_levels?.name ?? ''}
                                                        {s.athlete.training_weight ? ` · ${s.athlete.training_weight}kg` : ''}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-2 text-right tabular-nums">{s.combates}</td>
                                                <td className="py-2.5 px-2 text-right tabular-nums text-green-400">{s.ganados}</td>
                                                <td className="py-2.5 px-2 text-right tabular-nums text-red-400">{s.perdidos}</td>
                                                <td className="py-2.5 px-2 text-right tabular-nums">{s.puntos}</td>
                                                <td className="py-2.5 px-2 text-right tabular-nums text-amber-400">{s.gj_recibidos}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* SECCIÓN 4 — Feedback recibido */}
                    <div className="bg-[#0d0d1a] border border-[#1e1e2e] rounded-2xl p-5">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">
                            Feedback recibido
                        </div>
                        {feedbackByAthlete.size === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-6">
                                Aún no hay feedback registrado para los atletas de tu club en este fogueo.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {clubAthletes.map(a => {
                                    const entries = feedbackByAthlete.get(a.id)
                                    if (!entries || entries.length === 0) return null

                                    // Agrupar tags con conteo
                                    const tagCounts = new Map<string, number>()
                                    for (const e of entries) {
                                        for (const t of e.tags) {
                                            tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
                                        }
                                    }
                                    const notes = entries
                                        .map(e => e.notes.trim())
                                        .filter(n => n.length > 0)

                                    return (
                                        <div key={a.id} className="bg-[#07070f] border border-[#1e1e2e] rounded-xl p-4">
                                            <div className="text-sm font-semibold text-white mb-3">
                                                {fullName(a)}
                                            </div>
                                            {tagCounts.size > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mb-3">
                                                    {Array.from(tagCounts.entries())
                                                        .sort((x, y) => y[1] - x[1])
                                                        .map(([tag, count]) => (
                                                            <span
                                                                key={tag}
                                                                className="text-xs px-2.5 py-1 rounded-full bg-blue-900/30 border border-blue-900/60 text-blue-300"
                                                            >
                                                                {tag}{count > 1 ? ` ·${count}` : ''}
                                                            </span>
                                                        ))}
                                                </div>
                                            )}
                                            {notes.length > 0 && (
                                                <ul className="space-y-1.5">
                                                    {notes.map((n, i) => (
                                                        <li key={i} className="text-xs text-gray-400 italic">
                                                            “{n}”
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    )
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function PageHeader() {
    return (
        <div className="mb-2">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
                <span>›</span>
                <span className="text-white">Resultados</span>
            </div>
            <h1 className="text-2xl font-bold">
                <span className="text-blue-500">TKD</span> — Resultados
            </h1>
            <p className="text-gray-500 text-sm mt-1">
                Historial de fogueos finalizados y desempeño de tus atletas
            </p>
        </div>
    )
}

function PodiumRow({
    icon, colorClass, label, athlete,
}: {
    icon: string
    colorClass: string
    label: string
    athlete: { first_name: string; last_name: string; training_weight: number | null; belt_levels: { name: string } | null } | null
}) {
    return (
        <div className="flex items-center gap-3 py-1.5 border-t border-[#1e1e2e] first:border-t-0">
            <span className="text-xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
                <div className={`text-xs uppercase tracking-wider ${colorClass}`}>{label}</div>
                <div className="text-sm text-white truncate">
                    {athlete ? `${athlete.first_name} ${athlete.last_name}` : '—'}
                </div>
                {athlete && (athlete.training_weight || athlete.belt_levels?.name) && (
                    <div className="text-xs text-gray-500 truncate">
                        {athlete.belt_levels?.name ?? ''}
                        {athlete.training_weight ? ` · ${athlete.training_weight}kg` : ''}
                    </div>
                )}
            </div>
        </div>
    )
}
