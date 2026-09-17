"use client";

import { motion } from "framer-motion";

function FloatingPaths({ position }: { position: number }) {
    // Generate fewer, more elegant paths
    const paths = Array.from({ length: 12 }, (_, i) => {
        // Distribute vertically but with some randomness for organic feel
        const yBase = (i / 12) * 100;        const yStart = yBase + (Math.random() * 5 - 2.5);
        // Create a gentle curve that spans the screen
        // Position 1 flows left to right, -1 flows right to left (visually)
        const curveHeight = 10 + Math.random() * 15;
        return {
            id: i,
            // Simple quadratic bezier for smooth flow
            d: `M -20 ${yStart} Q 50 ${yStart + (curveHeight * position)} 120 ${yStart}`,
            width: 0.5 + Math.random() * 0.5, // Thinner, more subtle lines
            opacity: 0.1 + Math.random() * 0.2, // Lower opacity
        };
    });

    return (
        <div className="absolute inset-0 pointer-events-none">
            <svg
                className="w-full h-full text-white"
                viewBox="0 0 100 100"
                fill="none"
                preserveAspectRatio="none"
            >
                <title>Background Paths</title>
                {paths.map((path) => (
                    <motion.path
                        key={path.id}
                        d={path.d}
                        stroke="currentColor"
                        strokeWidth={path.width}
                        strokeOpacity={path.opacity}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{
                            pathLength: [0, 1, 1, 0], // Draw in, stay, draw out
                            opacity: [0, path.opacity, path.opacity, 0],
                            pathOffset: [0, 0, 1, 1] // Move along the path
                        }}
                        transition={{
                            duration: 20 + Math.random() * 10,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "linear",
                            delay: Math.random() * 5,
                        }}
                    />
                ))}
            </svg>
        </div>
    );
}

export function BackgroundPaths() {
    return (
        <div className="fixed inset-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <div className="absolute inset-0">
                <FloatingPaths position={1} />
                <FloatingPaths position={-1} />
            </div>
        </div>
    );
}
