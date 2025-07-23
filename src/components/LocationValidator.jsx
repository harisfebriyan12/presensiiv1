import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getCurrentLocation, isWithinRadius } from '../hooks/haversine';
import { getOfficeLocation } from '../utils/supabaseClient';

const LocationValidator = ({ onLocationValidated }) => {
  const [location, setLocation] = useState(null);
  const [isValidLocation, setIsValidLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [officeLocation, setOfficeLocation] = useState(null);

  useEffect(() => {
    initializeAndValidate();
  }, []);

  const initializeAndValidate = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get current office location from system settings
      const office = await getOfficeLocation();
      setOfficeLocation(office);
      
      // Get user location
      const userLocation = await getCurrentLocation();
      setLocation(userLocation);
      
      const isValid = isWithinRadius(
        userLocation.latitude,
        userLocation.longitude,
        office.latitude,
        office.longitude,
        office.radius
      );
      
      setIsValidLocation(isValid);
      
      if (onLocationValidated) {
        onLocationValidated(isValid, userLocation);
      }
      
    } catch (err) {
      console.error('Location validation error:', err);
      let errorMessage = err.message;
      
      // Translate common error messages to Indonesian
      if (errorMessage.includes('denied')) {
        errorMessage = 'Akses lokasi ditolak. Silakan izinkan akses lokasi.';
      } else if (errorMessage.includes('unavailable')) {
        errorMessage = 'Informasi lokasi tidak tersedia.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Permintaan lokasi timeout.';
      } else if (errorMessage.includes('not supported')) {
        errorMessage = 'Geolokasi tidak didukung oleh browser ini.';
      }
      
      setError(errorMessage);
      if (onLocationValidated) {
        onLocationValidated(false, null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateLocation = async () => {
    await initializeAndValidate();
  };

  const formatCoordinate = (coord) => {
    return coord ? coord.toFixed(6) : 'Tidak diketahui';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-blue-50 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
        <p className="text-blue-700 font-medium">Mendapatkan lokasi Anda...</p>
        <p className="text-blue-600 text-sm mt-1">Silakan izinkan akses lokasi</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-red-50 rounded-lg">
        <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
        <p className="text-red-700 font-medium mb-2">Kesalahan Akses Lokasi</p>
        <p className="text-red-600 text-sm text-center mb-4">{error}</p>
        <button
          onClick={validateLocation}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-lg ${isValidLocation ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className="flex items-start space-x-4">
        {isValidLocation ? (
          <CheckCircle className="h-8 w-8 text-green-500 flex-shrink-0 mt-1" />
        ) : (
          <XCircle className="h-8 w-8 text-red-500 flex-shrink-0 mt-1" />
        )}
        
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <MapPin className="h-5 w-5 text-gray-600" />
            <h3 className={`font-semibold ${isValidLocation ? 'text-green-700' : 'text-red-700'}`}>
              {isValidLocation ? 'Lokasi Terverifikasi' : 'Lokasi Tidak Valid'}
            </h3>
          </div>
          
          <p className={`text-sm mb-3 ${isValidLocation ? 'text-green-600' : 'text-red-600'}`}>
            {isValidLocation 
              ? 'Anda berada dalam radius yang diizinkan dari kantor.'
              : `Anda harus berada dalam radius ${officeLocation?.radius || 100} meter dari kantor untuk absen.`
            }
          </p>
          
          {location && officeLocation && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-white/70 p-3 rounded">
                <p className="font-medium text-gray-700 mb-1">Lokasi Anda</p>
                <p className="text-gray-600">
                  {formatCoordinate(location.latitude)}, {formatCoordinate(location.longitude)}
                </p>
              </div>
              
              <div className="bg-white/70 p-3 rounded">
                <p className="font-medium text-gray-700 mb-1">Lokasi Kantor</p>
                <p className="text-gray-600">
                  {formatCoordinate(officeLocation.latitude)}, {formatCoordinate(officeLocation.longitude)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{officeLocation.address}</p>
              </div>
            </div>
          )}
          
          <button
            onClick={validateLocation}
            className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isValidLocation
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            Perbarui Lokasi
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationValidator;