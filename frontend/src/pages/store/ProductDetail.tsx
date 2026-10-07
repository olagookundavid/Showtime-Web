import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  getStoreProduct,
  getStoreProducts,
  getProductReviews,
} from "../../services/api";
import type { StoreProduct } from "../../types/store";
import { ProductCard } from "../../components/store/ProductCard";
import { ProductOverview } from "../../components/store/ProductOverview";
import { QuickViewModal } from "../../components/store/QuickViewModal";
import { StarRating } from "../../components/store/StarRating";
import { ButtonLink } from "../../components/ui";
import { BackButton } from "../../components/ui/BackButton";
import { Spinner } from "../../components/ui/Spinner";

const ROW_SIZE = 4;

export const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  // Fetch the 2 most recent reviews for the preview below the product. The
  // dedicated /reviews page paginates the full list.
  const { data: reviewsPreview } = useQuery({
    queryKey: ["productReviewsPreview", id],
    queryFn: () => getProductReviews(id!, 1, 2, "newest"),
    enabled: !!id,
  });

  const {
    data: product,
    isLoading,
    error,
  } = useQuery<StoreProduct>({
    queryKey: ["storeProduct", id],
    queryFn: () => getStoreProduct(id || ""),
    enabled: !!id,
  });

  // The same list the store page uses, so the product rows cost no extra request.
  const { data: catalogue = [] } = useQuery<StoreProduct[]>({
    queryKey: ["storeProducts"],
    queryFn: getStoreProducts,
  });

  // Similar: other products in the same category. Popular: the best-rated others.
  const { similar, popular } = useMemo(() => {
    if (!product) return { similar: [], popular: [] };
    const others = catalogue.filter((p) => p.id !== product.id);
    const category = product.tags?.[0];
    const similarItems = category
      ? others.filter((p) => p.tags?.[0] === category).slice(0, ROW_SIZE)
      : [];
    const popularItems = others
      .filter((p) => p.rating_count > 0)
      .sort(
        (a, b) =>
          (b.rating_avg ?? 0) - (a.rating_avg ?? 0) ||
          b.rating_count - a.rating_count,
      )
      .slice(0, ROW_SIZE);
    return { similar: similarItems, popular: popularItems };
  }, [catalogue, product]);

  if (isLoading) {
    return (
      <Spinner size="lg" className="py-16" label="Loading product details…" />
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-16 text-center">
        <ExclamationTriangleIcon
          className="mx-auto h-12 w-12 text-amber-500"
          aria-hidden="true"
        />
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white">
            Product not found
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This item could not be retrieved. It may have been disabled or
            removed from the catalogue.
          </p>
        </div>
        <ButtonLink to="/store" variant="navy" shape="square">
          Back to store
        </ButtonLink>
      </div>
    );
  }

  const productRow = (
    heading: string,
    items: StoreProduct[],
  ) =>
    items.length > 0 && (
      <section className="space-y-6">
        <h2 className="text-2xl font-black tracking-tight text-sffl-navy sm:text-3xl dark:text-white">
          {heading}
        </h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              product={item}
              onQuickView={setQuickViewId}
            />
          ))}
        </div>
      </section>
    );

  return (
    <div className="animate-fadeIn space-y-14">
      {/* Breadcrumbs & back navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackButton fallback="/store" />
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500"
        >
          <Link
            to="/store"
            className="inline-flex min-h-11 shrink-0 items-center hover:text-sffl-red"
          >
            Store
          </Link>
          <span aria-hidden="true">/</span>
          <span className="min-w-0 max-w-[60vw] truncate text-gray-900 md:max-w-md dark:text-white">
            {product.name}
          </span>
        </nav>
      </div>

      <ProductOverview product={product} />

      {/* Reviews preview: the two latest reviews, plus a link to the full list.
          With no reviews yet, the link still lets a verified customer write one. */}
      <section className="space-y-6 border-t border-gray-200 pt-10 dark:border-gray-700">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="space-y-3">
            <h2 className="text-2xl font-black tracking-tight text-sffl-navy sm:text-3xl dark:text-white">
              Customer reviews
            </h2>
            {product.rating_count > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <StarRating value={product.rating_avg} size="md" />
                <span className="text-lg font-black text-sffl-navy dark:text-white">
                  {(product.rating_avg ?? 0).toFixed(1)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  out of 5 · {product.rating_count} review
                  {product.rating_count === 1 ? "" : "s"}
                </span>
              </div>
            )}
          </div>
          <Link
            to={`/store/products/${product.id}/reviews`}
            className="inline-flex min-h-11 items-center gap-1 text-xs font-black uppercase tracking-wider text-sffl-red hover:underline"
          >
            {product.rating_count > 0
              ? `See all ${product.rating_count}`
              : "Write a review"}
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {!reviewsPreview?.data?.length ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No reviews yet. Be the first to share your experience after you
            receive this item.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {reviewsPreview.data.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center bg-stone-100 text-sm font-black text-sffl-navy dark:bg-gray-800 dark:text-white"
                  >
                    {r.user_name?.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="break-all text-sm font-bold text-sffl-navy dark:text-white">
                      {r.user_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StarRating value={r.rating} size="sm" />
                      <span className="text-xs font-bold text-sffl-navy dark:text-white">
                        {r.rating.toFixed(1)} rating
                      </span>
                    </div>
                    {r.verified_purchase && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" />
                        Verified purchase
                      </span>
                    )}
                  </div>
                  {r.title && (
                    <p className="text-sm font-black text-sffl-navy dark:text-white">
                      {r.title}
                    </p>
                  )}
                  {r.body && (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 wrap-break-word dark:text-gray-300">
                      {r.body}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {productRow("Similar products", similar)}
      {productRow("Popular", popular)}

      <QuickViewModal
        productId={quickViewId}
        onClose={() => setQuickViewId(null)}
      />
    </div>
  );
};
