import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/api/auth/login", {
        username,
        password,
      });

      const { token, user } = response.data;
      login(token, user || { username, role: response.data.role });
      navigate("/dashboard");
    } catch (exception) {
      setError("Unable to sign in. Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto flex w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="hidden w-1/2 bg-gradient-to-br from-[#1B3A6B] to-[#E8500A] p-12 text-white lg:block">
          <div className="space-y-6">
            <h2 className="text-4xl font-bold">VoltEdge Commerce</h2>
            <p className="max-w-sm text-lg leading-8 text-slate-100">
              Fast, secure retail operations for modern stores. Manage
              inventory, run the register, and review performance in one unified
              platform.
            </p>
            <div className="rounded-3xl bg-white/10 p-6 shadow-lg shadow-black/10">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-200">
                Demo accounts
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-100">
                <li>
                  username: kukat_supervisor - (store_supervisor) / password123
                </li>
                <li>username: associate1 -(sales_associate) / password123</li>
                <li>username: admin / password123</li>
                <li>username: south_manager-(regional_manager)/ password123</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="w-full p-10 sm:p-12 lg:w-1/2">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.35em] text-orange-500">
              Welcome back
            </p>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
              Sign in to your account
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              Use your VoltEdge credentials to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Username
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
                autoComplete="username"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Password
              </span>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-3xl bg-[#1B3A6B] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f2c56] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
