import type { Metadata } from "next";
import 'bootstrap/dist/css/bootstrap.min.css';
import "./globals.css";

export const metadata: Metadata = {
  title: "Nota Pembatalan Pajak Generator",
  description: "A professional tool to generate tax cancellation notes with AI extraction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
