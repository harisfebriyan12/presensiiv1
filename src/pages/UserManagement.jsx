import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Lock, 
  ToggleLeft, 
  ToggleRight, 
  Search, 
  Save,
  X,
  Shield,
  Users,
  User,
  Mail,
  Phone,
  Camera,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { supabase, uploadFile, getFileUrl } from '../hooks/supabaseClient';
import Swal from './swal';
import ProfileModal from '../components/ProfileModal';
import CustomFaceCapture from '../components/CustomFaceCapture';
import AdminSidebar from '../components/AdminSidebar';

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit', or 'password'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    location: '',
    title: '',
    bio: '',
    role: 'karyawan',
    position_id: '',
    employee_id: '',
    department: '',
    salary: 0,
    bank_id: '',
    bank_account_number: '',
    bank_account_name: '',
    status: 'active'
  });
  const [facePhoto, setFacePhoto] = useState(null);
  const [faceFingerprint, setFaceFingerprint] = useState(null);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
      await Promise.all([fetchUsers(), fetchPositions(), fetchBanks()]);
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setContentLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          positions(name_id, department, base_salary),
          bank_info(bank_name, bank_logo)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Gagal memuat data pengguna');
    } finally {
      setContentLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('is_active', true)
        .order('name_id');

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'position_id') {
      const selectedPosition = positions.find(p => p.id === value);
      if (selectedPosition) {
        const positionCode = selectedPosition.name_id.substring(0, 3).toUpperCase();
        const timestamp = Date.now().toString().slice(-4);
        const employeeId = modalMode === 'add' ? `${positionCode}${timestamp}` : formData.employee_id;
        
        setFormData(prev => ({
          ...prev,
          position_id: value,
          title: selectedPosition.name_id,
          department: selectedPosition.department || '',
          salary: selectedPosition.base_salary || 0,
          employee_id: employeeId
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          position_id: value,
          title: '',
          department: '',
          salary: 0,
          employee_id: ''
        }));
      }
    } else if (name === 'name' || name === 'full_name') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        bank_account_name: value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const generateEmployeeId = (positionName) => {
    const positionCode = positionName ? positionName.substring(0, 3).toUpperCase() : 'EMP';
    const timestamp = Date.now().toString().slice(-4);
    return `${positionCode}${timestamp}`;
  };

  const handleFaceCapture = (photoBlob, fingerprint) => {
    setFacePhoto(photoBlob);
    setFaceFingerprint(fingerprint);
    console.log('✅ Face captured', { photoBlob, fingerprint });
  };

  const handleBasicInfoSubmit = (e) => {
    e.preventDefault();
    if (modalMode === 'add' && formData.password.length < 6) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Password minimal 6 karakter' });
      return;
    }
    if (!formData.position_id) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Silakan pilih jabatan' });
      return;
    }
    if (formData.role === 'admin' || modalMode === 'edit') {
      modalMode === 'add' ? handleCreateUser() : handleUpdateUser();
    } else {
      setStep(2);
    }
  };

  const handleCreateUser = async () => {
    if (formData.role !== 'admin' && !facePhoto) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Silakan ambil foto wajah terlebih dahulu' });
      return;
    }
    if (formData.role !== 'admin' && !faceFingerprint) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Fingerprint wajah tidak terdeteksi, silakan ulangi pengambilan foto.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: formData.role
          }
        }
      });
      if (authError) throw authError;
      if (!authData.user) {
        throw new Error('Pendaftaran gagal');
      }
      const userId = authData.user.id;
      let photoUrl = null;
      if (formData.role !== 'admin' && facePhoto) {
        const fileName = `${userId}-face-${Date.now()}.jpg`;
        await uploadFile(facePhoto, 'face-photos', fileName);
        photoUrl = getFileUrl('face-photos', fileName);
      }
      const profileData = {
        id: userId,
        name: formData.name,
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        location: formData.location,
        title: formData.title,
        bio: formData.bio || `${getRoleDisplayName(formData.role)} di sistem absensi`,
        avatar_url: photoUrl,
        role: formData.role,
        position_id: formData.position_id,
        employee_id: formData.employee_id,
        department: formData.department,
        salary: formData.salary,
        bank_id: formData.bank_id || null,
        bank_account_number: formData.bank_account_number || null,
        bank_account_name: formData.bank_account_name || formData.name,
        is_face_registered: formData.role === 'admin' ? true : !!photoUrl,
        status: 'active',
        join_date: new Date().toISOString().split('T')[0],
        contract_start_date: new Date().toISOString().split('T')[0],
        contract_type: 'permanent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([profileData]);
      if (profileError) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', userId);
        if (updateError) {
          throw new Error('Gagal membuat profil user');
        }
      }
      const salaryData = {
        user_id: userId,
        daily_salary: formData.salary / 22,
        overtime_rate: 1.5,
        bonus: 0,
        deduction: 0,
        effective_date: new Date().toISOString().split('T')[0],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { error: salaryError } = await supabase
        .from('employee_salaries')
        .insert([salaryData]);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        html: `<b>${formData.name}</b> (${getRoleDisplayName(formData.role)}) berhasil ditambahkan!`,
        showConfirmButton: true
      });
      resetForm();
      await fetchUsers();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat membuat user' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    setIsSubmitting(true);
    try {
      let photoUrl = formData.avatar_url;
      if (formData.role !== 'admin' && facePhoto) {
        const fileName = `${formData.id}-face-${Date.now()}.jpg`;
        await uploadFile(facePhoto, 'face-photos', fileName);
        photoUrl = getFileUrl('face-photos', fileName);
      }
      const profileData = {
        name: formData.name,
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        location: formData.location,
        title: formData.title,
        bio: formData.bio || `${getRoleDisplayName(formData.role)} di sistem absensi`,
        avatar_url: photoUrl,
        role: formData.role,
        position_id: formData.position_id,
        employee_id: formData.employee_id,
        department: formData.department,
        salary: formData.salary,
        bank_id: formData.bank_id || null,
        bank_account_number: formData.bank_account_number || null,
        bank_account_name: formData.bank_account_name || formData.name,
        is_face_registered: formData.role === 'admin' ? true : !!photoUrl,
        status: formData.status,
        updated_at: new Date().toISOString()
      };
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', formData.id);
      if (profileError) throw profileError;
      const salaryData = {
        user_id: formData.id,
        daily_salary: formData.salary / 22,
        overtime_rate: 1.5,
        bonus: 0,
        deduction: 0,
        effective_date: new Date().toISOString().split('T')[0],
        is_active: true,
        updated_at: new Date().toISOString()
      };
      const { error: salaryError } = await supabase
        .from('employee_salaries')
        .update(salaryData)
        .eq('user_id', formData.id)
        .eq('is_active', true);
      if (salaryError && !salaryError.message.includes('0 rows')) {
        const { error: insertError } = await supabase
          .from('employee_salaries')
          .insert([salaryData]);
        if (insertError) throw insertError;
      }
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        html: `<b>${formData.name}</b> berhasil diperbarui!`,
        showConfirmButton: true
      });
      resetForm();
      await fetchUsers();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat memperbarui user' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (formData.password.length < 6) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Password baru minimal 6 karakter' });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('https://<your-project-ref>.supabase.co/functions/v1/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.getSession().then(({ data }) => data.session?.access_token)}`
        },
        body: JSON.stringify({
          user_id: formData.id,
          new_password: formData.password,
          admin_id: currentUser.id
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Gagal mereset password');
      }

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: `Password untuk ${formData.name} berhasil diperbarui!`,
        showConfirmButton: true
      });
      resetForm();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat mereset password' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId, currentStatus, userName) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const actionText = newStatus === 'active' ? 'mengaktifkan' : 'menonaktifkan';
    const result = await Swal.fire({
      title: `${newStatus === 'active' ? 'Aktifkan' : 'Nonaktifkan'} User?`,
      text: `Apakah Anda yakin ingin ${actionText} user ${userName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: `Ya, ${actionText}`,
      cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;
    setContentLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
      await fetchUsers();
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: `User ${userName} berhasil ${newStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'}`
      });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: `Gagal ${actionText} user` });
    } finally {
      setContentLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      email: '',
      password: '',
      phone: '',
      location: '',
      title: '',
      bio: '',
      role: 'karyawan',
      position_id: '',
      employee_id: '',
      department: '',
      salary: 0,
      bank_id: '',
      bank_account_number: '',
      bank_account_name: '',
      status: 'active'
    });
    setFacePhoto(null);
    setFaceFingerprint(null);
    setStep(1);
    setShowModal(false);
    setModalMode('add');
    setError(null);
    setSuccess(null);
  };

  const handleEditUser = (user) => {
    setFormData({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      location: user.location || '',
      title: user.title || user.positions?.name_id || '',
      bio: user.bio || '',
      role: user.role,
      position_id: user.position_id || '',
      employee_id: user.employee_id || '',
      department: user.department || user.positions?.department || '',
      salary: user.salary || user.positions?.base_salary || 0,
      bank_id: user.bank_id || '',
      bank_account_number: user.bank_account_number || '',
      bank_account_name: user.bank_account_name || user.name,
      status: user.status || 'active',
      avatar_url: user.avatar_url || ''
    });
    setFacePhoto(null);
    setFaceFingerprint(null);
    setModalMode('edit');
    setStep(1);
    setShowModal(true);
  };

  const handleOpenPasswordModal = (user) => {
    setFormData({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '',
      phone: '',
      location: '',
      title: '',
      bio: '',
      role: user.role,
      position_id: '',
      employee_id: '',
      department: '',
      salary: 0,
      bank_id: '',
      bank_account_number: '',
      bank_account_name: '',
      status: user.status
    });
    setModalMode('password');
    setShowModal(true);
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

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
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
    return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const canManageUser = (userId) => {
    if (currentUser?.id === userId) return false;
    return true;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getDepartments = () => {
    const departments = [...new Set(users.map(u => u.department || u.positions?.department).filter(Boolean))];
    return departments;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.employee_id && user.employee_id.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDepartment = filterDepartment === '' || 
                             user.department === filterDepartment || 
                             user.positions?.department === filterDepartment;
    const matchesRole = filterRole === '' || user.role === filterRole;
    
    return matchesSearch && matchesDepartment && matchesRole;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-1 text-blue-600">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4">Memuat data pengguna...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <AdminSidebar user={currentUser} profile={profile} className="w-full md:w-64 md:fixed md:h-screen" />

      <div className="flex-1 md:ml-64 transition-all duration-300 ease-in-out">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Kelola Pengguna</h1>
                <p className="text-sm text-gray-600">Tambah, edit, reset password, dan kelola status pengguna sistem</p>
              </div>
              <button
                onClick={() => { setModalMode('add'); setShowModal(true); }}
                className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
              >
                <Plus className="h-5 w-5" />
                <span>Tambah User</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {success && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-green-700">{success}</p>
              <button 
                onClick={() => setSuccess(null)}
                className="ml-auto text-green-500 hover:text-green-700"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari berdasarkan nama, email, atau ID karyawan..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full sm:w-40">
                    <select
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">Semua Departemen</option>
                      {getDepartments().map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-40">
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">Semua Role</option>
                      <option value="karyawan">Karyawan</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-medium text-gray-900">
                  Daftar Pengguna ({filteredUsers.length})
                </h2>
              </div>
            </div>

            {contentLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-flex space-x-1 text-blue-600">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg mb-2">Tidak ada pengguna ditemukan</p>
                <p className="text-gray-400">Coba sesuaikan pencarian atau filter Anda</p>
              </div>
            ) : (
              <>
                <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pengguna
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jabatan & Departemen
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gaji
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kontak
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role & Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                              {user.avatar_url ? (
                                <img 
                                  src={user.avatar_url} 
                                  alt={user.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getRoleColor(user.role)}`}>
                                  {getRoleIcon(user.role)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                <span 
                                  className="cursor-pointer text-blue-700 hover:underline" 
                                  onClick={() => { setProfile(user); setShowProfileModal(true); }}
                                >
                                  {user.name}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {user.employee_id || 'Belum diatur'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {user.positions?.name_id || user.title || getRoleDisplayName(user.role)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.positions?.department || user.department || 'Belum diatur'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(user.positions?.base_salary || user.salary || 0)}
                          </div>
                          <div className="text-sm text-gray-500">
                            per bulan
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900 flex items-center">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            <span 
                              className="cursor-pointer text-blue-700 hover:underline" 
                              onClick={() => { setProfile(user); setShowProfileModal(true); }}
                            >
                              {user.email}
                            </span>
                          </div>
                          {user.phone && (
                            <div className="text-sm text-gray-500 flex items-center mt-1">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {user.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                              {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                              {getRoleDisplayName(user.role)}
                            </span>
                            <div className="text-xs text-gray-500">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                                {user.status === 'active' ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </div>
                            {user.bank_info && (
                              <div className="text-xs text-gray-500">
                                <span className="text-blue-600">Bank: {user.bank_info.bank_name}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            {canManageUser(user.id) ? (
                              <>
                                <button
                                  onClick={() => handleEditUser(user)}
                                  className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                                  title="Edit User"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenPasswordModal(user)}
                                  className="text-yellow-600 hover:text-yellow-900 p-1 hover:bg-yellow-50 rounded"
                                  title="Reset Password"
                                >
                                  <Lock className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(user.id, user.status, user.name)}
                                  className="text-purple-600 hover:text-purple-900 p-1 hover:bg-purple-50 rounded"
                                  title={user.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                                >
                                  {user.status === 'active' ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                </button>
                              </>
                            ) : (
                              <span className="text-gray-400 text-xs">Akun Anda</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="md:hidden p-4 space-y-4">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="bg-white rounded-lg shadow-md p-5 border border-gray-100 transition-transform transform hover:scale-[1.02]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                            {user.avatar_url ? (
                              <img 
                                src={user.avatar_url} 
                                alt={user.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getRoleColor(user.role)}`}>
                                {getRoleIcon(user.role)}
                              </div>
                            )}
                          </div>
                          <div>
                            <p 
                              className="text-base font-semibold text-gray-900 cursor-pointer text-blue-700 hover:underline"
                              onClick={() => { setProfile(user); setShowProfileModal(true); }}
                            >
                              {user.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {user.positions?.name_id || user.title || getRoleDisplayName(user.role)}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {canManageUser(user.id) ? (
                            <>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="text-blue-600 hover:text-blue-900 p-2 rounded-full hover:bg-blue-50"
                              >
                                <Edit className="h-6 w-6" />
                              </button>
                              <button
                                onClick={() => handleOpenPasswordModal(user)}
                                className="text-yellow-600 hover:text-yellow-900 p-2 rounded-full hover:bg-yellow-50"
                              >
                                <Lock className="h-6 w-6" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(user.id, user.status, user.name)}
                                className="text-purple-600 hover:text-purple-900 p-2 rounded-full hover:bg-purple-50"
                              >
                                {user.status === 'active' ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-400 text-sm">Akun Anda</span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 space-y-2">
                        <p><span className="font-medium">ID:</span> {user.employee_id || 'Belum diatur'}</p>
                        <p><span className="font-medium">Departemen:</span> {user.positions?.department || user.department || 'Belum diatur'}</p>
                        <p><span className="font-medium">Gaji:</span> {formatCurrency(user.positions?.base_salary || user.salary || 0)}</p>
                        <p><span className="font-medium">Email:</span> {user.email}</p>
                        {user.phone && <p><span className="font-medium">Telepon:</span> {user.phone}</p>}
                        <p>
                          <span className="font-medium">Role:</span>{' '}
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                            {user.role === 'admin' && <Shield className="h-4 w-4 mr-1" />}
                            {getRoleDisplayName(user.role)}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium">Status:</span>{' '}
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                            {user.status === 'active' ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </p>
                        {user.bank_info && <p><span className="font-medium">Bank:</span> {user.bank_info.bank_name}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {showProfileModal && (
            <ProfileModal profile={profile} onClose={() => setShowProfileModal(false)} />
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md sm:max-w-lg bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {modalMode === 'add' ? 'Tambah Pengguna Baru' : modalMode === 'edit' ? 'Edit Pengguna' : 'Reset Password'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {modalMode !== 'password' && (
                <div className="flex items-center justify-center mb-4">
                  {[1, 2].map((stepNum) => (
                    <div key={stepNum} className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        step >= stepNum
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {step > stepNum ? <CheckCircle className="h-5 w-5" /> : stepNum}
                      </div>
                      {stepNum < 2 && (
                        <div className={`w-10 h-1 mx-2 ${
                          step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {modalMode === 'password' ? (
                <form onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Pengguna
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      readOnly
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password Baru *
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Minimal 6 karakter"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <Lock className="h-5 w-5" />
                        <span>Reset Password</span>
                      </div>
                    </button>
                  </div>
                </form>
              ) : step === 1 ? (
                <form onSubmit={handleBasicInfoSubmit} className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-3">Pilih Jabatan</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Jabatan *
                      </label>
                      <select
                        name="position_id"
                        value={formData.position_id}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="">Pilih Jabatan...</option>
                        {positions.map(position => (
                          <option key={position.id} value={position.id}>
                            {position.name_id} - {position.department} ({formatCurrency(position.base_salary || 0)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {formData.position_id && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ID Karyawan
                          </label>
                          <input
                            type="text"
                            value={formData.employee_id}
                            readOnly
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Gaji Bulanan
                          </label>
                          <input
                            type="text"
                            value={formatCurrency(formData.salary)}
                            readOnly
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nama Lengkap *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Masukkan nama lengkap"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Masukkan email"
                      />
                    </div>
                  </div>

                  {modalMode === 'add' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password *
                        </label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="Minimal 6 karakter"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role
                        </label>
                        <select
                          name="role"
                          value={formData.role}
                          onChange={handleInputChange}
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="karyawan">Karyawan</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        No. Telepon
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Contoh: +62-21-1234567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lokasi
                      </label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Contoh: Jakarta, Indonesia"
                      />
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-medium text-green-900 mb-3">Informasi Bank (Opsional)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pilih Bank
                        </label>
                        <select
                          name="bank_id"
                          value={formData.bank_id}
                          onChange={handleInputChange}
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="">Pilih Bank...</option>
                          {banks.map(bank => (
                            <option key={bank.id} value={bank.id}>
                              {bank.bank_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nomor Rekening
                        </label>
                        <input
                          type="text"
                          name="bank_account_number"
                          value={formData.bank_account_number}
                          onChange={handleInputChange}
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="Nomor rekening"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nama Pemilik Rekening
                      </label>
                      <input
                        type="text"
                        value={formData.bank_account_name}
                        readOnly
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                        placeholder="Otomatis sesuai nama lengkap"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bio
                    </label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Deskripsi singkat tentang pengguna"
                    />
                  </div>

                  {modalMode === 'edit' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="active">Aktif</option>
                        <option value="inactive">Nonaktif</option>
                      </select>
                    </div>
                  )}

                  {formData.role === 'admin' && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start space-x-3">
                        <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-blue-800 font-medium">Administrator</p>
                          <p className="text-blue-700 text-sm mt-1">
                            Administrator tidak memerlukan verifikasi wajah dan dapat langsung mengakses semua fitur sistem.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <Save className="h-5 w-5" />
                        <span>{modalMode === 'add' && formData.role === 'admin' ? 'Buat Administrator' : modalMode === 'add' ? 'Lanjut ke Foto Wajah' : 'Perbarui Pengguna'}</span>
                      </div>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <Camera className="h-12 w-12 text-blue-600 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">
                      Ambil foto wajah yang jelas untuk verifikasi absensi. 
                      Sistem kami menggunakan teknologi pengenalan wajah yang aman dan cepat.
                    </p>
                  </div>

                  <CustomFaceCapture onFaceCapture={handleFaceCapture} isCapturing={isSubmitting} />

                  {facePhoto && faceFingerprint && (
                    <div className="text-center">
                      <div className="inline-flex items-center space-x-2 text-green-600 mb-4">
                        <CheckCircle className="h-5 w-5" />
                        <span>Foto wajah berhasil diambil dan diverifikasi!</span>
                      </div>
                    </div>
                  )}
                  {facePhoto && !faceFingerprint && (
                    <div className="text-center">
                      <div className="inline-flex items-center space-x-2 text-yellow-600 mb-4">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Fingerprint wajah tidak terdeteksi, silakan ulangi pengambilan foto.</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      Kembali
                    </button>
                    <button
                      onClick={modalMode === 'add' ? handleCreateUser : handleUpdateUser}
                      disabled={!facePhoto || !faceFingerprint || isSubmitting}
                      className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        {isSubmitting ? (
                          <>
                            <div className="inline-flex space-x-1">
                              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-5 w-5" />
                            <span>{modalMode === 'add' ? 'Buat Pengguna' : 'Perbarui Pengguna'}</span>
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;