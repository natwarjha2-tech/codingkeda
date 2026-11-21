import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionGuard from "@/components/SessionGuard";
import Providers from "@/components/Providers";
import { SITE_URL } from "@/app/lib/site";

const inter = Inter({ subsets: ["latin"] });

const DESCRIPTION =
  "Coding for school kids, Class 4 to 12. Short video lessons, quizzes, real Python, Java and C practice, medals, coins and certificates.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "CodingKida – Learn coding the fun way", template: "%s" },
  description: DESCRIPTION,
  keywords: ["coding for kids", "python for kids", "java for kids", "learn coding", "school coding classes", "India"],
  applicationName: "CodingKida",
  openGraph: {
    type: "website",
    siteName: "CodingKida",
    title: "CodingKida – Learn coding the fun way",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_IN",
    images: [{ url: "/logo.jpg", alt: "CodingKida" }],
  },
  twitter: { card: "summary", site: "@CodingKida4U", title: "CodingKida – Learn coding the fun way", description: DESCRIPTION, images: ["/logo.jpg"] },
  icons: { icon: "/logo.jpg", apple: "/logo.jpg" },
};

// Organisation details for search engines.
const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "CodingKida",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.jpg`,
  sameAs: ["https://youtube.com/@codingkida4u", "https://www.instagram.com/codingkida4u", "https://x.com/CodingKida4U"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD).replace(/</g, "\\u003c") }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <SessionGuard />
          {children}
        </Providers>
      </body>
    </html>
  );
}
