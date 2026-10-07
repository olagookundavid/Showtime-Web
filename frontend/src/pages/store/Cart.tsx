import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { useCart } from "../../contexts";
import { Button, IconButton, ConfirmDialog } from "../../components";

export const Cart = () => {
  const { items, subtotal, updateQuantity, removeItem, clear } = useCart();
  const navigate = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false);

  // Checkout reads cart-mode straight from CartContext when ?source=cart
  // is present — no URL or sessionStorage payload needed.
  const handleCheckout = () => {
    navigate("/store/checkout?source=cart");
  };

  const handleClear = () => {
    clear();
    setConfirmClear(false);
    toast.success("Your bag is now empty.");
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-6 animate-fadeIn">
        <ShoppingBagIcon
          className="w-16 h-16 mx-auto text-gray-400"
          aria-hidden="true"
        />
        <div className="space-y-2">
          <h1 className="text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white">
            Your bag is empty
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Browse the store and tap "Add to bag" on any product to get
            started.
          </p>
        </div>
        <Link
          to="/store"
          className="inline-flex items-center justify-center min-h-11 bg-sffl-navy hover:bg-sffl-red text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-none transition-all"
        >
          Go to Store
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b dark:border-gray-800">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-sffl-navy dark:text-white uppercase leading-none">
            Your Bag
          </h1>
          <p className="text-xs text-gray-500 uppercase font-black tracking-widest mt-1.5">
            {items.length} item{items.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button shape="square"
          variant="danger"
          size="sm"
          className="self-start md:self-auto"
          icon={TrashIcon}
          onClick={() => setConfirmClear(true)}
        >
          Clear bag
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((line) => {
            const lineTotal = line.unit_price * line.quantity;
            return (
              <div
                key={`${line.product_id}::${line.variant_id || ""}`}
                className="flex gap-3 sm:gap-4 bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-none p-3 sm:p-4 "
              >
                <Link
                  to={`/store/products/${line.product_id}`}
                  className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-none bg-gray-50 dark:bg-gray-900/40 overflow-hidden flex items-center justify-center border border-gray-100 dark:border-gray-700"
                >
                  {line.image_url ? (
                    <img
                      src={line.image_url}
                      alt=""
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-gray-400">
                      MERCH
                    </span>
                  )}
                </Link>

                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <Link
                      to={`/store/products/${line.product_id}`}
                      className="font-black text-sm text-sffl-navy dark:text-white hover:text-sffl-red transition-colors line-clamp-2 sm:line-clamp-1 wrap-break-word"
                    >
                      {line.product_name}
                    </Link>
                    {line.variant_label && (
                      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {line.variant_label}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ₦{line.unit_price.toLocaleString()} each
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-x-3 gap-y-2">
                    <div className="inline-flex items-center border border-gray-200 dark:border-gray-700 rounded-none overflow-hidden bg-white dark:bg-gray-800/40">
                      <IconButton shape="square"
                        variant="ghost"
                        icon={MinusIcon}
                        label={`Decrease quantity of ${line.product_name}`}
                        onClick={() =>
                          updateQuantity(
                            line.product_id,
                            line.variant_id,
                            line.quantity - 1,
                          )
                        }
                      />
                      <span
                        className="px-2 min-w-8 text-center text-sm font-bold text-gray-900 dark:text-white"
                        aria-live="polite"
                      >
                        {line.quantity}
                      </span>
                      <IconButton shape="square"
                        variant="ghost"
                        icon={PlusIcon}
                        label={`Increase quantity of ${line.product_name}`}
                        onClick={() =>
                          updateQuantity(
                            line.product_id,
                            line.variant_id,
                            line.quantity + 1,
                          )
                        }
                      />
                    </div>

                    <div className="text-right sm:min-w-20">
                      <div className="font-black text-sm text-sffl-navy dark:text-white">
                        ₦{lineTotal.toLocaleString()}
                      </div>
                      <Button shape="square"
                        variant="link"
                        size="sm"
                        className="-mr-2 text-red-500"
                        onClick={() =>
                          removeItem(line.product_id, line.variant_id)
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-[calc(var(--chrome-h,8rem)+1rem)] bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-none p-4 sm:p-6  space-y-4">
          <h2 className="text-[11px] uppercase font-black tracking-wider text-sffl-red">
            Order Summary
          </h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3 text-gray-500">
              <span>Subtotal</span>
              <span className="font-bold text-sffl-navy dark:text-white">
                ₦{subtotal.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-gray-500">
              <span>Shipping</span>
              <span className="font-bold text-emerald-600 uppercase text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-none">
                Calculated at checkout
              </span>
            </div>
            <div className="flex justify-between gap-3 pt-3 border-t dark:border-gray-700/40 text-base font-black text-sffl-navy dark:text-white">
              <span>Total</span>
              <span className="text-sffl-red text-lg">
                ₦{subtotal.toLocaleString()}
              </span>
            </div>
          </div>

          <Button shape="square"
            fullWidth
            size="lg"
            icon={ArrowRightIcon}
            iconPosition="right"
            onClick={handleCheckout}
          >
            Checkout
          </Button>

          <Link
            to="/store"
            className="flex items-center justify-center gap-1.5 min-h-11 text-xs font-bold text-sffl-navy dark:text-gray-300 hover:text-sffl-red uppercase tracking-wider"
          >
            <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
            Continue shopping
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Empty your bag?"
        description="Every item will be removed from your bag. You can add them again from the store."
        confirmLabel="Empty bag"
        tone="warning"
        icon={TrashIcon}
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
};
