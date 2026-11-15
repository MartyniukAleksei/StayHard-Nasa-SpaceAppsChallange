import type { ReactNode } from "react";

/** Visible reminder for the team: content we decided to fill in later. Remove before demo. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <p className="placeholder" role="note">
      TODO (team): {children}
    </p>
  );
}
