function SectionHeading({ title, icon: Icon, className = '' }) {
  return (
    <h2
      className={`mb-6 flex items-center text-3xl font-semibold text-maastricht dark:text-slate-100 ${className}`}
    >
      {Icon ? <Icon className="mr-2 h-6 w-6 text-silver-lake" /> : null}
      {title}
    </h2>
  );
}

export default SectionHeading;
