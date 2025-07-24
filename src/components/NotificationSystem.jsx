import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, AlertTriangle, Clock, FileText, User, Calendar } from 'lucide-react';
import { supabase } from '../hooks/supabaseClient';

const NotificationSystem = ({ userId, userRole }) => {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      
      // Subscribe to real-time notifications
      const subscription = supabase
        .channel('notifications')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          }, 
          (payload) => {
            setNotifications(prev => [payload.new, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'late_warning':
        return <Clock className="h-5 w-5 text-orange-500" />;
      case 'absence_warning':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'salary_info':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'system_alert':
        return <FileText className="h-5 w-5 text-tosca-500" />;
      case 'general':
        return <User className="h-5 w-5 text-gray-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'late_warning':
        return 'border-l-orange-400 bg-orange-50';
      case 'absence_warning':
        return 'border-l-red-400 bg-red-50';
      case 'salary_info':
        return 'border-l-green-400 bg-green-50';
      case 'system_alert':
        return 'border-l-tosca-400 bg-tosca-50';
      case 'general':
        return 'border-l-gray-400 bg-gray-50';
      default:
        return 'border-l-gray-400 bg-gray-50';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return diffInMinutes <= 1 ? 'Baru saja' : `${diffInMinutes} menit yang lalu`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} jam yang lalu`;
    } else {
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors group"
      >
        <Bell className="h-6 w-6 group-hover:scale-110 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {showNotifications && (
        <>
          {/* Mobile overlay */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setShowNotifications(false)}
          />
          
          <div className="fixed md:absolute right-0 mt-2 w-full md:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[80vh] md:max-h-96 overflow-hidden md:top-auto bottom-0 md:bottom-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-tosca-50 to-tosca-100">
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-tosca-600" />
                <h3 className="text-lg font-semibold text-gray-900">Notifikasi</h3>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-tosca-600 hover:text-tosca-800 font-medium transition-colors"
                  >
                    Tandai semua dibaca
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-[calc(80vh-120px)] md:max-h-80 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-l-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.is_read ? getNotificationColor(notification.type) : 'border-l-gray-200 bg-white'
                    }`}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-sm font-medium ${
                            !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-tosca-500 rounded-full animate-pulse"></div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatTime(notification.created_at)}
                          </p>
                          {notification.data?.letter_number && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {notification.data.letter_number}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">Tidak ada notifikasi</p>
                  <p className="text-gray-400 text-sm mt-1">Notifikasi akan muncul di sini</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
                <button className="text-sm text-tosca-600 hover:text-tosca-800 font-medium transition-colors">
                  Lihat semua notifikasi
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationSystem;