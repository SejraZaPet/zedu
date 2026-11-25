import type { ReactNode } from "react";
import DashboardBanners from "./DashboardBanners";

/**
 * Shared dashboard greeting row (teacher + student).
 * Desktop (lg+): identity | banner (fills the gap, max 560 px) | actions.
 * Narrower: banner wraps below the greeting in its compact form.
 * Without a visible banner the slot renders nothing, so the row looks as before.
 */
export function DashboardGreetingHeader({ identity, actions, showBanners = true }: { identity: ReactNode; actions?: ReactNode; showBanners?: boolean }) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-4" data-testid="dashboard-greeting-header">
      <div className="min-w-0 flex-[1_1_auto] lg:flex-none">{identity}</div>
      {showBanners && (
        <DashboardBanners
          inline
          className="order-last basis-full max-w-[720px] lg:order-none lg:basis-0 lg:flex-1 lg:max-w-[560px] lg:min-w-[280px]"
        />
      )}
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export default DashboardGreetingHeader;
