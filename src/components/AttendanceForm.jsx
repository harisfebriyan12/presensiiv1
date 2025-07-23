import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { Clock, MapPin, Camera, CheckCircle, AlertCircle, User, Edit, Bell, XCircle, Info } from 'lucide-react';
import { supabase, getOfficeLocation, getCameraVerificationSettings } from '../hooks/supabaseClient';
import { processImageUrl, compareFaceFingerprints } from '../hooks/customFaceRecognition';
import CustomFaceCapture from './CustomFaceCapture';
import LocationValidator from './LocationValidator';

const AttendanceForm = ({ user, onAttendanceSubmitted, todayAttendance = [] }) => {
  const [attendanceType, setAttendanceType] = useState('masuk');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validLocation, setValidLocation] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceFingerprint, setFaceFingerprint] = useState(null);
  const [storedFingerprint, setStoredFingerprint] = useState(null);
  const [step, setStep] = useState(1); // 1: Location, 2: Face, 3: Submit
  const [error, setError] = useState(null);
  const [lastAttendance, setLastAttendance] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [cameraVerificationEnabled, setCameraVerificationEnabled] = useState(true);
  const [officeLocation, setOfficeLocation] = useState(null);
  const [distanceFromOffice, setDistanceFromOffice] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [workHoursSettings, setWorkHoursSettings] = useState({
    startTime: '08:00',
    endTime: '17:00',
    lateThreshold: 15,
    earlyLeaveThreshold: 15,
    breakDuration: 60
  });

  useEffect(() => {
    // Check if mobile device
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  useEffect(() => {
    fetchUserProfile();
    fetchLastAttendance();
    determineAttendanceType();
    fetchCameraSettings();
    fetchOfficeLocation();
    fetchWorkHoursSettings();
  }, [user, todayAttendance]);

  const fetchOfficeLocation = async () => {
    try {
      const location = await getOfficeLocation();
      setOfficeLocation(location);
    } catch (error) {
      console.error('Error fetching office location:', error);
    }
  };

  const fetchWorkHoursSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'work_hours')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.setting_value) {
        setWorkHoursSettings(prevSettings => ({ ...prevSettings, ...data.setting_value }));
      }
    } catch (error) {
      console.error('Error fetching work hours settings:', error);
    }
  };

  const fetchCameraSettings = async () => {
    try {
      const settings = await getCameraVerificationSettings();
      setCameraVerificationEnabled(settings.enabled);
    } catch (error) {
      console.error('Error fetching camera settings:', error);
      setCameraVerificationEnabled(true);
    }
  };

  const determineAttendanceType = () => {
    const hasCheckedIn = todayAttendance.some(r => r.type === 'masuk' && r.status === 'berhasil');
    const hasCheckedOut = todayAttendance.some(r => r.type === 'keluar' && r.status === 'berhasil');
    
    if (!hasCheckedIn) {
      setAttendanceType('masuk');
    } else if (hasCheckedIn && !hasCheckedOut) {
      setAttendanceType('keluar');
    }
  };

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);

      if (data.avatar_url && cameraVerificationEnabled) {
        try {
          const result = await processImageUrl(data.avatar_url);
          setStoredFingerprint(result.fingerprint);
        } catch (err) {
          console.error('Error loading stored face fingerprint:', err);
          setError('Gagal memuat data wajah tersimpan. Silakan hubungi administrator.');
        }
      } else if (cameraVerificationEnabled) {
        setError('Foto profil belum tersedia. Silakan lengkapi profil Anda terlebih dahulu.');
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError('Gagal memuat profil pengguna.');
    }
  };

  const fetchLastAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'berhasil')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setLastAttendance(data[0]);
      }
    } catch (err) {
      console.error('Error fetching last attendance:', err);
    }
  };

  const showLocationErrorAlert = (distance) => {
    let message = '';
    
    if (distance > 1000) {
      message = `Anda berada ${(distance/1000).toFixed(1)} km dari lokasi kantor.`;
    } else {
      message = ``;
    }
    
    message += '<br/><br/>Silakan datang ke lokasi kantor untuk melakukan absensi.';

    Swal.fire({
      icon: 'error',
      title: 'Hmm, Sistem mendeteksi kamu di luar lokasi kantor',
      html: message,
      confirmButtonText: 'Mengerti',
      confirmButtonColor: '#3085d6',
    });
  };

  const handleLocationValidated = (isValid, location, distance) => {
    setDistanceFromOffice(distance);
    
    if (!isValid) {
      showLocationErrorAlert(distance);
      setValidLocation(false);
      return;
    }

    setValidLocation(true);
    setUserLocation(location);
    
    // Show success alert for location
    Swal.fire({
      icon: 'success',
      title: 'Lokasi Valid',
      text: 'Anda berada di lokasi kantor yang ditentukan',
      timer: 2000,
      showConfirmButton: false
    });

    if (cameraVerificationEnabled) {
      setStep(2); // Move to face verification step
    } else {
      setStep(3); // Skip face verification if disabled
    }
  };

  const handleFaceCapture = (photoBlob, fingerprint) => {
    setCapturedFace(photoBlob);
    setFaceFingerprint(fingerprint);
    
    // Show face capture success alert
    Swal.fire({
      icon: 'success',
      title: 'Wajah Terverifikasi',
      text: 'Wajah Anda berhasil dikenali',
      timer: 2000,
      showConfirmButton: false
    });
    
    setStep(3); // Move to submit step
  };

  const verifyFace = async () => {
    if (!cameraVerificationEnabled) return true;
    
    if (!faceFingerprint || !storedFingerprint) {
      throw new Error('Data wajah tidak tersedia untuk verifikasi');
    }

    try {
      const FACE_MATCH_THRESHOLD = 0.7;
      const isMatch = compareFaceFingerprints(faceFingerprint, storedFingerprint, FACE_MATCH_THRESHOLD);
      
      if (!isMatch) {
        throw new Error('Wajah tidak cocok dengan data yang tersimpan. Pastikan Anda adalah orang yang benar dengan pencahayaan yang baik.');
      }

      return true;
    } catch (err) {
      console.error('Face verification error:', err);
      throw err;
    }
  };

  const calculateWorkDetails = () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const workStartTime = workHoursSettings.startTime;
    const workEndTime = workHoursSettings.endTime;
    const lateThreshold = workHoursSettings.lateThreshold || 15;
    
    let isLate = false;
    let lateMinutes = 0;
    let workHours = 0;
    let overtimeHours = 0;

    if (attendanceType === 'masuk') {
      // Calculate late threshold time
      const [startHour, startMinute] = workStartTime.split(':').map(Number);
      const thresholdTime = new Date();
      thresholdTime.setHours(startHour, startMinute + lateThreshold, 0, 0);
      const thresholdTimeString = thresholdTime.toTimeString().slice(0, 5);
      
      isLate = currentTime > thresholdTimeString;
      if (isLate) {
        const startTime = new Date(`1970-01-01T${workStartTime}:00`);
        const currentDateTime = new Date(`1970-01-01T${currentTime}:00`);
        lateMinutes = Math.floor((currentDateTime - startTime) / 60000);
      }
    } else if (attendanceType === 'keluar') {
      if (lastAttendance && lastAttendance.type === 'masuk') {
        const checkInTime = new Date(lastAttendance.timestamp);
        const checkOutTime = now;
        const totalMinutes = Math.floor((checkOutTime - checkInTime) / 60000);
        
        // Subtract break duration
        const breakDuration = workHoursSettings.breakDuration || 60;
        const workMinutes = Math.max(0, totalMinutes - breakDuration);
        workHours = Math.max(0, workMinutes / 60);
        
        // Calculate standard work hours (from start to end time)
        const [startHour, startMinute] = workStartTime.split(':').map(Number);
        const [endHour, endMinute] = workEndTime.split(':').map(Number);
        const standardWorkMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute) - breakDuration;
        const standardWorkHours = standardWorkMinutes / 60;
        
        if (workHours > standardWorkHours) {
          overtimeHours = workHours - standardWorkHours;
          workHours = standardWorkHours;
        }
      }
    }

    return { isLate, lateMinutes, workHours, overtimeHours };
  };

  const isWithinWorkingHours = () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const workStartTime = workHoursSettings.startTime;
    const workEndTime = workHoursSettings.endTime;
    
    // Allow some buffer before start time (30 minutes early)
    const [startHour, startMinute] = workStartTime.split(':').map(Number);
    const earlyStartTime = new Date();
    earlyStartTime.setHours(startHour, startMinute - 30, 0, 0);
    const earlyStartTimeString = earlyStartTime.toTimeString().slice(0, 5);
    
    // Allow some buffer after end time (30 minutes late)
    const [endHour, endMinute] = workEndTime.split(':').map(Number);
    const lateEndTime = new Date();
    lateEndTime.setHours(endHour, endMinute + 30, 0, 0);
    const lateEndTimeString = lateEndTime.toTimeString().slice(0, 5);
    
    if (attendanceType === 'masuk') {
      return currentTime >= earlyStartTimeString && currentTime <= lateEndTimeString;
    } else if (attendanceType === 'keluar') {
      return currentTime >= workStartTime && currentTime <= lateEndTimeString;
    }
    
    return true;
  };

  const submitAttendance = async () => {
    if (!validLocation || !userLocation) {
      setError('Silakan selesaikan verifikasi lokasi');
      return;
    }
    
    if (cameraVerificationEnabled && !faceFingerprint) {
      setError('Silakan selesaikan verifikasi wajah');
      return;
    }

    // Check if within working hours
    if (!isWithinWorkingHours()) {
      const workStartTime = workHoursSettings.startTime;
      const workEndTime = workHoursSettings.endTime;
      
      Swal.fire({
        icon: 'warning',
        title: 'Di Luar Jam Kerja',
        html: `
          <div class="text-left">
            <p class="mb-2">Absensi ${attendanceType} hanya dapat dilakukan pada jam kerja:</p>
            <p class="mb-2"><strong>Jam Kerja:</strong> ${workStartTime} - ${workEndTime}</p>
            <p class="text-sm text-gray-600">Jika Anda perlu melakukan absensi di luar jam kerja, silakan hubungi HRD.</p>
          </div>
        `,
        confirmButtonText: 'Mengerti',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    const hasAlreadySubmitted = todayAttendance.some(r => 
      r.type === attendanceType && r.status === 'berhasil'
    );

    if (hasAlreadySubmitted) {
      Swal.fire({
        icon: 'warning',
        title: 'Absensi Sudah Dilakukan',
        text: `Anda sudah melakukan absensi ${attendanceType} hari ini.`,
        confirmButtonText: 'OK'
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (cameraVerificationEnabled) {
        await verifyFace();
      }

      const now = new Date();
      const { isLate, lateMinutes, workHours, overtimeHours } = calculateWorkDetails();

      const dailySalary = userProfile?.salary ? userProfile.salary / 22 : 0;
      let dailySalaryEarned = 0;
      
      if (attendanceType === 'masuk') {
        if (isLate && lateMinutes > 15) {
          const deductionRate = Math.min(lateMinutes / 60 * 0.1, 0.5);
          dailySalaryEarned = dailySalary * (1 - deductionRate);
        } else {
          dailySalaryEarned = dailySalary;
        }
      }

      const attendanceData = {
        user_id: user.id,
        type: attendanceType,
        timestamp: now.toISOString(),
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        status: 'berhasil',
        is_late: isLate, 
        late_minutes: lateMinutes,
        work_hours: workHours,
        overtime_hours: overtimeHours,
        daily_salary_earned: dailySalaryEarned,
        notes: `Absensi ${attendanceType} berhasil dengan verifikasi ${cameraVerificationEnabled ? 'wajah dan ' : ''}lokasi. ${isLate ? `Terlambat ${lateMinutes} menit.` : 'Tepat waktu.'}`
      };

      if (attendanceType === 'masuk') {
        attendanceData.check_in_time = now.toISOString();
      } else {
        attendanceData.check_out_time = now.toISOString();
      }

      const { data, error } = await supabase
        .from('attendance')
        .insert([attendanceData])
        .select();

      if (error) throw error;

      // Log activity
      try {
        await supabase.from('activity_logs').insert([{
          user_id: user.id,
          action_type: `attendance_${attendanceType}`,
          action_details: attendanceData,
          user_agent: navigator.userAgent
        }]);
      } catch (logError) {
        console.error('Failed to log activity:', logError);
      }

      // Show success alert with more details
      Swal.fire({
        icon: 'success',
        title: `Absensi ${attendanceType === 'masuk' ? 'Masuk' : 'Keluar'} Berhasil`,
        html: `
          <div class="text-left">
            <p class="mb-2"><strong>Status:</strong> ${isLate ? `Terlambat ${lateMinutes} menit` : 'Tepat Waktu'}</p>
            ${workHours > 0 ? `<p class="mb-2"><strong>Jam Kerja:</strong> ${workHours.toFixed(1)} jam</p>` : ''}
            ${overtimeHours > 0 ? `<p class="mb-2"><strong>Lembur:</strong> ${overtimeHours.toFixed(1)} jam</p>` : ''}
            ${dailySalaryEarned > 0 ? `<p class="mb-2"><strong>Gaji Harian:</strong> ${formatCurrency(dailySalaryEarned)}</p>` : ''}
            <p class="text-sm text-gray-500 mt-3">${now.toLocaleString('id-ID')}</p>
          </div>
        `,
        confirmButtonText: 'Selesai',
        confirmButtonColor: '#10b981',
        timer: 5000,
        timerProgressBar: true,
      }).then(() => {
        if (onAttendanceSubmitted) {
          onAttendanceSubmitted(data[0]);
        }
        resetForm();
      });

    } catch (err) {
      console.error('Attendance submission error:', err);
      
      let errorStatus = 'gagal';
      if (err.message.includes('wajah') || err.message.includes('Verifikasi wajah')) {
        errorStatus = cameraVerificationEnabled ? 'wajah_tidak_valid' : 'gagal';
      } else if (err.message.includes('lokasi')) {
        errorStatus = 'lokasi_tidak_valid';
      }
      
      const failedData = {
        user_id: user.id,
        type: attendanceType,
        timestamp: new Date().toISOString(),
        latitude: userLocation?.latitude || null,
        longitude: userLocation?.longitude || null,
        status: errorStatus,
        notes: `Absensi gagal: ${err.message}`
      };

      await supabase.from('attendance').insert([failedData]);
      
      Swal.fire({
        icon: 'error',
        title: `Absensi ${attendanceType === 'masuk' ? 'Masuk' : 'Keluar'} Gagal`,
        text: err.message || 'Terjadi kesalahan saat absensi',
        confirmButtonText: 'Coba Lagi',
        confirmButtonColor: '#3085d6'
      });
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setValidLocation(false);
    setUserLocation(null);
    setCapturedFace(null);
    setFaceFingerprint(null);
    setError(null);
    setShowSuccessMessage(false);
    fetchLastAttendance();
  };

  const getCurrentTime = () => {
    return new Date().toLocaleString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Check attendance status
  const hasCheckedIn = todayAttendance.some(r => r.type === 'masuk' && r.status === 'berhasil');
  const hasCheckedOut = todayAttendance.some(r => r.type === 'keluar' && r.status === 'berhasil');
  
  const canCheckIn = !hasCheckedIn;
  const canCheckOut = hasCheckedIn && !hasCheckedOut;

  // Don't show form if no stored fingerprint and camera verification is enabled
  if (cameraVerificationEnabled && !storedFingerprint) {
    if (error && error.includes('Foto profil')) {
      return (
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-3xl w-full">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
            <h2 className="text-2xl font-bold mb-2">Absensi Karyawan</h2>
            <p className="opacity-90">Setup diperlukan untuk melanjutkan</p>
          </div>
          <div className="p-6 text-center">
            <div className="bg-red-100 p-4 rounded-full inline-flex mb-4">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Verifikasi Wajah Diperlukan</h3>
            <p className="text-gray-600 mb-6">
              Untuk keamanan sistem absensi, Anda perlu menambahkan foto wajah ke profil terlebih dahulu.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/profile'}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>Lengkapi Profil Sekarang</span>
              </button>
              
              <button
                onClick={() => setCameraVerificationEnabled(false)}
                className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm"
              >
                Gunakan Mode Tanpa Verifikasi Wajah
              </button>
            </div>

            <div className="mt-6 p-3 bg-blue-50 rounded-lg text-left">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-700 font-medium">Informasi Penting</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Mode tanpa verifikasi wajah hanya dapat digunakan dengan persetujuan HRD dan memiliki batasan tertentu.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-3xl w-full">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
          <h2 className="text-2xl font-bold mb-2">Absensi Karyawan</h2>
          <p className="opacity-90">Memuat data verifikasi...</p>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Menyiapkan sistem verifikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-3xl w-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <User className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-bold truncate">Absensi Karyawan</h2>
            <p className="text-sm md:text-base opacity-90 truncate">{userProfile?.name || 'Pengguna'}</p>
          </div>
        </div>
        <p className="text-xs md:text-sm opacity-90">{getCurrentTime()}</p>
        
        {lastAttendance && (
          <div className="mt-4 p-3 bg-white/10 rounded-lg">
            <p className="text-xs md:text-sm truncate">
              Terakhir: <span className="font-medium">
                {lastAttendance.type === 'masuk' ? 'Masuk' : 'Keluar'}
              </span> {new Date(lastAttendance.timestamp).toLocaleString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        )}

        {/* Attendance Status */}
        <div className="mt-4 p-3 bg-white/10 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${hasCheckedIn ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <span>Masuk:</span>
              <span className="font-medium">{hasCheckedIn ? '✓' : '○'}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${hasCheckedOut ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <span>Keluar:</span>
              <span className="font-medium">{hasCheckedOut ? '✓' : '○'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {(() => {
          const allSteps = [
            { id: 1, name: 'Lokasi' },
            { id: 2, name: 'Wajah' },
            { id: 3, name: 'Kirim' },
          ];
          const steps = cameraVerificationEnabled ? allSteps : [allSteps[0], allSteps[2]];

          if (isMobile) {
            return (
              <div className="flex items-center justify-between mb-6">
                {steps.map((s, index) => (
                  <React.Fragment key={s.id}>
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm transition-colors ${
                        step >= s.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {step > s.id ? <CheckCircle className="h-4 w-4" /> : s.id}
                      </div>
                      <span className="text-xs mt-1">{s.name}</span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className="flex-1 h-1 mx-2 bg-gray-200 relative">
                        <div className={`absolute top-0 left-0 h-full transition-all duration-300 ${
                          step > s.id ? 'bg-blue-600' : 'bg-gray-200'
                        }`} style={{ width: step > s.id ? '100%' : '0%' }}></div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            );
          }

          return (
            <div className="flex items-center mb-8">
              {steps.map((s, index) => (
                <React.Fragment key={s.id}>
                  <div className="flex flex-col items-center text-center w-28">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors duration-300 ${
                      step >= s.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {step > s.id ? <CheckCircle className="h-5 w-5" /> : s.id}
                    </div>
                    <p className={`mt-2 text-sm font-medium transition-colors duration-300 ${step >= s.id ? 'text-blue-700' : 'text-gray-500'}`}>{s.name}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-4 rounded-full transition-colors duration-300 ${step > s.id ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                  )}
                </React.Fragment>
              ))}
            </div>
          );
        })()}

        {/* Attendance Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Jenis Absensi
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setAttendanceType('masuk')}
              disabled={!canCheckIn}
              className={`p-3 md:p-4 rounded-lg border-2 transition-all flex flex-col items-center ${
                attendanceType === 'masuk'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : canCheckIn 
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Clock className="h-5 w-5 md:h-6 md:w-6 mb-2" />
              <p className="font-medium text-sm md:text-base">Masuk</p>
              {!canCheckIn && <p className="text-xs mt-1">Sudah dilakukan</p>}
            </button>
            <button
              onClick={() => setAttendanceType('keluar')}
              disabled={!canCheckOut}
              className={`p-3 md:p-4 rounded-lg border-2 transition-all flex flex-col items-center ${
                attendanceType === 'keluar'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : canCheckOut 
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Clock className="h-5 w-5 md:h-6 md:w-6 mb-2" />
              <p className="font-medium text-sm md:text-base">Keluar</p>
              {!canCheckOut && (
                <p className="text-xs mt-1">
                  {!hasCheckedIn ? 'Belum masuk' : 'Sudah dilakukan'}
                </p>
              )}
            </button>
          </div>
        </div>

        {/* Step Content */}
        {step === 1 && (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <MapPin className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Verifikasi Lokasi</h3>
            </div>
            
            {officeLocation && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Lokasi Kantor:</strong> {officeLocation.name}<br/>
                  <strong>Alamat:</strong> {officeLocation.address}
                </p>
              </div>
            )}
            
            <LocationValidator 
              onLocationValidated={handleLocationValidated} 
              officeLocation={officeLocation}
            />
            
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-700">
                <strong>Perhatian:</strong> Pastikan GPS/Lokasi perangkat Anda aktif dan Anda berada di area kantor.
              </p>
            </div>
          </div>
        )}

        {step === 2 && cameraVerificationEnabled && (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Camera className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Verifikasi Wajah</h3>
            </div>
            
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-700 font-medium">Tips Verifikasi Wajah</p>
                  <ul className="text-xs text-blue-600 mt-1 list-disc list-inside space-y-1">
                    <li>Pastikan pencahayaan cukup terang</li>
                    <li>Hadapkan wajah ke kamera secara lurus</li>
                    <li>Hindari bayangan pada wajah</li>
                    <li>Jangan gunakan masker atau kacamata gelap</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <CustomFaceCapture 
              onFaceCapture={handleFaceCapture} 
              isCapturing={isSubmitting}
              isMobile={isMobile}
            />
            
            <button
              onClick={() => setStep(1)}
              className="mt-4 text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Kembali ke verifikasi lokasi
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <CheckCircle className="h-5 w-5 text-blue-600" /> 
              <h3 className="text-lg font-semibold">Konfirmasi Absensi</h3>
            </div>
            
            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Ringkasan Verifikasi</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Lokasi:</span>
                  <div className="flex items-center text-green-600 font-medium">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span>Terverifikasi</span>
                  </div>
                </div>
                
                {cameraVerificationEnabled && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Wajah:</span>
                    <div className="flex items-center text-green-600 font-medium">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      <span>Terverifikasi</span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Jenis Absensi:</span>
                  <span className="font-medium">
                    {attendanceType === 'masuk' ? 'Masuk' : 'Keluar'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Waktu:</span>
                  <span className="font-medium">
                    {new Date().toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                
                {distanceFromOffice && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Jarak dari Kantor:</span>
                    <span className="font-medium">
                      {distanceFromOffice > 1000 
                        ? `${(distanceFromOffice/1000).toFixed(1)} km` 
                        : `${Math.round(distanceFromOffice)} m`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={resetForm}
                className="flex-1 px-4 py-2 md:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm md:text-base"
              >
                Mulai Ulang
              </button>
              <button
                onClick={submitAttendance}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm md:text-base flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Mengirim...
                  </>
                ) : (
                  'Kirim Absensi'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && !error.includes('Foto profil') && (
          <div className="mt-6 p-4 bg-red-50 rounded-lg flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-medium">Gagal Melakukan Absensi</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
              <button
                onClick={resetForm}
                className="mt-2 text-sm text-red-700 underline hover:text-red-800"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceForm;