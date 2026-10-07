import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRightIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  LockClosedIcon,
  MinusIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  ShareIcon,
  ShoppingBagIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import type { ProductVariant, StoreProduct } from "../../types";
import { useCart } from "../../contexts";
import { findVariantByValues, getVariantPrice } from "../../utils";
import { Button, IconButton, Modal } from "../ui";
import { ProductDescription } from "./ProductDescription";
import { ProductGallery } from "./ProductGallery";
import { StarRating } from "./StarRating";
import {
  PrivacyPolicyContent,
  ReturnPolicyContent,
  ShippingPolicyContent,
} from "./PolicyContent";

type Props = {
  product: StoreProduct;
  /** Show the category and name above the price. The quick view turns this off, since its dialog title already names the product. */
  showHeading?: boolean;
};

// Swatch colours for the colour names in the catalogue (keys are lower case).
// A colour not listed here falls back to a text chip.
const COLOUR_HEX: Record<string, string> = {
  black: "#111111",
  white: "#ffffff",
  navy: "#1d2d4f",
  blue: "#2c4fa0",
  red: "#c62828",
  green: "#2e7d32",
  yellow: "#f2c12e",
  orange: "#ef6c00",
  grey: "#9e9e9e",
  gray: "#9e9e9e",
  pink: "#e91e63",
  purple: "#6a1b9a",
  brown: "#6d4c41",
  beige: "#d7c4a3",
  cream: "#f5f0dc",
  maroon: "#7b1f2b",
  teal: "#00897b",
};

const isColourOption = (name: string) => /colou?r/i.test(name);

const DeliveryFacts = ({ onReturnPolicy }: { onReturnPolicy: () => void }) => (
  <ul className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
    <li className="flex items-start gap-2">
      <TruckIcon className="mt-0.5 h-4 w-4 shrink-0 text-sffl-navy dark:text-white" aria-hidden="true" />
      <span>
        <span className="font-bold text-sffl-navy dark:text-white">Estimated delivery:</span>{" "}
        3–7 days across Nigeria
      </span>
    </li>
    <li className="flex items-start gap-2">
      <ArrowUturnLeftIcon className="mt-0.5 h-4 w-4 shrink-0 text-sffl-navy dark:text-white" aria-hidden="true" />
      <span className="flex flex-wrap items-center gap-x-2">
        <span>Returns accepted within 15 days.</span>
        <button
          type="button"
          onClick={onReturnPolicy}
          className="inline-flex min-h-11 items-center font-bold text-sffl-navy underline underline-offset-2 hover:text-sffl-red dark:text-white"
        >
          Return Policy
        </button>
      </span>
    </li>
    <li className="pt-1 font-bold text-sffl-navy dark:text-white">Sold by Showtime Store</li>
  </ul>
);

// Gallery on the left, buy box on the right. Used by the product page and the
// quick view, so variant selection, stock and add-to-bag work the same in both.
export const ProductOverview = ({ product, showHeading = true }: Props) => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  // selectedValues is indexed by option position (0/1/2), matching how
  // variants store their tuple. undefined slot means that option is unset.
  const [selectedValues, setSelectedValues] = useState<(string | undefined)[]>([
    undefined,
    undefined,
    undefined,
  ]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [openPolicy, setOpenPolicy] = useState<
    "return" | "shipping" | "privacy" | null
  >(null);
  const [shareToast, setShareToast] = useState("");
  const [addedToast, setAddedToast] = useState("");
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  const options = product.options || [];
  const images = product.images ?? [];

  // For each option position, the remaining stock summed across all variants
  // that carry that value. Used to dim sold-out choices.
  const stockByOptionValue = useMemo<Record<number, Record<string, number>>>(() => {
    const map: Record<number, Record<string, number>> = { 0: {}, 1: {}, 2: {} };
    product.variants?.forEach((v: ProductVariant) => {
      const values = [v.option1_value, v.option2_value, v.option3_value];
      values.forEach((val, i) => {
        if (!val) return;
        map[i][val] = (map[i][val] ?? 0) + (v.quantity || 0);
      });
    });
    return map;
  }, [product]);

  // Derive defaults during render instead of synchronously updating state in
  // an effect. Explicit user selections always take precedence.
  const effectiveSelectedValues = useMemo(() => {
    const values = [...selectedValues];
    product.options?.forEach((opt, i) => {
      if (values[i]) return;
      const firstInStock = opt.values.find(
        (v) => (stockByOptionValue[i]?.[v.value] ?? 0) > 0,
      );
      if (firstInStock) values[i] = firstInStock.value;
    });
    return values;
  }, [product, selectedValues, stockByOptionValue]);

  // Find the variant row whose tuple of option values matches the selection.
  const matchedVariant = findVariantByValues(product, effectiveSelectedValues);

  // A variant can pin one of the product's photos; otherwise the shopper's own
  // gallery choice stays in place.
  const variantImageIndex = matchedVariant?.image_url
    ? images.findIndex((img) => img.image_url === matchedVariant.image_url)
    : -1;
  const displayedImageIndex =
    variantImageIndex >= 0 ? variantImageIndex : activeImageIndex;

  const activePrice = getVariantPrice(product, matchedVariant);
  const hasVariants = (product.variants?.length || 0) > 0;
  const activeStock = matchedVariant
    ? matchedVariant.quantity
    : hasVariants
      ? 0
      : product.quantity;
  const isVariantOutOfStock = activeStock === 0;
  const isLowStock =
    !isVariantOutOfStock && activeStock <= product.threshold;

  const colourIndex = options.findIndex((opt) => isColourOption(opt.name));
  const colourway =
    colourIndex >= 0 ? effectiveSelectedValues[colourIndex] : undefined;

  const showShareFeedback = (msg: string) => {
    setShareToast(msg);
    window.setTimeout(() => setShareToast(""), 2500);
  };

  // Copy the product URL to clipboard, fall back through every available
  // strategy, and ALWAYS surface visible feedback to the user.
  const handleShare = async () => {
    const url = window.location.href;

    // 1. Modern async clipboard — works on https + localhost.
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        showShareFeedback("Link copied!");
        return;
      }
    } catch {
      // fall through to legacy path
    }

    // 2. Legacy textarea + execCommand — works on plain http and older browsers.
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, url.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        showShareFeedback("Link copied!");
        return;
      }
    } catch {
      // fall through
    }

    showShareFeedback("Could not copy — please copy from the address bar");
  };

  const handleBuyNow = () => {
    if (isVariantOutOfStock) return;
    let checkoutUrl = `/store/checkout?product_id=${product.id}&quantity=${quantity}`;
    if (matchedVariant) {
      checkoutUrl += `&variant_id=${matchedVariant.id}`;
    }
    navigate(checkoutUrl);
  };

  // Builds the cart line from the currently selected variant + qty, then
  // hands it to the CartContext (which dedupes by product+variant).
  const handleAddToCart = () => {
    if (isVariantOutOfStock) return;
    const variantLabel = matchedVariant
      ? [
          matchedVariant.option1_value,
          matchedVariant.option2_value,
          matchedVariant.option3_value,
        ]
          .filter(Boolean)
          .map(
            (v, i) =>
              `${product.options?.[i]?.name || `Option ${i + 1}`}: ${v}`,
          )
          .join(", ")
      : undefined;
    const primaryImage =
      matchedVariant?.image_url ||
      product.images?.find((i) => i.is_primary)?.image_url ||
      product.images?.[0]?.image_url;

    addItem({
      product_id: product.id,
      variant_id: matchedVariant?.id,
      product_name: product.name,
      variant_label: variantLabel,
      unit_price: activePrice,
      quantity,
      image_url: primaryImage,
    });
    setAddedToast(quantity > 1 ? `${quantity} added to bag` : "Added to bag");
    window.setTimeout(() => setAddedToast(""), 2000);
  };

  const category = product.tags?.[0] || "Store";
  const description = product.description?.trim() ?? "";
  // Long descriptions collapse on phones behind a "Read more" toggle.
  const descriptionIsLong = description.length > 160;
  const returnPolicy = () => setOpenPolicy("return");

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Left: carousel, actions, and on desktop the delivery facts. */}
        <div className="min-w-0 space-y-5">
          <ProductGallery
            images={images}
            name={product.name}
            activeIndex={displayedImageIndex}
            onChange={setActiveImageIndex}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={`mailto:support@showtimestore.com?subject=${encodeURIComponent(`Question about ${product.name}`)}`}
              className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-sffl-navy hover:text-sffl-red dark:text-white"
            >
              <QuestionMarkCircleIcon className="h-4 w-4" aria-hidden="true" />
              Ask a question
            </a>
            <Button
              variant="ghost"
              shape="square"
              size="sm"
              icon={shareToast ? CheckIcon : ShareIcon}
              aria-live="polite"
              onClick={handleShare}
            >
              {shareToast || "Share"}
            </Button>
          </div>

          <div className="hidden border-t border-gray-200 pt-5 lg:block dark:border-gray-700/60">
            <DeliveryFacts onReturnPolicy={returnPolicy} />
          </div>
        </div>

        {/* Right: title, price, options, buy box, then details. */}
        <div className="min-w-0 space-y-6">
          {showHeading && (
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sffl-red">
                Showtime / {category}
              </p>
              <h1 className="wrap-break-word text-3xl font-black tracking-tight text-sffl-navy sm:text-4xl dark:text-white">
                {product.name}
              </h1>
            </div>
          )}

          <p className="text-2xl font-black leading-none text-sffl-navy dark:text-white">
            ₦{(activePrice ?? 0).toLocaleString()}
          </p>

          {description && (
            <div className="space-y-2">
              <div
                className={
                  descriptionIsLong && !descriptionOpen
                    ? "max-h-28 overflow-hidden md:max-h-none"
                    : undefined
                }
              >
                <ProductDescription
                  text={product.description}
                  className="text-sm text-gray-600 dark:text-gray-300"
                />
              </div>
              {descriptionIsLong && (
                <button
                  type="button"
                  aria-expanded={descriptionOpen}
                  onClick={() => setDescriptionOpen((open) => !open)}
                  className="inline-flex min-h-11 items-center text-xs font-bold text-sffl-navy underline underline-offset-2 hover:text-sffl-red md:hidden dark:text-white"
                >
                  {descriptionOpen ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          {/* Rating summary: jumps to the dedicated reviews page. */}
          <Link
            to={`/store/products/${product.id}/reviews`}
            className="inline-flex min-h-11 flex-wrap items-center gap-2 text-xs font-bold text-sffl-navy hover:text-sffl-red dark:text-gray-300"
          >
            <StarRating value={product.rating_avg ?? 0} size="sm" />
            {product.rating_count > 0 ? (
              <>
                <span>{(product.rating_avg ?? 0).toFixed(1)}</span>
                <span className="underline underline-offset-2">
                  {product.rating_count} review
                  {product.rating_count === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span>No reviews yet</span>
            )}
          </Link>

          {options.length > 0 && (
            <div className="space-y-5 border-t border-gray-200 pt-5 dark:border-gray-700/60">
              {options.map((opt, optIdx) => (
                <fieldset key={`${opt.name}-${optIdx}`} className="min-w-0 space-y-2">
                  <legend className="text-xs font-bold text-sffl-navy dark:text-white">
                    {opt.name}:{" "}
                    <span className="font-black">
                      {effectiveSelectedValues[optIdx]}
                    </span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {opt.values.map((val) => {
                      const isSelected =
                        effectiveSelectedValues[optIdx] === val.value;
                      const stockForVal =
                        stockByOptionValue[optIdx]?.[val.value] ?? 0;
                      const isValueSoldOut = stockForVal === 0;
                      const swatch = isColourOption(opt.name)
                        ? COLOUR_HEX[val.value.trim().toLowerCase()]
                        : undefined;

                      const select = () =>
                        setSelectedValues((prev) => {
                          const next = [...prev];
                          next[optIdx] = val.value;
                          return next;
                        });

                      if (swatch) {
                        return (
                          <button
                            key={val.value}
                            type="button"
                            title={val.value}
                            aria-pressed={isSelected}
                            aria-label={
                              isValueSoldOut
                                ? `${val.value}, sold out`
                                : val.value
                            }
                            disabled={isValueSoldOut}
                            onClick={select}
                            className="flex h-11 w-11 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span
                              aria-hidden="true"
                              style={{ backgroundColor: swatch }}
                              className={`block h-7 w-7 rounded-full border border-gray-300 ${
                                isSelected
                                  ? "ring-2 ring-sffl-navy ring-offset-2"
                                  : ""
                              }`}
                            />
                          </button>
                        );
                      }

                      return (
                        <Button
                          key={val.value}
                          shape={isSelected ? "circle" : "square"}
                          size="sm"
                          variant={isSelected ? "navy" : "secondary"}
                          className={`w-11 px-0 ${isValueSoldOut ? "line-through" : ""}`}
                          disabled={isValueSoldOut}
                          aria-pressed={isSelected}
                          aria-label={
                            isValueSoldOut ? `${val.value}, sold out` : undefined
                          }
                          onClick={select}
                        >
                          {val.value}
                        </Button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          <p className="flex items-center gap-2 text-xs font-bold">
            <span
              aria-hidden="true"
              className={`h-2 w-2 ${isVariantOutOfStock ? "bg-red-500" : "bg-emerald-500"}`}
            />
            {isVariantOutOfStock ? (
              <span className="text-red-600 dark:text-red-400">Sold out</span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400">
                In stock
                {isLowStock ? ` · only ${activeStock} left` : ""}
              </span>
            )}
          </p>

          {!isVariantOutOfStock && (
            <div className="space-y-2">
              <span className="block text-xs font-bold text-sffl-navy dark:text-white">
                Quantity
              </span>
              <div className="inline-flex items-center border border-gray-300 dark:border-gray-600">
                <IconButton
                  shape="square"
                  variant="ghost"
                  icon={MinusIcon}
                  label="Decrease quantity"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                />
                <span
                  className="min-w-12 text-center text-sm font-bold text-gray-900 dark:text-white"
                  aria-live="polite"
                >
                  {quantity}
                </span>
                <IconButton
                  shape="square"
                  variant="ghost"
                  icon={PlusIcon}
                  label="Increase quantity"
                  onClick={() =>
                    setQuantity((prev) => Math.min(activeStock, prev + 1))
                  }
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            {isVariantOutOfStock ? (
              <Button fullWidth size="lg" shape="square" disabled>
                Sold out
              </Button>
            ) : (
              <>
                <Button
                  fullWidth
                  size="lg"
                  shape="square"
                  variant={addedToast ? "success" : "primary"}
                  icon={addedToast ? CheckIcon : ShoppingBagIcon}
                  aria-live="polite"
                  onClick={handleAddToCart}
                >
                  {addedToast || "Add to bag"}
                </Button>
                <Button
                  fullWidth
                  size="lg"
                  shape="square"
                  variant="outline"
                  icon={ArrowRightIcon}
                  iconPosition="right"
                  onClick={handleBuyNow}
                >
                  Buy now
                </Button>
              </>
            )}
            <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <LockClosedIcon className="h-4 w-4 text-sffl-red" aria-hidden="true" />
              Secured by Paystack
            </p>
          </div>

          {/* On phones the delivery facts follow the buy box. */}
          <div className="border-t border-gray-200 pt-5 lg:hidden dark:border-gray-700/60">
            <DeliveryFacts onReturnPolicy={returnPolicy} />
          </div>

          <div className="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-700/60 dark:border-gray-700/60">
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-sffl-navy dark:text-white">
                Product details
                <ChevronDownIcon
                  className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-300">
                <li>Collection: Showtime</li>
                {colourway && <li>Colourway: {colourway}</li>}
                {product.sku && <li>Product reference: {product.sku}</li>}
              </ul>
            </details>

            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-sffl-navy dark:text-white">
                Delivery &amp; returns
                <ChevronDownIcon
                  className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <p>Ships within 2–3 business days.</p>
                <p>Returns accepted within 15 days of delivery.</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <button
                    type="button"
                    onClick={() => setOpenPolicy("shipping")}
                    className="inline-flex min-h-11 items-center font-bold text-sffl-navy underline underline-offset-2 hover:text-sffl-red dark:text-white"
                  >
                    Shipping Policy
                  </button>
                  <button
                    type="button"
                    onClick={returnPolicy}
                    className="inline-flex min-h-11 items-center font-bold text-sffl-navy underline underline-offset-2 hover:text-sffl-red dark:text-white"
                  >
                    Return Policy
                  </button>
                </div>
              </div>
            </details>
          </div>

          <button
            type="button"
            onClick={() => setOpenPolicy("privacy")}
            className="inline-flex min-h-11 items-center text-xs font-bold text-sffl-navy underline underline-offset-2 hover:text-sffl-red dark:text-white"
          >
            Privacy Policy
          </button>
        </div>
      </div>

      <Modal
        open={openPolicy === "return"}
        onClose={() => setOpenPolicy(null)}
        title="Refund Policy"
        subtitle="Showtime Store"
        maxWidth="2xl"
        shape="square"
      >
        <ReturnPolicyContent />
      </Modal>
      <Modal
        open={openPolicy === "shipping"}
        onClose={() => setOpenPolicy(null)}
        title="Shipping Policy"
        subtitle="Showtime Store"
        maxWidth="2xl"
        shape="square"
      >
        <ShippingPolicyContent />
      </Modal>
      <Modal
        open={openPolicy === "privacy"}
        onClose={() => setOpenPolicy(null)}
        title="Privacy Policy"
        subtitle="Showtime Store"
        maxWidth="2xl"
        shape="square"
      >
        <PrivacyPolicyContent />
      </Modal>
    </>
  );
};
