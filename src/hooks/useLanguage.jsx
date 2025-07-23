import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Optimized translation dictionary with lazy loading
const translations = {
  id: {
    // Common
    'loading': 'Memuat...',
    'save': 'Simpan',
    'cancel': 'Batal',
    'edit': 'Edit',
    'delete': 'Hapus',
    'add': 'Tambah',
    'search': 'Cari',
    'filter': 'Filter',
    'back': 'Kembali',
    'next': 'Selanjutnya',
    'previous': 'Sebelumnya',
    'submit': 'Kirim',
    'close': 'Tutup',
    'confirm': 'Konfirmasi',
    'success': 'Berhasil',
    'error': 'Error',
    'warning': 'Peringatan',
    'info': 'Informasi',
    'note': 'Catatan',
    'notSet': 'Belum diatur',
    'from': 'dari',
    'days': 'hari',
    'minutes': 'menit',
    'hours': 'jam',
    'office': 'Kantor',
    
    // Authentication
    'login': 'Masuk',
    'logout': 'Keluar',
    'register': 'Daftar',
    'email': 'Email',
    'password': 'Password',
    'confirmPassword': 'Konfirmasi Password',
    'forgotPassword': 'Lupa Password',
    'rememberMe': 'Ingat Saya',
    'loginTitle': 'Portal Karyawan',
    'loginSubtitle': 'Masuk untuk mengakses sistem absensi',
    'registerTitle': 'Daftar Akun Baru',
    'welcomeBack': 'Selamat Datang Kembali',
    'createAccount': 'Buat Akun Baru',
    'emailPlaceholder': 'Masukkan email Anda',
    'passwordPlaceholder': 'Masukkan password Anda',
    'loggingIn': 'Sedang Masuk...',
    'registerSuccess': 'Pendaftaran Berhasil!',
    'noAccount': 'Belum punya akun?',
    'registerHere': 'Daftar di sini',
    'demoInfo': 'Info',
    'demoDescription': 'Pilih role sesuai akses yang diinginkan saat mendaftar',
    
    // Dashboard
    'dashboard': 'Dashboard',
    'welcome': 'Selamat Datang',
    'todayAttendance': 'Absensi Hari Ini',
    'monthlyStats': 'Statistik Bulanan',
    'recentActivity': 'Aktivitas Terbaru',
    'quickActions': 'Aksi Cepat',
    'quickAccess': 'Akses Manajemen',
    'monthlyAttendance': 'Hadir Bulan Ini',
    'onTime': 'Tepat Waktu',
    'late': 'Terlambat',
    'monthlySalary': 'Gaji Bulan Ini',
    'dailySalary': 'Gaji Harian',
    'perWorkDay': 'per hari kerja',
    'noAttendanceToday': 'Belum ada absensi hari ini',
    'attendNow': 'Absen Sekarang',
    'noActivity': 'Belum ada aktivitas',
    'moreWarnings': 'peringatan lainnya',
    'activeWarnings': 'Peringatan Aktif',
    
    // Attendance
    'attendance': 'Absensi',
    'checkIn': 'Masuk',
    'checkOut': 'Keluar',
    'attendanceHistory': 'Riwayat Absensi',
    'attendanceReport': 'Laporan Absensi',
    'lateArrival': 'Terlambat',
    'absent': 'Tidak Hadir',
    'present': 'Hadir',
    'workHours': 'Jam Kerja',
    'overtime': 'Lembur',
    'faceVerification': 'Verifikasi Wajah',
    'locationVerification': 'Verifikasi Lokasi',
    'attendanceSummary': 'Ringkasan Kehadiran',
    
    // Employee Management
    'employees': 'Karyawan',
    'employee': 'Karyawan',
    'employeeManagement': 'Kelola Karyawan',
    'addEmployee': 'Tambah Karyawan',
    'editEmployee': 'Edit Karyawan',
    'employeeDetails': 'Detail Karyawan',
    'personalInfo': 'Informasi Pribadi',
    'employmentInfo': 'Informasi Pekerjaan',
    'bankingInfo': 'Informasi Bank',
    'fullName': 'Nama Lengkap',
    'phoneNumber': 'Nomor Telepon',
    'address': 'Alamat',
    'birthDate': 'Tanggal Lahir',
    'gender': 'Jenis Kelamin',
    'male': 'Laki-laki',
    'female': 'Perempuan',
    'position': 'Jabatan',
    'department': 'Departemen',
    'salary': 'Gaji',
    'joinDate': 'Tanggal Bergabung',
    'status': 'Status',
    'active': 'Aktif',
    'inactive': 'Tidak Aktif',
    'terminated': 'Diberhentikan',
    'bankName': 'Nama Bank',
    'bankAccountNumber': 'Nomor Rekening',
    'bankAccountName': 'Nama Pemegang Rekening',
    
    // Salary & Positions
    'salaryManagement': 'Kelola Gaji',
    'positionManagement': 'Kelola Jabatan',
    'positions': 'Jabatan',
    'addPosition': 'Tambah Jabatan',
    'editPosition': 'Edit Jabatan',
    'baseSalary': 'Gaji Pokok',
    'minSalary': 'Gaji Minimum',
    'maxSalary': 'Gaji Maksimum',
    'salaryRange': 'Rentang Gaji',
    'bonus': 'Bonus',
    'deduction': 'Potongan',
    'netSalary': 'Gaji Bersih',
    'salaryInfo': 'Informasi Gaji',
    
    // Settings
    'settings': 'Pengaturan',
    'systemSettings': 'Pengaturan Sistem',
    'attendanceSettings': 'Pengaturan Absensi',
    'locationSettings': 'Pengaturan Lokasi',
    'workingHours': 'Jam Kerja',
    'workStartTime': 'Jam Masuk',
    'workEndTime': 'Jam Keluar',
    'lateThreshold': 'Batas Terlambat',
    'earlyLeaveThreshold': 'Batas Pulang Cepat',
    'breakDuration': 'Durasi Istirahat',
    'officeLocation': 'Lokasi Kantor',
    'allowedRadius': 'Radius Diizinkan',
    'language': 'Bahasa',
    'indonesian': 'Bahasa Indonesia',
    'english': 'English',
    'systemSettingsDesc': 'Kelola lokasi kantor dan radius',
    
    // Reports
    'reports': 'Laporan',
    'salaryReport': 'Laporan Gaji',
    'employeeReport': 'Laporan Karyawan',
    'exportReport': 'Export Laporan',
    'dateRange': 'Rentang Tanggal',
    'startDate': 'Tanggal Mulai',
    'endDate': 'Tanggal Selesai',
    'reportsDesc': 'Lihat dan export laporan kehadiran',
    
    // Profile
    'profile': 'Profil',
    'myProfile': 'Profil Saya',
    'editProfile': 'Edit Profil',
    'changePassword': 'Ubah Password',
    'currentPassword': 'Password Saat Ini',
    'newPassword': 'Password Baru',
    'profilePicture': 'Foto Profil',
    'uploadPhoto': 'Upload Foto',
    
    // Admin specific
    'adminPanel': 'Panel Admin',
    'adminRole': 'Administrator',
    'employeeRole': 'Karyawan',
    'adminDescription': 'Kelola semua pengguna dan sistem',
    'employeeDescription': 'Absensi pribadi dan riwayat',
    'userManagement': 'Kelola Karyawan',
    'userManagementDesc': 'Tambah, edit, dan kelola data karyawan',
    'systemLogs': 'Log Sistem',
    'activityLogs': 'Log Aktivitas',
    'passwordChanges': 'Perubahan Password',
    'systemHealth': 'Kesehatan Sistem',
    'backupRestore': 'Backup & Restore',
    
    // Face Recognition
    'faceRegistration': 'Lengkapi Profil',
    'faceCapture': 'Ambil Foto Wajah',
    'faceDetected': 'Wajah Terdeteksi',
    'faceNotDetected': 'Wajah Tidak Terdeteksi',
    'faceQuality': 'Kualitas Wajah',
    'retakePhoto': 'Ambil Ulang Foto',
    'faceRegistered': 'Wajah Terdaftar',
    'faceNotRegistered': 'Profil Belum Lengkap',
    'faceRegistrationRequired': 'Anda perlu menambahkan foto wajah untuk dapat melakukan absensi dengan verifikasi wajah.',
    'faceRegistrationDesc': 'Untuk dapat melakukan absensi dengan verifikasi wajah, Anda perlu menambahkan foto wajah ke profil.',
    'faceRegistrationNote': 'Tanpa foto wajah, Anda tidak dapat melakukan absensi dengan verifikasi keamanan.',
    'registerFace': 'Setup Foto Wajah',
    
    // Location
    'currentLocation': 'Lokasi Saat Ini',
    'officeRadius': 'Radius Kantor',
    'insideOfficeArea': 'Dalam Area Kantor',
    'outsideOfficeArea': 'Di Luar Area Kantor',
    'locationAccuracy': 'Akurasi Lokasi',
    'gpsEnabled': 'GPS Aktif',
    'gpsDisabled': 'GPS Tidak Aktif',
  },
  
  en: {
    // Common
    'loading': 'Loading...',
    'save': 'Save',
    'cancel': 'Cancel',
    'edit': 'Edit',
    'delete': 'Delete',
    'add': 'Add',
    'search': 'Search',
    'filter': 'Filter',
    'back': 'Back',
    'next': 'Next',
    'previous': 'Previous',
    'submit': 'Submit',
    'close': 'Close',
    'confirm': 'Confirm',
    'success': 'Success',
    'error': 'Error',
    'warning': 'Warning',
    'info': 'Information',
    'note': 'Note',
    'notSet': 'Not Set',
    'from': 'from',
    'days': 'days',
    'minutes': 'minutes',
    'hours': 'hours',
    'office': 'Office',
    
    // Authentication
    'login': 'Login',
    'logout': 'Logout',
    'register': 'Register',
    'email': 'Email',
    'password': 'Password',
    'confirmPassword': 'Confirm Password',
    'forgotPassword': 'Forgot Password',
    'rememberMe': 'Remember Me',
    'loginTitle': 'Employee Portal',
    'loginSubtitle': 'Login to access attendance system',
    'registerTitle': 'Create New Account',
    'welcomeBack': 'Welcome Back',
    'createAccount': 'Create New Account',
    'emailPlaceholder': 'Enter your email',
    'passwordPlaceholder': 'Enter your password',
    'loggingIn': 'Logging in...',
    'registerSuccess': 'Registration Successful!',
    'noAccount': "Don't have an account?",
    'registerHere': 'Register here',
    'demoInfo': 'Info',
    'demoDescription': 'Choose role according to desired access when registering',
    
    // Dashboard
    'dashboard': 'Dashboard',
    'welcome': 'Welcome',
    'todayAttendance': "Today's Attendance",
    'monthlyStats': 'Monthly Statistics',
    'recentActivity': 'Recent Activity',
    'quickActions': 'Quick Actions',
    'quickAccess': 'Management Access',
    'monthlyAttendance': 'Monthly Attendance',
    'onTime': 'On Time',
    'late': 'Late',
    'monthlySalary': 'Monthly Salary',
    'dailySalary': 'Daily Salary',
    'perWorkDay': 'per work day',
    'noAttendanceToday': 'No attendance today',
    'attendNow': 'Attend Now',
    'noActivity': 'No activity',
    'moreWarnings': 'more warnings',
    'activeWarnings': 'Active Warnings',
    
    // Attendance
    'attendance': 'Attendance',
    'checkIn': 'Check In',
    'checkOut': 'Check Out',
    'attendanceHistory': 'Attendance History',
    'attendanceReport': 'Attendance Report',
    'lateArrival': 'Late',
    'absent': 'Absent',
    'present': 'Present',
    'workHours': 'Work Hours',
    'overtime': 'Overtime',
    'faceVerification': 'Face Verification',
    'locationVerification': 'Location Verification',
    'attendanceSummary': 'Attendance Summary',
    
    // Employee Management
    'employees': 'Employees',
    'employee': 'Employee',
    'employeeManagement': 'Employee Management',
    'addEmployee': 'Add Employee',
    'editEmployee': 'Edit Employee',
    'employeeDetails': 'Employee Details',
    'personalInfo': 'Personal Information',
    'employmentInfo': 'Employment Information',
    'bankingInfo': 'Banking Information',
    'fullName': 'Full Name',
    'phoneNumber': 'Phone Number',
    'address': 'Address',
    'birthDate': 'Birth Date',
    'gender': 'Gender',
    'male': 'Male',
    'female': 'Female',
    'position': 'Position',
    'department': 'Department',
    'salary': 'Salary',
    'joinDate': 'Join Date',
    'status': 'Status',
    'active': 'Active',
    'inactive': 'Inactive',
    'terminated': 'Terminated',
    'bankName': 'Bank Name',
    'bankAccountNumber': 'Account Number',
    'bankAccountName': 'Account Holder Name',
    
    // Salary & Positions
    'salaryManagement': 'Salary Management',
    'positionManagement': 'Position Management',
    'positions': 'Positions',
    'addPosition': 'Add Position',
    'editPosition': 'Edit Position',
    'baseSalary': 'Base Salary',
    'minSalary': 'Minimum Salary',
    'maxSalary': 'Maximum Salary',
    'salaryRange': 'Salary Range',
    'bonus': 'Bonus',
    'deduction': 'Deduction',
    'netSalary': 'Net Salary',
    'salaryInfo': 'Salary Information',
    
    // Settings
    'settings': 'Settings',
    'systemSettings': 'System Settings',
    'attendanceSettings': 'Attendance Settings',
    'locationSettings': 'Location Settings',
    'workingHours': 'Working Hours',
    'workStartTime': 'Work Start Time',
    'workEndTime': 'Work End Time',
    'lateThreshold': 'Late Threshold',
    'earlyLeaveThreshold': 'Early Leave Threshold',
    'breakDuration': 'Break Duration',
    'officeLocation': 'Office Location',
    'allowedRadius': 'Allowed Radius',
    'language': 'Language',
    'indonesian': 'Bahasa Indonesia',
    'english': 'English',
    'systemSettingsDesc': 'Manage office location and radius',
    
    // Reports
    'reports': 'Reports',
    'salaryReport': 'Salary Report',
    'employeeReport': 'Employee Report',
    'exportReport': 'Export Report',
    'dateRange': 'Date Range',
    'startDate': 'Start Date',
    'endDate': 'End Date',
    'reportsDesc': 'View and export attendance reports',
    
    // Profile
    'profile': 'Profile',
    'myProfile': 'My Profile',
    'editProfile': 'Edit Profile',
    'changePassword': 'Change Password',
    'currentPassword': 'Current Password',
    'newPassword': 'New Password',
    'profilePicture': 'Profile Picture',
    'uploadPhoto': 'Upload Photo',
    
    // Admin specific
    'adminPanel': 'Admin Panel',
    'adminRole': 'Administrator',
    'employeeRole': 'Employee',
    'adminDescription': 'Manage all users and system',
    'employeeDescription': 'Personal attendance and history',
    'userManagement': 'User Management',
    'userManagementDesc': 'Add, edit, and manage employee data',
    'systemLogs': 'System Logs',
    'activityLogs': 'Activity Logs',
    'passwordChanges': 'Password Changes',
    'systemHealth': 'System Health',
    'backupRestore': 'Backup & Restore',
    
    // Face Recognition
    'faceRegistration': 'Complete Profile',
    'faceCapture': 'Capture Face',
    'faceDetected': 'Face Detected',
    'faceNotDetected': 'Face Not Detected',
    'faceQuality': 'Face Quality',
    'retakePhoto': 'Retake Photo',
    'faceRegistered': 'Face Registered',
    'faceNotRegistered': 'Profile Incomplete',
    'faceRegistrationRequired': 'You need to add a face photo to perform attendance with face verification.',
    'faceRegistrationDesc': 'To perform attendance with face verification, you need to add a face photo to your profile.',
    'faceRegistrationNote': 'Without a face photo, you cannot perform attendance with security verification.',
    'registerFace': 'Setup Face Photo',
    
    // Location
    'currentLocation': 'Current Location',
    'officeRadius': 'Office Radius',
    'insideOfficeArea': 'Inside Office Area',
    'outsideOfficeArea': 'Outside Office Area',
    'locationAccuracy': 'Location Accuracy',
    'gpsEnabled': 'GPS Enabled',
    'gpsDisabled': 'GPS Disabled',
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('id'); // Default to Indonesian

  useEffect(() => {
    // Load language from localStorage
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && ['id', 'en'].includes(savedLanguage)) {
      setLanguage(savedLanguage);
    }
  }, []);

  const changeLanguage = (newLanguage) => {
    if (['id', 'en'].includes(newLanguage)) {
      setLanguage(newLanguage);
      localStorage.setItem('language', newLanguage);
    }
  };

  // Memoized translation function for better performance
  const t = React.useCallback((key) => {
    return translations[language]?.[key] || key;
  }, [language]);

  const value = React.useMemo(() => ({
    language,
    changeLanguage,
    t,
    isIndonesian: language === 'id',
    isEnglish: language === 'en'
  }), [language, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};