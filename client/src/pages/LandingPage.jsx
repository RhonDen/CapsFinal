import { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Facebook,
  Github,
  Instagram,
  Mail,
  Phone,
  Twitter,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AboutClinicSection from '../components/AboutClinicSection.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import { FEATURED_SERVICES } from '../constants/services.js';
import { formatServiceLabel } from '../utils/schedule.js';
import teamMember1 from '../assets/team-member-1.svg';
import teamMember2 from '../assets/team-member-2.svg';
import teamMember3 from '../assets/team-member-3.svg';

const team = [
  {
    name: 'Alexandra Chen',
    role: 'Lead Developer',
    photo: teamMember1,
    facebook: '#',
    instagram: '#',
    github: '#',
  },
  {
    name: 'Marcus Rivera',
    role: 'UX Designer',
    photo: teamMember2,
    facebook: '#',
    instagram: '#',
    github: '#',
  },
  {
    name: 'Priya Kapoor',
    role: 'Data Analyst',
    photo: teamMember3,
    facebook: '#',
    instagram: '#',
    github: '#',
  },
];

import PublicDarkModeToggle from '../components/PublicDarkModeToggle.jsx';

// Add Spline hero background as a lightweight visual layer.
const SplineHero = () => (
  <div
    className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    aria-hidden="true"
  >
    <spline-viewer
      url="https://prod.spline.design/9BNhFhTDvHT5pqDj/scene.splinecode"
      className="absolute inset-0 h-full w-full"
      style={{ transform: 'scale(1.08)' }}
    />
  </div>
);

function LandingPage() {
  const [contactSent, setContactSent] = useState(false);

  // Keep the contact demo local until a live submission endpoint is connected.
  const handleContactSubmit = (event) => {
    event.preventDefault();
    setContactSent(true);
  };

  return (
    <div className="relative min-h-screen bg-white dark:bg-slate-900 dark:text-slate-100">
      <PublicDarkModeToggle />

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(154,183,205,0.35),_transparent_35%),linear-gradient(135deg,_#0C243D,_#16395b)] px-6 py-24 text-center text-white dark:text-slate-100">
        <SplineHero />

        <div className="relative mx-auto max-w-5xl">
  

          <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Seamless Appointments,
            <br />
            Simplified.
          </h1>

          <p className="mx-auto mb-8 max-w-2xl text-lg text-periwinkle md:text-xl">
            Book your visit securely with SMS verification. Fast,
            professional, and always on time.
          </p>

          <Link
            to="/booking"
            className="inline-flex items-center rounded-full bg-silver-lake px-8 py-3 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-wild-blue"
          >
            <Calendar className="mr-2 h-5 w-5" />
            Book Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      <AboutClinicSection />

      {/* Services (no price) */}
      <section id="services" className="bg-periwinkle px-6 py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="Our Services" />

          <p className="max-w-3xl text-lg leading-relaxed text-police dark:text-slate-200">
            From preventive care to restorative treatment planning, the clinic
            offers dental services that support healthy smiles at every stage.
          </p>

          <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {FEATURED_SERVICES.map((service) => {
              const [name, duration] = formatServiceLabel(service).split(' - ');

              return (
                <div
                  key={service}
                  className="rounded-2xl bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:bg-slate-800"
                >
                  <h3 className="mb-2 text-xl font-semibold text-maastricht dark:text-slate-100">
                    {name}
                  </h3>
                  <p className="text-police dark:text-slate-200">
                    Duration: {duration}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading title="Meet Our Team" />

        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {team.map((member) => (
            <div
              key={member.name}
              className="overflow-hidden rounded-2xl bg-white shadow-md dark:bg-slate-800"
            >
              <img
                src={member.photo}
                alt={member.name}
                className="h-56 w-full object-cover"
              />

              <div className="p-6">
                <h3 className="text-xl font-semibold text-maastricht dark:text-slate-100">
                  {member.name}
                </h3>
                <p className="mb-4 text-silver-lake dark:text-silver-lake">
                  {member.role}
                </p>

                <div className="flex gap-3">
                  <a
                    href={member.facebook}
                    target="_blank"
                    rel="noreferrer"
                    className="text-police transition hover:text-silver-lake dark:text-slate-200 dark:hover:text-silver-lake"
                    aria-label={`${member.name} Facebook`}
                  >
                    <Facebook className="h-5 w-5" />
                  </a>
                  <a
                    href={member.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="text-police transition hover:text-silver-lake dark:text-slate-200 dark:hover:text-silver-lake"
                    aria-label={`${member.name} Instagram`}
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noreferrer"
                    className="text-police transition hover:text-silver-lake dark:text-slate-200 dark:hover:text-silver-lake"
                    aria-label={`${member.name} GitHub`}
                  >
                    <Github className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="contact"
        className="bg-periwinkle px-6 py-20 dark:bg-slate-900"
      >
        <div className="mx-auto max-w-3xl">
          <SectionHeading title="Contact" icon={Mail} />

          <div className="rounded-2xl bg-white p-8 shadow-md dark:bg-slate-800">
            <form className="space-y-5" onSubmit={handleContactSubmit}>
              <input
                type="text"
                placeholder="Your Name"
                className="w-full rounded-xl border border-gray-200 bg-white p-3 text-police focus:outline-silver-lake dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
                required
              />
              <input
                type="email"
                placeholder="Email Address"
                className="w-full rounded-xl border border-gray-200 bg-white p-3 text-police focus:outline-silver-lake dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
                required
              />
              <textarea
                rows={4}
                placeholder="Your Message"
                className="w-full rounded-xl border border-gray-200 bg-white p-3 text-police focus:outline-silver-lake dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
                required
              />

              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-maastricht px-8 py-3 font-semibold text-white transition hover:bg-police dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Phone className="h-5 w-5" />
                Send Message
              </button>
            </form>

            {contactSent ? (
              <p className="mt-4 text-sm text-green-700 dark:text-emerald-300">
                Message captured locally. Connect this form to your preferred
                support channel when you are ready.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;

