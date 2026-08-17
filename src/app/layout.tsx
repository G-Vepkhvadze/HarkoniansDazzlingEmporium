import "./globals.css";
import { Cinzel_Decorative, Uncial_Antiqua } from "next/font/google";
import Navigation from "@/components/Navigation/Navigation";
import Link from "next/link";
import AdminLink from "@/components/AdminLink/AdminLink";
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cinzel.variable} ${uncial.variable}`}>
      <body>
        <header className="site-header">
          <Navigation />
        </header>
        <CurrentGold />
        <main className="page-shell">{children}</main>
        <footer className="site-footer">
          <div className="site-footer__inner">
            <div>
              <strong>Business deals:</strong> guild bulk discounts, caravan delivery contracts, wizard tower restocks.
            </div>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <Link href="/find-me">Contact us</Link>
              <span>{"© 1492 SGD Harkonian's Dazzling Emporium. All curses disclosed where legally required."}</span>
            </div>
            <AdminLink />
          </div>
        </footer>
      </body>
    </html>
  );
}