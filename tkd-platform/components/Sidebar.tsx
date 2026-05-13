'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'

const navItems = [
    {
        href: '/dashboard', label: 'Inicio', icon: (
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
        )
    },
    {
        href: '/dashboard/athletes', label: 'Atletas', icon: (
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
        )
    },
    {
        href: '/dashboard/tournaments', label: 'Torneos', icon: (
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
        )
    },
    {
        href: '/dashboard/results', label: 'Resultados', icon: (
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        )
    },
    {
        href: '/dashboard/club/edit', label: 'Configuración', icon: (
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
        )
    },
]

interface Props {
    userEmail: string
}

export default function Sidebar({ userEmail }: Props) {
    const pathname = usePathname()

    return (
        <aside className="w-52 min-h-screen bg-[#0a0a14] border-r border-[#1e1e2e] flex flex-col">
            <div className="p-5 border-b border-[#1e1e2e]">
                <div className="text-lg font-bold text-white">
                    <span className="text-blue-500">TKD</span> Platform
                </div>
                <div className="text-xs text-gray-600 mt-1">Panel del club</div>
            </div>

            <nav className="flex-1 py-3">
                {navItems.map(item => {
                    const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2.5 px-5 py-2.5 text-sm transition ${active
                                    ? 'text-white bg-[#13131f] border-l-2 border-blue-500'
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {item.icon}
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-[#1e1e2e]">
                <div className="text-xs text-gray-600 truncate">{userEmail}</div>
                <div className="mt-1.5">
                    <LogoutButton />
                </div>
            </div>
        </aside>
    )
}