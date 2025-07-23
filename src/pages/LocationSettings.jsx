import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Save, Edit, AlertCircle, CheckCircle, Navigation } from 'lucide-react';
import { supabase } from '../hooks/supabaseClient';
import SimpleLocationPicker from '../components/SimpleLocationPicker';
import AdminSidebar from '../components/AdminSidebar';

const LocationSettings = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [officeLocation, setOfficeLocation] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [radius, setRadius] = useState(100);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        navigate('/dashboard');
        return;
      }

      setCurrentUser(user);
      setProfile(profile);
      await fetchOfficeLocation();
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficeLocation = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'office_location')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.setting_value) {
        setOfficeLocation(data.setting_value);
        setRadius(data.setting_value.radius || 100);
      } else {
        // Default location if not set
        setOfficeLocation({
          latitude: -6.200000,
          longitude: 106.816666,
          address: 'Jakarta, Indonesia',
          radius: 100
        });
      }
    } catch (error) {
      console.error('Error fetching office location:', error);
      setError('Gagal memuat pengaturan lokasi kantor');
    }
  };

  const handleLocationSelect = async (newLocation) => {
    setIsSaving(true);
    setError(null);

    try {
      const locationData = {
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        address: newLocation.address,
        radius: radius
      };

      // Update or insert office location setting with proper conflict resolution
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'office_location',
          setting_value: locationData,
          description: 'Lokasi kantor utama dan radius absensi',
          is_enabled: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      setOfficeLocation(locationData);
      setShowLocationPicker(false);
      setSuccess('Lokasi kantor berhasil diperbarui!');

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (error) {
      console.error('Error saving office location:', error);
      setError('Gagal menyimpan lokasi kantor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRadiusChange = async (newRadius) => {
    if (!officeLocation) return;

    setIsSaving(true);
    setError(null);

    try {
      const locationData = {
        ...officeLocation,
        radius: parseInt(newRadius)
      };

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'office_location',
          setting_value: locationData,
          description: 'Lokasi kantor utama dan radius absensi',
          is_enabled: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      setOfficeLocation(locationData);
      setRadius(parseInt(newRadius));
      setSuccess('Radius absensi berhasil diperbarui!');

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (error) {
      console.error('Error updating radius:', error);
      setError('Gagal memperbarui radius absensi');
    } finally {
      setIsSaving(false);
    }
  };

  const openInGoogleMaps = () => {
    if (officeLocation) {
      const url = `https://www.google.com/maps?q=${officeLocation.latitude},${officeLocation.longitude}`;
      window.open(url, '_blank');
    }
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
          <p className="text-gray-600 mt-4">Memuat pengaturan lokasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <AdminSidebar user={currentUser} profile={profile} />

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 transition-all duration-300 ease-in-out">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Pengaturan Lokasi Kantor</h1>
                <p className="text-sm text-gray-600">
                  Kelola lokasi kantor dan radius absensi tanpa Google Maps
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Notifikasi */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-green-700">{success}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {showLocationPicker ? (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <SimpleLocationPicker
                initialLocation={officeLocation ? {
                  lat: officeLocation.latitude,
                  lng: officeLocation.longitude,
                  address: officeLocation.address
                } : null}
                radius={radius}
                onLocationSelect={handleLocationSelect}
                onCancel={() => setShowLocationPicker(false)}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current Location Display */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Lokasi Kantor Saat Ini</h2>
                  <button
                    onClick={() => setShowLocationPicker(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit Lokasi</span>
                  </button>
                </div>

                {officeLocation ? (
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Alamat</p>
                        <p className="text-gray-600">{officeLocation.address}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="font-medium text-gray-900 mb-1">Koordinat</p>
                        <p className="text-gray-600">
                          {officeLocation.latitude.toFixed(6)}, {officeLocation.longitude.toFixed(6)}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="font-medium text-gray-900 mb-1">Radius Absensi</p>
                        <p className="text-gray-600">{officeLocation.radius} meter</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                      <button
                        onClick={openInGoogleMaps}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Navigation className="h-4 w-4" />
                        <span>Lihat di Google Maps</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MapPin className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">Lokasi kantor belum diatur</p>
                    <button
                      onClick={() => setShowLocationPicker(true)}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Atur Lokasi Sekarang
                    </button>
                  </div>
                )}
              </div>

              {/* Radius Settings */}
              {officeLocation && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Pengaturan Radius Absensi</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Radius Absensi (meter)
                      </label>
                      <div className="flex items-center space-x-4">
                        <input
                          type="range"
                          min="50"
                          max="500"
                          step="10"
                          value={radius}
                          onChange={(e) => setRadius(parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="50"
                            max="500"
                            value={radius}
                            onChange={(e) => setRadius(parseInt(e.target.value))}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="text-gray-600">m</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        Karyawan harus berada dalam radius ini untuk dapat melakukan absensi
                      </p>
                    </div>

                    <button
                      onClick={() => handleRadiusChange(radius)}
                      disabled={isSaving || radius === officeLocation.radius}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      <span>{isSaving ? 'Menyimpan...' : 'Simpan Radius'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Info Panel */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="font-medium text-blue-900 mb-3">✨ Keunggulan Sistem Tanpa Google Maps</h3>
                <div className="space-y-2 text-sm text-blue-700">
                  <p>• Tidak memerlukan API key Google Maps yang berbayar</p>
                  <p>• Sistem tetap akurat menggunakan koordinat GPS</p>
                  <p>• Mudah digunakan dengan preset lokasi populer</p>
                  <p>• Dapat menggunakan GPS untuk mendapatkan lokasi saat ini</p>
                  <p>• Koordinat dapat dicari manual dari Google Maps</p>
                  <p>• Sistem validasi radius tetap berfungsi dengan sempurna</p>
                </div>
              </div>

              {/* Usage Instructions */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-medium text-gray-900 mb-3">📋 Cara Menggunakan</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>1. Gunakan GPS:</strong> Klik "Gunakan GPS" untuk otomatis mengisi koordinat lokasi saat ini</p>
                  <p><strong>2. Pilih Preset:</strong> Pilih dari lokasi populer yang sudah tersedia</p>
                  <p><strong>3. Input Manual:</strong> Cari koordinat di Google Maps dan input manual</p>
                  <p><strong>4. Atur Radius:</strong> Sesuaikan radius absensi sesuai kebutuhan (50-500 meter)</p>
                  <p><strong>5. Simpan:</strong> Klik simpan untuk menerapkan pengaturan</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationSettings;