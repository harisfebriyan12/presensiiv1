import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Save, X, Navigation, AlertCircle, RefreshCw } from 'lucide-react';

const GoogleMapsLocationPicker = ({ 
  initialLocation, 
  onLocationSelect, 
  onCancel,
  radius = 100 
}) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const [circle, setCircle] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [address, setAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  useEffect(() => {
    checkApiKeyAndLoadMaps();
  }, []);

  const checkApiKeyAndLoadMaps = () => {
    // Check if API key is available
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
      setApiKeyMissing(true);
      setError('Google Maps API key tidak dikonfigurasi. Silakan hubungi administrator untuk mengatur API key.');
      setIsLoading(false);
      return;
    }

    loadGoogleMaps();
  };

  const loadGoogleMaps = () => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      initializeMap();
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    // Create script element with Indonesian language and error handling
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=id&region=ID&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    
    // Create global callback function
    window.initGoogleMaps = () => {
      console.log('Google Maps loaded successfully');
      initializeMap();
    };
    
    script.onerror = (error) => {
      console.error('Google Maps loading error:', error);
      setError('Gagal memuat Google Maps. Periksa koneksi internet dan API key.');
      setIsLoading(false);
    };
    
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    try {
      // Check if mapRef.current exists before initializing
      if (!mapRef.current) {
        console.error('Map container not found');
        setError('Kontainer peta tidak ditemukan.');
        setIsLoading(false);
        return;
      }

      // Check if Google Maps API is available
      if (!window.google || !window.google.maps) {
        setError('Google Maps API tidak tersedia.');
        setIsLoading(false);
        return;
      }

      const defaultCenter = selectedLocation || { lat: -6.200000, lng: 106.816666 }; // Default Jakarta

      const mapOptions = {
        center: defaultCenter,
        zoom: 15,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: 'cooperative'
      };

      const mapInstance = new window.google.maps.Map(mapRef.current, mapOptions);
      setMap(mapInstance);

      // Create marker
      const markerInstance = new window.google.maps.Marker({
        position: defaultCenter,
        map: mapInstance,
        draggable: true,
        title: 'Lokasi Kantor',
        animation: window.google.maps.Animation.DROP
      });
      setMarker(markerInstance);

      // Create radius circle
      const circleInstance = new window.google.maps.Circle({
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#3B82F6',
        fillOpacity: 0.2,
        map: mapInstance,
        center: defaultCenter,
        radius: radius
      });
      setCircle(circleInstance);

      // Add click listener to map
      mapInstance.addListener('click', (event) => {
        const newLocation = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng()
        };
        updateLocation(newLocation);
      });

      // Add drag listener to marker
      markerInstance.addListener('dragend', (event) => {
        const newLocation = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng()
        };
        updateLocation(newLocation);
      });

      // Get initial address
      if (selectedLocation) {
        getAddressFromCoordinates(selectedLocation);
      } else {
        getAddressFromCoordinates(defaultCenter);
      }

      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error initializing map:', err);
      setError(`Gagal menginisialisasi peta: ${err.message}`);
      setIsLoading(false);
    }
  };

  const updateLocation = (location) => {
    setSelectedLocation(location);
    
    if (marker) {
      marker.setPosition(location);
    }
    
    if (circle) {
      circle.setCenter(location);
    }
    
    if (map) {
      map.panTo(location);
    }
    
    getAddressFromCoordinates(location);
  };

  const getAddressFromCoordinates = (location) => {
    if (!window.google || !window.google.maps) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setAddress(results[0].formatted_address);
      } else {
        setAddress(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
      }
    });
  };

  const searchLocation = () => {
    if (!searchQuery.trim() || !window.google || !window.google.maps) return;

    setIsLoading(true);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery }, (results, status) => {
      setIsLoading(false);
      if (status === 'OK' && results[0]) {
        const location = {
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng()
        };
        updateLocation(location);
        setSearchQuery('');
        setError(null);
      } else {
        setError('Lokasi tidak ditemukan. Coba dengan kata kunci yang berbeda.');
      }
    });
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolokasi tidak didukung oleh browser ini.');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        updateLocation(location);
        setIsLoading(false);
        setError(null);
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

  const handleSave = () => {
    if (selectedLocation && onLocationSelect) {
      onLocationSelect({
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        address: address,
        radius: radius
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchLocation();
    }
  };

  const retryLoadMaps = () => {
    setError(null);
    setIsLoading(true);
    setApiKeyMissing(false);
    
    // Remove existing script if any
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    // Clear global callback
    if (window.initGoogleMaps) {
      delete window.initGoogleMaps;
    }
    
    checkApiKeyAndLoadMaps();
  };

  // Show API key missing message
  if (apiKeyMissing) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">
                Google Maps API Key Diperlukan
              </h3>
              <div className="text-yellow-700 space-y-2">
                <p>Untuk menggunakan fitur pemilihan lokasi dengan Google Maps, diperlukan API key yang valid.</p>
                <div className="bg-yellow-100 p-3 rounded text-sm">
                  <p className="font-medium mb-1">Langkah-langkah untuk administrator:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Buat project di <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                    <li>Aktifkan Maps JavaScript API dan Places API</li>
                    <li>Buat API key dan batasi penggunaannya</li>
                    <li>Tambahkan API key ke file .env sebagai VITE_GOOGLE_MAPS_API_KEY</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Location Input */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Input Lokasi Manual</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alamat Kantor
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Masukkan alamat lengkap kantor"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={selectedLocation?.lat || ''}
                  onChange={(e) => setSelectedLocation(prev => ({ ...prev, lat: parseFloat(e.target.value) }))}
                  placeholder="-6.200000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={selectedLocation?.lng || ''}
                  onChange={(e) => setSelectedLocation(prev => ({ ...prev, lng: parseFloat(e.target.value) }))}
                  placeholder="106.816666"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                />
              </div>
            </div>
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
            </div>
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
            onClick={retryLoadMaps}
            className="px-4 py-3 border border-tosca-300 text-tosca-700 rounded-lg hover:bg-tosca-50 transition-colors"
          >
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="h-4 w-4" />
              <span>Coba Lagi</span>
            </div>
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedLocation || !address}
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
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex space-x-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Cari alamat atau tempat..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
            disabled={isLoading || error}
          />
        </div>
        <button
          onClick={searchLocation}
          disabled={isLoading || error || !searchQuery.trim()}
          className="px-4 py-2 bg-tosca-600 text-white rounded-lg hover:bg-tosca-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Cari'}
        </button>
        <button
          onClick={getCurrentLocation}
          disabled={isLoading || error}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Gunakan lokasi saat ini"
        >
          <Navigation className="h-4 w-4" />
        </button>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div 
          ref={mapRef} 
          className="w-full h-96 rounded-lg border border-gray-300 bg-gray-100"
        />
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tosca-600 mb-4"></div>
            <p className="text-gray-600">Memuat Google Maps...</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && !apiKeyMissing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 rounded-lg">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-red-600 text-center mb-4 max-w-sm">{error}</p>
            <button
              onClick={retryLoadMaps}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4" />
                <span>Coba Lagi</span>
              </div>
            </button>
          </div>
        )}
        
        {/* Map Instructions - Only show when map is loaded */}
        {!isLoading && !error && map && (
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg max-w-xs">
            <p className="text-sm text-gray-700">
              <strong>Cara menggunakan:</strong><br />
              • Klik pada peta untuk memilih lokasi<br />
              • Drag marker untuk menyesuaikan posisi<br />
              • Area biru menunjukkan radius absensi
            </p>
          </div>
        )}
      </div>

      {/* Selected Location Info */}
      {selectedLocation && !isLoading && !error && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Lokasi Terpilih</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-start space-x-2">
              <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{address || 'Memuat alamat...'}</span>
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
          disabled={!selectedLocation || isLoading}
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

export default GoogleMapsLocationPicker;