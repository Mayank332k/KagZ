import { useRef, useMemo } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { cn } from "../../lib/utils";

const sizeClasses = {
  sm: "text-lg md:text-xl",
  md: "text-xl md:text-2xl lg:text-3xl",
  lg: "text-2xl md:text-3xl lg:text-4xl xl:text-5xl",
  xl: "text-3xl md:text-4xl lg:text-5xl xl:text-6xl",
  "2xl": "text-4xl md:text-5xl lg:text-6xl xl:text-7xl",
};

const alignClasses = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const variantClasses = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  accent: "text-accent-foreground",
  primary: "text-primary",
};

function ScrollReveal({
  children,
  containerClassName,
  textClassName,
  enableBlur = true,
  baseOpacity = 0,
  baseRotation = 0,
  blurStrength = 4,
  staggerDelay = 0.02,
  threshold = 0.1,
  duration = 0.4,
  springConfig = {
    damping: 25,
    stiffness: 100,
    mass: 1,
  },
  size = "sm",
  align = "left",
  variant = "default",
  autoAnimate = true,
}) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, {
    amount: threshold,
    once: true
  });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const rotation = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [baseRotation, 0, 0]
  );

  const splitText = useMemo(() => {
    const text = typeof children === "string" ? children : "";
    return text.split(/(\s+)/).map((part, index) => {
      return {
        value: part,
        isSpace: part.match(/^\s+$/) && part.length > 0,
        originalIndex: index,
      };
    }).filter(item => item.value.length > 0);
  }, [children]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.05,
      },
    },
  };

  const wordVariants = {
    hidden: {
      opacity: baseOpacity,
      filter: enableBlur ? `blur(${blurStrength}px)` : "blur(0px)",
      y: 12,
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        ...springConfig,
        duration,
      },
    },
  };

  const shouldAnimate = autoAnimate || isInView;

  return (
    <motion.div
      ref={containerRef}
      style={baseRotation !== 0 ? { rotate: rotation } : undefined}
      className={cn(
        "transform-gpu select-none pointer-events-none",
        containerClassName
      )}
    >
      <motion.p
        className={cn(
          "leading-relaxed select-none",
          sizeClasses[size],
          alignClasses[align],
          variantClasses[variant],
          textClassName
        )}
        variants={containerVariants}
        initial="hidden"
        animate={shouldAnimate ? "visible" : "hidden"}
      >
        {splitText.map((item) => (
          item.isSpace ? (
            <span key={`space-${item.originalIndex}`}>{item.value}</span>
          ) : (
            <motion.span
              key={`word-${item.originalIndex}`}
              className="inline-block select-none"
              variants={wordVariants}
            >
              {item.value}
            </motion.span>
          )
        ))}
      </motion.p>
    </motion.div>
  );
}

export default ScrollReveal;