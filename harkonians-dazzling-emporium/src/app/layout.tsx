import "./globals.css";
import Navigation from "@/components/Navigation/Navigation";

export default function RootLayout({
                                     children,
                                   }: {
  children: React.ReactNode;
}) {
  return (
      <html lang="en">
      <body>
      <header
          style={{
            padding: "20px",
            borderBottom:
                "1px solid #3a2418",
          }}
      >

        <Navigation />
      </header>

      <main
          style={{
            padding: "40px",
            maxWidth: "1200px",
            margin: "0 auto",
          }}
      >
        {children}
      </main>
      </body>
      </html>
  );
}