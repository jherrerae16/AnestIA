export const metadata = {
  title: 'AnestIA API',
  description: 'Backend de AnestIA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
