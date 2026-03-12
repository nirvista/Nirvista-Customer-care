import { NavLink, useNavigate } from "react-router-dom";

const navItems = [
    {
        to: "/dashboard", label: "Dashboard", roles: ["admin", "supervisor", "agent"],
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        )
    },
    {
        to: "/tickets", label: "Tickets", roles: ["admin", "supervisor", "agent"],
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
        )
    },
    {
        to: "/agents", label: "Agents", roles: ["admin", "supervisor"],
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        )
    },
    {
        to: "/supervisors", label: "Supervisors", roles: ["admin"],
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        )
    },
    {
        to: "/companies", label: "Companies", roles: ["admin"],
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        )
    },
    {
        to: "/chat-widgets", label: "Chat Widgets", roles: ["admin"],
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        )
    },
    {
    to: "/history", label: "History", roles: ["admin"],
    icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    )
    },
];

function Layout({ children, pageTitle }) {
    const navigate = useNavigate();
    const role = localStorage.getItem("role");
    const initials = role ? role.slice(0, 2).toUpperCase() : "??";

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        navigate("/");
    };

    const visible = navItems.filter(item => item.roles.includes(role));

    return (
        <div className="flex h-screen bg-[#f4f9f9] font-sans">
            {/* Sidebar */}
            <aside className="w-60 flex-shrink-0 bg-[#0b7d7b] flex flex-col shadow-xl">
                {/* Logo area */}
                <div className="flex items-center justify-center h-[68px] border-b border-white/10 px-4">
                    <img src="/logo/logo.png" alt="Nirvista" className="h-9 object-contain" />
                </div>

                {/* Nav label */}
                <div className="px-4 pt-5 pb-2">
                    <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Main Menu</p>
                </div>

                {/* Nav links */}
                <nav className="flex-1 px-3 space-y-0.5">
                    {visible.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                                    isActive
                                        ? "bg-white/20 text-white border-l-2 border-white"
                                        : "text-white/65 hover:bg-white/10 hover:text-white"
                                }`
                            }
                        >
                            {item.icon}
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* User + Logout */}
                <div className="px-3 py-4 border-t border-white/10">
                    {/* Avatar row */}
                    <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-white text-sm font-semibold capitalize leading-tight">{role}</p>
                            <p className="text-white/50 text-xs">Active session</p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-red-500/30 hover:text-white transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top header */}
                <header className="h-[68px] bg-white border-b border-gray-100 flex items-center justify-between px-7 flex-shrink-0 shadow-sm">
                    <h1 className="text-lg font-bold text-gray-800">{pageTitle}</h1>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 capitalize px-3 py-1 bg-gray-100 rounded-full font-medium">{role}</span>
                    </div>
                </header>

                {/* Scrollable content */}
                <main className="flex-1 overflow-y-auto p-7">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default Layout;
