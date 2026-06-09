import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Preacher's Lens",
  description: "Sermon transcription and coaching analysis",
};

// Inject theme before first paint to avoid flash
const themeScript = `
  (function() {
    try {
      var t = localStorage.getItem('pl-theme') || 'berts-badness';
      document.documentElement.setAttribute('data-theme', t);
    } catch(e) {}
  })()
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en" suppressHydrationWarning data-theme="berts-badness">
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body className={inter.className}>
          <ThemeProvider>
            <ConvexClientProvider>
              {children}
              <Toaster richColors position="top-right" />
            </ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
