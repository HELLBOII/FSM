import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Loader2, Eye, EyeOff, User, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

const carouselContent = [
  {
    title: "Field Service Management for Irrigation",
    description: "Streamline your irrigation field operations with our comprehensive FSM solution. Manage service requests, schedule technicians, and track work progress seamlessly.",
    features: [
      {
        title: "Irrigation Process Management",
        description: "Track maintenance, repairs, and installations across all irrigation systems"
      },
      {
        title: "Technician Coordination",
        description: "Assign jobs, monitor field operations, and optimize technician schedules"
      },
      {
        title: "Real-time Tracking",
        description: "Monitor job status, technician locations, and work completion in real-time"
      },
      {
        title: "Work Reports & Analytics",
        description: "Generate detailed reports and insights for better decision making"
      }
    ]
  },
  {
    title: "Efficient Service Request Management",
    description: "Create, assign, and track service requests from initiation to completion. Ensure timely response and resolution for all irrigation system issues.",
    features: [
      {
        title: "Request Creation",
        description: "Quickly create service requests with detailed issue descriptions and photos"
      },
      {
        title: "Smart Assignment",
        description: "Automatically assign technicians based on skills, location, and availability"
      },
      {
        title: "Status Tracking",
        description: "Track request status from assigned to completed with real-time updates"
      },
      {
        title: "Client Communication",
        description: "Keep clients informed with automated notifications and status updates"
      }
    ]
  },
  {
    title: "Advanced Scheduling & Planning",
    description: "Optimize your field operations with intelligent scheduling, route planning, and resource allocation for maximum efficiency.",
    features: [
      {
        title: "Calendar Integration",
        description: "View and manage all scheduled jobs in an intuitive calendar interface"
      },
      {
        title: "Route Optimization",
        description: "Plan efficient routes to minimize travel time and maximize productivity"
      },
      {
        title: "Resource Allocation",
        description: "Assign equipment and materials to jobs for seamless execution"
      },
      {
        title: "Capacity Planning",
        description: "Balance workload across technicians for optimal resource utilization"
      }
    ]
  }
];

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const navigate = useNavigate();
  const { login, resetPasswordForEmail } = useAuth();

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      toast.error("Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.");
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % carouselContent.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const nextSlide = () => {
    setCarouselIndex((prev) => (prev + 1) % carouselContent.length);
  };

  const prevSlide = () => {
    setCarouselIndex((prev) => (prev - 1 + carouselContent.length) % carouselContent.length);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmedUsername = username?.trim();
    if (!trimmedUsername || !password) {
      toast.error("Please enter both username and password");
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(trimmedUsername, password);

      if (result?.user) {
        toast.success("Login successful!");
        const userRole = result?.user?.user_metadata?.user_role;

        if (userRole === "technician") {
          navigate("/TechnicianHome", { replace: true });
        } else if (userRole === "admin" || userRole === "supervisor") {
          navigate("/AdminDashboard", { replace: true });
        } else if (userRole === "client") {
          navigate("/ClientDashboard", { replace: true });
        } else {
          navigate("/RoleSelection", { replace: true });
        }
      } else {
        toast.error("Login failed: No user data received");
      }
    } catch (error) {
      console.error("Login error:", error);

      if (error.message?.includes("not configured")) {
        toast.error("Configuration error: Please check your Supabase settings");
      } else if (error.message?.includes("Username and password are required")) {
        toast.error("Please enter both username and password");
      } else {
        const errorMessage = error.message || "Invalid login credentials";
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const trimmedUsername = username?.trim();
    if (!trimmedUsername) {
      toast.error("Please enter your username");
      return;
    }
    setIsSendingReset(true);
    try {
      await resetPasswordForEmail(trimmedUsername);
      toast.success("If an account exists for this username, you will receive a password reset link.");
      setIsForgotPassword(false);
    } catch (err) {
      toast.error(err.message || "Failed to send reset link. Try again later.");
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="w-full lg:w-1/3 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-white dark:bg-gray-900 overflow-y-auto">
        <div className="w-full max-w-md py-4">
          <div className="flex items-center justify-center mb-3 sm:mb-4">
            <img
              src="/images/logofull.png"
              alt="Roberts Quality Irrigation LLC Logo"
              className="h-24 sm:h-28 w-auto object-contain"
            />
          </div>

          <div className={isForgotPassword ? "mb-3 sm:mb-4" : "mb-3 sm:mb-4"}>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-0.5">
              {isForgotPassword ? "Reset password" : "Sign In"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {isForgotPassword
                ? "Enter your username and we'll send you a link to reset your password."
                : "Welcome back! Please sign in to continue"}
            </p>
          </div>

          <form
            onSubmit={isForgotPassword ? handleForgotPassword : handleLogin}
            className="space-y-2 sm:space-y-3"
          >
            {isForgotPassword ? (
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="e.g. 1234 or abcd123"
                      className="pl-10 h-10 sm:h-11 border-primary/30 dark:border-primary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      disabled={isSendingReset}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-10 sm:h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium"
                  disabled={!username?.trim() || isSendingReset}
                >
                  {isSendingReset ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary-foreground" />
                  ) : (
                    "Send reset link"
                  )}
                </Button>
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="text-sm text-primary hover:text-primary/90 font-medium hover:underline"
                  >
                    Back to sign in
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="e.g. 1234 or abcd123"
                      className="pl-10 h-10 sm:h-11 border-primary/30 dark:border-primary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••"
                      className="pl-10 pr-10 h-10 sm:h-11 border-primary/30 dark:border-primary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
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

                <Button
                  type="submit"
                  className="w-full h-10 sm:h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors mt-1"
                  disabled={isLoading || !username?.trim() || !password}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary-foreground" />
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </>
            )}
          </form>

          <div className="mt-4 sm:mt-6 text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <span>©</span>
              <span>Copyright {new Date().getFullYear()} Roberts Quality Irrigation LLC</span>
            </p>
          </div>
        </div>
      </div>

      <div
        className="hidden lg:flex lg:w-2/3 relative overflow-hidden flex-col"
        style={{
          backgroundImage: 'url(/images/fsm06.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-8">
          <div className="max-w-2xl mx-auto text-white relative">
            <div className="relative overflow-hidden min-h-[280px]">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
              >
                {carouselContent.map((content, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-2">
                    <h2 className="text-2xl font-bold mb-4">{content.title}</h2>
                    <div className="space-y-3 text-sm leading-relaxed">
                      <p className="opacity-90">{content.description}</p>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        {content.features.map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                            <div>
                              <p className="font-semibold mb-1">{feature.title}</p>
                              <p className="opacity-80 text-xs">{feature.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-2">
                {carouselContent.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCarouselIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === carouselIndex ? 'bg-primary w-8' : 'bg-white/40'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={prevSlide}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextSlide}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
