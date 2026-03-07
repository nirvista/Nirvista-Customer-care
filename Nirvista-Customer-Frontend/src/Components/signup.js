import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminSignup } from "../api/authapi";

function BrandPanel() {
    return (
        <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#0b7d7b] to-[#13A8A5] flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10" />
            <div className="absolute -bottom-24 -right-16 w-96 h-96 rounded-full bg-white/10" />
            <div className="absolute top-1/2 left-10 w-20 h-20 rounded-full bg-white/5" />
            <div className="relative z-10 flex flex-col items-center text-center px-12">
                <img src="/logo/logo.png" alt="Nirvista" className="h-16 object-contain mb-8" />
                <h1 className="text-3xl font-bold text-white mb-3">Join Nirvista</h1>
                <p className="text-white/70 text-base leading-relaxed max-w-xs">
                    Sign up and start delivering exceptional customer support today.
                </p>
                <div className="mt-10 flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                    <div className="w-6 h-2 rounded-full bg-white" />
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                </div>
            </div>
        </div>
    );
}

function Signup() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [companyID, setCompanyID] = useState("");
    const [error, setError] = useState("");

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            await adminSignup({ name, email, password, companyID });
            navigate("/login");
        } catch (err) {
            setError(err.response?.data?.message || "Server error. Please try again later.");
        }
    };

    return (
        <div className="flex h-screen">
            <BrandPanel />

            <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-8 py-12 overflow-y-auto">
                <div className="w-full max-w-sm">
                    <div className="flex lg:hidden justify-center mb-8">
                        <img src="/logo/logo.png" alt="Nirvista" className="h-10 object-contain" />
                    </div>

                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Sign Up</h2>
                   

                    {error && (
                        <div className="mb-8 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                            <input
                                type="text"
                                required
                                className="w-full h-11 border border-gray-200 rounded-lg px-4 text-sm text-gray-800 outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all"
                                placeholder="your name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                            <input
                                type="email"
                                required
                                className="w-full h-11 border border-gray-200 rounded-lg px-4 text-sm text-gray-800 outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all"
                                placeholder="you@company.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                            <input
                                type="password"
                                required
                                className="w-full h-11 border border-gray-200 rounded-lg px-4 text-sm text-gray-800 outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company ID</label>
                            <input
                                type="text"
                                required
                                className="w-full h-11 border border-gray-200 rounded-lg px-4 text-sm text-gray-800 outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all"
                                placeholder="NIRVISTA123"
                                onChange={e => setCompanyID(e.target.value)}
                                value={companyID}
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full h-11 bg-[#13A8A5] hover:bg-[#0b7d7b] text-white font-semibold rounded-lg transition-colors mt-2"
                        >
                            Sign Up
                        </button>
                    </form>

                    <p className="text-center text-sm text-gray-500 mt-6">
                        Already have an account?{" "}
                        <Link to="/" className="text-[#13A8A5] hover:text-[#0b7d7b] font-medium">
                            Login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Signup;
