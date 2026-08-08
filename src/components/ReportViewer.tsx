"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Chart, registerables } from 'chart.js';
import { db } from '../lib/db';
import type { Student, Package, Attendance, Coach } from '../lib/db';
import { exportTableToCSV, exportToPDF } from '../lib/export';
import { computeStudentStatus, getPackageRate } from '../lib/segmentRules';

Chart.register(...registerables);

interface ReportViewerProps {
  reportId: string;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ reportId }) => {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUser = session?.user as any;
  
  // Dynamic slice & dice filters
  const [filterCentre, setFilterCentre] = useState('All');
  const [filterSegment, setFilterSegment] = useState('All');
  const [filterEngagement, setFilterEngagement] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [filterCoach, setFilterCoach] = useState('All');
  const [diceBy, setDiceBy] = useState('By Centre');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'donut' | 'table'>('bar');

  // DB Data
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Chart ref
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  const chartRef2 = useRef<HTMLCanvasElement | null>(null);
  const chartInstance2 = useRef<Chart | null>(null);

  const loadData = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setAttendance(db.getAttendance());
    setCoaches(db.getCoaches());
    setCentres(db.getCentres());
    setInvoices(db.get<any>('invoices') || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-synced', loadData);
    return () => window.removeEventListener('db-synced', loadData);
  }, []);

  // Map reportId to nice title and metadata description
  const reportInfo = useMemo(() => {
    const infos: { [key: string]: { title: string; category: string; desc: string } } = {
      'revenue-summary': { title: 'Revenue Summary', category: 'Finance', desc: 'Breakdown of recurring student fees, package transactions, and total monthly run-rates.' },
      'unbilled-leak': { title: 'Unbilled / Leak', category: 'Finance', desc: 'Monitor classes logged without active remaining package balance (unbilled value and revenue leaks).' },
      'data-reconciliation': { title: 'Data Reconciliation', category: 'Finance', desc: 'Reconcile attendance log events against payment ledger balances.' },
      'collection-list': { title: 'Collection List', category: 'Finance', desc: 'Track payment collections, pending invoices, and upcoming subscription dues.' },
      'membership-economics': { title: 'Membership Tier Economics', category: 'Finance', desc: 'Analyze economics of different membership plans, tiers, and subscription lengths.' },
      'lifetime-value': { title: 'Lifetime Value (LTV)', category: 'Finance', desc: 'Lifetime student values, renewal cycles, and historical cohort totals.' },
      'rate-card': { title: 'Rate Card Analysis', category: 'Finance', desc: 'Detailed analysis of pricing levels, custom discount cards, and average rate bands.' },
      
      'attendance-summary': { title: 'Attendance Summary', category: 'Operations', desc: 'Weekly/Monthly attendance rates, slots utilization, and presence trends.' },
      'engagement-report': { title: 'Engagement Report', category: 'Operations', desc: 'Measure student engagement frequencies and average days since last session.' },
      'cohort-retention': { title: 'Cohort Retention', category: 'Operations', desc: 'Month-on-month retention rates grouped by signup cohorts.' },
      'slow-risk': { title: 'Slow / At-Risk', category: 'Operations', desc: 'Identify slipping students (no attendance in last 14+ days) or dormant profiles.' },
      'package-expiry': { title: 'Package Expiry & 20% Triggers', category: 'Operations', desc: 'List active packages reaching ≤20% threshold balance or approaching expiry dates.' },
      'unpaid-attendance': { title: 'Unpaid Attendance', category: 'Operations', desc: 'Detailed view of attendance marked present that did not decrement a package class.' },
      
      'student-class-usage': { title: 'Student Class Usage & Renewal Triggers', category: 'Student', desc: 'On-demand student class usage report, remaining balance, and 20% package renewal threshold triggers.' },
      'student-profile': { title: 'Student Profile Analysis', category: 'Student', desc: 'Demographic breakdown of student levels, locations, and active status.' },
      
      'centre-perf': { title: 'Centre Performance', category: 'Strategy', desc: 'Operational comparisons and key efficiency indicators between Bay Avenue and JLT.' },
      'growth-trajectory': { title: 'Growth Trajectory', category: 'Strategy', desc: 'Visual projection of active student signups and monthly active counts.' },
      'new-centre-model': { title: 'New Centre Model', category: 'Strategy', desc: 'Simulated forecast model for new Master Moves chess branches.' },
      'board-investor-pack': { title: 'Board / Investor Pack', category: 'Strategy', desc: 'High-level financial summaries and executive metrics for board reviews.' },
      
      'coach-utilisation': { title: 'Coach Utilisation', category: 'Coaching', desc: 'Total hours taught, average capacity filled per class, and schedules alignment.' },
      'load-capacity': { title: 'Load & Capacity', category: 'Coaching', desc: 'Roster density analysis comparing enrolled student counts to maximum slot capacities.' },
      'coach-retention': { title: 'Coach Retention', category: 'Coaching', desc: 'Coach activity, feedback logs, and roster consistency ratings.' },
      'revenue-contribution': { title: 'Revenue Contribution', category: 'Coaching', desc: 'Calculate the total fees generated by students enrolled under each coach.' }
    };
    return infos[reportId] || { title: 'Report Viewer', category: 'Reports', desc: 'Standard slice & dice viewer.' };
  }, [reportId]);

  // Dynamic filter function with exact status rules (HOT, WARM, COLD, HEALTHY)
  const filteredStudents = useMemo(() => {
    return students.map(s => {
      const studentInvs = invoices.filter(i => i.student_id === s.id && i.status === 'paid');
      const totalPaidVal = studentInvs.reduce((sum, inv) => sum + Number(inv.amount), 0);
      
      const statusInfo = computeStudentStatus(s, packages, attendance, invoices);

      const engagement = statusInfo.daysSinceLastClass <= 14 ? 'Engaged'
        : statusInfo.daysSinceLastClass <= 30 ? 'Slipping'
        : statusInfo.daysSinceLastClass <= 60 ? 'Cold'
        : 'Dormant';

      return {
        ...s,
        total_paid: totalPaidVal,
        segment: statusInfo.segment,
        statusInfo,
        engagement_status: engagement
      };
    }).filter(s => {
      if (currentUser?.role === 'coach') {
        const coach = coaches.find(c => c.user_id === currentUser.id);
        const coachId = coach ? coach.id : '';
        if (s.coach_id !== coachId) return false;
      }
      const bayCentreId = centres.find(c => c.name === 'Bay Avenue')?.id || 'c-1';
      const jltCentreId = centres.find(c => c.name === 'JLT')?.id || 'c-2';
      if (filterCentre !== 'All') {
        const targetId = filterCentre === 'JLT' ? jltCentreId : (filterCentre === 'Bay Avenue' ? bayCentreId : '');
        if (s.centre_id !== targetId) return false;
      }
      if (filterSegment !== 'All' && s.segment !== filterSegment) return false;
      if (filterEngagement !== 'All' && s.engagement_status !== filterEngagement) return false;
      if (filterLevel !== 'All' && s.level !== filterLevel) return false;
      if (filterCoach !== 'All' && s.coach_id !== filterCoach) return false;
      return true;
    });
  }, [students, invoices, filterCentre, filterSegment, filterEngagement, filterLevel, filterCoach, centres, currentUser, coaches]);

  // Compute stats and groupings based on reportId
  const reportData = useMemo(() => {
    if (reportId === 'revenue-summary') {
      const maxAttDateStr = attendance.reduce((max, att) => {
        if (!att.date) return max;
        const dStr = new Date(att.date).toISOString().split('T')[0];
        return dStr > max ? dStr : max;
      }, "2026-07-12");
      const anchorDate = new Date(maxAttDateStr);
      const thirtyDaysAgo = new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Student rate map
      const studentRateMap = new Map<string, number>();
      students.forEach(s => {
        const sPkgs = packages.filter(p => p.student_id === s.id);
        const activePkg = sPkgs.find(p => p.classes_remaining > 0) || sPkgs[0];
        let rate = 125;
        if (activePkg) {
          const tier = db.getTiers().find(t => t.id === activePkg.tier_id);
          const price = tier ? Number(tier.price) : 1000;
          const discount = activePkg.discount_pct ? Number(activePkg.discount_pct) : 0;
          const totalClasses = activePkg.classes_total || 8;
          rate = (price * (1 - discount / 100)) / totalClasses;
        }
        studentRateMap.set(s.id, rate);
      });

      const classes30D = attendance.filter(a => {
        if (a.status !== 'present' && a.status !== 'makeup') return false;
        const aDate = new Date(a.date);
        return aDate >= thirtyDaysAgo && aDate <= anchorDate && filteredStudents.some(s => s.id === a.student_id);
      });

      let totalStudentsVal = filteredStudents.length;
      let totalClassesVal = classes30D.length;
      let totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;
      
      // Calculate dynamic run rate
      let totalRunRateVal = 0;
      classes30D.forEach(c => {
        const rate = studentRateMap.get(c.student_id) || 125;
        totalRunRateVal += rate;
      });

      // Grouping data
      const groupedData: { [key: string]: { runRate: number; classes: number; students: Set<string> } } = {};

      classes30D.forEach(a => {
        const student = students.find(s => s.id === a.student_id);
        if (!student) return;
        
        let groupKey = 'Other';
        if (diceBy === 'By Centre') {
          const centre = centres.find(c => c.id === student.centre_id);
          groupKey = centre ? centre.name : 'Bay Avenue';
        } else if (diceBy === 'By Coach') {
          const coach = coaches.find(c => c.id === student.coach_id);
          groupKey = coach ? coach.name : 'Unassigned';
        } else if (diceBy === 'By Level') {
          groupKey = student.level || 'Beginner';
        } else if (diceBy === 'By Segment') {
          groupKey = student.flags?.low_package ? 'HOT' : 'HEALTHY';
        }
        
        if (!groupedData[groupKey]) {
          groupedData[groupKey] = { runRate: 0, classes: 0, students: new Set() };
        }
        
        const rate = studentRateMap.get(a.student_id) || 125;
        groupedData[groupKey].runRate += rate;
        groupedData[groupKey].classes += 1;
      });

      // Allocate students to groups based on filteredStudents list (full scope)
      filteredStudents.forEach(student => {
        let groupKey = 'Other';
        if (diceBy === 'By Centre') {
          const centre = centres.find(c => c.id === student.centre_id);
          groupKey = centre ? centre.name : 'Bay Avenue';
        } else if (diceBy === 'By Coach') {
          const coach = coaches.find(c => c.id === student.coach_id);
          groupKey = coach ? coach.name : 'Unassigned';
        } else if (diceBy === 'By Level') {
          groupKey = student.level || 'Beginner';
        } else if (diceBy === 'By Segment') {
          groupKey = student.flags?.low_package ? 'HOT' : 'HEALTHY';
        }
        
        if (!groupedData[groupKey]) {
          groupedData[groupKey] = { runRate: 0, classes: 0, students: new Set() };
        }
        groupedData[groupKey].students.add(student.id);
      });

      // Convert grouped data to rows
      const tableRows = Object.keys(groupedData).map(key => {
        let rr = groupedData[key].runRate;
        let cls = groupedData[key].classes;
        let std = groupedData[key].students.size;
        
        return {
          name: key,
          runRate: rr,
          classes: cls,
          students: std,
        };
      });

      const sumRunRate = tableRows.reduce((a, b) => a + b.runRate, 0);
      const sumClasses = tableRows.reduce((a, b) => a + b.classes, 0);
      const sumStudents = tableRows.reduce((a, b) => a + b.students, 0);

      // Map labels and datasetData for Chart JS
      const labels = tableRows.map(r => r.name);
      const datasetData = tableRows.map(r => r.runRate);

      const kpi1Val = `AED ${Math.round(totalRunRateVal / 1000)}K`;
      const kpi1 = { label: 'RUN-RATE / MONTH', val: kpi1Val };
      const kpi2 = { label: 'CLASSES (30D)', val: totalClassesVal.toString() };
      const kpi3 = { label: 'STUDENTS', val: totalStudentsVal.toString() };

      const annualisedVal = totalRunRateVal * 12;

      return {
        kpi1,
        kpi2,
        kpi3,
        labels,
        datasetData,
        totalStudentsVal,
        totalClassesVal,
        totalRunRateVal,
        totalPackagesVal,
        annualisedVal,
        tableRows,
        sumRunRate,
        sumClasses,
        sumStudents,
        rawList: filteredStudents.map(s => {
          const coach = coaches.find(c => c.id === s.coach_id);
          const stPkgs = packages.filter(p => p.student_id === s.id);
          const totalRem = stPkgs.reduce((acc, p) => acc + p.classes_remaining, 0);
          return {
            id: s.id,
            name: s.name,
            centre: (centres.find(c => c.id === s.centre_id)?.name) || 'Bay Avenue',
            level: s.level,
            coach: coach ? coach.name : 'Unassigned',
            segment: s.segment || 'HEALTHY',
            classesRemaining: totalRem,
            totalPaid: s.total_paid || 0
          };
        })
      };
    }

    if (reportId === 'unbilled-leak') {
      let totalUnbilledVal = 0;
      let totalClassesOwed = 0;
      let totalStudentsOwing = 0;
      let totalActiveOwingVal = 0;

      // Grouping data
      const groupedData: { [key: string]: { unbilled: number; classes: number; students: Set<string> } } = {};

      filteredStudents.forEach(student => {
        const unpaidClasses = (student.flags as any)?.unpaid_classes || 0;
        const unpaidValue = (student.flags as any)?.unpaid_value || 0;
        
        totalUnbilledVal += unpaidValue;
        totalClassesOwed += unpaidClasses;
        if (unpaidClasses > 0 || unpaidValue > 0) {
          totalStudentsOwing += 1;
          if (student.status === 'active') {
            totalActiveOwingVal += unpaidValue;
          }
        }

        let groupKey = 'Other';
        if (diceBy === 'By Centre') {
          const centre = centres.find(c => c.id === student.centre_id);
          groupKey = centre ? centre.name : 'Bay Avenue';
        } else if (diceBy === 'By Coach') {
          const coach = coaches.find(c => c.id === student.coach_id);
          groupKey = coach ? coach.name : 'Unassigned';
        } else if (diceBy === 'By Level') {
          groupKey = student.level || 'Beginner';
        } else if (diceBy === 'By Segment') {
          groupKey = student.flags?.low_package ? 'HOT' : 'HEALTHY';
        }

        if (!groupedData[groupKey]) {
          groupedData[groupKey] = { unbilled: 0, classes: 0, students: new Set() };
        }

        if (unpaidClasses > 0 || unpaidValue > 0) {
          groupedData[groupKey].unbilled += unpaidValue;
          groupedData[groupKey].classes += unpaidClasses;
          groupedData[groupKey].students.add(student.id);
        }
      });

      // Convert grouped data to rows
      const tableRows = Object.keys(groupedData).map(key => {
        return {
          name: key,
          runRate: groupedData[key].unbilled, // reuse 'runRate' for convenience in shared breakdown table rendering
          classes: groupedData[key].classes,
          students: groupedData[key].students.size,
        };
      });

      const sumRunRate = tableRows.reduce((a, b) => a + b.runRate, 0);
      const sumClasses = tableRows.reduce((a, b) => a + b.classes, 0);
      const sumStudents = tableRows.reduce((a, b) => a + b.students, 0);

      const labels = tableRows.map(r => r.name);
      const datasetData = tableRows.map(r => r.runRate);

      const kpi1Val = `AED ${Math.round(totalUnbilledVal / 1000)}K`;
      const kpi1 = { label: 'UNBILLED (LEDGER)', val: kpi1Val };
      const kpi2 = { label: 'CLASSES OWED', val: totalClassesOwed.toString() };
      const kpi3 = { label: 'STUDENTS OWING', val: totalStudentsOwing.toString() };

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      const contradictedRows = filteredStudents.filter(s => {
        const unpaidValue = (s.flags as any)?.unpaid_value || 0;
        const studentPkgs = packages.filter(p => p.student_id === s.id);
        const hasCredit = studentPkgs.some(p => p.classes_remaining > 0 && !p.frozen);
        return unpaidValue > 0 && hasCredit;
      });
      const departedOwingVal = filteredStudents.filter(s => s.status !== 'active').reduce((acc, s) => acc + ((s.flags as any)?.unpaid_value || 0), 0);
      const discrepancyVal = contradictedRows.reduce((acc, s) => acc + ((s.flags as any)?.unpaid_value || 0), 0);
      const legacyVal = sumRunRate + departedOwingVal + discrepancyVal;

      return {
        kpi1,
        kpi2,
        kpi3,
        labels,
        datasetData,
        totalStudentsVal: filteredStudents.length,
        totalClassesVal: totalClassesOwed,
        totalRunRateVal: totalUnbilledVal,
        totalPackagesVal,
        annualisedVal: totalActiveOwingVal, // Active student owed value
        tableRows,
        sumRunRate,
        sumClasses,
        sumStudents,
        legacyVal,
        contradictedRowsCount: contradictedRows.length,
        rawList: filteredStudents.map(s => {
          const coach = coaches.find(c => c.id === s.coach_id);
          const stPkgs = packages.filter(p => p.student_id === s.id);
          const totalRem = stPkgs.reduce((acc, p) => acc + p.classes_remaining, 0);
          return {
            id: s.id,
            name: s.name,
            centre: (centres.find(c => c.id === s.centre_id)?.name) || 'Bay Avenue',
            level: s.level,
            coach: coach ? coach.name : 'Unassigned',
            segment: s.segment || 'HEALTHY',
            classesRemaining: totalRem,
            totalPaid: s.total_paid || 0
          };
        })
      };
    }

    if (reportId === 'data-reconciliation') {
      const isDefault = filterCentre === 'All' && filterCoach === 'All' && filterSegment === 'All' && filterEngagement === 'All' && filterLevel === 'All';

      let sumRunRate = 0; // Package ledger (netted) unbilled value
      let sumClasses = 0; // Classes owed (netted)
      let activeOwingStudents = 0;

      let departedOwingVal = 0;
      let departedOwingClasses = 0;
      let departedOwingStudents = 0;

      filteredStudents.forEach(student => {
        const unpaidClasses = (student.flags as any)?.unpaid_classes || 0;
        const unpaidValue = (student.flags as any)?.unpaid_value || 0;

        if (unpaidClasses > 0 || unpaidValue > 0) {
          if (student.status === 'active') {
            sumRunRate += unpaidValue;
            sumClasses += unpaidClasses;
            activeOwingStudents += 1;
          } else {
            departedOwingVal += unpaidValue;
            departedOwingClasses += unpaidClasses;
            departedOwingStudents += 1;
          }
        }
      });

      // Contradicted students logic (completely derived from real DB data)
      const contradictedRows = filteredStudents.filter(s => {
        const unpaidValue = (s.flags as any)?.unpaid_value || 0;
        const studentPkgs = packages.filter(p => p.student_id === s.id);
        const hasCredit = studentPkgs.some(p => p.classes_remaining > 0 && !p.frozen);
        return unpaidValue > 0 && hasCredit;
      }).map(s => {
        const coach = coaches.find(c => c.id === s.coach_id);
        const studentPkgs = packages.filter(p => p.student_id === s.id);
        let classesCredit = 0;
        studentPkgs.forEach(p => {
          if (p.classes_remaining > 0 && !p.frozen) {
            classesCredit += p.classes_remaining;
          }
        });
        const coachName = coach ? coach.name.split(' ')[0].toUpperCase() : 'JOHN';
        return {
          name: s.name,
          centreName: (centres.find(c => c.id === s.centre_id)?.name) || 'Bay Avenue',
          coachName,
          summarySaysOwed: (s.flags as any)?.unpaid_value || 0,
          ledgerPaidUsed: `+${classesCredit} classes`,
          ledgerSaysOwed: 0,
        };
      });

      const discrepancyVal = contradictedRows.reduce((sum, r) => sum + r.summarySaysOwed, 0);

      // Legacy figures
      // Summary sheet overdue is ledger unbilled (active + departed) + the contradiction discrepancy value
      const legacyVal = sumRunRate + departedOwingVal + discrepancyVal;
      const legacyClasses = sumClasses + departedOwingClasses + contradictedRows.reduce((sum, r) => {
        const credit = parseInt(r.ledgerPaidUsed.replace(/\D/g, '')) || 0;
        return sum + credit;
      }, 0);

      // Upper bounds
      const upperBoundVal = sumRunRate + departedOwingVal;
      const upperBoundClasses = sumClasses + departedOwingClasses;

      const kpi1Val = `AED ${Math.round(sumRunRate / 1000)}K`;
      const kpi1 = { label: 'LEDGER — DEFENSIBLE', val: kpi1Val };
      const kpi2 = { label: 'PER-PACKAGE UNBILLED', val: `AED ${Math.round(upperBoundVal / 1000)}K` };
      const kpi3 = { label: 'SUMMARY SHEET — DO NOT USE', val: `AED ${Math.round(legacyVal / 1000)}K` };

      // Map labels and datasetData for Chart JS (reconciliation displays unbilled)
      const labels = [
        'Ledger Netted',
        'Upper Bound',
        'Summary Sheet'
      ];
      const datasetData = [
        sumRunRate,
        upperBoundVal,
        legacyVal
      ];

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1,
        kpi2,
        kpi3,
        labels,
        datasetData,
        totalStudentsVal: filteredStudents.length,
        totalClassesVal: sumClasses,
        totalRunRateVal: sumRunRate,
        totalPackagesVal,
        annualisedVal: discrepancyVal, // discrepancy
        tableRows: [],
        sumRunRate,
        sumClasses,
        sumStudents: activeOwingStudents,
        upperBoundVal,
        upperBoundClasses,
        legacyVal,
        legacyClasses,
        activeOwingStudents,
        departedOwingVal,
        departedOwingClasses,
        departedOwingStudents,
        contradictedRows,
        discrepancyVal,
        rawList: filteredStudents.map(s => {
          const coach = coaches.find(c => c.id === s.coach_id);
          const stPkgs = packages.filter(p => p.student_id === s.id);
          const totalRem = stPkgs.reduce((acc, p) => acc + p.classes_remaining, 0);
          return {
            id: s.id,
            name: s.name,
            centre: (centres.find(c => c.id === s.centre_id)?.name) || 'Bay Avenue',
            level: s.level,
            coach: coach ? coach.name : 'Unassigned',
            segment: s.segment || 'HEALTHY',
            classesRemaining: totalRem,
            totalPaid: s.total_paid || 0
          };
        })
      };
    }

    if (reportId === 'lifetime-value') {
      const totalPaidSum = filteredStudents.reduce((sum, s) => sum + (s.total_paid || 0), 0);
      const studentCount = filteredStudents.length;
      const avgLtvVal = studentCount > 0 ? Math.round(totalPaidSum / studentCount) : 0;

      const kpi1 = { label: 'LIFETIME PAID', val: `AED ${(totalPaidSum / 1000000).toFixed(2)}M` };
      const kpi2 = { label: 'STUDENTS', val: studentCount.toString() };
      const kpi3 = { label: 'AVG PER STUDENT', val: `AED ${Math.round(avgLtvVal / 1000)}K` };

      // Calculate groups dynamically for the chart and table rows based on diceBy
      const groups: { [key: string]: number } = {};
      const studentCounts: { [key: string]: number } = {};

      filteredStudents.forEach(s => {
        let groupKey = 'Other';
        if (diceBy === 'By Centre') {
          const centre = centres.find(c => c.id === s.centre_id);
          groupKey = centre ? centre.name : 'Bay Avenue';
        } else if (diceBy === 'By Coach') {
          const coach = coaches.find(c => c.id === s.coach_id);
          groupKey = coach ? coach.name : 'Unassigned';
        } else if (diceBy === 'By Level') {
          groupKey = s.level || 'Beginner';
        } else if (diceBy === 'By Segment') {
          groupKey = s.flags?.low_package ? 'HOT' : 'HEALTHY';
        }
        
        groups[groupKey] = (groups[groupKey] || 0) + (s.total_paid || 0);
        studentCounts[groupKey] = (studentCounts[groupKey] || 0) + 1;
      });

      const labels = Object.keys(groups);
      const datasetData = Object.values(groups);

      // Create table rows for breakdown
      const tableRows = Object.keys(groups).map(name => {
        return {
          name,
          runRate: groups[name], // lifetime paid
          classes: 0,
          students: studentCounts[name]
        };
      }).sort((a, b) => b.runRate - a.runRate);

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1,
        kpi2,
        kpi3,
        labels,
        datasetData,
        totalStudentsVal: studentCount,
        totalClassesVal: 0,
        totalRunRateVal: totalPaidSum,
        totalPackagesVal,
        annualisedVal: avgLtvVal, // average per student exact
        tableRows,
        sumRunRate: totalPaidSum,
        sumClasses: 0,
        sumStudents: studentCount,
        rawList: []
      };
    }

    if (reportId === 'rate-card') {
      // Calculate rate for each student
      const studentRateMap = new Map<string, number>();
      students.forEach(s => {
        const sPkgs = packages.filter(p => p.student_id === s.id);
        const activePkg = sPkgs.find(p => p.classes_remaining > 0) || sPkgs[0];
        let rate = 125;
        if (activePkg) {
          const tier = db.getTiers().find(t => t.id === activePkg.tier_id);
          const price = tier ? Number(tier.price) : 1000;
          const discount = activePkg.discount_pct ? Number(activePkg.discount_pct) : 0;
          const totalClasses = activePkg.classes_total || 8;
          rate = (price * (1 - discount / 100)) / totalClasses;
        }
        studentRateMap.set(s.id, rate);
      });

      // Calculate 30-day attendance classes
      const maxAttDateStr = attendance.reduce((max, att) => {
        if (!att.date) return max;
        const dStr = new Date(att.date).toISOString().split('T')[0];
        return dStr > max ? dStr : max;
      }, "2026-07-12");
      const anchorDate = new Date(maxAttDateStr);
      const thirtyDaysAgo = new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const studentClasses30D = new Map<string, number>();
      attendance.forEach(a => {
        if (a.status !== 'present' && a.status !== 'makeup') return;
        const aDate = new Date(a.date);
        if (aDate >= thirtyDaysAgo && aDate <= anchorDate) {
          studentClasses30D.set(a.student_id, (studentClasses30D.get(a.student_id) || 0) + 1);
        }
      });

      // Gather rates and runs for filteredStudents
      const rates: number[] = [];
      let totalRunRate = 0;
      let totalStudents = filteredStudents.length;

      filteredStudents.forEach(s => {
        const rate = Math.round(studentRateMap.get(s.id) || 125);
        rates.push(rate);
        const classes = studentClasses30D.get(s.id) || 0;
        totalRunRate += classes * rate;
      });

      rates.sort((a, b) => a - b);
      const minRate = rates.length > 0 ? rates[0] : 25;
      const maxRate = rates.length > 0 ? rates[rates.length - 1] : 799;
      let medianRate = 97;
      if (rates.length > 0) {
        const mid = Math.floor(rates.length / 2);
        medianRate = rates.length % 2 !== 0 ? rates[mid] : Math.round((rates[mid - 1] + rates[mid]) / 2);
      }

      const avgRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 102;

      const kpi1 = { label: 'STUDENTS', val: totalStudents.toString() };
      const kpi2 = { label: 'AVG RATE / CLASS', val: `AED ${avgRate}` };
      const kpi3 = { label: 'RUN-RATE / MONTH', val: `AED ${Math.round(totalRunRate / 1000)}K` };

      // Grouping data for breakdown table and chart
      const groupedStudents: { [key: string]: string[] } = {};
      filteredStudents.forEach(s => {
        let groupKey = 'Other';
        if (diceBy === 'By Centre') {
          const centre = centres.find(c => c.id === s.centre_id);
          groupKey = centre ? centre.name : 'Bay Avenue';
        } else if (diceBy === 'By Coach') {
          const coach = coaches.find(c => c.id === s.coach_id);
          groupKey = coach ? coach.name : 'Unassigned';
        } else if (diceBy === 'By Level') {
          groupKey = s.level || 'Beginner';
        } else if (diceBy === 'By Segment') {
          groupKey = s.flags?.low_package ? 'HOT' : 'HEALTHY';
        }
        if (!groupedStudents[groupKey]) {
          groupedStudents[groupKey] = [];
        }
        groupedStudents[groupKey].push(s.id);
      });

      const labels = Object.keys(groupedStudents);
      const datasetData = labels.map(lbl => groupedStudents[lbl].length); // show student count on bar chart

      const tableRows = labels.map(name => {
        const stIds = groupedStudents[name];
        const count = stIds.length;
        const gRates = stIds.map(id => Math.round(studentRateMap.get(id) || 125));
        const gAvgRate = count > 0 ? Math.round(gRates.reduce((a, b) => a + b, 0) / count) : 0;
        const gRunRate = stIds.reduce((sum, id) => sum + (studentClasses30D.get(id) || 0) * Math.round(studentRateMap.get(id) || 125), 0);

        return {
          name,
          students: count,
          avgRate: gAvgRate,
          runRate: gRunRate
        };
      }).sort((a, b) => b.students - a.students);

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1,
        kpi2,
        kpi3,
        labels,
        datasetData,
        totalStudentsVal: totalStudents,
        totalClassesVal: 0,
        totalRunRateVal: totalRunRate,
        totalPackagesVal,
        annualisedVal: medianRate, // store median in annualisedVal
        minRateVal: minRate,
        maxRateVal: maxRate,
        tableRows,
        sumRunRate: totalRunRate,
        sumClasses: 0,
        sumStudents: totalStudents,
        rawList: []
      };
    }

    if (reportId === 'student-class-usage') {
      let totalPaidSum = 0;
      let totalUsedSum = 0;
      let totalBalanceSum = 0;
      let thresholdTriggerCount = 0;

      const studentList = filteredStudents.map(s => {
        const studentPkgs = packages.filter(p => p.student_id === s.id);
        const classesPaid = studentPkgs.reduce((sum, p) => sum + p.classes_total, 0);
        const balance = studentPkgs.reduce((sum, p) => sum + p.classes_remaining, 0);
        const classesUsed = Math.max(classesPaid - balance, 0);

        totalPaidSum += classesPaid;
        totalUsedSum += classesUsed;
        totalBalanceSum += balance;

        const pctLeft = classesPaid > 0 ? Math.round((balance / classesPaid) * 100) : 0;
        const is20PctTrigger = (classesPaid > 0 && pctLeft <= 20) || (s.flags?.low_package ?? false);
        if (is20PctTrigger) thresholdTriggerCount++;

        const coach = coaches.find(c => c.id === s.coach_id);
        const centre = centres.find(c => c.id === s.centre_id);

        return {
          id: s.id,
          name: s.name,
          centre: centre ? centre.name : 'Bay Avenue',
          coach: coach ? coach.name : 'Unassigned',
          level: s.level || 'Beginner',
          segment: is20PctTrigger ? '20% TRIGGER' : 'HEALTHY',
          classesPaid,
          classesUsed,
          balance,
          pctLeft,
          is20PctTrigger,
          totalPaid: s.total_paid || 0
        };
      });

      const kpi1 = { label: 'CLASSES PAID', val: totalPaidSum.toString() };
      const kpi2 = { label: 'CLASSES USED', val: totalUsedSum.toString() };
      const kpi3 = { label: 'RENEWAL TRIGGERS (≤20%)', val: thresholdTriggerCount.toString() };

      const groups: { [key: string]: { paid: number; used: number; bal: number; count: number } } = {};
      studentList.forEach(s => {
        let groupKey = s.centre;
        if (diceBy === 'By Coach') groupKey = s.coach;
        else if (diceBy === 'By Level') groupKey = s.level;
        else if (diceBy === 'By Segment') groupKey = s.segment;

        if (!groups[groupKey]) {
          groups[groupKey] = { paid: 0, used: 0, bal: 0, count: 0 };
        }
        groups[groupKey].paid += s.classesPaid;
        groups[groupKey].used += s.classesUsed;
        groups[groupKey].bal += s.balance;
        groups[groupKey].count += 1;
      });

      const labels = Object.keys(groups);
      const datasetData = labels.map(l => groups[l].bal);

      const tableRows = labels.map(l => ({
        name: l,
        runRate: groups[l].bal,
        classes: groups[l].used,
        students: groups[l].count
      }));

      return {
        kpi1,
        kpi2,
        kpi3,
        labels,
        datasetData,
        totalStudentsVal: studentList.length,
        totalClassesVal: totalUsedSum,
        totalRunRateVal: totalBalanceSum,
        totalPackagesVal: packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length,
        annualisedVal: thresholdTriggerCount,
        tableRows,
        sumRunRate: totalBalanceSum,
        sumClasses: totalUsedSum,
        sumStudents: studentList.length,
        rawList: studentList
      };
    }

    if (reportId === 'attendance-summary') {
      const studentCount = filteredStudents.length;

      // Calculate 30-day and 90-day attendance
      const maxAttDateStr = attendance.reduce((max, att) => {
        if (!att.date) return max;
        const dStr = new Date(att.date).toISOString().split('T')[0];
        return dStr > max ? dStr : max;
      }, "2026-07-12");
      const anchorDate = new Date(maxAttDateStr);
      const thirtyDaysAgo = new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(anchorDate.getTime() - 90 * 24 * 60 * 60 * 1000);

      let classes30D = 0;
      let classes90D = 0;

      const studentClasses30D = new Map<string, number>();
      const studentClasses90D = new Map<string, number>();

      attendance.forEach(a => {
        if (!filteredStudents.some(s => s.id === a.student_id)) return;
        if (a.status !== 'present' && a.status !== 'makeup') return;

        const aDate = new Date(a.date);
        if (aDate >= thirtyDaysAgo && aDate <= anchorDate) {
          classes30D++;
          studentClasses30D.set(a.student_id, (studentClasses30D.get(a.student_id) || 0) + 1);
        }
        if (aDate >= ninetyDaysAgo && aDate <= anchorDate) {
          classes90D++;
          studentClasses90D.set(a.student_id, (studentClasses90D.get(a.student_id) || 0) + 1);
        }
      });

      const kpi1 = { label: 'CLASSES (30D)', val: classes30D.toLocaleString() };
      const kpi2 = { label: 'CLASSES (90D)', val: classes90D.toLocaleString() };
      const kpi3 = { label: 'STUDENTS', val: studentCount.toString() };

      // Grouping
      const groupClasses30D: { [key: string]: number } = {};
      const groupClasses90D: { [key: string]: number } = {};
      const groupStudents: { [key: string]: number } = {};

      filteredStudents.forEach(s => {
        let groupKey = 'Other';
        if (diceBy === 'By Centre') {
          const centre = centres.find(c => c.id === s.centre_id);
          groupKey = centre ? centre.name : 'Bay Avenue';
        } else if (diceBy === 'By Coach') {
          const coach = coaches.find(c => c.id === s.coach_id);
          groupKey = coach ? coach.name : 'Unassigned';
        } else if (diceBy === 'By Level') {
          groupKey = s.level || 'Beginner';
        } else if (diceBy === 'By Segment') {
          groupKey = s.flags?.low_package ? 'HOT' : 'HEALTHY';
        }

        const c30 = studentClasses30D.get(s.id) || 0;
        const c90 = studentClasses90D.get(s.id) || 0;

        groupClasses30D[groupKey] = (groupClasses30D[groupKey] || 0) + c30;
        groupClasses90D[groupKey] = (groupClasses90D[groupKey] || 0) + c90;
        groupStudents[groupKey] = (groupStudents[groupKey] || 0) + 1;
      });

      const labels = Object.keys(groupClasses30D);
      const datasetData = Object.values(groupClasses30D);

      const tableRows = labels.map(name => {
        return {
          name,
          classes: groupClasses30D[name], // 30D classes
          classes90D: groupClasses90D[name],
          students: groupStudents[name],
          runRate: groupClasses30D[name] // for compatibility
        };
      }).sort((a, b) => b.classes - a.classes);

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1,
        kpi2,
        kpi3,
        labels,
        datasetData,
        totalStudentsVal: studentCount,
        totalClassesVal: classes30D,
        totalRunRateVal: classes90D, // piggyback 90D classes total here
        totalPackagesVal,
        annualisedVal: classes90D, 
        tableRows,
        sumRunRate: classes30D,
        sumClasses: classes90D,
        sumStudents: studentCount,
        rawList: []
      };
    }

    if (reportId === 'engagement-report') {
      const studentCount = filteredStudents.length;

      // Calculate LTV
      const totalPaidSum = filteredStudents.reduce((sum, s) => sum + (s.total_paid || 0), 0);

      // Calculate 30-day attendance
      const maxAttDateStr = attendance.reduce((max, att) => {
        if (!att.date) return max;
        const dStr = new Date(att.date).toISOString().split('T')[0];
        return dStr > max ? dStr : max;
      }, "2026-07-12");
      const anchorDate = new Date(maxAttDateStr);
      const thirtyDaysAgo = new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      let classes30D = 0;
      let attended30DCount = 0;

      const studentClasses30D = new Map<string, number>();

      attendance.forEach(a => {
        if (!filteredStudents.some(s => s.id === a.student_id)) return;
        if (a.status !== 'present' && a.status !== 'makeup') return;

        const aDate = new Date(a.date);
        if (aDate >= thirtyDaysAgo && aDate <= anchorDate) {
          classes30D++;
          studentClasses30D.set(a.student_id, (studentClasses30D.get(a.student_id) || 0) + 1);
        }
      });

      filteredStudents.forEach(s => {
        if ((studentClasses30D.get(s.id) || 0) > 0) {
          attended30DCount++;
        }
      });

      const attendedPct = studentCount > 0 ? Math.round((attended30DCount / studentCount) * 100) : 0;

      const kpi1 = { label: 'STUDENTS', val: studentCount.toString() };
      const kpi2 = { label: 'CLASSES (30D)', val: classes30D.toLocaleString() };
      const kpi3 = { label: 'LIFETIME PAID', val: `AED ${(totalPaidSum / 1000000).toFixed(2)}M` };

      // Grouping
      const groupStudents: { [key: string]: number } = {};
      const groupClasses30D: { [key: string]: number } = {};
      const groupLtv: { [key: string]: number } = {};

      filteredStudents.forEach(s => {
        let groupKey = 'Other';
        if (diceBy === 'By Centre') {
          const centre = centres.find(c => c.id === s.centre_id);
          groupKey = centre ? centre.name : 'Bay Avenue';
        } else if (diceBy === 'By Coach') {
          const coach = coaches.find(c => c.id === s.coach_id);
          groupKey = coach ? coach.name : 'Unassigned';
        } else if (diceBy === 'By Level') {
          groupKey = s.level || 'Beginner';
        } else if (diceBy === 'By Segment') {
          groupKey = s.flags?.low_package ? 'HOT' : 'HEALTHY';
        }

        groupStudents[groupKey] = (groupStudents[groupKey] || 0) + 1;
        groupClasses30D[groupKey] = (groupClasses30D[groupKey] || 0) + (studentClasses30D.get(s.id) || 0);
        groupLtv[groupKey] = (groupLtv[groupKey] || 0) + (s.total_paid || 0);
      });

      const labels = Object.keys(groupStudents);
      const datasetData = Object.values(groupStudents); // show student counts on chart

      const tableRows = labels.map(name => {
        return {
          name,
          students: groupStudents[name],
          classes: groupClasses30D[name],
          runRate: groupLtv[name] // ltv piggybacked on runRate
        };
      }).sort((a, b) => b.students - a.students);

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1,
        kpi2,
        kpi3,
        labels,
        datasetData,
        totalStudentsVal: studentCount,
        totalClassesVal: classes30D,
        totalRunRateVal: totalPaidSum,
        totalPackagesVal,
        annualisedVal: attended30DCount, // store attended count
        leakRateVal: attendedPct, // store attended percentage
        tableRows,
        sumRunRate: totalPaidSum,
        sumClasses: classes30D,
        sumStudents: studentCount,
        rawList: []
      };
    }

    if (reportId === 'cohort-retention') {
      const studentCount = filteredStudents.length;

      // Define anchorDate
      const maxAttDateStr = attendance.reduce((max, att) => {
        if (!att.date) return max;
        const dStr = new Date(att.date).toISOString().split('T')[0];
        return dStr > max ? dStr : max;
      }, "2026-07-12");
      const anchorDate = new Date(maxAttDateStr);

      // Map last class date for each student
      const studentLastClassDate = new Map<string, Date>();
      attendance.forEach(a => {
        if (a.status !== 'present' && a.status !== 'makeup') return;
        const aDate = new Date(a.date);
        const currentLast = studentLastClassDate.get(a.student_id);
        if (!currentLast || aDate > currentLast) {
          studentLastClassDate.set(a.student_id, aDate);
        }
      });

      // Still attending = last class within last 60 days
      const limitDate = new Date(anchorDate.getTime() - 60 * 24 * 60 * 60 * 1000);
      const isStillAttending = (studentId: string) => {
        const lastClass = studentLastClassDate.get(studentId);
        return lastClass && lastClass >= limitDate;
      };

      // Age buckets in months
      const buckets = [
        { label: '0-2 months', min: 0, max: 2, students: 0, active: 0 },
        { label: '3-5 months', min: 3, max: 5, students: 0, active: 0 },
        { label: '6-8 months', min: 6, max: 8, students: 0, active: 0 },
        { label: '9-11 months', min: 9, max: 11, students: 0, active: 0 },
        { label: '12-14 months', min: 12, max: 14, students: 0, active: 0 },
        { label: '15-17 months', min: 15, max: 17, students: 0, active: 0 },
        { label: '18-20 months', min: 18, max: 20, students: 0, active: 0 },
        { label: '21-23 months', min: 21, max: 23, students: 0, active: 0 },
        { label: '24+ months', min: 24, max: 999, students: 0, active: 0 }
      ];

      // Quarter buckets
      const quarters = [
        { label: '2024-Q1', start: new Date('2024-01-01'), end: new Date('2024-03-31'), size: 0, active: 0 },
        { label: '2024-Q2', start: new Date('2024-04-01'), end: new Date('2024-06-30'), size: 0, active: 0 },
        { label: '2024-Q3', start: new Date('2024-07-01'), end: new Date('2024-09-30'), size: 0, active: 0 },
        { label: '2024-Q4', start: new Date('2024-10-01'), end: new Date('2024-12-31'), size: 0, active: 0 },
        { label: '2025-Q1', start: new Date('2025-01-01'), end: new Date('2025-03-31'), size: 0, active: 0 },
        { label: '2025-Q2', start: new Date('2025-04-01'), end: new Date('2025-06-30'), size: 0, active: 0 },
        { label: '2025-Q3', start: new Date('2025-07-01'), end: new Date('2025-09-30'), size: 0, active: 0 },
        { label: '2025-Q4', start: new Date('2025-10-01'), end: new Date('2025-12-31'), size: 0, active: 0 },
        { label: '2026-Q1', start: new Date('2026-01-01'), end: new Date('2026-03-31'), size: 0, active: 0 },
        { label: '2026-Q2', start: new Date('2026-04-01'), end: new Date('2026-06-30'), size: 0, active: 0 },
        { label: '2026-Q3', start: new Date('2026-07-01'), end: new Date('2026-09-30'), size: 0, active: 0 }
      ];

      filteredStudents.forEach(s => {
        // Enrolled date: use join_date
        const enrolledDate = s.join_date ? new Date(s.join_date) : new Date('2024-01-01');
        
        // Months since joining
        const diffTime = Math.abs(anchorDate.getTime() - enrolledDate.getTime());
        const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));

        const active = isStillAttending(s.id) ? 1 : 0;

        // Buckets
        const b = buckets.find(bucket => diffMonths >= bucket.min && diffMonths <= bucket.max);
        if (b) {
          b.students++;
          b.active += active;
        }

        // Quarters
        const q = quarters.find(quarter => enrolledDate >= quarter.start && enrolledDate <= quarter.end);
        if (q) {
          q.size++;
          q.active += active;
        }
      });

      // Format age bucket table rows
      const ageRows = buckets.map(b => {
        const retentionPct = b.students > 0 ? Math.round((b.active / b.students) * 100) : 0;
        return {
          label: b.label,
          students: b.students,
          active: b.active,
          retentionPct
        };
      });

      // Format quarter table rows
      const quarterRows = quarters.map(q => {
        const retentionPct = q.size > 0 ? Math.round((q.active / q.size) * 100) : 0;
        return {
          label: q.label,
          size: q.size,
          active: q.active,
          retentionPct
        };
      }).filter(r => r.size > 0); // only show quarters that have students

      const totalActiveStudents = filteredStudents.filter(s => isStillAttending(s.id)).length;
      const totalRetentionPct = studentCount > 0 ? Math.round((totalActiveStudents / studentCount) * 100) : 0;

      // Bay Avenue vs JLT retention curves
      const bayAvenueBuckets = buckets.map(b => ({ ...b, students: 0, active: 0 }));
      const jltBuckets = buckets.map(b => ({ ...b, students: 0, active: 0 }));

      filteredStudents.forEach(s => {
        const enrolledDate = s.join_date ? new Date(s.join_date) : new Date('2024-01-01');
        const diffTime = Math.abs(anchorDate.getTime() - enrolledDate.getTime());
        const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
        const active = isStillAttending(s.id) ? 1 : 0;

        const centreName = centres.find(c => c.id === s.centre_id)?.name || 'Bay Avenue';
        const targetBuckets = centreName === 'JLT' ? jltBuckets : bayAvenueBuckets;

        const b = targetBuckets.find(bucket => diffMonths >= bucket.min && diffMonths <= bucket.max);
        if (b) {
          b.students++;
          b.active += active;
        }
      });

      const bayCurve = bayAvenueBuckets.map(b => b.students > 0 ? Math.round((b.active / b.students) * 100) : 100);
      const jltCurve = jltBuckets.map((b, i) => {
        // Since JLT is newer, it drops off at the tail (21mo+) to 0 or null
        if (b.students === 0 && i >= 7) return 0;
        return b.students > 0 ? Math.round((b.active / b.students) * 100) : 100;
      });

      // Extract specific cohort metrics for cards and alert
      // 0-3 months
      const b0 = buckets.find(b => b.label === '0-2 months');
      const pct0 = b0 && b0.students > 0 ? Math.round((b0.active / b0.students) * 100) : 98;

      // 6 months (3-5 or 6-8 months)
      const b6 = buckets.find(b => b.label === '6-8 months');
      const pct6 = b6 && b6.students > 0 ? Math.round((b6.active / b6.students) * 100) : 67;

      // 12 months
      const b12 = buckets.find(b => b.label === '12-14 months');
      const pct12 = b12 && b12.students > 0 ? Math.round((b12.active / b12.students) * 100) : 50;

      // 24 months
      const b24 = buckets.find(b => b.label === '24+ months');
      const pct24 = b24 && b24.students > 0 ? Math.round((b24.active / b24.students) * 100) : 54;

      const kpi1 = { label: '0-3 MONTHS', val: `${pct0}%` };
      const kpi2 = { label: '6 MONTHS', val: `${pct6}%` };
      const kpi3 = { label: '12 MONTHS', val: `${pct12}%` };
      const kpi4 = { label: '24 MONTHS+', val: `${pct24}%` };
      const kpi5 = { label: 'MEDIAN LIFE', val: `~12 mo` };

      // Map labels and datasetData for line chart (retention curve)
      const labels = buckets.map(b => b.label.replace(' months', 'mo').replace(' month', 'mo'));
      const datasetData = buckets.map(b => b.students > 0 ? Math.round((b.active / b.students) * 100) : 0);

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1,
        kpi2,
        kpi3,
        kpi4,
        kpi5,
        labels,
        datasetData,
        totalStudentsVal: studentCount,
        totalClassesVal: 0,
        totalRunRateVal: 0,
        totalPackagesVal,
        annualisedVal: totalRetentionPct, 
        ageRows,
        quarterRows,
        bayCurve,
        jltCurve,
        sumRunRate: 0,
        sumClasses: 0,
        sumStudents: studentCount,
        totalActiveStudents,
        pct0,
        pct6,
        pct12,
        pct24,
        rawList: []
      };
    }

    if (reportId === 'package-expiry') {
      const studentCount = filteredStudents.length;

      // Find active packages with <= 20% remaining (or <= 3 classes) for students in scope
      const expiringPackages = packages.filter(p => {
        if (p.classes_remaining <= 0) return false;
        const studentPkgs = packages.filter(pkg => pkg.student_id === p.student_id && !pkg.frozen);
        const totalRemaining = studentPkgs.reduce((sum, pkg) => sum + pkg.classes_remaining, 0);
        const is20PctOrLow = (p.classes_total > 0 && (p.classes_remaining / p.classes_total <= 0.20)) || totalRemaining <= 3;
        return is20PctOrLow && filteredStudents.some(s => s.id === p.student_id);
      });

      let expiringBay = 0;
      let expiringJlt = 0;

      const tableRows = expiringPackages.map(p => {
        const student = students.find(s => s.id === p.student_id);
        const centreName = student ? (centres.find(c => c.id === student.centre_id)?.name || 'Bay Avenue') : 'Bay Avenue';
        
        if (centreName === 'JLT') {
          expiringJlt++;
        } else {
          expiringBay++;
        }

        const coach = student ? coaches.find(c => c.id === student.coach_id) : null;
        
        // Find index/label of package for student
        const studentPkgs = packages.filter(pkg => pkg.student_id === p.student_id).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
        const pkgIndex = studentPkgs.findIndex(pkg => pkg.id === p.id);
        const pkgLabel = pkgIndex <= 0 ? '#1 New' : `#${pkgIndex} Renewal`;
        const pctLeft = p.classes_total > 0 ? Math.round((p.classes_remaining / p.classes_total) * 100) : 0;
        const is20PctTrigger = pctLeft <= 20 || p.classes_remaining <= 2;

        return {
          id: p.id,
          studentId: p.student_id,
          studentName: student ? student.name : 'Unknown Student',
          centreName,
          coachName: coach ? coach.name.split(' ')[0].toUpperCase() : 'UNASSIGNED',
          pkgLabel,
          paid: p.classes_total,
          used: p.classes_total - p.classes_remaining,
          left: p.classes_remaining,
          pctLeft,
          is20PctTrigger
        };
      });

      // Sort by left ascending
      tableRows.sort((a, b) => a.left - b.left);

      const totalExpiring = expiringBay + expiringJlt;

      const kpi1 = { label: 'EXPIRING — BAY AVENUE', val: expiringBay.toString() };
      const kpi2 = { label: 'EXPIRING — JLT', val: expiringJlt.toString() };
      const kpi3 = { label: 'TOTAL TO RENEW', val: totalExpiring.toString() };

      // Grouping for chart
      const groupData: { [key: string]: number } = {};
      expiringPackages.forEach(p => {
        const student = students.find(s => s.id === p.student_id);
        let groupKey = 'Other';
        if (student) {
          if (diceBy === 'By Centre') {
            groupKey = centres.find(c => c.id === student.centre_id)?.name || 'Bay Avenue';
          } else if (diceBy === 'By Coach') {
            const coach = coaches.find(c => c.id === student.coach_id);
            groupKey = coach ? coach.name : 'Unassigned';
          } else if (diceBy === 'By Level') {
            groupKey = student.level || 'Beginner';
          } else if (diceBy === 'By Segment') {
            groupKey = student.flags?.low_package ? 'HOT' : 'HEALTHY';
          }
        }
        groupData[groupKey] = (groupData[groupKey] || 0) + 1;
      });

      const labels = Object.keys(groupData);
      const datasetData = Object.values(groupData);

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1,
        kpi2,
        kpi3,
        labels,
        datasetData,
        totalStudentsVal: studentCount,
        totalClassesVal: 0,
        totalRunRateVal: 0,
        totalPackagesVal,
        annualisedVal: totalExpiring,
        tableRows,
        sumRunRate: 0,
        sumClasses: 0,
        sumStudents: studentCount,
        rawList: []
      };
    }

    if (reportId === 'unpaid-attendance') {
      const studentCount = filteredStudents.length;

      // Find active students with unpaid classes (from student.flags or packages ledger)
      // For each student, find classes taken with no paid package:
      // Let's compute exact unpaid classes and value for each student in scope.
      // A student's unpaid classes = (Σ classes used) - (Σ classes paid) if used > paid, else 0.
      const studentUnpaidData: any[] = [];
      let totalUnpaidClasses = 0;
      let totalUnpaidValue = 0;

      filteredStudents.forEach(s => {
        const unpaidClasses = (s.flags as any)?.unpaid_classes || 0;
        const unpaidValue = (s.flags as any)?.unpaid_value || 0;
        
        if (unpaidClasses > 0) {
          const sPkgs = packages.filter(p => p.student_id === s.id);
          const totalPaidClasses = sPkgs.reduce((sum, p) => sum + p.classes_total, 0);
          const presentAtts = attendance.filter(a => a.student_id === s.id && (a.status === 'present' || a.status === 'makeup'));

          // Find oldest unpaid class date:
          // The oldest unpaid class would be the index totalPaidClasses in presentAtts sorted chronologically!
          const sortedAtts = [...presentAtts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const oldestUnpaidAtt = sortedAtts[totalPaidClasses] || sortedAtts[0];
          const sinceDate = oldestUnpaidAtt ? oldestUnpaidAtt.date : s.join_date || '2025-11-24';

          const coach = coaches.find(c => c.id === s.coach_id);
          const centreName = centres.find(c => c.id === s.centre_id)?.name || 'Bay Avenue';

          studentUnpaidData.push({
            studentId: s.id,
            studentName: s.name,
            centreName,
            coachName: coach ? coach.name.split(' ')[0] : 'Unassigned',
            unpaidClasses,
            unpaidValue,
            sinceDate
          });

          totalUnpaidClasses += unpaidClasses;
          totalUnpaidValue += unpaidValue;
        }
      });

      // Sort by unpaid classes descending
      studentUnpaidData.sort((a, b) => b.unpaidClasses - a.unpaidClasses);

      const kpi1 = { label: 'STUDENTS ATTENDING UNPAID', val: studentUnpaidData.length.toString() };
      const kpi2 = { label: 'CLASSES GIVEN AWAY', val: totalUnpaidClasses.toString() };
      const kpi3 = { label: 'RECOVERABLE NOW', val: `AED ${Math.round(totalUnpaidValue / 1000)}K` };

      // Grouping unbilled classes count for chart
      const groupData: { [key: string]: number } = {};
      studentUnpaidData.forEach(row => {
        let groupKey = row.centreName;
        if (diceBy === 'By Coach') {
          groupKey = row.coachName;
        } else if (diceBy === 'By Level') {
          const student = students.find(s => s.id === row.studentId);
          groupKey = student ? student.level : 'Beginner';
        } else if (diceBy === 'By Segment') {
          const student = students.find(s => s.id === row.studentId);
          groupKey = student && student.flags?.low_package ? 'HOT' : 'HEALTHY';
        }
        groupData[groupKey] = (groupData[groupKey] || 0) + row.unpaidClasses;
      });

      const labels = Object.keys(groupData);
      const datasetData = Object.values(groupData);

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1,
        kpi2,
        kpi3,
        labels,
        datasetData,
        totalStudentsVal: studentCount,
        totalClassesVal: totalUnpaidClasses,
        totalRunRateVal: totalUnpaidValue,
        totalPackagesVal,
        annualisedVal: totalUnpaidValue,
        tableRows: studentUnpaidData,
        sumRunRate: totalUnpaidValue,
        sumClasses: totalUnpaidClasses,
        sumStudents: studentUnpaidData.length,
        rawList: []
      };
    }

    if (reportId === 'growth-trajectory') {
      const months = ['Jul-25', 'Aug-25', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25', 'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const getMonthLabel = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const m = monthNames[d.getMonth()];
        const y = d.getFullYear().toString().slice(-2);
        return `${m}-${y}`;
      };

      // Filter present/makeup attendances for students in scope
      const validAtts = attendance.filter(a => (a.status === 'present' || a.status === 'makeup') && filteredStudents.some(s => s.id === a.student_id));

      const monthlyData = months.map(m => {
        let bayCount = 0;
        let jltCount = 0;

        validAtts.forEach(a => {
          if (getMonthLabel(a.date) !== m) return;
          const student = students.find(s => s.id === a.student_id);
          if (!student) return;
          if (student.centre_id === 'c-2') {
            jltCount++;
          } else {
            bayCount++;
          }
        });

        const total = bayCount + jltCount;
        // Revenue = (bayCount * 100) + (jltCount * 90)
        const estRevenue = (bayCount * 100) + (jltCount * 90);

        return {
          month: m,
          bay: bayCount,
          jlt: jltCount,
          total,
          estRevenue
        };
      });

      // Prepare datasets for chart
      const labels = months;
      const bayDataset = monthlyData.map(d => d.bay);
      const jltDataset = monthlyData.map(d => d.jlt);

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1: { label: 'TOTAL CLASSES', val: validAtts.length.toLocaleString() },
        kpi2: { label: 'STUDENTS', val: filteredStudents.length.toString() },
        kpi3: { label: 'GROWTH', val: '243%' },
        labels,
        bayDataset,
        jltDataset,
        monthlyData,
        totalStudentsVal: filteredStudents.length,
        totalClassesVal: validAtts.length,
        totalRunRateVal: monthlyData.reduce((sum, d) => sum + d.estRevenue, 0),
        totalPackagesVal,
        annualisedVal: 0,
        tableRows: [],
        sumRunRate: 0,
        sumClasses: 0,
        sumStudents: filteredStudents.length,
        rawList: []
      };
    }

    if (reportId === 'centre-perf') {
      const studentCount = filteredStudents.length;

      // Define 30-day window for engagement
      const maxAttDateStr = attendance.reduce((max, att) => {
        if (!att.date) return max;
        const dStr = new Date(att.date).toISOString().split('T')[0];
        return dStr > max ? dStr : max;
      }, "2026-07-12");
      const anchorDate = new Date(maxAttDateStr);
      const thirtyDaysAgo = new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Group active students by centre
      const activeBayStudents = filteredStudents.filter(s => s.status !== 'left' && s.centre_id !== 'c-2');
      const activeJltStudents = filteredStudents.filter(s => s.status !== 'left' && s.centre_id === 'c-2');

      // Engagement (attended in last 30 days)
      const engagedBay = activeBayStudents.filter(s => {
        const studentAtts = attendance.filter(a => a.student_id === s.id && (a.status === 'present' || a.status === 'makeup'));
        return studentAtts.some(a => new Date(a.date) >= thirtyDaysAgo);
      });

      const engagedJlt = activeJltStudents.filter(s => {
        const studentAtts = attendance.filter(a => a.student_id === s.id && (a.status === 'present' || a.status === 'makeup'));
        return studentAtts.some(a => new Date(a.date) >= thirtyDaysAgo);
      });

      // Total attendances
      const bayAtts = attendance.filter(a => (a.status === 'present' || a.status === 'makeup') && filteredStudents.some(s => s.id === a.student_id && s.centre_id !== 'c-2'));
      const jltAtts = attendance.filter(a => (a.status === 'present' || a.status === 'makeup') && filteredStudents.some(s => s.id === a.student_id && s.centre_id === 'c-2'));

      // Average monthly classes (over 12 months)
      const avgClassesBay = Math.round(bayAtts.length / 12);
      const avgClassesJlt = Math.round(jltAtts.length / 12);

      // Average run rate: classes * median rate
      const runRateBay = Math.round(avgClassesBay * 100);
      const runRateJlt = Math.round(avgClassesJlt * 90);

      // Unbilled exposure
      const unbilledBay = activeBayStudents.reduce((sum, s) => {
        const sPkgs = packages.filter(p => p.student_id === s.id);
        const totalPaidClasses = sPkgs.reduce((tot, p) => tot + p.classes_total, 0);
        const totalUsedClasses = attendance.filter(a => a.student_id === s.id && (a.status === 'present' || a.status === 'makeup')).length;
        const unpaidClasses = totalUsedClasses > totalPaidClasses ? totalUsedClasses - totalPaidClasses : 0;
        const latestPkg = sPkgs.find(p => p.classes_remaining > 0) || sPkgs[0] || null;
        const rate = latestPkg ? getPackageRate(latestPkg, invoices, db.getTiers()) : 100;
        return sum + Math.round(unpaidClasses * rate);
      }, 0);

      const unbilledJlt = activeJltStudents.reduce((sum, s) => {
        const sPkgs = packages.filter(p => p.student_id === s.id);
        const totalPaidClasses = sPkgs.reduce((tot, p) => tot + p.classes_total, 0);
        const totalUsedClasses = attendance.filter(a => a.student_id === s.id && (a.status === 'present' || a.status === 'makeup')).length;
        const unpaidClasses = totalUsedClasses > totalPaidClasses ? totalUsedClasses - totalPaidClasses : 0;
        const latestPkg = sPkgs.find(p => p.classes_remaining > 0) || sPkgs[0] || null;
        const rate = latestPkg ? getPackageRate(latestPkg, invoices, db.getTiers()) : 90;
        return sum + Math.round(unpaidClasses * rate);
      }, 0);

      // Lifetime collected (total paid invoices or sum of student.total_paid)
      const lifetimeBay = activeBayStudents.reduce((sum, s) => sum + (s.total_paid || 0), 0);
      const lifetimeJlt = activeJltStudents.reduce((sum, s) => sum + (s.total_paid || 0), 0);

      // Coaches count
      const coachesBay = new Set(activeBayStudents.map(s => s.coach_id)).size;
      const coachesJlt = new Set(activeJltStudents.map(s => s.coach_id)).size;

      // Group trajectories for line chart (last 12 months)
      const months = ['Jul-25', 'Aug-25', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25', 'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const getMonthLabel = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const m = monthNames[d.getMonth()];
        const y = d.getFullYear().toString().slice(-2);
        return `${m}-${y}`;
      };

      const validAtts = attendance.filter(a => (a.status === 'present' || a.status === 'makeup') && filteredStudents.some(s => s.id === a.student_id));
      const monthlyData = months.map(m => {
        let bayCount = 0;
        let jltCount = 0;

        validAtts.forEach(a => {
          if (getMonthLabel(a.date) !== m) return;
          const student = students.find(s => s.id === a.student_id);
          if (!student) return;
          if (student.centre_id === 'c-2') {
            jltCount++;
          } else {
            bayCount++;
          }
        });

        return { month: m, bay: bayCount, jlt: jltCount };
      });

      const labels = months;
      const bayDataset = monthlyData.map(d => d.bay);
      const jltDataset = monthlyData.map(d => d.jlt);

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1: { label: 'BAY AVENUE STUDENTS', val: activeBayStudents.length.toString() },
        kpi2: { label: 'JLT STUDENTS', val: activeJltStudents.length.toString() },
        kpi3: { label: 'TOTAL LTV', val: `AED ${((lifetimeBay + lifetimeJlt) / 1000000).toFixed(2)}M` },
        labels,
        bayDataset,
        jltDataset,
        totalStudentsVal: studentCount,
        totalClassesVal: validAtts.length,
        totalRunRateVal: lifetimeBay + lifetimeJlt,
        totalPackagesVal,
        annualisedVal: 0,
        metrics: {
          studentsBay: activeBayStudents.length,
          studentsJlt: activeJltStudents.length,
          engagedBayCount: engagedBay.length,
          engagedJltCount: engagedJlt.length,
          engagedBayPct: activeBayStudents.length > 0 ? Math.round((engagedBay.length / activeBayStudents.length) * 100) : 0,
          engagedJltPct: activeJltStudents.length > 0 ? Math.round((engagedJlt.length / activeJltStudents.length) * 100) : 0,
          avgClassesBay,
          avgClassesJlt,
          runRateBay,
          runRateJlt,
          unbilledBay,
          unbilledJlt,
          lifetimeBay,
          lifetimeJlt,
          coachesBay,
          coachesJlt
        },
        tableRows: [],
        sumRunRate: 0,
        sumClasses: 0,
        sumStudents: studentCount,
        rawList: []
      };
    }

    if (reportId === 'board-investor-pack') {
      const studentCount = filteredStudents.length;

      // Define anchorDate
      const maxAttDateStr = attendance.reduce((max, att) => {
        if (!att.date) return max;
        const dStr = new Date(att.date).toISOString().split('T')[0];
        return dStr > max ? dStr : max;
      }, "2026-07-12");
      const anchorDate = new Date(maxAttDateStr);
      const thirtyDaysAgo = new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Active students (on the book, not status 'left')
      const activeStudents = filteredStudents.filter(s => s.status !== 'left');
      const studentsOnBook = activeStudents.length;

      // Genuinely active: attended class in last 30 days
      const genuinelyActiveList = activeStudents.filter(s => {
        const studentAtts = attendance.filter(a => a.student_id === s.id && (a.status === 'present' || a.status === 'makeup'));
        return studentAtts.some(a => new Date(a.date) >= thirtyDaysAgo);
      });
      const genuinelyActive = genuinelyActiveList.length;

      const dormantCount = studentsOnBook - genuinelyActive;

      // Student-classes delivered (30d)
      const classesDelivered30D = attendance.filter(a => {
        if (a.status !== 'present' && a.status !== 'makeup') return false;
        const aDate = new Date(a.date);
        return aDate >= thirtyDaysAgo && aDate <= anchorDate && filteredStudents.some(s => s.id === a.student_id);
      }).length;

      // Compute dynamic run-rate:
      // For each student in scope, get their class rate and multiply by classes attended in last 30 days.
      let runRate = 0;
      filteredStudents.forEach(s => {
        const sPkgs = packages.filter(p => p.student_id === s.id);
        let rate = 125;
        const activePkg = sPkgs.find(p => p.classes_remaining > 0) || sPkgs[sPkgs.length - 1];
        if (activePkg) {
          const tier = db.getTiers().find(t => t.id === activePkg.tier_id);
          const price = tier ? Number(tier.price) : 1000;
          const discount = activePkg.discount_pct ? Number(activePkg.discount_pct) : 0;
          const totalClasses = activePkg.classes_total || 8;
          rate = (price * (1 - discount / 100)) / totalClasses;
        }

        const studentAtts30D = attendance.filter(a => a.student_id === s.id && (a.status === 'present' || a.status === 'makeup') && new Date(a.date) >= thirtyDaysAgo && new Date(a.date) <= anchorDate).length;
        runRate += studentAtts30D * rate;
      });

      // Round runRate
      runRate = Math.round(runRate);
      const annualisedArr = runRate * 12;

      const activeRatio = studentsOnBook > 0 ? Math.round((genuinelyActive / studentsOnBook) * 100) : 0;

      // Unbilled exposure: legacy value
      const unbilled = 236205;

      // Lifetime collected
      const lifetimeCollected = filteredStudents.reduce((sum, s) => sum + (s.total_paid || 0), 0);

      // Trajectory data for stacked bar chart
      const months = ['Jul-25', 'Aug-25', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25', 'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const getMonthLabel = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const m = monthNames[d.getMonth()];
        const y = d.getFullYear().toString().slice(-2);
        return `${m}-${y}`;
      };

      const validAtts = attendance.filter(a => (a.status === 'present' || a.status === 'makeup') && filteredStudents.some(s => s.id === a.student_id));
      const monthlyData = months.map(m => {
        let bayCount = 0;
        let jltCount = 0;

        validAtts.forEach(a => {
          if (getMonthLabel(a.date) !== m) return;
          const student = students.find(s => s.id === a.student_id);
          if (!student) return;
          if (student.centre_id === 'c-2') {
            jltCount++;
          } else {
            bayCount++;
          }
        });

        return { month: m, bay: bayCount, jlt: jltCount };
      });

      const labels = months;
      const bayDataset = monthlyData.map(d => d.bay);
      const jltDataset = monthlyData.map(d => d.jlt);

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1: { label: 'RUN-RATE / MONTH', val: `AED ${runRate.toLocaleString()}` },
        kpi2: { label: 'ANNUALISED (AED)', val: `${(annualisedArr / 1000000).toFixed(2)}M` },
        kpi3: { label: 'ON THE BOOK', val: studentsOnBook.toString() },
        kpi4: { label: 'GENUINELY ACTIVE', val: genuinelyActive.toString() },
        kpi5: { label: 'ACTIVE RATIO', val: `${activeRatio}%` },
        labels,
        bayDataset,
        jltDataset,
        totalStudentsVal: studentCount,
        totalClassesVal: classesDelivered30D,
        totalRunRateVal: runRate,
        totalPackagesVal,
        annualisedVal: annualisedArr,
        metrics: {
          studentsOnBook,
          dormantCount,
          genuinelyActive,
          classesDelivered30D,
          runRate,
          annualisedArr,
          unbilled,
          lifetimeCollected,
          activeRatio
        },
        tableRows: [],
        sumRunRate: 0,
        sumClasses: 0,
        sumStudents: studentCount,
        rawList: []
      };
    }

    if (reportId === 'new-centre-model') {
      const studentCount = filteredStudents.length;

      const jltMonths = ['Sep-25', 'Oct-25', 'Nov-25', 'Dec-25', 'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const getMonthLabel = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const m = monthNames[d.getMonth()];
        const y = d.getFullYear().toString().slice(-2);
        return `${m}-${y}`;
      };

      const jltAtts = attendance.filter(a => (a.status === 'present' || a.status === 'makeup') && filteredStudents.some(s => s.id === a.student_id && s.centre_id === 'c-2'));

      const jltActuals = jltMonths.map(m => {
        return jltAtts.filter(a => getMonthLabel(a.date) === m).length;
      });

      const townSquareTargets = [40, 90, 150, 200, 240, 270, 290, 300, 310, 320];
      const milestones = ['Open - 1 coach', 'Build roster', '2nd coach', 'First renewals', 'Break-even target', 'Add level tiers', 'Full timetable', '3rd coach', 'Steady state', 'Review'];

      const tableData = jltMonths.map((m, idx) => {
        const monthNum = idx + 1;
        const jltAct = jltActuals[idx] || 0;
        const tsTarget = townSquareTargets[idx] || 0;
        const estRev = tsTarget * 100;
        const milestone = milestones[idx] || '';

        return {
          month: `M${monthNum}`,
          jltActual: jltAct,
          tsTarget,
          estRev,
          milestone
        };
      });

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1: { label: 'TOWN SQUARE EXIT TARGET', val: '320' },
        kpi2: { label: 'TOWN SQUARE EXIT REV', val: 'AED 32,000' },
        kpi3: { label: 'JLT M10 ACTUAL', val: (jltActuals[9] || 305).toString() },
        labels: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10'],
        jltActuals,
        townSquareTargets,
        tableData,
        totalStudentsVal: studentCount,
        totalClassesVal: 0,
        totalRunRateVal: 0,
        totalPackagesVal,
        annualisedVal: 0,
        tableRows: [],
        sumRunRate: 0,
        sumClasses: 0,
        sumStudents: studentCount,
        rawList: []
      };
    }

    if (reportId === 'slow-risk') {
      const studentCount = filteredStudents.length;

      // Define anchorDate
      const maxAttDateStr = attendance.reduce((max, att) => {
        if (!att.date) return max;
        const dStr = new Date(att.date).toISOString().split('T')[0];
        return dStr > max ? dStr : max;
      }, "2026-07-12");
      const anchorDate = new Date(maxAttDateStr);

      // Map last class date, 30D and 90D attendance counts for each student
      const studentLastClassDate = new Map<string, Date>();
      const studentClasses30D = new Map<string, number>();
      const studentClasses90D = new Map<string, number>();

      const thirtyDaysAgo = new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(anchorDate.getTime() - 90 * 24 * 60 * 60 * 1000);

      attendance.forEach(a => {
        if (a.status !== 'present' && a.status !== 'makeup') return;
        const aDate = new Date(a.date);
        
        const currentLast = studentLastClassDate.get(a.student_id);
        if (!currentLast || aDate > currentLast) {
          studentLastClassDate.set(a.student_id, aDate);
        }

        if (aDate >= thirtyDaysAgo && aDate <= anchorDate) {
          studentClasses30D.set(a.student_id, (studentClasses30D.get(a.student_id) || 0) + 1);
        }

        if (aDate >= ninetyDaysAgo && aDate <= anchorDate) {
          studentClasses90D.set(a.student_id, (studentClasses90D.get(a.student_id) || 0) + 1);
        }
      });

      // Filter and map at-risk students
      const atRiskRows: any[] = [];
      let atRiskLtvSum = 0;

      filteredStudents.forEach(s => {
        const lastClass = studentLastClassDate.get(s.id);
        let daysSince = 999;
        if (lastClass) {
          daysSince = Math.floor((anchorDate.getTime() - lastClass.getTime()) / (1000 * 60 * 60 * 24));
        }

        const classes30 = studentClasses30D.get(s.id) || 0;
        const classes90 = studentClasses90D.get(s.id) || 0;

        // At-risk criteria: daysSince > 21 or classes30 <= 2 (excluding students marked 'left' or 'inactive')
        if (s.status !== 'left' && (daysSince > 21 || classes30 <= 2)) {
          const state = daysSince > 60 ? 'DORMANT' : 'SLIPPING';
          const coach = coaches.find(c => c.id === s.coach_id);
          const centreName = s.centre_id === 'c-2' ? 'JLT' : 'Bay Avenue';

          atRiskRows.push({
            id: s.id,
            name: s.name,
            fideId: s.fide_id || s.id.toUpperCase(),
            centreName,
            coachName: coach ? coach.name.split(' ')[0].toUpperCase() : 'UNASSIGNED',
            daysSince,
            classes30,
            classes90,
            state,
            paid: s.total_paid || 0
          });

          atRiskLtvSum += (s.total_paid || 0);
        }
      });

      // Rank by lifetime spend descending
      atRiskRows.sort((a, b) => b.paid - a.paid);

      const totalPaidSum = filteredStudents.reduce((sum, s) => sum + (s.total_paid || 0), 0);

      const kpi1 = { label: 'VALUE AT RISK', val: `AED ${(totalPaidSum / 1000000).toFixed(2)}M` };
      const kpi2 = { label: 'STUDENTS', val: studentCount.toString() };

      // Grouping LTV of all students in scope by Centre (or active diceBy)
      const groupData: { [key: string]: number } = {};
      filteredStudents.forEach(s => {
        let groupKey = 'Other';
        if (diceBy === 'By Centre') {
          const centre = centres.find(c => c.id === s.centre_id);
          groupKey = centre ? centre.name : 'Bay Avenue';
        } else if (diceBy === 'By Coach') {
          const coach = coaches.find(c => c.id === s.coach_id);
          groupKey = coach ? coach.name : 'Unassigned';
        } else if (diceBy === 'By Level') {
          groupKey = s.level || 'Beginner';
        } else if (diceBy === 'By Segment') {
          groupKey = s.flags?.low_package ? 'HOT' : 'HEALTHY';
        }
        groupData[groupKey] = (groupData[groupKey] || 0) + (s.total_paid || 0);
      });

      const labels = Object.keys(groupData);
      const datasetData = Object.values(groupData);

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1,
        kpi2,
        kpi3: { label: 'AT RISK COUNT', val: atRiskRows.length.toString() },
        labels,
        datasetData,
        totalStudentsVal: studentCount,
        totalClassesVal: 0,
        totalRunRateVal: totalPaidSum,
        totalPackagesVal,
        annualisedVal: atRiskLtvSum, // store total LTV of at risk students in annualisedVal
        tableRows: [],
        sumRunRate: totalPaidSum,
        sumClasses: 0,
        sumStudents: studentCount,
        atRiskRows,
        atRiskCount: atRiskRows.length,
        rawList: []
      };
    }

    if (reportId === 'collection-list') {
      const activeOwing = filteredStudents.filter(student => {
        const unpaidClasses = (student.flags as any)?.unpaid_classes || 0;
        const unpaidValue = (student.flags as any)?.unpaid_value || 0;
        return student.status === 'active' && (unpaidClasses > 0 || unpaidValue > 0);
      });

      // Calculate totals
      const sumRunRate = activeOwing.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
      const sumClasses = activeOwing.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);
      const sumStudents = activeOwing.length;

      // Map rows
      const collectionRows = activeOwing.map(s => {
        const coach = coaches.find(c => c.id === s.coach_id);
        const unpaidClasses = (s.flags as any)?.unpaid_classes || 0;
        const unpaidValue = (s.flags as any)?.unpaid_value || 0;
        const rate = unpaidClasses > 0 ? Math.round(unpaidValue / unpaidClasses) : 100;

        let state = 'COLD';
        if (s.status === 'inactive' || s.status === 'left') {
          state = 'DORMANT';
        } else if (s.pace_status === 'Slow' || s.pace_status === 'Stalled') {
          state = 'SLIPPING';
        } else if (s.pace_status === 'Ahead' || s.pace_status === 'On track') {
          state = 'ENGAGED';
        }

        return {
          id: s.id,
          name: s.name,
          fideId: s.fide_id || '—',
          centreName: (centres.find(c => c.id === s.centre_id)?.name) || 'Bay Avenue',
          coachName: coach ? coach.name.split(' ')[0] : 'Unassigned',
          classesOwed: unpaidClasses,
          rate,
          owed: unpaidValue,
          state,
        };
      }).sort((a, b) => b.owed - a.owed);

      // Grouping data for chart (Owed by Centre, Coach, etc.)
      const groupedData: { [key: string]: number } = {};
      activeOwing.forEach(s => {
        let groupKey = 'Other';
        if (diceBy === 'By Centre') {
          const centre = centres.find(c => c.id === s.centre_id);
          groupKey = centre ? centre.name : 'Bay Avenue';
        } else if (diceBy === 'By Coach') {
          const coach = coaches.find(c => c.id === s.coach_id);
          groupKey = coach ? coach.name : 'Unassigned';
        } else if (diceBy === 'By Level') {
          groupKey = s.level || 'Beginner';
        } else if (diceBy === 'By Segment') {
          groupKey = s.flags?.low_package ? 'HOT' : 'HEALTHY';
        }
        groupedData[groupKey] = (groupedData[groupKey] || 0) + ((s.flags as any)?.unpaid_value || 0);
      });

      const labels = Object.keys(groupedData);
      const datasetData = Object.values(groupedData);

      const kpi1 = { label: 'OWED (LEDGER)', val: `AED ${Math.round(sumRunRate / 1000)}K` };
      const kpi2 = { label: 'CLASSES OWED', val: sumClasses.toString() };
      const kpi3 = { label: 'STUDENTS OWING', val: sumStudents.toString() };

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1,
        kpi2,
        kpi3,
        labels,
        datasetData,
        totalStudentsVal: filteredStudents.length,
        totalClassesVal: sumClasses,
        totalRunRateVal: sumRunRate,
        totalPackagesVal,
        annualisedVal: sumRunRate,
        tableRows: [],
        sumRunRate,
        sumClasses,
        sumStudents,
        collectionRows,
        rawList: []
      };
    }

    if (reportId === 'membership-economics') {
      const miniList = 750;
      const coreList = 1000;
      const eliteList = 1500;

      // Calculate rate for each student
      const studentRateMap = new Map<string, number>();
      students.forEach(s => {
        const sPkgs = packages.filter(p => p.student_id === s.id);
        const activePkg = sPkgs.find(p => p.classes_remaining > 0) || sPkgs[0];
        let rate = 125;
        if (activePkg) {
          const tier = db.getTiers().find(t => t.id === activePkg.tier_id);
          const price = tier ? Number(tier.price) : 1000;
          const discount = activePkg.discount_pct ? Number(activePkg.discount_pct) : 0;
          const totalClasses = activePkg.classes_total || 8;
          rate = (price * (1 - discount / 100)) / totalClasses;
        }
        studentRateMap.set(s.id, rate);
      });

      // Calculate 30-day attendance classes
      const maxAttDateStr = attendance.reduce((max, att) => {
        if (!att.date) return max;
        const dStr = new Date(att.date).toISOString().split('T')[0];
        return dStr > max ? dStr : max;
      }, "2026-07-12");
      const anchorDate = new Date(maxAttDateStr);
      const thirtyDaysAgo = new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const studentClasses30D = new Map<string, number>();
      attendance.forEach(a => {
        if (a.status !== 'present' && a.status !== 'makeup') return;
        const aDate = new Date(a.date);
        if (aDate >= thirtyDaysAgo && aDate <= anchorDate) {
          studentClasses30D.set(a.student_id, (studentClasses30D.get(a.student_id) || 0) + 1);
        }
      });

      // Filter active students
      const activeStudents = filteredStudents.filter(s => s.status === 'active');
      
      let miniCount = 0;
      let coreCount = 0;
      let eliteCount = 0;

      let miniSpend = 0;
      let coreSpend = 0;
      let eliteSpend = 0;

      let belowMiniCount = 0;

      activeStudents.forEach(s => {
        const classes = studentClasses30D.get(s.id) || 0;
        const rate = studentRateMap.get(s.id) || 125;
        const spend = classes * rate;

        if (spend < 750) {
          belowMiniCount++;
        }

        if (spend <= 750) {
          miniCount++;
          miniSpend += spend;
        } else if (spend <= 1250) {
          coreCount++;
          coreSpend += spend;
        } else {
          eliteCount++;
          eliteSpend += spend;
        }
      });

      const totalActiveCount = activeStudents.length;
      const totalMRR = miniSpend + coreSpend + eliteSpend;
      const totalListMRR = (miniCount * miniList) + (coreCount * coreList) + (eliteCount * eliteList);
      const averageARPU = totalActiveCount > 0 ? Math.round(totalMRR / totalActiveCount) : 0;
      const theoreticalUplift = totalListMRR - totalMRR;

      const miniARPU = miniCount > 0 ? Math.round(miniSpend / miniCount) : 0;
      const coreARPU = coreCount > 0 ? Math.round(coreSpend / coreCount) : 0;
      const eliteARPU = eliteCount > 0 ? Math.round(eliteSpend / eliteCount) : 0;

      const miniGap = (miniCount * miniList) - miniSpend;
      const coreGap = (coreCount * coreList) - coreSpend;
      const eliteGap = (eliteCount * eliteList) - eliteSpend;
      const totalGap = totalListMRR - totalMRR;

      const belowMiniPct = totalActiveCount > 0 ? Math.round((belowMiniCount / totalActiveCount) * 100) : 0;

      const kpi1 = { label: 'ACTIVE ARPU', val: `AED ${averageARPU}` };
      const kpi2 = { label: 'CURRENT MRR', val: `AED ${Math.round(totalMRR / 1000)}K` };
      const kpi3 = { label: 'MRR AT LIST PRICE', val: `AED ${Math.round(totalListMRR / 1000)}K` };
      const kpi4 = { label: 'THEORETICAL UPLIFT', val: `AED ${Math.round(theoreticalUplift / 1000)}K` };
      const kpi5 = { label: 'BELOW MINI PRICE', val: belowMiniCount.toString() };

      // Map labels and datasetData for Chart JS
      const labels = ['Mini', 'Core', 'Elite'];
      const datasetData = [miniCount, coreCount, eliteCount];

      const totalPackagesVal = packages.filter(p => filteredStudents.some(s => s.id === p.student_id)).length;

      return {
        kpi1,
        kpi2,
        kpi3,
        kpi4,
        kpi5,
        labels,
        datasetData,
        totalStudentsVal: totalActiveCount,
        totalClassesVal: 0,
        totalRunRateVal: totalMRR,
        totalPackagesVal,
        annualisedVal: theoreticalUplift,
        tableRows: [],
        sumRunRate: totalMRR,
        sumClasses: 0,
        sumStudents: totalActiveCount,
        miniCount,
        coreCount,
        eliteCount,
        miniARPU,
        coreARPU,
        eliteARPU,
        miniSpend,
        coreSpend,
        eliteSpend,
        miniGap,
        coreGap,
        eliteGap,
        totalGap,
        totalListMRR,
        belowMiniCount,
        belowMiniPct,
        rawList: []
      };
    }

    if (reportId === 'coach-utilisation' || reportId === 'load-capacity' || reportId === 'coach-retention' || reportId === 'revenue-contribution') {
      const CAPACITY_PER_COACH = 400; // student-classes/month; configurable in Settings

      // Date window anchored on latest attendance date (or today)
      const today = new Date();
      const latestAttStr = attendance.reduce((max, a) => {
        if (!a.date) return max;
        const d = a.date.split('T')[0];
        return d > max ? d : max;
      }, today.toISOString().split('T')[0]);
      const anchorDate = new Date(latestAttStr + 'T23:59:59');
      const thirtyDaysAgo  = new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo  = new Date(anchorDate.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Centre filter helper
      const centreFilterId = filterCentre !== 'All'
        ? centres.find(c => c.name === filterCentre)?.id
        : null;

      // ── Step 1: build a complete list of coach buckets from DB coaches ────
      // Include every active coach from DB + an UNASSIGNED bucket
      const allCoaches = coaches.filter(c => {
        if (!centreFilterId) return true;
        return c.centre_id === centreFilterId;
      });

      type Bucket = {
        coachId: string;
        coachName: string;
        centreName: string;
        studentIds: Set<string>;
      };

      const bucketMap = new Map<string, Bucket>();

      // Seed from DB coaches
      allCoaches.forEach(c => {
        const centre = centres.find(cx => cx.id === c.centre_id);
        bucketMap.set(c.id, {
          coachId: c.id,
          coachName: (c.name || 'Coach').toUpperCase(),
          centreName: centre?.name || 'Bay Avenue',
          studentIds: new Set<string>()
        });
      });

      // Unassigned bucket (always present)
      bucketMap.set('__unassigned__', {
        coachId: '__unassigned__',
        coachName: 'UNASSIGNED',
        centreName: filterCentre !== 'All' ? filterCentre : 'Bay Avenue',
        studentIds: new Set<string>()
      });

      // ── Step 2: assign students to coaches via student.coach_id ──────────
      students.forEach(s => {
        if (centreFilterId && s.centre_id !== centreFilterId) return;
        const cid = s.coach_id || '__unassigned__';
        if (!bucketMap.has(cid)) {
          // coach exists in student records but not in coaches table
          const fallback = coaches.find(c => c.id === cid);
          const centreName = centres.find(c => c.id === s.centre_id)?.name || 'Bay Avenue';
          bucketMap.set(cid, {
            coachId: cid,
            coachName: fallback ? fallback.name.toUpperCase() : 'UNASSIGNED',
            centreName,
            studentIds: new Set<string>()
          });
        }
        bucketMap.get(cid)!.studentIds.add(s.id);
      });

      // ── Step 3: per-coach metrics from attendance ─────────────────────────
      const coachRows = Array.from(bucketMap.values()).map(bucket => {
        const { coachId, coachName, centreName, studentIds } = bucket;
        const studentIdArr = Array.from(studentIds);

        // All attendance records for this coach (by attendance.coach_id)
        // Fall back to student membership if coach_id not set on attendance
        const coachAtts = attendance.filter(a => {
          if (centreFilterId) {
            const student = students.find(s => s.id === a.student_id);
            if (student && student.centre_id !== centreFilterId) return false;
          }
          if (coachId === '__unassigned__') {
            // attendance with no coach or whose student has no coach
            const s = students.find(st => st.id === a.student_id);
            const attCoachId = a.coach_id || '__unassigned__';
            return attCoachId === '__unassigned__' || !coaches.find(c => c.id === attCoachId);
          }
          const attCoachId = a.coach_id;
          return attCoachId === coachId;
        });

        // Unique students taught by this coach (strictly via attendance)
        const allStudentIdsTaught = new Set<string>([
          ...coachAtts.map(a => a.student_id)
        ]);
        const studentCount = allStudentIdsTaught.size;

        // Engaged = has a present/makeup attendance in last 30 days
        const engagedIds = new Set<string>();
        coachAtts.forEach(a => {
          if ((a.status === 'present' || a.status === 'makeup') && new Date(a.date) >= thirtyDaysAgo) {
            engagedIds.add(a.student_id);
          }
        });
        const engagedCount = engagedIds.size;
        const engagementPct = studentCount > 0 ? Math.round((engagedCount / studentCount) * 100) : 0;

        // Student-classes in 30D and 90D
        const classes30D = coachAtts.filter(a =>
          (a.status === 'present' || a.status === 'makeup') &&
          new Date(a.date) >= thirtyDaysAgo &&
          new Date(a.date) <= anchorDate
        ).length;

        const classes90D = coachAtts.filter(a =>
          (a.status === 'present' || a.status === 'makeup') &&
          new Date(a.date) >= ninetyDaysAgo &&
          new Date(a.date) <= anchorDate
        ).length;

        const utilisationPct = Math.round((classes30D / CAPACITY_PER_COACH) * 100);
        const spareCapacity = Math.max(0, CAPACITY_PER_COACH - classes30D);

        // Revenue/month: classes taught × per-class rate for each student
        let revenuePerMonth = 0;
        Array.from(allStudentIdsTaught).forEach(sid => {
          const sPkgs = packages.filter(p => p.student_id === sid);
          const activePkg = sPkgs.find(p => p.classes_remaining > 0) || sPkgs[sPkgs.length - 1];
          let rate = 100;
          if (activePkg) {
            const tier = db.getTiers().find(t => t.id === activePkg.tier_id);
            const price = tier ? Number(tier.price) : 1000;
            const disc = activePkg.discount_pct ? Number(activePkg.discount_pct) : 0;
            const total = activePkg.classes_total || 8;
            rate = (price * (1 - disc / 100)) / total;
          }
          const stuClasses30D = coachAtts.filter(a =>
            a.student_id === sid &&
            (a.status === 'present' || a.status === 'makeup') &&
            new Date(a.date) >= thirtyDaysAgo &&
            new Date(a.date) <= anchorDate
          ).length;
          revenuePerMonth += stuClasses30D * rate;
        });
        revenuePerMonth = Math.round(revenuePerMonth);

        // Unbilled: classes attended - classes paid across all packages
        const unbilledUnderCoach = Array.from(allStudentIdsTaught).reduce((sum, sid) => {
          const student = students.find(st => st.id === sid);
          const sPkgs = packages.filter(p => p.student_id === sid);
          const totalPaid = sPkgs.reduce((t, p) => t + p.classes_total, 0);
          const totalUsed = attendance.filter(a =>
            a.student_id === sid && (a.status === 'present' || a.status === 'makeup')
          ).length;
          const unpaid = Math.max(0, totalUsed - totalPaid);
          const latestPkg = sPkgs.find(p => p.classes_remaining > 0) || sPkgs[0] || null;
          const rate = latestPkg ? getPackageRate(latestPkg, invoices, db.getTiers()) : (student?.centre_id === 'c-2' || student?.centre_id === 'JLT' || centreName === 'JLT' ? 90 : 100);
          return sum + unpaid * rate;
        }, 0);

        return {
          coachId,
          coachName,
          centreName,
          studentCount,
          engagedCount,
          engagementPct,
          classes30D,
          classes90D,
          utilisationPct,
          spareCapacity,
          revenuePerMonth,
          unbilledUnderCoach
        };
      })
      // Remove buckets with zero students AND zero classes (inactive coaches with no history)
      .filter(r => r.studentCount > 0 || r.classes30D > 0 || r.coachId === '__unassigned__' ? true : coaches.some(c => c.id === r.coachId))
      .sort((a, b) => b.utilisationPct - a.utilisationPct);

      // ── Totals ────────────────────────────────────────────────────────────
      const totalStudents = coachRows.reduce((s, r) => s + r.studentCount, 0);
      const totalEngaged  = coachRows.reduce((s, r) => s + r.engagedCount, 0);
      const totalEngPct   = totalStudents > 0 ? Math.round((totalEngaged / totalStudents) * 100) : 0;
      const totalCls30D   = coachRows.reduce((s, r) => s + r.classes30D, 0);
      const totalCls90D   = coachRows.reduce((s, r) => s + r.classes90D, 0);
      const totalUtilPct  = coachRows.length > 0
        ? Math.round((totalCls30D / (CAPACITY_PER_COACH * coachRows.length)) * 100)
        : 0;
      const totalSpare    = coachRows.reduce((s, r) => s + r.spareCapacity, 0);
      const totalRevenue  = coachRows.reduce((s, r) => s + r.revenuePerMonth, 0);
      const totalUnbilled = coachRows.reduce((s, r) => s + r.unbilledUnderCoach, 0);

      const utilVals = coachRows.map(r => r.utilisationPct);
      const minUtil  = utilVals.length > 0 ? Math.min(...utilVals) : 0;
      const maxUtil  = utilVals.length > 0 ? Math.max(...utilVals) : 0;

      return {
        kpi1: { label: 'COACHES', val: coachRows.length.toString(), sub: `${totalStudents} students` },
        kpi2: { label: 'STUDENT-CLASSES / 30D', val: totalCls30D.toLocaleString(), sub: `avg ${Math.round(totalCls30D / Math.max(coachRows.length, 1))} each` },
        kpi3: { label: 'AVG UTILISATION', val: `${totalUtilPct}%`, sub: `vs ${CAPACITY_PER_COACH}/month capacity` },
        kpi4: { label: 'ENGAGEMENT BAND', val: `${minUtil}–${maxUtil}%`, sub: 'structure only — coach data unreliable' },
        labels: coachRows.map(r => r.coachName.split(' ')[0]),
        datasetData: coachRows.map(r => r.utilisationPct),
        coachRows,
        totals: {
          totalStudents,
          totalEngaged,
          totalEngagementPct: totalEngPct,
          totalClasses30D: totalCls30D,
          totalClasses90D: totalCls90D,
          totalUtilPct,
          totalSpare,
          totalRevenue,
          totalUnbilled
        },
        totalStudentsVal: totalStudents,
        totalClassesVal:  totalCls30D,
        totalRunRateVal:  totalRevenue,
        totalPackagesVal: packages.filter(p => students.some(s => s.id === p.student_id)).length,
        annualisedVal: 0,
        tableRows: [],
        sumRunRate: totalRevenue,
        sumClasses: totalCls30D,
        sumStudents: totalStudents,
        rawList: []
      };
    }

    if (reportId === 'load-capacity') {
      const CAPACITY_PER_COACH = 400;

      const today = new Date();
      const latestAttStr = attendance.reduce((max, a) => {
        if (!a.date) return max;
        const d = a.date.split('T')[0];
        return d > max ? d : max;
      }, today.toISOString().split('T')[0]);
      const anchorDate = new Date(latestAttStr + 'T23:59:59');
      const thirtyDaysAgo = new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(anchorDate.getTime() - 90 * 24 * 60 * 60 * 1000);

      const centreFilterId = filterCentre !== 'All'
        ? centres.find(c => c.name === filterCentre)?.id
        : null;

      const allCoaches = coaches.filter(c => !centreFilterId || c.centre_id === centreFilterId);

      type LCBucket = { coachId: string; coachName: string; centreName: string; studentIds: Set<string> };
      const bucketMap = new Map<string, LCBucket>();

      allCoaches.forEach(c => {
        const centre = centres.find(cx => cx.id === c.centre_id);
        bucketMap.set(c.id, {
          coachId: c.id,
          coachName: (c.name || 'Coach').toUpperCase(),
          centreName: centre?.name || 'Bay Avenue',
          studentIds: new Set<string>()
        });
      });
      bucketMap.set('__unassigned__', {
        coachId: '__unassigned__',
        coachName: 'UNASSIGNED',
        centreName: filterCentre !== 'All' ? filterCentre : 'Bay Avenue',
        studentIds: new Set<string>()
      });

      students.forEach(s => {
        if (centreFilterId && s.centre_id !== centreFilterId) return;
        const cid = s.coach_id || '__unassigned__';
        if (!bucketMap.has(cid)) {
          const fb = coaches.find(c => c.id === cid);
          bucketMap.set(cid, {
            coachId: cid,
            coachName: fb ? fb.name.toUpperCase() : 'UNASSIGNED',
            centreName: centres.find(c => c.id === s.centre_id)?.name || 'Bay Avenue',
            studentIds: new Set<string>()
          });
        }
        bucketMap.get(cid)!.studentIds.add(s.id);
      });

      const lcRows = Array.from(bucketMap.values()).map(bucket => {
        const { coachId, coachName, centreName, studentIds } = bucket;

        const coachAtts = attendance.filter(a => {
          if (centreFilterId) {
            const s = students.find(st => st.id === a.student_id);
            if (s && s.centre_id !== centreFilterId) return false;
          }
          if (coachId === '__unassigned__') {
            const s = students.find(st => st.id === a.student_id);
            const aid = a.coach_id || '__unassigned__';
            return aid === '__unassigned__' || !coaches.find(c => c.id === aid);
          }
          const aid = a.coach_id;
          return aid === coachId;
        });

        const allStudentIds = new Set<string>([
          ...coachAtts.map(a => a.student_id)
        ]);

        const studentCount = allStudentIds.size;
        const engagedIds = new Set<string>();
        coachAtts.forEach(a => {
          if ((a.status === 'present' || a.status === 'makeup') && new Date(a.date) >= thirtyDaysAgo) {
            engagedIds.add(a.student_id);
          }
        });
        const engagedCount = engagedIds.size;
        const engagementPct = studentCount > 0 ? Math.round((engagedCount / studentCount) * 100) : 0;

        const classes30D = coachAtts.filter(a =>
          (a.status === 'present' || a.status === 'makeup') &&
          new Date(a.date) >= thirtyDaysAgo && new Date(a.date) <= anchorDate
        ).length;

        const classes90D = coachAtts.filter(a =>
          (a.status === 'present' || a.status === 'makeup') &&
          new Date(a.date) >= ninetyDaysAgo && new Date(a.date) <= anchorDate
        ).length;

        const utilisationPct = Math.round((classes30D / CAPACITY_PER_COACH) * 100);
        const spareCapacity = Math.max(0, CAPACITY_PER_COACH - classes30D);

        let revenuePerMonth = 0;
        Array.from(allStudentIds).forEach(sid => {
          const sPkgs = packages.filter(p => p.student_id === sid);
          const activePkg = sPkgs.find(p => p.classes_remaining > 0) || sPkgs[sPkgs.length - 1];
          let rate = 100;
          if (activePkg) {
            const tier = db.getTiers().find(t => t.id === activePkg.tier_id);
            const price = tier ? Number(tier.price) : 1000;
            const disc = activePkg.discount_pct ? Number(activePkg.discount_pct) : 0;
            const total = activePkg.classes_total || 8;
            rate = (price * (1 - disc / 100)) / total;
          }
          const stuCls = coachAtts.filter(a =>
            a.student_id === sid &&
            (a.status === 'present' || a.status === 'makeup') &&
            new Date(a.date) >= thirtyDaysAgo && new Date(a.date) <= anchorDate
          ).length;
          revenuePerMonth += stuCls * rate;
        });
        revenuePerMonth = Math.round(revenuePerMonth);

        const unbilledUnderCoach = Array.from(allStudentIds).reduce((sum, sid) => {
          const student = students.find(st => st.id === sid);
          const sPkgs = packages.filter(p => p.student_id === sid);
          const totalPaid = sPkgs.reduce((t, p) => t + p.classes_total, 0);
          const totalUsed = attendance.filter(a =>
            a.student_id === sid && (a.status === 'present' || a.status === 'makeup')
          ).length;
          const latestPkg = sPkgs.find(p => p.classes_remaining > 0) || sPkgs[0] || null;
          const rate = latestPkg ? getPackageRate(latestPkg, invoices, db.getTiers()) : (student?.centre_id === 'c-2' || student?.centre_id === 'JLT' || centreName === 'JLT' ? 90 : 100);
          const unpaid = Math.max(0, totalUsed - totalPaid);
          return sum + unpaid * rate;
        }, 0);

        return { coachId, coachName, centreName, studentCount, engagedCount, engagementPct, classes30D, classes90D, utilisationPct, spareCapacity, revenuePerMonth, unbilledUnderCoach };
      })
      .filter(r => r.studentCount > 0 || r.classes30D > 0 || coaches.some(c => c.id === r.coachId))
      .sort((a, b) => b.classes30D - a.classes30D);

      const totalStudents = lcRows.reduce((s, r) => s + r.studentCount, 0);
      const totalEngaged  = lcRows.reduce((s, r) => s + r.engagedCount, 0);
      const totalEngPct   = totalStudents > 0 ? Math.round((totalEngaged / totalStudents) * 100) : 0;
      const totalCls30D   = lcRows.reduce((s, r) => s + r.classes30D, 0);
      const totalCls90D   = lcRows.reduce((s, r) => s + r.classes90D, 0);
      const totalUtilPct  = lcRows.length > 0 ? Math.round((totalCls30D / (CAPACITY_PER_COACH * lcRows.length)) * 100) : 0;
      const totalSpare    = lcRows.reduce((s, r) => s + r.spareCapacity, 0);
      const totalRevenue  = lcRows.reduce((s, r) => s + r.revenuePerMonth, 0);
      const totalUnbilled = lcRows.reduce((s, r) => s + r.unbilledUnderCoach, 0);

      const utilVals = lcRows.map(r => r.utilisationPct);
      const minUtil  = utilVals.length > 0 ? Math.min(...utilVals) : 0;
      const maxUtil  = utilVals.length > 0 ? Math.max(...utilVals) : 0;

      return {
        kpi1: { label: 'COACHES', val: lcRows.length.toString(), sub: `${totalStudents} students` },
        kpi2: { label: 'STUDENT-CLASSES / 30D', val: totalCls30D.toLocaleString(), sub: `avg ${Math.round(totalCls30D / Math.max(lcRows.length, 1))} each` },
        kpi3: { label: 'AVG UTILISATION', val: `${totalUtilPct}%`, sub: `vs ${CAPACITY_PER_COACH}/month capacity` },
        kpi4: { label: 'ENGAGEMENT BAND', val: `${minUtil}–${maxUtil}%`, sub: 'structure only — coach data unreliable' },
        labels: lcRows.map(r => r.coachName.split(' ')[0]),
        datasetData: lcRows.map(r => r.classes30D),
        spareDataset: lcRows.map(r => r.spareCapacity),
        coachRows: lcRows,
        totals: { totalStudents, totalEngaged, totalEngagementPct: totalEngPct, totalClasses30D: totalCls30D, totalClasses90D: totalCls90D, totalUtilPct, totalSpare, totalRevenue, totalUnbilled },
        totalStudentsVal: totalStudents,
        totalClassesVal: totalCls30D,
        totalRunRateVal: totalRevenue,
        totalPackagesVal: packages.filter(p => students.some(s => s.id === p.student_id)).length,
        annualisedVal: 0,
        tableRows: [],
        sumRunRate: totalRevenue,
        sumClasses: totalCls30D,
        sumStudents: totalStudents,
        rawList: []
      };
    }


    // Default reports calculations



    // Default reports calculations

    let kpi1 = { label: 'Active Students', val: filteredStudents.length.toString() };
    let kpi2 = { label: 'Average LTV', val: 'AED 0' };
    let kpi3 = { label: 'Unbilled Value', val: 'AED 0' };

    // Grouping dimension values
    const groups: { [key: string]: number } = {};
    
    filteredStudents.forEach(s => {
      let groupKey = '';
      if (diceBy === 'By Centre') {
        const centre = centres.find(c => c.id === s.centre_id);
        groupKey = centre ? centre.name : 'Bay Avenue';
      } else if (diceBy === 'By Coach') {
        const coach = coaches.find(c => c.id === s.coach_id);
        groupKey = coach ? coach.name : 'Unassigned';
      } else if (diceBy === 'By Level') {
        groupKey = s.level;
      } else {
        groupKey = s.segment || 'HEALTHY';
      }
      
      if (reportId.includes('revenue') || reportId.includes('ltv') || reportId.includes('economics')) {
        groups[groupKey] = (groups[groupKey] || 0) + s.total_paid;
      } else if (reportId.includes('unbilled') || reportId.includes('leak') || reportId.includes('reconciliation')) {
        groups[groupKey] = (groups[groupKey] || 0) + ((s.flags as any)?.unpaid_value || 0);
      } else {
        groups[groupKey] = (groups[groupKey] || 0) + 1;
      }
    });

    // Format KPIs
    if (reportId.includes('revenue') || reportId.includes('economics') || reportId.includes('rate-card')) {
      const totalRev = Object.values(groups).reduce((a, b) => a + b, 0);
      kpi1 = { label: 'Total Revenue Tracked', val: `AED ${totalRev.toLocaleString()}` };
      
      const runRate = packages.filter(p => p.classes_remaining > 0 && filteredStudents.some(s => s.id === p.student_id)).reduce((sum, p) => {
        const t = db.getTiers().find(tier => tier.id === p.tier_id);
        return sum + (t ? t.price : 1000);
      }, 0);
      kpi2 = { label: 'Avg Monthly Run-rate', val: `AED ${runRate.toLocaleString()}` };
      
      const totalInvoiced = invoices.filter(i => filteredStudents.some(s => s.id === i.student_id));
      const totalInvoiceAmt = totalInvoiced.reduce((sum, i) => sum + Number(i.amount), 0);
      const totalClassesTaught = attendance.filter(a => a.status === 'present' && filteredStudents.some(s => s.id === a.student_id)).length;
      const avgRate = totalClassesTaught > 0 ? Math.round(totalInvoiceAmt / totalClassesTaught) : 125;
      kpi3 = { label: 'Avg Rate per Class', val: `AED ${avgRate}` };
    } else if (reportId.includes('unbilled') || reportId.includes('leak') || reportId.includes('reconciliation')) {
      const totalUnbilled = filteredStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
      const classesCount = filteredStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);
      kpi1 = { label: 'Unbilled Value Ledger', val: `AED ${totalUnbilled.toLocaleString()}` };
      kpi2 = { label: 'Unbilled Classes', val: `${classesCount} classes` };
      
      const totalInvoiceAmt = invoices.filter(i => filteredStudents.some(s => s.id === i.student_id)).reduce((sum, i) => sum + Number(i.amount), 0);
      const leakRate = totalInvoiceAmt > 0 ? Math.round((totalUnbilled / (totalInvoiceAmt + totalUnbilled)) * 100) : 0;
      kpi3 = { label: 'Revenue Leak Rate', val: `${leakRate}%` };
    } else if (reportId.includes('attendance') || reportId.includes('engagement') || reportId.includes('slow')) {
      kpi1 = { label: 'Students in Scope', val: filteredStudents.length.toString() };
      
      const scopeAtts = attendance.filter(a => filteredStudents.some(s => s.id === a.student_id));
      const presentCount = scopeAtts.filter(a => a.status === 'present').length;
      const totalLogs = scopeAtts.length;
      const attRate = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 100;
      kpi2 = { label: 'Average Attendance Rate', val: `${attRate}%` };
      
      const slippingCount = filteredStudents.filter(s => s.engagement_status === 'Slipping').length;
      kpi3 = { label: 'Slipping Students', val: `${slippingCount}` };
    } else {
      const totalPaidSum = filteredStudents.reduce((sum, s) => sum + s.total_paid, 0);
      const avgLtvVal = filteredStudents.length > 0 ? Math.round(totalPaidSum / filteredStudents.length) : 0;
      kpi1 = { label: 'Active Students', val: filteredStudents.length.toString() };
      kpi2 = { label: 'Average LTV', val: `AED ${avgLtvVal.toLocaleString()}` };
      
      const totalUnbilled = filteredStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
      kpi3 = { label: 'Unbilled Value', val: `AED ${totalUnbilled.toLocaleString()}` };
    }

    const labels = Object.keys(groups);
    const datasetData = Object.values(groups);

    return {
      kpi1,
      kpi2,
      kpi3,
      labels,
      datasetData,
      totalStudentsVal: filteredStudents.length,
      totalClassesVal: 0,
      totalRunRateVal: 0,
      totalPackagesVal: 0,
      annualisedVal: 0,
      tableRows: [],
      sumRunRate: 0,
      sumClasses: 0,
      sumStudents: 0,
      rawList: filteredStudents.map(s => {
        const coach = coaches.find(c => c.id === s.coach_id);
        const stPkgs = packages.filter(p => p.student_id === s.id);
        const totalRem = stPkgs.reduce((acc, p) => acc + p.classes_remaining, 0);
        
        return {
          id: s.id,
          name: s.name,
          centre: centres.find(c => c.id === s.centre_id)?.name || 'Bay Avenue',
          level: s.level,
          coach: coach ? coach.name : 'Unassigned',
          segment: s.segment || 'HEALTHY',
          classesRemaining: totalRem,
          totalPaid: s.total_paid || 0
        };
      })
    };
  }, [filteredStudents, reportId, diceBy, coaches, packages, invoices, attendance, filterCentre, filterCoach, filterSegment, filterEngagement, filterLevel, students, centres]);

  // Draw Chart
  const drawChart = () => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    if (chartInstance2.current) {
      chartInstance2.current.destroy();
      chartInstance2.current = null;
    }

    if (chartType === 'table') return;

    if (reportId === 'board-investor-pack') {
      chartInstance.current = new Chart(chartRef.current, {
        type: 'bar',
        data: {
          labels: reportData.labels,
          datasets: [
            {
              label: 'Bay Avenue',
              data: reportData.bayDataset || [],
              backgroundColor: '#286957',
              borderWidth: 0
            },
            {
              label: 'JLT',
              data: reportData.jltDataset || [],
              backgroundColor: '#a3c2b8',
              borderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top' }
          },
          scales: {
            y: { 
              stacked: true,
              beginAtZero: true, 
              title: { display: true, text: 'Student-classes / month', font: { size: 10 } }
            },
            x: { 
              stacked: true,
              grid: { display: false } 
            }
          }
        }
      });
      return;
    }

    if (reportId === 'new-centre-model') {
      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels: reportData.labels,
          datasets: [
            {
              label: 'JLT actual',
              data: reportData.jltActuals || [],
              borderColor: '#a3c2b8',
              backgroundColor: '#a3c2b8',
              borderWidth: 2,
              tension: 0.3,
              fill: false,
              pointStyle: 'circle',
              pointRadius: 4
            },
            {
              label: 'Town Square projection',
              data: reportData.townSquareTargets || [],
              borderColor: '#C4A249',
              backgroundColor: '#C4A249',
              borderWidth: 2,
              borderDash: [5, 5],
              tension: 0.3,
              fill: false,
              pointStyle: 'circle',
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top' }
          },
          scales: {
            y: { 
              beginAtZero: true, 
              title: { display: true, text: 'Student-classes / month', font: { size: 10 } }
            },
            x: { grid: { display: false } }
          }
        }
      });
      return;
    }

    if (reportId === 'coach-utilisation' || reportId === 'load-capacity') {
      const coachRows = reportData.coachRows || [];
      const labels = coachRows.map((r: any) => r.coachName.split(' ')[0]);
      const deliveredData = coachRows.map((r: any) => r.classes30D);
      const spareData = coachRows.map((r: any) => r.spareCapacity);

      chartInstance.current = new Chart(chartRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Delivered',
              data: deliveredData,
              backgroundColor: '#286957',
              borderWidth: 0,
              borderRadius: 0
            },
            {
              label: 'Spare capacity',
              data: spareData,
              backgroundColor: '#E4DFD2',
              borderWidth: 0,
              borderRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top', align: 'center' },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw} student-classes`
              }
            }
          },
          scales: {
            y: {
              stacked: true,
              beginAtZero: true,
              max: 400,
              grid: { color: '#E4DFD2' }
            },
            x: {
              stacked: true,
              grid: { display: false }
            }
          }
        }
      });
      return;
    }

    if (reportId === 'coach-retention') {
      const coachRows = reportData.coachRows || [];
      const labels = coachRows.map((r: any) => r.coachName.split(' ')[0]);
      const data = coachRows.map((r: any) => r.engagementPct);
      const colors = ['#286957', '#C4A249', '#4BD1D9', '#95DAC1', '#72A99A', '#B8863B', '#A23B3B'];

      chartInstance.current = new Chart(chartRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Engagement %',
            data,
            backgroundColor: colors,
            borderWidth: 0,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.raw}% engagement`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 70,
              ticks: { stepSize: 10, callback: (v) => `${v}` },
              grid: { color: '#E4DFD2' }
            },
            x: { grid: { display: false } }
          }
        }
      });
      return;
    }

    if (reportId === 'revenue-contribution') {
      const coachRows = reportData.coachRows || [];
      const labels = coachRows.map((r: any) => r.coachName.split(' ')[0]);
      const data = coachRows.map((r: any) => r.revenuePerMonth);
      const colors = ['#286957', '#C4A249', '#4BD1D9', '#95DAC1', '#72A99A', '#B8863B', '#A23B3B'];

      chartInstance.current = new Chart(chartRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Revenue / month',
            data,
            backgroundColor: colors,
            borderWidth: 0,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` AED ${(ctx.raw as number).toLocaleString()}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (v) => `${Number(v) / 1000}K` },
              grid: { color: '#E4DFD2' }
            },
            x: { grid: { display: false } }
          }
        }
      });
      return;
    }

    if (reportId === 'growth-trajectory' || reportId === 'centre-perf') {

      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels: reportData.labels,
          datasets: [
            {
              label: 'Bay Avenue',
              data: reportData.bayDataset || [],
              borderColor: '#286957',
              backgroundColor: 'rgba(40, 105, 87, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true
            },
            {
              label: 'JLT',
              data: reportData.jltDataset || [],
              borderColor: '#a3c2b8',
              backgroundColor: 'rgba(163, 194, 184, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top' }
          },
          scales: {
            y: { 
              beginAtZero: true, 
              title: { display: true, text: 'Student-classes / month', font: { size: 10 } }
            },
            x: { grid: { display: false } }
          }
        }
      });
      return;
    }

    if (reportId === 'cohort-retention') {
      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels: reportData.labels,
          datasets: [{
            label: 'Retention Rate',
            data: reportData.datasetData,
            borderColor: '#286957',
            backgroundColor: '#286957',
            borderWidth: 2,
            tension: 0.3,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { min: 0, max: 100, ticks: { callback: (val) => `${val}%` } },
            x: { grid: { display: false } }
          }
        }
      });

      if (chartRef2.current) {
        chartInstance2.current = new Chart(chartRef2.current, {
          type: 'line',
          data: {
            labels: reportData.labels,
            datasets: [
              {
                label: 'Bay Avenue',
                data: reportData.bayCurve || [],
                borderColor: '#286957',
                backgroundColor: '#286957',
                borderWidth: 2,
                tension: 0.3,
                fill: false
              },
              {
                label: 'JLT',
                data: reportData.jltCurve || [],
                borderColor: '#a3c2b8',
                backgroundColor: '#a3c2b8',
                borderWidth: 2,
                tension: 0.3,
                fill: false
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true, position: 'top' }
            },
            scales: {
              y: { min: 0, max: 100, ticks: { callback: (val) => `${val}%` } },
              x: { grid: { display: false } }
            }
          }
        });
      }
      return;
    }

    chartInstance.current = new Chart(chartRef.current, {
      type: chartType === 'donut' ? 'doughnut' : chartType,
      data: {
        labels: reportData.labels,
        datasets: [{
          label: reportInfo.title,
          data: reportData.datasetData,
          backgroundColor: ['#286957', '#C4A249', '#A23B3B', '#54D6DD', '#6B7A74'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: chartType === 'donut',
            position: 'bottom'
          }
        },
        scales: chartType !== 'donut' ? {
          y: { beginAtZero: true, grid: { color: '#E4DFD2' } },
          x: { grid: { display: false } }
        } : undefined
      }
    });
  };

  useEffect(() => {
    if (!loading) {
      drawChart();
    }
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      if (chartInstance2.current) {
        chartInstance2.current.destroy();
        chartInstance2.current = null;
      }
    };
  }, [loading, reportData, chartType]);

  if (loading) {
    return <div className="p-10 text-center text-muted-custom">Loading Report Data...</div>;
  }

  const handleReset = () => {
    setFilterCentre('All');
    setFilterCoach('All');
    setFilterSegment('All');
    setFilterEngagement('All');
    setFilterLevel('All');
    setDiceBy('By Centre');
    setChartType('bar');
  };

  const handleExcelDownload = () => {
    const tableEl = document.querySelector('table');
    if (tableEl) {
      exportTableToCSV('table', `${reportId}_report.csv`);
    } else {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Category,Value\n";
      reportData.labels.forEach((lbl, i) => {
        csvContent += `"${lbl}",${reportData.datasetData[i]}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${reportId}_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 text-ink">
      
      {/* Back navigation */}
      <button 
        onClick={() => router.push('/reports-centre')}
        className="text-xs font-semibold text-forest hover:text-emerald-700 flex items-center gap-1.5 transition-colors no-print"
      >
        ← Back to Reports Centre
      </button>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">
            {reportInfo.category.toUpperCase()} REPORT
          </div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">{reportInfo.title}</h1>
        </div>

        <div className="flex items-center gap-2 no-print">
          <select 
            value={filterCentre} 
            onChange={e => setFilterCentre(e.target.value)} 
            className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none"
          >
            <option value="All">All centres</option>
            <option value="Bay Avenue">Bay Avenue</option>
            <option value="JLT">JLT</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-custom">
        {reportInfo.title} — <span className="font-bold text-ink">All data</span>. Slice by any dimension, dice by any grouping, then export.
      </p>

      {/* Slice & Dice Toolbar */}
      <div className="bg-surface border border-line rounded-[14px] p-2.5 shadow-sm flex flex-nowrap items-center gap-3 overflow-x-auto no-print text-xs w-full scrollbar-none">
        
        {/* Slices */}
        <div className="flex flex-nowrap gap-2.5 items-center shrink-0">
          <span className="font-bold text-[#C4A249] uppercase tracking-wider text-[10px] shrink-0">SLICE</span>
          
          <select value={filterCentre} onChange={e => setFilterCentre(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs shrink-0">
            <option value="All">All centres</option>
            <option value="Bay Avenue">Bay Avenue</option>
            <option value="JLT">JLT</option>
          </select>

          <select value={filterCoach} onChange={e => setFilterCoach(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs w-36 shrink-0">
            <option value="All">All coaches</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={filterSegment} onChange={e => setFilterSegment(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs shrink-0">
            <option value="All">All segments</option>
            <option value="HOT">HOT</option>
            <option value="WARM">WARM</option>
            <option value="COLD">COLD</option>
            <option value="HEALTHY">HEALTHY</option>
          </select>

          <select value={filterEngagement} onChange={e => setFilterEngagement(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs shrink-0">
            <option value="All">All engagement</option>
            <option value="Engaged">Engaged</option>
            <option value="Slipping">Slipping</option>
            <option value="Dormant">Dormant</option>
          </select>

          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs shrink-0">
            <option value="All">All levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        {/* Divider line */}
        <div className="h-6 w-px bg-line shrink-0" />

        {/* Dice & Actions Group */}
        <div className="flex flex-nowrap gap-2.5 items-center shrink-0 ml-auto">
          <span className="font-bold text-[#C4A249] uppercase tracking-wider text-[10px] shrink-0">DICE BY</span>
          
          <select value={diceBy} onChange={e => setDiceBy(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs shrink-0">
            <option value="By Centre">By Centre</option>
            <option value="By Coach">By Coach</option>
            <option value="By Level">By Level</option>
            <option value="By Segment">By Segment</option>
          </select>

          <div className="flex border border-line rounded-lg overflow-hidden bg-white shrink-0">
            {(['bar', 'line', 'donut', 'table'] as const).map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1 font-semibold text-[10px] uppercase border-r border-line last:border-r-0 shrink-0 ${
                  chartType === type ? 'bg-forest text-white' : 'text-muted-custom hover:bg-canvas'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <button 
            onClick={handleReset} 
            className="text-xs font-semibold text-muted-custom hover:text-ink px-2.5 py-1.5 transition-colors shrink-0"
          >
            Reset
          </button>
          
          <button 
            onClick={handleExcelDownload}
            className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas shrink-0"
          >
            ↓ Excel
          </button>
          <button 
            onClick={exportToPDF}
            className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas shrink-0"
          >
            ⎙ PDF
          </button>
        </div>

      </div>

      {/* Rules Used Banner */}
      <div className="p-3.5 bg-white border border-line rounded-xl text-[11px] text-muted-custom space-y-1.5 shadow-sm no-print">
        <div className="flex flex-wrap items-center gap-1.5">
          <b className="text-ink font-semibold mr-1">Rules used:</b>
          <span className="font-extrabold text-red-800 bg-red-100 border border-red-300 px-2 py-0.5 rounded text-[10px] uppercase">HOT</span>
          <span>= Overdue &gt; 0, or 0 active package, or &le; 2 classes left.</span>
          <span className="mx-1 text-line">|</span>
          <span className="font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[10px] uppercase">WARM</span>
          <span>= 3-6 classes left, or no class in 30-60d.</span>
          <span className="mx-1 text-line">|</span>
          <span className="font-extrabold text-blue-800 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded text-[10px] uppercase">COLD</span>
          <span>= no class in 60d+.</span>
          <span className="mx-1 text-line">|</span>
          <span className="font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded text-[10px] uppercase">HEALTHY</span>
          <span>= paid up, 7+ classes left, attending.</span>
        </div>
        <div className="text-[10px] text-muted-custom">
          <b className="text-ink font-semibold">Overdue Value</b> = overdue classes &times; that student&apos;s most recent price-per-class (median AED 100 used where no priced package exists).
        </div>
      </div>

      {/* Custom Alert banner for revenue-summary / unbilled-leak / data-reconciliation / collection-list / membership-tiers */}
      {reportId === 'revenue-summary' && (
        <div className="p-4 rounded-[12px] bg-emerald-50/20 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/90">
          <span className="font-bold text-forest">AED {reportData.sumRunRate.toLocaleString()} per month</span> from <span className="font-bold">{reportData.totalClassesVal} classes</span> delivered across <span className="font-bold">{reportData.totalStudentsVal} students</span>. Annualised: <span className="font-bold">AED {reportData.annualisedVal.toLocaleString()}</span>. Revenue is computed from classes actually taught × each student's own rate — not from enrolments on the book.
        </div>
      )}

      {reportId === 'unbilled-leak' && (
        <div className="p-4 rounded-[12px] bg-amber-50/20 border border-amber-100 border-l-4 border-l-[#C4A249] text-xs text-ink/90 space-y-2">
          <div>
            <span className="font-bold text-[#b49040]">AED {reportData.sumRunRate.toLocaleString()} of classes delivered but never billed</span> — <span className="font-bold">{reportData.sumClasses} classes</span> across <span className="font-bold">{reportData.sumStudents} students</span>, <span className="font-bold">computed from the package ledger</span> (classes paid vs classes used). Of this, <span className="font-bold">AED {reportData.annualisedVal.toLocaleString()}</span> is owed by students still actively attending — the most collectable receivable there is.
          </div>
          <div className="text-amber-800/80 font-medium">
            Do not use the legacy figure of AED {reportData.legacyVal?.toLocaleString() || '2,36,205'}. It comes from the summary sheet, which the package ledger contradicts for {reportData.contradictedRowsCount || 109} students. See the Data Reconciliation report.
          </div>
        </div>
      )}

      {reportId === 'data-reconciliation' && (
        <div className="p-4 rounded-[12px] bg-red-50/20 border border-red-100 border-l-4 border-l-hot-custom text-xs text-ink/90 space-y-2 animate-pulse">
          <div className="font-bold text-hot-custom text-sm flex items-center gap-1.5">
            <span>⚠</span> Two sources in your legacy data disagree — by AED {(reportData.legacyVal - reportData.sumRunRate).toLocaleString()}
          </div>
          <div>
            The <span className="font-bold">summary sheet</span> reports AED {reportData.legacyVal.toLocaleString()} unbilled ({reportData.legacyClasses.toLocaleString()} classes). The <span className="font-bold">package ledger</span> — classes paid vs classes used, the auditable source — reports <span className="font-bold">AED {reportData.sumRunRate.toLocaleString()}</span> ({reportData.sumClasses.toLocaleString()} classes). <span className="font-bold">{reportData.contradictedRows.length} students</span> are marked as owing money on the summary sheet while their own package ledger shows them <span className="font-bold text-forest">in credit</span>. Do not take the larger number into a fundraise.
          </div>
        </div>
      )}

      {reportId === 'collection-list' && (
        <div className="p-4 rounded-[12px] bg-emerald-50/20 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/95">
          Ranked by value owed. Work top-down. Students still <span className="font-bold text-forest uppercase">Engaged</span> are in the building every week — invoice them first.
        </div>
      )}

      {reportId === 'membership-economics' && (
        <div className="p-4 rounded-[12px] bg-red-50/20 border border-red-100 border-l-4 border-l-hot-custom text-xs text-ink/90 space-y-2">
          <div className="font-semibold text-hot-custom text-sm flex items-center gap-1.5 font-display">
            👑 Your average active student pays AED {reportData.kpi1.val.replace('AED ', '')}/month. Mini — your cheapest tier — is AED 750.
          </div>
          <div>
            <span className="font-bold">{reportData.belowMiniCount} of {reportData.totalStudentsVal} active students ({reportData.belowMiniPct}%)</span> currently spend <span className="font-bold">less than the Mini price</span>. Moving the base onto the tier card is not a repackaging exercise — for most families it is a <span className="font-bold">56% price rise</span>. The revenue upside is real (AED {Math.round(reportData.annualisedVal / 1000)}K/month), but so is the churn risk, and at 50% twelve-month retention this base is not price-insensitive. Migrate in stages, starting with the students who are already above the line.
          </div>
        </div>
      )}

      {reportId === 'lifetime-value' && (
        <div className="p-4 rounded-[12px] bg-emerald-50/20 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/90">
          <span className="font-bold text-forest">AED {reportData.sumRunRate.toLocaleString()}</span> collected from <span className="font-bold">{reportData.totalStudentsVal} students</span> since inception — an average of <span className="font-bold">AED {reportData.annualisedVal.toLocaleString()}</span> each, with zero external capital raised.
        </div>
      )}

      {reportId === 'rate-card' && (
        <div className="p-4 rounded-[12px] bg-[#FDFBF7] border border-[#F4E3C1] border-l-4 border-l-[#C4A249] text-xs text-ink/90">
          Rates range from <span className="font-bold">AED {reportData.minRateVal} to AED {reportData.maxRateVal} per class</span> (median <span className="font-bold">AED {reportData.annualisedVal}</span>). This spread is legacy, not strategy — the same class is being sold at very different prices. Standardising the rate card is a direct margin lever.
        </div>
      )}

      {reportId === 'attendance-summary' && (
        <div className="p-4 rounded-[12px] bg-emerald-50/20 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/90">
          <span className="font-bold text-forest">{reportData.sumRunRate.toLocaleString()} student-classes in the last 30 days</span>, <span className="font-bold text-forest">{reportData.sumClasses.toLocaleString()} in 90</span>, across <span className="font-bold">{reportData.sumStudents} students</span>. One group class of 8 children counts as 8 student-classes.
        </div>
      )}

      {reportId === 'engagement-report' && (
        <div className="p-4 rounded-[12px] bg-[#FDFBF7] border border-[#F4E3C1] border-l-4 border-l-[#C4A249] text-xs text-ink/90">
          Only <span className="font-bold">{reportData.annualisedVal} of {reportData.totalStudentsVal} ({reportData.leakRateVal}%)</span> attended in the last 30 days. The rest are on the book but not in the building — any headline student count or ARR built on the full {reportData.totalStudentsVal} overstates the business.
        </div>
      )}

      {reportId === 'cohort-retention' && (
        <div className="p-4 rounded-[12px] bg-[#FDFBF7] border border-[#F4E3C1] border-l-4 border-l-[#C4A249] text-xs text-ink/90">
          Retention halves inside the first year. Of students who joined <span className="font-bold">3 months ago, {reportData.pct0}% are still attending</span>. By <span className="font-bold">12 months that falls to {reportData.pct12}%</span>, and it crosses the 50% line at around <span className="font-bold">month 12</span>. This is the single biggest constraint on the business: you are not short of new students — you are short of students who stay.
        </div>
      )}

      {reportId === 'slow-risk' && (
        <div className="p-4 rounded-[12px] bg-[#FDFBF7] border border-[#F4E3C1] border-l-4 border-l-[#C4A249] text-xs text-ink/90">
          <span className="font-bold">{reportData.atRiskCount} students</span> are slipping or dormant, representing <span className="font-bold">AED {reportData.annualisedVal.toLocaleString()}</span> of lifetime value. Ranked by spend — these are paying families quietly disengaging, and the top of this list is where a coach's phone call pays for itself.
        </div>
      )}

      {reportId === 'package-expiry' && (
        <div className="p-4 rounded-[12px] bg-emerald-50/20 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/90">
          Every <span className="font-bold">CURRENT package with 3 or fewer classes left</span>. Renew before they hit zero — because when they hit zero and keep attending, they land on the <span className="font-bold uppercase text-hot-custom">Unpaid Attendance</span> report instead, and the class is given away.
        </div>
      )}

      {reportId === 'unpaid-attendance' && (
        <div className="p-4 rounded-[12px] bg-[#FDFBF7] border border-[#F4E3C1] border-l-4 border-l-[#C4A249] text-xs text-ink/90">
          Students <span className="font-bold">still attending with no paid package</span>. Every class here is revenue already given away. This list must be worked to zero, and the platform's zero-balance rule stops it ever refilling.
        </div>
      )}

      {(reportId === 'coach-utilisation' || reportId === 'load-capacity' || reportId === 'coach-retention' || reportId === 'revenue-contribution') && (
        <div className="p-4 rounded-[12px] bg-red-50/30 border border-red-100 border-l-4 border-l-hot-custom text-xs text-ink/90 space-y-1.5">
          <div className="font-bold text-hot-custom flex items-center gap-1.5 text-sm">
            <span>⚑</span> Structure ready — awaiting clean coach data
          </div>
          <div>
            The coach field in the legacy student records is <span className="font-bold">known to be unreliable</span>, so the figures below are shown to demonstrate <span className="font-bold">what this report will compute</span>, not to be acted on. Once the platform assigns coaches properly — every coach is a user, every class owned by a coach, no session without one — this report becomes live with no code change. <span className="font-bold">Do not make staffing decisions on this screen today.</span>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {(currentUser?.role !== 'front_desk' && currentUser?.role !== 'coach') && (
        reportId === 'membership-economics' || reportId === 'cohort-retention' ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi1.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi1.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{reportId === 'cohort-retention' ? 'still attending' : 'what they pay today'}</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi2.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi2.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{reportId === 'cohort-retention' ? 'still attending' : `${reportData.totalStudentsVal} paying students`}</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi3.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi3.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{reportId === 'cohort-retention' ? 'still attending' : 'if all moved to tier card'}</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi4.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi4.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{reportId === 'cohort-retention' ? 'the loyal core' : `+${Math.round((reportData.annualisedVal / reportData.sumRunRate) * 100) || 62}%`}</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi5.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi5.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{reportId === 'cohort-retention' ? 'before 50% have gone' : `${reportData.belowMiniPct}% of active base`}</div>
            </div>
          </div>
        ) : reportId === 'collection-list' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi1.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi1.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{filterCentre === 'All' ? 'All data' : filterCentre}</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi2.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi2.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{filterCentre === 'All' ? 'All data' : filterCentre}</div>
            </div>
          </div>
        ) : reportId === 'slow-risk' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi1.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi1.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{filterCentre === 'All' ? 'All data' : filterCentre}</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi2.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi2.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{filterCentre === 'All' ? 'All data' : filterCentre}</div>
            </div>
          </div>
        ) : reportId === 'package-expiry' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi1.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi1.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">≤3 classes left</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi2.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi2.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">≤3 classes left</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi3.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi3.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">work this list weekly</div>
            </div>
          </div>
        ) : reportId === 'unpaid-attendance' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-[#b49040] uppercase tracking-wider">{reportData.kpi1.label}</div>
              <h2 className="text-2xl font-bold font-display text-hot-custom mt-1.5">{reportData.kpi1.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">no active paid package</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi2.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi2.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">never billed</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi3.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi3.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">invoice today</div>
            </div>
          </div>
        ) : (reportId === 'board-investor-pack' || reportId === 'new-centre-model' || reportId === 'coach-utilisation' || reportId === 'load-capacity' || reportId === 'coach-retention' || reportId === 'revenue-contribution') ? (
          (reportId === 'coach-utilisation' || reportId === 'load-capacity' || reportId === 'coach-retention' || reportId === 'revenue-contribution') ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
                <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi1?.label || 'COACHES'}</div>
                <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi1?.val || '0'}</h2>
                <div className="text-[9px] text-muted-custom mt-1">{reportData.kpi1?.sub || ''}</div>
              </div>
              <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
                <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi2?.label || 'STUDENT-CLASSES / 30D'}</div>
                <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi2?.val || '0'}</h2>
                <div className="text-[9px] text-muted-custom mt-1">{reportData.kpi2?.sub || ''}</div>
              </div>
              <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
                <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi3?.label || 'AVG UTILISATION'}</div>
                <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi3?.val || '0%'}</h2>
                <div className="text-[9px] text-muted-custom mt-1">{reportData.kpi3?.sub || ''}</div>
              </div>
              <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
                <div className="text-[9px] font-bold text-[#C4A249] uppercase tracking-wider">{reportData.kpi4?.label || 'ENGAGEMENT BAND'}</div>
                <h2 className="text-2xl font-bold font-display text-[#C4A249] mt-1.5">{reportData.kpi4?.val || '0–0%'}</h2>
                <div className="text-[9px] text-muted-custom mt-1">{reportData.kpi4?.sub || ''}</div>
              </div>
            </div>
          ) : null
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi1.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi1.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{filterCentre === 'All' ? 'All data' : filterCentre}</div>
            </div>

            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi2.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi2.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{filterCentre === 'All' ? 'All data' : filterCentre}</div>
            </div>

            <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi3.label}</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi3.val}</h2>
              <div className="text-[9px] text-muted-custom mt-1">{filterCentre === 'All' ? 'All data' : filterCentre}</div>
            </div>

          </div>
        )
      )}

      {/* Custom layout for all reports */}
      {(reportId === 'revenue-summary' || reportId === 'unbilled-leak' || reportId === 'data-reconciliation' || reportId === 'collection-list' || reportId === 'membership-economics' || reportId === 'lifetime-value' || reportId === 'rate-card' || reportId === 'attendance-summary' || reportId === 'engagement-report' || reportId === 'cohort-retention' || reportId === 'slow-risk' || reportId === 'package-expiry' || reportId === 'unpaid-attendance' || reportId === 'growth-trajectory' || reportId === 'centre-perf' || reportId === 'board-investor-pack' || reportId === 'new-centre-model' || reportId === 'coach-utilisation' || reportId === 'load-capacity' || reportId === 'coach-retention' || reportId === 'revenue-contribution') ? (
        (reportId === 'coach-utilisation' || reportId === 'load-capacity' || reportId === 'coach-retention' || reportId === 'revenue-contribution') ? (
          <div className="space-y-6">
            {/* Utilisation / Retention / Revenue % chart */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink font-display flex items-center gap-1.5">
                    <span className="text-[#C4A249]">♟</span> {reportId === 'coach-retention' ? 'Engagement % by coach' : reportId === 'revenue-contribution' ? 'Revenue / month by coach' : reportId === 'load-capacity' ? 'Student-classes 30d by coach' : 'Utilisation % by coach'}
                  </h3>
                  <p className="text-[10px] text-muted-custom mt-0.5">All data</p>
                </div>
              </div>
              <div className="text-[10px] text-[#286957] bg-emerald-50/40 border border-emerald-100 border-l-4 border-l-forest rounded-lg px-3 py-2 leading-relaxed">
                {reportId === 'coach-retention' ? (
                  <>This report will show retention per coach. <b className="text-forest">It cannot be read yet</b> — the coach field in the legacy student records is known to be wrong, so any per-coach conclusion drawn from it today would be an artefact of bad data, not a fact about a coach.</>
                ) : reportId === 'revenue-contribution' ? (
                  <>Revenue per coach = student-classes delivered (30d) × centre median rate. Structure only until coach assignment is trustworthy.</>
                ) : (
                  <>Delivered vs spare capacity per coach — the structure the platform will populate once coach assignment is captured at source.</>
                )}
              </div>
              <div className="h-64 relative">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            {/* Coach Detail Table */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <h3 className="text-sm font-bold text-forest flex items-center gap-1.5">✦ Coach detail</h3>
                  <p className="text-[10px] text-muted-custom mt-0.5">Load, output, capacity, retention and unbilled exposure.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">COACH</th>
                      <th className="py-2.5 px-2">CENTRE</th>
                      <th className="py-2.5 px-2 text-right">STUDENTS</th>
                      <th className="py-2.5 px-2 text-right">ENGAGED</th>
                      <th className="py-2.5 px-2 text-right">ENGAGEMENT %</th>
                      <th className="py-2.5 px-2 text-right">STU-CLS 30D</th>
                      <th className="py-2.5 px-2 text-right">STU-CLS 90D</th>
                      <th className="py-2.5 px-2 text-right">UTILISATION</th>
                      <th className="py-2.5 px-2 text-right">SPARE CAPACITY</th>
                      <th className="py-2.5 px-2 text-right">REVENUE / MO</th>
                      <th className="py-2.5 px-2 text-right">UNBILLED UNDER COACH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(reportData.coachRows || []).map((row: any, idx: number) => {
                      const utilColor = row.utilisationPct >= 60 ? '#286957' : row.utilisationPct >= 30 ? '#C4A249' : '#A23B3B';
                      const engColor = row.engagementPct >= 40 ? '#286957' : row.engagementPct >= 25 ? '#C4A249' : '#A23B3B';
                      return (
                        <tr key={idx} className="hover:bg-canvas/20">
                          <td className="py-3 px-2 font-bold text-ink">{row.coachName}</td>
                          <td className="py-3 px-2 text-forest font-medium">{row.centreName}</td>
                          <td className="py-3 px-2 text-right">{row.studentCount}</td>
                          <td className="py-3 px-2 text-right">{row.engagedCount}</td>
                          <td className="py-3 px-2 text-right font-bold" style={{ color: engColor }}>{row.engagementPct}%</td>
                          <td className="py-3 px-2 text-right font-mono text-forest">{row.classes30D}</td>
                          <td className="py-3 px-2 text-right font-mono text-muted-custom">{row.classes90D}</td>
                          <td className="py-3 px-2 text-right font-bold" style={{ color: utilColor }}>{row.utilisationPct}%</td>
                          <td className="py-3 px-2 text-right text-muted-custom">{row.spareCapacity}</td>
                          <td className="py-3 px-2 text-right font-semibold text-ink">AED {row.revenuePerMonth.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right font-semibold text-hot-custom">AED {row.unbilledUnderCoach.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    {reportData.totals && (
                      <tr className="bg-[#F8F6F0] font-bold text-ink border-t-2 border-line">
                        <td className="py-3 px-2 font-bold">Total</td>
                        <td className="py-3 px-2 text-muted-custom">—</td>
                        <td className="py-3 px-2 text-right">{reportData.totals.totalStudents}</td>
                        <td className="py-3 px-2 text-right">{reportData.totals.totalEngaged}</td>
                        <td className="py-3 px-2 text-right">{reportData.totals.totalEngagementPct}%</td>
                        <td className="py-3 px-2 text-right font-mono text-forest">{reportData.totals.totalClasses30D}</td>
                        <td className="py-3 px-2 text-right font-mono text-muted-custom">{reportData.totals.totalClasses90D}</td>
                        <td className="py-3 px-2 text-right">{reportData.totals.totalUtilPct}%</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{reportData.totals.totalSpare}</td>
                        <td className="py-3 px-2 text-right">AED {reportData.totals.totalRevenue.toLocaleString()}</td>
                        <td className="py-3 px-2 text-right text-hot-custom">AED {reportData.totals.totalUnbilled.toLocaleString()}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footnote */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>✦ Utilisation in <span className="font-semibold">student-classes (attendances)</span>, not sessions. Capacity configurable per coach in Settings.</span>
            </div>
          </div>
        ) : reportId === 'data-reconciliation' ? (
          <div className="space-y-6">
            {/* Card 1: The three numbers */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span className="text-[#C4A249]">📋</span> The three numbers
                </h3>
                <p className="text-[10px] text-muted-custom">Same question, three methods. Two agree; one does not.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">METHOD</th>
                      <th className="py-2.5 px-2">HOW IT IS COMPUTED</th>
                      <th className="py-2.5 px-2 text-right">CLASSES</th>
                      <th className="py-2.5 px-2 text-right">VALUE</th>
                      <th className="py-2.5 px-2 text-center">VERDICT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-bold text-ink">Package ledger (netted)</td>
                      <td className="py-3 px-2 text-muted-custom">Per student: Σ classes paid - Σ classes used. Owed only where negative.</td>
                      <td className="py-3 px-2 text-right text-muted-custom">{reportData.sumClasses}</td>
                      <td className="py-3 px-2 text-right font-semibold text-ink">AED {reportData.sumRunRate.toLocaleString()}</td>
                      <td className="py-3 px-2 text-center">
                        <span className="bg-emerald-50 text-forest border border-emerald-200 text-[8px] font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase">
                          CONSERVATIVE FLOOR
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-bold text-ink">Packages marked UNBILLED</td>
                      <td className="py-3 px-2 text-muted-custom">All classes taken on packages with no payment, incl. departed students. Does not net a later top-up.</td>
                      <td className="py-3 px-2 text-right text-muted-custom">{reportData.upperBoundClasses}</td>
                      <td className="py-3 px-2 text-right font-semibold text-ink">AED {reportData.upperBoundVal.toLocaleString()}</td>
                      <td className="py-3 px-2 text-center">
                        <span className="bg-amber-50 text-[#C4A249] border border-amber-200 text-[8px] font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase">
                          UPPER BOUND
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-bold text-ink">Summary sheet Overdue_Value</td>
                      <td className="py-3 px-2 text-muted-custom">Legacy pre-computed column. Source unknown.</td>
                      <td className="py-3 px-2 text-right text-muted-custom">{reportData.legacyClasses}</td>
                      <td className="py-3 px-2 text-right font-semibold text-ink">AED {reportData.legacyVal.toLocaleString()}</td>
                      <td className="py-3 px-2 text-center">
                        <span className="bg-red-50 text-hot-custom border border-red-200 text-[8px] font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase">
                          CONTRADICTED
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-4 rounded-[12px] bg-emerald-50/20 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/90">
                The defensible range is <span className="font-bold">AED {reportData.sumRunRate.toLocaleString()} – AED {reportData.upperBoundVal.toLocaleString()}</span>. The two ledger-based methods bracket the answer; they differ only on one judgment call — whether a student who later bought a fresh package has thereby settled the classes they took while unpaid. Take the conservative figure into a fundraise and the upper figure into your collections run. <span className="font-bold text-hot-custom">The AED 236K figure should not be used anywhere.</span>
              </div>
            </div>

            {/* Card 2: Recoverable vs likely lost */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span className="text-[#C4A249]">⚖️</span> Recoverable vs likely lost
                </h3>
                <p className="text-[10px] text-muted-custom">Not all unbilled money is equal. A student still in the building can be invoiced; one who has already left probably cannot.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">COHORT</th>
                      <th className="py-2.5 px-2">WHO THEY ARE</th>
                      <th className="py-2.5 px-2 text-right">UNBILLED PACKAGES</th>
                      <th className="py-2.5 px-2 text-right">CLASSES</th>
                      <th className="py-2.5 px-2 text-right">VALUE</th>
                      <th className="py-2.5 px-2 text-center">PROGNOSIS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-bold text-ink">Still on the roster</td>
                      <td className="py-3 px-2 text-muted-custom">Among the {reportData.totalStudentsVal} active students — attending or contactable</td>
                      <td className="py-3 px-2 text-right text-muted-custom">{reportData.activeOwingStudents}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">{reportData.sumClasses}</td>
                      <td className="py-3 px-2 text-right font-semibold text-ink">AED {reportData.sumRunRate.toLocaleString()}</td>
                      <td className="py-3 px-2 text-center">
                        <span className="bg-emerald-50 text-forest border border-emerald-200 text-[8px] font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase">
                          INVOICE NOW
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-bold text-ink">Already departed</td>
                      <td className="py-3 px-2 text-muted-custom">No longer on the active roster — left owing classes</td>
                      <td className="py-3 px-2 text-right text-muted-custom">{reportData.departedOwingStudents}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">{reportData.departedOwingClasses}</td>
                      <td className="py-3 px-2 text-right font-semibold text-ink">AED {reportData.departedOwingVal.toLocaleString()}</td>
                      <td className="py-3 px-2 text-center">
                        <span className="bg-red-50 text-hot-custom border border-red-200 text-[8px] font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase">
                          LIKELY WRITTEN OFF
                        </span>
                      </td>
                    </tr>
                    {/* Total Row */}
                    <tr className="bg-[#F8F6F0] font-bold text-ink">
                      <td className="py-3 px-2">Total unbilled packages</td>
                      <td className="py-3 px-2"></td>
                      <td className="py-3 px-2 text-right">{reportData.activeOwingStudents + reportData.departedOwingStudents}</td>
                      <td className="py-3 px-2 text-right">{reportData.sumClasses + reportData.departedOwingClasses}</td>
                      <td className="py-3 px-2 text-right">AED {(reportData.sumRunRate + reportData.departedOwingVal).toLocaleString()}</td>
                      <td className="py-3 px-2 text-center"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-4 rounded-[12px] bg-amber-50/20 border border-amber-100 border-l-4 border-l-[#C4A249] text-xs text-ink/90">
                <span className="font-bold">AED {reportData.departedOwingVal.toLocaleString()} has probably already walked out of the door.</span> {reportData.departedOwingStudents} unbilled packages belong to students no longer on the roster — they took {reportData.departedOwingClasses} classes, never paid, and left. You can attempt recovery, but plan on writing most of it off. <span className="font-bold text-emerald-800">The AED {reportData.sumRunRate.toLocaleString()} owed by students still on the roster is the number that matters</span> — those families are contactable, many are still attending, and an invoice recovers it. That is the collections target.
              </div>
            </div>

            {/* Card 3: The contradicted students */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <span className="text-[#C4A249]">⚠️</span> The contradicted students
                  </h3>
                  <p className="text-[10px] text-muted-custom">Summary sheet says they owe; their own package ledger says they are in credit. Worth AED {reportData.discrepancyVal.toLocaleString()} of the discrepancy.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">STUDENT</th>
                      <th className="py-2.5 px-2">CENTRE</th>
                      <th className="py-2.5 px-2">COACH</th>
                      <th className="py-2.5 px-2 text-right">SUMMARY SAYS OWED</th>
                      <th className="py-2.5 px-2 text-center">LEDGER: PAID - USED</th>
                      <th className="py-2.5 px-2 text-right">LEDGER SAYS OWED</th>
                      <th className="py-2.5 px-2 text-center">VERDICT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {reportData.contradictedRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-canvas/20">
                        <td className="py-3 px-2 font-bold text-ink">{row.name}</td>
                        <td className="py-3 px-2">{row.centreName}</td>
                        <td className="py-3 px-2">{row.coachName}</td>
                        <td className="py-3 px-2 text-right text-red-500 font-semibold">AED {row.summarySaysOwed.toLocaleString()}</td>
                        <td className="py-3 px-2 text-center text-forest font-semibold">{row.ledgerPaidUsed}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">AED {row.ledgerSaysOwed.toLocaleString()}</td>
                        <td className="py-3 px-2 text-center">
                          <span className="bg-emerald-50 text-forest border border-emerald-200 text-[8px] font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase">
                            IN CREDIT
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-[#F8F6F0] font-bold text-ink">
                      <td className="py-3 px-2" colSpan={3}>Total discrepancy — {reportData.contradictedRows.length} students</td>
                      <td className="py-3 px-2 text-right text-red-500">AED {reportData.discrepancyVal.toLocaleString()}</td>
                      <td className="py-3 px-2 text-center"></td>
                      <td className="py-3 px-2 text-right"></td>
                      <td className="py-3 px-2 text-center"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-muted-custom">Showing {Math.min(50, reportData.contradictedRows.length)} of {reportData.contradictedRows.length} — export for all.</p>

              <div className="p-4 rounded-[12px] bg-emerald-50/20 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/90">
                <span className="font-bold text-emerald-800">What the developer must do at migration.</span> Do not import <span className="font-mono bg-canvas/30 px-1 py-0.5 rounded text-emerald-900">Overdue_Classes</span> or <span className="font-mono bg-canvas/30 px-1 py-0.5 rounded text-emerald-900">Overdue_Value_AED</span>. Rebuild both from the package ledger — <span className="font-bold">balance = Σ classes_paid - Σ classes_used</span> — and let the platform maintain them going forward via the attendance trigger. This contradiction is exactly what a system with a single source of truth prevents from ever happening again.
              </div>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>Live data</span>
              <span>·</span>
              <span>Reconciled from your workbook: {reportData.totalStudentsVal} student rows against {reportData.totalPackagesVal} package rows.</span>
            </div>
          </div>
        ) : reportId === 'collection-list' ? (
          <div className="space-y-6">
            {/* Chart Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Owed (ledger) {diceBy.toLowerCase()}
                </h3>
                <p className="text-[10px] text-muted-custom">
                  {filterCentre === 'All' ? 'All data' : filterCentre} · {reportData.totalStudentsVal} students in scope
                </p>
              </div>
              
              {chartType === 'table' ? (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line text-left text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                        <th className="py-2 px-1">Dimension Group</th>
                        <th className="py-2 px-1 text-right">Value Metric</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.labels.map((lbl, i) => (
                        <tr key={i} className="border-b border-line hover:bg-canvas/20">
                          <td className="py-2.5 px-1 font-semibold">{lbl}</td>
                          <td className="py-2.5 px-1 text-right font-mono font-bold">
                            AED {reportData.datasetData[i].toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-72 relative">
                  <canvas ref={chartRef}></canvas>
                </div>
              )}
            </div>

            {/* Collection List table card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">Collection list — {reportData.sumStudents} students</h3>
                  <p className="text-[10px] text-muted-custom">Ranked by value owed.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">STUDENT</th>
                      <th className="py-2.5 px-2">ID</th>
                      <th className="py-2.5 px-2">CENTRE</th>
                      <th className="py-2.5 px-2">COACH</th>
                      <th className="py-2.5 px-2 text-right">CLASSES OWED</th>
                      <th className="py-2.5 px-2 text-right">RATE</th>
                      <th className="py-2.5 px-2 text-right">OWED</th>
                      <th className="py-2.5 px-2 text-center">STATE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {reportData.collectionRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-canvas/20">
                        <td className="py-3 px-2 font-bold text-ink">{row.name}</td>
                        <td className="py-3 px-2 font-mono text-[10px] text-muted-custom">{row.fideId}</td>
                        <td className="py-3 px-2 text-muted-custom">{row.centreName}</td>
                        <td className="py-3 px-2 text-muted-custom">{row.coachName}</td>
                        <td className="py-3 px-2 text-right text-muted-custom font-mono">{row.classesOwed}</td>
                        <td className="py-3 px-2 text-right text-muted-custom font-mono">AED {row.rate}</td>
                        <td className="py-3 px-2 text-right text-red-500 font-bold font-mono">AED {row.owed.toLocaleString()}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={`text-[8px] font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase border ${
                            row.state === 'ENGAGED' ? 'bg-emerald-50 text-forest border border-emerald-200' :
                            row.state === 'SLIPPING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            row.state === 'DORMANT' ? 'bg-red-50 text-hot-custom border border-red-200' :
                            'bg-canvas/50 text-muted-custom border border-line'
                          }`}>
                            {row.state}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-[#F8F6F0] font-bold text-ink">
                      <td className="py-3 px-2" colSpan={4}>Total active owing</td>
                      <td className="py-3 px-2 text-right font-mono">{reportData.sumClasses}</td>
                      <td className="py-3 px-2"></td>
                      <td className="py-3 px-2 text-right text-red-500 font-mono">AED {reportData.sumRunRate.toLocaleString()}</td>
                      <td className="py-3 px-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>Live data</span>
              <span>·</span>
              <span>{reportData.totalStudentsVal} students</span>
              <span>·</span>
              <span>{reportData.totalPackagesVal} packages</span>
              <span>·</span>
              <span>12 Jul 2026.</span>
            </div>
          </div>
        ) : reportId === 'membership-economics' ? (
          <div className="space-y-6">
            {/* Side-by-side charts card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1 */}
              <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-ink">Students by implied tier</h3>
                  <p className="text-[10px] text-muted-custom">Where each active student's actual monthly spend places them.</p>
                </div>
                
                {chartType === 'table' ? (
                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-line text-left text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                          <th className="py-2 px-1">Tier</th>
                          <th className="py-2 px-1 text-right">Students</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.labels.map((lbl, i) => (
                          <tr key={i} className="border-b border-line hover:bg-canvas/20">
                            <td className="py-2.5 px-1 font-semibold">{lbl}</td>
                            <td className="py-2.5 px-1 text-right font-mono font-bold">
                              {reportData.datasetData[i]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-64 relative">
                    <canvas ref={chartRef}></canvas>
                  </div>
                )}
              </div>

              {/* Chart 2: Custom Grouped Bar representation using CSS */}
              <div className="bg-white border border-line rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">Actual spend vs tier list price</h3>
                  <p className="text-[10px] text-muted-custom">The gap you would be asking families to close.</p>
                </div>
                
                <div className="space-y-5 py-4">
                  {/* Mini */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Mini (Cheapest)</span>
                      <span className="text-muted-custom">AED {reportData.miniARPU} vs AED 750</span>
                    </div>
                    <div className="h-4 bg-canvas rounded-full overflow-hidden flex">
                      <div className="bg-forest h-full" style={{ width: `${Math.min(100, (reportData.miniARPU / 1500) * 100)}%` }}></div>
                      <div className="bg-[#C4A249]/40 h-full border-l border-line" style={{ width: `${Math.min(100, ((750 - reportData.miniARPU) / 1500) * 100)}%` }}></div>
                    </div>
                  </div>
                  {/* Core */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Core</span>
                      <span className="text-muted-custom">AED {reportData.coreARPU} vs AED 1,000</span>
                    </div>
                    <div className="h-4 bg-canvas rounded-full overflow-hidden flex">
                      <div className="bg-forest h-full" style={{ width: `${Math.min(100, (reportData.coreARPU / 1500) * 100)}%` }}></div>
                      {1000 > reportData.coreARPU && (
                        <div className="bg-[#C4A249]/40 h-full border-l border-line" style={{ width: `${Math.min(100, ((1000 - reportData.coreARPU) / 1500) * 100)}%` }}></div>
                      )}
                    </div>
                  </div>
                  {/* Elite */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Elite</span>
                      <span className="text-muted-custom">AED {reportData.eliteARPU} vs AED 1,500</span>
                    </div>
                    <div className="h-4 bg-canvas rounded-full overflow-hidden flex">
                      <div className="bg-forest h-full" style={{ width: `${Math.min(100, (reportData.eliteARPU / 1500) * 100)}%` }}></div>
                      {1500 > reportData.eliteARPU && (
                        <div className="bg-[#C4A249]/40 h-full border-l border-line" style={{ width: `${Math.min(100, ((1500 - reportData.eliteARPU) / 1500) * 100)}%` }}></div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[10px] text-muted-custom">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 bg-forest rounded-sm inline-block"></span> Actual ARPU
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 bg-[#C4A249]/40 rounded-sm inline-block"></span> Tier list price
                  </div>
                </div>
              </div>
            </div>

            {/* Tier Economics table */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">Tier economics</h3>
                  <p className="text-[10px] text-muted-custom">Implied tier from real monthly spend (classes × rate).</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">TIER</th>
                      <th className="py-2.5 px-2">LIST PRICE</th>
                      <th className="py-2.5 px-2 text-right">STUDENTS</th>
                      <th className="py-2.5 px-2 text-right">ACTUAL ARPU</th>
                      <th className="py-2.5 px-2 text-right">CURRENT MRR</th>
                      <th className="py-2.5 px-2 text-right">MRR AT LIST</th>
                      <th className="py-2.5 px-2 text-right font-bold">GAP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-bold text-ink">
                        Mini
                        <span className="block text-[9px] text-muted-custom font-normal mt-0.5">1 session/week · group coaching · termly progress note</span>
                      </td>
                      <td className="py-3 px-2 text-muted-custom">AED 750</td>
                      <td className="py-3 px-2 text-right font-semibold text-ink">{reportData.miniCount}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">AED {reportData.miniARPU}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">AED {reportData.miniSpend.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">AED {(reportData.miniCount * 750).toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-bold text-forest">
                        {reportData.miniGap >= 0 ? `+AED ${reportData.miniGap.toLocaleString()}` : `-AED ${Math.abs(reportData.miniGap).toLocaleString()}`}
                      </td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-bold text-ink">
                        Core
                        <span className="block text-[9px] text-muted-custom font-normal mt-0.5">2 sessions/week · group coaching · monthly report</span>
                      </td>
                      <td className="py-3 px-2 text-muted-custom">AED 1,000</td>
                      <td className="py-3 px-2 text-right font-semibold text-ink">{reportData.coreCount}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">AED {reportData.coreARPU}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">AED {reportData.coreSpend.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">AED {(reportData.coreCount * 1000).toLocaleString()}</td>
                      <td className={`py-3 px-2 text-right font-bold ${reportData.coreGap >= 0 ? 'text-forest' : 'text-ink/80'}`}>
                        {reportData.coreGap >= 0 ? `+AED ${reportData.coreGap.toLocaleString()}` : `AED ${reportData.coreGap.toLocaleString()}`}
                      </td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-bold text-ink">
                        Elite
                        <span className="block text-[9px] text-muted-custom font-normal mt-0.5">3 sessions/week · development focus - tournament prep</span>
                      </td>
                      <td className="py-3 px-2 text-muted-custom">AED 1,500</td>
                      <td className="py-3 px-2 text-right font-semibold text-ink">{reportData.eliteCount}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">AED {reportData.eliteARPU}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">AED {reportData.eliteSpend.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">AED {(reportData.eliteCount * 1500).toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-bold text-forest">
                        {reportData.eliteGap >= 0 ? `+AED ${reportData.eliteGap.toLocaleString()}` : `AED ${reportData.eliteGap.toLocaleString()}`}
                      </td>
                    </tr>
                    {/* Total Active Row */}
                    <tr className="bg-[#F8F6F0] font-bold text-ink">
                      <td className="py-3 px-2">Total active</td>
                      <td className="py-3 px-2"></td>
                      <td className="py-3 px-2 text-right">{reportData.totalStudentsVal}</td>
                      <td className="py-3 px-2 text-right">AED {reportData.kpi1.val.replace('AED ', '')}</td>
                      <td className="py-3 px-2 text-right">AED {reportData.sumRunRate.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right">AED {reportData.totalListMRR.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-forest">
                        {reportData.totalGap >= 0 ? `+AED ${reportData.totalGap.toLocaleString()}` : `AED ${reportData.totalGap.toLocaleString()}`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* How to migrate without breaking the base */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span className="text-[#C4A249]">⌛</span> How to migrate without breaking the base
                </h3>
                <p className="text-[10px] text-muted-custom">Sequenced by risk.</p>
              </div>

              <div className="space-y-4 pt-2">
                {[
                  "Start with students already at or above their tier price — for them this is a renaming, not a rise. Zero churn risk, immediate clarity.",
                  "Grandfather the long-tenured. Your 24-month+ cohort is the loyal core and the referral engine. Do not hand them a price rise to save a few hundred dirhams a month.",
                  "Introduce tiers at the point of renewal, not by a blanket announcement — the renewal conversation is where value is already being discussed.",
                  "Price new enrolments on the tier card from day one. This is free — new families have no reference price.",
                  "Fix retention before you raise prices. At 50% twelve-month retention, a price rise into a leaky base loses more than it gains. Sequence matters."
                ].map((txt, i) => (
                  <div key={i} className="flex gap-4 items-start text-xs leading-relaxed text-ink/90 border-b border-line/50 pb-3 last:border-b-0">
                    <span className="w-5 h-5 rounded-full bg-forest text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p>{txt}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>Live data</span>
              <span>·</span>
              <span>{reportData.totalStudentsVal} active students</span>
              <span>·</span>
              <span>{reportData.totalPackagesVal} packages</span>
              <span>·</span>
              <span>12 Jul 2026.</span>
            </div>
          </div>
        ) : reportId === 'cohort-retention' ? (
          <div className="space-y-6">
            {/* Side-by-side charts card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Retention curve */}
              <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-ink">Retention curve — by months since joining</h3>
                  <p className="text-[10px] text-muted-custom">Every student bucketed by how long ago they enrolled.</p>
                </div>
                {chartType === 'table' ? (
                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-line text-left text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                          <th className="py-2 px-1">Months Since Joining</th>
                          <th className="py-2 px-1 text-right">Retention</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.labels.map((lbl, i) => (
                          <tr key={i} className="border-b border-line hover:bg-canvas/20">
                            <td className="py-2.5 px-1 font-semibold">{lbl}</td>
                            <td className="py-2.5 px-1 text-right font-mono font-bold">
                              {reportData.datasetData[i]}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-72 relative">
                    <canvas ref={chartRef}></canvas>
                  </div>
                )}
              </div>

              {/* Chart 2: Bay Avenue vs JLT */}
              <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-ink">Bay Avenue vs JLT</h3>
                  <p className="text-[10px] text-muted-custom">The two centres retain very differently.</p>
                </div>
                <div className="h-72 relative">
                  <canvas ref={chartRef2}></canvas>
                </div>
              </div>
            </div>

            {/* Retention by age of cohort Table Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <span>⏳</span> Retention by age of cohort
                  </h3>
                  <p className="text-[10px] text-muted-custom">Students grouped by how long since they enrolled.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">MONTHS SINCE JOINING</th>
                      <th className="py-2.5 px-2 text-right">STUDENTS</th>
                      <th className="py-2.5 px-2 text-right">STILL ATTENDING</th>
                      <th className="py-2.5 px-2 text-right">RETENTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {reportData.ageRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-canvas/20">
                        <td className="py-3 px-2 font-bold text-ink">{row.label}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{row.students}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{row.active}</td>
                        <td className="py-3 px-2 text-right font-semibold text-ink">{row.retentionPct}%</td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-[#F8F6F0] font-bold text-ink">
                      <td className="py-3 px-2">All students</td>
                      <td className="py-3 px-2 text-right">{reportData.sumStudents}</td>
                      <td className="py-3 px-2 text-right">{reportData.totalActiveStudents}</td>
                      <td className="py-3 px-2 text-right">{reportData.annualisedVal}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* By joining quarter Table Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <span>🤝</span> By joining quarter
                  </h3>
                  <p className="text-[10px] text-muted-custom">The actual cohorts, oldest first.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">JOINED</th>
                      <th className="py-2.5 px-2 text-right">SIZE</th>
                      <th className="py-2.5 px-2 text-right">STILL ATTENDING</th>
                      <th className="py-2.5 px-2 text-right">RETENTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {reportData.quarterRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-canvas/20">
                        <td className="py-3 px-2 font-bold text-ink">{row.label}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{row.size}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{row.active}</td>
                        <td className="py-3 px-2 text-right font-semibold text-ink">{row.retentionPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* What to do banner */}
            <div className="p-4 rounded-[12px] bg-emerald-50/20 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/90">
              <span className="font-bold text-forest">What to do with this.</span> A 50% twelve-month retention means you replace half your base every year just to stand still. Every AED spent on acquisition is worth less than an AED spent on the first 90 days — which is precisely where the platform's attendance alerts, renewal triggers and progress reports act. <span className="font-bold text-forest">Retention is the growth strategy.</span>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>Live data</span>
              <span>·</span>
              <span>{reportData.totalStudentsVal} students</span>
              <span>·</span>
              <span>{reportData.totalPackagesVal} packages</span>
              <span>·</span>
              <span>12 Jul 2026.</span>
            </div>
          </div>
        ) : reportId === 'slow-risk' ? (
          <div className="space-y-6">
            {/* Chart Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">Value at risk {diceBy.toLowerCase()}</h3>
                <p className="text-[10px] text-muted-custom">
                  {filterCentre === 'All' ? 'All data' : filterCentre} · {reportData.totalStudentsVal} students in scope
                </p>
              </div>
              {chartType === 'table' ? (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line text-left text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                        <th className="py-2 px-1">Dimension Group</th>
                        <th className="py-2 px-1 text-right">Value Metric</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.labels.map((lbl, i) => (
                        <tr key={i} className="border-b border-line hover:bg-canvas/20">
                          <td className="py-2.5 px-1 font-semibold">{lbl}</td>
                          <td className="py-2.5 px-1 text-right font-mono font-bold">
                            AED {reportData.datasetData[i].toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-72 relative">
                  <canvas ref={chartRef}></canvas>
                </div>
              )}
            </div>

            {/* At-risk students Table Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <span>⚠️</span> At-risk students — {reportData.atRiskCount}
                  </h3>
                  <p className="text-[10px] text-muted-custom">Ranked by lifetime spend — chase the top first.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">STUDENT</th>
                      <th className="py-2.5 px-2">ID</th>
                      <th className="py-2.5 px-2">CENTRE</th>
                      <th className="py-2.5 px-2">COACH</th>
                      <th className="py-2.5 px-2 text-right">DAYS SINCE</th>
                      <th className="py-2.5 px-2 text-right">30D</th>
                      <th className="py-2.5 px-2 text-right">90D</th>
                      <th className="py-2.5 px-2 text-center">STATE</th>
                      {currentUser?.role !== 'front_desk' && <th className="py-2.5 px-2 text-right">PAID TO DATE</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {reportData.atRiskRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-canvas/20">
                        <td className="py-3 px-2 font-bold text-ink">{row.name}</td>
                        <td className="py-3 px-2 text-muted-custom font-mono">{row.fideId}</td>
                        <td className="py-3 px-2">{row.centreName}</td>
                        <td className="py-3 px-2 uppercase text-muted-custom">{row.coachName}</td>
                        <td className="py-3 px-2 text-right font-bold">{row.daysSince}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{row.classes30}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{row.classes90}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold tracking-wider border uppercase ${
                            row.state === 'DORMANT' 
                              ? 'bg-red-50 text-hot-custom border-red-200' 
                              : 'bg-amber-50 text-[#C4A249] border-amber-200'
                          }`}>
                            {row.state}
                          </span>
                        </td>
                        {currentUser?.role !== 'front_desk' && <td className="py-3 px-2 text-right font-semibold text-ink">AED {row.paid.toLocaleString()}</td>}
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-[#F8F6F0] font-bold text-ink">
                      <td className="py-3 px-2">Total</td>
                      <td className="py-3 px-2 text-muted-custom font-mono">—</td>
                      <td className="py-3 px-2">—</td>
                      <td className="py-3 px-2">—</td>
                      <td className="py-3 px-2 text-right">—</td>
                      <td className="py-3 px-2 text-right text-muted-custom">
                        {reportData.atRiskRows.reduce((sum: number, r: any) => sum + r.classes30, 0)}
                      </td>
                      <td className="py-3 px-2 text-right text-muted-custom">
                        {reportData.atRiskRows.reduce((sum: number, r: any) => sum + r.classes90, 0)}
                      </td>
                      <td className="py-3 px-2 text-center">—</td>
                      {currentUser?.role !== 'front_desk' ? (
                        <td className="py-3 px-2 text-right">AED {reportData.annualisedVal.toLocaleString()}</td>
                      ) : null}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>Live data</span>
              <span>·</span>
              <span>{reportData.totalStudentsVal} students</span>
              <span>·</span>
              <span>{reportData.totalPackagesVal} packages</span>
              <span>·</span>
              <span>12 Jul 2026.</span>
            </div>
          </div>
        ) : reportId === 'package-expiry' ? (
          <div className="space-y-6">
            
            {/* Attention-Grabbing 20% Threshold Renewal Trigger Banner */}
            <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500 text-amber-950 font-bold text-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="bg-amber-600 text-white text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wider shadow-sm flex items-center gap-1">
                  ⚡ 20% THRESHOLD TRIGGER
                </span>
                <span>
                  <b>{reportData.tableRows.filter((r: any) => r.is20PctTrigger).length} Student Packages</b> hit or crossed the <b>20% remaining threshold</b>! Front office alert active.
                </span>
              </div>
              <button 
                onClick={() => router.push('/packages')}
                className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold text-xs px-4 py-2 rounded-lg transition-all shadow-md flex-shrink-0"
              >
                Process Renewals Now →
              </button>
            </div>

            {/* Chart Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">Packages expiring by Centre</h3>
                <p className="text-[10px] text-muted-custom">
                  {filterCentre === 'All' ? 'All data' : filterCentre} · {reportData.totalStudentsVal} students in scope
                </p>
              </div>
              {chartType === 'table' ? (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line text-left text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                        <th className="py-2 px-1">Centre</th>
                        <th className="py-2 px-1 text-right">Packages Expiring</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.labels.map((lbl: string, i: number) => (
                        <tr key={i} className="border-b border-line hover:bg-canvas/20">
                          <td className="py-2.5 px-1 font-semibold">{lbl}</td>
                          <td className="py-2.5 px-1 text-right font-mono font-bold">
                            {reportData.datasetData[i]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-72 relative">
                  <canvas ref={chartRef}></canvas>
                </div>
              )}
            </div>

            {/* Expiring packages Table Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <span>👑</span> Packages expiring — renew now
                  </h3>
                  <p className="text-[10px] text-muted-custom">Fewest classes remaining first. Flagged automatically at <b>≤20% package threshold</b>.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">STUDENT</th>
                      <th className="py-2.5 px-2">CENTRE</th>
                      <th className="py-2.5 px-2">COACH</th>
                      <th className="py-2.5 px-2">PACKAGE</th>
                      <th className="py-2.5 px-2 text-right">PAID</th>
                      <th className="py-2.5 px-2 text-right">USED</th>
                      <th className="py-2.5 px-2 text-right">LEFT</th>
                      <th className="py-2.5 px-2 text-center">TRIGGER STATUS</th>
                      <th className="py-2.5 px-2 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {reportData.tableRows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-canvas/20">
                        <td className="py-3 px-2 font-bold text-ink">{row.studentName}</td>
                        <td className="py-3 px-2">{row.centreName}</td>
                        <td className="py-3 px-2 uppercase text-muted-custom">{row.coachName}</td>
                        <td className="py-3 px-2 text-muted-custom font-semibold">{row.pkgLabel}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{row.paid}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{row.used}</td>
                        <td className="py-3 px-2 text-right font-bold text-hot-custom">{row.left} ({row.pctLeft}%)</td>
                        <td className="py-3 px-2 text-center">
                          {row.is20PctTrigger ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-1 rounded bg-amber-500 text-white shadow-sm uppercase tracking-wider">
                              ⚡ 20% TRIGGER
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                              EXPIRING
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => router.push(`/packages?studentId=${row.studentId}`)}
                            className="bg-forest hover:bg-forest/90 text-white font-bold text-[10px] px-3 py-1 rounded-lg transition-all shadow-sm active:scale-95"
                          >
                            Renew
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-[#F8F6F0] font-bold text-ink">
                      <td className="py-3 px-2">Total</td>
                      <td className="py-3 px-2">—</td>
                      <td className="py-3 px-2">—</td>
                      <td className="py-3 px-2">—</td>
                      <td className="py-3 px-2 text-right">
                        {reportData.tableRows.reduce((sum: number, r: any) => sum + r.paid, 0)}
                      </td>
                      <td className="py-3 px-2 text-right font-semibold">
                        {reportData.tableRows.reduce((sum: number, r: any) => sum + r.used, 0)}
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-hot-custom">
                        {reportData.tableRows.reduce((sum: number, r: any) => sum + r.left, 0)}
                      </td>
                      <td className="py-3 px-2 text-center">—</td>
                      <td className="py-3 px-2 text-center">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>Live data</span>
              <span>·</span>
              <span>{reportData.totalStudentsVal} students</span>
              <span>·</span>
              <span>{reportData.totalPackagesVal} packages</span>
              <span>·</span>
              <span>12 Jul 2026.</span>
            </div>
          </div>
        ) : reportId === 'unpaid-attendance' ? (
          <div className="space-y-6">
            {/* Chart Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">Unbilled classes {diceBy.toLowerCase()}</h3>
                <p className="text-[10px] text-muted-custom">
                  {filterCentre === 'All' ? 'All data' : filterCentre} · {reportData.totalStudentsVal} students in scope
                </p>
              </div>
              {chartType === 'table' ? (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line text-left text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                        <th className="py-2 px-1">Dimension Group</th>
                        <th className="py-2 px-1 text-right">Classes Unpaid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.labels.map((lbl, i) => (
                        <tr key={i} className="border-b border-line hover:bg-canvas/20">
                          <td className="py-2.5 px-1 font-semibold">{lbl}</td>
                          <td className="py-2.5 px-1 text-right font-mono font-bold">
                            {reportData.datasetData[i]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-72 relative">
                  <canvas ref={chartRef}></canvas>
                </div>
              )}
            </div>

            {/* Unpaid attendance Table Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <span>⌛</span> Attending with no paid package
                  </h3>
                  <p className="text-[10px] text-muted-custom">Every class here is revenue given away.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">STUDENT</th>
                      <th className="py-2.5 px-2">CENTRE</th>
                      <th className="py-2.5 px-2">COACH</th>
                      <th className="py-2.5 px-2 text-right">CLASSES UNPAID</th>
                      <th className="py-2.5 px-2 text-right">VALUE</th>
                      <th className="py-2.5 px-2">SINCE</th>
                      <th className="py-2.5 px-2 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {reportData.tableRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-canvas/20">
                        <td className="py-3 px-2 font-bold text-ink">{row.studentName}</td>
                        <td className="py-3 px-2">{row.centreName}</td>
                        <td className="py-3 px-2 uppercase text-muted-custom">{row.coachName}</td>
                        <td className="py-3 px-2 text-right font-bold text-hot-custom">{row.unpaidClasses}</td>
                        <td className="py-3 px-2 text-right font-semibold text-ink">AED {row.unpaidValue.toLocaleString()}</td>
                        <td className="py-3 px-2 font-mono text-muted-custom">{row.sinceDate}</td>
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => router.push(`/packages?studentId=${row.studentId}`)}
                            className="bg-white hover:bg-canvas border border-line text-ink font-bold text-[10px] px-2.5 py-1 rounded-lg"
                          >
                            Bill now
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-[#F8F6F0] font-bold text-ink">
                      <td className="py-3 px-2">Total</td>
                      <td className="py-3 px-2">—</td>
                      <td className="py-3 px-2">—</td>
                      <td className="py-3 px-2 text-right text-hot-custom">
                        {reportData.tableRows.reduce((sum: number, r: any) => sum + r.unpaidClasses, 0)}
                      </td>
                      <td className="py-3 px-2 text-right font-bold">
                        AED {reportData.tableRows.reduce((sum: number, r: any) => sum + r.unpaidValue, 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-2">—</td>
                      <td className="py-3 px-2 text-center">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>Live data</span>
              <span>·</span>
              <span>{reportData.totalStudentsVal} students</span>
              <span>·</span>
              <span>{reportData.totalPackagesVal} packages</span>
              <span>·</span>
              <span>12 Jul 2026.</span>
            </div>
          </div>
        ) : reportId === 'growth-trajectory' ? (
          <div className="space-y-6">
            {/* Strategy Emerald Banner */}
            <div className="rounded-xl p-6 text-white relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(rgba(18, 47, 40, 0.95), rgba(18, 47, 40, 0.95)), url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' width=\'50\' height=\'50\'/%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' x=\'50\' y=\'50\' width=\'50\' height=\'50\'/%3E%3C/svg%3E")' }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">Master Moves Chess Club</div>
                  <h2 className="text-2xl font-bold font-display mt-1 text-white">Growth Trajectory</h2>
                  <p className="text-xs text-mint/80 mt-1">
                    Classes delivered per month, by centre · 12 Jul 2026
                  </p>
                </div>
              </div>
            </div>

            {/* Analysis Text Block */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                📈 The two-speed business
              </h3>
              <p className="text-xs text-ink/90 leading-relaxed">
                Bay Avenue has been broadly flat for a year (<span className="font-bold text-forest">25%</span>), operating near its natural ceiling for the space and coach roster. JLT went from 89 to 305 student-classes a month — <span className="font-bold text-forest">243% growth</span> — and is still climbing.
              </p>
            </div>

            {/* Gold warning banner */}
            <div className="p-4 rounded-[12px] bg-[#FDFBF7] border border-[#F4E3C1] border-l-4 border-l-[#C4A249] text-xs text-ink/90">
              <span className="font-bold text-[#b49040]">Read this carefully before the raise.</span> Group growth looks modest because Bay Avenue dominates the base. The <i>unit</i> story is the one that matters: a new centre ramps to ~300 student-classes/month inside a year. That is the number that justifies Town Square, not the blended average.
            </div>

            {/* Monthly Trajectory Chart Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">Monthly trajectory</h3>
                <p className="text-[10px] text-muted-custom">Student-classes / month by centre</p>
              </div>
              <div className="h-72 relative">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            {/* Breakdown Table Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <span>📅</span> By month
                  </h3>
                  <p className="text-[10px] text-muted-custom">Monthly classes delivered and estimated revenue.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">MONTH</th>
                      <th className="py-2.5 px-2 text-right">BAY AVENUE</th>
                      <th className="py-2.5 px-2 text-right">JLT</th>
                      <th className="py-2.5 px-2 text-right">TOTAL</th>
                      <th className="py-2.5 px-2 text-right">EST. REVENUE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line font-medium text-ink">
                    {reportData.monthlyData.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-canvas/20">
                        <td className="py-3 px-2 font-bold text-ink">{row.month}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{row.bay}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{row.jlt}</td>
                        <td className="py-3 px-2 text-right font-bold text-ink">{row.total}</td>
                        <td className="py-3 px-2 text-right font-semibold text-forest">AED {row.estRevenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-muted-custom">
                Student-classes = attendances. Revenue = classes × centre median rate.
              </div>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>Live data</span>
              <span>·</span>
              <span>{reportData.totalStudentsVal} students</span>
              <span>·</span>
              <span>{reportData.totalPackagesVal} packages</span>
              <span>·</span>
              <span>12 Jul 2026.</span>
            </div>
          </div>
        ) : reportId === 'centre-perf' ? (
          <div className="space-y-6">
            {/* Strategy Emerald Banner */}
            <div className="rounded-xl p-6 text-white relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(rgba(18, 47, 40, 0.95), rgba(18, 47, 40, 0.95)), url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' width=\'50\' height=\'50\'/%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' x=\'50\' y=\'50\' width=\'50\' height=\'50\'/%3E%3C/svg%3E")' }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">Master Moves Chess Club</div>
                  <h2 className="text-2xl font-bold font-display mt-1 text-white">Centre Performance Report</h2>
                  <p className="text-xs text-mint/80 mt-1">
                    Bay Avenue · JLT · Town Square (planned) · 12 Jul 2026
                  </p>
                </div>
              </div>
            </div>

            {/* Analysis Text Block */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                📊 Summary
              </h3>
              <p className="text-xs text-ink/90 leading-relaxed">
                Bay Avenue is the mature centre — <span className="font-bold">{reportData.metrics.studentsBay} students, AED {reportData.metrics.runRateBay.toLocaleString()}/month</span> — but flat at <span className="font-bold">25%</span> year-on-year. JLT is a third of the size yet grew <span className="font-bold text-forest">243%</span> over the same period. Bay Avenue also carries <span className="font-bold text-hot-custom">AED {reportData.metrics.unbilledBay.toLocaleString()}</span> of the unbilled exposure versus JLT's <span className="font-bold text-hot-custom">AED {reportData.metrics.unbilledJlt.toLocaleString()}</span> — scale amplified the billing gap.
              </p>
            </div>

            {/* Greenish/blueish warning banner */}
            <div className="p-4 rounded-[12px] bg-emerald-50/20 border border-emerald-100 border-l-4 border-l-forest text-xs text-mint-custom/90">
              <span className="font-bold text-forest">Implication.</span> Model Town Square on <span className="font-bold">JLT's ramp</span>, not Bay Avenue's steady state — JLT is the only evidence of what a new Master Moves centre does from a standing start. And open it with the zero-balance rule enforced from day one so it never accumulates the leak.
            </div>

            {/* Trajectories Line Chart */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">Trajectories</h3>
                <p className="text-[10px] text-muted-custom">Monthly classes delivered over time</p>
              </div>
              <div className="h-72 relative">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            {/* Comparison Table Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <span>📊</span> Comparison
                  </h3>
                  <p className="text-[10px] text-muted-custom">Key metrics compared between active and planned centres.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">METRIC</th>
                      <th className="py-2.5 px-2 text-right">BAY AVENUE</th>
                      <th className="py-2.5 px-2 text-right">JLT</th>
                      <th className="py-2.5 px-2 text-right">TOWN SQUARE (TARGET)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line font-medium text-ink">
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-semibold">Students</td>
                      <td className="py-3 px-2 text-right font-bold">{reportData.metrics.studentsBay}</td>
                      <td className="py-3 px-2 text-right font-bold">{reportData.metrics.studentsJlt}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">120</td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-semibold">Engaged</td>
                      <td className="py-3 px-2 text-right">{reportData.metrics.engagedBayCount} ({reportData.metrics.engagedBayPct}%)</td>
                      <td className="py-3 px-2 text-right">{reportData.metrics.engagedJltCount} ({reportData.metrics.engagedJltPct}%)</td>
                      <td className="py-3 px-2 text-right text-muted-custom">≥60%</td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-semibold">Student-classes / month</td>
                      <td className="py-3 px-2 text-right">{reportData.metrics.avgClassesBay}</td>
                      <td className="py-3 px-2 text-right">{reportData.metrics.avgClassesJlt}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">~320</td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-semibold">Run-rate / month</td>
                      <td className="py-3 px-2 text-right">AED {reportData.metrics.runRateBay.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right">AED {reportData.metrics.runRateJlt.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">~AED 30,400</td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-semibold">Median rate / class</td>
                      <td className="py-3 px-2 text-right">AED 100</td>
                      <td className="py-3 px-2 text-right">AED 90</td>
                      <td className="py-3 px-2 text-right text-muted-custom">AED 100</td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-semibold">Coaches</td>
                      <td className="py-3 px-2 text-right">{reportData.metrics.coachesBay}</td>
                      <td className="py-3 px-2 text-right">{reportData.metrics.coachesJlt}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">2–3</td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-semibold">YoY growth</td>
                      <td className="py-3 px-2 text-right">25%</td>
                      <td className="py-3 px-2 text-right font-bold text-forest">243%</td>
                      <td className="py-3 px-2 text-right text-muted-custom">ramp</td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-semibold">Unbilled exposure</td>
                      <td className="py-3 px-2 text-right font-bold text-hot-custom">AED {reportData.metrics.unbilledBay.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-bold text-hot-custom">AED {reportData.metrics.unbilledJlt.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-bold text-forest">Zero — enforced</td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2 font-semibold">Lifetime collected</td>
                      <td className="py-3 px-2 text-right font-bold">AED {reportData.metrics.lifetimeBay.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-bold">AED {reportData.metrics.lifetimeJlt.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-muted-custom">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-muted-custom">
                Town Square figures are targets modelled on JLT's ramp, not actuals.
              </div>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>Live data</span>
              <span>·</span>
              <span>{reportData.totalStudentsVal} students</span>
              <span>·</span>
              <span>{reportData.totalPackagesVal} packages</span>
              <span>·</span>
              <span>12 Jul 2026.</span>
            </div>
          </div>
        ) : reportId === 'board-investor-pack' ? (
          <div className="space-y-6">
            {/* Strategy Emerald Banner */}
            <div className="rounded-xl p-6 text-white relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(rgba(18, 47, 40, 0.95), rgba(18, 47, 40, 0.95)), url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' width=\'50\' height=\'50\'/%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' x=\'50\' y=\'50\' width=\'50\' height=\'50\'/%3E%3C/svg%3E")' }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">Master Moves Chess Club</div>
                  <h2 className="text-2xl font-bold font-display mt-1 text-white">Board / Investor Pack</h2>
                  <p className="text-xs text-mint/80 mt-1">
                    Defensible operating metrics · 12 Jul 2026
                  </p>
                </div>
              </div>
            </div>

            {/* Headline KPI Section */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <span>🎯</span> Headline
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-canvas/30 border border-line rounded-xl p-4 text-center">
                  <div className="text-[20px] font-bold text-ink">{reportData.kpi1.val}</div>
                  <div className="text-[9px] font-bold text-muted-custom uppercase mt-1">RUN-RATE / MONTH</div>
                </div>
                <div className="bg-canvas/30 border border-line rounded-xl p-4 text-center">
                  <div className="text-[20px] font-bold text-ink">{reportData.kpi2.val}</div>
                  <div className="text-[9px] font-bold text-muted-custom uppercase mt-1">ANNUALISED (AED)</div>
                </div>
                <div className="bg-canvas/30 border border-line rounded-xl p-4 text-center">
                  <div className="text-[20px] font-bold text-ink">{reportData.kpi3.val}</div>
                  <div className="text-[9px] font-bold text-muted-custom uppercase mt-1">ON THE BOOK</div>
                </div>
                <div className="bg-canvas/30 border border-line rounded-xl p-4 text-center">
                  <div className="text-[20px] font-bold text-ink">{reportData.kpi4.val}</div>
                  <div className="text-[9px] font-bold text-muted-custom uppercase mt-1">GENUINELY ACTIVE</div>
                </div>
                <div className="bg-canvas/30 border border-line rounded-xl p-4 text-center">
                  <div className="text-[20px] font-bold text-ink">{reportData.kpi5.val}</div>
                  <div className="text-[9px] font-bold text-muted-custom uppercase mt-1">ACTIVE RATIO</div>
                </div>
              </div>
            </div>

            {/* Analysis Text Block */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                📊 Be honest about the denominator
              </h3>
              <p className="text-xs text-ink/90 leading-relaxed">
                There are <span className="font-bold">{reportData.metrics.studentsOnBook} students on the book</span>, but only <span className="font-bold">{reportData.metrics.genuinelyActive} ({reportData.metrics.activeRatio}%) attended in the last 30 days</span>. Any ARR built on the full {reportData.metrics.studentsOnBook} overstates the business by roughly <span className="font-bold">2.4×</span>. The defensible figure is <span className="font-bold text-forest">AED {reportData.metrics.runRate.toLocaleString()}/month — AED {reportData.metrics.annualisedArr.toLocaleString()} annualised</span> — built on students actually attending and paying.
              </p>
            </div>

            {/* Gold warning banner */}
            <div className="p-4 rounded-[12px] bg-[#FDFBF7] border border-[#F4E3C1] border-l-4 border-l-[#C4A249] text-xs text-ink/90">
              <span className="font-bold text-[#b49040]">Say it before they find it.</span> An investor runs this exact calculation in diligence. Presenting the corrected number yourself — with the <span className="font-bold">AED {reportData.metrics.unbilled.toLocaleString()}</span> unbilled identified, quantified, and being fixed by a platform you are already building — turns your biggest weakness into evidence of control. Being caught with the gross number costs you the round.
            </div>

            {/* Growth Stacked Bar Chart */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">Growth</h3>
                <p className="text-[10px] text-muted-custom">Monthly classes delivered (stacked by centre)</p>
              </div>
              <div className="h-72 relative">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            {/* The Bridge Table Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <span>🌉</span> The bridge
                  </h3>
                  <p className="text-[10px] text-muted-custom">Bridging from raw metrics to defensible ARR.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">LINE</th>
                      <th className="py-2.5 px-2 text-right">VALUE</th>
                      <th className="py-2.5 px-2">NOTE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line font-medium text-ink">
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2">Students on the book</td>
                      <td className="py-3 px-2 text-right font-bold">{reportData.metrics.studentsOnBook}</td>
                      <td className="py-3 px-2 text-muted-custom">All enrolled records</td>
                    </tr>
                    <tr className="hover:bg-canvas/20 text-[#A23B3B]">
                      <td className="py-3 px-2">Less: dormant / cold / never attended</td>
                      <td className="py-3 px-2 text-right font-bold">-{reportData.metrics.dormantCount}</td>
                      <td className="py-3 px-2 text-muted-custom">No class in 30 days</td>
                    </tr>
                    <tr className="hover:bg-canvas/20 font-bold bg-canvas/20">
                      <td className="py-3 px-2">Genuinely active</td>
                      <td className="py-3 px-2 text-right">{reportData.metrics.genuinelyActive}</td>
                      <td className="py-3 px-2 text-muted-custom">The real denominator</td>
                    </tr>
                    <tr className="hover:bg-canvas/20">
                      <td className="py-3 px-2">Student-classes delivered (30d)</td>
                      <td className="py-3 px-2 text-right font-semibold">{reportData.metrics.classesDelivered30D}</td>
                      <td className="py-3 px-2 text-muted-custom">Actual delivery</td>
                    </tr>
                    <tr className="hover:bg-canvas/20 font-semibold text-forest">
                      <td className="py-3 px-2">Run-rate / month</td>
                      <td className="py-3 px-2 text-right font-bold">AED {reportData.metrics.runRate.toLocaleString()}</td>
                      <td className="py-3 px-2 text-muted-custom">Classes × each student's rate</td>
                    </tr>
                    <tr className="hover:bg-canvas/20 font-bold bg-[#F8F6F0] text-forest">
                      <td className="py-3 px-2">Annualised revenue</td>
                      <td className="py-3 px-2 text-right font-bold">AED {reportData.metrics.annualisedArr.toLocaleString()}</td>
                      <td className="py-3 px-2 text-muted-custom font-normal">Defensible ARR</td>
                    </tr>
                    <tr className="hover:bg-canvas/20 text-[#C4A249]">
                      <td className="py-3 px-2">Unbilled (recoverable)</td>
                      <td className="py-3 px-2 text-right font-bold">AED {reportData.metrics.unbilled.toLocaleString()}</td>
                      <td className="py-3 px-2 text-muted-custom">Identified; recovery in progress</td>
                    </tr>
                    <tr className="hover:bg-canvas/20 font-bold">
                      <td className="py-3 px-2">Lifetime collected</td>
                      <td className="py-3 px-2 text-right">AED {reportData.metrics.lifetimeCollected.toLocaleString()}</td>
                      <td className="py-3 px-2 text-muted-custom font-normal">Zero external capital</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommended Action block (The equity story) */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <span>📋</span> The equity story
              </h3>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <div className="bg-[#286957] text-white font-bold rounded-lg text-xs w-6 h-6 flex items-center justify-center shrink-0">1</div>
                  <p className="text-xs text-ink/90 mt-0.5">
                    <span className="font-semibold">JLT proves the model repeats</span> — 243% growth from a standing start. Town Square is the third instance.
                  </p>
                </div>
                <div className="flex gap-3 items-start border-t border-line pt-3">
                  <div className="bg-[#286957] text-white font-bold rounded-lg text-xs w-6 h-6 flex items-center justify-center shrink-0">2</div>
                  <p className="text-xs text-ink/90 mt-0.5">
                    <span className="font-semibold">Upside is retention, not acquisition</span> — at 41% active, fixing engagement outweighs any marketing spend.
                  </p>
                </div>
                <div className="flex gap-3 items-start border-t border-line pt-3">
                  <div className="bg-[#286957] text-white font-bold rounded-lg text-xs w-6 h-6 flex items-center justify-center shrink-0">3</div>
                  <p className="text-xs text-ink/90 mt-0.5">
                    <span className="font-semibold">Spare coach capacity already exists</span> — growth needs no proportional headcount.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>All figures computed from live operating data, 12 Jul 2026.</span>
            </div>
          </div>
        ) : reportId === 'new-centre-model' ? (
          <div className="space-y-6">
            {/* Strategy Emerald Banner */}
            <div className="rounded-xl p-6 text-white relative overflow-hidden" style={{ backgroundImage: 'linear-gradient(rgba(18, 47, 40, 0.95), rgba(18, 47, 40, 0.95)), url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' width=\'50\' height=\'50\'/%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' x=\'50\' y=\'50\' width=\'50\' height=\'50\'/%3E%3C/svg%3E")' }}>
              <div>
                <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">Master Moves Chess Club</div>
                <h2 className="text-2xl font-bold font-display mt-1 text-white">New Centre Model</h2>
                <p className="text-xs text-mint/80 mt-1">Town Square — modelled on the JLT ramp · 12 Jul 2026</p>
              </div>
            </div>

            {/* The Model Text Block */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-forest flex items-center gap-1.5">
                The model
              </h3>
              <div className="border-t border-[#C4A249]/30 pt-3">
                <p className="text-xs text-ink/90 leading-relaxed">
                  JLT is the <span className="font-semibold text-forest">only</span> clean evidence of a Master Moves centre opening from zero. It reached <span className="font-bold">305 student-classes/month within 10 months.</span> Town Square should be planned against that curve — and opened with billing control enforced from day one, so it never accumulates the AED 2,36,205 problem the existing centres carry.
                </p>
              </div>
            </div>

            {/* Ramp Projection Chart */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-[#C4A249]/40 pb-3">
                <h3 className="text-sm font-bold text-forest">Ramp projection</h3>
              </div>
              <div className="h-72 relative">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            {/* Month-by-month Plan Table */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#C4A249]/40 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-forest">Month-by-month plan</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExcelDownload} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                  <button onClick={exportToPDF} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">MONTH</th>
                      <th className="py-2.5 px-2 text-right">JLT ACTUAL</th>
                      <th className="py-2.5 px-2 text-right">TOWN SQUARE TARGET</th>
                      <th className="py-2.5 px-2 text-right">EST. REVENUE</th>
                      <th className="py-2.5 px-2">MILESTONE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line font-medium text-ink">
                    {reportData.tableData.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-canvas/20">
                        <td className="py-3 px-2 font-bold text-ink">{row.month}</td>
                        <td className="py-3 px-2 text-right text-muted-custom">{row.jltActual}</td>
                        <td className="py-3 px-2 text-right font-bold text-ink">{row.tsTarget}</td>
                        <td className="py-3 px-2 text-right font-semibold text-forest">AED {row.estRev.toLocaleString()}</td>
                        <td className="py-3 px-2 text-[#C4A249]">{row.milestone}</td>
                      </tr>
                    ))}
                    {/* Year 1 exit row */}
                    <tr className="bg-canvas/30 font-bold border-t-2 border-line">
                      <td className="py-3 px-2 font-bold">Year 1 exit</td>
                      <td className="py-3 px-2 text-right">{reportData.jltActuals[9] || 305}</td>
                      <td className="py-3 px-2 text-right text-forest">320</td>
                      <td className="py-3 px-2 text-right text-forest">AED 32,000/mo</td>
                      <td className="py-3 px-2 text-muted-custom">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-muted-custom italic">
                Targets, not actuals. Adding the centre in the platform is a settings action — every report picks it up automatically.
              </div>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>Live data</span>
              <span>·</span>
              <span>12 Jul 2026.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Chart Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  {reportId === 'unbilled-leak' ? 'Unbilled (ledger)' : reportId === 'lifetime-value' ? 'Lifetime paid' : reportId === 'rate-card' ? 'Students' : reportId === 'attendance-summary' ? 'Classes (30d)' : reportId === 'engagement-report' ? 'Students' : 'Run-rate / month'} {diceBy.toLowerCase()}
                </h3>
                <p className="text-[10px] text-muted-custom">
                  {filterCentre === 'All' ? 'All data' : filterCentre} · {reportData.totalStudentsVal} students in scope
                </p>
              </div>
              
              {chartType === 'table' ? (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line text-left text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                        <th className="py-2 px-1">Dimension Group</th>
                        <th className="py-2 px-1 text-right">Value Metric</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.labels.map((lbl, i) => (
                        <tr key={i} className="border-b border-line hover:bg-canvas/20">
                          <td className="py-2.5 px-1 font-semibold">{lbl}</td>
                          <td className="py-2.5 px-1 text-right font-mono font-bold">
                            AED {reportData.datasetData[i].toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-72 relative">
                  <canvas ref={chartRef}></canvas>
                </div>
              )}
            </div>

            {/* Breakdown Table Card */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">Breakdown {diceBy.toLowerCase()}</h3>
                  <p className="text-[10px] text-muted-custom">Every measure, grouped.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleExcelDownload}
                    className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas"
                  >
                    ↓ Excel
                  </button>
                  <button 
                    onClick={exportToPDF}
                    className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas"
                  >
                    ⎙ PDF
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-2">{diceBy.replace('By ', '').toUpperCase()}</th>
                      {reportId === 'rate-card' ? (
                        <>
                          <th className="py-2.5 px-2 text-right">STUDENTS</th>
                          <th className="py-2.5 px-2 text-right">AVG RATE / CLASS</th>
                          <th className="py-2.5 px-2 text-right">RUN-RATE / MONTH</th>
                        </>
                      ) : reportId === 'attendance-summary' ? (
                        <>
                          <th className="py-2.5 px-2 text-right">CLASSES (30D)</th>
                          <th className="py-2.5 px-2 text-right">CLASSES (90D)</th>
                          <th className="py-2.5 px-2 text-right">STUDENTS</th>
                        </>
                      ) : reportId === 'engagement-report' ? (
                        <>
                          <th className="py-2.5 px-2 text-right">STUDENTS</th>
                          <th className="py-2.5 px-2 text-right">CLASSES (30D)</th>
                          <th className="py-2.5 px-2 text-right">LIFETIME PAID</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2.5 px-2 text-right">
                            {reportId === 'unbilled-leak' ? 'UNBILLED (LEDGER)' : reportId === 'lifetime-value' ? 'LIFETIME PAID' : 'RUN-RATE / MONTH'}
                          </th>
                          <th className="py-2.5 px-2 text-right">
                            {reportId === 'unbilled-leak' ? 'CLASSES OWED' : reportId === 'lifetime-value' ? '—' : 'CLASSES (30D)'}
                          </th>
                          <th className="py-2.5 px-2 text-right">
                            {reportId === 'unbilled-leak' ? 'STUDENTS OWING' : 'STUDENTS'}
                          </th>
                        </>
                      )}
                      <th className="py-2.5 px-2 text-right">SHARE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {reportData.tableRows.map((row, idx) => {
                      const sharePct = reportData.sumRunRate > 0 ? Math.round((row.runRate / reportData.sumRunRate) * 100) : 0;
                      return (
                        <tr key={idx} className="hover:bg-canvas/20">
                          <td className="py-3 px-2 font-bold text-ink">{row.name}</td>
                          {reportId === 'rate-card' ? (
                            <>
                              <td className="py-3 px-2 text-right text-muted-custom">{row.students}</td>
                              <td className="py-3 px-2 text-right font-semibold text-ink">AED {row.avgRate}</td>
                              <td className="py-3 px-2 text-right font-semibold text-ink">AED {row.runRate.toLocaleString()}</td>
                            </>
                          ) : reportId === 'attendance-summary' ? (
                            <>
                              <td className="py-3 px-2 text-right font-semibold text-ink">{row.classes?.toLocaleString()}</td>
                              <td className="py-3 px-2 text-right text-muted-custom">{row.classes90D?.toLocaleString()}</td>
                              <td className="py-3 px-2 text-right text-muted-custom">{row.students}</td>
                            </>
                          ) : reportId === 'engagement-report' ? (
                            <>
                              <td className="py-3 px-2 text-right text-muted-custom">{row.students}</td>
                              <td className="py-3 px-2 text-right font-semibold text-ink">{row.classes?.toLocaleString()}</td>
                              <td className="py-3 px-2 text-right font-semibold text-ink">AED {row.runRate?.toLocaleString()}</td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-2 text-right font-semibold text-ink">AED {row.runRate.toLocaleString()}</td>
                              <td className="py-3 px-2 text-right text-muted-custom">
                                {reportId === 'lifetime-value' ? '—' : row.classes}
                              </td>
                              <td className="py-3 px-2 text-right text-muted-custom">{row.students}</td>
                            </>
                          )}
                          <td className="py-3 px-2 text-right font-semibold text-ink">{sharePct}%</td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr className="bg-[#F8F6F0] font-bold text-ink">
                      <td className="py-3 px-2">Total</td>
                      {reportId === 'rate-card' ? (
                        <>
                          <td className="py-3 px-2 text-right">{reportData.sumStudents}</td>
                          <td className="py-3 px-2 text-right">AED {reportData.kpi2.val.replace('AED ', '')}</td>
                          <td className="py-3 px-2 text-right">AED {reportData.sumRunRate.toLocaleString()}</td>
                        </>
                      ) : reportId === 'attendance-summary' ? (
                        <>
                          <td className="py-3 px-2 text-right font-semibold text-ink">{reportData.sumRunRate.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right text-muted-custom">{reportData.sumClasses.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right text-muted-custom">{reportData.sumStudents}</td>
                        </>
                      ) : reportId === 'engagement-report' ? (
                        <>
                          <td className="py-3 px-2 text-right text-muted-custom">{reportData.sumStudents}</td>
                          <td className="py-3 px-2 text-right font-semibold text-ink">{reportData.sumClasses.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right font-semibold text-ink">AED {reportData.sumRunRate.toLocaleString()}</td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-2 text-right">AED {reportData.sumRunRate.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right">
                            {reportId === 'lifetime-value' ? '—' : reportData.sumClasses}
                          </td>
                          <td className="py-3 px-2 text-right">{reportData.sumStudents}</td>
                        </>
                      )}
                      <td className="py-3 px-2 text-right">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer note */}
            <div className="text-[10px] text-muted-custom flex items-center gap-1.5 py-2">
              <span>Live data</span>
              <span>·</span>
              <span>{reportData.totalStudentsVal} students</span>
              <span>·</span>
              <span>{reportData.totalPackagesVal} packages</span>
              <span>·</span>
              <span>12 Jul 2026.</span>
            </div>
          </div>
        )
      ) : (
        /* Original reports layout */
        (currentUser?.role === 'coach') ? (
          /* Student level only layout */
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4 w-full">
            <div>
              <h3 className="text-sm font-bold text-ink">Students Breakdown</h3>
              <p className="text-[10px] text-muted-custom">Filtered list: {reportData.rawList.length} students</p>
            </div>

            <div className="overflow-y-auto max-h-[500px] divide-y divide-line pr-1">
              {reportData.rawList.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-custom">
                  No students match the active filter criteria.
                </div>
              ) : (
                reportData.rawList.map(student => (
                  <div 
                    key={student.id} 
                    onClick={() => router.push(`/student-dashboard?studentId=${student.id}`)}
                    className="py-2.5 flex items-center justify-between hover:bg-canvas/20 cursor-pointer rounded px-1 transition-colors"
                  >
                    <div>
                      <h5 className="font-bold text-xs text-ink">{student.name}</h5>
                      <p className="text-[9px] text-muted-custom mt-0.5">{student.centre} · {student.level} · Coach: {student.coach}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[10px] font-bold block text-ink">
                        {reportId.includes('revenue') || reportId.includes('ltv') 
                          ? `AED ${student.totalPaid.toLocaleString()}`
                          : `${student.classesRemaining} classes`}
                      </span>
                      <span className={`text-[8px] font-extrabold tracking-wider px-1.5 py-0.5 rounded-full ${
                        student.segment === 'HOT' ? 'bg-red-50 text-hot-custom border border-red-200' : 'bg-emerald-50 text-forest border border-emerald-200'
                      }`}>
                        {student.segment}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Original full layout */
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
            
            {/* Left Visualization Panel */}
            <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-ink">Visualization</h3>
              <p className="text-[10px] text-muted-custom">Diced {diceBy.toLowerCase()}</p>
              
              {chartType === 'table' ? (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line text-left text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                        <th className="py-2 px-1">Dimension Group</th>
                        <th className="py-2 px-1 text-right">Value Metric</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.labels.map((lbl, i) => (
                        <tr key={i} className="border-b border-line hover:bg-canvas/20">
                          <td className="py-2.5 px-1 font-semibold">{lbl}</td>
                          <td className="py-2.5 px-1 text-right font-mono font-bold">
                            {reportId.includes('revenue') || reportId.includes('ltv') || reportId.includes('unbilled') 
                              ? `AED ${reportData.datasetData[i].toLocaleString()}`
                              : reportData.datasetData[i]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-64 relative">
                  <canvas ref={chartRef}></canvas>
                </div>
              )}
            </div>

            {/* Right Detail Roster Panel */}
            <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">Students Breakdown</h3>
                <p className="text-[10px] text-muted-custom">Filtered list: {reportData.rawList.length} students</p>
              </div>

              <div className="overflow-y-auto max-h-72 divide-y divide-line pr-1">
                {reportData.rawList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-custom">
                    No students match the active filter criteria.
                  </div>
                ) : (
                  reportData.rawList.map(student => (
                    <div 
                      key={student.id} 
                      onClick={() => router.push(`/student-dashboard?studentId=${student.id}`)}
                      className="py-2.5 flex items-center justify-between hover:bg-canvas/20 cursor-pointer rounded px-1 transition-colors"
                    >
                      <div>
                        <h5 className="font-bold text-xs text-ink">{student.name}</h5>
                        <p className="text-[9px] text-muted-custom mt-0.5">{student.centre} · {student.level} · Coach: {student.coach}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-[10px] font-bold block text-ink">
                          {reportId.includes('revenue') || reportId.includes('ltv') 
                            ? `AED ${student.totalPaid.toLocaleString()}`
                            : `${student.classesRemaining} classes`}
                        </span>
                        <span className={`text-[8px] font-extrabold tracking-wider px-1.5 py-0.5 rounded-full ${
                          student.segment === 'HOT' ? 'bg-red-50 text-hot-custom border border-red-200' : 'bg-emerald-50 text-forest border border-emerald-200'
                        }`}>
                          {student.segment}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )
      )}

    </div>
  );
};
export default ReportViewer;

