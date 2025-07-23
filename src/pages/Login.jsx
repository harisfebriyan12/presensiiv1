import React, { useState, useEffect, lazy, Suspense } from 'react';
import Swal from 'sweetalert2';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogIn, Mail, Lock, AlertCircle, Building2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../hooks/supabaseClient';
import RecaptchaInfo from '../components/RecaptchaInfo';

// Lazy load ReCAPTCHA untuk performa yang lebih baik
const ReCAPTCHA = lazy(() => import('react-google-recaptcha'));

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [isCaptchaLoaded, setIsCaptchaLoaded] = useState(false);
  const recaptchaRef = React.createRef();

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      if (location.state?.email) {
        setFormData(prev => ({ ...prev, email: location.state.email }));
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Form Tidak Lengkap', 
        text: 'Silakan isi email dan password' 
      });
      return false;
    }

    if (!captchaToken) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Verifikasi Diperlukan', 
        html: `
          <div class="text-left">
            <p>Silakan verifikasi bahwa Anda bukan robot dengan mencentang reCAPTCHA</p>
            <p class="mt-2 text-sm text-gray-600">Ini membantu kami mencegah akses tidak sah ke sistem.</p>
          </div>
        ` 
      });
      return false;
    }

    return true;
  };

  const resetFormState = () => {
    setIsLoading(false);
    setError(null);
    recaptchaRef.current?.reset();
    setCaptchaToken(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Sistem belum dikonfigurasi. Silakan hubungi administrator untuk mengatur koneksi database.');
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (signInError) throw signInError;

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, name, is_face_registered, status')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        } else if (profile.status !== 'active') {
          await supabase.auth.signOut();
          throw new Error('Akun Anda tidak aktif. Silakan hubungi administrator.');
        }

        // Log activity
        try {
          await supabase.from('activity_logs').insert([{
            user_id: data.user.id,
            action_type: 'login',
            action_details: {
              email: data.user.email,
              role: profile?.role || 'unknown',
              timestamp: new Date().toISOString()
            },
            ip_address: 'unknown',
            user_agent: navigator.userAgent
          }]);
        } catch (logError) {
          console.error('Error logging activity:', logError);
        }

        // Update last login
        try {
          await supabase
            .from('profiles')
            .update({ 
              last_login: new Date().toISOString(),
              device_info: {
                user_agent: navigator.userAgent,
                timestamp: new Date().toISOString()
              }
            })
            .eq('id', data.user.id);
        } catch (updateError) {
          console.error('Error updating last login:', updateError);
        }

        // Success alert with better UX
        let welcomeName = profile?.name || data.user.email || '';
        await Swal.fire({
          icon: 'success',
          title: 'Login Berhasil',
          html: `
            <div class="text-center">
              <h3 class="text-xl font-bold text-gray-800">Selamat datang, <span class="text-blue-600">${welcomeName}</span>!</h3>
              <p class="mt-2 text-gray-600">Anda akan diarahkan ke dashboard</p>
            </div>
          `,
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        // Redirect based on role
        if (profile?.role === 'admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      let errorMessage = 'Terjadi kesalahan saat login';
      
      const errorMap = {
        'Invalid login credentials': 'Email atau password salah',
        'Email not confirmed': 'Email belum dikonfirmasi. Silakan cek email Anda.',
        'Too many requests': 'Terlalu banyak percobaan login. Silakan coba lagi nanti.',
        'Sistem belum dikonfigurasi': 'Sistem belum dikonfigurasi. Silakan hubungi administrator.',
        'Akun Anda tidak aktif': err.message
      };

      errorMessage = errorMap[err.message] || err.message || errorMessage;

      await Swal.fire({
        icon: 'error',
        title: 'Login Gagal',
        html: `
          <div class="text-left">
            <p class="font-medium">${errorMessage}</p>
            ${err.message.includes('credentials') ? (
              '<p class="mt-2 text-sm text-gray-600">Pastikan email dan password yang Anda masukkan benar.</p>'
            ) : ''}
          </div>
        `,
        confirmButtonColor: '#3b82f6'
      });

      // Reset form state on error
      resetFormState();
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptchaChange = (token) => {
    setCaptchaToken(token);
    setError(null); // Clear error when captcha is completed
  };

  const handleCaptchaExpired = () => {
    setCaptchaToken(null);
    Swal.fire({
      icon: 'info',
      title: 'Verifikasi Kadaluarsa',
      text: 'Silakan verifikasi ulang bahwa Anda bukan robot',
      timer: 3000,
      showConfirmButton: false
    });
  };

  const handleCaptchaError = () => {
    setCaptchaToken(null);
    Swal.fire({
      icon: 'error',
      title: 'Verifikasi Gagal',
      text: 'Terjadi kesalahan saat memverifikasi reCAPTCHA. Silakan coba lagi.',
      confirmButtonColor: '#3b82f6'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl">
        {/* Logo and Header - Responsif */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full mb-4 sm:mb-6 shadow-lg transform transition-transform hover:scale-105">
            <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Portal Karyawan</h1>
          <p className="text-sm sm:text-base text-blue-100 px-4">Masuk untuk mengakses sistem absensi</p>
        </div>

        {/* Login Form - Responsif */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10 backdrop-blur-sm transition-all hover:shadow-3xl">
          <div className="mb-6 sm:mb-8 text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Masuk ke Akun Anda</h2>
            <p className="text-sm sm:text-base text-gray-500 mt-1 px-2">Silakan login menggunakan email dan password</p>
          </div>

          {/* Warning System Configuration */}
          {!isSupabaseConfigured() && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-50 rounded-lg flex items-start space-x-3 animate-pulse">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm sm:text-base">
                <p className="text-yellow-800 font-medium">Sistem Belum Dikonfigurasi</p>
                <p className="text-yellow-700 text-xs sm:text-sm mt-1">
                  Database belum terhubung. Silakan hubungi administrator untuk mengatur koneksi Supabase.
                </p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 rounded-lg flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm sm:text-base">
                <p className="text-green-800 font-medium">{successMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Email Field */}
            <div className="w-full">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 sm:pl-10 pr-4 py-3 sm:py-3 border border-gray-200 rounded-lg sm:rounded-xl 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 
                           shadow-sm hover:shadow-md focus:shadow-md bg-gray-50 text-sm sm:text-base
                           placeholder-gray-400"
                  placeholder="Masukkan email Anda"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="w-full">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 sm:pl-10 pr-10 py-3 sm:py-3 border border-gray-200 rounded-lg sm:rounded-xl 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 
                           shadow-sm hover:shadow-md focus:shadow-md bg-gray-50 text-sm sm:text-base
                           placeholder-gray-400"
                  placeholder="Masukkan password Anda"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                </button>
              </div>
            </div>

            {/* ReCAPTCHA - Responsif */}
            <div className="mt-4 sm:mt-6 flex justify-center">
              <div className="w-full max-w-xs sm:max-w-sm">
                <Suspense fallback={
                  <div className="h-16 sm:h-20 w-full flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-sm text-gray-500">Memuat verifikasi...</span>
                  </div>
                }>
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
                    onChange={handleCaptchaChange}
                    onExpired={handleCaptchaExpired}
                    onErrored={handleCaptchaError}
                    theme="light"
                    size="normal"
                    className="transform transition-transform hover:scale-[1.01] mx-auto"
                    onLoad={() => setIsCaptchaLoaded(true)}
                  />
                </Suspense>
              </div>
            </div>

            {/* Login Button - Tanpa Icon */}
            <button
              type="submit"
              disabled={isLoading || !isSupabaseConfigured() || !captchaToken}
              className={`w-full py-3 sm:py-4 px-4 sm:px-6 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base
                         focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200
                         ${isLoading 
                           ? 'bg-blue-400 text-white cursor-wait transform scale-[0.98]' 
                           : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                         }
                         ${(!isSupabaseConfigured() || !captchaToken) 
                           ? 'opacity-70 cursor-not-allowed' 
                           : 'shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]'
                         }`}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V8H4z"></path>
                  </svg>
                  <span>Memproses Login...</span>
                </div>
              ) : (
                'Masuk ke Sistem'
              )}
            </button>

            {/* Additional Info */}
            <div className="mt-4 sm:mt-6 text-center">
              <p className="text-xs sm:text-sm text-gray-500">
                Butuh bantuan? 
                <a href="#" className="text-blue-600 hover:text-blue-700 font-medium ml-1 transition-colors">
                  Hubungi Administrator
                </a>
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 sm:mt-8 text-center">
          <p className="text-xs sm:text-sm text-blue-100 opacity-75">
            © 2024 Portal Karyawan. Sistem Absensi Terintegrasi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
