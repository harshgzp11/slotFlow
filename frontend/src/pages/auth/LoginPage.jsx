import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { AlertCircle, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFillDemo() {
    setEmail('owner@slotflow.io');
    setPassword('Password123!');
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.05)] border border-gray-100 p-8 sm:p-10 w-full max-w-[420px]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light text-gray-800 tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Log in to your account below.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-2 text-sm text-rose-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-3 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-3 pl-11 pr-11 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-black hover:bg-neutral-800 text-white font-medium rounded-lg text-sm transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>Continue</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-black hover:underline">
            Sign up
          </Link>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={handleFillDemo}
            className="text-xs text-gray-400 hover:text-gray-700 underline transition-colors"
          >
            Use Demo Credentials (owner@slotflow.io)
          </button>
        </div>
      </div>
    </div>
  );
};
