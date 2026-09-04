import "./globals.css";
import { Cinzel_Decorative, Uncial_Antiqua } from "next/font/google";
import { getCurrentUser } from "@/lib/auth/index";
import { AuthProvider } from "@/components/AuthProvider/AuthProvider";
import Navigation from "@/components/Navigation/Navigation";
import Link from "next/link";
import CurrentGold from "@/components/CurrentGold/CurrentGold";

const cinzel = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-cinzel",
});

const uncial = Uncial_Antiqua({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-uncial",
});

export const metadata = {
  title: "Harkonian's Dazzling Emporium",
  description: "A fantasy marketplace for magical wares, relics, and adventuring supplies.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Harkonian's Dazzling Emporium"
  }
};

export const viewport = {
  themeColor: "#2d1e14"
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();
  
  const initialAuthState = {
    isAuthenticated: !!currentUser,
    isDM: currentUser?.role === 'DM',
    user: currentUser,
  };

  return (
    <html lang="en" className={`${cinzel.variable} ${uncial.variable}`}>
      <body>
        <AuthProvider initialAuthState={initialAuthState}>
          <header className="site-header">
            <Navigation />
          </header>
          <CurrentGold />
          <main className="page-shell">{children}</main>
          <footer className="site-footer">
            <div className="site-footer__inner">
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <Link href="/find-me">Find Me</Link>
                <span>{"© 1492 SGD Harkonian's Dazzling Emporium. All curses disclosed where legally required."}</span>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}