import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Clock, AlertCircle, CheckCircle, Search, Filter, Calendar } from "lucide-react";
import Layout from "../Components/Layout";
import { getTickets } from "../api/ticketapi";

const statusColors = {
    new: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
    open: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
    pending: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
    resolved: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
    closed: { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-500" }
};

const priorityColors = {
    low: "text-gray-500",
    medium: "text-blue-500",
    high: "text-orange-500",
    urgent: "text-red-500"
};

function Tickets() {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    useEffect(() => {
        loadTickets();
    }, []);

    const loadTickets = async () => {
        try {
            setLoading(true);
            const response = await getTickets();
            // Safely extract tickets array from various response formats
            const ticketsData = response.data?.data?.tickets 
                || response.data?.tickets 
                || response.data?.data 
                || response.data 
                || [];
            // Ensure it's always an array
            setTickets(Array.isArray(ticketsData) ? ticketsData : []);
        } catch (err) {
            setError("Failed to load tickets");
            console.error(err);
            setTickets([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredTickets = Array.isArray(tickets) ? tickets.filter(ticket => {
        const matchesSearch = 
            ticket.ticketId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.customer?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
        const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
        
        // Date filtering
        let matchesDate = true;
        if (dateFrom || dateTo) {
            const ticketDate = new Date(ticket.createdAt);
            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                fromDate.setHours(0, 0, 0, 0);
                if (ticketDate < fromDate) matchesDate = false;
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                if (ticketDate > toDate) matchesDate = false;
            }
        }
        
        return matchesSearch && matchesStatus && matchesPriority && matchesDate;
    }) : [];

    const clearFilters = () => {
        setStatusFilter("all");
        setPriorityFilter("all");
        setDateFrom("");
        setDateTo("");
        setSearchQuery("");
    };

    const hasActiveFilters = statusFilter !== "all" || priorityFilter !== "all" || dateFrom || dateTo || searchQuery;

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const getLastMessage = (conversation) => {
        if (!conversation || conversation.length === 0) return "No messages";
        const last = conversation[conversation.length - 1];
        return last.content?.substring(0, 50) + (last.content?.length > 50 ? "..." : "");
    };

    return (
        <Layout pageTitle="Tickets">
            <div className="max-w-6xl space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search tickets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7d7b]/20 focus:border-[#0b7d7b]"
                        />
                    </div>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="text-sm text-[#0b7d7b] hover:underline"
                        >
                            Clear all filters
                        </button>
                    )}

                    {/* Filters Row */}
                    <div className="flex flex-wrap items-center gap-3">
                        <Filter className="w-4 h-4 text-gray-400" />
                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7d7b]/20"
                        >
                            <option value="all">All Status</option>
                            <option value="new">New</option>
                            <option value="open">Open</option>
                            <option value="pending">Pending</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                        {/* Priority Filter */}
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7d7b]/20"
                        >
                            <option value="all">All Priority</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>

                        {/* Date Range Filter */}
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7d7b]/20"
                                placeholder="From"
                            />
                            <span className="text-gray-400 text-sm">to</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7d7b]/20"
                                placeholder="To"
                            />
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: "New", count: Array.isArray(tickets) ? tickets.filter(t => t.status === "new").length : 0, color: "blue" },
                        { label: "Open", count: Array.isArray(tickets) ? tickets.filter(t => t.status === "open").length : 0, color: "yellow" },
                        { label: "Pending", count: Array.isArray(tickets) ? tickets.filter(t => t.status === "pending").length : 0, color: "orange" },
                        { label: "Resolved", count: Array.isArray(tickets) ? tickets.filter(t => t.status === "resolved").length : 0, color: "green" }
                    ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-2xl font-bold text-gray-800">{stat.count}</p>
                            <p className="text-sm text-gray-500">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Tickets List */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading tickets...</div>
                    ) : error ? (
                        <div className="p-8 text-center text-red-500">{error}</div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No tickets found</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredTickets.map(ticket => (
                                <div
                                    key={ticket.ticketId}
                                    onClick={() => navigate(`/tickets/${ticket.ticketId}`)}
                                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-semibold text-[#0b7d7b]">
                                                    {ticket.ticketId}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status]?.bg} ${statusColors[ticket.status]?.text}`}>
                                                    {ticket.status}
                                                </span>
                                                <span className={`text-xs font-medium ${priorityColors[ticket.priority]}`}>
                                                    {ticket.priority}
                                                </span>
                                            </div>
                                            <h3 className="text-sm font-medium text-gray-800 truncate">
                                                {ticket.subject}
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {ticket.customer?.name} • {ticket.customer?.email}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1 truncate">
                                                {getLastMessage(ticket.conversation)}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                            <span className="text-xs text-gray-400">
                                                {formatDate(ticket.createdAt)}
                                            </span>
                                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                                <MessageSquare className="w-3 h-3" />
                                                {ticket.conversation?.length || 0}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

export default Tickets;