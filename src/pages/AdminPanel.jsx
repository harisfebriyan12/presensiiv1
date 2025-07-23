import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Settings, 
  MapPin, 
  Clock,
  Shield,
  Database,
  UserPlus,
  FileText,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bell,
  Eye,
  Building,
  Camera,
  User,
  Download,
  Save
} from 'lucide-react';
import { supabase } from '../hooks/supabaseClient';
import Swal from 'sweetalert2';
import NotificationSystem from '../components/NotificationSystem';
import WarningLetterGenerator from '../components/WarningLetterGenerator';
import AdminSidebar from '../components/AdminSidebar';

const AdminPanel = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAttendance: 0,
    todayAttendance: 0,
    activeUsers: 0,
    totalSalaryPaid: 0,
    avgDailySalary: 0,
    lateEmployees: 0,
    activeWarnings: 0,
    totalPositions: 0,
    activeDepartments: 0,
    absentToday: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [lateEmployees, setLateEmployees] = useState([]);
  const [absentEmployees, setAbsentEmployees] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDetail, setShowEmployeeDetail] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [cameraSettings, setCameraSettings] = useState({
    enabled: true,
    required_for_admin: false
  });

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
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        navigate('/dashboard');
        return;
      }

      setUser(user);
      setProfile(profile);
      await fetchDashboardData();
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [usersResult, attendanceResult, todayResult, positionsResult] = await Promise.all([
        supabase.from('profiles').select('id, role, status', { count: 'exact' }),
        supabase.from('attendance').select('id', { count: 'exact' }),
        supabase.from('attendance').select('*')
          .gte('timestamp', `${today}T00:00:00`)
          .lte('timestamp', `${today}T23:59:59`),
        supabase.from('positions').select('id, department', { count: 'exact' })
      ]);

      const { data: allEmployees } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url, employee_id, department, role, status')
        .eq('role', 'karyawan')
        .eq('status', 'active');

      const { data: todayAttendanceData } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles!inner(id, name, email, avatar_url, employee_id, department, role)
        `)
        .gte('timestamp', `${today}T00:00:00`)
        .lte('timestamp', `${today}T23:59:59`)
        .eq('status', 'berhasil');

      const checkedInToday = todayAttendanceData
        ?.filter(record => record.type === 'masuk')
        .map(record => record.user_id) || [];

      const absentToday = allEmployees?.filter(emp => 
        !checkedInToday.includes(emp.id) && emp.role !== 'admin'
      ) || [];

      if (absentToday.length > 0) {
        const absentRecords = absentToday.map(emp => ({
          user_id: emp.id,
          type: 'absent',
          timestamp: new Date().toISOString(),
          status: 'tidak_hadir',
          notes: 'Tidak hadir - tidak melakukan absensi masuk',
          is_late: false,
          late_minutes: 0,
          work_hours: 0
        }));

        await supabase
          .from('attendance')
          .upsert(absentRecords, { 
            onConflict: 'user_id,timestamp',
            ignoreDuplicates: true 
          });
      }

      const lateToday = todayAttendanceData
        ?.filter(record => record.type === 'masuk' && record.is_late) || [];

      const { data: salaryData } = await supabase
        .from('employee_salaries')
        .select('daily_salary')
        .eq('is_active', true);

      const totalSalaryPaid = salaryData?.reduce((sum, s) => sum + (s.daily_salary * 22), 0) || 0;
      const avgDailySalary = salaryData?.length > 0 
        ? salaryData.reduce((sum, s) => sum + s.daily_salary, 0) / salaryData.length 
        : 0;

      const { data: warningsData } = await supabase
        .from('attendance_warnings')
        .select('id')
        .eq('is_resolved', false);

      const departments = [...new Set(positionsResult.data?.map(p => p.department).filter(Boolean))] || [];

      setStats({
        totalUsers: usersResult.count || 0,
        totalAttendance: attendanceResult.count || 0,
        todayAttendance: checkedInToday.length,
        activeUsers: usersResult.data?.filter(u => u.status === 'active').length || 0,
        totalSalaryPaid,
        avgDailySalary,
        lateEmployees: lateToday.length,
        activeWarnings: warningsData?.length || 0,
        totalPositions: positionsResult.count || 0,
        activeDepartments: departments.length,
        absentToday: absentToday.length
      });

      setLateEmployees(lateToday);
      setAbsentEmployees(absentToday);

      const { data: recentData } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles!inner(name, role, department, avatar_url, employee_id)
        `)
        .order('timestamp', { ascending: false })
        .limit(15);

      setRecentActivity(recentData || []);

      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('*');

      const settingsObj = {};
      settingsData?.forEach(setting => {
        settingsObj[setting.setting_key] = setting.setting_value;
      });
      setSystemSettings(settingsObj);
      
      const cameraVerificationSetting = settingsData?.find(s => s.setting_key === 'camera_verification');
      if (cameraVerificationSetting?.setting_value) {
        setCameraSettings(cameraVerificationSetting.setting_value);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleSaveCameraSettings = async () => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'camera_verification',
          setting_value: {
            ...cameraSettings,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          },
          description: 'Controls whether face verification is required for attendance',
          is_enabled: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengaturan verifikasi kamera berhasil disimpan!' });
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Error saving camera settings:', error);
      await Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menyimpan pengaturan verifikasi kamera' });
    }
  };

  const handleIssueWarning = (employee) => {
    setSelectedEmployee(employee);
    setShowWarningModal(true);
  };

  const handleWarningGenerated = async (warningLetter) => {
    setShowWarningModal(false);
    await Swal.fire({ icon: 'success', title: 'Surat Peringatan', text: `Surat peringatan ${warningLetter.warning_type} berhasil dibuat dan dikirim ke ${selectedEmployee.name}` });
    fetchDashboardData();
  };

  const handleViewEmployee = async (employee) => {
    if (employee) {
      setSelectedEmployee(employee);
      setShowEmployeeDetail(true);
    } else {
      console.error("Attempted to view details for a null/undefined employee.");
      await Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menampilkan detail: data karyawan tidak ditemukan.' });
    }
  };

  const sendNotificationToEmployee = async (employeeId, type, title, message) => {
    try {
      await supabase.from('notifications').insert([{
        user_id: employeeId,
        admin_id: user.id,
        type: type,
        title: title,
        message: message,
        data: {
          timestamp: new Date().toISOString(),
          sent_by: profile.name
        },
        is_read: false
      }]);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const handleSendLateWarning = async (employee) => {
    try {
      await sendNotificationToEmployee(
        employee.user_id || employee.id,
        'late_warning',
        'Peringatan Keterlambatan',
        `Anda terlambat ${employee.late_minutes} menit hari ini. Harap lebih memperhatikan kedisiplinan waktu.`
      );
      await Swal.fire({ icon: 'success', title: 'Notifikasi Dikirim', text: `Notifikasi peringatan telah dikirim ke ${employee.profiles?.name || employee.name}` });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengirim notifikasi' });
    }
  };

  const handleSendAbsentWarning = async (employee) => {
    try {
      await sendNotificationToEmployee(
        employee.id,
        'absence_warning',
        'Peringatan Ketidakhadiran',
        'Anda tidak hadir hari ini tanpa keterangan. Harap segera menghubungi atasan atau HR.'
      );
      await Swal.fire({ icon: 'success', title: 'Notifikasi Dikirim', text: `Notifikasi peringatan telah dikirim ke ${employee.name}` });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengirim notifikasi' });
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'karyawan':
        return 'Karyawan';
      default:
        return 'Karyawan';
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'berhasil':
        return 'text-green-600 bg-green-100';
      case 'tidak_hadir':
        return 'text-red-600 bg-red-100';
      case 'wajah_tidak_valid':
        return 'text-red-600 bg-red-100';
      case 'lokasi_tidak_valid':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'berhasil':
        return <CheckCircle className="h-4 w-4" />;
      case 'tidak_hadir':
        return <XCircle className="h-4 w-4" />;
      case 'wajah_tidak_valid':
      case 'lokasi_tidak_valid':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const formatDateTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
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
          <p className="text-gray-600 mt-4">Memuat dashboard admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <AdminSidebar 
        user={user} 
        profile={profile} 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed} 
      />

      {/* Main Content */}
      <div 
        className={`flex-1 transition-all duration-300 ease-in-out 
          ${isCollapsed ? 'lg:ml-16' : 'lg:ml-64'} 
          pt-16 lg:pt-0`}
      >
        {/* Header */}
        <div className="bg-white shadow-sm border-b fixed top-0 left-0 right-0 lg:relative z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3 lg:py-4">
              <div className="lg:hidden">
                {/* Placeholder for mobile menu button alignment */}
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Dashboard Admin</h1>
                <p className="hidden md:block text-sm text-gray-600">
                  Ringkasan aktivitas dan statistik sistem
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="p-2 lg:px-3 lg:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden lg:inline ml-2">Pengaturan</span>
                </button>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="p-2 lg:px-3 lg:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden lg:inline ml-2">Export</span>
                </button>
                <NotificationSystem userId={user?.id} userRole={profile?.role} />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <StatCard
              icon={Users}
              title="Karyawan"
              value={stats.totalUsers}
              footer={`${stats.activeUsers} aktif`}
              color="blue"
            />
            <StatCard
              icon={CheckCircle}
              title="Hadir"
              value={stats.todayAttendance}
              footer={`${stats.absentToday} absen`}
              color="green"
            />
            <StatCard
              icon={AlertTriangle}
              title="Terlambat"
              value={stats.lateEmployees}
              footer="Hari ini"
              color="orange"
            />
            <StatCard
              icon={Bell}
              title="Peringatan"
              value={stats.activeWarnings}
              footer="Aktif"
              color="red"
            />
          </div>

          {(lateEmployees.length > 0 || absentEmployees.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {lateEmployees.length > 0 && (
                <div className="bg-white rounded-lg shadow-md">
                  <div className="px-6 py-4 border-b border-gray-200 bg-orange-50">
                    <h2 className="text-lg font-medium text-orange-900">
                      Karyawan Terlambat Hari Ini ({lateEmployees.length})
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3">
                      {lateEmployees.slice(0, 5).map((record) => (
                        <div key={record.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                              <User className="h-4 w-4 text-orange-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {record.profiles?.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                Terlambat {record.late_minutes} menit
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleViewEmployee(record.profiles)}
                              className="text-blue-600 hover:text-blue-800 p-1"
                              title="Lihat Detail"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleSendLateWarning(record)}
                              className="text-orange-600 hover:text-orange-800 p-1"
                              title="Kirim Peringatan"
                            >
                              <Bell className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleIssueWarning(record.profiles)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Buat SP"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {absentEmployees.length > 0 && (
                <div className="bg-white rounded-lg shadow-md">
                  <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
                    <h2 className="text-lg font-medium text-red-900">
                      Karyawan Tidak Hadir Hari Ini ({absentEmployees.length})
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3">
                      {absentEmployees.slice(0, 5).map((employee) => (
                        <div key={employee.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                              <User className="h-4 w-4 text-red-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {employee.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                {employee.department || 'Tidak ada departemen'}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleViewEmployee(employee)}
                              className="text-blue-600 hover:text-blue-800 p-1"
                              title="Lihat Detail"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleSendAbsentWarning(employee)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Kirim Peringatan"
                            >
                              <Bell className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleIssueWarning(employee)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Buat SP"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-medium text-gray-900">Informasi Sistem</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="flex items-center space-x-3">
                  <Database className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">Database</p>
                    <p className="text-sm text-gray-600">Supabase PostgreSQL</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">Jam Kerja</p>
                    <p className="text-sm text-gray-600">08:00 - 17:00</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPin className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="font-medium text-gray-900">Radius Kantor</p>
                    <p className="text-sm text-gray-600">
                      {systemSettings.office_location?.radius || 100} meter
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Camera className="h-8 w-8 text-orange-600" />
                  <div>
                    <p className="font-medium text-gray-900">Verifikasi Wajah</p>
                    <p className="text-sm text-gray-600">
                      {cameraSettings.enabled ? 'Aktif' : 'Nonaktif'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showWarningModal && selectedEmployee && (
        <WarningLetterGenerator 
          employee={selectedEmployee}
          onClose={() => setShowWarningModal(false)}
          onGenerated={handleWarningGenerated}
          issuedByUserId={user.id}
        />
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Export Database</h2>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <div className="flex items-start space-x-4">
                    <Database className="h-8 w-8 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">Export Database Supabase</h3>
                      <p className="text-blue-700 mb-4">
                        Untuk mengekspor seluruh database Supabase termasuk skema, data, dan storage, ikuti langkah-langkah berikut:
                      </p>
                      <div className="space-y-4">
                        <div className="bg-white p-4 rounded-lg border border-blue-200">
                          <h4 className="font-medium text-blue-800 mb-2">1. Akses Dashboard Supabase</h4>
                          <p className="text-sm text-blue-700">
                            Login ke dashboard Supabase project Anda di <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">app.supabase.com</a>
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-blue-200">
                          <h4 className="font-medium text-blue-800 mb-2">2. Buka Menu Database</h4>
                          <p className="text-sm text-blue-700">
                            Pilih menu "Database" → "Backups" dari sidebar
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-blue-200">
                          <h4 className="font-medium text-blue-800 mb-2">3. Generate Backup</h4>
                          <p className="text-sm text-blue-700">
                            Klik tombol "Generate backup" untuk membuat backup terbaru dari database Anda
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-blue-200">
                          <h4 className="font-medium text-blue-800 mb-2">4. Download Backup</h4>
                          <p className="text-sm text-blue-700">
                            Setelah backup selesai dibuat, klik tombol "Download" untuk mengunduh file SQL
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-blue-200">
                          <h4 className="font-medium text-blue-800 mb-2">5. Export Storage (Opsional)</h4>
                          <p className="text-sm text-blue-700">
                            Untuk mengekspor file storage (seperti foto wajah), gunakan menu "Storage" dan download setiap bucket secara terpisah
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-800 font-medium">Catatan Penting</p>
                      <p className="text-yellow-700 text-sm mt-1">
                        Backup database berisi semua data sensitif. Pastikan untuk menyimpannya dengan aman dan tidak membagikannya kepada pihak yang tidak berwenang.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Pengaturan Sistem</h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-3">Verifikasi Kamera</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="camera-enabled"
                        checked={cameraSettings.enabled}
                        onChange={(e) => setCameraSettings(prev => ({
                          ...prev,
                          enabled: e.target.checked
                        }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="camera-enabled" className="ml-2 block text-sm text-gray-900">
                        Aktifkan verifikasi wajah untuk absensi
                      </label>
                    </div>
                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-sm text-gray-600">
                        {cameraSettings.enabled 
                          ? 'Karyawan harus melakukan verifikasi wajah saat absensi' 
                          : 'Karyawan dapat absensi tanpa verifikasi wajah'}
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-700">
                          Menonaktifkan verifikasi wajah akan mengurangi keamanan sistem absensi, 
                          tetapi dapat berguna jika terjadi masalah dengan kamera atau perangkat.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveCameraSettings}
                    className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Save className="h-4 w-4" />
                      <span>Simpan Pengaturan</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, title, value, footer, color }) => {
  const colors = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700' },
    green: { bg: 'bg-green-50', text: 'text-green-700' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700' },
    red: { bg: 'bg-red-50', text: 'text-red-700' },
  };
  const selectedColor = colors[color] || colors.blue;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center">
        <div className={`w-10 h-10 ${selectedColor.bg} rounded-full flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${selectedColor.text}`} />
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-gray-700">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          <p className={`text-xs ${selectedColor.text}`}>{footer}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;