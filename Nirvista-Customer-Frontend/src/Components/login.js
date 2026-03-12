import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginUser } from "../api/authapi";

function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const res = await loginUser({ email, password });
            localStorage.setItem("token", res.data.data.token);
            localStorage.setItem("role", res.data.data.user.role);
            localStorage.setItem("companyID", res.data.data.user.companyID || "");
            navigate("/dashboard");
        } catch (err) {
            setError(err.response?.data?.message || "Invalid email or password.");
        }
    };

    return (
        <div className="flex h-screen">
            {/* Left branding panel */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#0b7d7b] to-[#13A8A5] flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10" />
                <div className="absolute -bottom-24 -right-16 w-96 h-96 rounded-full bg-white/10" />
                <div className="absolute top-1/2 left-10 w-20 h-20 rounded-full bg-white/5" />

                <div className="relative z-10 flex flex-col items-center text-center px-12">
                    <img src="/logo/logo.png" alt="Nirvista" className="h-16 object-contain mb-8" />
                    <h1 className="text-3xl font-bold text-white mb-3">Nirvista Customer Care</h1>
                    <p className="text-white/70 text-base leading-relaxed max-w-xs">
                        Manage your support team, track agents, and deliver exceptional customer experiences at scale.
                    </p>
                    <div className="mt-10 flex gap-3">
                        <div className="w-2 h-2 rounded-full bg-white/40" />
                        <div className="w-6 h-2 rounded-full bg-white" />
                        <div className="w-2 h-2 rounded-full bg-white/40" />
                    </div>
                </div>
            </div>

            {/* Right form panel */}
            <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-8 py-12">
                <div className="w-full max-w-sm">
                    <div className="flex lg:hidden justify-center mb-8">
                        <img src="/logo/logo.png" alt="Nirvista" className="h-10 object-contain" />
                    </div>

                    <h2 className="text-2xl font-bold text-gray-800 mb-1">Welcome back !</h2>
                    <p className="text-gray-500 text-sm mb-8">Login to your account to continue</p>

                    {error && (
                        <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
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
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="w-full h-11 border border-gray-200 rounded-lg px-4 pr-11 text-sm text-gray-800 outline-none focus:border-[#13A8A5] focus:ring-2 focus:ring-[#13A8A5]/20 transition-all"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(prev => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#13A8A5] transition-colors"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="w-full text-right">
                            <Link to="#" className="text-[#13A8A5] hover:text-[#0b7d7b] font-medium text-sm hover:underline">
                                Forgot password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            className="w-full h-11 bg-[#13A8A5] hover:bg-[#0b7d7b] text-white font-semibold rounded-lg transition-colors mt-2"
                        >
                            Login
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Login;