import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Save,
  X,
  Building,
  DollarSign,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Briefcase
} from 'lucide-react';
import Swal from './swal';
import { supabase } from '../hooks/supabaseClient';
import AdminSidebar from '../components/AdminSidebar';

const PositionManagement = () => {
  const navigate = useNavigate();
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name_id: '',
    name_en: '',
    description_id: '',
    description_en: '',
    base_salary: 0,
    min_salary: 0,
    max_salary: 0,
    department: '',
    is_active: true
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
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        navigate('/dashboard');
        return;
      }

      setCurrentUser(user);
      setProfile(profile);
      await Promise.all([fetchPositions(), fetchDepartments()]);
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    setContentLoading(true);
    try {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
      setError('Gagal memuat data jabatan');
    } finally {
      setContentLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetForm = () => {
    setFormData({
      name_id: '',
      name_en: '',
      description_id: '',
      description_en: '',
      base_salary: 0,
      min_salary: 0,
      max_salary: 0,
      department: '',
      is_active: true
    });
    setEditingPosition(null);
    setShowAddModal(false);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name_id.trim() || !formData.name_en.trim()) {
      setError('Nama jabatan (Indonesia dan English) harus diisi');
      return;
    }

    if (!formData.department) {
      setError('Departemen harus dipilih');
      return;
    }

    if (formData.min_salary > formData.max_salary) {
      setError('Gaji minimum tidak boleh lebih besar dari gaji maksimum');
      return;
    }

    setContentLoading(true);
    try {
      const positionData = {
        name_id: formData.name_id,
        name_en: formData.name_en,
        description_id: formData.description_id || null,
        description_en: formData.description_en || null,
        base_salary: parseFloat(formData.base_salary) || 0,
        min_salary: parseFloat(formData.min_salary) || 0,
        max_salary: parseFloat(formData.max_salary) || 0,
        department: formData.department,
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      };

      if (editingPosition) {
        // Update existing position
        const { error } = await supabase
          .from('positions')
          .update(positionData)
          .eq('id', editingPosition.id);

        if (error) throw error;
        setSuccess('Jabatan berhasil diperbarui!');
      } else {
        // Create new position
        positionData.created_at = new Date().toISOString();
        
        const { error } = await supabase
          .from('positions')
          .insert([positionData]);

        if (error) throw error;
        setSuccess('Jabatan berhasil ditambahkan!');
      }

      resetForm();
      await fetchPositions();

      // Auto-hide success message
      setTimeout(() => setSuccess(null), 3000);

    } catch (error) {
      console.error('Error saving position:', error);
      setError('Gagal menyimpan jabatan: ' + error.message);
    } finally {
      setContentLoading(false);
    }
  };

  const handleEdit = (position) => {
    setFormData({
      name_id: position.name_id,
      name_en: position.name_en,
      description_id: position.description_id || '',
      description_en: position.description_en || '',
      base_salary: position.base_salary || 0,
      min_salary: position.min_salary || 0,
      max_salary: position.max_salary || 0,
      department: position.department || '',
      is_active: position.is_active
    });
    setEditingPosition(position);
    setShowAddModal(true);
  };

  const handleDelete = async (positionId) => {
    const result = await Swal.fire({
      title: 'Hapus Jabatan?',
      text: 'Apakah Anda yakin ingin menghapus jabatan ini?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) {
      Swal.fire('Dibatalkan', 'Jabatan tidak dihapus.', 'info');
      return;
    }

    setContentLoading(true);
    try {
      // Check if position is being used by any employee
      const { data: employees, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('position_id', positionId)
        .limit(1);

      if (checkError) throw checkError;

      if (employees && employees.length > 0) {
        setError('Jabatan tidak dapat dihapus karena masih digunakan oleh karyawan');
        return;
      }

      const { error } = await supabase
      .from('positions')
      .delete()
      .eq('id', positionId);
  
      if (error) throw error;
      await fetchPositions();

      // Auto-hide success message
      setTimeout(() => setSuccess(null), 3000);

    } catch (error) {
      console.error('Error deleting position:', error);
      setError('Gagal menghapus jabatan: ' + error.message);
    } finally {
      setContentLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredPositions = positions.filter(position => {
    const matchesSearch = position.name_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         position.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (position.department && position.department.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDepartment = filterDepartment === '' || position.department === departments.find(d => d.id === filterDepartment)?.name;
    
    return matchesSearch && matchesDepartment;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-1 text-tosca-600">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4">Memuat data jabatan...</p>
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
                <h1 className="text-2xl font-bold text-gray-900">Kelola Jabatan</h1>
                <p className="text-sm text-gray-600">
                  Tambah, edit, dan kelola jabatan beserta struktur gaji
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-tosca-600 text-white rounded-lg hover:bg-tosca-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Jabatan</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Notifications */}
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

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-tosca-100 rounded-full flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-tosca-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Jabatan</p>
                  <p className="text-2xl font-bold text-gray-900">{positions.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Jabatan Aktif</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {positions.filter(p => p.is_active).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Rata-rata Gaji</p>
                  <p className="text-lg font-bold text-gray-900">
                    {positions.length > 0 
                      ? formatCurrency(positions.reduce((sum, p) => sum + (p.base_salary || 0), 0) / positions.length)
                      : formatCurrency(0)
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter and Search */}
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari jabatan atau departemen..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="sm:w-48">
                  <select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                  >
                    <option value="">Semua Departemen</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Positions Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Briefcase className="h-5 w-5 text-tosca-600" />
                <h2 className="text-lg font-medium text-gray-900">
                  Daftar Jabatan ({filteredPositions.length})
                </h2>
              </div>
            </div>
            
            {contentLoading || filteredPositions.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-flex space-x-1 text-tosca-600">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : filteredPositions.length > 0 ? (
              <div className="overflow-x-auto sm:overflow-visible">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 hidden sm:table-header-group">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jabatan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Departemen
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gaji Pokok
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rentang Gaji
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>                
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPositions.map((position) => (
                      <tr key={position.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {position.name_id}
                            </div>
                            <div className="text-sm text-gray-500">
                              {position.name_en}
                            </div>
                            {position.description_id && (
                              <div className="text-xs text-gray-400 mt-1">
                                {position.description_id}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-tosca-100 text-tosca-800">
                            {position.department || 'Tidak ada'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(position.base_salary || 0)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatCurrency(position.min_salary || 0)} - {formatCurrency(position.max_salary || 0)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            position.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {position.is_active ? 'Aktif' : 'Tidak Aktif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(position)}
                              className="text-tosca-600 hover:text-tosca-900 p-1 hover:bg-tosca-50 rounded"
                              title="Edit Jabatan"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(position.id)}
                              className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                              title="Hapus Jabatan"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Card view for mobile */}
                <div className="sm:hidden">
                  {filteredPositions.map((position) => (
                    <div key={position.id} className="bg-white rounded-lg shadow-md p-4 mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-tosca-100 rounded-full flex items-center justify-center">
                          <Briefcase className="h-5 w-5 text-tosca-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {position.name_id}
                          </p>
                          <p className="text-xs text-gray-500">
                            {position.name_en}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-700">
                        <p><span className="font-medium">Departemen:</span> {position.department || 'Tidak ada'}</p>
                        <p><span className="font-medium">Gaji Pokok:</span> {formatCurrency(position.base_salary || 0)}</p>
                        <p><span className="font-medium">Rentang Gaji:</span> {formatCurrency(position.min_salary || 0)} - {formatCurrency(position.max_salary || 0)}</p>
                        {position.description_id && (
                          <p className="mt-1 text-xs text-gray-500">
                            {position.description_id}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          Status: {position.is_active ? 'Aktif' : 'Tidak Aktif'}
                        </p>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => handleEdit(position)}
                          className="text-tosca-600 hover:text-tosca-900 p-2 rounded hover:bg-tosca-50"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(position.id)}
                          className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg mb-2">Tidak ada jabatan ditemukan</p>
                <p className="text-gray-400">Coba sesuaikan pencarian atau tambah jabatan baru</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-lg">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingPosition ? 'Edit Jabatan' : 'Tambah Jabatan Baru'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Informasi Dasar</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nama Jabatan (Indonesia) *
                      </label>
                      <input
                        type="text"
                        name="name_id"
                        value={formData.name_id}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Contoh: Manager IT"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nama Jabatan (English) *
                      </label>
                      <input
                        type="text"
                        name="name_en"
                        value={formData.name_en}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Example: IT Manager"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Departemen *
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                    >
                      <option value="">Pilih Departemen...</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Descriptions */}
                <div className="bg-tosca-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Deskripsi Jabatan</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Deskripsi (Indonesia)
                      </label>
                      <textarea
                        name="description_id"
                        value={formData.description_id}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Deskripsi tugas dan tanggung jawab..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Deskripsi (English)
                      </label>
                      <textarea
                        name="description_en"
                        value={formData.description_en}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Job description and responsibilities..."
                      />
                    </div>
                  </div>
                </div>

                {/* Salary Information */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Informasi Gaji</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gaji Pokok (IDR)
                      </label>
                      <input
                        type="number"
                        name="base_salary"
                        value={formData.base_salary}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="5000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gaji Minimum (IDR)
                      </label>
                      <input
                        type="number"
                        name="min_salary"
                        value={formData.min_salary}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="4000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gaji Maksimum (IDR)
                      </label>
                      <input
                        type="number"
                        name="max_salary"
                        value={formData.max_salary}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="8000000"
                      />
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-white rounded border">
                    <div className="text-sm text-gray-600">
                      <p><strong>Gaji Pokok:</strong> {formatCurrency(formData.base_salary || 0)}</p>
                      <p><strong>Rentang:</strong> {formatCurrency(formData.min_salary || 0)} - {formatCurrency(formData.max_salary || 0)}</p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-tosca-600 focus:ring-tosca-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Jabatan aktif (dapat dipilih saat menambah karyawan)
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={contentLoading}
                    className="flex-1 bg-tosca-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-tosca-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Save className="h-4 w-4" />
                      <span>{editingPosition ? 'Perbarui Jabatan' : 'Simpan Jabatan'}</span>
                    </div>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PositionManagement;