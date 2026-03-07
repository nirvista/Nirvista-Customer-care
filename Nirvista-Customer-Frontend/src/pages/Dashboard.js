import { useEffect, useState } from "react";
import { Users, Building2, UserCheck } from "lucide-react";
import Layout from "../Components/Layout";
import { getAgents } from "../api/agentapi";
import { getCompanies } from "../api/companyapi";
import { getSupervisors } from "../api/supervisorapi";

// Stat Card 

function StatCard({ label, value, icon: Icon, borderColor, iconBg, iconColor }) {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderColor} p-6 flex items-center gap-5`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                <Icon size={22} className={iconColor} />
            </div>
            <div>
                <p className="text-3xl font-bold text-gray-800 leading-tight">{value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{label}</p>
            </div>
        </div>
    );
}

function StatCardSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-6 h-24 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
            <div className="h-7 bg-gray-100 rounded w-1/4" />
        </div>
    );
}

//Dashboard 

function Dashboard() {
    const role = localStorage.getItem("role");
    const isAdmin = role === "admin";
    const isSupervisor = role === "supervisor";

    const [agentCount, setAgentCount] = useState("—");
    const [supervisorCount, setSupervisorCount] = useState("—");
    const [companyCount, setCompanyCount] = useState("—");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                if (isAdmin || isSupervisor) {
                    const res = await getAgents();
                    setAgentCount(res.data.data?.length ?? res.data.length ?? 0);
                }

                if (isAdmin) {
                    const [supRes, compRes] = await Promise.all([
                        getSupervisors(),
                        getCompanies(),
                    ]);
                    setSupervisorCount(supRes.data.data?.length ?? supRes.data.length ?? 0);
                    setCompanyCount(compRes.data.data?.length ?? compRes.data.length ?? 0);
                }
            } catch {
            } finally {
                setLoading(false);
            }
        }

        loadStats();
    }, [isAdmin, isSupervisor]);

    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const skeletonCount = isAdmin ? 3 : 1;

    return (
        <Layout pageTitle="Dashboard">
            <div className="max-w-5xl space-y-6">

                {/* Welcome banner */}
                <div className="relative bg-gradient-to-r from-[#0b7d7b] to-[#13A8A5] rounded-2xl p-7 text-white overflow-hidden flex items-center justify-between">
                    {/* Background circles for depth */}
                    <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
                    <div className="absolute right-20 bottom-0 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

                    <div className="relative z-10">
                        <p className="text-white/60 text-sm mb-1">{today}</p>
                        <h2 className="text-2xl font-bold mb-1">Welcome back!</h2>
                        <p className="text-white/75 text-sm">
                            You are signed in as{" "}
                            <span className="font-semibold text-white capitalize">{role}</span>
                        </p>
                    </div>

                    <div className="relative z-10 hidden sm:flex w-14 h-14 rounded-2xl bg-white/20 items-center justify-center flex-shrink-0">
                        <img src="/logo/logo.png" alt="Logo" className="h-8 object-contain" />
                    </div>
                </div>

                {/* Stat cards */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: skeletonCount }).map((_, i) => (
                            <StatCardSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                        {(isAdmin || isSupervisor) && (
                            <StatCard
                                label="Total Agents"
                                value={agentCount}
                                icon={Users}
                                borderColor="border-l-[#13A8A5]"
                                iconBg="bg-teal-50"
                                iconColor="text-teal-600"
                            />
                        )}

                        {isAdmin && (
                            <StatCard
                                label="Total Supervisors"
                                value={supervisorCount}
                                icon={UserCheck}
                                borderColor="border-l-blue-500"
                                iconBg="bg-blue-50"
                                iconColor="text-blue-600"
                            />
                        )}

                        {isAdmin && (
                            <StatCard
                                label="Total Companies"
                                value={companyCount}
                                icon={Building2}
                                borderColor="border-l-purple-500"
                                iconBg="bg-purple-50"
                                iconColor="text-purple-600"
                            />
                        )}

                    </div>
                )}

            </div>
        </Layout>
    );
}

export default Dashboard;