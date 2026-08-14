"use client";

import { useRef } from "react";

interface FeaturedCarouselProps {
  children: React.ReactNode;
}

export default function FeaturedCarousel({ children }: FeaturedCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="featured-carousel"
      aria-label="Featured deal carousel"
    >
      <div
        ref={trackRef}
        className="featured-carousel__track"
      >
        {children}
      </div>
    </div>
  );
}
