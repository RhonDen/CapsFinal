import { Facebook, Github, Instagram, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="bg-maastricht px-6 py-10 text-periwinkle">
      <div className="mx-auto grid max-w-7xl gap-8 text-sm md:grid-cols-3">
        <div>
          <h4 className="mb-3 text-lg font-semibold text-white">Dents-City</h4>
          <p className="leading-relaxed">
            Professional appointment scheduling with secure SMS verification.
          </p>
        </div>

        <div>
          <h5 className="mb-3 font-medium text-white">Links</h5>
          <ul className="space-y-2">
            <li>
              <a href="/#about" className="transition hover:text-white">
                About
              </a>
            </li>
            <li>
              <a href="/#services" className="transition hover:text-white">
                Services
              </a>
            </li>
            <li>
              <Link to="/booking" className="transition hover:text-white">
                Book Now
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h5 className="mb-3 font-medium text-white">Connect</h5>
          <div className="mb-4 flex gap-4">
            <a href="#" className="transition hover:text-silver-lake" aria-label="Facebook">
              <Facebook className="h-5 w-5" />
            </a>
            <a href="#" className="transition hover:text-silver-lake" aria-label="Instagram">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="#" className="transition hover:text-silver-lake" aria-label="GitHub">
              <Github className="h-5 w-5" />
            </a>
            <a
              href="mailto:info@appointease.com"
              className="transition hover:text-silver-lake"
              aria-label="Email"
            >
              <Mail className="h-5 w-5" />
            </a>
          </div>
          <Link
            to="/admin/login"
            className="text-xs opacity-70 transition hover:opacity-100"
          >
            Admin Portal
          </Link>
        </div>
      </div>

      <div className="mt-8 text-center text-xs opacity-50">
        &copy; {new Date().getFullYear()} Dents-City. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;
