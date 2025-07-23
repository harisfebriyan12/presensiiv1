import React, { useState, useEffect } from 'react';
import Swal from '../pages/swal';
import { 
  DollarSign, 
  Calendar, 
  CreditCard, 
  Building, 
  User, 
  Send, 
  X, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Clock,
  Briefcase
} from 'lucide-react';
import { supabase } from '../hooks/supabaseClient';

const SalaryPaymentForm = ({ employee, onClose, onPaymentProcessed }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [formData, setFormData] = useState({
    amount: 0,
    payment_method: 'bank_transfer',
    payment_reference: '',
    payment_period_start: new Date().toISOString().split('T')[0],
    payment_period_end: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (employee) {
      // Calculate default amount based on employee salary from position
      let monthlySalary = 0;
      
      // First try to get from positions
      if (employee.positions?.base_salary) {
        monthlySalary = employee.positions.base_salary;
      }
      // Then try from employee_salaries
      else if (employee.employee_salaries && employee.employee_salaries.length > 0) {
        monthlySalary = employee.employee_salaries[0].daily_salary * 22 || 0;
      }
      // Fallback to profile salary
      else {
        monthlySalary = employee.salary || 0;
      }
      
      setFormData(prev => ({
        ...prev,
        amount: monthlySalary,
        notes: `Gaji bulan ${new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })} untuk ${employee.name}`
      }));

      fetchPaymentHistory();
    }
  }, [employee]);

  const fetchPaymentHistory = async () => {
    if (!employee) return;

    try {
      const { data, error } = await supabase
        .from('salary_payments')
        .select('*')
        .eq('user_id', employee.id)
        .order('payment_date', { ascending: false })
        .limit(5);

      if (error) throw error;
      setPaymentHistory(data || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!employee) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Karyawan tidak ditemukan' });
        return;
      }

      if (!formData.amount || formData.amount <= 0) {
        Swal.fire({ icon: 'warning', title: 'Jumlah tidak valid', text: 'Jumlah pembayaran harus lebih dari 0' });
        return;
      }

      // Check if employee has bank account for bank transfers
      if (formData.payment_method === 'bank_transfer' && 
          (!employee.bank_info || !employee.bank_account_number)) {
        Swal.fire({ icon: 'warning', title: 'Rekening belum diatur', text: 'Karyawan belum mengatur rekening bank. Gunakan metode pembayaran lain atau minta karyawan untuk mengatur rekening bank.' });
        return;
      }

      // 1. Insert payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('salary_payments')
        .insert([{
          user_id: employee.id,
          salary_id: employee.employee_salaries?.[0]?.id,
          payment_date: new Date().toISOString().split('T')[0],
          payment_amount: parseFloat(formData.amount),
          payment_method: formData.payment_method,
          payment_status: 'completed',
          payment_reference: formData.payment_reference,
          payment_period_start: formData.payment_period_start,
          payment_period_end: formData.payment_period_end,
          notes: formData.notes,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          payment_details: {
            processed_at: new Date().toISOString(),
            payment_method_details: formData.payment_method === 'bank_transfer' 
              ? { bank_name: employee.bank_info?.bank_name, account_number: employee.bank_account_number }
              : { method: formData.payment_method }
          }
        }])
        .select();

      if (paymentError) throw paymentError;

      // 2. Update employee_salaries table to mark as paid
      if (employee.employee_salaries && employee.employee_salaries.length > 0) {
        const { error: updateError } = await supabase
          .from('employee_salaries')
          .update({
            payment_status: 'paid',
            last_payment_date: new Date().toISOString().split('T')[0],
            payment_notes: formData.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', employee.employee_salaries[0].id);

        if (updateError) {
          console.error('Error updating salary status:', updateError);
          // Continue even if update fails
        }
      } else {
        // Create a new salary record if none exists
        const dailySalary = getEmployeeSalary() / 22;
        
        const { error: insertError } = await supabase
          .from('employee_salaries')
          .insert([{
            user_id: employee.id,
            daily_salary: dailySalary,
            overtime_rate: 1.5,
            effective_date: new Date().toISOString().split('T')[0],
            payment_status: 'paid',
            last_payment_date: new Date().toISOString().split('T')[0],
            payment_notes: formData.notes,
            is_active: true
          }]);

        if (insertError) {
          console.error('Error creating salary record:', insertError);
          // Continue even if insert fails
        }
      }

      // 3. Send notification to employee
      try {
        await supabase.from('notifications').insert([{
          user_id: employee.id,
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          type: 'salary_info',
          title: 'Pembayaran Gaji',
          message: `Gaji Anda sebesar ${formatCurrency(formData.amount)} telah dibayarkan melalui ${formData.payment_method === 'bank_transfer' ? 'transfer bank' : formData.payment_method === 'cash' ? 'tunai' : 'metode lainnya'}.`,
          data: {
            payment_id: paymentData[0].id,
            amount: formData.amount,
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: formData.payment_method
          },
          is_read: false
        }]);
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
        // Continue even if notification fails
      }

      setSuccess(`Pembayaran gaji sebesar ${formatCurrency(formData.amount)} untuk ${employee.name} berhasil diproses!`);
      Swal.fire({ icon: 'success', title: 'Berhasil', text: `Pembayaran gaji sebesar ${formatCurrency(formData.amount)} untuk ${employee.name} berhasil diproses!` });
      
      // Refresh payment history
      await fetchPaymentHistory();
      
      // Notify parent component
      if (onPaymentProcessed) {
        onPaymentProcessed({
          employeeId: employee.id,
          amount: formData.amount,
          paymentMethod: formData.payment_method,
          paymentDate: new Date().toISOString()
        });
      }

      // Reset form after 3 seconds
      setTimeout(() => {
        setSuccess(null);
        setFormData({
          amount: 0,
          payment_method: 'bank_transfer',
          payment_reference: '',
          payment_period_start: new Date().toISOString().split('T')[0],
          payment_period_end: new Date().toISOString().split('T')[0],
          notes: ''
        });
      }, 3000);

    } catch (error) {
      console.error('Error processing payment:', error);
      Swal.fire({ icon: 'error', title: 'Gagal', text: error.message || 'Gagal memproses pembayaran' });
    } finally {
      setLoading(false);
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
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Get salary from position or employee_salaries
  const getEmployeeSalary = () => {
    // First try to get from positions
    if (employee.positions?.base_salary) {
      return employee.positions.base_salary;
    }
    
    // Then try from employee_salaries
    if (employee.employee_salaries && employee.employee_salaries.length > 0) {
      const dailySalary = employee.employee_salaries[0].daily_salary || 0;
      return dailySalary * 22; // Convert daily to monthly
    }
    
    // Fallback to profile salary
    return employee.salary || 0;
  };

  if (!employee) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Proses Pembayaran Gaji
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-700 font-medium">Pembayaran Berhasil!</p>
                <p className="text-green-600 text-sm mt-1">{success}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 font-medium">Pembayaran Gagal</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Employee Info */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-3">Informasi Karyawan</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-blue-700">Nama</p>
                    <p className="font-medium text-blue-900">{employee.name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Briefcase className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-blue-700">Jabatan</p>
                    <p className="font-medium text-blue-900">{employee.positions?.name_id || employee.title || 'Karyawan'}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-blue-700">Departemen</p>
                    <p className="font-medium text-blue-900">{employee.department || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-blue-700">Gaji Bulanan</p>
                    <p className="font-medium text-blue-900">
                      {formatCurrency(getEmployeeSalary())}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Account Info */}
            <div className={`p-4 rounded-lg ${employee.bank_info ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <h3 className="font-medium text-gray-900 mb-3">Informasi Rekening</h3>
              {employee.bank_info ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <Building className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Bank</p>
                      <p className="font-medium text-gray-900">{employee.bank_info.bank_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CreditCard className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Nomor Rekening</p>
                      <p className="font-medium text-gray-900">{employee.bank_account_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Atas Nama</p>
                      <p className="font-medium text-gray-900">{employee.bank_account_name || employee.name}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <p className="text-yellow-700">Karyawan belum mengatur informasi rekening bank</p>
                </div>
              )}
            </div>

            {/* Payment Form */}
            <form onSubmit={handleSubmit}>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-4">Detail Pembayaran</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Jumlah Pembayaran (IDR) *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleInputChange}
                        required
                        min="1"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Contoh: 5000000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Metode Pembayaran *
                    </label>
                    <select
                      name="payment_method"
                      value={formData.payment_method}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      name="payment_reference"
                      value={formData.payment_reference}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Contoh: TRF/2025/06/001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tanggal Pembayaran
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="date"
                        name="payment_date"
                        value={new Date().toISOString().split('T')[0]}
                        readOnly
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Periode Awal
                    </label>
                    <input
                      type="date"
                      name="payment_period_start"
                      value={formData.payment_period_start}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Periode Akhir
                    </label>
                    <input
                      type="date"
                      name="payment_period_end"
                      value={formData.payment_period_end}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catatan
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Catatan tambahan tentang pembayaran ini..."
                  />
                </div>
              </div>

              {/* Payment Summary */}
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-medium text-green-900 mb-3">Ringkasan Pembayaran</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-green-700">Total Pembayaran:</span>
                    <span className="font-bold text-green-900">{formatCurrency(formData.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Metode Pembayaran:</span>
                    <span className="font-medium text-green-900">
                      {formData.payment_method === 'bank_transfer' ? 'Transfer Bank' : 
                       formData.payment_method === 'cash' ? 'Tunai' : 'Lainnya'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Penerima:</span>
                    <span className="font-medium text-green-900">{employee.name}</span>
                  </div>
                  {formData.payment_method === 'bank_transfer' && employee.bank_info && (
                    <div className="flex justify-between">
                      <span className="text-green-700">Rekening Tujuan:</span>
                      <span className="font-medium text-green-900">
                        {employee.bank_info.bank_name} - {employee.bank_account_number}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="inline-flex space-x-1">
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span>Memproses...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <Send className="h-4 w-4" />
                      <span>Proses Pembayaran</span>
                    </div>
                  )}
                </button>
              </div>
            </form>

            {/* Payment History Toggle */}
            <div className="mt-6">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Clock className="h-4 w-4" />
                <span>{showHistory ? 'Sembunyikan Riwayat' : 'Lihat Riwayat Pembayaran'}</span>
              </button>
            </div>

            {/* Payment History */}
            {showHistory && (
              <div className="mt-4 space-y-4">
                <h3 className="font-medium text-gray-900">Riwayat Pembayaran</h3>
                {paymentHistory.length > 0 ? (
                  <div className="space-y-3">
                    {paymentHistory.map((payment) => (
                      <div key={payment.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span className="font-medium text-gray-900">{formatDate(payment.payment_date)}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            payment.payment_status === 'completed' ? 'bg-green-100 text-green-800' :
                            payment.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            payment.payment_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {payment.payment_status === 'completed' ? 'Selesai' :
                             payment.payment_status === 'pending' ? 'Tertunda' :
                             payment.payment_status === 'processing' ? 'Diproses' : 'Gagal'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-gray-600">
                              {payment.payment_method === 'bank_transfer' ? 'Transfer Bank' :
                               payment.payment_method === 'cash' ? 'Tunai' : 'Lainnya'}
                              {payment.payment_reference && ` (${payment.payment_reference})`}
                            </p>
                            {payment.notes && (
                              <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>
                            )}
                          </div>
                          <p className="font-bold text-gray-900">{formatCurrency(payment.payment_amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">Belum ada riwayat pembayaran</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalaryPaymentForm;