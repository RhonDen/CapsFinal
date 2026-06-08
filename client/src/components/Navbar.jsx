import axios from 'axios';
import {
  BarChart3,
  CalendarDays,
  CalendarX,
  LayoutDashboard,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import DarkModeToggle from './DarkModeToggle.jsx';

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isAdminRoute = location.pathname.startsWith('/admin');

  const isAdminLogin = location.pathname === '/admin/login';

  if (!isAdminRoute || isAdminLogin) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await axios.post('/api/admin/logout');
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/block-dates', label: 'Block Dates', icon: CalendarX },
    { to: '/admin/clients', label: 'Clients', icon: Users },
    { to: '/admin/walk-in', label: 'Walk-in', icon: UserPlus },
    { to: '/admin/data-analysis', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-maastricht/95 px-6 py-4 text-white shadow-md backdrop-blur dark:bg-slate-900/95 dark:border-slate-700">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Link
          to="/admin/dashboard"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <CalendarDays className="h-6 w-6 text-silver-lake" />
          <span>Dents-City Admin</span>
        </Link>

        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
          <div className="flex items-center gap-2 text-sm text-periwinkle">

            <ShieldCheck className="h-4 w-4 text-silver-lake" />
            <span>Protected admin workspace</span>
          </div>


          <div className="flex flex-wrap gap-2 lg:justify-end">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-silver-lake text-white'
                        : 'bg-white/5 text-periwinkle hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>


        </div>

      </div>
    </nav>
  );
}


export default Navbar;
