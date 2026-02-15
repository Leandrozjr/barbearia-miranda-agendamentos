import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LoadingScreen({ onFinished }: { onFinished?: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          if (onFinished) onFinished();
          return 100;
        }
        return prev + 2; // Adjust speed here (50 steps * interval)
      });
    }, 30); // 30ms * 50 = ~1.5s total time

    return () => clearInterval(timer);
  }, [onFinished]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center"
      >
        <h1 className="font-serif text-4xl md:text-6xl tracking-wider mb-2 text-yellow-400">
          ESTÚDIO 3M
        </h1>
        <p className="font-sans text-gray-400 text-sm md:text-base tracking-widest uppercase mb-8">
          Carregando Experiência...
        </p>

        {/* Custom Barber Pole Progress Bar */}
        <div className="w-64 h-4 bg-gray-800 border-2 border-white/20 rounded-full overflow-hidden relative mx-auto">
          <motion.div 
            className="h-full barber-stripes absolute top-0 left-0"
            style={{ width: `${progress}%` }}
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="mt-2 text-xs text-gray-500 font-mono">
          {progress}%
        </div>
      </motion.div>
    </div>
  );
}
