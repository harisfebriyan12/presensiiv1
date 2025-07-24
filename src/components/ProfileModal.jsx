import React from 'react';

const ProfileModal = ({ profile, onClose }) => {
  if (!profile) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 relative animate-fadeIn">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        <div className="flex flex-col items-center">
          <img
            src={profile.avatar_url || '/default-bank.png'}
            alt="Avatar"
            className="w-28 h-28 rounded-full border-4 border-tosca-200 shadow mb-4 object-cover"
          />
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{profile.name}</h2>
          <p className="text-gray-500 mb-2">{profile.position || profile.title || '-'}</p>
          <p className="text-gray-400 mb-4">{profile.department || '-'}</p>
          <div className="w-full border-t pt-4 mt-4">
            <div className="flex flex-col gap-2 text-sm text-gray-700">
              <div><span className="font-semibold">Email:</span> {profile.email}</div>
              <div><span className="font-semibold">No. Pegawai:</span> {profile.employee_id || '-'}</div>
              <div><span className="font-semibold">Telepon:</span> {profile.phone || '-'}</div>
              <div><span className="font-semibold">Alamat:</span> {profile.address || '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
