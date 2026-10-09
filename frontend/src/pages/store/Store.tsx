import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArchiveBoxIcon,
  ArrowRightIcon,
  CreditCardIcon,
  FlagIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  TagIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { getStoreProducts } from "../../services/api";
import type { StoreProduct } from "../../types";
import { Button, Input, Select, ProductCard, QuickViewModal, StoreHeroCarousel } from "../../components";
import { htmlToPlainText } from "../../utils";
import { STANDARD_PRODUCT_TAGS } from "../../constants";

type SortOption = "featured" | "newest" | "price-asc" | "price-desc";

const CATALOGUE_ID = "store-catalogue";

const scrollToCatalogue = () => {
  document
    .getElementById(CATALOGUE_ID)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export const Store = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("All");
  const [sort, setSort] = useState<SortOption>("featured");
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery<StoreProduct[]>({
    queryKey: ["storeProducts"],
    queryFn: getStoreProducts,
  });

  // Tabs: the standard tags, plus any other tag a product carries.
  const allAvailableTags = useMemo(() => {
    const set = new Set<string>(STANDARD_PRODUCT_TAGS);
    products.forEach((p) => {
      if (p.tags && Array.isArray(p.tags)) {
        p.tags.forEach((t) => {
          if (t.trim()) set.add(t.trim());
        });
      }
    });
    return ["All", ...Array.from(set)];
  }, [products]);

  // Filter by search and tab, then sort. "Featured" keeps the server order.
  const visibleProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        htmlToPlainText(product.description).toLowerCase().includes(query);

      if (!matchesSearch) return false;
      if (selectedTag === "All") return true;

      const productTags = product.tags || [];
      if (selectedTag === "Others") {
        return productTags.includes("Others") || productTags.length === 0;
      }
      return productTags.includes(selectedTag);
    });

    switch (sort) {
      case "newest":
        return filtered.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      case "price-asc":
        return filtered.sort((a, b) => a.price - b.price);
      case "price-desc":
        return filtered.sort((a, b) => b.price - a.price);
      default:
        return filtered;
    }
  }, [products, searchQuery, selectedTag, sort]);

  const resetFilters = () => {
    setSelectedTag("All");
    setSearchQuery("");
  };

  return (
    <div className="animate-fadeIn">
      {/* Hero */}
      <StoreHeroCarousel onShopClick={scrollToCatalogue} />

      {/* Trust strip */}
      <ul className="grid grid-cols-1 divide-y divide-gray-200 border-b border-gray-200 text-xs font-bold text-sffl-navy sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-gray-700 dark:border-gray-700 dark:text-white">
        {[
          { icon: ShieldCheckIcon, label: "Official league merchandise" },
          { icon: TagIcon, label: "Your team. Your identity." },
          { icon: FlagIcon, label: "From the arena to the everyday" },
        ].map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex items-center justify-center gap-2 px-4 py-4 sm:px-6"
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>

      {/* Catalogue */}
      <section
        id={CATALOGUE_ID}
        className="scroll-mt-24 space-y-8 px-0 pt-10 sm:pt-14"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sffl-red">
              The Showtime Edit
            </p>
            <h2 className="text-3xl font-black tracking-tight text-sffl-navy sm:text-4xl dark:text-white">
              Everyday Showtime.
            </h2>
          </div>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            {visibleProducts.length}{" "}
            {visibleProducts.length === 1 ? "product" : "products"}
          </p>
        </div>

        <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-center lg:justify-between dark:border-gray-700">
          <div
            role="group"
            aria-label="Filter by category"
            className="flex flex-wrap gap-2"
          >
            {allAvailableTags.map((tag) => {
              const isSelected = selectedTag === tag;
              return (
                <Button
                  key={tag}
                  size="sm"
                  shape="square"
                  variant={isSelected ? "navy" : "ghost"}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedTag(tag)}
                >
                  {tag === "All" ? "All products" : tag}
                </Button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="search"
              aria-label="Search products"
              icon={MagnifyingGlassIcon}
              placeholder="Search the store"
              shape="square"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64"
            />
            <Select
              aria-label="Sort products"
              shape="square"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="w-full sm:w-56"
            >
              <option value="featured">Sort: Featured</option>
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="animate-pulse space-y-3">
                <div className="aspect-square w-full bg-stone-100 dark:bg-gray-800" />
                <div className="h-3 w-2/3 bg-stone-100 dark:bg-gray-800" />
                <div className="h-4 w-1/3 bg-stone-100 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
            <ArchiveBoxIcon className="h-12 w-12 text-gray-400" aria-hidden="true" />
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white">
                No products found
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nothing matches this category or search. Try another category,
                or reset the filters to see everything.
              </p>
            </div>
            <Button variant="navy" shape="square" onClick={resetFilters}>
              Reset filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onQuickView={setQuickViewId}
              />
            ))}
          </div>
        )}
      </section>

      {/* Editorial band */}
      <section className="mt-16 grid grid-cols-1 items-center gap-8 bg-stone-100 px-5 py-12 sm:px-10 md:grid-cols-2 lg:px-16 dark:bg-gray-900/60">
        <div className="space-y-4">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
            Beyond the sidelines
          </p>
          <h2 className="text-4xl font-black leading-[0.95] tracking-tight text-sffl-navy sm:text-5xl dark:text-white">
            Same passion.
            <br />
            Every day.
          </h2>
          <p className="max-w-sm text-sm text-gray-600 dark:text-gray-300">
            Caps, polos and signature pieces. Carry a little Showtime wherever
            you go.
          </p>
          <Button
            variant="outline"
            shape="square"
            icon={ArrowRightIcon}
            iconPosition="right"
            onClick={scrollToCatalogue}
          >
            Shop the store
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              src: "/images/store/showtime-snapback-with-crest-white.webp",
              alt: "Showtime snapback cap with crest logo, white",
            },
            {
              src: "/images/store/showtime-snapback-unite-compete-thrive-blue.webp",
              alt: "Showtime snapback cap, Unite. Compete. Thrive.",
            },
          ].map((image) => (
            <div
              key={image.src}
              className="relative aspect-square overflow-hidden bg-white dark:bg-gray-800"
            >
              <img
                src={image.src}
                alt={image.alt}
                loading="lazy"
                className="h-full w-full object-contain p-4"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Service notes */}
      <section className="grid grid-cols-1 gap-6 px-0 py-12 md:grid-cols-3">
        {[
          {
            icon: TruckIcon,
            title: "Swift delivery",
            body: "Reliable shipping across Lagos and regional locations. Orders typically ship within 3-5 business days with live tracking details.",
          },
          {
            icon: CreditCardIcon,
            title: "Paystack secured",
            body: "Checkout is powered by Paystack. We accept Visa, Mastercard, Verve and direct electronic transfers.",
          },
          {
            icon: ShieldCheckIcon,
            title: "Genuine merchandise",
            body: "All clothing products are official Showtime Flag Football items, made for comfort and everyday wear.",
          },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="flex items-center gap-2 text-sm font-bold text-sffl-navy dark:text-white">
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{body}</p>
          </div>
        ))}
      </section>

      <QuickViewModal
        productId={quickViewId}
        onClose={() => setQuickViewId(null)}
      />
    </div>
  );
};
