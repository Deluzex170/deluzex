"use client";
import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();
  if (
    pathname?.startsWith("/admin") ||
    pathname?.includes("/dashboard") ||
    pathname?.includes("/login") ||
    pathname?.includes("/signup") ||
    pathname?.includes("/signin")
  ) {
    return null;
  }
  return <Footer />;
}
