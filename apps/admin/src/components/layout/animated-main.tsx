'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export function AnimatedMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex-1 overflow-hidden bg-[#F5F5F5] h-full"
    >
      {children}
    </motion.div>
  );
}
