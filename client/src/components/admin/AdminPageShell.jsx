import axios from 'axios';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

function AdminPageShell({
  title,
  description,
  icon: Icon,
  children,
  backTo = '/admin/dashboard',
  backLabel = 'Dashboard',
  actions = null,
  maxWidth = 'max-w-7xl',
}) {
  const navigate = useNavigate();


  const handleLogout = async () => {
    try {
      await axios.post('/api/admin/logout');
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-periwinkle p-6">

      <div className={`mx-auto ${maxWidth}`}>


        <div className="mb-6 flex flex-col gap-4 rounded-[28px] bg-white p-6 shadow-sm dark:bg-slate-800 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-4">
            {backTo ? (
              <div>
                <Link
                  to={backTo}
                  className="inline-flex items-center gap-2 rounded-full border border-mist bg-pearl px-4 py-2 text-sm font-medium text-police transition hover:border-silver-lake hover:text-maastricht dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:text-slate-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {backLabel}
                </Link>
              </div>
            ) : null}

            <div className="flex items-start gap-4">
              {Icon ? (
                <div className="rounded-2xl bg-seafoam p-3 text-maastricht dark:bg-slate-700 dark:text-slate-200">
                  <Icon className="h-6 w-6" />
                </div>
              ) : null}

              <div className="min-w-0">
                {title ? (
                  <h1 className="text-2xl font-semibold text-maastricht dark:text-slate-100">
                    {title}
                  </h1>
                ) : null}
                {description ? (
                  <p className="mt-1 text-sm text-police dark:text-slate-400">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            {actions}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-maastricht px-4 py-2 text-sm font-semibold text-white transition hover:bg-police dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

export default AdminPageShell;
