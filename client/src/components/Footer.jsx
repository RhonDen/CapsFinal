function Footer() {
  return (
    <footer className="bg-maastricht px-6 py-10 text-periwinkle">
      <div className="mx-auto max-w-7xl text-center">
        <h4 className="mb-3 text-lg font-semibold text-white">Dents-City</h4>
        <p className="mx-auto max-w-md text-sm leading-relaxed">
          Professional appointment scheduling system with secure SMS verification for dental clinics.
        </p>
      </div>
      <div className="mt-8 text-center text-xs opacity-50">
        &copy; {new Date().getFullYear()} Dents-City. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;
