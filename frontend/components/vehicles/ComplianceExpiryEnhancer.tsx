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
        if (card.dataset.expiryEnhanced === "1") return;

        const select = card.querySelector<HTMLSelectElement>("select");
        const date = card.querySelector<HTMLInputElement>('input[type="date"]');
        const title = card.querySelector<HTMLParagraphElement>("p");
        if (!select || !date || !title) return;

        card.dataset.expiryEnhanced = "1";
        select.style.display = "none";
        date.min = today;

        const shell = document.createElement("div");
        shell.className = "existing-active-control";

        const copy = document.createElement("div");
        copy.className = "existing-active-copy";
        copy.innerHTML = `<strong>Existing & Active?</strong><span>Turn ON only when this vehicle already has a valid ${title.textContent ?? "record"}.</span>`;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "existing-active-toggle";
        toggle.setAttribute("role", "switch");

        const sync = () => {
          const active = select.value !== "not_added" && Boolean(date.value);
          toggle.setAttribute("aria-checked", active ? "true" : "false");
          toggle.innerHTML = `<span>${active ? "ON" : "OFF"}</span><i></i>`;
          date.style.display = active ? "block" : "none";
          date.required = active;
          card.dataset.existingActive = active ? "1" : "0";
        };

        toggle.addEventListener("click", () => {
          const active = toggle.getAttribute("aria-checked") === "true";
          if (active) {
            dispatchValue(select, "not_added");
            dispatchValue(date, "");
          } else {
            dispatchValue(select, "active");
            date.style.display = "block";
            date.required = true;
            date.focus();
          }
          requestAnimationFrame(sync);
        });

        date.addEventListener("change", () => {
          if (date.value && date.value < today) {
            dispatchValue(date, "");
            date.setCustomValidity("Only a current/future expiry date can be entered here.");
            date.reportValidity();
            date.setCustomValidity("");
            return;
          }
          if (date.value) dispatchValue(select, "active");
          requestAnimationFrame(sync);
        });

        title.insertAdjacentElement("afterend", shell);
        shell.append(copy, toggle);
        sync();
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <style>{`
      #vehicle-step-4 .existing-active-control {
        display:flex; align-items:center; justify-content:space-between; gap:14px;
        margin:12px 0 0; padding:13px 14px; border:1px solid #dbe7f6;
        border-radius:15px; background:linear-gradient(135deg,#f8fbff,#eef5ff);
      }
      #vehicle-step-4 .existing-active-copy { display:flex; flex-direction:column; gap:3px; min-width:0; }
      #vehicle-step-4 .existing-active-copy strong { color:#0a2147; font-size:12px; font-weight:900; }
      #vehicle-step-4 .existing-active-copy span { color:#718096; font-size:9px; line-height:1.35; font-weight:650; }
      #vehicle-step-4 .existing-active-toggle {
        flex:0 0 auto; width:82px; height:38px; padding:4px 5px 4px 10px; border:0;
        border-radius:999px; display:flex; align-items:center; justify-content:space-between; gap:6px;
        background:#e5eaf2; color:#718096; cursor:pointer; font-size:9px; font-weight:900;
        box-shadow:inset 0 0 0 1px rgba(100,116,139,.14); transition:.2s ease;
      }
      #vehicle-step-4 .existing-active-toggle i {
        width:29px; height:29px; border-radius:50%; background:#fff;
        box-shadow:0 3px 9px rgba(15,23,42,.16); transition:.2s ease;
      }
      #vehicle-step-4 .existing-active-toggle[aria-checked="true"] {
        background:linear-gradient(90deg,#0d4fb8,#2878ec); color:#fff;
        box-shadow:0 8px 20px rgba(37,99,235,.24);
      }
      #vehicle-step-4 [data-existing-active="0"] { min-height:128px !important; opacity:.82; }
      #vehicle-step-4 [data-existing-active="1"] { border-color:#9fc3f5 !important; }
      #vehicle-step-4 input[type="date"] { animation:expiryReveal .18s ease; }
      @keyframes expiryReveal { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
    `}</style>
  );
}
