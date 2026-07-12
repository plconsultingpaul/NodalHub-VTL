import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function SsoCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ticket = searchParams.get('ticket');
    console.log('[SSO Callback] Page loaded');
    console.log('[SSO Callback] URL:', window.location.href);
    console.log('[SSO Callback] Ticket present:', !!ticket);
    console.log('[SSO Callback] Ticket length:', ticket?.length || 0);

    if (!ticket) {
      console.log('[SSO Callback] ERROR: No ticket in URL params');
      setError('No SSO ticket provided');
      return;
    }

    async function verifyTicket(ticket: string) {
      try {
        console.log('[SSO Callback] Calling verify-sso-token edge function...');
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${supabaseUrl}/functions/v1/verify-sso-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({ ticket }),
        });

        const data = await response.json();
        console.log('[SSO Callback] Edge function response - status:', response.status);
        console.log('[SSO Callback] Edge function response - data:', JSON.stringify(data));

        if (!response.ok || !data?.tokenHash) {
          const errMsg = data?.error || 'SSO verification failed';
          console.log('[SSO Callback] ERROR: No tokenHash returned. Details:', errMsg);
          setError(errMsg);
          return;
        }

        console.log('[SSO Callback] tokenHash received, calling verifyOtp...');
        const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: 'magiclink',
        });

        console.log('[SSO Callback] verifyOtp result - session:', !!otpData?.session);
        console.log('[SSO Callback] verifyOtp result - user:', otpData?.user?.email || 'none');
        console.log('[SSO Callback] verifyOtp result - error:', otpError?.message || 'none');

        if (otpError) {
          console.log('[SSO Callback] ERROR: verifyOtp failed:', otpError.message);
          setError(otpError.message);
          return;
        }

        console.log('[SSO Callback] SUCCESS - session established, navigating to /');
        navigate('/', { replace: true });
      } catch (err) {
        console.log('[SSO Callback] UNCAUGHT ERROR:', err instanceof Error ? err.message : String(err));
        setError(err instanceof Error ? err.message : 'SSO verification failed');
      }
    }

    verifyTicket(ticket);
  }, [searchParams]);

  if (error) {
    const isUserNotFound = error.toLowerCase().includes('not registered');
    const title = isUserNotFound ? 'Account Not Found' : 'SSO Login Failed';
    const message = isUserNotFound
      ? 'Your account does not exist in this application. Please contact your administrator to get access.'
      : error;

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Logging you in...</p>
      </div>
    </div>
  );
}
