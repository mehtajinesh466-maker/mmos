import type { Metadata } from 'next';
import '../index.css';
import '../App.css';
import { Providers } from '../components/Providers';

export const metadata: Metadata = {
  title: 'Master Moves OS',
  description: 'Academy Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
