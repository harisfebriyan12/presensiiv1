import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, 
  BarChart3, 
  MapPin, 
  LogOut,
  UserPlus,
  Building,
  CreditCard,
  Menu,
  X,
  Database,
  Briefcase,
  Calendar,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../hooks/supabaseClient';

const AdminSidebar = ({ user, profile, isCollapsed, setIsCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await window.Swal.fire({
        icon: 'success',
        title: 'Logout Berhasil',
        text: 'Anda telah berhasil logout.'
      });
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const menuItems = [
    {
      title: 'Dashboard',
      icon: <BarChart3 className="h-5 w-5" />,
      path: '/admin',
      active: location.pathname === '/admin'
    },
    {
      title: 'Master Data',
      icon: <Database className="h-5 w-5" />,
      submenu: [
        {
          title: 'Kelola Pengguna',
          icon: <UserPlus className="h-5 w-5" />,
          path: '/admin/users',
          active: location.pathname === '/admin/users'
        },
        {
          title: 'Kelola Departemen',
          icon: <Building className="h-5 w-5" />,
          path: '/admin/departments',
          active: location.pathname === '/admin/departments'
        },
        {
          title: 'Kelola Jabatan',
          icon: <Briefcase className="h-5 w-5" />,
          path: '/admin/positions',
          active: location.pathname === '/admin/positions'
        },
        {
          title: 'Kelola Bank',
          icon: <Database className="h-5 w-5" />,
          path: '/admin/bank',
          active: location.pathname === '/admin/bank'
        }
      ]
    },
    {
      title: 'Kelola Absensi',
      icon: <Calendar className="h-5 w-5" />,
      path: '/admin/attendance',
      active: location.pathname === '/admin/attendance'
    },
    {
      title: 'Kelola Pembayaran',
      icon: <CreditCard className="h-5 w-5" />,
      path: '/admin/salary-payment',
      active: location.pathname === '/admin/salary-payment'
    },
    {
      title: 'Lokasi Kantor',
      icon: <MapPin className="h-5 w-5" />,
      path: '/admin/location',
      active: location.pathname === '/admin/location'
    }
  ];

  const [expandedMenus, setExpandedMenus] = useState(['Master Data']);

  const toggleSubmenu = (title) => {
    setExpandedMenus(prev => 
      prev.includes(title) 
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50 print:hidden">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-lg bg-white shadow-lg text-gray-600 hover:bg-gray-200 transition-colors"
        >
          {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile overlay */}
      <div 
        className={`lg:hidden fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileOpen(false)}
      ></div>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 bg-white shadow-2xl transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-16' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          max-w-xs lg:max-w-none print:hidden
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 bg-gradient-to-r from-tosca-700 to-tosca-600 text-white px-4">
            <div className="flex items-center">
              <Building className="h-7 w-7 flex-shrink-0" />
              {!isCollapsed && <span className="ml-2 text-lg font-semibold tracking-tight">Admin Panel</span>}
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:block p-1 rounded-full hover:bg-tosca-800 transition-colors"
            >
              <ChevronLeft className={`h-5 w-5 transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* User info */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center py-3' : 'px-4 py-4'} border-b border-gray-200 bg-gray-50/50`}>
            <div className="w-10 h-10 bg-tosca-100 rounded-full flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Users className="h-6 w-6 text-tosca-600" />
              )}
            </div>
            {!isCollapsed && (
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">{profile?.name || 'Admin'}</p>
                <p className="text-xs text-gray-500 truncate">{profile?.email || user?.email}</p>
              </div>
            )}
          </div>

          {/* Menu items */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.title}>
                  {item.submenu ? (
                    <div>
                      <button
                        onClick={() => toggleSubmenu(item.title)}
                        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-3'} py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200`}
                      >
                        <div className="flex items-center">
                          <span className="text-gray-500">{item.icon}</span>
                          {!isCollapsed && <span className="ml-3">{item.title}</span>}
                        </div>
                        {!isCollapsed && (
                          <ChevronLeft className={`h-4 w-4 text-gray-400 transform transition-transform duration-200 ${expandedMenus.includes(item.title) ? 'rotate-90' : ''}`} />
                        )}
                      </button>
                      {(!isCollapsed && expandedMenus.includes(item.title)) && (
                        <ul className="ml-4 space-y-1 mt-1">
                          {item.submenu.map((subItem) => (
                            <li key={subItem.path}>
                              <button
                                onClick={() => {
                                  navigate(subItem.path);
                                  if (window.innerWidth < 1024) setIsMobileOpen(false);
                                }}
                                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200
                                  ${subItem.active 
                                    ? 'text-tosca-600 bg-tosca-50 font-semibold'
                                    : 'text-gray-600 hover:bg-gray-100'}`}
                              >
                                <span className={`${subItem.active ? 'text-tosca-600' : 'text-gray-400'}`}>
                                  {subItem.icon}
                                </span>
                                <span className="ml-3">{subItem.title}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        navigate(item.path);
                        if (window.innerWidth < 1024) setIsMobileOpen(false);
                      }}
                      className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-3'} py-2.5 text-sm font-medium rounded-lg transition-colors duration-200
                        ${item.active 
                          ? 'text-tosca-600 bg-tosca-50 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <span className={`${item.active ? 'text-tosca-600' : 'text-gray-500'}`}>
                        {item.icon}
                      </span>
                      {!isCollapsed && <span className="ml-3">{item.title}</span>}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout button */}
          <div className="p-3 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-3'} py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200`}
            >
              <LogOut className="h-5 w-5" />
              {!isCollapsed && <span className="ml-3">Logout</span>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSidebar;