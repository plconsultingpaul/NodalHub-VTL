import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  LayoutDashboard,
  Network,
  Workflow,
} from 'lucide-react';

const features = [
  {
    icon: LayoutDashboard,
    title: 'Custom Dashboards',
    description: 'Build interactive dashboards from any API or data source.',
  },
  {
    icon: Network,
    title: 'API Integration',
    description: 'Connect to REST APIs with secure proxy and parameter mapping.',
  },
  {
    icon: Workflow,
    title: 'Pulse Monitoring',
    description: 'Track real-time signals and KPIs across your operations.',
  },
];

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [loginLogoSize, setLoginLogoSize] = useState(100);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from('companies')
      .select('logo_url, login_logo_size')
      .not('logo_url', 'is', null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.logo_url) setCompanyLogo(data.logo_url);
        if (data?.login_logo_size) setLoginLogoSize(data.login_logo_size);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setError('');
    setLoading(true);

    const { error } = await signIn(emailOrUsername.trim(), password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex">
      <div
        className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.3) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
          <div
            className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full blur-3xl opacity-30 animate-float-slow"
            style={{
              background:
                'radial-gradient(circle, rgba(56,189,248,0.55) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute top-1/3 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-25 animate-float-medium"
            style={{
              background:
                'radial-gradient(circle, rgba(236,72,153,0.45) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute -bottom-40 left-1/4 w-[600px] h-[600px] rounded-full blur-3xl opacity-20 animate-float-slow"
            style={{
              background:
                'radial-gradient(circle, rgba(34,197,94,0.4) 0%, transparent 70%)',
            }}
          />

          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
              </linearGradient>
            </defs>
            {Array.from({ length: 8 }).map((_, i) => (
              <path
                key={i}
                d={`M 0 ${200 + i * 80} Q 250 ${150 + i * 80} 500 ${
                  220 + i * 80
                } T 1000 ${180 + i * 80}`}
                stroke="url(#line-gradient)"
                strokeWidth="1.2"
                fill="none"
                opacity={0.4 - i * 0.03}
              />
            ))}
          </svg>
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div className="flex flex-col items-start gap-3">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt="Company Logo"
                style={{ height: `${loginLogoSize}px`, width: 'auto', maxWidth: '240px' }}
                className="rounded-xl shadow-lg flex-shrink-0 object-contain"
              />
            ) : (
              <img
                src="/File_Logo_(4) copy.png"
                alt="Nodal Hub"
                className="w-16 h-16 xl:w-20 xl:h-20 rounded-xl shadow-lg flex-shrink-0 object-contain"
              />
            )}
            <div>
              <div
                className="inline-block text-4xl xl:text-5xl font-bold text-transparent bg-clip-text animate-gradient mb-1 leading-snug"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #ec4899, #ffffff, #7dd3fc, #ffffff, #ec4899)',
                  backgroundSize: '300% 100%',
                }}
              >
                Welcome to Nodal Hub
              </div>
              <p className="text-slate-400 text-base mt-1">
                Data, dashboards, and decisions in one place.
              </p>
            </div>
          </div>

          <div className="space-y-6 mt-auto">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0 border border-slate-600/50">
                  <feature.icon className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-slate-300 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-950">
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <img
                src={companyLogo || '/File_Logo_(4) copy.png'}
                alt="Logo"
                className="w-12 h-12 rounded-xl mx-auto mb-4 shadow-lg object-contain"
              />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Nodal Hub
              </h2>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 sm:p-10 ring-1 ring-slate-200 dark:ring-gray-700">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  Welcome back
                </h2>
                <p className="text-slate-500 dark:text-gray-400">
                  Sign in to your account to continue
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      {error}
                    </p>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="emailOrUsername"
                    className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2"
                  >
                    Email or username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="emailOrUsername"
                      name="emailOrUsername"
                      type="text"
                      autoComplete="username"
                      required
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                      disabled={loading}
                      placeholder="you@example.com or username"
                      className="w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:border-transparent transition-all duration-200 placeholder:text-slate-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      placeholder="Enter your password"
                      className="w-full pl-11 pr-12 py-3 border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:border-transparent transition-all duration-200 placeholder:text-slate-400 dark:placeholder:text-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                      ) : (
                        <Eye className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 focus:ring-offset-0"
                    />
                    <span className="text-sm text-slate-600 dark:text-gray-400">
                      Remember me
                    </span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 px-4 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 border border-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    boxShadow:
                      'inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>

                <p className="text-center text-sm text-slate-500 dark:text-gray-400 pt-2">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="font-medium text-slate-900 dark:text-white hover:underline"
                  >
                    Create one
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>

        <div className="py-6 text-center">
          <p className="text-sm text-slate-400 dark:text-gray-500">
            &copy; {year} Nodal Hub. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
