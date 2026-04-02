import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState("checking"); // 'checking' | 'ready' | 'invalid'
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { updatePassword, logout } = useAuth();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    let subscription = { unsubscribe: () => {} };
    let timeoutId;

    const resolveSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return !!session?.user;
    };

    const finish = (nextStatus) => {
      setStatus((prev) => (prev === "checking" ? nextStatus : prev));
    };

    (async () => {
      const hasSession = await resolveSession();
      if (hasSession) {
        finish("ready");
        return;
      }

      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" || (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED"))) {
          finish("ready");
        }
      });
      subscription = sub;

      timeoutId = setTimeout(async () => {
        const hasSessionNow = await resolveSession();
        if (!hasSessionNow) finish("invalid");
        subscription.unsubscribe();
      }, 4000);
    })();

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe?.();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      toast.success("Password updated. Sign in with your new password.");
      await logout(false);
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(err.message || "Failed to update password. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-white dark:bg-gray-900">
      <div className="w-full max-w-md py-4">
        <div className="flex items-center justify-center mb-6">
          <img
            src="/images/logofull.png"
            alt="Roberts Quality Irrigation LLC Logo"
            className="h-20 sm:h-24 w-auto object-contain"
          />
        </div>

        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Set new password
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {status === "checking"
              ? "Checking your reset link…"
              : status === "invalid"
                ? "This link is invalid or has expired."
                : "Choose a new password for your account."}
          </p>
        </div>

        {status === "checking" && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        )}

        {status === "invalid" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Request a new password reset from the sign-in page.
            </p>
            <Button
              type="button"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => navigate("/login", { replace: true })}
            >
              Back to sign in
            </Button>
          </div>
        )}

        {status === "ready" && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11 border-primary/30 dark:border-primary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm new password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11 border-primary/30 dark:border-primary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium"
              disabled={
                isSubmitting ||
                password.length < 6 ||
                password !== confirmPassword
              }
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary-foreground" />
              ) : (
                "Set new password"
              )}
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="text-sm text-primary hover:text-primary/90 font-medium hover:underline"
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            © Copyright {new Date().getFullYear()} Roberts Quality Irrigation LLC
          </p>
        </div>
      </div>
    </div>
  );
}
