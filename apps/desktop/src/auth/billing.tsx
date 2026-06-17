import { createContext, type ReactNode, useContext, useMemo } from "react";

export type BillingAccess = {
  isPaid: true;
  isPro: true;
  isTrialing: false;
  plan: "pro";
  trialEnd: null;
  trialDaysRemaining: null;
  isReady: true;
  canStartTrial: { data: false; isPending: false };
  upgradeToPro: () => void;
};

const LOCAL_BILLING: BillingAccess = {
  isPaid: true,
  isPro: true,
  isTrialing: false,
  plan: "pro",
  trialEnd: null,
  trialDaysRemaining: null,
  isReady: true,
  canStartTrial: { data: false, isPending: false },
  upgradeToPro: () => {},
};

const BillingContext = createContext<BillingAccess>(LOCAL_BILLING);

export function BillingProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => LOCAL_BILLING, []);

  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  );
}

export function useBillingAccess() {
  return useContext(BillingContext);
}
