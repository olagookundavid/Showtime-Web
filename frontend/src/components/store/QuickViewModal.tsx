import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { getStoreProduct } from "../../services/api";
import type { StoreProduct } from "../../types";
import { ButtonLink, Modal } from "../ui";
import { Spinner } from "../ui/Spinner";
import { ProductOverview } from "./ProductOverview";

type Props = {
  productId: string | null;
  onClose: () => void;
};

// The product's buy box in a dialog, so shoppers can compare items without
// leaving the catalogue. Shares its query with the product page.
export const QuickViewModal = ({ productId, onClose }: Props) => {
  const { data: product, isLoading, isError } = useQuery<StoreProduct>({
    queryKey: ["storeProduct", productId],
    queryFn: () => getStoreProduct(productId!),
    enabled: !!productId,
  });

  return (
    <Modal
      open={!!productId}
      onClose={onClose}
      title={product?.name}
      subtitle={product ? `Showtime / ${product.tags?.[0] || "Store"}` : undefined}
      maxWidth="4xl"
      shape="square"
      footer={
        product && (
          <ButtonLink
            to={`/store/products/${product.id}`}
            shape="square"
            variant="outline"
            icon={ArrowRightIcon}
            iconPosition="right"
            onClick={onClose}
          >
            View full details
          </ButtonLink>
        )
      }
    >
      {isLoading ? (
        <Spinner size="lg" className="py-16" label="Loading product…" />
      ) : isError || !product ? (
        <p className="py-12 text-center text-sm text-gray-600 dark:text-gray-300">
          This product could not be loaded. Please try again.
        </p>
      ) : (
        <ProductOverview product={product} showHeading={false} />
      )}
    </Modal>
  );
};
