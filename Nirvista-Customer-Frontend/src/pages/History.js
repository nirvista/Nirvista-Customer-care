import { useEffect, useState, useMemo } from "react";
import { Search, Download, Calendar, ChevronLeft, ChevronRight, Building2, X } from "lucide-react";
import Layout from "../Components/Layout";
import { getCompanies } from "../api/companyapi";
import { getTickets } from "../api/ticketapi";

const PAGE_SIZE = 10;

const statusColors = {
    new: "bg-blue-100 text-blue-700",
    open: "bg-yellow-100 text-yellow-700",
    pending: "bg-orange-100 text-orange-700",
    resolved: "bg-green-100 text-green-700",
    closed: "bg-gray-100 text-gray-700"
};

const priorityColors = {
    low: "text-gray-500",
    medium: "text-blue-500",
    high: "text-orange-500",
    urgent: "text-red-500"
};

function getPaginationRange(current, total) {
    const pages = [];
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - current) <= 1) {
            pages.push(i);
        }
    }
    const result = [];
    for (let i = 0; i < pages.length; i++) {
        if (i > 0 && pages[i] - pages[i - 1] > 1) result.push("...");
        result.push(pages[i]);
    }
    return result;
}

function History() {
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(true);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [error, setError] = useState("");

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [page, setPage] = useState(1);

    // Load companies on mount
    useEffect(() => {
        loadCompanies();
    }, []);

    const loadCompanies = async () => {
        setLoadingCompanies(true);
        setError("");
        try {
            const res = await getCompanies();
            setCompanies(res.data.data ?? res.data ?? []);
        } catch (err) {
            setError("Failed to load companies");
        } finally {
            setLoadingCompanies(false);
        }
    };

    const loadTickets = async (companyID) => {
        setLoadingTickets(true);
        setError("");
        try {
            const params = { companyID };
            if (dateFrom) params.createdFrom = dateFrom;
            if (dateTo) params.createdTo = dateTo;
            
            const res = await getTickets(params);
            const ticketsData = res.data?.data?.tickets || res.data?.tickets || res.data?.data || [];
            setTickets(Array.isArray(ticketsData) ? ticketsData : []);
        } catch (err) {
            setError("Failed to load tickets");
            setTickets([]);
        } finally {
            setLoadingTickets(false);
        }
    };

    const handleCompanySelect = (company) => {
        setSelectedCompany(company);
        setPage(1);
        loadTickets(company.companyID);
    };

    const handleBackToCompanies = () => {
        setSelectedCompany(null);
        setTickets([]);
        setDateFrom("");
        setDateTo("");
        setSearchQuery("");
        setPage(1);
    };

    const handleApplyDateFilter = () => {
        if (selectedCompany) {
            setPage(1);
            loadTickets(selectedCompany.companyID);
        }
    };

    const handleClearFilters = () => {
        setDateFrom("");
        setDateTo("");
        setSearchQuery("");
        setPage(1);
        if (selectedCompany) {
            loadTickets(selectedCompany.companyID);
        }
    };

    // Filter tickets by search query
    const filteredTickets = useMemo(() => {
        if (!searchQuery.trim()) return tickets;
        const q = searchQuery.toLowerCase();
        return tickets.filter(ticket =>
            ticket.ticketId?.toLowerCase().includes(q) ||
            ticket.subject?.toLowerCase().includes(q) ||
            ticket.customer?.email?.toLowerCase().includes(q) ||
            ticket.customer?.name?.toLowerCase().includes(q) ||
            ticket.status?.toLowerCase().includes(q)
        );
    }, [tickets, searchQuery]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
    const pageSlice = filteredTickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Export to CSV
    const exportToCSV = () => {
        if (filteredTickets.length === 0) {
            alert("No data to export");
            return;
        }

        // CSV headers
        const headers = [
            "Ticket ID",
            "Subject",
            "Status",
            "Priority",
            "Channel",
            "Customer Name",
            "Customer Email",
            "Assigned Agent",
            "Created At",
            "Updated At"
        ];

        // CSV rows
        const rows = filteredTickets.map(ticket => [
            ticket.ticketId || "",
            `"${(ticket.subject || "").replace(/"/g, '""')}"`,
            ticket.status || "",
            ticket.priority || "",
            ticket.channel || "",
            `"${(ticket.customer?.name || "").replace(/"/g, '""')}"`,
            ticket.customer?.email || "",
            ticket.assignedAgentId?.name || "Unassigned",
            ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "",
            ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : ""
        ]);

        // Build CSV content
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        // Create blob and download
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        const filename = `${selectedCompany?.companyID || "tickets"}_history_${dateFrom || "all"}_to_${dateTo || "all"}.csv`;
        
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const formatDate = (dateString) => {
        if (!dateString) return "—";
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    // Company List View
    if (!selectedCompany) {
        return (
            <Layout pageTitle="History">
                <div className="max-w-5xl">
                    <div className="flex items-center justify-between mb-5">
                        <p className="text-sm text-gray-500">
                            {loadingCompanies ? "Loading..." : `${companies.length} companies`}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-center justify-between">
                            <span>{error}</span>
                            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
                                <X size={15} />
                            </button>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {loadingCompanies ? (
                            <div className="p-12 text-center">
                                <div className="w-8 h-8 border-2 border-[#13A8A5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                <p className="text-gray-400 text-sm">Loading companies...</p>
                            </div>
                        ) : companies.length === 0 ? (
                            <div className="p-12 text-center">
                                <p className="text-gray-500 font-medium">No companies found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                                {companies.map((company) => (
                                    <button
                                        key={company._id}
                                        onClick={() => handleCompanySelect(company)}
                                        className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-[#f0fafa] hover:border-[#13A8A5] border border-gray-200 transition-all text-left"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-[#13A8A5]/15 flex items-center justify-center flex-shrink-0">
                                            <Building2 size={24} className="text-[#0b7d7b]" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-800 truncate">{company.name}</p>
                                            <p className="text-xs font-mono text-gray-500 bg-gray-200 px-2 py-0.5 rounded mt-1 inline-block">
                                                {company.companyID}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Layout>
        );
    }

    // Ticket History View
    return (
        <Layout pageTitle="History">
            <div className="max-w-6xl">
                {/* Header with back button */}
                <div className="flex items-center gap-4 mb-5">
                    <button
                        onClick={handleBackToCompanies}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ChevronLeft size={18} />
                        Back
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">{selectedCompany.name}</h2>
                        <p className="text-xs font-mono text-gray-500">{selectedCompany.companyID}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-4">
                    {/* Search */}
                    <div className="flex flex-1 min-w-[200px] max-w-sm border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#13A8A5] focus-within:ring-2 focus-within:ring-[#13A8A5]/20 bg-white">
                        <div className="relative flex-1 flex items-center">
                            <Search size={15} className="absolute left-3 text-gray-400 pointer-events-none" />
                            <input
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                                placeholder="Search tickets..."
                                className="w-full h-10 pl-9 pr-4 text-sm text-gray-800 outline-none bg-transparent placeholder-gray-400"
                            />
                        </div>
                    </div>

                    {/* Date From */}
                    <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 bg-white">
                        <Calendar size={15} className="text-gray-400" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="h-10 text-sm text-gray-800 outline-none bg-transparent"
                        />
                    </div>

                    {/* Date To */}
                    <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 bg-white">
                        <Calendar size={15} className="text-gray-400" />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="h-10 text-sm text-gray-800 outline-none bg-transparent"
                        />
                    </div>

                    {/* Apply Filter */}
                    <button
                        onClick={handleApplyDateFilter}
                        className="px-4 py-2 text-sm bg-[#13A8A5] text-white font-medium rounded-xl hover:bg-[#0b7d7b] transition-colors"
                    >
                        Apply
                    </button>

                    {/* Clear */}
                    {(dateFrom || dateTo || searchQuery) && (
                        <button
                            onClick={handleClearFilters}
                            className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Clear
                        </button>
                    )}

                    {/* Export */}
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors ml-auto"
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
                            <X size={15} />
                        </button>
                    </div>
                )}

                {/* Stats */}
                <p className="text-sm text-gray-500 mb-3">
                    {loadingTickets ? "Loading..." : `${filteredTickets.length} tickets found`}
                </p>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loadingTickets ? (
                        <div className="p-12 text-center">
                            <div className="w-8 h-8 border-2 border-[#13A8A5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-gray-400 text-sm">Loading tickets...</p>
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-gray-500 font-medium">No tickets found</p>
                            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50">
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest">Ticket ID</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest">Subject</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest">Status</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest">Priority</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest">Customer</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest">Agent</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest">Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageSlice.map((ticket, idx) => (
                                        <tr
                                            key={ticket._id || ticket.ticketId}
                                            className={`border-b border-gray-50 hover:bg-[#f0fafa] transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                                        >
                                            <td className="px-4 py-3 font-mono text-xs text-[#0b7d7b] font-medium">
                                                {ticket.ticketId}
                                            </td>
                                            <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate">
                                                {ticket.subject}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[ticket.status] || "bg-gray-100 text-gray-700"}`}>
                                                    {ticket.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-medium capitalize ${priorityColors[ticket.priority] || "text-gray-500"}`}>
                                                    {ticket.priority}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="text-gray-800 text-xs">{ticket.customer?.name || "—"}</p>
                                                    <p className="text-gray-400 text-xs">{ticket.customer?.email || "—"}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 text-xs">
                                                {ticket.assignedAgentId?.name || "Unassigned"}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                                {formatDate(ticket.createdAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {!loadingTickets && filteredTickets.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4 px-1">
                        <p className="text-xs text-gray-400">
                            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredTickets.length)} of {filteredTickets.length}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage((p) => p - 1)}
                                disabled={page === 1}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={15} />
                            </button>

                            {getPaginationRange(page, totalPages).map((p, i) =>
                                p === "..." ? (
                                    <span key={`gap-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                                            page === p
                                                ? "bg-[#13A8A5] text-white"
                                                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )}

                            <button
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page === totalPages}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

export default History;