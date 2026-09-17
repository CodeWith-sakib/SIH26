import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ASSETS } from '../../assets/assets';
import { useAccessibility } from '../../context/AccessibilityContext';

const SLIDES = [
  { src: ASSETS.heroHeritage, alt: 'Maharashtra heritage and connected citizen services' },
  { src: ASSETS.multiDeptBanner, alt: 'Many Departments, One Platform, A Brighter Maharashtra' },
  { src: ASSETS.connectedMaharashtraBanner, alt: 'A connected Maharashtra works for people' }
];

type Direction = 'next' | 'previous';

export const HeroBannerCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<Direction>('next');
  const [moving, setMoving] = useState(false);
  const [entered, setEntered] = useState(false);
  const animationTimer = useRef<number>();
  const { pauseAnimations } = useAccessibility();

  const startTransition = (nextIndex: number, nextDirection: Direction) => {
    if (moving || nextIndex === currentIndex) return;
    setDirection(nextDirection);
    setIncomingIndex(nextIndex);
    setMoving(true);
    setEntered(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true));
    });
    animationTimer.current = window.setTimeout(() => {
      setCurrentIndex(nextIndex);
      setIncomingIndex(null);
      setMoving(false);
      setEntered(false);
    }, 720);
  };

  useEffect(() => () => {
    if (animationTimer.current) window.clearTimeout(animationTimer.current);
  }, []);

  useEffect(() => {
    if (pauseAnimations || moving) return;
    const timer = window.setTimeout(() => {
      startTransition((currentIndex + 1) % SLIDES.length, 'next');
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [currentIndex, moving, pauseAnimations]);

  const showNext = () => startTransition((currentIndex + 1) % SLIDES.length, 'next');
  const showPrevious = () => startTransition((currentIndex - 1 + SLIDES.length) % SLIDES.length, 'previous');

  const currentSlide = SLIDES[currentIndex];
  const incomingSlide = incomingIndex === null ? null : SLIDES[incomingIndex];

  return (
    <section aria-label="MahaSetu highlights" aria-roledescription="carousel" className="hero-carousel relative aspect-[3/1] w-full overflow-hidden">
      <div className="absolute inset-0">
        <img src={currentSlide.src} alt={currentSlide.alt} className="absolute inset-0 block h-full w-full object-cover" />
        {incomingSlide && (
          <img
            src={incomingSlide.src}
            alt={incomingSlide.alt}
            className="absolute inset-0 block h-full w-full object-cover transition-transform duration-700 ease-in-out"
            style={{
              transform: entered
                ? 'translateX(0)'
                : `translateX(${direction === 'next' ? '100%' : '-100%'})`
            }}
          />
        )}
      </div>
      <button onClick={showPrevious} disabled={moving} aria-label="Previous banner" className="hero-arrow left-2 disabled:opacity-50 sm:left-6"><ChevronLeft /></button>
      <button onClick={showNext} disabled={moving} aria-label="Next banner" className="hero-arrow right-2 disabled:opacity-50 sm:right-6"><ChevronRight /></button>
      <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center rounded-full bg-slate-900/65 px-2 sm:bottom-4">
        {SLIDES.map((slide, index) => (
          <button
            key={slide.src}
            onClick={() => startTransition(index, index > currentIndex ? 'next' : 'previous')}
            disabled={moving || index === currentIndex}
            aria-label={`Go to banner ${index + 1}`}
            aria-current={currentIndex === index ? 'true' : undefined}
            className="flex h-8 w-8 items-center justify-center disabled:cursor-default"
          >
            <span className={`h-2 rounded-full ${currentIndex === index ? 'w-5 bg-white' : 'w-2 bg-white/60'}`} />
          </button>
        ))}
      </div>
    </section>
  );
};
