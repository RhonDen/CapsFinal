import axios from 'axios';
import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  Clock3,
  Facebook,
  Github,
  HeartPulse,
  Instagram,
  Mail,
  Phone,
  ShieldCheck,
  Smile,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AboutClinicSection from '../components/AboutClinicSection.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import { FEATURED_SERVICES } from '../constants/services.js';
import { formatServiceLabel } from '../utils/schedule.js';
import teamMember1 from '../assets/team-member-1.svg';
import teamMember2 from '../assets/team-member-2.svg';
import teamMember3 from '../assets/team-member-3.svg';

import jester from '../assets/jester.png';
import rhon from '../assets/rhon.png';
import rainiel from '../assets/rainiel.png';

const team = [
  {
    name: 'Rhon Denver Dulay',
    role: 'Front end and Back end Developer',
    photo: rhon,
    facebook: 'https://www.facebook.com/share/1MjzDwpABn/',
    instagram: 'https://www.instagram.com/rhden.xo?igsh=MTBid2tweGE0cDZ4YQ==',
    github: 'https://github.com/RhonDen',
  },
  {
    name: 'Jester Parino',
    role: 'UI and UX Designer',
    photo: jester,
    facebook: 'https://www.facebook.com/jester.parino.3',
    instagram: 'https://www.instagram.com/jest_parino/',
    github: 'https://github.com/Jesrino',
  },
  {
    name: 'Rainiel Welch Mendoza',
    role: 'Research And Database',
    photo: rainiel,
    facebook: 'https://www.facebook.com/Extraordina.rain.69',
    instagram: '',
    github: '',
  },
];

import PublicDarkModeToggle from '../components/PublicDarkModeToggle.jsx';

// Add Spline hero background as a lightweight visual layer.
const SplineHero = () => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return (
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_20%,rgba(142,199,234,0.25),transparent_40%)]" />
      </div>
    );
  }

  // Avoid runtime errors if the Spline web component isn't registered.
  // The page will still look good without the hero animation.
  return (
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
};


