import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, X, ChevronLeft, ChevronRight, Globe, Copy, Check, ChevronDown, ChevronUp, Ticket, User, Clock } from "lucide-react";
import Layout from "../Components/Layout";
import { getChatWidgets, createChatWidget, updateChatWidget, deleteChatWidget } from "../api/chatwidgetapi";
import { getTickets } from "../api/ticketapi";

const PAGE_SIZE = 5;

const statusColors = {
    new: { bg: "bg-blue-100", text: "text-blue-700" },
    open: { bg: "bg-yellow-100", text: "text-yellow-700" },
    pending: { bg: "bg-orange-100", text: "text-orange-700" },
    resolved: { bg: "bg-green-100", text: "text-green-700" },
    closed: { bg: "bg-gray-100", text: "text-gray-600" }
};

const priorityColors = {
    low: { bg: "bg-gray-100", text: "text-gray-700" },
    medium: { bg: "bg-blue-100", text: "text-blue-700" },
    high: { bg: "bg-orange-100", text: "text-orange-700" },
    urgent: { bg: "bg-red-100", text: "text-red-700" }
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

// Widget Modal

function WidgetModal({ isEditing, form, onChange, onSave, onClose }) {
    const handleDomainsChange = (value) => {
        const domains = value.split(/[,\n]/).map(d => d.trim()).filter(d => d);
        onChange("allowedDomains", domains);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-800">
                        {isEditing ? "Edit Widget" : "Create New Widget"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Widget Name
                        </label>
                        <input
                            type="text"
                            placeholder="Enter chat-widget name"
                            value={form.name}
                            onChange={(e) => onChange("name", e.target.value)}
                            className="w-full h-10 border border-gray-200 rounded-lg px-4 text-sm text-gray-800 outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Company ID
                        </label>
                        <input
                            type="text"
                            placeholder="NIRVISTA001"
                            value={form.companyID}
                            onChange={(e) => onChange("companyID", e.target.value)}
                            disabled={isEditing}
                            className="w-full h-10 border border-gray-200 rounded-lg px-4 text-sm text-gray-800 font-mono outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all disabled:bg-gray-50 disabled:text-gray-400"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Allowed Domains (comma or newline separated)
                        </label>
                        <textarea
                            placeholder="example.com, app.example.com"
                            value={form.allowedDomains?.join(", ") || ""}
                            onChange={(e) => handleDomainsChange(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-800 outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all resize-none"
                        />
                    </div>

                    {isEditing && (
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Active
                            </label>
                            <button
                                type="button"
                                onClick={() => onChange("isActive", !form.isActive)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${
                                    form.isActive ? "bg-[#13A8A5]" : "bg-gray-300"
                                }`}
                            >
                                <span
                                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                        form.isActive ? "left-6" : "left-1"
                                    }`}
                                />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        className="px-5 py-2 text-sm rounded-lg bg-[#13A8A5] text-white font-semibold hover:bg-[#0b7d7b] transition-colors"
                    >
                        {isEditing ? "Save Changes" : "Create Widget"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Delete confirmation

function DeleteModal({ onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                <p className="text-gray-800 font-semibold mb-1">Delete this widget?</p>
                <p className="text-gray-400 text-sm mb-6">This action cannot be undone.</p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2 text-sm rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// Tickets Modal

function TicketsModal({ widget, tickets, loading, onClose, onTicketClick }) {
    const formatDate = (date) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-gray-800">
                            Tickets from {widget.name}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Widget ID: <code className="bg-gray-100 px-1 rounded">{widget.widgetId}</code>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="animate-pulse bg-gray-50 rounded-xl p-4">
                                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                                </div>
                            ))}
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center py-12">
                            <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No tickets found for this widget</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tickets.map((ticket) => (
                                <div
                                    key={ticket.ticketId}
                                    onClick={() => onTicketClick(ticket.ticketId)}
                                    className="bg-gray-50 hover:bg-gray-100 rounded-xl p-4 cursor-pointer transition-colors border border-transparent hover:border-[#13A8A5]/30"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <code className="text-xs bg-white px-2 py-0.5 rounded font-mono text-gray-700 border">
                                                    {ticket.ticketId}
                                                </code>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[ticket.status]?.bg} ${statusColors[ticket.status]?.text}`}>
                                                    {ticket.status}
                                                </span>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityColors[ticket.priority]?.bg} ${priorityColors[ticket.priority]?.text}`}>
                                                    {ticket.priority}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-gray-800 truncate">
                                                {ticket.subject}
                                            </p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <User size={12} />
                                                    {ticket.customer?.name || "Anonymous"} ({ticket.customer?.email})
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {formatDate(ticket.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            {ticket.assignedAgentId ? (
                                                <p className="text-xs text-gray-500">
                                                    Assigned to: <span className="font-medium text-gray-700">{ticket.assignedAgentId.name}</span>
                                                </p>
                                            ) : (
                                                <p className="text-xs text-orange-600 font-medium">Unassigned</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-xs text-gray-500 text-center">
                        Click on a ticket to view details and chat
                    </p>
                </div>
            </div>
        </div>
    );
}

// Skeleton Row

function SkeletonRow() {
    return (
        <tr className="animate-pulse">
            <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-24" /></td>
            <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-32" /></td>
            <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-20" /></td>
            <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-40" /></td>
            <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-16" /></td>
            <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-20" /></td>
        </tr>
    );
}

// Copy Button

function CopyButton({ text, onClick }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Copy Widget ID"
        >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
        </button>
    );
}

// Main page

const emptyForm = { name: "", companyID: "", allowedDomains: [], isActive: true };

function ChatWidgets() {
    const navigate = useNavigate();
    const [widgets, setWidgets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const [deleteTargetId, setDeleteTargetId] = useState(null);

    const [search, setSearch] = useState("");
    const [searchField, setSearchField] = useState("all");
    const [page, setPage] = useState(1);

    // Tickets modal state
    const [selectedWidget, setSelectedWidget] = useState(null);
    const [widgetTickets, setWidgetTickets] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(false);

    // Data fetching

    async function loadWidgets() {
        setLoading(true);
        setError("");
        try {
            const res = await getChatWidgets();
            setWidgets(res.data.data ?? res.data ?? []);
        } catch (err) {
            setError("Could not load widgets. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadWidgets();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [search, searchField]);

    // Load tickets for a widget
    async function loadWidgetTickets(widgetId) {
        setLoadingTickets(true);
        try {
            const res = await getTickets({ widgetId, limit: 100 });
            const data = res.data.data ?? res.data;
            setWidgetTickets(data.tickets ?? data ?? []);
        } catch (err) {
            console.error("Error loading tickets:", err);
            setWidgetTickets([]);
        } finally {
            setLoadingTickets(false);
        }
    }

    // Handle widget click
    function handleWidgetClick(widget) {
        setSelectedWidget(widget);
        loadWidgetTickets(widget.widgetId);
    }

    // Handle ticket click - navigate to ticket chat
    function handleTicketClick(ticketId) {
        navigate(`/tickets/${ticketId}`);
    }

    // Filtering & pagination

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return widgets;

        return widgets.filter((widget) => {
            if (searchField === "name") return widget.name?.toLowerCase().includes(q);
            if (searchField === "widgetId") return widget.widgetId?.toLowerCase().includes(q);
            if (searchField === "companyID") return widget.companyID?.toLowerCase().includes(q);
            return (
                widget.name?.toLowerCase().includes(q) ||
                widget.widgetId?.toLowerCase().includes(q) ||
                widget.companyID?.toLowerCase().includes(q) ||
                widget.allowedDomains?.some(d => d.toLowerCase().includes(q))
            );
        });
    }, [widgets, search, searchField]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageSlice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // CRUD handlers

    function openCreate() {
        setForm(emptyForm);
        setEditId(null);
        setShowModal(true);
    }

    function openEdit(e, widget) {
        e.stopPropagation();
        setForm({
            name: widget.name,
            companyID: widget.companyID || "",
            allowedDomains: widget.allowedDomains || [],
            isActive: widget.isActive !== false,
        });
        setEditId(widget.widgetId);
        setShowModal(true);
    }

    function handleFieldChange(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSave() {
        setError("");
        try {
            if (editId) {
                const payload = {
                    name: form.name,
                    allowedDomains: form.allowedDomains,
                    isActive: form.isActive,
                };
                await updateChatWidget(editId, payload);
            } else {
                await createChatWidget(form);
            }
            setShowModal(false);
            loadWidgets();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save widget. Please try again.");
        }
    }

    function handleDeleteClick(e, widgetId) {
        e.stopPropagation();
        setDeleteTargetId(widgetId);
    }

    async function handleDelete() {
        setError("");
        try {
            await deleteChatWidget(deleteTargetId);
            setDeleteTargetId(null);
            loadWidgets();
        } catch (err) {
            setError("Failed to delete widget. Please try again.");
            setDeleteTargetId(null);
        }
    }

    // Render

    const hasSearch = search.length > 0;

    return (
        <Layout pageTitle="Chat Widgets">
            <div className="max-w-6xl">
                {/* Top bar */}
                <div className="flex items-center justify-between mb-5">
                    <p className="text-sm text-gray-500">
                        {loading
                            ? "Loading..."
                            : hasSearch
                                ? `${filtered.length} of ${widgets.length} widgets`
                                : `${widgets.length} ${widgets.length === 1 ? "widget" : "widgets"} total`}
                    </p>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#13A8A5] text-white text-sm font-semibold rounded-xl hover:bg-[#0b7d7b] transition-colors shadow-sm"
                    >
                        <Plus size={16} />
                        Create Widget
                    </button>
                </div>

                {/* Search bar */}
                <div className="flex flex-wrap gap-3 mb-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search widgets..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-10 pl-9 pr-4 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all"
                        />
                    </div>
                    <select
                        value={searchField}
                        onChange={(e) => setSearchField(e.target.value)}
                        className="h-10 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 outline-none focus:border-[#13A8A5] transition-all"
                    >
                        <option value="all">All Fields</option>
                        <option value="widgetId">Widget ID</option>
                        <option value="name">Name</option>
                        <option value="companyID">Company ID</option>
                    </select>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/60 border-b border-gray-100 text-left">
                                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Widget ID</th>
                                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Name</th>
                                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Company ID</th>
                                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Allowed Domains</th>
                                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                                ) : pageSlice.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                                            {hasSearch ? "No widgets match your search." : "No widgets found."}
                                        </td>
                                    </tr>
                                ) : (
                                    pageSlice.map((widget) => (
                                        <tr 
                                            key={widget.widgetId} 
                                            onClick={() => handleWidgetClick(widget)}
                                            className="hover:bg-[#13A8A5]/5 transition-colors cursor-pointer"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                                                        {widget.widgetId}
                                                    </code>
                                                    <CopyButton text={widget.widgetId} />
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 font-medium text-gray-800">{widget.name}</td>
                                            <td className="px-5 py-4 font-mono text-gray-600 text-xs">{widget.companyID}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {widget.allowedDomains?.slice(0, 2).map((domain, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                                                        >
                                                            <Globe size={10} />
                                                            {domain}
                                                        </span>
                                                    ))}
                                                    {widget.allowedDomains?.length > 2 && (
                                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                                            +{widget.allowedDomains.length - 2} more
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                                        widget.isActive !== false
                                                            ? "bg-green-100 text-green-700"
                                                            : "bg-gray-100 text-gray-600"
                                                    }`}
                                                >
                                                    {widget.isActive !== false ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={(e) => openEdit(e, widget)}
                                                        className="px-3 py-1.5 text-xs font-medium text-[#13A8A5] hover:bg-[#13A8A5]/10 rounded-lg transition-colors"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteClick(e, widget.widgetId)}
                                                        className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!loading && totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500">
                                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage((p) => p - 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                {getPaginationRange(page, totalPages).map((p, i) =>
                                    p === "..." ? (
                                        <span key={i} className="px-1 text-gray-400 text-sm">...</span>
                                    ) : (
                                        <button
                                            key={i}
                                            onClick={() => setPage(p)}
                                            className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                                                p === page
                                                    ? "bg-[#13A8A5] text-white font-semibold"
                                                    : "hover:bg-gray-100 text-gray-600"
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                                <button
                                    disabled={page === totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Help text */}
                <p className="text-xs text-gray-400 mt-3 text-center">
                    Click on any widget row to view all tickets created from that widget
                </p>

                {/* Modals */}
                {showModal && (
                    <WidgetModal
                        isEditing={!!editId}
                        form={form}
                        onChange={handleFieldChange}
                        onSave={handleSave}
                        onClose={() => setShowModal(false)}
                    />
                )}
                {deleteTargetId && (
                    <DeleteModal
                        onConfirm={handleDelete}
                        onCancel={() => setDeleteTargetId(null)}
                    />
                )}
                {selectedWidget && (
                    <TicketsModal
                        widget={selectedWidget}
                        tickets={widgetTickets}
                        loading={loadingTickets}
                        onClose={() => setSelectedWidget(null)}
                        onTicketClick={handleTicketClick}
                    />
                )}
            </div>
        </Layout>
    );
}

export default ChatWidgets;