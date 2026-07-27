import { Calendar, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PublicDarkModeToggle from './PublicDarkModeToggle.jsx';

function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const isLandingPage = location.pathname === '/';

  const navLinks = [
    { label: 'Home', href: '/', isRouter: true },
    { label: 'About', href: isLandingPage ? '#about' : '/#about', isRouter: false },
    { label: 'Services', href: isLandingPage ? '#services' : '/#services', isRouter: false },
    { label: 'Contact', href: isLandingPage ? '#contact' : '/#contact', isRouter: false },
    { label: 'Book Now', href: '/booking', isRouter: true },
  ];

  const handleHomeClick = () => {
    closeMobileMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderLink = (link, isMobile = false) => {
    const baseClasses = isMobile
      ? 'block rounded-xl px-4 py-3 text-sm font-medium transition'
      : 'rounded-full px-4 py-2 text-sm font-medium transition';

    const styleClasses =
      link.href === '/booking'
        ? `${baseClasses} bg-maastricht text-white hover:bg-police dark:bg-slate-700 dark:hover:bg-slate-600`
        : `${baseClasses} text-police hover:bg-slate-100 hover:text-maastricht dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white`;

    if (link.label === 'Home') {
      return (
        <Link
          key={link.href}
          to="/"
          onClick={handleHomeClick}
          className={styleClasses}
        >
          Home
        </Link>
      );
    }

    if (link.isRouter) {
      return (
        <Link
          key={link.href}
          to={link.href}
          onClick={closeMobileMenu}
          className={styleClasses}
        >
          {link.label}
        </Link>
      );
    }

    return (
      <a
        key={link.href}
        href={link.href}
        onClick={closeMobileMenu}
        className={styleClasses}
      >
        {link.label}
      </a>
    );
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link
          to="/"
          onClick={closeMobileMenu}
          className="flex items-center gap-2 text-xl font-bold tracking-tight text-maastricht dark:text-white"
        >
          <Calendar className="h-6 w-6 text-silver-lake" />
          <span>Dents-City</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => renderLink(link, false))}
          <div className="ml-2">
            <PublicDarkModeToggle />
          </div>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <PublicDarkModeToggle />
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="rounded-xl p-2 text-police transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mx-auto mt-3 max-w-7xl space-y-1 border-t border-slate-200 pt-3 md:hidden dark:border-slate-700">
          {navLinks.map((link) => renderLink(link, true))}
        </div>
      )}
    </nav>
  );
}

export default PublicNavbar;
