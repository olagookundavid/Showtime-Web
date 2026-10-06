import { useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckBadgeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import {
  getStoreProduct,
  getProductReviews,
  getMyProductReview,
  createProductReview,
  deleteAdminProductReview,
  type StoreProduct,
  type ReviewSort,
} from "../services/api";
import { StarRating } from "../components/store/StarRating";
import { Loader } from "../components/ui/Loader";
import { BackButton } from "../components/ui/BackButton";
import { Button, Field, Input, Select, Textarea } from "../components/ui";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ConfirmSummary } from "../components/ui/ConfirmSummary";

export const ProductReviewsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ReviewSort>("newest");

  // Form state for "leave a review"
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // Admin-only: the review waiting on the delete confirmation.
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    author: string;
    title?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: product, isLoading: loadingProduct } = useQuery<StoreProduct>({
    queryKey: ["storeProduct", id],
    queryFn: () => getStoreProduct(id!),
    enabled: !!id,
  });

  const { data: reviews, isLoading: loadingReviews } = useQuery({
    queryKey: ["productReviews", id, page, sort],
    queryFn: () => getProductReviews(id!, page, 10, sort),
    enabled: !!id,
  });

  // Check whether the current user has already left a review (controls the
  // form's "Submit a review" vs "Update your review" labeling, and pre-fills).
  const { data: myReview } = useQuery({
    queryKey: ["myProductReview", id],
    queryFn: () => getMyProductReview(id!),
    enabled: isAuthenticated && !!id,
  });

  if (!id) return <Navigate to="/store" replace />;

  // Pre-fill from existing review the first time it loads, but don't keep
  // overriding the user's in-progress edits.
  if (myReview && !prefilled) {
    setRating(myReview.rating);
    setTitle(myReview.title || "");
    setBody(myReview.body || "");
    setPrefilled(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    if (rating < 1) {
      setFormError("Please pick a star rating before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await createProductReview(id, {
        rating,
        title: title.trim(),
        body: body.trim(),
      });
      setFormSuccess(
        myReview ? "Your review has been updated." : "Thanks for your review!",
      );
      queryClient.invalidateQueries({ queryKey: ["productReviews", id] });
      queryClient.invalidateQueries({
        queryKey: ["productReviewsPreview", id],
      });
      queryClient.invalidateQueries({ queryKey: ["storeProduct", id] });
      queryClient.invalidateQueries({ queryKey: ["myProductReview", id] });
    } catch (err: unknown) {
      const errorResponse = err as {
        response?: { data?: { error?: string } };
      };
      setFormError(
        errorResponse.response?.data?.error ||
          (err instanceof Error ? err.message : undefined) ||
          "Failed to submit review.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="flex justify-center py-20">
        <Loader />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <p className="text-gray-500">Product not found.</p>
        <BackButton fallback="/store">Back to Store</BackButton>
      </div>
    );
  }

  const totalPages = reviews?.total_pages || 1;

  const handleDeleteReview = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteAdminProductReview(pendingDelete.id);
      queryClient.invalidateQueries({ queryKey: ["productReviews", id] });
      queryClient.invalidateQueries({
        queryKey: ["productReviewsPreview", id],
      });
      queryClient.invalidateQueries({ queryKey: ["storeProduct", id] });
      toast.success("Review deleted.");
      setPendingDelete(null);
    } catch (err: unknown) {
      const errorResponse = err as {
        response?: { data?: { error?: string } };
      };
      toast.error(
        errorResponse.response?.data?.error ||
          (err instanceof Error ? err.message : undefined) ||
          "Failed to delete review",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Breadcrumbs + Back Nav */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <BackButton fallback={`/store/products/${product.id}`} />
          <div className="flex items-center gap-2 min-w-0 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <Link
              to="/store"
              className="inline-flex items-center min-h-11 shrink-0 hover:text-sffl-red transition-colors"
            >
              Store
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              to={`/store/products/${product.id}`}
              className="inline-flex items-center min-h-11 min-w-0 hover:text-sffl-red transition-colors max-w-[40vw] md:max-w-md"
            >
              <span className="truncate">{product.name}</span>
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-900 dark:text-white shrink-0">
              Reviews
            </span>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase wrap-break-word">
          Reviews — {product.name}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left: summary + reviews list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            {product.rating_count > 0 ? (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black text-sffl-navy dark:text-white">
                    {(product.rating_avg ?? 0).toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-500">/ 5</span>
                </div>
                <div className="space-y-1">
                  <StarRating value={product.rating_avg ?? 0} size="md" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                    {product.rating_count} customer review
                    {product.rating_count === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No reviews yet for this product.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-gray-300">
              All Reviews
            </h2>
            <Select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as ReviewSort);
                setPage(1);
              }}
              aria-label="Sort reviews"
              className="w-auto"
            >
              <option value="newest">Newest</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
            </Select>
          </div>

          {loadingReviews ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : !reviews || reviews.data.length === 0 ? (
            <p className="text-sm text-gray-500 italic text-center py-8">
              No reviews to show.
            </p>
          ) : (
            <>
              <div className="space-y-4">
                {reviews.data.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-4 sm:p-5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap min-w-0">
                        <StarRating value={r.rating} size="sm" />
                        {r.title && (
                          <span className="font-black text-base text-sffl-navy dark:text-white wrap-break-word min-w-0">
                            {r.title}
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={TrashIcon}
                          onClick={() =>
                            setPendingDelete({
                              id: r.id,
                              author: r.user_name,
                              title: r.title || undefined,
                            })
                          }
                        >
                          Admin · Delete
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-bold flex-wrap">
                      <span className="min-w-0 break-all">{r.user_name}</span>
                      {r.verified_purchase && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <span aria-hidden="true">·</span>
                          <CheckBadgeIcon
                            className="w-4 h-4"
                            aria-hidden="true"
                          />
                          Verified Purchase
                        </span>
                      )}
                      <span className="text-gray-400">
                        · {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {r.body && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line pt-1 wrap-break-word">
                        {r.body}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-between items-center gap-2 pt-4 border-t dark:border-gray-700">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ChevronLeftIcon}
                    aria-label="Previous page"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <span className="text-xs text-gray-500 font-bold">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ChevronRightIcon}
                    iconPosition="right"
                    aria-label="Next page"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <span className="hidden sm:inline">Next</span>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: leave a review form. Verified-purchase gate is enforced
                    server-side; here we just guide the user to log in. */}
        <div className="space-y-4 lg:sticky lg:top-[calc(var(--chrome-h,8rem)+1rem)]">
          <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-gray-300">
              {myReview ? "Update Your Review" : "Leave a Review"}
            </h2>

            {!isAuthenticated ? (
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3">
                <p>
                  You need to be logged in (and have purchased this item) to
                  leave a review.
                </p>
                <Link
                  to={`/login?redirect=${encodeURIComponent(`/store/products/${product.id}/reviews`)}`}
                  className="inline-flex items-center justify-center min-h-11 bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full transition-all"
                >
                  Log in to review
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider block">
                    Your rating
                  </label>
                  <StarRating value={rating} onChange={setRating} size="lg" />
                </div>

                <Field label="Headline (optional)" htmlFor="review-title">
                  <Input
                    id="review-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Fits great, fast delivery"
                    maxLength={120}
                  />
                </Field>

                <Field label="Review (optional)" htmlFor="review-body">
                  <Textarea
                    id="review-body"
                    rows={5}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="What did you like or dislike? How was the fit and material?"
                  />
                </Field>

                {formError && (
                  <div
                    role="alert"
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-bold px-4 py-3 rounded-xl"
                  >
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div
                    role="status"
                    className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-4 py-3 rounded-xl"
                  >
                    {formSuccess}
                  </div>
                )}

                <Button type="submit" fullWidth size="lg" loading={submitting}>
                  {submitting
                    ? "Saving…"
                    : myReview
                      ? "Update Review"
                      : "Submit Review"}
                </Button>

                <div className="flex items-start gap-2 bg-sffl-navy/5 dark:bg-sffl-navy/30 border border-sffl-navy/15 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-sffl-navy dark:text-gray-200 leading-relaxed">
                  <InformationCircleIcon
                    className="w-4 h-4 mt-0.5 shrink-0 text-sffl-red"
                    aria-hidden="true"
                  />
                  <p>
                    Only customers who have purchased this product can leave a
                    review. Your name appears as your first name + last initial
                    (e.g. <span className="font-bold">"John D."</span>).
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this review?"
        description="The review is removed from the product page for good. This can't be undone."
        body={
          pendingDelete && (
            <ConfirmSummary
              rows={[
                ["Product", product.name],
                ["Reviewer", pendingDelete.author],
                ["Headline", pendingDelete.title],
              ]}
            />
          )
        }
        confirmLabel="Delete review"
        tone="warning"
        icon={TrashIcon}
        pending={deleting}
        onConfirm={handleDeleteReview}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
