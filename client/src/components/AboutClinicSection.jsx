import { motion } from 'framer-motion';
import { Building2, Eye, MapPin, Target } from 'lucide-react';
import SectionHeading from './SectionHeading.jsx';

// Render the article-style about section for the dental clinic landing page.
function AboutClinicSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      id="about"
      className="px-6 py-20"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="About Our Clinic"
          icon={Building2}
          className="justify-center text-center"
        />

        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl">
            <img
              src="/images/clinic-interior.jpg"
              alt="Modern dental office"
              className="h-auto w-full rounded-2xl object-cover shadow-lg transition-transform duration-300 hover:scale-105"
            />
          </div>

          <article className="space-y-4 text-lg leading-relaxed text-police dark:text-slate-200">
            <p className="first-letter:float-left first-letter:mr-2 first-letter:text-5xl first-letter:font-bold first-letter:leading-tight first-letter:text-maastricht dark:first-letter:text-slate-100">
              Dents-City was founded in 2018 with a single mission: to make
              dental care comfortable, transparent, and accessible. Our
              state-of-the-art clinic combines advanced technology with a
              patient-first philosophy.
            </p>
            <p>
              From routine cleanings to complex restorative procedures, our
              team of licensed dentists and hygienists delivers gentle, precise
              treatment in a relaxing environment. We believe that a healthy
              smile changes lives, and we’re here to help you achieve it.
            </p>
            <p className="italic text-silver-lake">
              — Dr. Alexandra Chen, Lead Dentist
            </p>
          </article>
        </div>

        <div className="mt-16 rounded-2xl bg-police p-8 text-white dark:text-slate-50">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-6">
              <div className="mb-4 inline-flex rounded-2xl bg-white/10 p-3">
                <Target className="h-6 w-6 text-periwinkle" />
              </div>
              <h3 className="mb-3 text-2xl font-semibold">Mission</h3>
              <p className="leading-relaxed text-periwinkle dark:text-periwinkle">
                To provide exceptional dental care with integrity, compassion,
                and the latest technology, ensuring every patient leaves with a
                healthier, brighter smile.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-6">
              <div className="mb-4 inline-flex rounded-2xl bg-white/10 p-3">
                <Eye className="h-6 w-6 text-periwinkle" />
              </div>
              <h3 className="mb-3 text-2xl font-semibold">Vision</h3>
              <p className="leading-relaxed text-periwinkle dark:text-periwinkle">
                To be the leading dental clinic in Baguio City, known for
                transforming dental visits into positive, pain-free
                experiences.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <SectionHeading
            title="Our Location"
            icon={MapPin}
            className="justify-center text-center"
          />

          <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <iframe
              title="Dents-City Location - Porta Vaga, Baguio City"
              className="h-96 w-full rounded-2xl"
              src="https://www.google.com/maps?output=embed&z=18&q=16.412571159905283%2C120.5983278710422"
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default AboutClinicSection;

