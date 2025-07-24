import React, { useState, useEffect } from 'react';
import { MapPin, Save, X, Navigation, Search, AlertCircle, CheckCircle } from 'lucide-react';

const SimpleLocationPicker = ({ 
  initialLocation, 
  onLocationSelect, 
  onCancel,
  radius = 100 
}) => {
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || {
    lat: -6.200000,
    lng: 106.816666
  });
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (initialLocation) {
      setSelectedLocation(initialLocation);
      setAddress(initialLocation.address || '');
    }
  }, [initialLocation]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolokasi tidak didukung oleh browser ini.');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setSelectedLocation(location);
        setAddress(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
        setSuccess('Lokasi saat ini berhasil didapatkan!');
        setIsLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Gagal mendapatkan lokasi saat ini.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Akses lokasi ditolak. Silakan izinkan akses lokasi.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Informasi lokasi tidak tersedia.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Permintaan lokasi timeout.';
            break;
        }
        setError(errorMessage);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleLocationChange = (field, value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setSelectedLocation(prev => ({
        ...prev,
        [field]: numValue
      }));
      setError(null);
    }
  };

  const validateLocation = () => {
    if (!selectedLocation.lat || !selectedLocation.lng) {
      setError('Koordinat latitude dan longitude harus diisi.');
      return false;
    }

    if (selectedLocation.lat < -90 || selectedLocation.lat > 90) {
      setError('Latitude harus antara -90 dan 90.');
      return false;
    }

    if (selectedLocation.lng < -180 || selectedLocation.lng > 180) {
      setError('Longitude harus antara -180 dan 180.');
      return false;
    }

    if (!address.trim()) {
      setError('Alamat kantor harus diisi.');
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (!validateLocation()) {
      return;
    }

    if (onLocationSelect) {
      onLocationSelect({
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        address: address.trim(),
        radius: radius
      });
    }
  };

  const presetLocations = [
    {
      name: 'Jakarta Pusat',
      lat: -6.200000,
      lng: 106.816666,
      address: 'Jakarta Pusat, DKI Jakarta, Indonesia'
    },
    {
      name: 'Surabaya',
      lat: -7.257472,
      lng: 112.752090,
      address: 'Surabaya, Jawa Timur, Indonesia'
    },
    {
      name: 'Bandung',
      lat: -6.917464,
      lng: 107.619123,
      address: 'Bandung, Jawa Barat, Indonesia'
    },
    {
      name: 'Medan',
      lat: 3.595196,
      lng: 98.672226,
      address: 'Medan, Sumatera Utara, Indonesia'
    },
    {
      name: 'Yogyakarta',
      lat: -7.797068,
      lng: 110.370529,
      address: 'Yogyakarta, DI Yogyakarta, Indonesia'
    }
  ];

  const selectPresetLocation = (preset) => {
    setSelectedLocation({ lat: preset.lat, lng: preset.lng });
    setAddress(preset.address);
    setSuccess(`Lokasi ${preset.name} dipilih!`);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <MapPin className="h-12 w-12 text-tosca-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Atur Lokasi Kantor
        </h2>
        <p className="text-gray-600">
          Tentukan koordinat dan alamat lokasi kantor untuk sistem absensi
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-green-50 rounded-lg flex items-start space-x-3">
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 rounded-lg flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Current Location Button */}
      <div className="bg-tosca-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-tosca-900">Gunakan Lokasi Saat Ini</h3>
            <p className="text-sm text-tosca-700">Otomatis mengisi koordinat berdasarkan GPS</p>
          </div>
          <button
            onClick={getCurrentLocation}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-tosca-600 text-white rounded-lg hover:bg-tosca-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Navigation className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Mencari...' : 'Gunakan GPS'}</span>
          </button>
        </div>
      </div>

      {/* Preset Locations */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-3">Lokasi Populer</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {presetLocations.map((preset) => (
            <button
              key={preset.name}
              onClick={() => selectPresetLocation(preset)}
              className="p-3 text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-tosca-300 transition-colors"
            >
              <div className="font-medium text-gray-900">{preset.name}</div>
              <div className="text-xs text-gray-500">
                {preset.lat.toFixed(4)}, {preset.lng.toFixed(4)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Manual Input */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Input Manual Koordinat</h3>
        
        <div className="space-y-4">
          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alamat Kantor *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Contoh: Jl. Sudirman No. 1, Jakarta Pusat"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Latitude *
              </label>
              <input
                type="number"
                step="any"
                value={selectedLocation.lat || ''}
                onChange={(e) => handleLocationChange('lat', e.target.value)}
                placeholder="-6.200000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Rentang: -90 hingga 90</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longitude *
              </label>
              <input
                type="number"
                step="any"
                value={selectedLocation.lng || ''}
                onChange={(e) => handleLocationChange('lng', e.target.value)}
                placeholder="106.816666"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Rentang: -180 hingga 180</p>
            </div>
          </div>

          {/* Radius */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Radius Absensi (meter)
            </label>
            <input
              type="number"
              value={radius}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              Karyawan harus berada dalam radius ini untuk dapat absen
            </p>
          </div>
        </div>
      </div>

      {/* Preview */}
      {selectedLocation.lat && selectedLocation.lng && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Preview Lokasi</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-start space-x-2">
              <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{address || 'Alamat belum diisi'}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-gray-600">
              <div>
                <span className="font-medium">Latitude:</span> {selectedLocation.lat.toFixed(6)}
              </div>
              <div>
                <span className="font-medium">Longitude:</span> {selectedLocation.lng.toFixed(6)}
              </div>
            </div>
            <div className="text-gray-600">
              <span className="font-medium">Radius Absensi:</span> {radius} meter
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h4 className="font-medium text-yellow-800 mb-2">💡 Tips Mencari Koordinat</h4>
        <div className="text-sm text-yellow-700 space-y-1">
          <p>• Buka Google Maps di browser</p>
          <p>• Cari alamat kantor Anda</p>
          <p>• Klik kanan pada lokasi yang tepat</p>
          <p>• Pilih koordinat yang muncul (contoh: -6.200000, 106.816666)</p>
          <p>• Copy dan paste ke form di atas</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-center space-x-2">
            <X className="h-4 w-4" />
            <span>Batal</span>
          </div>
        </button>
        <button
          onClick={handleSave}
          disabled={!selectedLocation.lat || !selectedLocation.lng || !address.trim()}
          className="flex-1 bg-tosca-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-tosca-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <div className="flex items-center justify-center space-x-2">
            <Save className="h-4 w-4" />
            <span>Simpan Lokasi</span>
          </div>
        </button>
      </div>
    </div>
  );
};

export default SimpleLocationPicker;