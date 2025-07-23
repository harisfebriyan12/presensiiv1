import React, { useState } from 'react';
import Swal from '../pages/swal';
import { FileText, Download, Send, X, AlertTriangle, Save, Printer, Mail } from 'lucide-react';
import { supabase } from '../hooks/supabaseClient';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const WarningLetterGenerator = ({ employee, onClose, onGenerated, issuedByUserId }) => {
  // Jika data penting tidak ada, tampilkan error user-friendly
  if (!employee || !employee.name || !issuedByUserId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Data Tidak Lengkap</h2>
          <p className="text-gray-700 mb-6">Tidak dapat menampilkan form surat peringatan.<br/>Pastikan data karyawan dan user pengeluar surat sudah benar.</p>
          <button onClick={onClose} className="px-4 py-2 bg-red-600 text-white rounded-lg">Tutup</button>
        </div>
      </div>
    );
  }
  const [warningType, setWarningType] = useState('SP1');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const warningTypes = [
    { value: 'SP1', label: 'Surat Peringatan 1', color: 'yellow' },
    { value: 'SP2', label: 'Surat Peringatan 2', color: 'orange' },
    { value: 'SP3', label: 'Surat Peringatan 3', color: 'red' },
    { value: 'termination', label: 'Surat Pemberhentian', color: 'red' }
  ];

  const commonReasons = [
    'Keterlambatan berulang',
    'Tidak hadir tanpa keterangan',
    'Melanggar peraturan perusahaan',
    'Kinerja tidak memuaskan',
    'Tidak mengikuti prosedur kerja',
    'Pelanggaran disiplin kerja'
  ];

  const generateLetter = async () => {
    if (!reason.trim()) {
      Swal.fire({ icon: 'warning', title: 'Alasan wajib diisi', text: 'Alasan peringatan harus diisi.' });
      return;
    }

    if (!issuedByUserId) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat menentukan pengguna yang mengeluarkan surat.' });
      return;
    }

    setIsGenerating(true);
    try {
      // Call the database function to generate warning letter with issued_by parameter
      const { data, error } = await supabase.rpc('generate_warning_letter', {
        p_user_id: employee.id,
        p_warning_type: warningType,
        p_reason: reason,
        p_description: description,
        p_issued_by: issuedByUserId
      });

      if (error) throw error;

      // Fetch the generated letter
      const { data: letterData, error: fetchError } = await supabase
        .from('warning_letters')
        .select('*')
        .eq('id', data)
        .single();

      if (fetchError) throw fetchError;

      setGeneratedLetter(letterData);
      
      if (onGenerated) {
        onGenerated(letterData);
      }
      
      // Show preview
      setShowPreview(true);
      
    } catch (error) {
      console.error('Error generating warning letter:', error);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal membuat surat peringatan: ' + error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePDF = () => {
    if (!generatedLetter) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Surat belum digenerate.' });
      return;
    }
    
    try {
      const doc = new jsPDF();
      
      // Add company header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('PT. COMPANY NAME', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Jl. Contoh Alamat No. 123, Jakarta Selatan', 105, 28, { align: 'center' });
      doc.text('Telp: (021) 1234-5678 | Email: info@company.com', 105, 34, { align: 'center' });
      
      // Add horizontal line
      doc.setLineWidth(0.5);
      doc.line(20, 38, 190, 38);
      
      // Letter title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`SURAT PERINGATAN ${generatedLetter.warning_type}`, 105, 50, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Nomor: ${generatedLetter.letter_number}`, 105, 58, { align: 'center' });
      
      // Letter content
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      
      // Employee details
      doc.text('Kepada Yth:', 20, 70);
      doc.text(`Nama: ${employee.name}`, 20, 78);
      doc.text(`Jabatan: ${employee.title || 'Karyawan'}`, 20, 86);
      doc.text(`Departemen: ${employee.department || '-'}`, 20, 94);
      doc.text(`Tanggal: ${new Date(generatedLetter.issue_date).toLocaleDateString('id-ID')}`, 20, 102);
      
      // Letter body
      doc.text('Dengan ini kami memberikan surat peringatan dengan alasan:', 20, 116);
      
      // Wrap text for reason
      const splitReason = doc.splitTextToSize(generatedLetter.reason, 150);
      doc.setFont('helvetica', 'bold');
      doc.text(splitReason, 30, 124);
      
      // Description if available
      let yPos = 124 + (splitReason.length * 8);
      
      if (generatedLetter.description) {
        doc.setFont('helvetica', 'normal');
        const splitDesc = doc.splitTextToSize(generatedLetter.description, 150);
        doc.text(splitDesc, 20, yPos);
        yPos += (splitDesc.length * 8) + 8;
      } else {
        yPos += 16;
      }
      
      // Standard warning text
      doc.setFont('helvetica', 'normal');
      const warningText = 'Harap untuk lebih memperhatikan kedisiplinan kerja dan tidak mengulangi pelanggaran yang sama. Apabila pelanggaran ini terulang kembali, maka perusahaan akan mengambil tindakan lebih lanjut sesuai dengan peraturan perusahaan yang berlaku.';
      const splitWarning = doc.splitTextToSize(warningText, 170);
      doc.text(splitWarning, 20, yPos);
      
      yPos += (splitWarning.length * 8) + 16;
      
      // Closing
      doc.text('Demikian surat peringatan ini dibuat untuk dapat diperhatikan dan dilaksanakan dengan sebaik-baiknya.', 20, yPos);
      
      yPos += 24;
      
      // Signature
      doc.text('Hormat kami,', 20, yPos);
      doc.text('Manajemen Perusahaan', 20, yPos + 8);
      
      yPos += 40;
      
      doc.text('_____________________', 20, yPos);
      doc.text('Tanda Tangan & Stempel', 20, yPos + 8);
      
      // Employee acknowledgment
      doc.text('Diterima oleh,', 140, yPos - 40);
      doc.text('Karyawan', 140, yPos - 32);
      
      doc.text('_____________________', 140, yPos);
      doc.text(`(${employee.name})`, 140, yPos + 8);
      
      // Save the PDF
      doc.save(`SP_${generatedLetter.warning_type}_${employee.name}_${generatedLetter.letter_number.replace(/\//g, '_')}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Gagal membuat file PDF: ' + error.message);
    }
  };

  const downloadLetter = () => {
    if (!generatedLetter) return;

    const letterContent = `
SURAT PERINGATAN ${generatedLetter.warning_type}
Nomor: ${generatedLetter.letter_number}

Kepada: ${employee.name}
Jabatan: ${employee.title || 'Karyawan'}
Tanggal: ${new Date(generatedLetter.issue_date).toLocaleDateString('id-ID')}

Dengan ini kami memberikan surat peringatan ${generatedLetter.warning_type} atas:
${generatedLetter.reason}

${generatedLetter.description}

Harap untuk lebih memperhatikan kedisiplinan kerja dan tidak mengulangi pelanggaran yang sama.

Apabila pelanggaran ini terulang kembali, maka perusahaan akan mengambil tindakan lebih lanjut sesuai dengan peraturan perusahaan yang berlaku.

Demikian surat peringatan ini dibuat untuk dapat diperhatikan dan dilaksanakan dengan sebaik-baiknya.

Hormat kami,
Manajemen Perusahaan


_____________________
Tanda Tangan & Stempel
    `;

    const blob = new Blob([letterContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SP_${generatedLetter.warning_type}_${employee.name}_${generatedLetter.letter_number.replace(/\//g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getWarningTypeColor = (type) => {
    const typeObj = warningTypes.find(t => t.value === type);
    return typeObj?.color || 'gray';
  };

  const printLetter = () => {
    if (!generatedLetter) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Generate HTML content for the print window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Surat Peringatan ${generatedLetter.warning_type}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            line-height: 1.5;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .company-name {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .company-address {
            font-size: 14px;
            margin-bottom: 5px;
          }
          .divider {
            border-top: 2px solid #000;
            margin: 20px 0;
          }
          .letter-title {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .letter-number {
            text-align: center;
            font-size: 14px;
            margin-bottom: 30px;
          }
          .recipient {
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 30px;
          }
          .reason {
            margin-left: 20px;
            font-weight: bold;
            margin-bottom: 20px;
          }
          .description {
            margin-bottom: 20px;
          }
          .warning {
            margin-bottom: 30px;
          }
          .closing {
            margin-bottom: 30px;
          }
          .signature {
            display: flex;
            justify-content: space-between;
          }
          .signature-block {
            width: 45%;
          }
          .signature-line {
            border-top: 1px solid #000;
            margin-top: 50px;
            width: 80%;
          }
          @media print {
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">PT. COMPANY NAME</div>
          <div class="company-address">Jl. Contoh Alamat No. 123, Jakarta Selatan</div>
          <div class="company-address">Telp: (021) 1234-5678 | Email: info@company.com</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="letter-title">SURAT PERINGATAN ${generatedLetter.warning_type}</div>
        <div class="letter-number">Nomor: ${generatedLetter.letter_number}</div>
        
        <div class="recipient">
          <div>Kepada Yth:</div>
          <div>Nama: ${employee.name}</div>
          <div>Jabatan: ${employee.title || 'Karyawan'}</div>
          <div>Departemen: ${employee.department || '-'}</div>
          <div>Tanggal: ${new Date(generatedLetter.issue_date).toLocaleDateString('id-ID')}</div>
        </div>
        
        <div class="content">
          <div>Dengan ini kami memberikan surat peringatan dengan alasan:</div>
          <div class="reason">${generatedLetter.reason}</div>
          
          ${generatedLetter.description ? `<div class="description">${generatedLetter.description}</div>` : ''}
          
          <div class="warning">
            Harap untuk lebih memperhatikan kedisiplinan kerja dan tidak mengulangi pelanggaran yang sama. 
            Apabila pelanggaran ini terulang kembali, maka perusahaan akan mengambil tindakan lebih lanjut 
            sesuai dengan peraturan perusahaan yang berlaku.
          </div>
          
          <div class="closing">
            Demikian surat peringatan ini dibuat untuk dapat diperhatikan dan dilaksanakan dengan sebaik-baiknya.
          </div>
        </div>
        
        <div class="signature">
          <div class="signature-block">
            <div>Hormat kami,</div>
            <div>Manajemen Perusahaan</div>
            <div class="signature-line"></div>
            <div>Tanda Tangan & Stempel</div>
          </div>
          
          <div class="signature-block">
            <div>Diterima oleh,</div>
            <div>Karyawan</div>
            <div class="signature-line"></div>
            <div>(${employee.name})</div>
          </div>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #4F46E5; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Print Surat Peringatan
          </button>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Trigger print after content is loaded
    printWindow.onload = function() {
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-lg">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6 text-red-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Buat Surat Peringatan
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {!showPreview ? (
            <div className="space-y-6">
              {/* Employee Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Informasi Karyawan</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Nama:</span>
                    <span className="ml-2 font-medium">{employee.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Jabatan:</span>
                    <span className="ml-2 font-medium">{employee.title || 'Karyawan'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Departemen:</span>
                    <span className="ml-2 font-medium">{employee.department || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">ID:</span>
                    <span className="ml-2 font-medium">{employee.employee_id || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Warning Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Jenis Peringatan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {warningTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setWarningType(type.value)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        warningType === type.value
                          ? `border-${type.color}-500 bg-${type.color}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className={`h-4 w-4 text-${type.color}-500`} />
                        <span className="font-medium">{type.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alasan Peringatan *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                >
                  <option value="">Pilih alasan...</option>
                  {commonReasons.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="custom">Alasan lainnya...</option>
                </select>
                
                {(reason === 'custom' || !commonReasons.includes(reason)) && (
                  <input
                    type="text"
                    value={reason === 'custom' ? '' : reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Masukkan alasan peringatan..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi Tambahan
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Jelaskan detail pelanggaran atau tindakan yang diharapkan..."
                />
              </div>

              {/* Warning Notice */}
              <div className={`p-4 rounded-lg border-l-4 border-${getWarningTypeColor(warningType)}-500 bg-${getWarningTypeColor(warningType)}-50`}>
                <div className="flex items-start space-x-3">
                  <AlertTriangle className={`h-5 w-5 text-${getWarningTypeColor(warningType)}-600 flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className={`text-${getWarningTypeColor(warningType)}-800 font-medium`}>
                      Peringatan Penting
                    </p>
                    <p className={`text-${getWarningTypeColor(warningType)}-700 text-sm mt-1`}>
                      Surat peringatan akan dikirim ke karyawan dan tersimpan dalam sistem. 
                      Pastikan informasi yang dimasukkan sudah benar.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={generateLetter}
                  disabled={!reason.trim() || isGenerating}
                  className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Membuat Surat...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <Send className="h-4 w-4" />
                      <span>Buat & Kirim Surat</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Generated Letter Display */
            <div className="space-y-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <FileText className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="text-green-800 font-medium">Surat Peringatan Berhasil Dibuat</p>
                    <p className="text-green-700 text-sm">
                      Nomor: {generatedLetter.letter_number}
                    </p>
                  </div>
                </div>
              </div>

              {/* Letter Preview */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    SURAT PERINGATAN {generatedLetter.warning_type}
                  </h3>
                  <p className="text-gray-600">Nomor: {generatedLetter.letter_number}</p>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <p><strong>Kepada:</strong> {employee.name}</p>
                    <p><strong>Jabatan:</strong> {employee.title || 'Karyawan'}</p>
                    <p><strong>Tanggal:</strong> {new Date(generatedLetter.issue_date).toLocaleDateString('id-ID')}</p>
                  </div>

                  <div className="border-t pt-4">
                    <p className="mb-2">
                      Dengan ini kami memberikan surat peringatan {generatedLetter.warning_type} atas:
                    </p>
                    <p className="font-medium">{generatedLetter.reason}</p>
                  </div>

                  {generatedLetter.description && (
                    <div className="border-t pt-4">
                      <p>{generatedLetter.description}</p>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <p>
                      Harap untuk lebih memperhatikan kedisiplinan kerja dan tidak mengulangi 
                      pelanggaran yang sama.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Tutup
                </button>
                
                <button
                  onClick={downloadLetter}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Download className="h-4 w-4" />
                    <span>Download TXT</span>
                  </div>
                </button>
                
                <button
                  onClick={generatePDF}
                  className="px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Save className="h-4 w-4" />
                    <span>Download PDF</span>
                  </div>
                </button>
                
                <button
                  onClick={printLetter}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Printer className="h-4 w-4" />
                    <span>Print Surat</span>
                  </div>
                </button>
                
                <button
                  onClick={() => Swal.fire({ icon: 'info', title: 'Segera Tersedia', text: 'Fitur kirim email akan segera tersedia.' })}
                  className="px-4 py-3 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4" />
                    <span>Kirim Email</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WarningLetterGenerator;