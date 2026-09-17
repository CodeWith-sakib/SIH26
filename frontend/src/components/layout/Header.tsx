import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  User as UserIcon,
  Menu,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  FileText,
  ShieldCheck,
  FolderLock,
  MessageSquare,
  Bell
  , Briefcase
} from 'lucide-react';
import { ASSETS } from '../../assets/assets';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { notificationsApi } from '../../api/notifications.api';
import { Notification } from '../../types/notification.types';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch, onOpenMobileMenu }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) { setNotifications([]); setUnreadCount(0); return; }
    let active = true;
    const load = () => notificationsApi.list().then(data => {
      if (active) { setNotifications(data.notifications); setUnreadCount(data.unreadCount); }
    }).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isAuthenticated, location.pathname]);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close profile dropdown on navigation
  useEffect(() => {
    setProfileOpen(false);
    setNotificationOpen(false);
  }, [location.pathname]);

  // Strictly the 4 main citizen navigation links
  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/departments', label: t('nav.departments') },
    { to: '/documents', label: t('nav.documents') },
    { to: '/grievances', label: t('nav.grievances') },
    { to: '/employment', label: 'Employment' }
  ];

  return (
    <header className="bg-white border-b border-gov-border sticky top-0 z-40 shadow-xs">
      <div className="max-w-portal mx-auto px-4 sm:px-6 lg:px-8 min-h-[84px] sm:min-h-[96px] flex items-center justify-between gap-2 sm:gap-6">
        {/* Left: Official MahaSetu Brand Identity using supplied asset */}
        <Link to="/" className="flex items-center gap-3 rounded-lg py-1">
          <img
            src={ASSETS.logo}
            alt="MahaSetu — Government of Maharashtra"
            className="h-[76px] sm:h-[88px] w-[76px] sm:w-[100px] object-contain rounded-md"
          />
        </Link>

        {/* Center/Right: Exactly 4 Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 h-full">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `relative px-4 py-2 text-[15px] xl:text-[16px] font-medium transition-colors h-full flex items-center ${
                  isActive
                    ? 'text-gov-blue font-semibold after:content-[""] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-gov-blue'
                    : 'text-gov-textPrimary hover:text-gov-blue'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}

          {/* Quick Search Icon Button in Nav */}
          <button
            onClick={onOpenSearch}
            className="flex items-center justify-center p-3 ml-2 text-gov-textSecondary hover:bg-gov-surface rounded-lg transition-colors cursor-pointer"
            title="Search Portal"
            aria-label="Search Portal"
          >
            <Search className="w-4 h-4 text-gov-blue" />
          </button>
        </nav>

        {/* Right Action: Auth / Profile Button */}
        <div className="flex items-center gap-1 sm:gap-3">
          {/* Mobile Search Icon */}
          <button
            onClick={onOpenSearch}
            className="lg:hidden p-2 rounded-lg text-gov-textSecondary hover:bg-gov-surface hover:text-gov-blue cursor-pointer"
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-gov-blue" />
          </button>

          {isAuthenticated && user ? (
            /* User Profile Menu */
            <div className="relative flex items-center" ref={profileRef}>
              <button
                onClick={() => { setNotificationOpen(!notificationOpen); setProfileOpen(false); }}
                className="relative p-2.5 mr-2 rounded-lg border border-gov-border hover:bg-gov-surface text-gov-blue"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-white" aria-hidden="true" />}
              </button>

              {notificationOpen && (
                <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white rounded-xl border border-gov-border shadow-portal-hover z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b flex justify-between items-center"><span className="text-sm font-bold text-gov-dark">Notifications</span>{unreadCount > 0 && <button className="text-xs text-gov-blue font-semibold" onClick={async () => { await notificationsApi.markAllRead(); setNotifications(items => items.map(item => ({ ...item, read: true }))); setUnreadCount(0); }}>Mark all read</button>}</div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? <p className="p-5 text-xs text-slate-500 text-center">No notifications yet.</p> : notifications.map(item => (
                      <button key={item._id} className={`w-full text-left px-4 py-3 border-b last:border-0 relative ${item.read ? 'bg-white text-slate-600' : 'bg-blue-50/70 text-slate-900'}`} onClick={async () => { if (!item.read) { await notificationsApi.markRead(item._id); setNotifications(items => items.map(n => n._id === item._id ? { ...n, read: true } : n)); setUnreadCount(count => Math.max(0, count - 1)); } setNotificationOpen(false); if (item.applicationId) navigate(`/applications/${item.applicationId}`); }}>
                        {!item.read && <span className="absolute top-4 right-3 w-2 h-2 rounded-full bg-red-600" />}
                        <span className={`block text-xs pr-4 ${item.read ? 'font-medium' : 'font-bold'}`}>{item.title}</span>
                        <span className="block text-[11px] mt-1 leading-relaxed">{item.message}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setProfileOpen(!profileOpen); setNotificationOpen(false); }}
                className="flex items-center gap-2.5 p-1.5 pl-3 rounded-lg border border-gov-border hover:bg-gov-surface transition-colors cursor-pointer"
                aria-expanded={profileOpen}
              >
                <div className="w-8 h-8 rounded-full bg-gov-blue text-white flex items-center justify-center font-bold text-xs">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-gov-textPrimary leading-tight truncate max-w-[120px]">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-gov-textSecondary capitalize">
                    {user.role}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-gov-border shadow-portal-hover py-2 z-50 animate-fade-in">
                  <div className="px-4 py-2 border-b border-gov-border">
                    <p className="text-xs font-bold text-gov-textPrimary truncate">{user.name}</p>
                    <p className="text-[11px] text-gov-textSecondary truncate">{user.email || user.phone}</p>
                  </div>

                  <div className="py-1">
                    <Link to="/employment" className="flex items-center gap-2.5 px-4 py-2 text-xs text-gov-textPrimary hover:bg-gov-surface hover:text-gov-blue"><Briefcase className="w-4 h-4 text-gov-blue" />Employment Services</Link>
                    <Link to="/citizen-passport" className="flex items-center gap-2.5 px-4 py-2 text-xs text-gov-textPrimary hover:bg-gov-surface hover:text-gov-blue"><ShieldCheck className="w-4 h-4 text-gov-blue" />Citizen Data Passport</Link>
                    <Link to="/profile" className="flex items-center gap-2.5 px-4 py-2 text-xs text-gov-textPrimary hover:bg-gov-surface hover:text-gov-blue"><UserIcon className="w-4 h-4 text-gov-blue" />My Profile</Link>
                    <Link to="/employment/applications" className="flex items-center gap-2.5 px-4 py-2 text-xs text-gov-textPrimary hover:bg-gov-surface hover:text-gov-blue"><FileText className="w-4 h-4 text-gov-blue" />Track Applications</Link>
                    <Link
                      to="/applications"
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-gov-textPrimary hover:bg-gov-surface hover:text-gov-blue"
                    >
                      <FileText className="w-4 h-4 text-gov-blue" />
                      My Applications
                    </Link>
                    <Link
                      to="/documents"
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-gov-textPrimary hover:bg-gov-surface hover:text-gov-blue"
                    >
                      <FolderLock className="w-4 h-4 text-gov-blue" />
                      Digital Vault
                    </Link>
                    {user.role === 'admin' || user.role === 'department_officer' ? (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs text-gov-textPrimary hover:bg-gov-surface hover:text-gov-blue"
                      >
                        <ShieldCheck className="w-4 h-4 text-gov-blue" />
                        Officer Console
                      </Link>
                    ) : null}
                  </div>

                  <div className="pt-1 border-t border-gov-border">
                    <button
                      onClick={() => {
                        logout();
                        navigate('/login');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 hover:bg-red-50 text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Compact Government Login / Register Button */
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-3 sm:px-5 py-2.5 bg-gov-blue hover:bg-gov-dark text-white text-sm font-medium rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              {t('nav.login')}
            </Link>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-gov-textPrimary hover:bg-gov-surface cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-6 h-6 text-gov-blue" />
          </button>
        </div>
      </div>
    </header>
  );
};
