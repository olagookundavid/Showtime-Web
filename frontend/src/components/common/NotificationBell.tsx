import React, { useState, useEffect, useRef } from 'react';
import { notificationsApi, type NotificationData } from '../../services/api';
import toast from 'react-hot-toast';

export const NotificationBell: React.FC = () => {
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchUnread = async () => {
        try {
            const count = await notificationsApi.getUnreadCount();
            setUnreadCount(count);
        } catch {
            // silent fail
        }
    };

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await notificationsApi.getAll({ limit: 10 });
            setNotifications(res.data || []);
        } catch (err: any) {
            toast.error('Failed to load notifications');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id: string) => {
        try {
            await notificationsApi.markAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {
            // error
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await notificationsApi.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
            toast.success('All marked as read');
        } catch {
            toast.error('Failed to mark all as read');
        }
    };

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                id="notification-bell-btn"
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-sffl-red dark:hover:text-sffl-red transition-colors focus:outline-none"
                aria-label="Notifications"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-sffl-red rounded-full animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-80 sm:w-96 rounded-xl shadow-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 z-50 overflow-hidden backdrop-blur-md">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 text-xs font-semibold bg-sffl-red/10 text-sffl-red rounded-full">
                                    {unreadCount} unread
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-sffl-red hover:underline font-medium"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
                        {loading ? (
                            <div className="p-6 text-center text-gray-400 text-sm">Loading notifications...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm">No notifications yet.</div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer ${
                                        !n.is_read ? 'bg-sffl-red/5 dark:bg-sffl-red/10' : ''
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{n.title}</h4>
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">{n.message}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
