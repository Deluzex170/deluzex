import type { Metadata, Viewport } from "next";
import { Libre_Caslon_Display, Italianno, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import ConditionalFooter from "./components/ConditionalFooter";
import { ReduxProvider } from "./store/ReduxProvider";
import CartSidebar from "./components/CartSidebar";
import MainSidebar from "./components/MainSidebar";
import UserLoginModal from "./components/UserLoginModal";
import ConsoleBanner from "./components/ConsoleBanner";
import VisitorTracker from "./components/VisitorTracker";
import CartSyncManager from "./components/CartSyncManager";

const libre = Libre_Caslon_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-libre",
});

const italianno = Italianno({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-italianno",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
});

import { AuthProvider } from "./context/AuthContext";
import { SidebarProvider } from "./context/SidebarContext";
import { WishlistProvider } from "./context/WishlistContext";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "deluzex — Where Lights becomes Design",
  description: "Discover lighting crafted with precision and elegance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${libre.variable} ${italianno.variable} ${hanken.variable}`} suppressHydrationWarning>
        <AuthProvider>
          <VisitorTracker />
          <SidebarProvider>
            <ReduxProvider>
              <WishlistProvider>
                <CartSyncManager />
                <Header />
                {children}
                <ConditionalFooter />
                <CartSidebar />
                <MainSidebar />
                <UserLoginModal />
                <ConsoleBanner />
              </WishlistProvider>
            </ReduxProvider>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
