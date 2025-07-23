import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, User, Save, ArrowLeft, CheckCircle, AlertCircle, Lock, Mail, Phone, MapPin, Edit, CreditCard, Building, AlertTriangle } from 'lucide-react';
import { supabase, uploadFile, getFileUrl } from '../hooks/supabaseClient';
import CustomFaceCapture from '../components/CustomFaceCapture';

const ProfileSetup = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('face'); // 'face', 'profile', 'bank', 'password'
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [facePhoto, setFacePhoto] = useState(null);
  const [faceFingerprint, setFaceFingerprint] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Profile form data
  const [profileData, setProfileData] = useState({
    name: '',
    full_name: '',
    phone: '',
    location: '',
    bio: ''
  });

  // Bank account form data
  const [bankData, setBankData] = useState({
    bank_id: '',
    bank_account_number: '',
    bank_account_name: ''
  });

  // Password form data
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      setUser(user);
      await Promise.all([
        fetchProfile(user.id),
        fetchBanks()
      ]);
    } catch (error) {
      console.error('Error checking user:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          positions(name_id, department),
          bank_info(id, bank_name, bank_logo)
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProfile(data);
        setIsAdmin(data.role === 'admin');
        setProfileData({
          name: data.name || '',
          full_name: data.full_name || '',
          phone: data.phone || '',
          location: data.location || '',
          bio: data.bio || ''
        });
        setBankData({
          bank_id: data.bank_id || '',
          bank_account_number: data.bank_account_number || '',
          bank_account_name: data.bank_account_name || data.full_name || data.name || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_info')
        .select('*')
        .eq('is_active', true)
        .order('bank_name');

      if (error) throw error;
      setBanks(data || []);
    } catch (error) {
      console.error('Error fetching banks:', error);
    }
  };

  const handleFaceCapture = (photoBlob, fingerprint) => {
    setFacePhoto(photoBlob);
    setFaceFingerprint(fingerprint);
    setError(null);
    console.log('✅ Face captured with custom fingerprint');
  };

  const handleSaveFace = async () => {
    if (!facePhoto || !faceFingerprint) {
      setError('Silakan ambil foto wajah terlebih dahulu');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Starting face photo save process...');
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${user.id}-face-${timestamp}.jpg`;
      
      console.log('Uploading face photo with filename:', fileName);
      
      // Upload face photo
      await uploadFile(facePhoto, 'face-photos', fileName);
      const photoUrl = getFileUrl('face-photos', fileName);
      
      console.log('Photo uploaded successfully, URL:', photoUrl);

      // Update profile with face photo
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: photoUrl,
          is_face_registered: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw new Error(`Gagal menyimpan profil: ${updateError.message}`);
      }

      console.log('Profile updated successfully');
      setSuccess('Foto wajah berhasil disimpan!');
      
      // Refresh profile data
      await fetchProfile(user.id);
      
      // Clear form
      setFacePhoto(null);
      setFaceFingerprint(null);

    } catch (err) {
      console.error('Error saving face photo:', err);
      setError(err.message || 'Gagal menyimpan foto wajah. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setSuccess('Profil berhasil diperbarui!');
      await fetchProfile(user.id);

    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Gagal memperbarui profil. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBank = async () => {
    if (!bankData.bank_id) {
      setError('Silakan pilih bank terlebih dahulu');
      return;
    }

    if (!bankData.bank_account_number) {
      setError('Nomor rekening harus diisi');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          bank_id: bankData.bank_id,
          bank_account_number: bankData.bank_account_number,
          bank_account_name: bankData.bank_account_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setSuccess('Informasi rekening berhasil diperbarui!');
      await fetchProfile(user.id);

    } catch (err) {
      console.error('Error updating bank info:', err);
      setError('Gagal memperbarui informasi rekening. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Password baru dan konfirmasi password tidak cocok');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('Password baru minimal 6 karakter');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      // Log password change
      await supabase.from('password_changes').insert([{
        user_id: user.id,
        changed_by: user.id,
        change_type: 'self_change',
        ip_address: 'unknown',
        user_agent: navigator.userAgent
      }]);

      setSuccess('Password berhasil diubah!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

    } catch (err) {
      console.error('Error changing password:', err);
      setError('Gagal mengubah password. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBankChange = (e) => {
    const { name, value } = e.target;
    setBankData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getSelectedBank = () => {
    return banks.find(bank => bank.id === bankData.bank_id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-1 text-blue-600">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4">Memuat profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 shadow-md border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-5">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 bg-white/30 hover:bg-white/50 rounded-full shadow transition-colors"
                title="Kembali ke Dashboard"
              >
                <ArrowLeft className="h-6 w-6 text-blue-700" />
              </button>
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow">Kelola Profil</h1>
                <p className="text-base text-blue-100 mt-1">Atur foto wajah, data pribadi, dan keamanan akun Anda</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-700 font-medium">Berhasil!</p>
              <p className="text-green-600 text-sm mt-1">{success}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 font-medium">Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Profile Info */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-100 flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="w-28 h-28 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden shadow border-4 border-white">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-12 w-12 text-blue-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-gray-900 truncate">
                {profile?.full_name || profile?.name || user?.email?.split('@')[0] || 'Pengguna'}
              </h2>
              <button
                onClick={() => setShowEditProfileModal(true)}
                className="ml-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-full shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                title="Edit Profil"
              >
                Edit
              </button>
            </div>
      {/* Modal Edit Profile */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-8 relative animate-fade-in">
            <button
              onClick={() => setShowEditProfileModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
              title="Tutup Edit Profil"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Profil</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" defaultValue={profile?.full_name || ''} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" defaultValue={profile?.email || ''} disabled />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" defaultValue={profile?.phone || ''} />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowEditProfileModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
            <p className="text-base text-gray-500 mb-2 truncate">{profile?.email || user?.email}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {profile?.positions?.name_id && (
                <span className="text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{profile.positions.name_id}</span>
              )}
              {profile?.positions?.department && (
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{profile.positions.department}</span>
              )}
              {profile?.employee_id && (
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">ID: {profile.employee_id}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium shadow-sm ${
                profile?.is_face_registered 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                <Camera className="h-4 w-4" />
                <span>{profile?.is_face_registered ? 'Wajah Terdaftar' : 'Wajah Belum Terdaftar'}</span>
              </div>
              {profile?.bank_info && (
                <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 font-medium shadow-sm">
                  <Building className="h-4 w-4" />
                  <span>Rekening {profile.bank_info.bank_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
          <div className="border-b border-gray-200">
            <nav className="flex flex-wrap">
              <button
                onClick={() => {
                  // Only allow changing to face tab if admin or face not registered
                  if (isAdmin || !profile?.is_face_registered) {
                    setActiveTab('face');
                  }
                }}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'face'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : profile?.is_face_registered && !isAdmin
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Camera className="h-4 w-4 inline mr-2" />
                Foto Wajah
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'profile'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Edit className="h-4 w-4 inline mr-2" />
                Informasi Pribadi
              </button>
              <button
                onClick={() => setActiveTab('bank')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'bank'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Building className="h-4 w-4 inline mr-2" />
                Rekening Bank
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'password'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Lock className="h-4 w-4 inline mr-2" />
                Ubah Password
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Face Photo Tab */}
            {activeTab === 'face' && (
              <div>
                {profile?.is_face_registered && !isAdmin ? (
                  <div className="text-center py-8">
                    <div className="w-24 h-24 mx-auto mb-4 relative">
                      {profile.avatar_url ? (
                        <img 
                          src={profile.avatar_url} 
                          alt="Profile" 
                          className="w-24 h-24 rounded-full object-cover border-4 border-green-100"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-12 w-12 text-blue-600" />
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 bg-green-500 text-white p-1 rounded-full">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Wajah Terverifikasi</h3>
                    <p className="text-gray-600 mb-6">
                      Foto wajah Anda telah terdaftar dan terverifikasi dalam sistem.
                      Anda dapat menggunakan verifikasi wajah untuk absensi.
                    </p>
                    <div className="p-4 bg-yellow-50 rounded-lg text-left">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-yellow-800 font-medium">Perhatian</p>
                          <p className="text-yellow-700 text-sm mt-1">
                            Foto wajah yang sudah terverifikasi tidak dapat diubah oleh pengguna.
                            Jika Anda perlu mengubah foto wajah, silakan hubungi administrator.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Setup Foto Wajah</h3>
                      <p className="text-gray-600">
                        Foto wajah digunakan untuk verifikasi absensi yang aman dan akurat
                      </p>
                    </div>

                    <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">✨ Keunggulan Sistem Kami</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Teknologi pengenalan wajah yang aman dan cepat</li>
                        <li>• Tidak memerlukan download model AI eksternal</li>
                        <li>• Analisis pola wajah dengan algoritma custom</li>
                        <li>• Data tersimpan aman dengan enkripsi</li>
                      </ul>
                    </div>

                    <CustomFaceCapture 
                      onFaceCapture={handleFaceCapture} 
                      isCapturing={isSubmitting}
                    />

                    {facePhoto && (
                      <div className="mt-6 text-center">
                        <div className="inline-flex items-center space-x-2 text-green-600 mb-4">
                          <CheckCircle className="h-5 w-5" />
                          <span>Foto wajah berhasil diambil dan diverifikasi!</span>
                        </div>
                        
                        <button
                          onClick={handleSaveFace}
                          disabled={isSubmitting}
                          className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSubmitting ? (
                            <div className="flex items-center space-x-2">
                              <div className="inline-flex space-x-1">
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                              <span>Menyimpan...</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <Save className="h-4 w-4" />
                              <span>Simpan Foto Wajah</span>
                            </div>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Informasi Pribadi</h3>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nama Panggilan
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={profileData.name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nama panggilan"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        name="full_name"
                        value={profileData.full_name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nama lengkap"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Phone className="h-4 w-4 inline mr-1" />
                        Nomor Telepon
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={profileData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+62-21-1234567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <MapPin className="h-4 w-4 inline mr-1" />
                        Lokasi
                      </label>
                      <input
                        type="text"
                        name="location"
                        value={profileData.location}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Jakarta, Indonesia"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bio
                    </label>
                    <textarea
                      name="bio"
                      value={profileData.bio}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ceritakan sedikit tentang diri Anda..."
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={isSubmitting}
                    className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <div className="inline-flex space-x-1">
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span>Menyimpan...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Save className="h-4 w-4" />
                        <span>Simpan Perubahan</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Bank Account Tab */}
            {activeTab === 'bank' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Informasi Rekening Bank</h3>

                <div className="space-y-6">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-6">
                    <div className="flex items-start space-x-3">
                      <Building className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-blue-800 font-medium">Informasi Rekening untuk Gaji</p>
                        <p className="text-blue-700 text-sm mt-1">
                          Informasi rekening bank Anda digunakan untuk pembayaran gaji dan tunjangan. 
                          Pastikan data yang dimasukkan sudah benar.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Building className="h-4 w-4 inline mr-1" />
                        Pilih Bank *
                      </label>
                      <div className="relative">
                        <select
                          name="bank_id"
                          value={bankData.bank_id}
                          onChange={handleBankChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Pilih Bank...</option>
                          {banks.map((bank) => (
                            <option key={bank.id} value={bank.id}>
                              {bank.bank_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {getSelectedBank() && (
                        <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
                          {getSelectedBank().bank_logo && (
                            <img 
                              src={getSelectedBank().bank_logo} 
                              alt={getSelectedBank().bank_name}
                              className="w-6 h-6 object-contain"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = '';
                                e.target.parentElement.innerHTML = `
                                  <div class="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600">
                                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    </svg>
                                  </div>
                                `;
                              }}
                            />
                          )}
                          {getSelectedBank() && (
                            <span>Bank {getSelectedBank().bank_name}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <CreditCard className="h-4 w-4 inline mr-1" />
                        Nomor Rekening *
                      </label>
                      <input
                        type="text"
                        name="bank_account_number"
                        value={bankData.bank_account_number}
                        onChange={handleBankChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Masukkan nomor rekening tanpa spasi"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="h-4 w-4 inline mr-1" />
                      Nama Pemilik Rekening
                    </label>
                    <input
                      type="text"
                      name="bank_account_name"
                      value={bankData.bank_account_name}
                      onChange={handleBankChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                      placeholder="Nama sesuai saat pendaftaran"
                      readOnly
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Nama pemilik rekening otomatis menggunakan nama lengkap dari profil Anda
                    </p>
                  </div>

                  <button
                    onClick={handleSaveBank}
                    disabled={isSubmitting}
                    className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <div className="inline-flex space-x-1">
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span>Menyimpan...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Save className="h-4 w-4" />
                        <span>Simpan Informasi Rekening</span>
                      </div>
                    )}
                  </button>
                  
                  {/* Bank Cards Section */}
                  <div className="mt-8">
                    <h4 className="font-medium text-gray-900 mb-4">Bank Tersedia</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {banks.map((bank) => (
                        <div 
                          key={bank.id}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            bankData.bank_id === bank.id 
                              ? 'border-blue-500 bg-blue-50 shadow-sm' 
                              : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                          }`}
                          onClick={() => setBankData(prev => ({ ...prev, bank_id: bank.id }))}
                        >
                          <div className="flex flex-col items-center text-center">
                            {bank.bank_logo ? (
                              <img 
                                src={bank.bank_logo} 
                                alt={bank.bank_name} 
                                className="w-12 h-12 object-contain mb-3"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                                <Building className="h-5 w-5 text-blue-600" />
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-800">{bank.bank_name}</span>
                            {bankData.bank_id === bank.id && (
                              <div className="mt-2 text-xs text-blue-600 flex items-center">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Dipilih
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Ubah Password</h3>
                
                <div className="space-y-6 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password Saat Ini
                    </label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Masukkan password saat ini"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password Baru
                    </label>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Masukkan password baru (min. 6 karakter)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Konfirmasi Password Baru
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Konfirmasi password baru"
                    />
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={isSubmitting || !passwordData.newPassword || !passwordData.confirmPassword}
                    className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <div className="inline-flex space-x-1">
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span>Mengubah...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4" />
                        <span>Ubah Password</span>
                      </div>
                    )}
                  </button>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                  <h4 className="font-medium text-yellow-800 mb-2">🔒 Tips Keamanan Password</h4>
                  <div className="text-sm text-yellow-700 space-y-1">
                    <p>• Gunakan minimal 6 karakter</p>
                    <p>• Kombinasikan huruf besar, kecil, dan angka</p>
                    <p>• Jangan gunakan informasi pribadi yang mudah ditebak</p>
                    <p>• Ubah password secara berkala</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-2">🔒 Keamanan & Privasi</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Foto wajah dienkripsi dan disimpan dengan aman</p>
            <p>• Menggunakan algoritma fingerprinting custom yang aman</p>
            <p>• Hanya digunakan untuk verifikasi absensi</p>
            <p>• Data rekening bank hanya digunakan untuk pembayaran gaji</p>
            <p>• Data tidak dibagikan kepada pihak ketiga</p>
            <p>• Anda dapat mengubah informasi kapan saja</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;