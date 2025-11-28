/**
 * Login Page Component
 *
 * Professional login/signup page for Grumo dashboard
 * - Email/password authentication via Supabase
 * - Super Admin: hola@grumo.app
 * - Store Owners: assigned by Super Admin
 */

import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Store,
  Shield,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../lib/supabaseWeb';
import { useWebAuth } from '../context/WebAuthContext';

type AuthMode = 'login' | 'signup' | 'forgot';

interface LoginPageProps {
  onAuthSuccess: () => void;
}

export default function LoginPage({ onAuthSuccess }: LoginPageProps) {
  const { signIn, loading: authLoading } = useWebAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const resetForm = () => {
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Use centralized signIn from context - handles all validation
    const { error: loginError } = await signIn(email, password);

    if (loginError) {
      setError(loginError);
      setLoading(false);
      return;
    }

    // Success! Context already updated state, trigger navigation
    setLoading(false);
    onAuthSuccess();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    const emailLower = email.toLowerCase().trim();

    try {
      // First, check if user already has an admin_users entry
      const { data: existingAdmin } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', emailLower)
        .single();

      if (existingAdmin) {
        setError('Ya tienes una solicitud de acceso. Usa "Iniciar sesión" o espera la aprobación del administrador.');
        setLoading(false);
        return;
      }

      // Try to sign up new user
      const { data, error: authError } = await supabase.auth.signUp({
        email: emailLower,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (authError) {
        // If user already exists in auth (app user), try to sign in and create admin entry
        if (authError.message.includes('already registered')) {
          // Try to sign in with provided credentials
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: emailLower,
            password,
          });

          if (signInError) {
            setError('Este email ya está registrado en la app. Usa la misma contraseña de tu cuenta de la app, o recupera tu contraseña.');
            setLoading(false);
            return;
          }

          if (signInData.user) {
            // User exists and password is correct - create admin_users entry
            const { error: insertError } = await supabase.from('admin_users').insert({
              user_id: signInData.user.id,
              email: emailLower,
              full_name: name || signInData.user.user_metadata?.full_name || 'Usuario',
              role: 'store_owner',
              is_active: false,
            });

            if (insertError) {
              // Check if it's a duplicate key error (already has admin entry)
              if (insertError.code === '23505') {
                setError('Ya tienes una solicitud de acceso pendiente.');
              } else {
                setError('Error al crear solicitud de acceso');
              }
              await supabase.auth.signOut();
              setLoading(false);
              return;
            }

            await supabase.auth.signOut();
            setSuccess('Solicitud creada exitosamente. El administrador debe aprobar tu acceso.');
            setMode('login');
            resetForm();
            return;
          }
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.user) {
        // New user created - add admin_users entry
        await supabase.from('admin_users').insert({
          user_id: data.user.id,
          email: emailLower,
          full_name: name,
          role: 'store_owner',
          is_active: false,
        });

        setSuccess('Cuenta creada exitosamente. El administrador debe aprobar tu acceso.');
        setMode('login');
        resetForm();
      }
    } catch (err: any) {
      setError('Error al crear cuenta');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess('Se envió un enlace de recuperación a tu email');
    } catch (err: any) {
      setError('Error al enviar email de recuperación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <img
            src="/grumo-logo-negro-trimmed.png"
            alt="Grumo"
            className="h-10 brightness-0 invert"
          />
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">
              Panel de Administración
            </h1>
            <p className="text-xl text-white/80">
              Gestiona tu tienda, analiza métricas y conecta con tus clientes.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-white/90">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Store size={20} />
              </div>
              <div>
                <p className="font-medium">Gestión de tienda</p>
                <p className="text-sm text-white/70">Productos, ventas y pedidos</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-white/90">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Shield size={20} />
              </div>
              <div>
                <p className="font-medium">Pagos directos</p>
                <p className="text-sm text-white/70">Recibe dinero al instante con MercadoPago</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/60 text-sm">
            © 2024 Grumo. Todos los derechos reservados.
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <img
              src="/grumo-logo-negro-trimmed.png"
              alt="Grumo"
              className="h-8 mx-auto mb-2"
            />
            <p className="text-gray-600 text-sm">Panel de Administración</p>
          </div>

          {/* Auth Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                {mode === 'login' && 'Inicia sesión'}
                {mode === 'signup' && 'Crea tu cuenta'}
                {mode === 'forgot' && 'Recuperar contraseña'}
              </h2>
              <p className="text-gray-500 mt-2">
                {mode === 'login' && 'Ingresa a tu panel de administración'}
                {mode === 'signup' && 'Regístrate para gestionar tu tienda'}
                {mode === 'forgot' && 'Te enviaremos un enlace de recuperación'}
              </p>
            </div>

            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Login Form */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                      placeholder="tu@email.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); resetForm(); }}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || authLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {(loading || authLoading) ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      Iniciar sesión
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Signup Form */}
            {mode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                    placeholder="Tu nombre"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                      placeholder="tu@email.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                      placeholder="Repite tu contraseña"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      Crear cuenta
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  Al crear tu cuenta, aceptas nuestros términos y condiciones.
                  El acceso será habilitado por el administrador.
                </p>
              </form>
            )}

            {/* Forgot Password Form */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                      placeholder="tu@email.com"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      Enviar enlace
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Toggle Auth Mode */}
            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              {mode === 'login' && (
                <p className="text-gray-600">
                  ¿No tienes cuenta?{' '}
                  <button
                    onClick={() => { setMode('signup'); resetForm(); }}
                    className="text-purple-600 font-semibold hover:text-purple-700"
                  >
                    Regístrate
                  </button>
                </p>
              )}
              {mode === 'signup' && (
                <p className="text-gray-600">
                  ¿Ya tienes cuenta?{' '}
                  <button
                    onClick={() => { setMode('login'); resetForm(); }}
                    className="text-purple-600 font-semibold hover:text-purple-700"
                  >
                    Inicia sesión
                  </button>
                </p>
              )}
              {mode === 'forgot' && (
                <p className="text-gray-600">
                  <button
                    onClick={() => { setMode('login'); resetForm(); }}
                    className="text-purple-600 font-semibold hover:text-purple-700"
                  >
                    Volver al login
                  </button>
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-400 text-sm mt-6">
            grumo.app
          </p>
        </div>
      </div>
    </div>
  );
}
