import { useState } from "react";
import { QrCodeIcon } from "@heroicons/react/24/outline";
import { ButtonLink, DashboardPageHeader, Tabs } from "../../components";
import { accessFor } from "../../config/featureAccess";
import { useAuth } from "../../contexts";
import { VoucherCatalogue } from "./vouchers/VoucherCatalogue";
import { VoucherRedemptions } from "./vouchers/VoucherRedemptions";
import { VouchersIssued } from "./vouchers/VouchersIssued";

type Tab = "issued" | "catalogue" | "redemptions";

const AdminVouchers = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("issued");
  const canRedeem = accessFor(user, "voucher_redeem") === "full";

  return (
    <div className="space-y-6 pb-mobile-nav-2x">
      <DashboardPageHeader
        title="Vouchers"
        subtitle="Set up what can be sold as a voucher, give vouchers to people, cancel them, and see what was redeemed at the bar."
        actions={
          canRedeem ? (
            <ButtonLink to="/bar" variant="outline" icon={QrCodeIcon}>
              Open Bar Screen
            </ButtonLink>
          ) : undefined
        }
      />

      <Tabs<Tab>
        aria-label="Voucher sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: "issued", label: "Vouchers" },
          { value: "catalogue", label: "Bundles" },
          { value: "redemptions", label: "Redeemed" },
        ]}
      />

      {tab === "issued" && <VouchersIssued />}
      {tab === "catalogue" && <VoucherCatalogue />}
      {tab === "redemptions" && <VoucherRedemptions />}
    </div>
  );
};

export default AdminVouchers;
