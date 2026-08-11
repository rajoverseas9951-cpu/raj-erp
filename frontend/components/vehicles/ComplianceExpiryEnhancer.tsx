"use client";

import { useEffect } from "react";

function dispatchValue(element: HTMLSelectElement | HTMLInputElement, value: string) {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function ComplianceExpiryEnhancer() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    const enhance = () => {
      const step = document.querySelector<HTMLElement>("#vehicle-step-4");
      if (!step) return;

      const cards = Array.from(step.querySelectorAll<HTMLElement>("section > div > div"));
      cards.forEach((card) => {
        const select = card.querySelector<HTMLSelectElement>("select");
        const date = card.querySelector<HTMLInputElement>('input[type="date"]');
        if (!select || !date) return;

        if (card.dataset.expiryEnhanced !== "1") {
          card.dataset.expiryEnhanced = "1";
          select.style.display = "none";
          select.setAttribute("aria-hidden", "true");
          date.min = today;
          date.required = false;

          date.addEventListener("change", () => {
            if (date.value && date.value < today) {
              dispatchValue(date, "");
              dispatchValue(select, "not_added");
              date.setCustomValidity("Only a current or future expiry date can be entered.");
              date.reportValidity();
              date.setCustomValidity("");
              return;
            }
            dispatchValue(select, date.value ? "active" : "not_added");
          });
        }

        select.style.display = "none";
        date.style.display = "block";
        date.min = today;
        card.dataset.hasExpiry = date.value ? "1" : "0";
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <style>{`
      #vehicle-step-4 section > div > div {
        min-height: 112px !important;
        padding: 16px !important;
      }
      #vehicle-step-4 section > div > div > select {
        display: none !important;
      }
      #vehicle-step-4 section > div > div > p {
        margin-bottom: 10px !important;
      }
      #vehicle-step-4 input[type="date"] {
        display: block !important;
        margin-top: 0 !important;
      }
    `}</style>
  );
}
