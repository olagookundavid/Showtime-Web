import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import {
    getStoreProduct,
    getProductReviews,
    getMyProductReview,
    createProductReview,
    deleteAdminProductReview,
    type StoreProduct,
    type ReviewSort,
} from '../services/api';
import { StarRating } from '../components/store/StarRating';
import { Loader } from '../components/ui/Loader';

export const ProductReviewsPage = () => {
    const { id } = useParams<{ id: string }>();
    const { isAuthenticated, user } = useAuth();
    const queryClient = useQueryClient();
    const isAdmin = user?.role === 'admin';

    const [page, setPage] = useState(1);
    const [sort, setSort] = useState<ReviewSort>('newest');

    // Form state for "leave a review"
    const [rating, setRating] = useState(0);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    if (!id) return <Navigate to="/store" replace />;

    const { data: product, isLoading: loadingProduct } = useQuery<StoreProduct>({
        queryKey: ['storeProduct', id],
        queryFn: () => getStoreProduct(id),
    });

    const { data: reviews, isLoading: loadingReviews } = useQuery({
        queryKey: ['productReviews', id, page, sort],
        queryFn: () => getProductReviews(id, page, 10, sort),
    });

    // Check whether the current user has already left a review (controls the
    // form's "Submit a review" vs "Update your review" labeling, and pre-fills).
    const { data: myReview } = useQuery({
        queryKey: ['myProductReview', id],
        queryFn: () => getMyProductReview(id),
        enabled: isAuthenticated,
    });

    // Pre-fill from existing review the first time it loads, but don't keep
    // overriding the user's in-progress edits.
    const [prefilled, setPrefilled] = useState(false);
    if (myReview && !prefilled) {
        setRating(myReview.rating);
        setTitle(myReview.title || '');
        setBody(myReview.body || '');
        setPrefilled(true);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');
        if (rating < 1) {
            setFormError('Please pick a star rating before submitting.');
            return;
        }
        setSubmitting(true);
        try {
            await createProductReview(id, { rating, title: title.trim(), body: body.trim() });
            setFormSuccess(myReview ? 'Your review has been updated.' : 'Thanks for your review!');
            queryClient.invalidateQueries({ queryKey: ['productReviews', id] });
            queryClient.invalidateQueries({ queryKey: ['productReviewsPreview', id] });
            queryClient.invalidateQueries({ queryKey: ['storeProduct', id] });
            queryClient.invalidateQueries({ queryKey: ['myProductReview', id] });
        } catch (err: any) {
            setFormError(err.response?.data?.error || err.message || 'Failed to submit review.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingProduct) {
        return <div className="flex justify-center py-20"><Loader /></div>;
    }

    if (!product) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
                <p className="text-gray-500">Product not found.</p>
                <Link to="/store" className="text-sffl-red font-bold underline">Back to store</Link>
            </div>
        );
    }

    const totalPages = reviews?.total_pages || 1;

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Breadcrumbs + header */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <Link to="/store" className="hover:text-sffl-red transition-colors">Store</Link>
                    <span>/</span>
                    <Link to={`/store/products/${product.id}`} className="hover:text-sffl-red transition-colors truncate">{product.name}</Link>
                    <span>/</span>
                    <span className="text-gray-900 dark:text-white">Reviews</span>
                </div>
                <h1 className="text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase">
                    Reviews — {product.name}
                </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Left: summary + reviews list */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-6 shadow-sm space-y-4">
                        {product.rating_count > 0 ? (
                            <div className="flex items-center gap-4">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-sffl-navy dark:text-white">{(product.rating_avg ?? 0).toFixed(1)}</span>
                                    <span className="text-sm text-gray-500">/ 5</span>
                                </div>
                                <div className="space-y-1">
                                    <StarRating value={product.rating_avg ?? 0} size="md" />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                                        {product.rating_count} customer review{product.rating_count === 1 ? '' : 's'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No reviews yet for this product.</p>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-gray-300">All Reviews</h2>
                        <select
                            value={sort}
                            onChange={e => { setSort(e.target.value as ReviewSort); setPage(1); }}
                            className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs px-3 py-2 rounded-xl font-bold dark:text-white"
                        >
                            <option value="newest">Newest</option>
                            <option value="highest">Highest rated</option>
                            <option value="lowest">Lowest rated</option>
                        </select>
                    </div>

                    {loadingReviews ? (
                        <div className="flex justify-center py-12"><Loader /></div>
                    ) : !reviews || reviews.data.length === 0 ? (
                        <p className="text-sm text-gray-500 italic text-center py-8">No reviews to show.</p>
                    ) : (
                        <>
                            <div className="space-y-4">
                                {reviews.data.map(r => (
                                    <div key={r.id} className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-5 space-y-2">
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <StarRating value={r.rating} size="sm" />
                                                {r.title && <span className="font-black text-base text-sffl-navy dark:text-white">{r.title}</span>}
                                            </div>
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (!confirm('Delete this review? This cannot be undone.')) return;
                                                        try {
                                                            await deleteAdminProductReview(r.id);
                                                            queryClient.invalidateQueries({ queryKey: ['productReviews', id] });
                                                            queryClient.invalidateQueries({ queryKey: ['productReviewsPreview', id] });
                                                            queryClient.invalidateQueries({ queryKey: ['storeProduct', id] });
                                                        } catch (err: any) {
                                                            alert(err.response?.data?.error || err.message || 'Failed to delete review');
                                                        }
                                                    }}
                                                    className="text-[10px] font-black uppercase tracking-wider text-red-600 hover:text-white hover:bg-red-600 border border-red-200 dark:border-red-900 px-2 py-1 rounded transition-colors"
                                                >
                                                    Admin · Delete
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-bold flex-wrap">
                                            <span>{r.user_name}</span>
                                            {r.verified_purchase && (
                                                <span className="text-emerald-600 dark:text-emerald-400">· ✓ Verified Purchase</span>
                                            )}
                                            <span className="text-gray-400">· {new Date(r.created_at).toLocaleDateString()}</span>
                                        </div>
                                        {r.body && (
                                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line pt-1">{r.body}</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-bold rounded-xl disabled:opacity-50 dark:text-white"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-xs text-gray-500 font-bold">Page {page} of {totalPages}</span>
                                    <button
                                        disabled={page >= totalPages}
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-bold rounded-xl disabled:opacity-50 dark:text-white"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Right: leave a review form. Verified-purchase gate is enforced
                    server-side; here we just guide the user to log in. */}
                <div className="space-y-4 lg:sticky lg:top-24">
                    <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-6 shadow-sm space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-gray-300">
                            {myReview ? 'Update Your Review' : 'Leave a Review'}
                        </h2>

                        {!isAuthenticated ? (
                            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3">
                                <p>You need to be logged in (and have purchased this item) to leave a review.</p>
                                <Link
                                    to={`/login?redirect=${encodeURIComponent(`/store/products/${product.id}/reviews`)}`}
                                    className="inline-block bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full transition-all"
                                >
                                    Log in to review
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider block">Your rating</label>
                                    <StarRating value={rating} onChange={setRating} size="lg" />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider block">Headline (optional)</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="e.g. Fits great, fast delivery"
                                        maxLength={120}
                                        className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider block">Review (optional)</label>
                                    <textarea
                                        rows={5}
                                        value={body}
                                        onChange={e => setBody(e.target.value)}
                                        placeholder="What did you like or dislike? How was the fit and material?"
                                        className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40 resize-y leading-relaxed"
                                    />
                                </div>

                                {formError && (
                                    <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-bold px-4 py-3 rounded-xl">
                                        {formError}
                                    </div>
                                )}
                                {formSuccess && (
                                    <div role="status" className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-4 py-3 rounded-xl">
                                        {formSuccess}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-sffl-red hover:bg-red-700 text-white py-3 rounded-full font-bold text-xs uppercase tracking-wider transition-all transform active:scale-95 shadow-md disabled:opacity-50"
                                >
                                    {submitting ? 'Saving…' : myReview ? 'Update Review' : 'Submit Review'}
                                </button>

                                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                                    Only customers who have purchased this product can leave a review. Your name appears as "First L."
                                </p>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
