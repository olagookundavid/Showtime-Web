import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { commentsApi, COMMENTS_PAGE_SIZE, type CommentData } from '../../services/api';
import { AuthPromptModal } from './AuthPromptModal';
import toast from 'react-hot-toast';
import {
    HeartIcon as HeartIconOutline,
    ChatBubbleLeftIcon,
    TrashIcon,
    PaperAirplaneIcon,
    UserCircleIcon,
    LockClosedIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

interface CommentSectionProps {
    entityType: 'news' | 'match';
    entityId: string;
    commentsEnabled?: boolean;
}

function timeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const CommentSection: React.FC<CommentSectionProps> = ({
    entityType,
    entityId,
    commentsEnabled = true,
}) => {
    const { user, isAuthenticated } = useAuth();
    const location = useLocation();

    const [comments, setComments] = useState<CommentData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [content, setContent] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Pagination covers top-level comments only — replies always arrive with
    // their parent. `totalCount` includes replies and is what the header shows.
    const [page, setPage] = useState<number>(1);
    const [hasMore, setHasMore] = useState<boolean>(false);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [totalTopLevel, setTotalTopLevel] = useState<number>(0);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);

    // Reply state
    const [replyToId, setReplyToId] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState<string>('');
    const [submittingReply, setSubmittingReply] = useState<boolean>(false);

    // Auth Modal State
    const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
    const [authActionText, setAuthActionText] = useState<string>('join the discussion');

    const currentUrl = `${location.pathname}${location.search}${location.hash}`;

    const fetchFirstPage = async () => {
        if (!entityId) return;
        setLoading(true);
        try {
            const result = await commentsApi.getComments(entityType, entityId, 1, COMMENTS_PAGE_SIZE);
            setComments(result.data);
            setPage(result.page);
            setHasMore(result.has_more);
            setTotalCount(result.total_all);
            setTotalTopLevel(result.total);
        } catch {
            // Quiet failure
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        if (!entityId || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const next = page + 1;
            const result = await commentsApi.getComments(entityType, entityId, next, COMMENTS_PAGE_SIZE);
            // A comment posted since page 1 loaded shifts every offset by one, so
            // the next page can repeat a row we already have. De-duping by id is
            // cheaper than re-fetching the whole thread to stay consistent.
            setComments(prev => {
                const seen = new Set(prev.map(c => c.id));
                return [...prev, ...result.data.filter(c => !seen.has(c.id))];
            });
            setPage(result.page);
            setHasMore(result.has_more);
            setTotalCount(result.total_all);
            setTotalTopLevel(result.total);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to load more comments');
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchFirstPage();
    }, [entityType, entityId]);

    const requireAuth = (actionDescription: string): boolean => {
        if (!isAuthenticated) {
            setAuthActionText(actionDescription);
            setAuthModalOpen(true);
            return false;
        }
        return true;
    };

    const handleCreateComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requireAuth('post a comment')) return;

        const trimmed = content.trim();
        if (!trimmed) return;

        setSubmitting(true);
        try {
            const newComment = await commentsApi.createComment({
                entity_type: entityType,
                entity_id: entityId,
                content: trimmed,
            });
            // Newest-first ordering, so a fresh comment belongs at the top.
            setComments(prev => [newComment, ...prev]);
            setTotalCount(t => t + 1);
            setContent('');
            toast.success('Comment posted!');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to post comment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateReply = async (parentId: string) => {
        if (!requireAuth('reply to this comment')) return;

        const trimmed = replyContent.trim();
        if (!trimmed) return;

        setSubmittingReply(true);
        try {
            const newReply = await commentsApi.createComment({
                entity_type: entityType,
                entity_id: entityId,
                content: trimmed,
                parent_id: parentId,
            });

            // Update local comments tree
            setComments(prev =>
                prev.map(c => {
                    if (c.id === parentId) {
                        return { ...c, replies: [...(c.replies || []), newReply] };
                    }
                    return c;
                })
            );

            setTotalCount(t => t + 1);
            setReplyToId(null);
            setReplyContent('');
            toast.success('Reply posted!');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to post reply');
        } finally {
            setSubmittingReply(false);
        }
    };

    const handleToggleLike = async (commentId: string, isReply = false, parentId?: string) => {
        if (!requireAuth('like comments')) return;

        try {
            const result = await commentsApi.likeComment(commentId);

            if (!isReply) {
                setComments(prev =>
                    prev.map(c =>
                        c.id === commentId
                            ? { ...c, is_liked_by_caller: result.liked, likes_count: result.likes_count }
                            : c
                    )
                );
            } else if (parentId) {
                setComments(prev =>
                    prev.map(c => {
                        if (c.id === parentId) {
                            return {
                                ...c,
                                replies: c.replies.map(r =>
                                    r.id === commentId
                                        ? { ...r, is_liked_by_caller: result.liked, likes_count: result.likes_count }
                                        : r
                                ),
                            };
                        }
                        return c;
                    })
                );
            }
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to like comment');
        }
    };

    const handleDelete = async (commentId: string, isReply = false, parentId?: string) => {
        if (!confirm('Are you sure you want to delete this comment?')) return;

        try {
            await commentsApi.deleteComment(commentId);
            toast.success('Comment deleted');

            if (!isReply) {
                // Deleting a parent cascades its replies in the database, so the
                // thread count drops by the whole subtree.
                const removed = comments.find(c => c.id === commentId);
                setTotalCount(t => Math.max(0, t - 1 - (removed?.replies?.length || 0)));
                setComments(prev => prev.filter(c => c.id !== commentId));
            } else if (parentId) {
                setTotalCount(t => Math.max(0, t - 1));
                setComments(prev =>
                    prev.map(c => {
                        if (c.id === parentId) {
                            return {
                                ...c,
                                replies: c.replies.filter(r => r.id !== commentId),
                            };
                        }
                        return c;
                    })
                );
            }
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to delete comment');
        }
    };

    if (!commentsEnabled) {
        return (
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700/60 my-6">
                <LockClosedIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="font-bold text-gray-600 dark:text-gray-300">Comments Disabled</p>
                <p className="text-xs text-gray-400 mt-1">Comments have been turned off for this item.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 my-8">
            <AuthPromptModal
                isOpen={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
                returnUrl={currentUrl}
                actionText={authActionText}
            />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700/80 pb-4">
                <h3 className="text-xl font-black text-sffl-navy dark:text-white flex items-center gap-2">
                    <ChatBubbleLeftIcon className="w-5 h-5 text-sffl-red" />
                    <span>Discussions & Comments</span>
                    <span className="bg-sffl-red/10 text-sffl-red text-xs px-2.5 py-0.5 rounded-full font-extrabold ml-1">
                        {totalCount}
                    </span>
                </h3>
            </div>

            {/* Comment Form Input */}
            <form onSubmit={handleCreateComment} className="space-y-3">
                <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm focus-within:ring-2 focus-within:ring-sffl-red transition-all">
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        onFocus={() => {
                            if (!isAuthenticated) requireAuth('post a comment');
                        }}
                        placeholder={
                            isAuthenticated
                                ? `Share your thoughts as ${user?.name || 'a fan'}...`
                                : 'Sign in to join the discussion...'
                        }
                        rows={3}
                        maxLength={1000}
                        className="w-full p-4 bg-transparent border-0 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none resize-none"
                    />

                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-2xl">
                        <span className="text-[11px] text-gray-400 font-semibold">
                            {content.length}/1000 characters
                        </span>

                        <button
                            type="submit"
                            disabled={submitting || !content.trim()}
                            className="inline-flex items-center gap-2 bg-sffl-red hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <PaperAirplaneIcon className="w-3.5 h-3.5" />
                            <span>{submitting ? 'Posting...' : 'Post Comment'}</span>
                        </button>
                    </div>
                </div>
            </form>

            {/* Comments List */}
            {loading ? (
                <div className="py-12 flex justify-center">
                    <div className="w-8 h-8 border-4 border-sffl-red border-t-transparent rounded-full animate-spin" />
                </div>
            ) : comments.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-10 text-center border border-gray-200 dark:border-gray-700 shadow-sm">
                    <ChatBubbleLeftIcon className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="font-bold text-gray-700 dark:text-gray-300 text-base">No comments yet</p>
                    <p className="text-xs text-gray-400 mt-1">Be the first to share your thoughts on this!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {comments.map(c => {
                        const isOwner = user && user.id === c.user_id;
                        const isAdmin = user && (user.role === 'admin' || user.role === 'app_admin');
                        const canDelete = isOwner || isAdmin;

                        return (
                            <div
                                key={c.id}
                                className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700/80 shadow-sm space-y-4"
                            >
                                {/* Comment Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-sffl-navy/10 dark:bg-gray-700 flex items-center justify-center text-sffl-navy dark:text-gray-300 font-black text-sm flex-shrink-0">
                                            {c.user_full_name ? c.user_full_name.charAt(0).toUpperCase() : <UserCircleIcon className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-extrabold text-sm text-gray-900 dark:text-white">
                                                    {c.user_full_name}
                                                </span>
                                                {c.user_role === 'admin' || c.user_role === 'app_admin' ? (
                                                    <span className="bg-sffl-red/10 text-sffl-red text-[10px] font-black uppercase px-2 py-0.5 rounded">
                                                        Admin
                                                    </span>
                                                ) : null}
                                            </div>
                                            <span className="text-[11px] text-gray-400 font-medium">
                                                {timeAgo(c.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    {canDelete && (
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded-lg transition-colors"
                                            title="Delete Comment"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Comment Content */}
                                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line pl-13">
                                    {c.content}
                                </p>

                                {/* Comment Actions Bar */}
                                <div className="flex items-center gap-4 pt-1 text-xs">
                                    <button
                                        onClick={() => handleToggleLike(c.id)}
                                        className={`flex items-center gap-1.5 font-bold transition-colors ${
                                            c.is_liked_by_caller
                                                ? 'text-sffl-red'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-sffl-red'
                                        }`}
                                    >
                                        {c.is_liked_by_caller ? (
                                            <HeartIconSolid className="w-4 h-4 text-sffl-red" />
                                        ) : (
                                            <HeartIconOutline className="w-4 h-4" />
                                        )}
                                        <span>{c.likes_count > 0 ? c.likes_count : 'Like'}</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (replyToId === c.id) {
                                                setReplyToId(null);
                                            } else {
                                                if (!requireAuth('reply to this comment')) return;
                                                setReplyToId(c.id);
                                                setReplyContent('');
                                            }
                                        }}
                                        className="flex items-center gap-1.5 font-bold text-gray-500 dark:text-gray-400 hover:text-sffl-navy dark:hover:text-white transition-colors"
                                    >
                                        <ChatBubbleLeftIcon className="w-4 h-4" />
                                        <span>Reply</span>
                                    </button>
                                </div>

                                {/* Reply Input Box */}
                                {replyToId === c.id && (
                                    <div className="mt-3 pl-4 border-l-2 border-sffl-red space-y-2 pt-2 animate-in fade-in">
                                        <textarea
                                            value={replyContent}
                                            onChange={e => setReplyContent(e.target.value)}
                                            placeholder={`Replying to ${c.user_full_name}...`}
                                            rows={2}
                                            maxLength={1000}
                                            className="w-full p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sffl-red resize-none"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setReplyToId(null)}
                                                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-gray-200 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCreateReply(c.id)}
                                                disabled={submittingReply || !replyContent.trim()}
                                                className="px-4 py-1.5 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-40"
                                            >
                                                {submittingReply ? 'Replying...' : 'Post Reply'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Nested Replies (1 Level) */}
                                {c.replies && c.replies.length > 0 && (
                                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 pl-6 space-y-3 border-l-2 border-gray-200 dark:border-gray-700 ml-2">
                                        {c.replies.map(r => {
                                            const isReplyOwner = user && user.id === r.user_id;
                                            const canDeleteReply = isReplyOwner || isAdmin;

                                            return (
                                                <div key={r.id} className="space-y-2 bg-gray-50/50 dark:bg-gray-700/30 p-3.5 rounded-xl">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-sffl-navy/10 dark:bg-gray-600 flex items-center justify-center text-sffl-navy dark:text-gray-200 font-black text-xs">
                                                                {r.user_full_name ? r.user_full_name.charAt(0).toUpperCase() : '?'}
                                                            </div>
                                                            <span className="font-bold text-xs text-gray-900 dark:text-white">
                                                                {r.user_full_name}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400">
                                                                {timeAgo(r.created_at)}
                                                            </span>
                                                        </div>

                                                        {canDeleteReply && (
                                                            <button
                                                                onClick={() => handleDelete(r.id, true, c.id)}
                                                                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded-lg"
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                                                        {r.content}
                                                    </p>

                                                    <div className="flex items-center gap-3 pt-0.5 text-[11px]">
                                                        <button
                                                            onClick={() => handleToggleLike(r.id, true, c.id)}
                                                            className={`flex items-center gap-1 font-bold ${
                                                                r.is_liked_by_caller
                                                                    ? 'text-sffl-red'
                                                                    : 'text-gray-400 hover:text-sffl-red'
                                                            }`}
                                                        >
                                                            {r.is_liked_by_caller ? (
                                                                <HeartIconSolid className="w-3.5 h-3.5 text-sffl-red" />
                                                            ) : (
                                                                <HeartIconOutline className="w-3.5 h-3.5" />
                                                            )}
                                                            <span>{r.likes_count > 0 ? r.likes_count : 'Like'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Load more: newest page first, older batches on demand. */}
            {!loading && hasMore && (
                <div className="flex flex-col items-center gap-2 pt-1">
                    <button
                        type="button"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-sffl-navy dark:text-gray-200 font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronDownIcon className={`w-4 h-4 ${loadingMore ? 'animate-bounce' : ''}`} />
                        <span>{loadingMore ? 'Loading...' : 'View more comments'}</span>
                    </button>
                    <span className="text-[11px] text-gray-400 font-semibold">
                        Showing {comments.length} of {totalTopLevel} comments
                    </span>
                </div>
            )}
        </div>
    );
};
