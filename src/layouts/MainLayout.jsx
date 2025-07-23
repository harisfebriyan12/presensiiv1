import React from 'react';
import AdminSidebar from '../components/AdminSidebar';

const MainLayout = ({ children }) => {
  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 p-4">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
