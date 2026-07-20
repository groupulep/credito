/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

export default function CosmicBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-slate-50/50">
      {/* Subtle minimalist glowing gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-100/30 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-100/20 blur-[120px]" />

      {/* Large, elegant, minimalist CrediULEP watermark background text */}
      <div className="absolute inset-0 flex items-center justify-center select-none overflow-hidden">
        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 0.05, scale: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="text-[14vw] font-black tracking-tighter text-purple-900 uppercase font-sans text-center"
        >
          CrediULEP
        </motion.h1>
      </div>
    </div>
  );
}

