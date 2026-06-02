import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'MoveHome.org — The Non-Profit Behind RAIA Protocol',
  description: 'Move Home Organisation CIC (Co. No. 17202438) is a UK Community Interest Company. Asset-locked, mission-bound.',
  icons: {
    icon: '/branding/icon.svg'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
