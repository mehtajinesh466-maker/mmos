"use client";

import React, { useState, useRef, useEffect } from 'react';

export interface ZohoFilterState {
  dateEnrolled: string;
  category: string;
  level: string;
  centre: string;
  coach: string;
  status: string;
  school: string;
  engagement: string;
  heat: string;
  search: string;
  sortCol: string;
  sortAsc: boolean;
}

interface ZohoAutoFilterProps {
  filters: ZohoFilterState;
  onFilterChange: (newFilters: ZohoFilterState) => void;
  onResetFilters: () => void;
  onAddStudentClick?: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  totalRecords: number;
  filteredRecordsCount: number;
  // Available options lists
  centres: string[];
  coaches: string[];
  categories: string[];
  levels: string[];
  schools: string[];
  dateEnrolledOptions: string[];
}

export const ZohoAutoFilter: React.FC<ZohoAutoFilterProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  onAddStudentClick,
  onExportCSV,
  onExportPDF,
  totalRecords,
  filteredRecordsCount,
  centres,
  coaches,
  categories,
  levels,
  schools,
  dateEnrolledOptions,
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeMenuField, setActiveMenuField] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [submenuSearch, setSubmenuSearch] = useState('');

  const filterMenuRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // Count active filters (excluding default values)
  const activeFiltersCount = [
    filters.dateEnrolled !== 'All',
    filters.category !== 'All',
    filters.level !== 'All',
    filters.centre !== 'All centres' && filters.centre !== 'All',
    filters.coach !== 'All coaches' && filters.coach !== 'All',
    filters.status !== 'All',
    filters.school !== 'All',
    filters.engagement !== 'All',
    filters.heat !== 'All',
    filters.search.trim() !== '',
  ].filter(Boolean).length;

  const hasActiveFiltersOrSort = activeFiltersCount > 0 || filters.sortCol !== 'name' || !filters.sortAsc;

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

  const updateField = (field: keyof ZohoFilterState, value: any) => {
    onFilterChange({
      ...filters,
      [field]: value,
    });
  };

  const removeFilterPill = (field: keyof ZohoFilterState, defaultValue: any) => {
    updateField(field, defaultValue);
  };

  // Render options list for submenus
  const renderSubmenuOptions = (fieldKey: string) => {
    let options: string[] = [];
    let currentValue = '';

    switch (fieldKey) {
      case 'dateEnrolled':
        options = dateEnrolledOptions;
        currentValue = filters.dateEnrolled;
        break;
      case 'category':
        options = ['All', ...categories];
        currentValue = filters.category;
        break;
      case 'level':
        options = ['All', ...levels];
        currentValue = filters.level;
        break;
      case 'centre':
        options = ['All centres', ...centres];
        currentValue = filters.centre;
        break;
      case 'coach':
        options = ['All coaches', ...coaches];
        currentValue = filters.coach;
        break;
      case 'status':
        options = ['All', 'active', 'inactive', 'left', 'frozen'];
        currentValue = filters.status;
        break;
      case 'school':
        options = ['All', ...schools];
        currentValue = filters.school;
        break;
      case 'engagement':
        options = ['All', 'ENGAGED', 'SLIPPING', 'COLD', 'DORMANT', 'NEW'];
        currentValue = filters.engagement;
        break;
      case 'heat':
        options = ['All', 'NEW', 'HOT', 'WARM', 'COLD', 'HEALTHY'];
        currentValue = filters.heat;
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
                const targetKey = fieldKey === 'centre' && opt === 'All' ? 'All centres' : fieldKey === 'coach' && opt === 'All' ? 'All coaches' : opt;
                updateField(fieldKey as keyof ZohoFilterState, targetKey);
                setActiveMenuField(null);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-indigo-50 transition-colors ${
                isSelected ? 'font-semibold text-indigo-700 bg-indigo-50/70' : 'text-gray-700'
              }`}
            >
              <span className="capitalize">{opt}</span>
              {isSelected && <span className="text-indigo-600 font-bold text-xs">✓</span>}
            </button>
          );
        })}
      </div>
    );
  };

  const getSortColumnLabel = (col: string) => {
    switch (col) {
      case 'name': return 'Name';
      case 'join_date': return 'Date Enrolled';
      case 'centreName': return 'Assigned Center';
      case 'coachName': return 'Coaches Details';
      case 'level': return 'Current Student Levels';
      case 'category': return 'Student Category';
      case 'status': return 'Status';
      case 'classesLeft': return 'Overdue / Classes Left';
      case 'daysSince': return 'Recent Attendance';
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
            <span>Student records</span>
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
                  placeholder="Search records..."
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

          {/* Add (+) Button */}
          {onAddStudentClick && (
            <button
              onClick={onAddStudentClick}
              title="Add New Student"
              className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-bold text-lg shadow-xs cursor-pointer transition-colors"
            >
              +
            </button>
          )}

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
                    { key: 'dateEnrolled', label: 'Date Enrolled' },
                    { key: 'category', label: 'Student Category' },
                    { key: 'level', label: 'Current Student Levels' },
                    { key: 'centre', label: 'Assigned Center' },
                    { key: 'coach', label: 'Coaches Details' },
                    { key: 'status', label: 'Status' },
                    { key: 'school', label: 'School' },
                    { key: 'engagement', label: 'Engagement' },
                    { key: 'heat', label: 'Urgency' },
                  ].map(item => {
                    const isSelected = (filters as any)[item.key] && (filters as any)[item.key] !== 'All' && (filters as any)[item.key] !== 'All centres' && (filters as any)[item.key] !== 'All coaches' && (filters as any)[item.key] !== 'All urgency';
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
          {/* Date Enrolled Pill */}
          {filters.dateEnrolled !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Date Enrolled</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.dateEnrolled}</span>
              <button
                onClick={() => removeFilterPill('dateEnrolled', 'All')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Student Category Pill */}
          {filters.category !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Student Category</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.category}</span>
              <button
                onClick={() => removeFilterPill('category', 'All')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Level Pill */}
          {filters.level !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Current Level</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.level}</span>
              <button
                onClick={() => removeFilterPill('level', 'All')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Assigned Center Pill */}
          {filters.centre !== 'All centres' && filters.centre !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Assigned Center</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.centre}</span>
              <button
                onClick={() => removeFilterPill('centre', 'All centres')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Coaches Details Pill */}
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

          {/* Status Pill */}
          {filters.status !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Status</span>
              <span className="font-semibold text-indigo-900 capitalize bg-indigo-50 px-1.5 py-0.5 rounded">{filters.status}</span>
              <button
                onClick={() => removeFilterPill('status', 'All')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* School Pill */}
          {filters.school !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">School</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.school}</span>
              <button
                onClick={() => removeFilterPill('school', 'All')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Engagement Pill */}
          {filters.engagement !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Engagement</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.engagement}</span>
              <button
                onClick={() => removeFilterPill('engagement', 'All')}
                className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Urgency / Heat Pill */}
          {filters.heat !== 'All' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="text-gray-500">Urgency</span>
              <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">{filters.heat}</span>
              <button
                onClick={() => removeFilterPill('heat', 'All')}
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
          {(filters.sortCol !== 'name' || !filters.sortAsc) && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-indigo-300 rounded-md text-xs shadow-2xs font-medium text-gray-800">
              <span className="font-bold text-indigo-600 uppercase text-[10px] tracking-wide">SORTING</span>
              <span className="font-semibold text-gray-900 flex items-center gap-1">
                {getSortColumnLabel(filters.sortCol)} {filters.sortAsc ? '▲' : '▼'}
              </span>
              <button
                onClick={() => {
                  onFilterChange({
                    ...filters,
                    sortCol: 'name',
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
