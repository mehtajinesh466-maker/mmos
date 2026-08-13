import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { db } from '../lib/db';

interface SidebarProps {
  activeCentre: string;
  setActiveCentre: (centreId: string) => void;
  currentUser: any;
  offlineCount: number;
  onSync: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeCentre,
  setActiveCentre,
  currentUser,
  offlineCount,
  onSync,
}) => {
  const centres = db.getCentres();
  const pathname = usePathname();
  const router = useRouter();

  // M16: Compute live action count (unpaid + expiring) to drive the Action Centre badge
  const actionCount = (() => {
    const students = db.getStudents();
    const packages = db.get<any>('packages');
    const unpaid = students.filter(s => (s.flags as any)?.unpaid_classes > 0).length;
    const expiring = students.filter(s => {
      const pkgs = packages.filter((p: any) => p.student_id === s.id && !p.frozen && p.kind !== 'unbilled' && p.kind !== 'settled');
      return pkgs.some((p: any) => {
        if (p.classes_remaining <= 0) return false;
        const pct = p.classes_total > 0 ? (p.classes_remaining / p.classes_total) * 100 : 0;
        return pct <= 20;
      });
    }).length;
    return unpaid + expiring;
  })();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  // Determine navigation items grouped by section based on current role (default deny principle)
  const getSidebarSections = () => {
    const role = currentUser.role;
    const sections: Array<{ title: string; items: Array<{ id: string; path: string; label: string; glyph: string; badge?: number }> }> = [];

    if (role === 'owner') {
      sections.push({
        title: 'OVERVIEW',
        items: [
          { id: 'dashboard', path: '/dashboard', label: 'Dashboard', glyph: '♦' },
          { id: 'executive', path: '/executive', label: 'Executive', glyph: '♛' }
        ]
      });
      sections.push({
        title: 'INPUT',
        items: [
          { id: 'register', path: '/registration', label: 'Register Student', glyph: '♙' },
          { id: 'package', path: '/packages', label: 'New / Renew Package', glyph: '♜' },
          { id: 'attendance', path: '/attendance', label: 'Attendance Entry', glyph: '♞', badge: offlineCount > 0 ? offlineCount : undefined },
          { id: 'progress', path: '/progress', label: 'Progress Log', glyph: '♝' },
          { id: 'enquiry', path: '/crm', label: 'Enquiry Intake', glyph: '♟' },
          { id: 'zoho', path: '/zoho', label: 'Zoho Import', glyph: '↓' },
          { id: 'centres_coaches', path: '/admin/users', label: 'Centres & Coaches', glyph: '❖' }
        ]
      });
      sections.push({
        title: 'OUTPUT — RAW DATA',
        items: [
          { id: 'student_reg', path: '/students', label: 'Student Register', glyph: '⚏' },
          { id: 'package_reg', path: '/package-register', label: 'Package Register', glyph: '⚏' },
          { id: 'attendance_reg', path: '/attendance-register', label: 'Attendance Register', glyph: '⚏' },
          { id: 'payment_unbilled', path: '/payment-unbilled', label: 'Payment & Unbilled', glyph: '❖' },
          { id: 'coach_reg', path: '/coach-register', label: 'Coach Register', glyph: '◎' }
        ]
      });
      sections.push({
        title: 'REPORTS',
        items: [
          { id: 'reports_centre', path: '/reports-centre', label: 'Reports Centre', glyph: '📤' },
          { id: 'explorer', path: '/explorer', label: 'Explorer', glyph: '◎' },
          { id: 'report_builder', path: '/analytics?tab=builder', label: 'Report Builder', glyph: '✚' },
          { id: 'audit_log', path: '/audit', label: 'Audit Log & Backups', glyph: '🛡️' }
        ]
      });
      sections.push({
        title: 'COACHING',
        items: [
          { id: 'schedules', path: '/schedule', label: 'Schedules', glyph: '▦' },
          { id: 'student_dashboard', path: '/student-dashboard', label: 'Student Dashboard', glyph: '♟' }
        ]
      });
    } else if (role === 'front_desk') {
      sections.push({
        title: 'ACTION',
        items: [
          { id: 'action_centre', path: '/action-centre', label: 'Action Centre', glyph: '♜', badge: actionCount > 0 ? actionCount : undefined }
        ]
      });
      sections.push({
        title: 'INPUT',
        items: [
          { id: 'register', path: '/registration', label: 'Register Student', glyph: '♙' },
          { id: 'package', path: '/packages', label: 'New / Renew Package', glyph: '♜' },
          { id: 'attendance', path: '/attendance', label: 'Attendance Entry', glyph: '♞', badge: offlineCount > 0 ? offlineCount : undefined },
          { id: 'enquiry', path: '/crm', label: 'Enquiry Intake', glyph: '♟' }
        ]
      });
      sections.push({
        title: 'OUTPUT',
        items: [
          { id: 'student_reg', path: '/students', label: 'Student Register', glyph: '⚏' },
          { id: 'package_reg', path: '/package-register', label: 'Package Register', glyph: '⚏' },
          { id: 'attendance_reg', path: '/attendance-register', label: 'Attendance Register', glyph: '⚏' },
          { id: 'payment_unbilled', path: '/payment-unbilled', label: 'Payment & Unbilled', glyph: '❖' },
          { id: 'coach_reg', path: '/coach-register', label: 'Coach Register', glyph: '◎' },
          { id: 'student_dashboard', path: '/student-dashboard', label: 'Student Dashboard', glyph: '♟' }
        ]
      });
      sections.push({
        title: 'COACHING',
        items: [
          { id: 'schedules', path: '/schedule', label: 'Schedules', glyph: '▦' }
        ]
      });
      sections.push({
        title: 'REPORTS',
        items: [
          { id: 'reports_centre', path: '/reports-centre', label: 'Reports Centre', glyph: '📤' }
        ]
      });
    } else if (role === 'coach') {
      sections.push({
        title: 'THIS WEEK',
        items: [
          { id: 'schedules', path: '/schedule', label: 'Weekly Schedule', glyph: '📅' },
          { id: 'attendance', path: '/attendance', label: 'Attendance Entry', glyph: '♞', badge: offlineCount > 0 ? offlineCount : undefined },
          { id: 'progress', path: '/progress', label: 'Progress Log', glyph: '♝' }
        ]
      });
      sections.push({
        title: 'MY STUDENTS',
        items: [
          { id: 'my_students', path: '/students', label: 'My Students', glyph: '⚏' },
          { id: 'student_dashboard', path: '/student-dashboard', label: 'Student Dashboard', glyph: '♟' }
        ]
      });
      sections.push({
        title: 'REPORTS',
        items: [
          { id: 'progress_report', path: '/progress-report', label: 'Progress Report', glyph: '◔' },
          { id: 'package_report', path: '/package-report', label: 'Package Utilisation', glyph: '▦' }
        ]
      });
    } else if (role === 'parent') {
      sections.push({
        title: 'PARENT PORTAL',
        items: [
          { id: 'dashboard', path: '/student-dashboard', label: 'Overview', glyph: '♟' },
          { id: 'attendance_register', path: '/attendance-register', label: 'Attendance', glyph: '♞' },
          { id: 'package_report', path: '/package-report', label: 'Package Status', glyph: '▦' },
          { id: 'progress_report', path: '/progress-report', label: 'Progress Reports', glyph: '◔' }
        ]
      });
    }

    return sections;
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Owner / Founder';
      case 'front_desk': return 'Front Desk Team';
      case 'coach': return 'Chess Coach';
      case 'parent': return 'Parent Portal';
      default: return 'User';
    }
  };

  return (
    <aside className="w-60 h-screen bg-fd border-r border-line flex flex-col overflow-hidden select-none">
      {/* Brand */}
      <div className="p-5 border-b border-line">
        <div className="text-xl font-bold tracking-tight font-display text-white">
          Master Moves <span className="text-brass">OS</span>
        </div>
        <div className="text-[9px] tracking-widest uppercase text-mint mt-1 font-semibold">
          Chess Academy Platform
        </div>
      </div>

      {/* Profile summary */}
      <div className="px-5 py-4 border-b border-line bg-fdd">
        <div className="text-[10px] tracking-wider uppercase text-mint/80 font-bold">
          Logged In As
        </div>
        <div className="text-sm font-semibold text-white mt-1 truncate">
          {currentUser.name}
        </div>
        <div className="text-[11px] text-brass font-medium mt-0.5">
          {getRoleLabel(currentUser.role)}
        </div>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {getSidebarSections().map((section, idx) => (
          <div key={idx} className="space-y-1">
            <div className="text-[10px] font-bold tracking-widest text-mint/55 uppercase px-3 pb-1">
              {section.title}
            </div>
            {section.items.map(item => {
              const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
              return (
                <Link key={item.id} href={item.path} className="block">
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-brass text-ink shadow-lg font-semibold'
                        : 'text-[#CFE3DC] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`text-base w-5 text-center ${isActive ? 'text-ink' : 'text-mint'}`}>
                      {item.glyph}
                    </span>
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="ml-auto text-[10px] bg-hot-custom text-white rounded-full px-2 py-0.5 font-bold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Centres Selector */}
      <div className="p-4 border-t border-line bg-fdd/50">
        <div className="text-[10px] font-bold tracking-wider text-mint/70 uppercase mb-2">
          Centre Focus
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(currentUser.role === 'owner' || currentUser.role === 'front_desk') && (
            <button
              onClick={() => setActiveCentre('All')}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                activeCentre === 'All'
                  ? 'bg-forest border-mint text-white font-medium'
                  : 'bg-white/5 border-white/5 text-[#CFE3DC] hover:bg-white/10 hover:text-white'
              } cursor-pointer`}
            >
              All Centres
            </button>
          )}
          {centres.map(c => {
            const isActive = activeCentre === c.id;
            const isSoon = c.status === 'inactive';
            return (
              <button
                key={c.id}
                disabled={isSoon}
                onClick={() => !isSoon && setActiveCentre(c.id)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                  isActive
                    ? 'bg-forest border-mint text-white font-medium'
                    : 'bg-white/5 border-white/5 text-[#CFE3DC] hover:bg-white/10 hover:text-white'
                } ${isSoon ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {c.name}
                {isSoon && <span className="text-[8px] text-brass ml-1 font-bold">2027</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Logout Action */}
      <div className="p-4 border-t border-line">
        <button
          onClick={handleLogout}
          className="w-full py-2 bg-hot-custom/10 hover:bg-hot-custom/20 border border-hot-custom/20 text-white text-xs font-semibold rounded-lg transition-all"
        >
          Sign Out of Session
        </button>
      </div>
    </aside>
  );
};
