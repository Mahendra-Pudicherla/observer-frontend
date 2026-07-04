export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Let each auth page own its own full-screen split layout
  return <>{children}</>;
}

