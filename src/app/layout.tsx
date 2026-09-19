import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'REVUELTO — Extraordinary, from nothing',
  description: 'A cinematic, scroll-driven Lamborghini Revuelto assembly. Start with an empty stage. Build something extraordinary, piece by piece.',
  applicationName: 'Revuelto Assembly',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'REVUELTO — Extraordinary, from nothing',
    description: 'An independent, interactive 3D assembly concept.',
    type: 'website',
    images: [{ url: '/images/reference.webp', alt: 'Red and black Lamborghini visual reference' }]
  }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#090a0b' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
