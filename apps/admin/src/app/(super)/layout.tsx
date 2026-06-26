import { SuperShell } from '@/components/layout/super-shell';

export default function SuperLayout({ children }: { children: React.ReactNode }) {
  return <SuperShell>{children}</SuperShell>;
}
