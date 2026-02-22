import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplets, Lock, ArrowRight, Loader2, Mail, UserPlus, Eye, EyeOff, User, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const navigate = useNavigate();
  const { login, signup, authError } = useAuth();

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      toast.error("Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.");
    }
  }, []);

  // Auto-rotate carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % carouselContent.length);
    }, 5000); // Change slide every 5 seconds

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
    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result?.user) {
        toast.success("Login successful!");
        const userRole = result?.user?.user_metadata?.user_role;

        if (userRole === "technician") {
          navigate("/TechnicianHome", { replace: true });
        } else if (userRole === "admin" || userRole === "supervisor") {
          navigate("/AdminDashboard", { replace: true });
        } else {
          navigate("/RoleSelection", { replace: true });
        }
      } else {
        toast.error("Login failed: No user data received");
      }
    } catch (error) {
      console.error("Login error:", error);

      // Handle specific error cases - show only one toast per error
      if (error.code === 'email_not_confirmed' || error.message?.includes('Email not confirmed')) {
        toast.error("Please verify your email address before signing in.");
      } else if (error.message?.includes('not configured')) {
        toast.error("Configuration error: Please check your Supabase settings");
      } else if (error.message?.includes('Email and password are required')) {
        toast.error("Please enter both email and password");
      } else {
        // Use error message from the caught error, or default message
        // Don't use authError here to avoid duplicate toasts
        const errorMessage = error.message || "Invalid login credentials";
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!email || !password || !confirmPassword) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!selectedRole) {
      toast.error("Please select your role");
      return;
    }

    setIsLoading(true);

    try {
      const metadata = {
        full_name: fullName || email.split('@')[0],
        user_role: selectedRole
      };

      const result = await signup(email, password, metadata);

      if (result?.user) {
        toast.success("Account created successfully! Please check your email to verify your account.");

        if (result.session) {
          const userRole = result?.user?.user_metadata?.user_role;

          if (userRole === "technician") {
            navigate("/TechnicianHome", { replace: true });
          } else if (userRole === "admin" || userRole === "supervisor") {
            navigate("/AdminDashboard", { replace: true });
          } else {
            navigate("/RoleSelection", { replace: true });
          }
        } else {
          toast.info("Please check your email to verify your account before signing in.");
          setIsSignup(false);
          setEmail("");
          setPassword("");
          setConfirmPassword("");
        }
      } else {
        toast.error("Signup failed: No user data received");
      }
    } catch (error) {
      console.error("Signup error:", error);
      if (error.message?.includes('not configured')) {
        toast.error("Configuration error: Please check your Supabase settings");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/3 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-white dark:bg-gray-900 overflow-y-auto">
        <div className="w-full max-w-md py-4">
          {/* Logo */}
          <div className={`flex items-center justify-center ${isSignup ? "mb-4 sm:mb-6" : "mb-3 sm:mb-4"}`}>
            <img 
              src="/images/logofull.png" 
              alt="Roberts Quality Irrigation LLC Logo" 
              className="h-24 sm:h-28 w-auto object-contain"
            />
          </div>

          {/* Form Header */}
          <div className={isSignup ? "mb-4 sm:mb-6" : "mb-3 sm:mb-4"}>
            <h1 className={`${isSignup ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"} font-bold text-gray-900 dark:text-white ${isSignup ? "mb-1" : "mb-0.5"}`}>
              {isSignup ? "Create Account" : "Sign In"}
            </h1>
            <p className={`${isSignup ? "text-sm sm:text-base" : "text-xs sm:text-sm"} text-gray-600 dark:text-gray-400`}>
              {isSignup ? "Join Roberts Quality Irrigation LLC to manage your field operations" : "Welcome back! Please sign in to continue"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={isSignup ? handleSignup : handleLogin} className={isSignup ? "space-y-3 sm:space-y-4" : "space-y-2 sm:space-y-3"}>
            {/* Role Selection - Signup only */}
            {isSignup && (
              <div className="animate-fade-in">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Select your role <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedRole || ""}
                  onValueChange={(value) => setSelectedRole(value)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-11 sm:h-12 border-primary/30 dark:border-primary/50 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary">
                    <SelectValue placeholder="Choose role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Email - Full width */}
            <div>
              <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 ${isSignup ? "mb-1.5" : "mb-1"}`}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  placeholder="example@info.com"
                  className={`pl-10 ${isSignup ? "h-11 sm:h-12" : "h-10 sm:h-11"} border-primary/30 dark:border-primary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password and Confirm Password - Signup only (2 columns) */}
            {isSignup ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 animate-fade-in">
                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-11 sm:h-12 border-primary/30 dark:border-primary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={6}
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

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-11 sm:h-12 border-primary/30 dark:border-primary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
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
              </div>
            ) : (
              /* Password - Login only (full width) */
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••"
                    className={`pl-10 pr-10 ${isSignup ? "h-11 sm:h-12" : "h-10 sm:h-11"} border-primary/30 dark:border-primary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
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
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className={`w-full ${isSignup ? "h-11 sm:h-12" : "h-10 sm:h-11"} bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors ${isSignup ? "mt-2" : "mt-1"}`}
              disabled={
                isLoading ||
                !email ||
                !password ||
                (isSignup && (!confirmPassword || password !== confirmPassword || !selectedRole))
              }
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary-foreground" />
              ) : (
                isSignup ? "Sign Up" : "Sign In"
              )}
            </Button>

            {/* Toggle Sign In/Sign Up */}
            {/* <div className={`text-center ${isSignup ? "mt-3 sm:mt-4" : "mt-2 sm:mt-3"}`}>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isSignup ? "Already have an account?" : "Don't have an account?"}
                {" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(!isSignup);
                    setPassword("");
                    setConfirmPassword("");
                    setSelectedRole(null);
                    setFullName("");
                  }}
                  className="text-primary hover:text-primary/90 font-medium hover:underline"
                >
                  {isSignup ? "Sign in" : "Sign up"}
                </button>
              </p>
            </div> */}
          </form>

          {/* Copyright */}
          <div className="mt-4 sm:mt-6 text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <span>©</span>
              <span>Copyright {new Date().getFullYear()} Roberts Quality Irrigation LLC</span>
            </p>
          </div>
        </div>
      </div>
      
      {/* Right Side - Hero Section */}
      <div 
        className="hidden lg:flex lg:w-2/3 relative overflow-hidden flex-col"
        style={{
          backgroundImage: 'url(/images/fsm06.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Image Overlay for Opacity */}
        <div className="absolute inset-0 bg-black/30"></div>
        {/* Content Overlay at Bottom - Carousel */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-8">
          <div className="max-w-2xl mx-auto text-white relative">
            {/* Carousel Content */}
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

            {/* Carousel Controls */}
            <div className="flex items-center justify-between mt-6">
              {/* Dots Indicator */}
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

              {/* Navigation Arrows */}
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

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}