import React, { useState, useEffect } from 'react';
import { ArrowUp, Accessibility, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FloatingControlsProps {
  onOpenAccessibilityModal: () => void;
}

export const FloatingControls: React.FC<FloatingControlsProps> = ({ onOpenAccessibilityModal }) => {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <aside aria-label="Quick site utilities" className="fixed left-4 bottom-6 z-40 flex flex-col items-center gap-2.5">
      {/* Floating Accessibility Trigger */}
      <button
        onClick={onOpenAccessibilityModal}
        title="Accessibility Settings"
        aria-label="Open Accessibility Menu"
        className="w-11 h-11 rounded-full bg-gov-blue hover:bg-gov-dark text-white border-2 border-white shadow-portal-hover flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
      >
        <Accessibility className="w-5 h-5" />
      </button>

      {/* Floating Grievance/Help Trigger */}
      <Link
        to="/help"
        title="Help Center"
        aria-label="Help and Support"
        className="w-11 h-11 rounded-full bg-white hover:bg-gov-surface text-gov-blue border-2 border-gov-border shadow-portal flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
      >
        <HelpCircle className="w-5 h-5" />
      </Link>

      {/* Back to Top */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          title="Back to Top"
          aria-label="Scroll to top of page"
          className="w-11 h-11 rounded-full bg-gov-blue hover:bg-gov-dark text-white border-2 border-white shadow-portal-hover flex items-center justify-center transition-transform hover:scale-105 cursor-pointer animate-fade-in"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </aside>
  );
};
