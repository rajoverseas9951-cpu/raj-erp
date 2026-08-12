"use client";

import { useEffect } from "react";

/**
 * Removes the legacy floating Dashboard shortcut that was injected across
 * vehicle/customer/service screens. The main ERP already has proper dashboard
 * navigation in the sidebar/header, so a fixed bottom-right pill only blocks
 * totals, actions and form controls.
 *
 * We intentionally remove only positioned/floating dashboard anchors and leave
 * normal sidebar, breadcrumb and header Dashboard links untouched.
 */
export default function LegacyDashboardShortcutCleaner() {
  useEffect(() => {
    const clean = () => {
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href="/dashboard"], a[href$="/dashboard"]'),
      );

      for (const link of links) {
        const style = window.getComputedStyle(link);
        const classes = link.className || "";
        const looksLegacyFloating =
          style.position === "fixed" ||
          style.position === "absolute" ||
          /\bfixed\b/.test(classes) ||
          /\bbottom-\d+\b/.test(classes) ||
          /\bright-\d+\b/.test(classes);

        if (looksLegacyFloating) {
          link.setAttribute("data-legacy-dashboard-shortcut", "hidden");
          link.style.setProperty("display", "none", "important");
        }
      }
    };

    clean();

    // Some route layouts mount the shortcut after hydration/navigation.
    const observer = new MutationObserver(clean);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
