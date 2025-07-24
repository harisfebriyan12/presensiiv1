import React, { useState, useEffect } from 'react';
import { XCircle, Camera, User, CreditCard, Lock } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

const ProfileEditor = ({ user, profile, onClose }) => {
  const [activeTab, setActiveTab] = useState('face');
  const [facePhoto, setFacePhoto] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [banks, setBanks] = useState([]);
  const [profileData, setProfileData] = useState({
    name: profile?.name || '',
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    bio: profile?.bio || ''
  });
  const [bankData, setBankData] = useState({
    bank_id: profile?.bank_id || '',
    bank_account_number: profile?.bank_account_number || '',
    bank_account_name: profile?.bank_account_name || profile?.full_name || ''
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
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
        setError('Gagal memuat daftar bank.');
        console.error('Error fetching banks:', error);
      }
    };
    fetchBanks();
  }, []);

  const handleFaceCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFacePhoto(file);
      setError(null);
    }
  };

  const handleSaveFace = async () => {
    if (!facePhoto) {
      setError('Silakan pilih foto wajah terlebih dahulu.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const fileName = `${user.id}-face-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('face-photos')
        .upload(fileName, facePhoto, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { publicUrl } = supabase.storage.from('face-photos').getPublicUrl(fileName).data;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          is_face_registered: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      if (updateError) throw updateError;

      setSuccess('Foto wajah berhasil disimpan!');
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message || 'Gagal menyimpan foto wajah.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profileData.full_name || !profileData.phone) {
      setError('Nama lengkap dan nomor telepon wajib diisi.');
      return;
    }
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
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message || 'Gagal memperbarui profil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBank = async () => {
    if (!bankData.bank_id || !bankData.bank_account_number || !bankData.bank_account_name) {
      setError('Semua field bank wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...bankData,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      if (error) throw error;
      setSuccess('Informasi bank berhasil diperbarui!');
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message || 'Gagal memperbarui informasi bank.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Kata sandi tidak cocok.');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setError('Kata sandi harus minimal 6 karakter.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      if (error) throw error;
      setSuccess('Kata sandi berhasil diperbarui!');
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message || 'Gagal memperbarui kata sandi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fadeIn">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Kelola Profil</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <XCircle className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto">
          <div className="border-b">
            <div className="flex space-x-4 px-6 py-4">
              <button
                onClick={() => setActiveTab('face')}
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'face' ? 'border-b-2 border-tosca-600 text-tosca-600' : 'text-gray-600'}`}
              >
                <Camera className="h-4 w-4 inline mr-2" />
                Foto Wajah
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'profile' ? 'border-b-2 border-tosca-600 text-tosca-600' : 'text-gray-600'}`}
              >
                <User className="h-4 w-4 inline mr-2" />
                Profil
              </button>
              <button
                onClick={() => setActiveTab('bank')}
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'bank' ? 'border-b-2 border-tosca-600 text-tosca-600' : 'text-gray-600'}`}
              >
                <CreditCard className="h-4 w-4 inline mr-2" />
                Bank
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'password' ? 'border-b-2 border-tosca-600 text-tosca-600' : 'text-gray-600'}`}
              >
                <Lock className="h-4 w-4 inline mr-2" />
                Kata Sandi
              </button>
            </div>
          </div>
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">{error}</p>
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800">{success}</p>
              </div>
            )}

            {activeTab === 'face' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                    {facePhoto ? (
                      <img
                        src={URL.createObjectURL(facePhoto)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-16 w-16 text-gray-400" />
                    )}
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFaceCapture}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-tosca-50 file:text-tosca-700 hover:file:bg-tosca-100"
                  disabled={isSubmitting}
                />
                <button
                  onClick={handleSaveFace}
                  className="w-full bg-tosca-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-tosca-700 transition-colors disabled:bg-gray-400"
                  disabled={isSubmitting || !facePhoto}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Foto Wajah'}
                </button>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
                  <input
                    type="text"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tosca-300 focus:ring focus:ring-tosca-200 focus:ring-opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nomor Telepon</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tosca-300 focus:ring focus:ring-tosca-200 focus:ring-opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lokasi</label>
                  <input
                    type="text"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tosca-300 focus:ring focus:ring-tosca-200 focus:ring-opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bio</label>
                  <textarea
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tosca-300 focus:ring focus:ring-tosca-200 focus:ring-opacity-50"
                    rows="4"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  className="w-full bg-tosca-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-tosca-700 transition-colors disabled:bg-gray-400"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            )}

            {activeTab === 'bank' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nama Bank</label>
                  <select
                    value={bankData.bank_id}
                    onChange={(e) => setBankData({ ...bankData, bank_id: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tosca-300 focus:ring focus:ring-tosca-200 focus:ring-opacity-50"
                  >
                    <option value="">Pilih Bank</option>
                    {banks.map((bank) => (
                      <option key={bank.id} value={bank.id}>{bank.bank_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nomor Rekening</label>
                  <input
                    type="text"
                    value={bankData.bank_account_number}
                    onChange={(e) => setBankData({ ...bankData, bank_account_number: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tosca-300 focus:ring focus:ring-tosca-200 focus:ring-opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nama Pemilik Rekening</label>
                  <input
                    type="text"
                    value={bankData.bank_account_name}
                    onChange={(e) => setBankData({ ...bankData, bank_account_name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tosca-300 focus:ring focus:ring-tosca-200 focus:ring-opacity-50"
                  />
                </div>
                <button
                  onClick={handleSaveBank}
                  className="w-full bg-tosca-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-tosca-700 transition-colors disabled:bg-gray-400"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Informasi Bank'}
                </button>
              </div>
            )}

            {activeTab === 'password' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kata Sandi Baru</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tosca-300 focus:ring focus:ring-tosca-200 focus:ring-opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Konfirmasi Kata Sandi</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tosca-300 focus:ring focus:ring-tosca-200 focus:ring-opacity-50"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  className="w-full bg-tosca-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-tosca-700 transition-colors disabled:bg-gray-400"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Ubah Kata Sandi'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditor;