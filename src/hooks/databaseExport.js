/**
 * Database Export Utilities
 * 
 * This module provides functions to help with exporting database data
 * from Supabase to various formats.
 */

/**
 * Generate SQL export instructions for Supabase
 * @returns {string} Instructions for exporting database
 */
export const getExportInstructions = () => {
  return `
    # Cara Mengekspor Database Supabase

    ## Metode 1: Melalui Dashboard Supabase

    1. Login ke dashboard Supabase project Anda di [app.supabase.com](https://app.supabase.com)
    2. Pilih menu "Database" → "Backups" dari sidebar
    3. Klik tombol "Generate backup" untuk membuat backup terbaru
    4. Setelah backup selesai dibuat, klik tombol "Download" untuk mengunduh file SQL
    5. File SQL ini berisi seluruh skema dan data database Anda

    ## Metode 2: Menggunakan Supabase CLI (untuk Developer)

    1. Install Supabase CLI: \`npm install -g supabase\`
    2. Login ke Supabase: \`supabase login\`
    3. Jalankan perintah: \`supabase db dump -p your-project-ref\`
    4. File SQL akan dihasilkan di direktori lokal Anda

    ## Ekspor Storage (File dan Gambar)

    1. Buka menu "Storage" di dashboard Supabase
    2. Pilih bucket yang ingin diekspor (misalnya "face-photos")
    3. Gunakan fitur "Download" untuk mengunduh semua file dalam bucket tersebut
    4. Simpan file-file ini bersama dengan backup database SQL Anda

    ## Catatan Penting

    - Backup database berisi semua data sensitif, simpan dengan aman
    - Untuk memulihkan database, Anda dapat mengimpor file SQL ke instance PostgreSQL baru
    - Pastikan untuk melakukan backup secara berkala untuk mencegah kehilangan data
  `;
};

/**
 * Export table data to CSV format
 * @param {Array} data - Array of objects representing table rows
 * @param {string} filename - Name for the downloaded file
 */
export const exportTableToCSV = (data, filename = 'export.csv') => {
  if (!data || data.length === 0) {
    console.error('No data to export');
    return;
  }

  // Get headers from the first row
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(field => {
        const value = row[field];
        // Handle different data types
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      }).join(',')
    )
  ].join('\n');

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export table data to JSON format
 * @param {Array} data - Array of objects representing table rows
 * @param {string} filename - Name for the downloaded file
 */
export const exportTableToJSON = (data, filename = 'export.json') => {
  if (!data || data.length === 0) {
    console.error('No data to export');
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};