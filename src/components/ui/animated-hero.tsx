"use client"

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["intelligent", "automated", "streamlined", "powerful", "smart"],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="w-full bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-800">
      <div className="container mx-auto px-4">
        <div className="flex gap-8 py-20 lg:py-40 items-center justify-center flex-col">
          <div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Expense Management</span>
            </div>
          </div>
          <div className="flex gap-4 flex-col">
            <h1 className="text-5xl md:text-7xl max-w-3xl tracking-tighter text-center font-regular">
              <span className="text-blue-600 dark:text-blue-400">Spending management</span>
              <span className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-semibold text-blue-600 dark:text-blue-400"
                    initial={{ opacity: 0, y: "-100" }}
                    transition={{ type: "spring", stiffness: 50 }}
                    animate={
                      titleNumber === index
                        ? {
                            y: 0,
                            opacity: 1,
                          }
                        : {
                            y: titleNumber > index ? -150 : 150,
                            opacity: 0,
                          }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
              <span className="block mt-2">for your business</span>
            </h1>

            <p className="text-lg md:text-xl leading-relaxed tracking-tight text-neutral-600 dark:text-neutral-400 max-w-2xl text-center mx-auto">
              Stop wasting time on manual expense tracking. Upload invoices, let AI extract the details, 
              auto-categorize expenses, and send payments—all in one place. Streamline your company's 
              spending management with intelligent automation.
            </p>
          </div>
          <div className="flex flex-row gap-3 flex-wrap justify-center">
            <Button size="lg" className="gap-2" asChild>
              <Link href="/ask">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" className="gap-2" variant="outline" asChild>
              <Link href="/expenses">
                View Demo
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };

