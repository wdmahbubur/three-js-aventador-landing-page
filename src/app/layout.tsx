import type { Metadata, Viewport } from 'next';
import { Manrope, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import './cabin.css';
import './showroom.css';
import './configurator.css';

const body = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-body' });
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], display: 'swap', variable: '--font-display' });
export const metadata: Metadata = {
  metadataBase: new URL('https://three-js-aventador-landing-page.vercel.app'),
  title: 'REVUELTO — Extraordinary, from nothing',
  description: 'A cinematic, scroll-driven Lamborghini Revuelto assembly. Start with an empty stage. Build something extraordinary, piece by piece.',
  applicationName: 'Revuelto Assembly',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'REVUELTO — Extraordinary, from nothing',
    description: 'An independent, interactive 3D assembly concept.',
    type: 'website',
    images: [{ url: '/images/reference.webp', width: 1440, height: 810, alt: 'Red and black Lamborghini visual reference' }]
  },
  icons: { icon: '/icon.svg' }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#090a0c' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${body.variable} ${display.variable}`}><body>{children}</body></html>;
}
