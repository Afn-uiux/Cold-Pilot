"use client";

import { useEffect } from "react";

export default function NavManager() {
  useEffect(() => {
    const nav = document.getElementById("nav");
    const handler = () => nav?.classList.toggle("scrolled", scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });

    // Scroll reveal
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) { e.target.classList.add("in"); observer.unobserve(e.target); }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
      );
      document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    }

    const menu = document.getElementById("mobileMenu");
    const toggle = document.getElementById("navToggle");
    const close = document.getElementById("mobileClose");

    const open = () => {
      menu?.classList.add("open");
      toggle?.classList.add("hidden");
      document.body.style.overflow = "hidden";
    };
    const shut = () => {
      menu?.classList.remove("open");
      toggle?.classList.remove("hidden");
      document.body.style.overflow = "";
    };
    toggle?.addEventListener("click", open);
    close?.addEventListener("click", shut);
    menu?.addEventListener("click", (e) => { if (e.target === menu) shut(); });
    menu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", shut));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") shut(); });

    return () => {
      window.removeEventListener("scroll", handler);
      toggle?.removeEventListener("click", open);
      close?.removeEventListener("click", shut);
    };
  }, []);

  return null;
}
