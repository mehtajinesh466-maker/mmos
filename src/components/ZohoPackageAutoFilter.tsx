"use client";

import React, { useState, useRef, useEffect } from 'react';

export interface ZohoPackageFilterState {
  centre: string;
  modeOfPayment: string;
  student: string;
  dateOfPayment: string;
  packageType: string;
  status: string;
  coach: string;
  segment: string;
  search: string;
  sortCol: string;
  sortAsc: boolean;
}

interface ZohoPackageAutoFilterProps {
  filters: ZohoPackageFilterState;
  onFilterChange: (newFilters: ZohoPackageFilterState) => void;
  onResetFilters: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  totalRecords: number;
  filteredRecordsCount: number;

  // Available options
  centres: string[];
  paymentModes: string[];
  students: string[];
  datesOfPayment: string[];
  packageTypes: string[];
  statuses: string[];
  coaches: string[];
  segments: string[];
}

export const ZohoPackageAutoFilter: React.FC<ZohoPackageAutoFilterProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  onExportCSV,
  onExportPDF,
  totalRecords,
  filteredRecordsCount,
  centres,
  paymentModes,
  students,
  datesOfPayment,
  packageTypes,
  statuses,
  coaches,
  segments,
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeMenuField, setActiveMenuField] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [submenuSearch, setSubmenuSearch] = useState('');

  const filterMenuRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // Count active filters
  const activeFiltersCount = [
    filters.centre !== 'All centres' && filters.centre !== 'All',
    filters.modeOfPayment !== 'All',
    filters.student !== 'All',
    filters.dateOfPayment !== 'All',
    filters.packageType !== 'All types' && filters.packageType !== 'All',
    filters.status !== 'All statuses' && filters.status !== 'All',
    filters.coach !== 'All coaches' && filters.coach !== 'All',
    filters.segment !== 'All segments' && filters.segment !== 'All',
    filters.search.trim() !== '',
  ].filter(Boolean).length;

  const hasActiveFiltersOrSort = activeFiltersCount > 0 || filters.sortCol !== 'studentName' || !filters.sortAsc;

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
        setActiveMenuField(null);
      }
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateField = (field: keyof ZohoPackageFilterState, value: any) => {
    onFilterChange({
      ...filters,
      [field]: value,
    });
  };

  const removeFilterPill = (field: keyof ZohoPackageFilterState, defaultValue: any) => {
    updateField(field, defaultValue);
  };

  // Render options for submenus
  const renderSubmenuOptions = (fieldKey: string) => {
    let options: string[] = [];
    let currentValue = '';

    switch (fieldKey) {
      case 'centre':
        options = ['All centres', ...centres];
        currentValue = filters.centre;
        break;
      case 'modeOfPayment':
        options = ['All', ...paymentModes];
        currentValue = filters.modeOfPayment;
        break;
      case 'student':
        options = ['All', ...students];
        currentValue = filters.student;
        break;
      case 'dateOfPayment':
        options = datesOfPayment;
        currentValue = filters.dateOfPayment;
        break;
      case 'packageType':
        options = ['All types', ...packageTypes];
        currentValue = filters.packageType;
        break;
      case 'status':
        options = ['All statuses', ...statuses];
        currentValue = filters.status;
        break;
      case 'coach':
        options = ['All coaches', ...coaches];
        currentValue = filters.coach;
        break;
      case 'segment':
        options = ['All segments', ...segments];
        currentValue = filters.segment;
        break;
      default:
        break;
    }

    if (submenuSearch.trim()) {
      options = options.filter(opt => opt.toLowerCase().includes(submenuSearch.toLowerCase()));
    }

    return (
      <div className="py-1 max-h-60 overflow-y-auto">
        {options.length > 8 && (
          <div className="px-2 py-1 sticky top-0 bg-white border-b border-gray-100">
            <input
              type="text"
              placeholder="Search..."
              value={submenuSearch}
              onChange={e => setSubmenuSearch(e.target.value)}
              className="w-full text-xs px-2 py-1 border border-gray-200 rounded outline-none focus:border-indigo-500"
            />
          </div>
        )}
        {options.map(opt => {
          const isSelected = currentValue.toLowerCase() === opt.toLowerCase();
          return (
            <button
              key={opt}
              onClick={() => {
                let targetKey = opt;
                if (fieldKey === 'centre' && opt === 'All') targetKey = 'All centres';
                if (fieldKey === 'coach' && opt === 'All') targetKey = 'All coaches';
                if (fieldKey === 'packageType' && opt === 'All') targetKey = 'All types';
                if (fieldKey === 'status' && opt === 'All') targetKey = 'All statuses';

                updateField(fieldKey as keyof ZohoPackageFilterState, targetKey);
                setActiveMenuField(null);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-indigo-50 transition-colors ${
                isSelected ? 'font-semibold text-indigo-700 bg-indigo-50/70' : 'text-gray-700'
              }`}
            >
              <span>{opt}</span>
              {isSelected && <span className="text-indigo-600 font-bold text-xs">✓</span>}
            </button>
          );
        })}
      </div>
    );
  };

  const getSortColumnLabel = (col: string) => {
    switch (col) {
      case 'studentName': return 'Student';
      case 'centreName': return 'Centre';
      case 'coachName': return 'Coach';
      case 'type': return 'Package Type';
      case 'amount': return 'Amount';
      case 'paidOn': return 'Date Of Payment';
      case 'paymentMethod': return 'Mode Of Payment';
      case 'status': return 'Status';
      case 'balance': return 'Classes Remaining';
      default: return col;
    }
  };

  return (
    <div className="w-full select-none font-sans text-gray-800">
      {/* ── Top Header Toolbar (Zoho Style) ────────────────────────────────── */}
      <div className="flex items-center justify-between py-2 px-3 border border-gray-200 bg-white rounded-xl shadow-xs mb-3">
        {/* Left Side: Title & Remove Changes */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-gray-900 font-semibold text-base">
            <span>Package records</span>
            <span className="text-red-500 font-bold">*</span>
            <span className="text-gray-400 text-xs ml-0.5">▾</span>
          </div>

          {hasActiveFiltersOrSort && (
            <button
              onClick={onResetFilters}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 font-medium text-xs px-2.5 py-1 rounded-md transition-all shadow-xs flex items-center gap-1 cursor-pointer"
            >
              Remove Changes
            </button>
          )}
        </div>

        {/* Right Side Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Quick Search Toggle / Input */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 animate-fadeIn">
                <input
                  type="text"
                  placeholder="Search package records..."
                  value={filters.search}
                  onChange={e => updateField('search', e.target.value)}
                  autoFocus
                  className="bg-white border border-indigo-400 rounded-md px-3 py-1 text-xs text-gray-800 outline-none w-48 shadow-xs"
                />
                <button
                  onClick={() => {
                    setIsSearchOpen(false);
                    if (filters.search) updateField('search', '');
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSearchOpen(true)}
                title="Search"
                className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 shadow-2xs cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
          </div>

          {/* Auto Filter (Funnel) Button with Popover */}
          <div className="relative" ref={filterMenuRef}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-2xs cursor-pointer transition-colors relative ${
                isFilterOpen || activeFiltersCount > 0
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-600'
              }`}
              title="Auto Filters"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Zoho Style Auto Filters Dropdown Popover */}
            {isFilterOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200/90 z-50 py-2 text-xs animate-fadeIn">
                <div className="px-3 py-1.5 text-[10px] font-bold text-indigo-900/60 uppercase tracking-wider border-b border-gray-100 mb-1">
                  AUTO FILTERS
                </div>

                <div className="space-y-0.5">
                  {[
                    { key: 'centre', label: 'Centre' },
                    { key: 'modeOfPayment', label: 'Mode Of Payment' },
                    { key: 'student', label: 'Student' },
                    { key: 'dateOfPayment', label: 'Date Of Payment' },
                    { key: 'packageType', label: 'Package Type' },
                    { key: 'status', label: 'Status' },
                    { key: 'coach', label: 'Coaches Details' },
                    { key: 'segment', label: 'Student Category' },
                  ].map(item => {
                    const isSelected = (filters as any)[item.key] && (filters as any)[item.key] !== 'All' && (filters as any)[item.key] !== 'All centres' && (filters as any)[item.key] !== 'All coaches' && (filters as any)[item.key] !== 'All types' && (filters as any)[item.key] !== 'All statuses' && (filters as any)[item.key] !== 'All segments';
                    const isHovered = activeMenuField === item.key;

                    return (
                      <div key={item.key} className="relative">
                        <button
                          onClick={() => {
                            setActiveMenuField(activeMenuField === item.key ? null : item.key);
                            setSubmenuSearch('');
                          }}
                          onMouseEnter={() => {
                            setActiveMenuField(item.key);
                            setSubmenuSearch('');
                          }}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-indigo-50 transition-colors ${
                            isSelected ? 'bg-indigo-50/80 font-semibold text-indigo-700' : 'text-gray-700'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {item.label}
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
                          </span>
                          <span className="text-gray-400 text-xs">›</span>
                        </button>

                        {/* Secondary Submenu Flyout */}
                        {isHovered && (
                          <div className="absolute top-0 right-full mr-1 w-52 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-fadeIn">
                            <div className="px-3 py-1.5 font-semibold text-indigo-900 text-xs border-b border-gray-100 flex justify-between items-center bg-gray-50">
                              <span>{item.label}</span>
                              <button onClick={() => setActiveMenuField(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                            {renderSubmenuOptions(item.key)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Options Dropdown (...) */}
          <div className="relative" ref={optionsMenuRef}>
            <button
              onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
              className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 shadow-2xs cursor-pointer transition-colors font-bold text-xs"
              title="More Actions"
            >
              •••
            </button>

            {isOptionsMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 text-xs animate-fadeIn">
                {onExportCSV && (
                  <button
                    onClick={() => { onExportCSV(); setIsOptionsMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                  >
                    <span>↓ Export CSV (Excel)</span>
                  </button>
                )}
                {onExportPDF && (
                  <button
                    onClick={() => { onExportPDF(); setIsOptionsMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                  >
                    <span>⎙ Export PDF</span>
                  </button>
                )}
                <div className="border-t border-gray-100 my-1"></div>
                <button
                  onClick={() => { onResetFilters(); setIsOptionsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 font-medium cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Active Filter Pills / Tags Bar (Zoho Creator Style) ────────────────────────── */}
      {hasActiveFiltersOrSort && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-1 py-1">
          {/* Centre Pill */}
          {filters.centre !== 'All centres' && filters.centre !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Centre</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.centre}</span>
              <button
                onClick={() => removeFilterPill('centre', 'All centres')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Mode Of Payment Pill */}
          {filters.modeOfPayment !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Mode Of Payment</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.modeOfPayment}</span>
              <button
                onClick={() => removeFilterPill('modeOfPayment', 'All')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Student Pill */}
          {filters.student !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Student</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.student}</span>
              <button
                onClick={() => removeFilterPill('student', 'All')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Date Of Payment Pill */}
          {filters.dateOfPayment !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Date Of Payment</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.dateOfPayment}</span>
              <button
                onClick={() => removeFilterPill('dateOfPayment', 'All')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Package Type Pill */}
          {filters.packageType !== 'All types' && filters.packageType !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Package Type</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.packageType}</span>
              <button
                onClick={() => removeFilterPill('packageType', 'All types')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Status Pill */}
          {filters.status !== 'All statuses' && filters.status !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Status</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.status}</span>
              <button
                onClick={() => removeFilterPill('status', 'All statuses')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Coach Pill */}
          {filters.coach !== 'All coaches' && filters.coach !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Coach</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.coach}</span>
              <button
                onClick={() => removeFilterPill('coach', 'All coaches')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Segment Pill */}
          {filters.segment !== 'All segments' && filters.segment !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Category</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.segment}</span>
              <button
                onClick={() => removeFilterPill('segment', 'All segments')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Search Pill */}
          {filters.search.trim() !== '' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Search</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">"{filters.search}"</span>
              <button
                onClick={() => removeFilterPill('search', '')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* SORTING Pill */}
          {(filters.sortCol !== 'studentName' || !filters.sortAsc) && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-indigo-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="font-bold text-indigo-600 uppercase text-[10px] tracking-wide">SORTING</span>
              <span className="font-semibold text-gray-900 flex items-center gap-1">
                {getSortColumnLabel(filters.sortCol)} {filters.sortAsc ? '▲' : '▼'}
              </span>
              <button
                onClick={() => {
                  onFilterChange({
                    ...filters,
                    sortCol: 'studentName',
                    sortAsc: true,
                  });
                }}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Row Counter (Zoho Style) */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1 pb-1">
        <div>
          Showing <span className="font-semibold text-gray-800">{filteredRecordsCount}</span> of <span className="font-semibold text-gray-800">{totalRecords}</span>
        </div>
      </div>
    </div>
  );
};
