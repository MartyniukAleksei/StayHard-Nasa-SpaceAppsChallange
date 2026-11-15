import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * A new page opens at the top, not at the height the link was clicked from.
 * Back/forward keep the browser's restored position; links with #section scroll to it themselves;
 * changing only the query (explorer filters, compare ids) keeps the current position.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const nav = useNavigationType();
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current === pathname) return; // same page, only the query or the hash changed
    last.current = pathname;
    if (nav === "POP" || hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, nav]);
  return null;
}
