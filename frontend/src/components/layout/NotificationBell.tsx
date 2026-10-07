import React, { useState, useEffect, useRef } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../../services/api';
import type { NotificationData } from '../../types';
import toast from 'react-hot-toast';
import { Button } from '../ui';
import { Spinner } from '../ui/Spinner';

/**
 * The top-bar bell: an unread count, and a dropdown of the latest notifications.
 * Opening one marks it read. Marking read needs no confirm (frontend/CLAUDE.md §2).
 * On phones the dropdown spans the screen under the top bar so it can't run off
 * the edge; from 640px up it hangs under the bell.
 */
/** Where a notification leads, if it is about something with its own page. */
const notificationLink = (n: NotificationData): string | null => {
    if (n.reference_type === 'potw_poll' && n.reference_id) return `/potw/${n.reference_id}`;
    return null;
};

interface NotificationBellProps {
    /** White icon for the navy public navbar; grey for light dashboard top bars. */
    onDark?: boolean;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onDark = false }) => {
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

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
        } catch {
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

    // Close on an outside tap, or on Escape (focus goes back to the bell).
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleMarkAsRead = async (id: string) => {
        try {
            await notificationsApi.markAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {
            // error
        }
    };

    // A notification about something with its own page opens it; others are
    // just marked read.
    const handleOpen = (n: NotificationData) => {
        if (!n.is_read) void handleMarkAsRead(n.id);
        const target = notificationLink(n);
        if (target) {
            setIsOpen(false);
            navigate(target);
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
        <div className="sm:relative shrink-0" ref={dropdownRef}>
            <button
                ref={triggerRef}
                id="notification-bell-btn"
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
                className={`relative inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg transition-colors outline-none focus-visible:ring-2 ${
                    onDark
                        ? 'text-white hover:bg-white/10 hover:text-sffl-red focus-visible:ring-white/60'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-sffl-red dark:text-gray-300 dark:hover:bg-white/10 focus-visible:ring-sffl-red/40'
                }`}
            >
                <BellIcon className="w-5 h-5" aria-hidden="true" />
                {unreadCount > 0 && (
                    <span
                        aria-hidden="true"
                        className="absolute top-1 right-0.5 inline-flex items-center justify-center min-w-4.5 px-1 py-0.5 text-[10px] font-bold leading-none text-white bg-sffl-red rounded-full animate-pulse"
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="fixed inset-x-2 top-17 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 rounded-xl shadow-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-x-2 bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2 min-h-11">
                            <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 text-xs font-semibold bg-sffl-red/10 text-sffl-red rounded-full">
                                    {unreadCount} unread
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <Button variant="link" size="sm" className="-mr-2" onClick={handleMarkAllRead}>
                                Mark all read
                            </Button>
                        )}
                    </div>

                    <div className="max-h-[min(20rem,calc(100dvh-10rem))] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
                        {loading ? (
                            <Spinner label="Loading notifications" size="sm" className="py-6" />
                        ) : notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm">No notifications yet.</div>
                        ) : (
                            notifications.map(n => (
                                <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => handleOpen(n)}
                                    className={`block w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-gray-700/40 ${
                                        !n.is_read ? 'bg-sffl-red/5 dark:bg-sffl-red/10' : ''
                                    }`}
                                >
                                    <span className="flex items-start justify-between gap-2">
                                        <span className="min-w-0 text-sm font-semibold text-gray-900 dark:text-white wrap-break-word">{n.title}</span>
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </span>
                                    <span className="block text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed wrap-break-word">{n.message}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