function LandingPage() {
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [contactStatus, setContactStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleContactSubmit = async (event) => {
    event.preventDefault();

    // Extra safety: if user double-clicks or submits again quickly,
    // keep it from sending again.
    if (submitting) return;

    if (!contactForm.name.trim() || !contactForm.email.trim()) {
      setContactStatus({
        type: 'error',
        message: 'Please add your name and email before sending the message.',
      });
      return;
    }

    setSubmitting(true);
    setContactStatus({ type: '', message: '' });

    try {
      const response = await axios.post('/api/contact/messages', contactForm);
      setContactStatus({ type: 'success', message: response.data.message });
      setContactForm({ name: '', email: '', message: '' });
    } catch (requestError) {
      setContactStatus({
        type: 'error',
        message: requestError.response?.data?.error || 'Unable to send your message right now.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleContactChange = (event) => {
    const { name, value } = event.target;
    setContactForm((current) => ({ ...current, [name]: value }));
    if (contactStatus.message) {
      setContactStatus({ type: '', message: '' });
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f7fbff_0%,#f9fcff_100%)] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <PublicDarkModeToggle />

      <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(142,199,234,0.45),_transparent_28%),linear-gradient(135deg,_#061A2C,_#0B2B45_45%,_#123C66_100%)] px-6 py-24 text-white sm:px-8 lg:px-10 dark:text-slate-100">
        <SplineHero />

        {/* Dark-blue layered atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.16),transparent_25%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_90%,rgba(14,116,144,0.18),transparent_35%)]" />
        <div className="absolute -left-10 top-16 h-44 w-44 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:48px_48px]"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur">
            <Sparkles className="h-4 w-4 text-cyan-200" />
            Trusted care, made effortless
          </div>

          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="text-left">
              <h1 className="mb-3 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                Dents-City
              </h1>
              <p className="mb-4 max-w-2xl text-lg font-medium text-cyan-100 md:text-xl">
                In a city full of smiles, we care with warmth, clarity, and confidence.
              </p>

              <p className="mx-auto mb-8 max-w-2xl text-lg text-cyan-50/90 md:text-xl lg:mx-0">
                Book your dental appointment in minutes, receive fast SMS confirmation,
                and enjoy a polished experience designed around comfort and trust.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/booking"
                  className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-lg font-semibold text-maastricht shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-50"
                >
                  <Calendar className="mr-2 h-5 w-5" />
                  Book Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <a
                  href="#services"
                  className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-7 py-3 text-lg font-semibold text-white backdrop-blur transition hover:bg-white/20"
                >
                  Explore Services
                </a>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/15 bg-white/10 p-6 shadow-[0_18px_60px_rgba(3,15,34,0.25)] backdrop-blur">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-white/15 p-3">
                  <Smile className="h-6 w-6 text-cyan-100" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100">
                    What you can expect
                  </p>
                  <p className="text-xl font-semibold text-white">
                    Comfort, clarity, and care in every visit
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  {
                    title: 'Online booking',
                    text: 'Reserve your appointment quickly with a simple, guided flow.',
                    icon: ShieldCheck,
                  },
                  {
                    title: 'Services you need',
                    text: 'From preventive care to restorative treatment, everything is clearly laid out.',
                    icon: Clock3,
                  },
                  {
                    title: 'Open communication',
                    text: 'We keep patients informed, supported, and comfortable at every step.',
                    icon: HeartPulse,
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/15 p-4"
                  >
                    <div className="mt-0.5 rounded-xl bg-white/15 p-2">
                      <item.icon className="h-4 w-4 text-cyan-100" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="text-sm text-cyan-50/80">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { label: 'Same-day booking', value: '24/7' },
              { label: 'Patient satisfaction', value: '98%' },
              { label: 'Verified care', value: 'Secure' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-sm text-cyan-100">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AboutClinicSection />

      <section id="services" className="px-6 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="Our Services" />

          <div className="mt-6 rounded-[32px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_20px_60px_-28px_rgba(12,36,61,0.22)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
            <p className="max-w-3xl text-lg leading-relaxed text-police dark:text-slate-200">
              From preventive care to restorative treatment planning, the clinic offers
              dental services that support healthy smiles at every stage.
            </p>

            <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {FEATURED_SERVICES.map((service) => {
                const [name, duration] = formatServiceLabel(service).split(' - ');

                return (
                  <div
                    key={service}
                    className="group rounded-[24px] border border-slate-200/80 bg-[linear-gradient(145deg,#ffffff,#f5fbff)] p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800/80"
                  >
                    <div className="mb-4 inline-flex rounded-2xl bg-cyan-50 p-3 text-cyan-700 transition group-hover:scale-105 dark:bg-slate-700 dark:text-cyan-200">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-8 lg:px-10">
        <SectionHeading title="Meet Our Team" />

        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {team.map((member) => (
            <div
              key={member.name}
              className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_16px_40px_-24px_rgba(12,36,61,0.28)] transition hover:-translate-y-1 hover:shadow-[0_24px_50px_-20px_rgba(12,36,61,0.32)] dark:border-slate-700 dark:bg-slate-800"
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
                <p className="mb-4 text-silver-lake dark:text-cyan-200">
                  {member.role}
                </p>

                <div className="flex gap-3">
                  <a
                    href={member.facebook}
                    target="_blank"
                    rel="noreferrer"
                    className="text-police transition hover:text-silver-lake dark:text-slate-200 dark:hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950"
                    aria-label={`${member.name} Facebook link`}
                    title="Facebook"
                  >
                    <Facebook className="h-5 w-5" />
                  </a>
                  <a
                    href={member.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="text-police transition hover:text-silver-lake dark:text-slate-200 dark:hover:text-cyan-200"
                    aria-label={`${member.name} Instagram`}
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noreferrer"
                    className="text-police transition hover:text-silver-lake dark:text-slate-200 dark:hover:text-cyan-200"
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

      <section id="contact" className="px-6 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="Contact" icon={Mail} />

          <div className="grid gap-8 rounded-[32px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_20px_60px_-28px_rgba(12,36,61,0.22)] backdrop-blur lg:grid-cols-[0.85fr_1.15fr] dark:border-slate-700 dark:bg-slate-900/70">
            <div className="rounded-[24px] bg-[linear-gradient(135deg,#0C243D,#2d5d8a)] p-8 text-white">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100">
                We’re here to help
              </p>
              <h3 className="mb-4 text-2xl font-semibold">
                Friendly support for every step of your dental care journey.
              </h3>
              <p className="mb-6 text-cyan-50/90">
                Whether you need a routine cleaning or a restorative visit, our team is ready to help you feel confident in your plan.
              </p>
              <div className="space-y-3 text-sm text-cyan-50/90">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  +63 912 345 6789
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  hello@dents-city.com
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-6 dark:border-slate-700 dark:bg-slate-800/70">
              <form className="space-y-5" onSubmit={handleContactSubmit}>
                <input
                  type="text"
                  name="name"
                  placeholder="Your Name"
                  value={contactForm.name}
                  onChange={handleContactChange}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-police focus:outline-silver-lake dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
                  required
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  value={contactForm.email}
                  onChange={handleContactChange}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-police focus:outline-silver-lake dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
                  required
                />
                <textarea
                  rows={4}
                  name="message"
                  placeholder="Your Message"
                  value={contactForm.message}
                  onChange={handleContactChange}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-police focus:outline-silver-lake dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
                  required
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-maastricht px-8 py-3 font-semibold text-white transition hover:bg-police disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  <Phone className="h-5 w-5" />
                  {submitting ? 'Sending...' : 'Send Message'}
                </button>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Messages are sent directly to the admin inbox.
                </p>
              </form>

              {contactStatus.message ? (
                <p className={`mt-4 text-sm ${contactStatus.type === 'success' ? 'text-green-700 dark:text-emerald-300' : 'text-red-700 dark:text-rose-300'}`}>
                  {contactStatus.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;

