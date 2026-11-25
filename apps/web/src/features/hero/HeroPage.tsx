import { useRef } from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { HeroHeader } from './HeroHeader.tsx';
import { ConsolePreview } from './ConsolePreview.tsx';
import { Principles } from './Principles.tsx';
import { useLenis } from './useLenis.ts';

const ease = [0.22, 1, 0.36, 1] as const;

function Backdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      <picture>
        <source type="image/avif" srcSet="/hero/mountains-960.avif 960w, /hero/mountains-1600.avif 1600w, /hero/mountains-2400.avif 2400w" sizes="100vw" />
        <img
          src="/hero/mountains-1600.webp"
          srcSet="/hero/mountains-960.webp 960w, /hero/mountains-1600.webp 1600w, /hero/mountains-2400.webp 2400w"
          sizes="100vw"
          alt=""
          fetchPriority="high"
          className="h-full w-full object-cover object-[50%_35%]"
        />
      </picture>
      {/* warm veil for legibility: darker under the header and fading into the page at the bottom */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,20,15,0.55)_0%,rgba(23,20,15,0.18)_28%,rgba(23,20,15,0.32)_55%,#17140F_96%)]" />
    </div>
  );
}

export function HeroPage() {
  useLenis();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -140]);
  const scale = useTransform(scrollYProgress, [0, 0.6], reduce ? [1, 1] : [0.965, 1]);
  const copyY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 60]);

  const rise = (delay: number) => ({ initial: { opacity: 0, y: reduce ? 0 : 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.1, delay, ease } });

  return (
    <div className="min-h-dvh">
      <div ref={ref} className="relative isolate">
        <Backdrop />
        <HeroHeader />
        <main id="main">
          <motion.section style={{ y: copyY }} className="mx-auto flex max-w-[1320px] flex-col items-center px-6 pt-[clamp(40px,8vh,96px)] text-center md:px-12">
            <motion.span {...rise(0.1)} className="label text-ink/75">
              ISS. 01 · Webhook infrastructure · 2026
            </motion.span>
            <motion.h1 {...rise(0.2)} className="display mt-6 max-w-[17ch] text-[clamp(48px,7vw,108px)] text-ink [text-wrap:balance]">
              Deliver every webhook with <em className="text-[#e9d9bf]">quiet,</em> unbreakable precision.
            </motion.h1>
            <motion.p {...rise(0.35)} className="mt-7 max-w-[46ch] text-[16px] leading-[1.6] text-ink/80">
              A routing and delivery queue for production webhooks: accepted in milliseconds, signed, retried with backoff, never silently lost.
            </motion.p>
            <motion.div {...rise(0.5)} className="mt-10 flex flex-wrap items-center justify-center gap-6">
              <Link to="/dashboard" className="group inline-flex h-12 items-center gap-3 bg-ink px-7 text-[14px] font-medium text-bg transition-colors hover:bg-[#f6efe2]">
                Launch sandbox
                <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <a href="#principles" className="link-quiet text-[14px] text-ink/85">
                How it holds ↓
              </a>
            </motion.div>
          </motion.section>

          <motion.div
            style={{ y, scale }}
            initial={{ opacity: 0, y: reduce ? 0 : 80 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.4, delay: 0.55, ease }}
            className="mx-auto mt-[clamp(40px,7vh,80px)] max-w-[1080px] origin-top px-4 md:px-12"
          >
            <ConsolePreview />
          </motion.div>
        </main>
      </div>
      <Principles />
    </div>
  );
}
