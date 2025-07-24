import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Edit, Save, X, Plus, Search, Filter, TrendingUp, Users, AlertTriangle, CheckCircle, XCircle, Calendar, Building, CreditCard, Ban as Bank, RefreshCw, Send, Clock, FileText } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

const SalaryManagement = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalMonthlySalary: 0,
    avgDailySalary: 0,
    departments: [],
    paidSalaries: 0,
    unpaidSalaries: 0
  });

  // Form state for editing
  const [editForm, setEditForm] = useState({
    daily_salary: 0,
    overtime_rate: 1.5,
    bonus: 0,
    deduction: 0,
    department: '',
    title: '',
    employee_id: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: ''
  });

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_method: 'bank_transfer',
    payment_reference: '',
    payment_period_start: '',
    payment_period_end: '',
    notes: ''
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
      setCurrentUserRole(profile.role);
      await fetchEmployees();
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          employee_salaries(*)
        `)
        .order('name');

      if (error) throw error;

      // Get payment history
      const { data: paymentData, error: paymentError } = await supabase
        .from('salary_payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (paymentError) throw paymentError;

      // Combine data
      const employeesWithPayments = data.map(employee => {
        const payments = paymentData.filter(payment => payment.user_id === employee.id);
        return {
          ...employee,
          payments: payments || []
        };
      });

      setEmployees(employeesWithPayments || []);
      calculateStats(employeesWithPayments || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setError('Gagal memuat data karyawan');
    }
  };

  const calculateStats = (employeeData) => {
    const totalEmployees = employeeData.length;
    const totalMonthlySalary = employeeData.reduce((sum, emp) => 
      sum + (emp.employee_salaries?.[0]?.daily_salary * 22 || 0), 0
    );
    const avgDailySalary = totalEmployees > 0 
      ? employeeData.reduce((sum, emp) => sum + (emp.employee_salaries?.[0]?.daily_salary || 0), 0) / totalEmployees
      : 0;

    // Get unique departments
    const departments = [...new Set(employeeData.map(emp => emp.department).filter(Boolean))];

    // Count paid vs unpaid salaries
    const paidSalaries = employeeData.filter(emp => 
      emp.employee_salaries?.[0]?.payment_status === 'paid'
    ).length;
    
    const unpaidSalaries = employeeData.filter(emp => 
      !emp.employee_salaries?.[0] || emp.employee_salaries[0].payment_status !== 'paid'
    ).length;

    setStats({
      totalEmployees,
      totalMonthlySalary,
      avgDailySalary,
      departments,
      paidSalaries,
      unpaidSalaries
    });
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setEditForm({
      daily_salary: employee.employee_salaries?.[0]?.daily_salary || 0,
      overtime_rate: employee.employee_salaries?.[0]?.overtime_rate || 1.5,
      bonus: employee.employee_salaries?.[0]?.bonus || 0,
      deduction: employee.employee_salaries?.[0]?.deduction || 0,
      department: employee.department || '',
      title: employee.title || '',
      employee_id: employee.employee_id || '',
      bank_name: employee.bank_name || '',
      bank_account_number: employee.bank_account_number || '',
      bank_account_name: employee.bank_account_name || ''
    });
    setShowEditModal(true);
  };

  const handleProcessPayment = (employee) => {
    setEditingEmployee(employee);
    const monthlySalary = (employee.employee_salaries?.[0]?.daily_salary || 0) * 22;
    const bonus = employee.employee_salaries?.[0]?.bonus || 0;
    const deduction = employee.employee_salaries?.[0]?.deduction || 0;
    const totalAmount = monthlySalary + bonus - deduction;
    
    // Get current month period
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setPaymentForm({
      amount: totalAmount,
      payment_method: 'bank_transfer',
      payment_reference: `SAL/${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2, '0')}/${employee.employee_id || employee.id.substring(0, 8)}`,
      payment_period_start: firstDay.toISOString().split('T')[0],
      payment_period_end: lastDay.toISOString().split('T')[0],
      notes: `Gaji bulan ${today.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`
    });
    
    setShowPaymentModal(true);
  };

  const handleSaveChanges = async () => {
    if (!editingEmployee) return;

    try {
      setError(null);

      // Update profile information
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          department: editForm.department,
          title: editForm.title,
          employee_id: editForm.employee_id,
          bank_name: editForm.bank_name,
          bank_account_number: editForm.bank_account_number,
          bank_account_name: editForm.bank_account_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingEmployee.id);

      if (profileError) throw profileError;

      // Check if employee has a salary record
      if (editingEmployee.employee_salaries && editingEmployee.employee_salaries.length > 0) {
        // Update existing salary record
        const { error: salaryError } = await supabase
          .from('employee_salaries')
          .update({
            daily_salary: parseFloat(editForm.daily_salary),
            overtime_rate: parseFloat(editForm.overtime_rate),
            bonus: parseFloat(editForm.bonus),
            deduction: parseFloat(editForm.deduction),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', editingEmployee.id)
          .eq('is_active', true);

        if (salaryError) throw salaryError;
      } else {
        // Create new salary record
        const { error: insertError } = await supabase
          .from('employee_salaries')
          .insert([{
            user_id: editingEmployee.id,
            daily_salary: parseFloat(editForm.daily_salary),
            overtime_rate: parseFloat(editForm.overtime_rate),
            bonus: parseFloat(editForm.bonus),
            deduction: parseFloat(editForm.deduction),
            effective_date: new Date().toISOString().split('T')[0],
            is_active: true,
            payment_status: 'unpaid',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (insertError) throw insertError;
      }

      setSuccess('Data karyawan berhasil diperbarui!');
      setShowEditModal(false);
      setEditingEmployee(null);
      await fetchEmployees();

      // Auto-hide success message
      setTimeout(() => setSuccess(null), 3000);

    } catch (error) {
      console.error('Error updating employee:', error);
      setError('Gagal memperbarui data karyawan: ' + error.message);
    }
  };

  const handleSubmitPayment = async () => {
    if (!editingEmployee) return;

    try {
      setError(null);

      // Call the RPC function to process payment
      const { data, error } = await supabase.rpc('process_salary_payment', {
        p_user_id: editingEmployee.id,
        p_amount: parseFloat(paymentForm.amount),
        p_payment_method: paymentForm.payment_method,
        p_payment_reference: paymentForm.payment_reference,
        p_payment_period_start: paymentForm.payment_period_start,
        p_payment_period_end: paymentForm.payment_period_end,
        p_notes: paymentForm.notes
      });

      if (error) throw error;

      setSuccess(`Pembayaran gaji untuk ${editingEmployee.name} berhasil diproses!`);
      setShowPaymentModal(false);
      setEditingEmployee(null);
      await fetchEmployees();

      // Auto-hide success message
      setTimeout(() => setSuccess(null), 3000);

    } catch (error) {
      console.error('Error processing payment:', error);
      setError('Gagal memproses pembayaran: ' + error.message);
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'kepala':
        return 'Kepala Bagian';
      case 'karyawan':
        return 'Karyawan';
      default:
        return 'Karyawan';
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-tosca-100 text-tosca-800';
      case 'kepala':
        return 'bg-tosca-100 text-tosca-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusText = (status) => {
    switch (status) {
      case 'paid':
        return 'Dibayar';
      case 'processing':
        return 'Diproses';
      case 'failed':
        return 'Gagal';
      default:
        return 'Belum Dibayar';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (employee.employee_id && employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDepartment = filterDepartment === '' || employee.department === filterDepartment;
    const matchesRole = filterRole === '' || employee.role === filterRole;
    const matchesPaymentStatus = filterPaymentStatus === '' || 
                               (employee.employee_salaries?.[0]?.payment_status || 'unpaid') === filterPaymentStatus;
    
    return matchesSearch && matchesDepartment && matchesRole && matchesPaymentStatus;
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
          <p className="text-gray-600 mt-4">Memuat data gaji karyawan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-tosca-600 to-tosca-700 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Kelola Gaji Karyawan</h1>
                <p className="text-sm text-tosca-100">
                  Atur gaji, rekening bank, dan status pembayaran karyawan
                </p>
              </div>
            </div>
            <button
              onClick={fetchEmployees}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-tosca-700 rounded-lg hover:bg-white/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notifikasi */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-tosca-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-tosca-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Karyawan</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEmployees}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Gaji Bulanan</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalMonthlySalary)}</p>
                <p className="text-xs text-gray-500">22 hari kerja</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-tosca-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-tosca-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rata-rata Gaji Harian</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.avgDailySalary)}</p>
                <p className="text-xs text-gray-500">per karyawan</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-tosca-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-tosca-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Status Pembayaran</p>
                <div className="flex items-center space-x-2">
                  <span className="text-green-600 font-medium">{stats.paidSalaries} dibayar</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-red-600 font-medium">{stats.unpaidSalaries} belum</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter dan Pencarian */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari nama, email, atau ID karyawan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                >
                  <option value="">Semua Departemen</option>
                  {stats.departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={filterPaymentStatus}
                  onChange={(e) => setFilterPaymentStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                >
                  <option value="">Semua Status Pembayaran</option>
                  <option value="paid">Sudah Dibayar</option>
                  <option value="unpaid">Belum Dibayar</option>
                  <option value="processing">Sedang Diproses</option>
                  <option value="failed">Gagal</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-tosca-600" />
              <h2 className="text-lg font-medium text-gray-900">
                Daftar Gaji Karyawan ({filteredEmployees.length})
              </h2>
            </div>
          </div>
          
          {filteredEmployees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Karyawan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Posisi & Departemen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rekening Bank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gaji Harian
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gaji Bulanan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status Pembayaran
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.map((employee) => {
                    const salary = employee.employee_salaries?.[0];
                    const monthlySalary = (salary?.daily_salary || 0) * 22;
                    const totalBonus = (salary?.bonus || 0) - (salary?.deduction || 0);
                    const totalSalary = monthlySalary + totalBonus;
                    const paymentStatus = salary?.payment_status || 'unpaid';
                    
                    return (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-tosca-100 rounded-full flex items-center justify-center">
                              <span className="text-tosca-600 font-medium">
                                {employee.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {employee.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {employee.email}
                              </div>
                              {employee.employee_id && (
                                <div className="text-xs text-gray-400">
                                  ID: {employee.employee_id}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {employee.title || getRoleDisplayName(employee.role)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {employee.department || 'Belum diatur'}
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(employee.role)}`}>
                            {getRoleDisplayName(employee.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {employee.bank_name ? (
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {employee.bank_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {employee.bank_account_number}
                              </div>
                              <div className="text-xs text-gray-400">
                                {employee.bank_account_name}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-red-500">Belum diatur</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(salary?.daily_salary || 0)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Lembur: {salary?.overtime_rate || 1.5}x
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(totalSalary)}
                          </div>
                          <div className="text-xs text-gray-500 flex flex-col">
                            <span>Pokok: {formatCurrency(monthlySalary)}</span>
                            {totalBonus !== 0 && (
                              <span className={totalBonus > 0 ? 'text-green-500' : 'text-red-500'}>
                                {totalBonus > 0 ? '+' : ''}{formatCurrency(totalBonus)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(paymentStatus)}`}>
                              {getPaymentStatusText(paymentStatus)}
                            </span>
                            {salary?.last_payment_date && (
                              <span className="text-xs text-gray-500">
                                {formatDate(salary.last_payment_date)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditEmployee(employee)}
                              className="text-tosca-600 hover:text-tosca-900 p-1 hover:bg-tosca-50 rounded"
                              title="Edit Gaji & Rekening"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleProcessPayment(employee)}
                              className={`text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded ${
                                !employee.bank_name && 'opacity-50 cursor-not-allowed'
                              }`}
                              disabled={!employee.bank_name}
                              title={employee.bank_name ? "Proses Pembayaran" : "Rekening belum diatur"}
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg mb-2">Tidak ada karyawan ditemukan</p>
              <p className="text-gray-400">Coba sesuaikan pencarian atau filter Anda</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Edit Data Karyawan: {editingEmployee.name}
                </h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Profile Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Informasi Profil</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ID Karyawan
                      </label>
                      <input
                        type="text"
                        value={editForm.employee_id}
                        onChange={(e) => setEditForm({...editForm, employee_id: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Contoh: EMP001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Jabatan/Posisi
                      </label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Contoh: Staff IT"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Departemen
                      </label>
                      <input
                        type="text"
                        value={editForm.department}
                        onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Contoh: IT, HR, Finance"
                      />
                    </div>
                  </div>
                </div>

                {/* Bank Account Information */}
                <div className="bg-tosca-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Informasi Rekening Bank</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nama Bank
                      </label>
                      <input
                        type="text"
                        value={editForm.bank_name}
                        onChange={(e) => setEditForm({...editForm, bank_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Contoh: BCA, Mandiri, BNI"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nomor Rekening
                      </label>
                      <input
                        type="text"
                        value={editForm.bank_account_number}
                        onChange={(e) => setEditForm({...editForm, bank_account_number: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Contoh: 1234567890"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nama Pemilik Rekening
                      </label>
                      <input
                        type="text"
                        value={editForm.bank_account_name}
                        onChange={(e) => setEditForm({...editForm, bank_account_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Nama lengkap sesuai rekening"
                      />
                    </div>
                  </div>
                </div>

                {/* Salary Information */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Informasi Gaji</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gaji Harian (IDR)
                      </label>
                      <input
                        type="number"
                        value={editForm.daily_salary}
                        onChange={(e) => setEditForm({...editForm, daily_salary: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="300000"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Bulanan: {formatCurrency(editForm.daily_salary * 22)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rate Lembur (x)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editForm.overtime_rate}
                        onChange={(e) => setEditForm({...editForm, overtime_rate: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="1.5"
                        min="1"
                        max="3"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Lembur: {formatCurrency(editForm.daily_salary * editForm.overtime_rate)}/hari
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bonus & Deductions */}
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Bonus & Potongan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bonus Bulanan (IDR)
                      </label>
                      <input
                        type="number"
                        value={editForm.bonus}
                        onChange={(e) => setEditForm({...editForm, bonus: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Potongan Bulanan (IDR)
                      </label>
                      <input
                        type="number"
                        value={editForm.deduction}
                        onChange={(e) => setEditForm({...editForm, deduction: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-white rounded border">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">Total Gaji Bulanan:</span>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency((editForm.daily_salary * 22) + parseFloat(editForm.bonus || 0) - parseFloat(editForm.deduction || 0))}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Gaji Pokok: {formatCurrency(editForm.daily_salary * 22)} + 
                      Bonus: {formatCurrency(editForm.bonus || 0)} - 
                      Potongan: {formatCurrency(editForm.deduction || 0)}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveChanges}
                    className="flex-1 bg-tosca-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-tosca-700 transition-colors"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Save className="h-4 w-4" />
                      <span>Simpan Perubahan</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && editingEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Proses Pembayaran Gaji: {editingEmployee.name}
                </h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Employee Info */}
                <div className="bg-tosca-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Informasi Karyawan</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Nama:</span>
                      <span className="ml-2 font-medium">{editingEmployee.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Jabatan:</span>
                      <span className="ml-2 font-medium">{editingEmployee.title || getRoleDisplayName(editingEmployee.role)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Departemen:</span>
                      <span className="ml-2 font-medium">{editingEmployee.department || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">ID:</span>
                      <span className="ml-2 font-medium">{editingEmployee.employee_id || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Bank Account Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Informasi Rekening</h3>
                  {editingEmployee.bank_name ? (
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center">
                        <Bank className="h-4 w-4 text-gray-500 mr-2" />
                        <span className="text-gray-600">Bank:</span>
                        <span className="ml-2 font-medium">{editingEmployee.bank_name}</span>
                      </div>
                      <div className="flex items-center">
                        <CreditCard className="h-4 w-4 text-gray-500 mr-2" />
                        <span className="text-gray-600">Nomor Rekening:</span>
                        <span className="ml-2 font-medium">{editingEmployee.bank_account_number}</span>
                      </div>
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-500 mr-2" />
                        <span className="text-gray-600">Atas Nama:</span>
                        <span className="ml-2 font-medium">{editingEmployee.bank_account_name}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-red-50 rounded-lg text-red-600 text-sm">
                      <AlertTriangle className="h-4 w-4 inline mr-2" />
                      Karyawan belum mengatur informasi rekening bank. Silakan edit data karyawan terlebih dahulu.
                    </div>
                  )}
                </div>

                {/* Payment Details */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Detail Pembayaran</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Jumlah Pembayaran (IDR)
                      </label>
                      <input
                        type="number"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Metode Pembayaran
                      </label>
                      <select
                        value={paymentForm.payment_method}
                        onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                      >
                        <option value="bank_transfer">Transfer Bank</option>
                        <option value="cash">Tunai</option>
                        <option value="other">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Referensi Pembayaran
                      </label>
                      <input
                        type="text"
                        value={paymentForm.payment_reference}
                        onChange={(e) => setPaymentForm({...paymentForm, payment_reference: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Nomor referensi atau kode transaksi"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Periode Awal
                        </label>
                        <input
                          type="date"
                          value={paymentForm.payment_period_start}
                          onChange={(e) => setPaymentForm({...paymentForm, payment_period_start: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Periode Akhir
                        </label>
                        <input
                          type="date"
                          value={paymentForm.payment_period_end}
                          onChange={(e) => setPaymentForm({...paymentForm, payment_period_end: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Catatan Pembayaran
                      </label>
                      <textarea
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
                        placeholder="Catatan tambahan untuk pembayaran ini"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-4">Ringkasan Pembayaran</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Pembayaran:</span>
                      <span className="font-bold text-green-600">{formatCurrency(paymentForm.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Metode Pembayaran:</span>
                      <span className="font-medium">{
                        paymentForm.payment_method === 'bank_transfer' ? 'Transfer Bank' :
                        paymentForm.payment_method === 'cash' ? 'Tunai' : 'Lainnya'
                      }</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Periode:</span>
                      <span className="font-medium">
                        {paymentForm.payment_period_start ? formatDate(paymentForm.payment_period_start) : '-'} s/d {paymentForm.payment_period_end ? formatDate(paymentForm.payment_period_end) : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSubmitPayment}
                    disabled={!editingEmployee.bank_name && paymentForm.payment_method === 'bank_transfer'}
                    className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Send className="h-4 w-4" />
                      <span>Proses Pembayaran</span>
                    </div>
                  </button>
                </div>

                {/* Warning for bank transfer without bank account */}
                {!editingEmployee.bank_name && paymentForm.payment_method === 'bank_transfer' && (
                  <div className="p-3 bg-red-50 rounded-lg text-red-600 text-sm">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    Tidak dapat melakukan transfer bank karena informasi rekening belum diatur.
                    Silakan pilih metode pembayaran lain atau update informasi rekening terlebih dahulu.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryManagement;