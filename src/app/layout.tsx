import "./globals.css";
import Navigation from "@/components/Navigation/Navigation";
import Link from "next/link";

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
      <html lang="en">
      <body>
      <header className="site-header">
        <Navigation />
      </header>
      <main className="page-shell">
        {children}
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <div>
            <strong>Business deals:</strong> guild bulk discounts, caravan delivery contracts, wizard tower restocks.
          </div>
          <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
            <Link href="/find-me">Contact us</Link>
            <span>© 1492 DR Harkonian&apos;s Dazzling Emporium. All curses disclosed where legally required.</span>
          </div>
          <Link href="/auth" className="help-link" aria-label="Admin login">?</Link>
        </div>
      </footer>
      </body>
      </html>
  );
}
