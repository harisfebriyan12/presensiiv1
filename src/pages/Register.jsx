import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, Camera, AlertCircle, CheckCircle, Building2, Shield, Crown, Users } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import { supabase, uploadFile, getFileUrl, isSupabaseConfigured } from '../hooks/supabaseClient';
import RecaptchaInfo from '../components/RecaptchaInfo';
import CustomFaceCapture from '../components/CustomFaceCapture';

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Face Photo (skip for admin)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'karyawan'
  });
  const [facePhoto, setFacePhoto] = useState(null);
  const [faceFingerprint, setFaceFingerprint] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] = useState(null);
  const recaptchaRef = React.createRef();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleBasicInfoSubmit = (e) => {
    e.preventDefault();
    setError(null);
    
    // Validate reCAPTCHA
    if (!captchaToken) {
      setError('Silakan verifikasi bahwa Anda bukan robot dengan mencentang reCAPTCHA');
      return;
    }

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Password tidak cocok');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      setError('Sistem belum dikonfigurasi. Silakan hubungi administrator untuk mengatur koneksi database.');
      return;
    }

    // Admin langsung ke registrasi, karyawan ke verifikasi wajah
    if (formData.role === 'admin') {
      handleRegistration();
    } else {
      setStep(2); // Move to face photo step for non-admin
    }
  };

  const handleCaptchaChange = (token) => {
    setCaptchaToken(token);
  };

  const handleCaptchaExpired = () => {
    setCaptchaToken(null);
  };

  const handleFaceCapture = (photoBlob, fingerprint) => {
    setFacePhoto(photoBlob);
    setFaceFingerprint(fingerprint);
    console.log('✅ Face captured with custom fingerprint for registration');
  };

  const handleRegistration = async () => {
    // Untuk non-admin, wajib ada foto wajah
    if (formData.role !== 'admin' && (!facePhoto || !faceFingerprint)) {
      setError('Silakan ambil foto wajah Anda terlebih dahulu');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Memulai pendaftaran untuk role:', formData.role);

      // Check if Supabase is configured
      if (!isSupabaseConfigured()) {
        throw new Error('Sistem belum dikonfigurasi. Silakan hubungi administrator.');
      }

      // 1. Register user with Supabase Auth dengan metadata role
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: formData.role, // Simpan role di metadata auth
            full_name: formData.name
          }
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        if (authError.message.includes('already registered')) {
          throw new Error('Email sudah terdaftar');
        }
        if (authError.message.includes('Email rate limit exceeded')) {
          throw new Error('Terlalu banyak percobaan pendaftaran. Silakan coba lagi nanti.');
        }
        if (authError.message.includes('Password should be at least')) {
          throw new Error('Password minimal 6 karakter');
        }
        throw new Error(authError.message || 'Gagal mendaftar');
      }

      if (!authData.user) {
        throw new Error('Pendaftaran gagal - tidak ada data user');
      }

      const userId = authData.user.id;
      let photoUrl = null;

      console.log('User berhasil dibuat dengan ID:', userId, 'Role:', formData.role);

      // 2. Upload face photo hanya untuk non-admin
      if (formData.role !== 'admin' && facePhoto) {
        try {
          const fileName = `${userId}-face-${Date.now()}.jpg`;
          await uploadFile(facePhoto, 'face-photos', fileName);
          photoUrl = getFileUrl('face-photos', fileName);
          console.log('Foto wajah berhasil diupload:', photoUrl);
        } catch (uploadError) {
          console.error('Error upload foto:', uploadError);
          // Continue without photo for now
          console.log('Melanjutkan tanpa foto wajah');
        }
      }

      // 3. Wait a moment for auth to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Create user profile dengan role yang benar
      const profileData = {
        id: userId,
        name: formData.name,
        full_name: formData.name,
        email: formData.email,
        role: formData.role, // PENTING: Pastikan role tersimpan dengan benar
        title: getRoleDisplayName(formData.role),
        bio: `${getRoleDisplayName(formData.role)} di sistem absensi`,
        avatar_url: photoUrl, // null untuk admin, ada untuk karyawan
        is_face_registered: formData.role === 'admin' ? true : !!photoUrl, // Admin otomatis true
        status: 'active',
        join_date: new Date().toISOString().split('T')[0],
        contract_start_date: new Date().toISOString().split('T')[0],
        contract_type: 'permanent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Membuat profil dengan data:', profileData);

      const { data: profileResult, error: profileError } = await supabase
        .from('profiles')
        .insert([profileData])
        .select()
        .single();

      if (profileError) {
        console.error('Error membuat profil:', profileError);
        
        // Try to update existing profile instead
        const { data: updateResult, error: updateError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', userId)
          .select()
          .single();

        if (updateError) {
          console.error('Error update profil:', updateError);
          throw new Error('Gagal membuat profil user: ' + updateError.message);
        }
        
        console.log('Profil berhasil diupdate:', updateResult);
      } else {
        console.log('Profil berhasil dibuat:', profileResult);
      }

      // 5. Sync to temp_admin_users if admin or kepala
      if (formData.role === 'admin' || formData.role === 'kepala') {
        try {
          await supabase
            .from('temp_admin_users')
            .insert([{
              user_id: userId,
              role: formData.role
            }]);
          console.log('Admin/Kepala berhasil ditambahkan ke temp_admin_users');
        } catch (tempError) {
          console.error('Error menambahkan ke temp_admin_users:', tempError);
          // Continue anyway
        }
      }

      // 6. Logout user setelah registrasi berhasil
      await supabase.auth.signOut();

      // 7. Success - redirect to login with success message
      const successMessage = formData.role === 'admin' 
        ? `Pendaftaran Administrator berhasil! Akun ${formData.name} telah dibuat tanpa verifikasi wajah. Silakan masuk untuk mengakses panel admin.`
        : `Pendaftaran berhasil! Akun ${getRoleDisplayName(formData.role)} ${formData.name} telah dibuat dengan verifikasi wajah. Silakan masuk.`;

      navigate('/login', {
        state: { 
          message: successMessage,
          email: formData.email
        }
      });

    } catch (err) {
      console.error('Error pendaftaran:', err);
      let errorMessage = 'Terjadi kesalahan saat mendaftar';
      
      if (err.message.includes('Email sudah terdaftar')) {
        errorMessage = 'Email sudah terdaftar. Silakan gunakan email lain atau masuk dengan akun yang sudah ada.';
      } else if (err.message.includes('Password minimal')) {
        errorMessage = 'Password minimal 6 karakter';
      } else if (err.message.includes('rate limit')) {
        errorMessage = 'Terlalu banyak percobaan. Silakan coba lagi dalam beberapa menit.';
      } else if (err.message.includes('Sistem belum dikonfigurasi')) {
        errorMessage = 'Sistem belum dikonfigurasi. Silakan hubungi administrator untuk mengatur koneksi database.';
      } else {
        errorMessage = err.message || 'Terjadi kesalahan saat mendaftar';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'karyawan':
        return 'Karyawan';
      case 'kepala':
        return 'Kepala Bagian';
      case 'admin':
        return 'Administrator';
      default:
        return 'Karyawan';
    }
  };

  const getRoleDescription = (role) => {
    switch (role) {
      case 'karyawan':
        return 'Akses: Absensi pribadi dan riwayat kehadiran';
      case 'kepala':
        return 'Akses: Kelola karyawan dan laporan tim';
      case 'admin':
        return 'Akses: Kelola semua pengguna dan pengaturan sistem (tanpa verifikasi wajah)';
      default:
        return 'Akses dasar sistem';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-5 w-5" />;
      case 'kepala':
        return <Crown className="h-5 w-5" />;
      default:
        return <Users className="h-5 w-5" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'border-purple-300 bg-purple-50 text-purple-700';
      case 'kepala':
        return 'border-tosca-300 bg-tosca-50 text-tosca-700';
      default:
        return 'border-green-300 bg-green-50 text-green-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-tosca-600 to-tosca-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-6 shadow-lg">
            <Building2 className="h-10 w-10 text-tosca-600" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Portal Karyawan</h1>
          <p className="text-tosca-100">
            {formData.role === 'admin' 
              ? 'Buat akun Administrator tanpa verifikasi wajah'
              : 'Buat akun dengan verifikasi wajah'
            }
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-xl shadow-2xl p-8 backdrop-blur-sm">
          {/* Progress Steps - hanya tampil untuk non-admin */}
          {formData.role !== 'admin' && (
            <div className="flex items-center justify-center mb-6">
              {[1, 2].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= stepNum
                      ? 'bg-tosca-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {stepNum < step ? <CheckCircle className="h-4 w-4" /> : stepNum}
                  </div>
                  {stepNum < 2 && (
                    <div className={`w-12 h-1 mx-2 ${
                      step > stepNum ? 'bg-tosca-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center space-x-2 mb-6">
            <UserPlus className="h-5 w-5 text-tosca-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {step === 1 ? 'Informasi Dasar' : 'Verifikasi Wajah'}
            </h2>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 font-medium">Kesalahan Pendaftaran</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleBasicInfoSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent transition-colors"
                    placeholder="Masukkan nama lengkap Anda"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent transition-colors"
                    placeholder="Masukkan email Anda"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-3">
                  Pilih Jabatan
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {['karyawan', 'kepala', 'admin'].map((roleOption) => (
                    <label key={roleOption} className="cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value={roleOption}
                        checked={formData.role === roleOption}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <div className={`p-4 rounded-lg border-2 transition-all ${
                        formData.role === roleOption
                          ? getRoleColor(roleOption)
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <div className="flex items-center space-x-3">
                          {getRoleIcon(roleOption)}
                          <div className="flex-1">
                            <div className="font-medium text-lg">{getRoleDisplayName(roleOption)}</div>
                            <div className="text-sm opacity-75 mt-1">
                              {getRoleDescription(roleOption)}
                            </div>
                          </div>
                          {formData.role === roleOption && (
                            <CheckCircle className="h-5 w-5 text-current" />
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent transition-colors"
                    placeholder="Masukkan password Anda"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent transition-colors"
                    placeholder="Konfirmasi password Anda"
                  />
                </div>
              </div>

              {/* Admin Notice */}
              {formData.role === 'admin' && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-purple-800 font-medium">Administrator</p>
                      <p className="text-purple-700 text-sm mt-1">
                        Sebagai Administrator, Anda tidak perlu verifikasi wajah dan dapat langsung mengakses semua fitur sistem manajemen.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Supabase Configuration Warning */}
              {!isSupabaseConfigured() && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-800 font-medium">Sistem Belum Dikonfigurasi</p>
                      <p className="text-yellow-700 text-sm mt-1">
                        Database belum terhubung. Silakan hubungi administrator untuk mengatur koneksi Supabase.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <div className="flex justify-center">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"} // Fallback to test key if not configured
                    onChange={handleCaptchaChange}
                    onExpired={handleCaptchaExpired}
                    theme="light"
                  />
                </div>
              </div>
              
              <RecaptchaInfo />

              <button
                type="submit"
                disabled={isLoading || !isSupabaseConfigured() || !captchaToken}
                className="w-full bg-tosca-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-tosca-700 focus:ring-2 focus:ring-tosca-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Membuat Akun...</span>
                  </div>
                ) : (
                  formData.role === 'admin' ? 'Buat Akun Administrator' : 'Lanjut ke Verifikasi Wajah'
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <Camera className="h-12 w-12 text-tosca-600 mx-auto mb-3" />
                <p className="text-gray-600">
                  Ambil foto wajah yang jelas untuk verifikasi absensi. 
                  Sistem kami menggunakan teknologi pengenalan wajah yang aman dan cepat.
                </p>
              </div>

              <CustomFaceCapture onFaceCapture={handleFaceCapture} isCapturing={isLoading} />

              {facePhoto && (
                <div className="text-center">
                  <div className="inline-flex items-center space-x-2 text-green-600 mb-4">
                    <CheckCircle className="h-5 w-5" />
                    <span>Foto wajah berhasil diambil dan diverifikasi!</span>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Kembali
                </button>
                <button
                  onClick={handleRegistration}
                  disabled={!facePhoto || isLoading}
                  className="flex-1 bg-tosca-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-tosca-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Membuat Akun...</span>
                    </div>
                  ) : (
                    'Selesaikan Pendaftaran'
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Sudah punya akun?{' '}
                <Link
                  to="/login"
                  className="text-tosca-600 hover:text-tosca-700 font-medium transition-colors"
                >
                  Masuk di sini
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Security Info */}
        <div className="mt-6 p-4 bg-white/20 backdrop-blur-sm rounded-lg text-white">
          <p className="text-sm font-medium mb-2">
            <span className="bg-tosca-500 text-white px-2 py-1 rounded text-xs mr-2">INFO</span>
            Sistem Verifikasi Berdasarkan Role
          </p>
          <div className="text-xs space-y-1">
            <p>• <strong>Administrator:</strong> Akses penuh tanpa verifikasi wajah</p>
            <p>• <strong>Karyawan & Kepala:</strong> Verifikasi wajah untuk keamanan absensi</p>
            <p>• Data dienkripsi dan tidak dibagikan ke pihak ketiga</p>
            <p>• Sistem custom yang aman dan cepat</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;