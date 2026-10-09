import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRightIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { StoreProduct } from "../../types";
import { getAvailableStock, htmlToPlainText } from "../../utils";
import { Button } from "../ui";
import { LazyImage } from "../ui/LazyImage";

type Props = {
  product: StoreProduct;
  onQuickView: (productId: string) => void;
};

// One product in the catalogue grid: sharp image well, the product's photos as
// small swatches, then name, price and a link to the full page. The image and
// name both open the product page; "Quick view" opens it in a dialog instead.
export const ProductCard = ({ product, onQuickView }: Props) => {
  const images = product.images ?? [];
  const primaryIndex = Math.max(
    0,
    images.findIndex((img) => img.is_primary),
  );
  const [activeIndex, setActiveIndex] = useState(primaryIndex);

  const available = getAvailableStock(product);
  const isOutOfStock = available === 0;
  const isLowStock = !isOutOfStock && available <= product.threshold;
  const productUrl = `/store/products/${product.id}`;
  const activeImage = images[activeIndex];
  const category = product.tags?.[0] || "Store";

  return (
    <article className="group flex flex-col min-w-0">
      <div className="relative aspect-square w-full overflow-hidden">
        <Link
          to={productUrl}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0"
        >
          {activeImage ? (
            <LazyImage src={activeImage.image_url} alt="" objectFit="cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-stone-100 text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:bg-gray-900/60">
              No image yet
            </span>
          )}
        </Link>

        {isOutOfStock && (
          <span className="pointer-events-none absolute top-3 left-3 z-10 bg-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">
            Sold out
          </span>
        )}
        {isLowStock && (
          <span className="pointer-events-none absolute top-3 left-3 z-10 bg-amber-400 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-black">
            Low stock
          </span>
        )}

        {/* Always visible on touch screens, where there is no hover. */}
        {!isOutOfStock && (
          <Button
            shape="square"
            size="sm"
            variant="secondary"
            icon={PlusIcon}
            onClick={() => onQuickView(product.id)}
            className="absolute right-3 bottom-3 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          >
            Quick view
          </Button>
        )}
      </div>

      {images.length > 1 && (
        <div
          role="group"
          aria-label={`Photos of ${product.name}`}
          className="flex gap-1 pt-2"
        >
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
              aria-label={`Show photo ${idx + 1} of ${images.length}`}
              aria-pressed={idx === activeIndex}
              className={`flex h-11 w-11 items-center justify-center bg-stone-100 dark:bg-gray-900/60 border-2 ${
                idx === activeIndex
                  ? "border-sffl-navy"
                  : "border-transparent hover:border-gray-300"
              }`}
            >
              <LazyImage src={img.image_url} alt="" objectFit="contain" className="p-0.5" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1 pt-3">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          Showtime / {category}
        </p>
        <h3 className="text-sm font-bold text-sffl-navy dark:text-white">
          <Link to={productUrl} className="hover:underline underline-offset-4">
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
          {htmlToPlainText(product.description) || "Official Showtime Flag Football merchandise."}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="text-sm font-black text-sffl-navy dark:text-white">
            ₦{product.price.toLocaleString()}
          </span>
          <Link
            to={productUrl}
            className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-sffl-navy underline underline-offset-4 hover:text-sffl-red dark:text-white"
          >
            View details
            <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
};
