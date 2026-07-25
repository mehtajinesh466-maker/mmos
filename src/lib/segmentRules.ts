/**
 * Master Moves OS — Student Status & Segment Tagging Rules
 *
 * Rules:
 * - HOT     = Overdue > 0, OR 0 active package, OR <= 2 classes left.
 * - WARM    = 3-6 classes left, OR no class in 30-60d.
 * - COLD    = no class in 60d+.
 * - HEALTHY = paid up (overdue == 0), 7+ classes left, attending (< 30d).
 *
 * Overdue Value = overdue classes x that student's most recent price-per-class
 *                 (median AED 100 used where no priced package exists).
 */

export interface StudentStatusResult {
  segment: 'HOT' | 'WARM' | 'COLD' | 'HEALTHY';
  overdueClasses: number;
  classesLeft: number;
  daysSinceLastClass: number;
  pricePerClass: number;
  overdueValue: number;
}

export function computeStudentStatus(
  student: any,
  packages: any[] = [],
  attendance: any[] = [],
  invoices: any[] = []
): StudentStatusResult {
  const studentPkgs = packages.filter(p => p.student_id === student.id && !p.frozen);
  const activePkgs = studentPkgs.filter(p => p.classes_remaining > 0);
  const classesLeft = studentPkgs.reduce((sum, p) => sum + p.classes_remaining, 0);
  const overdueClasses = (student.flags as any)?.unpaid_classes || 0;

  // Days since last class
  const today = new Date();
  let daysSinceLastClass = 999;
  if (student.last_attended) {
    const diffMs = today.getTime() - new Date(student.last_attended).getTime();
    daysSinceLastClass = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  } else {
    const studentAtts = attendance.filter(a => a.student_id === student.id && (a.status === 'present' || a.status === 'makeup'));
    if (studentAtts.length > 0) {
      const maxDate = studentAtts.reduce((latest, a) => {
        const d = new Date(a.date);
        return d > latest ? d : latest;
      }, new Date(0));
      daysSinceLastClass = Math.max(0, Math.floor((today.getTime() - maxDate.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  // Calculate most recent price-per-class
  let pricePerClass = 100; // default median
  if (studentPkgs.length > 0) {
    const sortedPkgs = [...studentPkgs].sort((a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime());
    for (const pkg of sortedPkgs) {
      if (pkg.classes_total > 0) {
        let price = 1000;
        if (pkg.tier_id) {
          const tiers = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('mmos_tiers') || '[]')) : [];
          const tier = tiers.find((t: any) => t.id === pkg.tier_id);
          if (tier && tier.price) price = Number(tier.price);
        }
        const discount = pkg.discount_pct ? Number(pkg.discount_pct) : 0;
        const netPrice = price * (1 - discount / 100);
        pricePerClass = Math.round(netPrice / pkg.classes_total);
        break;
      }
    }
  }

  // Overdue Value calculation
  const overdueValue = (student.flags as any)?.unpaid_value ?? (overdueClasses * pricePerClass);

  // Status tagging rules:
  // HOT     = Overdue > 0, OR 0 active package, OR <= 2 classes left
  // WARM    = 3-6 classes left, OR no class in 30-60d
  // COLD    = no class in 60d+
  // HEALTHY = paid up, 7+ classes left, attending (< 30d)

  let segment: 'HOT' | 'WARM' | 'COLD' | 'HEALTHY' = 'HEALTHY';

  if (overdueClasses > 0 || activePkgs.length === 0 || classesLeft <= 2) {
    segment = 'HOT';
  } else if (daysSinceLastClass >= 60) {
    segment = 'COLD';
  } else if ((classesLeft >= 3 && classesLeft <= 6) || (daysSinceLastClass >= 30 && daysSinceLastClass < 60)) {
    segment = 'WARM';
  } else {
    segment = 'HEALTHY';
  }

  return {
    segment,
    overdueClasses,
    classesLeft,
    daysSinceLastClass,
    pricePerClass,
    overdueValue
  };
}

/**
 * Returns Tailwind CSS badge styling classes for status tags
 */
export function getStatusBadgeClasses(segment: 'HOT' | 'WARM' | 'COLD' | 'HEALTHY'): string {
  switch (segment) {
    case 'HOT':
      return 'bg-red-100 text-red-800 border-red-300 font-black';
    case 'WARM':
      return 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold';
    case 'COLD':
      return 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
    case 'HEALTHY':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
  }
}
