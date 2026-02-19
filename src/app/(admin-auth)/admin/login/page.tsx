"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error. Try again.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-600/30">
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
            <p className="text-sm text-slate-400 mt-1">JobPilot System Administration</p>
          </div>
        </div>

        {/* Card */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-800/80 backdrop-blur-sm p-6 shadow-2xl ring-1 ring-slate-700/60">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 ring-1 ring-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400 font-medium">{error}</p>
              </div>
            )}

            <div>
              <Label htmlFor="admin-user" className="text-xs font-medium text-slate-300">
                Username
              </Label>
              <Input
                id="admin-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="mt-1.5 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <Label htmlFor="admin-pass" className="text-xs font-medium text-slate-300">
                Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="admin-pass"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className="w-full h-10 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium shadow-lg shadow-violet-600/20"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-1.5" />
              )}
              Sign in to Admin
            </Button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-500">
          This is the admin panel. Not an admin?{" "}
          <a href="/login" className="text-violet-400 hover:text-violet-300 underline">
            Go to user login
          </a>
        </p>
      </div>
    </div>
  );
}
