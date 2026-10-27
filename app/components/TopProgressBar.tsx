"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // When pathname or search query completes, finalize progress bar
  useEffect(() => {
    if (isVisible) {
      setProgress(100);
      const timeout = setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [pathname, searchParams]);

  // Intercept clicks on links across the entire website so that if a page takes > 0.3s - 1s, the loading bar shows immediately
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      const targetAttr = target.getAttribute("target");

      if (
        href &&
        !href.startsWith("#") &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:") &&
        !href.startsWith("http://") &&
        !href.startsWith("https://") &&
        targetAttr !== "_blank"
      ) {
        setIsVisible(true);
        setProgress(30);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 88) {
              if (timerRef.current) clearInterval(timerRef.current);
              return 88;
            }
            return prev + Math.floor(Math.random() * 12) + 6;
          });
        }, 180);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!isVisible && progress === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "3px",
        zIndex: 999999,
        pointerEvents: "none",
        background: "transparent",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, #D4A373, #E0531C, #C4924F)",
          boxShadow: "0 0 10px rgba(224, 83, 28, 0.7), 0 0 5px rgba(212, 163, 115, 0.5)",
          transition: progress === 100 ? "width 0.2s ease-out, opacity 0.3s ease-out" : "width 0.25s ease-out",
          opacity: isVisible ? 1 : 0,
          borderRadius: "0 2px 2px 0",
        }}
      />
    </div>
  );
}
