"use client";

import { useEffect } from "react";

export default function LandingInteractive() {
  useEffect(() => {
    // Nav scroll border
    const nav = document.getElementById("nav");
    const onScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });

    // Scroll reveal animations
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              observer.unobserve(e.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
      );
      document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    }

    // Mobile menu
    const menu = document.getElementById("mobileMenu");
    const toggle = document.getElementById("navToggle");
    const close = document.getElementById("mobileClose");

    if (menu && toggle && close) {
      const open = () => {
        menu.classList.add("open");
        toggle.style.display = "none";
        document.body.style.overflow = "hidden";
      };
      const shut = () => {
        menu.classList.remove("open");
        toggle.style.display = "";
        document.body.style.overflow = "";
      };
      toggle.addEventListener("click", open);
      close.addEventListener("click", shut);
      menu.addEventListener("click", (e) => { if (e.target === menu) shut(); });
      menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", shut));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") shut(); });
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
