import React from "react";
import ComingSoon from "./components/ComingSoon";
import StoreHome from "./page.store.backup";

/**
 * ============================================================================
 * TEMPORARY COMING SOON DISPLAY MODE
 * ============================================================================
 * Currently set to true so the Coming Soon page is displayed on the live homepage.
 * 
 * IN THE FUTURE:
 * - Change `SHOW_COMING_SOON = false;` to restore the complete e-commerce store homepage.
 * - The Coming Soon design will automatically continue to serve all 404 routes via `app/not-found.tsx`.
 */
const SHOW_COMING_SOON = false;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Deluzex Lighting — Where Lights Become Art",
  description: "Crafted with exceptional materials and refined details to elevate modern living spaces. Explore chandeliers, wall lights, ceiling lights, lamps, and more.",
};

export default async function Home() {
  if (SHOW_COMING_SOON) {
    return <ComingSoon is404={false} />;
  }

  return <StoreHome />;
}

