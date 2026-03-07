import { useEffect, useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import Layout from "../Components/Layout";
import {
    createCompany,
    getCompanies,
    updateCompany,
    deleteCompany,
} from "../api/companyapi";

const PAGE_SIZE = 5;

function getInitials(name = "") {
    return name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";
}

function getPaginationRange(current, total) {
    const range = [];
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - current) <= 1) {
            range.push(i);
        }
    }
    // Insert ellipsis where there are gaps
    const withEllipsis = [];
    for (let i = 0; i < range.length; i++) {
        if (i > 0 && range[i] - range[i - 1] > 1) {
            withEllipsis.push("...");
        }
        withEllipsis.push(range[i]);
    }
    return withEllipsis;
}

// Modal

function CompanyModal({ isEditing, form, onChange, onSave, onClose }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-800">
                        {isEditing ? "Edit Company" : "Add New Company"}
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
                            Company Name
                        </label>
                        <input
                            type="text"
                            placeholder="Nirvista Pvt Ltd"
                            value={form.name}
                            onChange={(e) => onChange("name", e.target.value)}
                            className="w-full h-10 border border-gray-200 rounded-lg px-4 text-sm text-gray-800 outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Company Code
                        </label>
                        <input
                            type="text"
                            placeholder="NIR"
                            value={form.code}
                            onChange={(e) => onChange("code", e.target.value.toUpperCase())}
                            className="w-full h-10 border border-gray-200 rounded-lg px-4 text-sm text-gray-800 font-mono outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all"
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
                            className="w-full h-10 border border-gray-200 rounded-lg px-4 text-sm text-gray-800 outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all"
                        />
                    </div>
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
                        Save Company
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
                <p className="text-gray-800 font-semibold mb-1">Delete this company?</p>
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

//  Main page 

const emptyForm = { name: "", code: "", companyID: "" };

function Companies() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const [deleteTargetId, setDeleteTargetId] = useState(null);

    const [search, setSearch] = useState("");
    const [searchField, setSearchField] = useState("all");
    const [page, setPage] = useState(1);


    async function loadCompanies() {
        setLoading(true);
        setError("");
        try {
            const res = await getCompanies();
            setCompanies(res.data.data ?? res.data ?? []);
        } catch (err) {
            setError("Could not load companies. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadCompanies();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [search, searchField]);

    // Filtering & pagination

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return companies;

        return companies.filter((c) => {
            if (searchField === "name")      return c.name?.toLowerCase().includes(q);
            if (searchField === "code")      return c.code?.toLowerCase().includes(q);
            if (searchField === "companyID") return c.companyID?.toLowerCase().includes(q);
            return (
                c.name?.toLowerCase().includes(q) ||
                c.code?.toLowerCase().includes(q) ||
                c.companyID?.toLowerCase().includes(q)
            );
        });
    }, [companies, search, searchField]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageSlice  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // CRUD handlers 

    function openCreate() {
        setForm(emptyForm);
        setEditId(null);
        setShowModal(true);
    }

    function openEdit(company) {
        setForm({
            name:      company.name,
            code:      company.code,
            companyID: company.companyID || "",
        });
        setEditId(company._id);
        setShowModal(true);
    }

    function handleFieldChange(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSave() {
        setError("");
        try {
            if (editId) {
                await updateCompany(editId, form);
            } else {
                await createCompany(form);
            }
            setShowModal(false);
            loadCompanies();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save. Please try again.");
        }
    }

    async function handleDelete() {
        setError("");
        try {
            await deleteCompany(deleteTargetId);
            setDeleteTargetId(null);
            loadCompanies();
        } catch (err) {
            setError("Failed to delete company. Please try again.");
            setDeleteTargetId(null);
        }
    }

    //Render 

    const hasSearch = search.length > 0;

    return (
        <Layout pageTitle="Companies">
            <div className="max-w-5xl">

                {/* Top bar */}
                <div className="flex items-center justify-between mb-5">
                    <p className="text-sm text-gray-500">
                        {loading
                            ? "Loading..."
                            : hasSearch
                                ? `${filtered.length} of ${companies.length} companies`
                                : `${companies.length} ${companies.length === 1 ? "company" : "companies"} total`}
                    </p>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#13A8A5] text-white text-sm font-semibold rounded-xl hover:bg-[#0b7d7b] transition-colors shadow-sm"
                    >
                        <Plus size={16} />
                        Add Company
                    </button>
                </div>

                {/* Search bar */}
                <div className="flex flex-wrap gap-3 mb-4">
                    <div className="flex flex-1 min-w-[260px] border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#13A8A5] focus-within:ring-2 focus-within:ring-[#13A8A5]/20 transition-all bg-white">
                        <select
                            value={searchField}
                            onChange={(e) => setSearchField(e.target.value)}
                            className="h-10 pl-3 pr-7 text-sm text-gray-700 bg-gray-50 border-r border-gray-200 outline-none cursor-pointer font-medium"
                        >
                            <option value="all">All Fields</option>
                            <option value="name">Company Name</option>
                            <option value="code">Code</option>
                            <option value="companyID">Company ID</option>
                        </select>
                        <div className="relative flex-1 flex items-center">
                            <Search size={15} className="absolute left-3 text-gray-400 pointer-events-none" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search companies..."
                                className="w-full h-10 pl-9 pr-4 text-sm text-gray-800 outline-none bg-transparent placeholder-gray-400"
                            />
                        </div>
                    </div>

                    {hasSearch && (
                        <button
                            onClick={() => { setSearch(""); setSearchField("all"); }}
                            className="h-10 px-4 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Error banner */}
                {error && (
                    <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-center justify-between gap-3">
                        <span>{error}</span>
                        <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 flex-shrink-0">
                            <X size={15} />
                        </button>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="w-8 h-8 border-2 border-[#13A8A5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-gray-400 text-sm">Loading companies...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-gray-500 font-medium">
                                {hasSearch ? "No results found" : "No companies yet"}
                            </p>
                            <p className="text-gray-400 text-sm mt-1">
                                {hasSearch
                                    ? "Try a different search term."
                                    : "Click 'Add Company' to create your first one."}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">Company</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">Code</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">Company ID</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageSlice.map((company, idx) => (
                                    <tr
                                        key={company._id}
                                        className={`border-b border-gray-50 hover:bg-[#f0fafa] transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 text-xs font-bold flex-shrink-0">
                                                    {getInitials(company.name)}
                                                </div>
                                                <span className="font-medium text-gray-800">{company.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                {company.code || "—"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                {company.companyID || "—"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openEdit(company)}
                                                    className="px-3 py-1.5 text-xs rounded-lg border border-[#13A8A5]/40 text-[#0b7d7b] hover:bg-[#13A8A5] hover:text-white hover:border-[#13A8A5] transition-colors font-medium"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTargetId(company._id)}
                                                    className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-medium"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {!loading && filtered.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4 px-1">
                        <p className="text-xs text-gray-400">
                            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
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

            {/* Modals */}
            {showModal && (
                <CompanyModal
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
        </Layout>
    );
}

export default Companies;