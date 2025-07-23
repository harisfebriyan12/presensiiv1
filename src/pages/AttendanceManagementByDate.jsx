import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Download, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Filter,
  RefreshCw,
  FileText,
  MapPin,
  Settings,
  Save,
  X,
  Bell,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '../hooks/supabaseClient';
import AdminSidebar from '../components/AdminSidebar';

const AttendanceManagementByDate = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showWorkHoursSettings, setShowWorkHoursSettings] = useState(false);
  const [workHoursSettings, setWorkHoursSettings] = useState({
    startTime: '08:00',
    endTime: '17:00',
    lateThreshold: 15,
    earlyLeaveThreshold: 15,
    breakDuration: 60
  });
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchWorkHoursSettings();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedDate && currentUser) {
      fetchAttendanceByDate(selectedDate);
    }
  }, [selectedDate, currentUser]);

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
      await Promise.all([
        fetchEmployees(),
        fetchAttendanceByDate(new Date())
      ]);
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/login');
    } finally {
      setLoading(false);
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

  const saveWorkHoursSettings = async () => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'work_hours',
          setting_value: workHoursSettings,
          description: 'Standard working hours configuration',
          is_enabled: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      setSuccess('Pengaturan jam kerja berhasil disimpan!');
      setShowWorkHoursSettings(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error saving work hours settings:', error);
      setError('Gagal menyimpan pengaturan jam kerja');
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, employee_id, department, role, status')
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchAttendanceByDate = async (date) => {
    setContentLoading(true);
    try {
      const formattedDate = date.toISOString().split('T')[0];
      const startDateTime = `${formattedDate}T00:00:00`;
      const endDateTime = `${formattedDate}T23:59:59`;
      
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles:user_id(id, name, email, employee_id, department, role, status)
        `)
        .gte('timestamp', startDateTime)
        .lte('timestamp', endDateTime)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      
      const { data: activeEmployees, error: empError } = await supabase
        .from('profiles')
        .select('id, name, email, employee_id, department, role, status')
        .eq('status', 'active')
        .neq('role', 'admin');
      
      if (empError) throw empError;
      
      const presentEmployeeIds = new Set(
        data
          .filter(record => record.type === 'masuk' && record.status === 'berhasil')
          .map(record => record.user_id)
      );
      
      const now = new Date();
      const isToday = formattedDate === now.toISOString().split('T')[0];
      const isPast = date < now;
      
      // Parse end time from settings
      const [endHour, endMinute] = workHoursSettings.endTime.split(':').map(Number);
      const endTimeToday = new Date();
      endTimeToday.setHours(endHour, endMinute, 0, 0);
      
      // Add 30 minutes buffer after end time before marking absent
      const absentMarkTime = new Date(endTimeToday);
      absentMarkTime.setMinutes(absentMarkTime.getMinutes() + 30);
      
      const shouldMarkAbsent = isPast || (isToday && now >= absentMarkTime);
      
      if ((isToday && shouldMarkAbsent) || isPast) {
        const absentEmployees = activeEmployees.filter(emp => 
          !presentEmployeeIds.has(emp.id) && emp.role !== 'admin'
        );
        
        const absentRecords = absentEmployees.map(emp => ({
          id: `absent-${emp.id}-${formattedDate}`,
          user_id: emp.id,
          type: 'absent',
          timestamp: `${formattedDate}T${absentMarkTime.toTimeString().slice(0, 8)}`,
          status: 'tidak_hadir',
          is_late: false,
          late_minutes: 0,
          work_hours: 0,
          overtime_hours: 0,
          profiles: emp,
          notes: `Tidak hadir - tidak melakukan absensi masuk hingga ${absentMarkTime.toTimeString().slice(0, 5)}`
        }));
        
        setAttendanceData([...data, ...absentRecords]);
      } else {
        setAttendanceData(data || []);
      }
    } catch (error) {
      console.error('Error fetching attendance by date:', error);
      setError('Gagal memuat data absensi');
    } finally {
      setContentLoading(false);
    }
  };

  const handleDateChange = (e) => {
    setSelectedDate(new Date(e.target.value));
  };

  const exportToCsv = () => {
    if (attendanceData.length === 0) return;

    const headers = [
      'Tanggal', 'Waktu', 'Karyawan', 'ID Karyawan', 'Departemen', 'Jenis', 'Status', 
      'Terlambat', 'Menit Terlambat', 'Jam Kerja', 'Lembur', 'Latitude', 'Longitude'
    ];

    const csvContent = [
      headers,
      ...attendanceData.map(record => {
        const date = new Date(record.timestamp);
        const dateStr = date.toLocaleDateString('id-ID');
        const timeStr = date.toLocaleTimeString('id-ID');
        
        return [
          dateStr,
          timeStr,
          record.profiles?.name || 'Unknown',
          record.profiles?.employee_id || '-',
          record.profiles?.department || '-',
          record.type === 'masuk' ? 'Masuk' : record.type === 'keluar' ? 'Keluar' : 'Tidak Hadir',
          record.status,
          record.is_late ? 'Ya' : 'Tidak',
          record.late_minutes || '0',
          record.work_hours || '0',
          record.overtime_hours || '0',
          record.latitude || '',
          record.longitude || ''
        ];
      })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${selectedDate.toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'berhasil':
        return 'text-green-600 bg-green-100';
      case 'wajah_tidak_valid':
        return 'text-red-600 bg-red-100';
      case 'lokasi_tidak_valid':
        return 'text-yellow-600 bg-yellow-100';
      case 'tidak_hadir':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'berhasil':
        return <CheckCircle className="h-4 w-4" />;
      case 'wajah_tidak_valid':
      case 'lokasi_tidak_valid':
        return <XCircle className="h-4 w-4" />;
      case 'tidak_hadir':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'berhasil':
        return 'Berhasil';
      case 'wajah_tidak_valid':
        return 'Wajah Invalid';
      case 'lokasi_tidak_valid':
        return 'Lokasi Invalid';
      case 'tidak_hadir':
        return 'Tidak Hadir';
      default:
        return 'Gagal';
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleWorkHoursChange = (e) => {
    const { name, value } = e.target;
    setWorkHoursSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const filteredAttendance = attendanceData.filter(record => {
    const matchesSearch = 
      (record.profiles?.name && record.profiles.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (record.profiles?.email && record.profiles.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (record.profiles?.employee_id && record.profiles.employee_id.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDepartment = !filterDepartment || record.profiles?.department === filterDepartment;
    const matchesStatus = !filterStatus || record.status === filterStatus;
    const matchesType = !filterType || record.type === filterType;
    
    return matchesSearch && matchesDepartment && matchesStatus && matchesType;
  });

  const getDepartments = () => {
    const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];
    return departments;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-2 text-blue-600">
            <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4 text-base">Memuat data absensi...</p>
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
        <div className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6">
              <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                    Kelola Absensi
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Lihat dan kelola absensi karyawan berdasarkan tanggal
                  </p>
                </div>
                
                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setShowWorkHoursSettings(true)}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm min-w-[48px] h-12"
                  >
                    <Settings className="h-5 w-5" />
                    <span className="hidden sm:inline">Jam Kerja</span>
                  </button>
                  <button
                    onClick={() => {
                      setContentLoading(true);
                      fetchAttendanceByDate(selectedDate).finally(() => setContentLoading(false));
                    }}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm min-w-[48px] h-12"
                    title="Refresh Data"
                  >
                    <RefreshCw className="h-5 w-5" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                  <button
                    onClick={exportToCsv}
                    disabled={attendanceData.length === 0}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm h-12"
                  >
                    <Download className="h-5 w-5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 rounded-lg flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 rounded-lg flex items-start space-x-3">
              <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 flex-1">{success}</p>
              <button 
                onClick={() => setSuccess(null)}
                className="ml-auto text-green-500 hover:text-green-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Date Selector */}
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <h2 className="text-base sm:text-lg font-medium text-gray-900">
                    Pilih Tanggal
                  </h2>
                </div>
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={handleDateChange}
                  className="w-full sm:w-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* Attendance Data */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <Clock className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <h2 className="text-base sm:text-lg font-medium text-gray-900 truncate">
                    Absensi: {formatDate(selectedDate)}
                  </h2>
                </div>
                <div className="text-sm text-gray-600 flex-shrink-0">
                  {filteredAttendance.length} data
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="p-4 border-b border-gray-200 sticky top-16 z-10 bg-white">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari nama, email, ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Filter className="h-5 w-5" />
                    <span>Filter Data</span>
                  </div>
                  {showFilters ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>

                {showFilters && (
                  <div className="grid grid-cols-1 gap-4 pt-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Departemen</label>
                      <select
                        value={filterDepartment}
                        onChange={(e) => setFilterDepartment(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="">Semua Departemen</option>
                        {getDepartments().map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="">Semua Status</option>
                        <option value="berhasil">Berhasil</option>
                        <option value="wajah_tidak_valid">Wajah Invalid</option>
                        <option value="lokasi_tidak_valid">Lokasi Invalid</option>
                        <option value="tidak_hadir">Tidak Hadir</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Jenis</label>
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="">Semua Jenis</option>
                        <option value="masuk">Masuk</option>
                        <option value="keluar">Keluar</option>
                        <option value="absent">Tidak Hadir</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance Table/Cards */}
            {contentLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-flex space-x-2 text-blue-600">
                  <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : filteredAttendance.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Karyawan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Waktu
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Jenis
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Keterlambatan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Lokasi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAttendance.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-medium text-base">
                                  {record.profiles?.name?.charAt(0).toUpperCase() || '?'}
                                </span>
                              </div>
                              <div className="ml-4 min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {record.profiles?.name || 'Unknown'}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {record.profiles?.employee_id || '-'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatTime(record.timestamp)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDate(new Date(record.timestamp))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                              {record.type === 'masuk' ? 'Masuk' : record.type === 'keluar' ? 'Keluar' : 'Tidak Hadir'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                              {getStatusIcon(record.status)}
                              <span>{getStatusText(record.status)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {record.is_late ? (
                              <div className="text-sm text-red-600">
                                <span className="font-medium">Terlambat {record.late_minutes} menit</span>
                              </div>
                            ) : (
                              <div className="text-sm text-green-600">
                                <span className="font-medium">Tepat Waktu</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {record.latitude && record.longitude ? (
                              <div className="flex items-center">
                                <MapPin className="h-5 w-5 mr-1 text-gray-400" />
                                <span className="text-xs">
                                  {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">Tidak ada lokasi</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4 p-4">
                  {filteredAttendance.map((record) => (
                    <div key={record.id} className="bg-gray-50 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="flex-shrink-0 h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-lg">
                              {record.profiles?.name?.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-medium text-gray-900 truncate">
                              {record.profiles?.name || 'Unknown'}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {record.profiles?.employee_id || '-'} • {record.profiles?.department || '-'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-medium text-gray-800 whitespace-nowrap">
                            {formatTime(record.timestamp)}
                          </p>
                          <p className="text-xs text-gray-500 whitespace-nowrap">
                            {formatDate(new Date(record.timestamp))}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${getStatusColor(record.status)}`}>
                          {getStatusIcon(record.status)}
                          <span className="ml-1">{getStatusText(record.status)}</span>
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                          {record.type === 'masuk' ? 'Masuk' : record.type === 'keluar' ? 'Keluar' : 'Tidak Hadir'}
                        </span>
                      </div>
                      <div className="mt-3 flex justify-between items-center">
                        <div>
                          {record.is_late ? (
                            <p className="text-sm text-red-600">
                              Terlambat {record.late_minutes} menit
                            </p>
                          ) : (
                            <p className="text-sm text-green-600">
                              Tepat Waktu
                            </p>
                          )}
                        </div>
                        {record.latitude && record.longitude && (
                          <div className="flex items-center text-sm text-gray-500">
                            <MapPin className="h-4 w-4 mr-1" />
                            <span>{record.latitude.toFixed(2)}, {record.longitude.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-10 w-10 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg">Tidak ada data absensi pada tanggal ini</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Work Hours Settings Modal */}
      {showWorkHoursSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Pengaturan Jam Kerja</h2>
                <button
                  onClick={() => setShowWorkHoursSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jam Masuk
                    </label>
                    <input
                      type="time"
                      name="startTime"
                      value={workHoursSettings.startTime}
                      onChange={handleWorkHoursChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jam Keluar
                    </label>
                    <input
                      type="time"
                      name="endTime"
                      value={workHoursSettings.endTime}
                      onChange={handleWorkHoursChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Toleransi Keterlambatan (menit)
                  </label>
                  <input
                    type="number"
                    name="lateThreshold"
                    value={workHoursSettings.lateThreshold}
                    onChange={handleWorkHoursChange}
                    min="0"
                    max="60"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Karyawan dianggap terlambat jika masuk setelah jam masuk + toleransi
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Toleransi Pulang Cepat (menit)
                  </label>
                  <input
                    type="number"
                    name="earlyLeaveThreshold"
                    value={workHoursSettings.earlyLeaveThreshold}
                    onChange={handleWorkHoursChange}
                    min="0"
                    max="60"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Karyawan dianggap pulang cepat jika keluar sebelum jam keluar - toleransi
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durasi Istirahat (menit)
                  </label>
                  <input
                    type="number"
                    name="breakDuration"
                    value={workHoursSettings.breakDuration}
                    onChange={handleWorkHoursChange}
                    min="0"
                    max="120"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Bell className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900 text-base">Pengaturan Absensi Otomatis</h3>
                  </div>
                  <p className="text-sm text-blue-700">
                    Sistem akan otomatis menandai karyawan sebagai "Tidak Hadir" jika:
                  </p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1 pl-5 list-disc">
                    <li>Sudah melewati jam keluar kerja</li>
                    <li>Tidak ada catatan absensi masuk pada hari tersebut</li>
                    <li>Karyawan berstatus aktif (bukan admin)</li>
                  </ul>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    onClick={() => setShowWorkHoursSettings(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  >
                    Batal
                  </button>
                  <button
                    onClick={saveWorkHoursSettings}
                    className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Save className="h-5 w-5" />
                      <span>Simpan</span>
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

export default AttendanceManagementByDate;