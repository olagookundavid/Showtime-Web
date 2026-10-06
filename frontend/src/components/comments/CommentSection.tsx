import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  commentsApi,
  COMMENTS_PAGE_SIZE,
  type CommentData,
} from "../../services/api";
import { AuthRequiredDialog } from "../auth/AuthRequiredDialog";
import toast from "react-hot-toast";
import { Button, IconButton, Textarea } from "../ui";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ConfirmSummary } from "../ui/ConfirmSummary";
import { Spinner } from "../ui/Spinner";
import {
  HeartIcon as HeartIconOutline,
  ChatBubbleLeftIcon,
  TrashIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  LockClosedIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";

interface CommentSectionProps {
  entityType: "news" | "match";
  entityId: string;
  commentsEnabled?: boolean;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const [content, setContent] = useState<string>("");
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
  const [replyContent, setReplyContent] = useState<string>("");
  const [submittingReply, setSubmittingReply] = useState<boolean>(false);

  // Delete confirmation: the comment (or reply) waiting on the dialog.
  const [pendingDelete, setPendingDelete] = useState<{
    commentId: string;
    isReply: boolean;
    parentId?: string;
    author: string;
    excerpt: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authActionText, setAuthActionText] = useState<string>(
    "join the discussion",
  );

  const currentUrl = `${location.pathname}${location.search}${location.hash}`;

  const fetchFirstPage = async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const result = await commentsApi.getComments(
        entityType,
        entityId,
        1,
        COMMENTS_PAGE_SIZE,
      );
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
      const result = await commentsApi.getComments(
        entityType,
        entityId,
        next,
        COMMENTS_PAGE_SIZE,
      );
      // A comment posted since page 1 loaded shifts every offset by one, so
      // the next page can repeat a row we already have. De-duping by id is
      // cheaper than re-fetching the whole thread to stay consistent.
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...result.data.filter((c) => !seen.has(c.id))];
      });
      setPage(result.page);
      setHasMore(result.has_more);
      setTotalCount(result.total_all);
      setTotalTopLevel(result.total);
    } catch (err: unknown) {
      const errorMessage =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      toast.error(errorMessage || "Failed to load more comments");
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
    if (!requireAuth("post a comment")) return;

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
      setComments((prev) => [newComment, ...prev]);
      setTotalCount((t) => t + 1);
      setContent("");
      toast.success("Comment posted!");
    } catch (err: unknown) {
      const errorMessage =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      toast.error(errorMessage || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateReply = async (parentId: string) => {
    if (!requireAuth("reply to this comment")) return;

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
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentId) {
            return { ...c, replies: [...(c.replies || []), newReply] };
          }
          return c;
        }),
      );

      setTotalCount((t) => t + 1);
      setReplyToId(null);
      setReplyContent("");
      toast.success("Reply posted!");
    } catch (err: unknown) {
      const errorMessage =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      toast.error(errorMessage || "Failed to post reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleToggleLike = async (
    commentId: string,
    isReply = false,
    parentId?: string,
  ) => {
    if (!requireAuth("like comments")) return;

    try {
      const result = await commentsApi.likeComment(commentId);

      if (!isReply) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  is_liked_by_caller: result.liked,
                  likes_count: result.likes_count,
                }
              : c,
          ),
        );
      } else if (parentId) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === commentId
                    ? {
                        ...r,
                        is_liked_by_caller: result.liked,
                        likes_count: result.likes_count,
                      }
                    : r,
                ),
              };
            }
            return c;
          }),
        );
      }
    } catch (err: unknown) {
      const errorMessage =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      toast.error(errorMessage || "Failed to like comment");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const { commentId, isReply, parentId } = pendingDelete;
    setDeleting(true);
    try {
      await commentsApi.deleteComment(commentId);
      toast.success("Comment deleted");

      if (!isReply) {
        // Deleting a parent cascades its replies in the database, so the
        // thread count drops by the whole subtree.
        const removed = comments.find((c) => c.id === commentId);
        setTotalCount((t) =>
          Math.max(0, t - 1 - (removed?.replies?.length || 0)),
        );
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } else if (parentId) {
        setTotalCount((t) => Math.max(0, t - 1));
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: c.replies.filter((r) => r.id !== commentId),
              };
            }
            return c;
          }),
        );
      }
      setPendingDelete(null);
    } catch (err: unknown) {
      const errorMessage =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      toast.error(errorMessage || "Failed to delete comment");
    } finally {
      setDeleting(false);
    }
  };

  if (!commentsEnabled) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700/60 my-6">
        <LockClosedIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p className="font-bold text-gray-600 dark:text-gray-300">
          Comments Disabled
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Comments have been turned off for this item.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 my-8">
      <AuthRequiredDialog
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        returnUrl={currentUrl}
        actionText={authActionText}
        closeLabel="Cancel"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700/80 pb-4">
        <h3 className="text-lg sm:text-xl font-black text-sffl-navy dark:text-white flex flex-wrap items-center gap-2">
          <ChatBubbleLeftIcon
            className="w-5 h-5 text-sffl-red"
            aria-hidden="true"
          />
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
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => {
              if (!isAuthenticated) requireAuth("post a comment");
            }}
            placeholder={
              isAuthenticated
                ? `Share your thoughts as ${user?.name || "a fan"}...`
                : "Sign in to join the discussion..."
            }
            rows={3}
            maxLength={1000}
            className="w-full p-4 bg-transparent border-0 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none resize-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-2xl">
            <span className="text-[11px] text-gray-400 font-semibold">
              {content.length}/1000 characters
            </span>

            <Button
              type="submit"
              size="sm"
              icon={PaperAirplaneIcon}
              loading={submitting}
              disabled={!content.trim()}
            >
              {submitting ? "Posting…" : "Post Comment"}
            </Button>
          </div>
        </div>
      </form>

      {/* Comments List */}
      {loading ? (
        <Spinner label="Loading comments…" className="py-12" />
      ) : comments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-10 text-center border border-gray-200 dark:border-gray-700 shadow-sm">
          <ChatBubbleLeftIcon className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="font-bold text-gray-700 dark:text-gray-300 text-base">
            No comments yet
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Be the first to share your thoughts on this!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => {
            const isOwner = user && user.id === c.user_id;
            const isAdmin =
              user && (user.role === "admin" || user.role === "app_admin");
            const canDelete = isOwner || isAdmin;

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700/80 shadow-sm space-y-4"
              >
                {/* Comment Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-sffl-navy/10 dark:bg-gray-700 flex items-center justify-center text-sffl-navy dark:text-gray-300 font-black text-sm shrink-0">
                      {c.user_full_name ? (
                        c.user_full_name.charAt(0).toUpperCase()
                      ) : (
                        <UserCircleIcon className="w-6 h-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-extrabold text-sm text-gray-900 dark:text-white truncate">
                          {c.user_full_name}
                        </span>
                        {c.user_role === "admin" ||
                        c.user_role === "app_admin" ? (
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
                    <IconButton
                      variant="danger"
                      icon={TrashIcon}
                      label="Delete comment"
                      className="-mr-2 -mt-2 shrink-0"
                      onClick={() =>
                        setPendingDelete({
                          commentId: c.id,
                          isReply: false,
                          author: c.user_full_name,
                          excerpt: c.content,
                        })
                      }
                    />
                  )}
                </div>

                {/* Comment Content */}
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line wrap-break-word sm:pl-13">
                  {c.content}
                </p>

                {/* Comment Actions Bar */}
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2"
                    icon={c.is_liked_by_caller ? HeartIconSolid : HeartIconOutline}
                    aria-pressed={c.is_liked_by_caller}
                    onClick={() => handleToggleLike(c.id)}
                  >
                    {c.likes_count > 0 ? c.likes_count : "Like"}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={ChatBubbleLeftIcon}
                    aria-expanded={replyToId === c.id}
                    onClick={() => {
                      if (replyToId === c.id) {
                        setReplyToId(null);
                      } else {
                        if (!requireAuth("reply to this comment")) return;
                        setReplyToId(c.id);
                        setReplyContent("");
                      }
                    }}
                  >
                    Reply
                  </Button>
                </div>

                {/* Reply Input Box */}
                {replyToId === c.id && (
                  <div className="mt-3 pl-4 border-l-2 border-sffl-red space-y-2 pt-2 animate-in fade-in">
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      aria-label={`Reply to ${c.user_full_name}`}
                      placeholder={`Replying to ${c.user_full_name}...`}
                      rows={2}
                      maxLength={1000}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setReplyToId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        loading={submittingReply}
                        disabled={!replyContent.trim()}
                        onClick={() => handleCreateReply(c.id)}
                      >
                        {submittingReply ? "Replying…" : "Post Reply"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Nested Replies (1 Level) */}
                {c.replies && c.replies.length > 0 && (
                  <div className="pt-3 border-t pl-3 sm:pl-6 space-y-3 border-l-2 border-gray-200 dark:border-gray-700 ml-1 sm:ml-2">
                    {c.replies.map((r) => {
                      const isReplyOwner = user && user.id === r.user_id;
                      const canDeleteReply = isReplyOwner || isAdmin;

                      return (
                        <div
                          key={r.id}
                          className="space-y-2 bg-gray-50/50 dark:bg-gray-700/30 p-3.5 rounded-xl"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                              <div className="w-7 h-7 shrink-0 rounded-full bg-sffl-navy/10 dark:bg-gray-600 flex items-center justify-center text-sffl-navy dark:text-gray-200 font-black text-xs">
                                {r.user_full_name ? (
                                  r.user_full_name.charAt(0).toUpperCase()
                                ) : (
                                  <UserCircleIcon
                                    className="w-5 h-5"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                              <span className="min-w-0 truncate font-bold text-xs text-gray-900 dark:text-white">
                                {r.user_full_name}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {timeAgo(r.created_at)}
                              </span>
                            </div>

                            {canDeleteReply && (
                              <IconButton
                                variant="danger"
                                icon={TrashIcon}
                                label="Delete reply"
                                className="-mr-2 shrink-0"
                                onClick={() =>
                                  setPendingDelete({
                                    commentId: r.id,
                                    isReply: true,
                                    parentId: c.id,
                                    author: r.user_full_name,
                                    excerpt: r.content,
                                  })
                                }
                              />
                            )}
                          </div>

                          <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line wrap-break-word">
                            {r.content}
                          </p>

                          <div className="flex items-center gap-3 pt-0.5 text-[11px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-ml-2"
                              icon={r.is_liked_by_caller ? HeartIconSolid : HeartIconOutline}
                              aria-pressed={r.is_liked_by_caller}
                              onClick={() => handleToggleLike(r.id, true, c.id)}
                            >
                              {r.likes_count > 0 ? r.likes_count : "Like"}
                            </Button>
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
          <Button
            variant="secondary"
            icon={ChevronDownIcon}
            loading={loadingMore}
            onClick={loadMore}
          >
            {loadingMore ? "Loading…" : "View more comments"}
          </Button>
          <span className="text-[11px] text-gray-400 font-semibold">
            Showing {comments.length} of {totalTopLevel} comments
          </span>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={
          pendingDelete?.isReply ? "Delete this reply?" : "Delete this comment?"
        }
        description={
          pendingDelete?.isReply
            ? "It's removed from the discussion for good."
            : "It's removed from the discussion for good, along with any replies to it."
        }
        body={
          pendingDelete && (
            <ConfirmSummary
              rows={[
                ["Posted by", pendingDelete.author],
                [
                  "Comment",
                  pendingDelete.excerpt.length > 120
                    ? `${pendingDelete.excerpt.slice(0, 120)}…`
                    : pendingDelete.excerpt,
                ],
              ]}
            />
          )
        }
        confirmLabel="Delete"
        tone="warning"
        icon={TrashIcon}
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
