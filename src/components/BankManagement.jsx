import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Save,
  X,
  CreditCard,
  Code,
  Image,
  Link,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import AdminSidebar from '../components/AdminSidebar';

const BankManagement = () => {
  const navigate = useNavigate();
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [previewLogo, setPreviewLogo] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    bank_name: '',
    bank_code: '',
    bank_logo: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    // Update preview when logo URL changes
    setPreviewLogo(formData.bank_logo);
  }, [formData.bank_logo]);

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
      await fetchBanks();
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchBanks = async () => {
    setContentLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_info')
        .select('*')
        .order('bank_name');

      if (error) throw error;
      setBanks(data || []);
    } catch (error) {
      console.error('Error fetching banks:', error);
      setError('Gagal memuat data bank');
    } finally {
      setContentLoading(false);
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
      bank_name: '',
      bank_code: '',
      bank_logo: '',
      description: '',
      is_active: true
    });
    setEditingBank(null);
    setShowAddModal(false);
    setError(null);
    setPreviewLogo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
      if (!formData.bank_name.trim()) {
        Swal.fire({ icon: 'warning', title: 'Nama bank wajib diisi', text: 'Silakan isi nama bank.' });
        return;
      }

    setContentLoading(true);
    try {
      const bankData = {
        ...formData,
        updated_at: new Date().toISOString()
      };

      if (editingBank) {
        // Update existing bank
        const { error } = await supabase
          .from('bank_info')
          .update(bankData)
          .eq('id', editingBank.id);

          if (error) throw error;
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Bank berhasil diperbarui!' });
      } else {
        // Create new bank
        bankData.created_at = new Date().toISOString();
        
        const { error } = await supabase
          .from('bank_info')
          .insert([bankData]);

        if (error) throw error;
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Bank berhasil ditambahkan!' });
      }

      resetForm();
      await fetchBanks();

      // Auto-hide success message
      setTimeout(() => setSuccess(null), 3000);

    } catch (error) {
      console.error('Error saving bank:', error);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menyimpan bank: ' + error.message });
    } finally {
      setContentLoading(false);
    }
  };

  const handleEdit = (bank) => {
    setFormData({
      bank_name: bank.bank_name,
      bank_code: bank.bank_code || '',
      bank_logo: bank.bank_logo || '',
      description: bank.description || '',
      is_active: bank.is_active
    });
    setEditingBank(bank);
    setPreviewLogo(bank.bank_logo);
    setShowAddModal(true);
  };

  const handleDelete = async (bankId) => {
    const result = await Swal.fire({
      title: 'Hapus Bank?',
      text: 'Apakah Anda yakin ingin menghapus bank ini?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;

    setContentLoading(true);
    try {
      // Check if bank is being used by any employee
      const { data: employees, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('bank_id', bankId)
        .limit(1);

      if (checkError) throw checkError;

      if (employees && employees.length > 0) {
        Swal.fire({ icon: 'error', title: 'Tidak Bisa Dihapus', text: 'Bank tidak dapat dihapus karena masih digunakan oleh karyawan.' });
        return;
      }

      const { error } = await supabase
        .from('bank_info')
        .delete()
        .eq('id', bankId);

      if (error) throw error;

      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Bank berhasil dihapus!' });
      await fetchBanks();

    } catch (error) {
      console.error('Error deleting bank:', error);
      setError('Gagal menghapus bank: ' + error.message);
    } finally {
      setContentLoading(false);
    }
  };

  const filteredBanks = banks.filter(bank => {
    return bank.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (bank.bank_code && bank.bank_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
           (bank.description && bank.description.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  // Common bank logos for suggestions
  const commonBankLogos = [
    { name: 'BCA', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Bank_Central_Asia.svg/2560px-Bank_Central_Asia.svg.png' },
    { name: 'Mandiri', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Bank_Mandiri_logo_2016.svg/2560px-Bank_Mandiri_logo_2016.svg.png' },
    { name: 'BNI', logo: 'https://upload.wikimedia.org/wikipedia/id/thumb/5/55/BNI_logo.svg/2560px-BNI_logo.svg.png' },
    { name: 'BRI', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/BANK_BRI_logo.svg/2560px-BANK_BRI_logo.svg.png' },
    { name: 'CIMB Niaga', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/CIMB_Niaga_logo.svg/1200px-CIMB_Niaga_logo.svg.png' },
    { name: 'Permata', logo: 'https://upload.wikimedia.org/wikipedia/id/thumb/9/9e/Bank_Permata_logo.svg/1200px-Bank_Permata_logo.svg.png' },
    { name: 'BTN', logo: 'https://upload.wikimedia.org/wikipedia/id/thumb/7/72/Logo_Bank_BTN.svg/1200px-Logo_Bank_BTN.svg.png' },
    { name: 'Danamon', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Bank_Danamon_logo.svg/2560px-Bank_Danamon_logo.svg.png' },
    { name: 'OCBC NISP', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Logo_OCBC_NISP.svg/2560px-Logo_OCBC_NISP.svg.png' }
  ];

  const suggestBankLogo = (bankName) => {
    const suggestion = commonBankLogos.find(bank => 
      bankName.toLowerCase().includes(bank.name.toLowerCase())
    );
    return suggestion?.logo || '';
  };

  const handleLogoError = () => {
    setPreviewLogo(null);
    setError('URL logo tidak valid atau gambar tidak dapat diakses');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-1 text-tosca-600">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4">Memuat data bank...</p>
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
                <h1 className="text-2xl font-bold text-gray-900">Kelola Bank</h1>
                <p className="text-sm text-gray-600">
                  Tambah, edit, dan kelola daftar bank untuk pembayaran gaji
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-tosca-600 text-white rounded-lg hover:bg-tosca-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Bank</span>
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
                  <Building className="h-6 w-6 text-tosca-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Bank</p>
                  <p className="text-2xl font-bold text-gray-900">{banks.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Bank Aktif</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {banks.filter(b => b.is_active).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pembayaran</p>
                  <p className="text-lg font-bold text-gray-900">
                    Transfer Bank
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
                      placeholder="Cari bank..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Banks Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Building className="h-5 w-5 text-tosca-600" />
                <h2 className="text-lg font-medium text-gray-900">
                  Daftar Bank ({filteredBanks.length})
                </h2>
              </div>
            </div>
            
            {contentLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-flex space-x-1 text-tosca-600">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : filteredBanks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nama Bank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kode Bank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Deskripsi
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
                    {filteredBanks.map((bank) => (
                      <tr key={bank.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            {bank.bank_logo ? (
                              <img 
                                src={bank.bank_logo} 
                                alt={bank.bank_name}
                                className="w-10 h-10 object-contain bg-white rounded border border-gray-200"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = '';
                                  e.target.parentElement.innerHTML = `
                                    <div class="w-10 h-10 bg-tosca-100 rounded-full flex items-center justify-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-tosca-600">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                        <polyline points="21 15 16 10 5 21"></polyline>
                                      </svg>
                                    </div>
                                  `;
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 bg-tosca-100 rounded-full flex items-center justify-center">
                                <Building className="h-5 w-5 text-tosca-600" />
                              </div>
                            )}
                            <div className="text-sm font-medium text-gray-900">
                              {bank.bank_name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Code className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-900">{bank.bank_code || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {bank.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            bank.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {bank.is_active ? 'Aktif' : 'Tidak Aktif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(bank)}
                              className="text-tosca-600 hover:text-tosca-900 p-1 hover:bg-tosca-50 rounded"
                              title="Edit Bank"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(bank.id)}
                              className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                              title="Hapus Bank"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            {bank.bank_logo && (
                              <a
                                href={bank.bank_logo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-600 hover:text-gray-900 p-1 hover:bg-gray-50 rounded"
                                title="Lihat Logo"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg mb-2">Tidak ada bank ditemukan</p>
                <p className="text-gray-400">Coba sesuaikan pencarian atau tambah bank baru</p>
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
                  {editingBank ? 'Edit Bank' : 'Tambah Bank Baru'}
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
                  <h3 className="font-medium text-gray-900 mb-4">Informasi Bank</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nama Bank *
                      </label>
                      <input
                        type="text"
                        name="bank_name"
                        value={formData.bank_name}
                        onChange={(e) => {
                          handleInputChange(e);
                          // Auto-suggest logo URL based on bank name
                          if (!formData.bank_logo) {
                            const suggestedLogo = suggestBankLogo(e.target.value);
                            if (suggestedLogo) {
                              setFormData(prev => ({
                                ...prev,
                                bank_logo: suggestedLogo
                              }));
                            }
                          }
                        }}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Contoh: BCA, Mandiri, BNI"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kode Bank
                      </label>
                      <input
                        type="text"
                        name="bank_code"
                        value={formData.bank_code}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Contoh: 014, 008, 009"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL Logo Bank
                    </label>
                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <div className="relative">
                          <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <input
                            type="text"
                            name="bank_logo"
                            value={formData.bank_logo}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                            placeholder="https://example.com/logo.png"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Logo Preview */}
                    {previewLogo && (
                      <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-16 h-16 bg-white rounded border flex items-center justify-center p-1">
                            <img 
                              src={previewLogo} 
                              alt="Logo Preview"
                              className="max-w-full max-h-full object-contain"
                              onError={handleLogoError}
                            />
                          </div>
                          <div className="text-sm text-gray-600">
                            <p className="font-medium">Logo Preview</p>
                            <p className="text-xs text-gray-500">Pastikan URL gambar valid dan dapat diakses</p>
                            <button 
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, bank_logo: '' }));
                                setPreviewLogo(null);
                              }}
                              className="text-xs text-red-600 hover:text-red-800 mt-1"
                            >
                              Hapus Logo
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Logo Suggestions */}
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">Logo Bank Populer:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {commonBankLogos.map((bank) => (
                          <button
                            key={bank.name}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, bank_logo: bank.logo }))}
                            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <img 
                              src={bank.logo} 
                              alt={bank.name}
                              className="w-6 h-6 object-contain"
                            />
                            <span className="text-xs">{bank.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deskripsi
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                      placeholder="Deskripsi singkat tentang bank..."
                    />
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
                    Bank aktif (dapat dipilih saat menambah rekening karyawan)
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
                      <span>{editingBank ? 'Perbarui Bank' : 'Simpan Bank'}</span>
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

export default BankManagement;