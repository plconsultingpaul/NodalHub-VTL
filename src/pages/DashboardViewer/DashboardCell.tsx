import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { proxyFetch } from '../../lib/apiProxy';
import CustomDropdown from '../../components/ui/CustomDropdown';
import DatePicker from '../../components/ui/DatePicker';
import { useLookupResolver } from '../../hooks/useLookupResolver';
import { useFixedValues } from '../../hooks/useFixedValues';
import { executeActionForRows, getPromptMappings, getFixedValueListMappings, executeLinkAction } from './actionExecutor';
import type { ActionProgressCallback } from './actionExecutor';
import type {
  DashboardCellWithRelations,
  DashboardCellDrilldownWithQuery,
  ApiEndpoint,
  Query,
  GridTemplateCellColumnConfig,
  GridTemplateColumn,
  GridCellFormattingRules,
  GridColumnFormatting,
  ConditionalFormatting,
  ConditionalFormattingRule,
  ConditionalFormattingCondition,
  ConditionalFormattingAppearance,
  UserParameter,
  RequestBodyFieldMapping,
  DashboardCellActionWithQuery,
  ActionParameterMapping,
  ActionVisibilityCondition,
} from '../../types/database';
import { evaluateVisibilityCondition } from '../../types/database';
import { formatDateValue } from '../../lib/dateFormat';
import { formatNumberValue } from '../../lib/numberFormat';

const FILTER_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`;
const CLEAR_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const SIGMA_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 7V4H6v3l6 5-6 5v3h12v-3"/></svg>`;
const SORT_ASC_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>`;
const SORT_DESC_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5H7z"/></svg>`;

const BLANK_SENTINEL = '__@@BLANK@@__';

const columnFilterState: Map<string, Set<string>> = new Map();
const columnAllValues: Map<string, string[]> = new Map();
const columnTextFilterState: Map<string, string> = new Map();
const columnFilterModeState: Map<string, string> = new Map();
const columnCalcState: Map<string, Set<string>> = new Map();
const columnSortState: Map<string, 'none' | 'asc' | 'desc'> = new Map();
const columnCustomFilterRef: Map<string, (data: Record<string, unknown>) => boolean> = new Map();

const FILTER_MODES = [
  { id: 'contains', label: 'Contains', short: 'C' },
  { id: 'starts', label: 'Starts With', short: 'S' },
  { id: 'ends', label: 'Ends With', short: 'E' },
  { id: 'equals', label: 'Equals', short: '=' },
  { id: 'notcontains', label: 'Not Contains', short: '!C' },
  { id: 'notequals', label: 'Not Equals', short: '!=' }
];

type CalcUpdateCallback = () => void;
let calcUpdateCallbacks: CalcUpdateCallback[] = [];

function registerCalcCallback(callback: CalcUpdateCallback) {
  calcUpdateCallbacks.push(callback);
}

function unregisterCalcCallback(callback: CalcUpdateCallback) {
  calcUpdateCallbacks = calcUpdateCallbacks.filter(cb => cb !== callback);
}

function notifyCalcUpdate() {
  calcUpdateCallbacks.forEach(cb => cb());
}

function createTitleWithFilter(
  cell: Tabulator.CellComponent,
  formatterParams: Record<string, unknown>,
  _onRendered: (callback: () => void) => void
): string | HTMLElement {
  const column = cell.getColumn();
  const table = column.getTable();
  const field = column.getField();
  const title = column.getDefinition().title || field;

  const showFilterIcon = formatterParams.showFilterIcon !== false;
  const showCalculationsIcon = formatterParams.showCalculationsIcon !== false;
  const showFilterInput = formatterParams.showFilterInput !== false;

  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;width:100%;gap:4px;';

  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex;align-items:center;width:100%;gap:4px;overflow:hidden;min-width:0;';

  const titleSpan = document.createElement('span');
  titleSpan.textContent = title;
  titleSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;';
  if (formatterParams.headerFontSize) {
    titleSpan.style.fontSize = `${formatterParams.headerFontSize}px`;
  }

  const sortIndicator = document.createElement('span');
  sortIndicator.className = 'sort-indicator';
  sortIndicator.style.cssText = 'display:inline-flex;align-items:center;margin-left:2px;color:#6b7280;flex-shrink:0;';

  if (!columnSortState.has(field)) {
    columnSortState.set(field, 'none');
  }

  const updateSortIndicator = (sortState: 'none' | 'asc' | 'desc') => {
    if (sortState === 'asc') {
      sortIndicator.innerHTML = SORT_ASC_SVG;
      sortIndicator.style.color = '#2563eb';
    } else if (sortState === 'desc') {
      sortIndicator.innerHTML = SORT_DESC_SVG;
      sortIndicator.style.color = '#2563eb';
    } else {
      sortIndicator.innerHTML = '';
    }
  };

  updateSortIndicator(columnSortState.get(field) || 'none');

  const updateAllSortIndicators = () => {
    document.querySelectorAll('.sort-indicator').forEach(indicator => {
      const headerElement = indicator.closest('.tabulator-col');
      if (headerElement) {
        const colField = headerElement.getAttribute('tabulator-field');
        if (colField && colField !== field) {
          indicator.innerHTML = '';
        }
      }
    });
  };

  titleSpan.onclick = (e) => {
    e.stopPropagation();
    const currentSort = columnSortState.get(field) || 'none';
    let nextSort: 'none' | 'asc' | 'desc';
    if (currentSort === 'none') {
      nextSort = 'asc';
    } else if (currentSort === 'asc') {
      nextSort = 'desc';
    } else {
      nextSort = 'none';
    }
    columnSortState.forEach((_, key) => {
      if (key !== field) {
        columnSortState.set(key, 'none');
      }
    });
    columnSortState.set(field, nextSort);
    if (nextSort === 'none') {
      table.clearSort();
    } else {
      table.setSort(field, nextSort);
    }
    updateSortIndicator(nextSort);
    updateAllSortIndicators();
  };

  const filterIcon = document.createElement('button');
  filterIcon.className = 'filter-icon-btn';
  filterIcon.innerHTML = FILTER_ICON_SVG;
  filterIcon.style.cssText = 'padding:3px;border:none;background:transparent;cursor:pointer;color:#6b7280;border-radius:3px;display:flex;align-items:center;justify-content:center;transition:all 0.15s;flex-shrink:0;';

  const clearIcon = document.createElement('button');
  clearIcon.className = 'clear-filter-btn';
  clearIcon.innerHTML = CLEAR_ICON_SVG;
  clearIcon.style.cssText = 'padding:3px;border:none;background:transparent;cursor:pointer;color:#6b7280;border-radius:3px;display:none;align-items:center;justify-content:center;transition:all 0.15s;flex-shrink:0;';
  clearIcon.title = 'Clear filter';

  const dropdown = document.createElement('div');
  dropdown.className = 'multi-select-dropdown';
  dropdown.style.cssText = 'display:none;position:fixed;min-width:200px;background:#fff;border:1px solid #d1d5db;border-radius:4px;box-shadow:0 10px 25px rgba(0,0,0,0.15);z-index:99999;max-height:320px;display:flex;flex-direction:column;';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search...';
  searchInput.style.cssText = 'width:calc(100% - 16px);margin:8px;padding:6px 8px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;flex-shrink:0;';

  const optionsList = document.createElement('div');
  optionsList.style.cssText = 'padding:4px 0;overflow-y:auto;flex:1;';

  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display:flex;gap:8px;padding:8px;border-top:1px solid #e5e7eb;flex-shrink:0;';

  const okButton = document.createElement('button');
  okButton.textContent = 'OK';
  okButton.style.cssText = 'flex:1;padding:6px 12px;background:#2563eb;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;';

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = 'flex:1;padding:6px 12px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:4px;font-size:12px;cursor:pointer;';

  buttonRow.appendChild(okButton);
  buttonRow.appendChild(cancelButton);

  dropdown.appendChild(searchInput);
  dropdown.appendChild(optionsList);
  dropdown.appendChild(buttonRow);

  let pendingSelection: Set<string> = new Set();

  const sigmaIcon = document.createElement('button');
  sigmaIcon.className = 'sigma-icon-btn';
  sigmaIcon.innerHTML = SIGMA_ICON_SVG;
  sigmaIcon.style.cssText = 'padding:3px;border:none;background:transparent;cursor:pointer;color:#6b7280;border-radius:3px;display:flex;align-items:center;justify-content:center;transition:all 0.15s;flex-shrink:0;';
  sigmaIcon.title = 'Column calculations';

  const sigmaDropdown = document.createElement('div');
  sigmaDropdown.className = 'sigma-dropdown';
  sigmaDropdown.style.cssText = 'display:none;position:fixed;min-width:160px;background:#fff;border:1px solid #d1d5db;border-radius:4px;box-shadow:0 10px 25px rgba(0,0,0,0.15);z-index:99999;';

  const calcOptions = [
    { id: 'avg', label: 'Average' },
    { id: 'count', label: 'Count' },
    { id: 'max', label: 'Maximum' },
    { id: 'min', label: 'Minimum' },
    { id: 'sum', label: 'Sum' }
  ];

  if (!columnCalcState.has(field)) {
    columnCalcState.set(field, new Set());
  }

  function updateSigmaIcon() {
    const calcs = columnCalcState.get(field) || new Set();
    if (calcs.size > 0) {
      sigmaIcon.style.color = '#2563eb';
      sigmaIcon.style.background = '#eff6ff';
    } else {
      sigmaIcon.style.color = '#6b7280';
      sigmaIcon.style.background = 'transparent';
    }
  }

  function renderSigmaOptions() {
    sigmaDropdown.innerHTML = '';
    const calcs = columnCalcState.get(field) || new Set();

    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'padding:8px 12px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;';
    const headerLabel = document.createElement('span');
    headerLabel.innerHTML = '<strong style="font-size:12px;color:#374151;">Σ</strong> <span style="font-size:12px;color:#374151;">Select Summary</span>';
    headerDiv.appendChild(headerLabel);
    sigmaDropdown.appendChild(headerDiv);

    calcOptions.forEach(opt => {
      const optDiv = document.createElement('div');
      optDiv.style.cssText = 'padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;';
      optDiv.onmouseenter = () => optDiv.style.background = '#f3f4f6';
      optDiv.onmouseleave = () => optDiv.style.background = 'transparent';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = calcs.has(opt.id);
      checkbox.style.cssText = 'cursor:pointer;';

      const label = document.createElement('span');
      label.textContent = opt.label;
      label.style.cssText = 'font-size:12px;color:#374151;';

      optDiv.appendChild(checkbox);
      optDiv.appendChild(label);

      optDiv.onclick = (e) => {
        e.stopPropagation();
        const currentCalcs = columnCalcState.get(field) || new Set();
        if (currentCalcs.has(opt.id)) {
          currentCalcs.delete(opt.id);
        } else {
          currentCalcs.add(opt.id);
        }
        columnCalcState.set(field, currentCalcs);
        updateSigmaIcon();
        renderSigmaOptions();
        notifyCalcUpdate();
      };

      sigmaDropdown.appendChild(optDiv);
    });

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display:flex;gap:8px;padding:8px;border-top:1px solid #e5e7eb;';

    const sigmaOkButton = document.createElement('button');
    sigmaOkButton.textContent = 'OK';
    sigmaOkButton.style.cssText = 'flex:1;padding:6px 12px;background:#2563eb;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;';
    sigmaOkButton.onclick = (e) => {
      e.stopPropagation();
      hideSigmaDropdown();
      isSigmaOpen = false;
    };

    const sigmaCancelButton = document.createElement('button');
    sigmaCancelButton.textContent = 'Cancel';
    sigmaCancelButton.style.cssText = 'flex:1;padding:6px 12px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:4px;font-size:12px;cursor:pointer;';
    sigmaCancelButton.onclick = (e) => {
      e.stopPropagation();
      hideSigmaDropdown();
      isSigmaOpen = false;
    };

    buttonRow.appendChild(sigmaOkButton);
    buttonRow.appendChild(sigmaCancelButton);
    sigmaDropdown.appendChild(buttonRow);
  }

  function showSigmaDropdown() {
    renderSigmaOptions();
    const rect = sigmaIcon.getBoundingClientRect();
    sigmaDropdown.style.top = `${rect.bottom + 4}px`;
    sigmaDropdown.style.left = `${Math.max(8, rect.left - 130 + rect.width)}px`;
    sigmaDropdown.style.display = 'block';
    document.body.appendChild(sigmaDropdown);
  }

  function hideSigmaDropdown() {
    sigmaDropdown.style.display = 'none';
    if (sigmaDropdown.parentNode === document.body) {
      document.body.removeChild(sigmaDropdown);
    }
  }

  let isSigmaOpen = false;

  sigmaIcon.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isSigmaOpen) {
      showSigmaDropdown();
      isSigmaOpen = true;
    } else {
      hideSigmaDropdown();
      isSigmaOpen = false;
    }
  };

  sigmaIcon.onmouseenter = () => {
    const calcs = columnCalcState.get(field) || new Set();
    if (calcs.size === 0) {
      sigmaIcon.style.background = '#f3f4f6';
    }
  };

  sigmaIcon.onmouseleave = () => {
    const calcs = columnCalcState.get(field) || new Set();
    if (calcs.size === 0) {
      sigmaIcon.style.background = 'transparent';
    }
  };

  const sigmaClickHandler = (e: MouseEvent) => {
    const target = e.target as Node;
    if (!sigmaIcon.contains(target) && !sigmaDropdown.contains(target)) {
      hideSigmaDropdown();
      isSigmaOpen = false;
    }
  };

  document.addEventListener('click', sigmaClickHandler);

  updateSigmaIcon();

  titleRow.appendChild(titleSpan);
  titleRow.appendChild(sortIndicator);
  if (showFilterIcon) {
    titleRow.appendChild(filterIcon);
    titleRow.appendChild(clearIcon);
  }
  if (showCalculationsIcon) {
    titleRow.appendChild(sigmaIcon);
  }

  const filterRow = document.createElement('div');
  filterRow.style.cssText = 'display:flex;width:100%;gap:0;align-items:stretch;overflow:hidden;min-width:0;margin-right:-8px;';

  const modeDropdown = document.createElement('div');
  modeDropdown.style.cssText = 'position:relative;display:flex;';

  if (!columnFilterModeState.has(field)) {
    columnFilterModeState.set(field, 'contains');
  }

  const modeButton = document.createElement('button');
  const currentMode = FILTER_MODES.find(m => m.id === columnFilterModeState.get(field)) || FILTER_MODES[0];
  modeButton.textContent = currentMode.short;
  modeButton.title = currentMode.label;
  modeButton.style.cssText = 'padding:0 6px;border:1px solid #d1d5db;border-right:none;border-radius:3px 0 0 3px;font-size:11px;background:#f3f4f6;cursor:pointer;color:#374151;min-width:24px;text-align:center;font-weight:500;line-height:1;';

  const modeMenu = document.createElement('div');
  modeMenu.style.cssText = 'display:none;position:fixed;min-width:130px;background:#fff;border:1px solid #d1d5db;border-radius:4px;box-shadow:0 10px 25px rgba(0,0,0,0.15);z-index:99999;';

  FILTER_MODES.forEach(mode => {
    const modeOption = document.createElement('div');
    modeOption.style.cssText = 'padding:6px 10px;cursor:pointer;font-size:11px;color:#374151;display:flex;align-items:center;gap:6px;';
    modeOption.onmouseenter = () => modeOption.style.background = '#f3f4f6';
    modeOption.onmouseleave = () => modeOption.style.background = 'transparent';

    const modeShortSpan = document.createElement('span');
    modeShortSpan.textContent = mode.short;
    modeShortSpan.style.cssText = 'font-weight:600;min-width:20px;';

    const modeLabelSpan = document.createElement('span');
    modeLabelSpan.textContent = mode.label;

    modeOption.appendChild(modeShortSpan);
    modeOption.appendChild(modeLabelSpan);

    modeOption.onclick = (e) => {
      e.stopPropagation();
      columnFilterModeState.set(field, mode.id);
      modeButton.textContent = mode.short;
      modeButton.title = mode.label;
      modeMenu.style.display = 'none';
      isModeMenuOpen = false;
      applyFilter();
    };

    modeMenu.appendChild(modeOption);
  });

  let isModeMenuOpen = false;

  modeButton.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isModeMenuOpen) {
      const rect = modeButton.getBoundingClientRect();
      modeMenu.style.top = `${rect.bottom + 2}px`;
      modeMenu.style.left = `${rect.left}px`;
      modeMenu.style.display = 'block';
      document.body.appendChild(modeMenu);
      isModeMenuOpen = true;
    } else {
      modeMenu.style.display = 'none';
      if (modeMenu.parentNode === document.body) {
        document.body.removeChild(modeMenu);
      }
      isModeMenuOpen = false;
    }
  };

  const modeMenuClickHandler = (e: MouseEvent) => {
    const target = e.target as Node;
    if (!modeButton.contains(target) && !modeMenu.contains(target)) {
      modeMenu.style.display = 'none';
      if (modeMenu.parentNode === document.body) {
        document.body.removeChild(modeMenu);
      }
      isModeMenuOpen = false;
    }
  };

  document.addEventListener('click', modeMenuClickHandler);

  modeDropdown.appendChild(modeButton);

  const textFilterInput = document.createElement('input');
  textFilterInput.type = 'text';
  textFilterInput.placeholder = 'Type to filter...';
  textFilterInput.style.cssText = 'flex:1;padding:4px 6px;border:1px solid #d1d5db;border-radius:0 3px 3px 0;font-size:11px;background:#fff;min-width:0;';
  textFilterInput.value = columnTextFilterState.get(field) || '';

  filterRow.appendChild(modeDropdown);
  filterRow.appendChild(textFilterInput);

  container.appendChild(titleRow);
  if (showFilterInput) {
    container.appendChild(filterRow);
  }

  if (!columnFilterState.has(field)) {
    columnFilterState.set(field, new Set());
  }
  if (!columnTextFilterState.has(field)) {
    columnTextFilterState.set(field, '');
  }

  function getUniqueValues(): string[] {
    const values = new Set<string>();
    let hasBlank = false;
    const tableData = table.getData();
    tableData.forEach((row: Record<string, unknown>) => {
      const val = row[field];
      if (val === null || val === undefined || val === '') {
        hasBlank = true;
      } else {
        values.add(String(val));
      }
    });
    const sorted = Array.from(values).sort((a, b) => a.localeCompare(b));
    if (hasBlank) {
      sorted.unshift(BLANK_SENTINEL);
    }
    columnAllValues.set(field, sorted);
    return sorted;
  }

  function updateFilterIcon() {
    const selectedValues = columnFilterState.get(field) || new Set();
    const allValues = columnAllValues.get(field) || [];
    const textFilterValue = columnTextFilterState.get(field) || '';
    const hasDropdownFilter = selectedValues.size > 0 && selectedValues.size < allValues.length;
    const hasTextFilter = textFilterValue.trim().length > 0;
    const hasActiveFilter = hasDropdownFilter || hasTextFilter;
    if (hasActiveFilter) {
      filterIcon.style.color = '#2563eb';
      filterIcon.style.background = '#eff6ff';
      clearIcon.style.display = 'flex';
    } else {
      filterIcon.style.color = '#6b7280';
      filterIcon.style.background = 'transparent';
      clearIcon.style.display = 'none';
    }
  }

  function applyFilter() {
    const selectedValues = columnFilterState.get(field) || new Set();
    const allValues = columnAllValues.get(field) || [];
    const textFilterValue = columnTextFilterState.get(field) || '';
    const filterMode = columnFilterModeState.get(field) || 'contains';

    // Remove any stored row-level custom filter for this field
    const existingCustomFilter = columnCustomFilterRef.get(field);
    if (existingCustomFilter) {
      table.removeFilter(existingCustomFilter);
      columnCustomFilterRef.delete(field);
    }

    // Remove field-based filters
    const currentFilters = table.getFilters(true) as Array<{ field: string; type: string; value: unknown }>;
    currentFilters.forEach(f => {
      if (f.field === field) {
        table.removeFilter(f.field, f.type, f.value);
      }
    });

    if (selectedValues.size > 0 && selectedValues.size < allValues.length) {
      const includesBlank = selectedValues.has(BLANK_SENTINEL);
      const realValues = Array.from(selectedValues).filter(v => v !== BLANK_SENTINEL);

      if (!includesBlank && realValues.length > 0) {
        const filterFunc = (data: Record<string, unknown>) => {
          const cellValue = data[field];
          if (cellValue === null || cellValue === undefined || cellValue === '') return false;
          return realValues.includes(String(cellValue));
        };
        columnCustomFilterRef.set(field, filterFunc);
        table.addFilter(filterFunc);
      } else {
        const filterFunc = (data: Record<string, unknown>) => {
          const cellValue = data[field];
          const isBlank = cellValue === null || cellValue === undefined || cellValue === '';
          if (isBlank) return includesBlank;
          return realValues.includes(String(cellValue));
        };
        columnCustomFilterRef.set(field, filterFunc);
        table.addFilter(filterFunc);
      }
    }

    if (textFilterValue.trim()) {
      const searchTerm = textFilterValue.trim();
      switch (filterMode) {
        case 'contains':
          table.addFilter(field, 'like', searchTerm);
          break;
        case 'starts':
          table.addFilter(field, 'starts', searchTerm);
          break;
        case 'ends':
          table.addFilter(field, 'ends', searchTerm);
          break;
        case 'equals':
          table.addFilter(field, '=', searchTerm);
          break;
        case 'notcontains':
          table.addFilter(field, (data: unknown) => {
            const val = String(data ?? '').toLowerCase();
            return !val.includes(searchTerm.toLowerCase());
          });
          break;
        case 'notequals':
          table.addFilter(field, '!=', searchTerm);
          break;
        default:
          table.addFilter(field, 'like', searchTerm);
      }
    }

    updateFilterIcon();
  }

  function renderOptions(filter: string = '') {
    optionsList.innerHTML = '';
    const allValues = columnAllValues.get(field) || [];

    const selectAllDiv = document.createElement('div');
    selectAllDiv.style.cssText = 'padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e5e7eb;';
    selectAllDiv.onmouseenter = () => selectAllDiv.style.background = '#f3f4f6';
    selectAllDiv.onmouseleave = () => selectAllDiv.style.background = 'transparent';

    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.checked = pendingSelection.size === allValues.length;
    selectAllCheckbox.style.cssText = 'cursor:pointer;';

    const selectAllLabel = document.createElement('span');
    selectAllLabel.textContent = '(Select All)';
    selectAllLabel.style.cssText = 'font-size:12px;color:#374151;';

    selectAllDiv.appendChild(selectAllCheckbox);
    selectAllDiv.appendChild(selectAllLabel);

    selectAllDiv.onclick = (e) => {
      e.stopPropagation();
      if (pendingSelection.size === allValues.length) {
        pendingSelection = new Set();
      } else {
        pendingSelection = new Set(allValues);
      }
      renderOptions(filter);
    };

    optionsList.appendChild(selectAllDiv);

    const filteredValues = filter
      ? allValues.filter(v => v === BLANK_SENTINEL
          ? '(blank)'.includes(filter.toLowerCase())
          : v.toLowerCase().includes(filter.toLowerCase()))
      : allValues;

    filteredValues.forEach(value => {
      const optionDiv = document.createElement('div');
      optionDiv.style.cssText = 'padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;';
      optionDiv.onmouseenter = () => optionDiv.style.background = '#f3f4f6';
      optionDiv.onmouseleave = () => optionDiv.style.background = 'transparent';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = pendingSelection.has(value);
      checkbox.style.cssText = 'cursor:pointer;';

      const label = document.createElement('span');
      if (value === BLANK_SENTINEL) {
        label.textContent = '(Blank)';
        label.style.cssText = 'font-size:12px;color:#9ca3af;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      } else {
        label.textContent = value;
        label.style.cssText = 'font-size:12px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      }

      optionDiv.appendChild(checkbox);
      optionDiv.appendChild(label);

      optionDiv.onclick = (e) => {
        e.stopPropagation();
        if (pendingSelection.has(value)) {
          pendingSelection.delete(value);
        } else {
          pendingSelection.add(value);
        }
        renderOptions(filter);
      };

      optionsList.appendChild(optionDiv);
    });
  }

  function showDropdown() {
    getUniqueValues();
    const allValues = columnAllValues.get(field) || [];
    const currentFilter = columnFilterState.get(field) || new Set();
    if (currentFilter.size === 0) {
      pendingSelection = new Set(allValues);
    } else {
      pendingSelection = new Set(currentFilter);
    }
    renderOptions();

    const rect = filterIcon.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${Math.max(8, rect.left - 180 + rect.width)}px`;
    dropdown.style.display = 'flex';
    document.body.appendChild(dropdown);
    searchInput.value = '';
    searchInput.focus();
  }

  okButton.onclick = (e) => {
    e.stopPropagation();
    const allValues = columnAllValues.get(field) || [];
    if (pendingSelection.size === allValues.length) {
      columnFilterState.set(field, new Set());
    } else {
      columnFilterState.set(field, new Set(pendingSelection));
    }
    applyFilter();
    hideDropdown();
    isOpen = false;
  };

  cancelButton.onclick = (e) => {
    e.stopPropagation();
    hideDropdown();
    isOpen = false;
  };

  function hideDropdown() {
    dropdown.style.display = 'none';
    if (dropdown.parentNode === document.body) {
      document.body.removeChild(dropdown);
    }
  }

  let isOpen = false;

  filterIcon.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isOpen) {
      showDropdown();
      isOpen = true;
    } else {
      hideDropdown();
      isOpen = false;
    }
  };

  clearIcon.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    columnFilterState.set(field, new Set());
    columnTextFilterState.set(field, '');
    columnFilterModeState.set(field, 'contains');
    textFilterInput.value = '';
    modeButton.textContent = 'C';
    modeButton.title = 'Contains';
    // Remove stored row-level custom filter
    const existingCustomFilter = columnCustomFilterRef.get(field);
    if (existingCustomFilter) {
      table.removeFilter(existingCustomFilter);
      columnCustomFilterRef.delete(field);
    }
    // Remove field-based filters
    const currentFilters = table.getFilters(true) as Array<{ field: string; type: string; value: unknown }>;
    currentFilters.forEach(f => {
      if (f.field === field) {
        table.removeFilter(f.field, f.type, f.value);
      }
    });
    updateFilterIcon();
  };

  clearIcon.onmouseenter = () => {
    clearIcon.style.background = '#fee2e2';
    clearIcon.style.color = '#dc2626';
  };

  clearIcon.onmouseleave = () => {
    clearIcon.style.background = 'transparent';
    clearIcon.style.color = '#6b7280';
  };

  filterIcon.onmouseenter = () => {
    const selectedValues = columnFilterState.get(field) || new Set();
    const allValues = columnAllValues.get(field) || [];
    const textFilterValue = columnTextFilterState.get(field) || '';
    const hasDropdownFilter = selectedValues.size > 0 && selectedValues.size < allValues.length;
    const hasTextFilter = textFilterValue.trim().length > 0;
    if (!hasDropdownFilter && !hasTextFilter) {
      filterIcon.style.background = '#f3f4f6';
    }
  };

  filterIcon.onmouseleave = () => {
    const selectedValues = columnFilterState.get(field) || new Set();
    const allValues = columnAllValues.get(field) || [];
    const textFilterValue = columnTextFilterState.get(field) || '';
    const hasDropdownFilter = selectedValues.size > 0 && selectedValues.size < allValues.length;
    const hasTextFilter = textFilterValue.trim().length > 0;
    if (!hasDropdownFilter && !hasTextFilter) {
      filterIcon.style.background = 'transparent';
    }
  };

  textFilterInput.oninput = () => {
    columnTextFilterState.set(field, textFilterInput.value);
    applyFilter();
  };

  textFilterInput.onclick = (e) => e.stopPropagation();

  searchInput.oninput = () => {
    renderOptions(searchInput.value);
  };

  searchInput.onclick = (e) => e.stopPropagation();
  dropdown.onclick = (e) => e.stopPropagation();

  const clickHandler = (e: MouseEvent) => {
    const target = e.target as Node;
    if (!filterIcon.contains(target) && !dropdown.contains(target)) {
      hideDropdown();
      isOpen = false;
    }
  };

  document.addEventListener('click', clickHandler);

  updateFilterIcon();

  return container;
}

interface DashboardCellProps {
  cell: DashboardCellWithRelations;
  onRecordCount?: (count: number) => void;
  parameterValues?: Record<string, string>;
  activeTemplate?: GridTemplateCellColumnConfig | null;
  templateId?: string | null;
  onColumnChange?: () => void;
  onColumnsDetected?: (columns: string[]) => void;
  onDrilldownColumnsDetected?: (drilldownId: string, columns: string[]) => void;
  formattingRules?: GridCellFormattingRules;
  onGroupByChange?: (groupBy: string[]) => void;
  onActionComplete?: (actionName: string, result: { success: number; failed: number; pulseTriggered?: number; errors?: string[] }) => void;
  onPopupAction?: (title: string, template: string, rowData: Record<string, unknown>) => void;
  companyTimezone?: string;
}

export type { ActionProgressCallback };

export interface DashboardCellRef {
  getColumnConfig: () => GridTemplateCellColumnConfig;
  executeActionOnSelectedRows: (action: DashboardCellActionWithQuery, onProgress?: ActionProgressCallback) => Promise<{ success: number; failed: number; pulseTriggered: number; errors: string[] }>;
  getButtonActions: () => DashboardCellActionWithQuery[];
  getSelectedRowData: () => Record<string, unknown> | null;
  getSelectedRowsData: () => Record<string, unknown>[];
  refreshData: () => void;
  downloadCsv: (filename: string) => void;
  getCsvString: () => string;
  getSelectedRowCount: () => number;
}

interface RowData {
  [key: string]: unknown;
  _expanded?: boolean;
  _drilldownData?: Record<string, unknown[]>;
}

const substituteUserParameters = (value: string, params: Record<string, string>): string => {
  let result = value;
  Object.entries(params).forEach(([name, val]) => {
    const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, val);
  });
  return result;
};

const buildRequestBody = (
  template: string | null,
  fieldMappings: RequestBodyFieldMapping[],
  paramValues: Record<string, string>
): object | null => {
  if (!template) return null;

  try {
    const body = JSON.parse(template);

    const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown) => {
      const parts = path.split(/\.|\[(\d+)\]/).filter(Boolean);
      let current = obj;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];
        const isNextArray = /^\d+$/.test(nextPart);

        if (!(part in current)) {
          current[part] = isNextArray ? [] : {};
        }
        current = current[part] as Record<string, unknown>;
      }

      const lastPart = parts[parts.length - 1];
      current[lastPart] = value;
    };

    const convertValue = (value: string, dataType: string): unknown => {
      switch (dataType) {
        case 'integer':
          return parseInt(value, 10) || 0;
        case 'double':
          return parseFloat(value) || 0;
        case 'boolean':
          return value.toLowerCase() === 'true';
        default:
          return value;
      }
    };

    fieldMappings.forEach(mapping => {
      let resolvedValue = mapping.value;

      if (mapping.type === 'parameter' && mapping.value) {
        resolvedValue = paramValues[mapping.value] || '';
      }

      const typedValue = convertValue(resolvedValue, mapping.dataType);
      setNestedValue(body, mapping.fieldName, typedValue);
    });

    return body;
  } catch {
    console.error('[buildRequestBody] Failed to parse template:', template);
    return null;
  }
};

const substitutePathParameters = (path: string, userParams: UserParameter[], paramValues: Record<string, string>): string => {
  let result = path;
  userParams
    .filter(p => p.target === 'path')
    .forEach(param => {
      const paramName = param.name.replace(/^@/, '');
      const value = paramValues[param.name] || '';
      const pathParamRegex = new RegExp(`\\{${paramName}\\}`, 'gi');
      result = result.replace(pathParamRegex, encodeURIComponent(value));
    });
  return result;
};

const DashboardCell = forwardRef<DashboardCellRef, DashboardCellProps>(function DashboardCell(
  { cell, onRecordCount, parameterValues = {}, activeTemplate, templateId, onColumnChange, onColumnsDetected, onDrilldownColumnsDetected, formattingRules = {}, onGroupByChange, onActionComplete, onPopupAction, companyTimezone },
  ref
) {

  const tableRef = useRef<HTMLDivElement>(null);
  const tabulatorRef = useRef<Tabulator | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RowData[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [drilldownData, setDrilldownData] = useState<Record<number, Record<string, RowData[]>>>({});
  const [loadingDrilldowns, setLoadingDrilldowns] = useState<Set<string>>(new Set());
  const [endpoint, setEndpoint] = useState<ApiEndpoint | null>(null);
  const [calcUpdateTrigger, setCalcUpdateTrigger] = useState(0);
  const [drilldownAvailability, setDrilldownAvailability] = useState<Set<number>>(new Set());
  const [cellActions, setCellActions] = useState<DashboardCellActionWithQuery[]>([]);
  const { resolveLookup, resolveLookupByQueryId, getLookupState, getLookupStateByQueryId } = useLookupResolver();
  const { fixedValues } = useFixedValues();
  const [promptDialog, setPromptDialog] = useState<{
    action: DashboardCellActionWithQuery;
    mappings: ActionParameterMapping[];
    values: Record<string, string>;
    rows: Record<string, unknown>[];
    onProgress?: ActionProgressCallback;
  } | null>(null);
  const [cellProcessing, setCellProcessing] = useState<{ name: string; current: number; total: number } | null>(null);
  const drilldownTabulatorsRef = useRef<Map<string, { tabulator: Tabulator; container: HTMLElement }>>(new Map());
  const cellActionsRef = useRef(cellActions);
  cellActionsRef.current = cellActions;
  const fetchDataRef = useRef<(() => void) | null>(null);
  const onActionCompleteRef = useRef(onActionComplete);
  onActionCompleteRef.current = onActionComplete;
  const onPopupActionRef = useRef(onPopupAction);
  onPopupActionRef.current = onPopupAction;
  const onGroupByChangeRef = useRef(onGroupByChange);
  onGroupByChangeRef.current = onGroupByChange;
  const promptResolveRef = useRef<((result: { success: number; failed: number; pulseTriggered: number; errors: string[] }) => void) | null>(null);

  const expandedRowsRef = useRef(expandedRows);
  expandedRowsRef.current = expandedRows;

  const savedGroupStateRef = useRef<Map<string, boolean>>(new Map());

  const drilldownAvailabilityRef = useRef(drilldownAvailability);
  drilldownAvailabilityRef.current = drilldownAvailability;

  const drilldownDataRef = useRef(drilldownData);
  drilldownDataRef.current = drilldownData;

  const loadingDrilldownsRef = useRef(loadingDrilldowns);
  loadingDrilldownsRef.current = loadingDrilldowns;

  const activeTemplateRef = useRef(activeTemplate);
  activeTemplateRef.current = activeTemplate;

  const onColumnChangeRef = useRef(onColumnChange);
  onColumnChangeRef.current = onColumnChange;

  const onColumnsDetectedRef = useRef(onColumnsDetected);
  onColumnsDetectedRef.current = onColumnsDetected;

  const onDrilldownColumnsDetectedRef = useRef(onDrilldownColumnsDetected);
  onDrilldownColumnsDetectedRef.current = onDrilldownColumnsDetected;

  const formattingRulesRef = useRef(formattingRules);
  formattingRulesRef.current = formattingRules;
  const formattingRulesKey = JSON.stringify(formattingRules);

  useEffect(() => {
    if (!promptDialog) return;
    const lookupMappings = promptDialog.mappings.filter(m => m.target === 'lookup');
    lookupMappings.forEach(m => {
      if (m.lookupQueryId) {
        resolveLookupByQueryId(m.lookupQueryId);
      } else if (m.fixedValueId) {
        const fv = fixedValues.find(f => f.id === m.fixedValueId);
        if (fv) resolveLookup(fv);
      }
    });
  }, [promptDialog, fixedValues, resolveLookup, resolveLookupByQueryId]);

  const toggleRowRef = useRef<((rowIndex: number, rowData: RowData) => void) | null>(null);
  const columnChangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedColumnChange = useCallback(() => {
    if (columnChangeDebounceRef.current) {
      clearTimeout(columnChangeDebounceRef.current);
    }
    columnChangeDebounceRef.current = setTimeout(() => {
      onColumnChangeRef.current?.();
      columnChangeDebounceRef.current = null;
    }, 150);
  }, []);

  const handleDrilldownColumnChange = useCallback(() => {
    debouncedColumnChange();
  }, [debouncedColumnChange]);

  const renderInlineDrilldown = useCallback((rowElement: HTMLElement, rowIndex: number) => {
    const existingDrilldown = rowElement.nextElementSibling;
    if (existingDrilldown?.classList.contains('inline-drilldown-row')) {
      const drilldownKeys = Array.from(drilldownTabulatorsRef.current.keys())
        .filter(key => key.startsWith(`${rowIndex}-`));
      drilldownKeys.forEach(key => {
        const entry = drilldownTabulatorsRef.current.get(key);
        if (entry) {
          entry.tabulator.destroy();
          drilldownTabulatorsRef.current.delete(key);
        }
      });
      existingDrilldown.remove();
    }

    const rowDrilldowns = drilldownDataRef.current[rowIndex] || {};
    const drilldowns = cell.drilldowns || [];

    const drilldownContainer = document.createElement('tr');
    drilldownContainer.className = 'inline-drilldown-row';
    drilldownContainer.setAttribute('data-row-index', String(rowIndex));

    const td = document.createElement('td');
    const colCount = rowElement.querySelectorAll('td').length;
    td.colSpan = colCount;
    td.style.cssText = 'padding:0;background:#fff;border-bottom:1px solid #e5e7eb;';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:4px 8px 4px 24px;';

    let hasContent = false;
    const pendingTabulatorInits: Array<{
      container: HTMLElement;
      columns: Tabulator.ColumnDefinition[];
      data: RowData[];
      drilldownId: string;
      headerFontSize?: number;
    }> = [];

    drilldowns.forEach((drilldown: DashboardCellDrilldownWithQuery) => {
      const drillData = rowDrilldowns[drilldown.id] || [];
      const isLoading = loadingDrilldownsRef.current.has(`${rowIndex}-${drilldown.id}`);

      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom:4px;';

      if (isLoading) {
        section.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:#6b7280;font-size:13px;">
          <div style="width:14px;height:14px;border:2px solid #9ca3af;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
          Loading...
        </div>`;
        hasContent = true;
      } else if (drillData.length > 0) {
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = 'width:100%;';
        tableContainer.setAttribute('data-drilldown-id', drilldown.id);

        const currentTemplate = activeTemplateRef.current;
        const templateDrilldownConfig = currentTemplate?.drilldowns?.[drilldown.id];
        const savedConfig = templateDrilldownConfig || (drilldown.column_config as { columns: GridTemplateColumn[] } | null) || { columns: [] };
        const templateColumns = savedConfig.columns || [];
        const templateMap = new Map(templateColumns.map(tc => [tc.field, tc]));


        const keys = Object.keys(drillData[0]).filter(k => !k.startsWith('_'));
        const sortedKeys = [...keys].sort((a, b) => {
          const posA = templateMap.get(a)?.position ?? 999;
          const posB = templateMap.get(b)?.position ?? 999;
          return posA - posB;
        });

        onDrilldownColumnsDetectedRef.current?.(drilldown.id, sortedKeys);

        const drilldownFormatting = formattingRulesRef.current.drilldowns?.[drilldown.id];
        const drilldownGridFormatting = drilldownFormatting?.grid || {};
        const drilldownColumnFormattings = drilldownFormatting?.columns || {};

        const buildDrilldownCellFormatter = (field: string): Tabulator.Formatter | undefined => {
          const colFormatting = drilldownColumnFormattings[field] || {};
          const hasGridFormatting = Object.keys(drilldownGridFormatting).some(k => (drilldownGridFormatting as Record<string, unknown>)[k]);
          const hasColFormatting = Object.keys(colFormatting).some(k => (colFormatting as Record<string, unknown>)[k]);

          if (!hasGridFormatting && !hasColFormatting) return undefined;

          return (tabulatorCell: Tabulator.CellComponent): string | HTMLElement => {
            const value = tabulatorCell.getValue();
            const element = document.createElement('span');

            const merged = { ...drilldownGridFormatting, ...colFormatting };

            if (merged.numberFormat) {
              const formatted = formatNumberValue(value, merged.numberFormat);
              element.textContent = formatted !== null ? formatted : (value !== null && value !== undefined ? String(value) : '');
              if (merged.numberFormat.negativeFormat === 'red' && Number(value) < 0) {
                element.style.color = '#dc2626';
              }
            } else if (merged.dateFormat) {
              const formatted = formatDateValue(value, merged.dateFormat, companyTimezone);
              element.textContent = formatted !== null ? formatted : (value !== null && value !== undefined ? String(value) : '');
            } else {
              element.textContent = value !== null && value !== undefined ? String(value) : '';
            }

            if (merged.backgroundColor) {
              element.style.backgroundColor = merged.backgroundColor;
              element.style.display = 'block';
              element.style.padding = '4px 8px';
              element.style.margin = '-4px -8px';
            }
            if (merged.textColor) {
              element.style.color = merged.textColor;
            }
            if (merged.fontFamily) {
              element.style.fontFamily = merged.fontFamily;
            }
            if (merged.fontSize) {
              element.style.fontSize = `${merged.fontSize}px`;
            }
            if (merged.bold) {
              element.style.fontWeight = 'bold';
            }
            if (merged.italic) {
              element.style.fontStyle = 'italic';
            }
            if (merged.underline) {
              element.style.textDecoration = 'underline';
            }

            return element;
          };
        };

        const columns: Tabulator.ColumnDefinition[] = sortedKeys.map(key => {
          const tc = templateMap.get(key);
          const hasSavedWidth = tc?.width && tc.width > 0;

          const colFormatting = drilldownColumnFormattings[key] || {};
          const displayName = colFormatting.displayName || tc?.title || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const cellFormatter = buildDrilldownCellFormatter(key);

          const colDef: Tabulator.ColumnDefinition = {
            title: displayName,
            field: key,
            headerSort: true,
            formatter: cellFormatter
          };

          if (hasSavedWidth) {
            colDef.width = tc.width;
          }

          return colDef;
        });

        section.appendChild(tableContainer);
        hasContent = true;

        const hasTemplateSavedWidths = columns.some(col => col.width !== undefined);

        pendingTabulatorInits.push({
          container: tableContainer,
          columns,
          data: drillData,
          drilldownId: drilldown.id,
          headerFontSize: (drilldownGridFormatting as Record<string, unknown>).fontSize as number | undefined
        });
      }

      if (section.hasChildNodes()) {
        wrapper.appendChild(section);
      }
    });

    if (!hasContent) {
      wrapper.innerHTML = '<div style="color:#6b7280;font-size:13px;">No drilldown data available</div>';
    }

    td.appendChild(wrapper);
    drilldownContainer.appendChild(td);
    rowElement.insertAdjacentElement('afterend', drilldownContainer);

    pendingTabulatorInits.forEach(({ container, columns, data: drillData, drilldownId, headerFontSize }) => {
      const columnsForTabulator = columns.map(col => {
        const { widthGrow, widthShrink, ...rest } = col;
        if (col.width) {
        }
        return rest;
      });

      const drilldownTabulator = new Tabulator(container, {
        data: drillData,
        columns: columnsForTabulator,
        layout: 'fitData',
        movableColumns: true,
        resizableColumns: true,
        resizableColumnFit: false,
        height: 'auto',
        maxHeight: 200
      });

      drilldownTabulator.on('tableBuilt', () => {
        const cols = drilldownTabulator.getColumns();
        cols.forEach(col => {
          console.log(`  ${col.getField()}: ${col.getWidth()}px`);
        });
        if (headerFontSize) {
          container.querySelectorAll('.tabulator-col-title').forEach(el => {
            (el as HTMLElement).style.fontSize = `${headerFontSize}px`;
          });
        }
      });

      const tabulatorKey = `${rowIndex}-${drilldownId}`;
      drilldownTabulatorsRef.current.set(tabulatorKey, {
        tabulator: drilldownTabulator,
        container
      });

      drilldownTabulator.on('columnMoved', () => {
        handleDrilldownColumnChange();
      });
      drilldownTabulator.on('columnResized', () => {
        handleDrilldownColumnChange();
      });
    });
  }, [cell.drilldowns, handleDrilldownColumnChange]);

  const removeInlineDrilldown = useCallback((rowIndex: number) => {
    const drilldownKeys = Array.from(drilldownTabulatorsRef.current.keys())
      .filter(key => key.startsWith(`${rowIndex}-`));
    drilldownKeys.forEach(key => {
      const entry = drilldownTabulatorsRef.current.get(key);
      if (entry) {
        entry.tabulator.destroy();
        drilldownTabulatorsRef.current.delete(key);
      }
    });

    const existingDrilldown = document.querySelector(`.inline-drilldown-row[data-row-index="${rowIndex}"]`);
    if (existingDrilldown) {
      existingDrilldown.remove();
    }
  }, []);

  const updateInlineDrilldowns = useCallback(() => {
    if (!tabulatorRef.current) return;

    expandedRowsRef.current.forEach(rowIndex => {
      const rows = tabulatorRef.current?.getRows() || [];
      const row = rows[rowIndex];
      if (row) {
        const rowElement = row.getElement();
        renderInlineDrilldown(rowElement, rowIndex);
      }
    });
  }, [renderInlineDrilldown]);

  useEffect(() => {
    updateInlineDrilldowns();
  }, [drilldownData, loadingDrilldowns, updateInlineDrilldowns]);

  const parameterValuesRef = useRef(parameterValues);
  const parameterValuesKey = JSON.stringify(parameterValues);
  useEffect(() => {
    parameterValuesRef.current = parameterValues;
  }, [parameterValuesKey]);

  const hasDrilldowns = (cell.drilldowns?.length || 0) > 0;

  const getColumnConfig = useCallback((): GridTemplateCellColumnConfig => {
    const config: GridTemplateColumn[] = [];

    if (tabulatorRef.current && tableRef.current) {
      const columns = tabulatorRef.current.getColumns();
      const containerWidth = tableRef.current.clientWidth;

      columns.forEach((col, index) => {
        const field = col.getField();
        if (field && !field.startsWith('_')) {
          const pixelWidth = col.getWidth();
          const percentWidth = containerWidth > 0 ? Math.round((pixelWidth / containerWidth) * 100) : 0;
          config.push({
            field,
            position: index,
            width: percentWidth,
            title: col.getDefinition().title || field
          });
        }
      });
    }

    const drilldownConfigs: Record<string, { columns: GridTemplateColumn[] }> = {};
    const seenDrilldowns = new Set<string>();


    drilldownTabulatorsRef.current.forEach((entry, key) => {
      const parts = key.split('-');
      if (parts.length >= 2) {
        const drilldownId = parts.slice(1).join('-');
        if (!seenDrilldowns.has(drilldownId)) {
          seenDrilldowns.add(drilldownId);
          const drilldownColumns = entry.tabulator.getColumns();
          const containerWidth = entry.container.clientWidth || 0;
          const drilldownConfig: GridTemplateColumn[] = [];


          drilldownColumns.forEach((col, index) => {
            const field = col.getField();
            if (field && !field.startsWith('_')) {
              const pixelWidth = col.getWidth();
              drilldownConfig.push({
                field,
                position: index,
                width: pixelWidth,
                title: col.getDefinition().title || field
              });
            }
          });

          if (drilldownConfig.length > 0) {
            drilldownConfigs[drilldownId] = { columns: drilldownConfig };
          }
        }
      }
    });


    const result: GridTemplateCellColumnConfig = { columns: config };
    if (Object.keys(drilldownConfigs).length > 0) {
      result.drilldowns = drilldownConfigs;
    }

    const headerFilters: Array<{ field: string; type: string; value: unknown }> = [];
    columnFilterState.forEach((selectedValues, field) => {
      if (selectedValues.size > 0) {
        headerFilters.push({ field, type: 'in', value: Array.from(selectedValues) });
      }
    });
    columnTextFilterState.forEach((textValue, field) => {
      if (textValue.trim()) {
        const mode = columnFilterModeState.get(field) || 'contains';
        headerFilters.push({ field, type: mode, value: textValue.trim() });
      }
    });
    if (headerFilters.length > 0) {
      result.headerFilters = headerFilters;
    }

    return result;
  }, []);

  useEffect(() => {
    const callback = () => setCalcUpdateTrigger(prev => prev + 1);
    registerCalcCallback(callback);
    return () => unregisterCalcCallback(callback);
  }, []);

  const fetchEndpoint = useCallback(async (endpointId: string) => {
    const { data } = await supabase
      .from('api_endpoints')
      .select('*')
      .eq('id', endpointId)
      .maybeSingle();
    return data;
  }, []);

  const executeQuery = useCallback(async (
    query: Query,
    linkValue?: string,
    linkField?: string,
    parameterMappings?: Record<string, string>,
    rowData?: Record<string, unknown>
  ) => {
    const currentParams = { ...parameterValuesRef.current };

    if (parameterMappings && rowData) {
      Object.entries(parameterMappings).forEach(([paramName, fieldName]) => {
        if (fieldName && rowData[fieldName] !== undefined) {
          currentParams[`@${paramName}`] = String(rowData[fieldName]);
        }
      });
    }

    if (linkField && linkValue) {
      const userParams = (query.user_parameters as UserParameter[]) || [];
      const linkFieldLower = linkField.toLowerCase();
      const matchedParam = userParams.find(
        p => p.name.replace(/^@/, '').toLowerCase() === linkFieldLower
      );
      if (matchedParam) {
        currentParams[matchedParam.name] = linkValue;
      } else if (userParams.length === 1) {
        currentParams[userParams[0].name] = linkValue;
      }
    }


    const endpointId = query.api_endpoint_id;
    if (!endpointId) {
      return [];
    }

    const ep = await fetchEndpoint(endpointId);
    if (!ep) {
      return [];
    }

    // NodalConnect SQL/SP execution path
    if (query.query_type === 'sql' || query.query_type === 'stored_procedure') {
      const ncHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(ep.headers as Record<string, string> || {})
      };

      if (ep.auth_type === 'bearer') {
        const config = ep.auth_config as { token?: string };
        if (config?.token) ncHeaders['Authorization'] = `Bearer ${config.token}`;
      } else if (ep.auth_type === 'api_key') {
        const config = ep.auth_config as { header_name?: string; api_key?: string };
        if (config?.header_name && config?.api_key) ncHeaders[config.header_name] = config.api_key;
      } else if (ep.auth_type === 'basic') {
        const config = ep.auth_config as { username?: string; password?: string };
        if (config?.username && config?.password) ncHeaders['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
      }

      const ncUrl = `${ep.url.replace(/\/$/, '')}/executables/run`;
      const inputs: Record<string, string> = {};
      Object.entries(currentParams).forEach(([key, val]) => {
        inputs[key.replace(/^@/, '')] = val;
      });

      const ncBody = { name: query.name, inputs };

      const ncResponse = await proxyFetch(ncUrl, {
        method: 'POST',
        headers: ncHeaders,
        body: JSON.stringify(ncBody)
      });

      if (!ncResponse.ok) {
        const errorBody = await ncResponse.json().catch(() => ({}));
        console.error('[DashboardCell] NC API error:', ncResponse.status, errorBody);
        throw new Error(`NodalConnect request failed: ${ncResponse.status}`);
      }

      const ncResult = await ncResponse.json();

      const rows = ncResult?.result?.rows || ncResult?.rows || (Array.isArray(ncResult) ? ncResult : []);
      if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
        const cols = Array.from(new Set((rows as Record<string, unknown>[]).slice(0, 20).flatMap(r => Object.keys(r))));
        if (cols.length > 0) {
          supabase.from('queries').update({ last_known_columns: cols }).eq('id', query.id).then(() => {});
        }
      }

      return Array.isArray(rows) ? rows : [ncResult];
    }

    const baseUrl = ep.url.replace(/\/$/, '');
    const userParams = (query.user_parameters as UserParameter[]) || [];
    const substitutedSubPath = substitutePathParameters(query.api_sub_path, userParams, currentParams);
    const normalizedSubPath = substitutedSubPath.replace(/^\//, '').replace(/\/$/, '');
    let url = normalizedSubPath ? `${baseUrl}/${normalizedSubPath}` : baseUrl;

    const queryParams = query.query_parameters as Array<{ key: string; value: string; enabled: boolean }> | null;
    const enabledParams = queryParams?.filter(p => p.enabled && p.value);

    let queryString = '';
    if (enabledParams && enabledParams.length > 0) {
      queryString = enabledParams
        .map(p => {
          const substitutedValue = substituteUserParameters(p.value, currentParams);
          return `${encodeURIComponent(p.key)}=${encodeURIComponent(substitutedValue)}`;
        })
        .join('&');
    } else if (query.url_query_string) {
      queryString = substituteUserParameters(query.url_query_string, currentParams);
    }

    if (linkValue && linkField) {
      const linkParam = `${linkField}=${encodeURIComponent(linkValue)}`;
      queryString = queryString ? `${queryString}&${linkParam}` : linkParam;
    }
    if (queryString) {
      url += `?${queryString}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(ep.headers as Record<string, string> || {})
    };

    if (ep.auth_type === 'bearer') {
      const config = ep.auth_config as { token?: string };
      if (config?.token) {
        headers['Authorization'] = `Bearer ${config.token}`;
      }
    } else if (ep.auth_type === 'api_key') {
      const config = ep.auth_config as { header_name?: string; api_key?: string };
      if (config?.header_name && config?.api_key) {
        headers[config.header_name] = config.api_key;
      }
    } else if (ep.auth_type === 'basic') {
      const config = ep.auth_config as { username?: string; password?: string };
      if (config?.username && config?.password) {
        headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
      }
    }

    const fetchOptions: RequestInit = { method: query.http_method, headers };

    if (['POST', 'PUT', 'PATCH'].includes(query.http_method)) {
      const fieldMappings = (query.request_body_field_mappings as RequestBodyFieldMapping[]) || [];
      const requestBody = buildRequestBody(query.request_body_template, fieldMappings, currentParams);
      if (requestBody) {
        fetchOptions.body = JSON.stringify(requestBody);
      }
    }

    const response = await proxyFetch(url, {
      method: query.http_method,
      headers,
      body: fetchOptions.body as string | undefined,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('[DashboardCell] API error:', response.status, errorBody);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (Array.isArray(result)) {
      return result;
    }
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    if (result.results && Array.isArray(result.results)) {
      return result.results;
    }
    if (result.items && Array.isArray(result.items)) {
      return result.items;
    }
    if (result.value && Array.isArray(result.value)) {
      return result.value;
    }
    const arrayProp = Object.keys(result).find(key => Array.isArray(result[key]));
    if (arrayProp) {
      return result[arrayProp];
    }
    return [result];
  }, [fetchEndpoint]);

  const checkDrilldownExistence = useCallback(async (parentData: RowData[]) => {
    if (!cell.drilldowns || cell.drilldowns.length === 0 || parentData.length === 0) {
      setDrilldownAvailability(new Set());
      return;
    }

    const rowsWithDrilldowns = new Set<number>();

    for (const drilldown of cell.drilldowns) {
      const query = drilldown.queries;
      if (!query) continue;

      const paramMappings = (drilldown.parameter_mappings as Record<string, string>) || {};
      const mappedField = Object.values(paramMappings)[0] || drilldown.link_field;

      if (!mappedField) {
        continue;
      }


      for (let rowIndex = 0; rowIndex < parentData.length; rowIndex++) {
        const rowData = parentData[rowIndex];
        const fieldValue = rowData[mappedField];

        if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
          continue;
        }

        const trimmedValue = String(fieldValue).trim();
        if (!trimmedValue) continue;

        try {
          const result = await executeQuery(
            query,
            drilldown.link_field ? trimmedValue : undefined,
            drilldown.link_field,
            paramMappings,
            rowData as Record<string, unknown>
          );

          if (result && result.length > 0) {
            rowsWithDrilldowns.add(rowIndex);
          }
        } catch (err) {
        }
      }
    }

    setDrilldownAvailability(rowsWithDrilldowns);
  }, [cell.drilldowns, executeQuery]);

  const fetchData = useCallback(async () => {
    const query = cell.queries;
    if (!query) {
      setError('No query configured');
      return;
    }

    // Proactively save group expansion state before async fetch
    // so it's available when setData triggers Tabulator rebuild
    if (tabulatorRef.current) {
      try {
        const groups = tabulatorRef.current.getGroups?.();
        if (groups && groups.length > 0) {
          savedGroupStateRef.current.clear();
          const saveState = (groupList: Tabulator.GroupComponent[]) => {
            groupList.forEach((g: Tabulator.GroupComponent) => {
              const key = String(g.getKey());
              savedGroupStateRef.current.set(key, g.isVisible());
              const subGroups = g.getSubGroups?.();
              if (subGroups && subGroups.length > 0) saveState(subGroups);
            });
          };
          saveState(groups);
        }
      } catch {
        // Tabulator may be in inconsistent state
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await executeQuery(query);
      setData(result);
      onRecordCount?.(result.length);

      if (result.length > 0 && cell.id) {
        const columns = Object.keys(result[0]).filter(k => !k.startsWith('_'));
        supabase
          .from('dashboard_cells')
          .update({ last_known_columns: columns })
          .eq('id', cell.id)
          .then(() => {});
      }

      if (query.api_endpoint_id) {
        const ep = await fetchEndpoint(query.api_endpoint_id);
        setEndpoint(ep);
      }

      if (cell.drilldowns && cell.drilldowns.length > 0) {
        if (cell.check_drilldown_existence) {
          checkDrilldownExistence(result);
        } else {
          const allRowIndices = new Set<number>(result.map((_, idx) => idx));
          setDrilldownAvailability(allRowIndices);
        }
      }
    } catch (err) {
      console.error('[DashboardCell] fetchData error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [cell.queries, cell.drilldowns, executeQuery, fetchEndpoint, checkDrilldownExistence]);

  fetchDataRef.current = fetchData;

  const initialFetchDone = useRef(false);

  useEffect(() => {
    fetchData();
    initialFetchDone.current = true;
  }, [fetchData]);

  useEffect(() => {
    if (initialFetchDone.current) {
      fetchData();
    }
  }, [parameterValuesKey]);

  useEffect(() => {
    const loadActions = async () => {
      if (!cell.id) return;
      const { data: actions } = await supabase
        .from('dashboard_cell_actions')
        .select(`
          *,
          queries (id, name, query_type, purpose_type, api_endpoint_id, api_sub_path, http_method, query_parameters, url_query_string, json_parameters, user_parameters, request_body_template, request_body_field_mappings)
        `)
        .eq('cell_id', cell.id)
        .order('sort_order');
      setCellActions((actions || []) as DashboardCellActionWithQuery[]);
    };
    loadActions();
  }, [cell.id]);

  const executeActionOnSelectedRows = useCallback(async (
    action: DashboardCellActionWithQuery,
    onProgress?: ActionProgressCallback
  ): Promise<{ success: number; failed: number; pulseTriggered: number; errors: string[] }> => {
    let rows: Record<string, unknown>[] = [];

    if (cell.enable_row_selection && tabulatorRef.current) {
      const selectedRows = tabulatorRef.current.getSelectedRows();
      if (selectedRows.length > 0) {
        rows = selectedRows.map((r: { getData: () => Record<string, unknown> }) => r.getData());
      }
    }

    if (rows.length === 0) {
      return { success: 0, failed: 0, pulseTriggered: 0, errors: [] };
    }

    const prompts = getPromptMappings(action);
    const fvListMappings = getFixedValueListMappings(action, fixedValues);
    const allPromptMappings = [...prompts, ...fvListMappings];
    if (allPromptMappings.length > 0) {
      return new Promise((resolve) => {
        setPromptDialog({
          action,
          mappings: allPromptMappings,
          values: Object.fromEntries(allPromptMappings.map(p => [p.parameterName, ''])),
          rows,
          onProgress,
        });
        promptResolveRef.current = resolve;
      });
    }

    const result = await executeActionForRows(action, rows, onProgress, undefined, fixedValues);

    if (action.refresh_after_execute) {
      fetchData();
    }

    return result;
  }, [cell.enable_row_selection, fetchData]);

  useImperativeHandle(ref, () => ({
    getColumnConfig,
    executeActionOnSelectedRows,
    getButtonActions: () => cellActionsRef.current.filter(a => a.display_mode === 'button' || a.display_mode === 'both'),
    getSelectedRowData: () => {
      if (!tabulatorRef.current) return null;
      const selectedRows = tabulatorRef.current.getSelectedRows();
      if (selectedRows.length === 1) {
        return selectedRows[0].getData() as Record<string, unknown>;
      }
      return null;
    },
    getSelectedRowsData: () => {
      if (!tabulatorRef.current) return [];
      return tabulatorRef.current.getSelectedRows().map((r: { getData: () => Record<string, unknown> }) => r.getData());
    },
    refreshData: fetchData,
    downloadCsv: (filename: string) => {
      if (!tabulatorRef.current) return;
      const selectedRows = tabulatorRef.current.getSelectedRows();
      if (selectedRows.length > 0) {
        const columns = tabulatorRef.current.getColumns();
        const fields = columns.map(c => c.getField()).filter(Boolean);
        const titles = columns.map(c => c.getDefinition().title || c.getField()).filter((_, i) => fields[i]);
        const rows = selectedRows.map(r => r.getData());
        const escape = (val: unknown) => {
          const str = val == null ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"` : str;
        };
        const lines = [titles.map(escape).join(',')];
        rows.forEach(row => {
          lines.push(fields.map(f => escape(row[f])).join(','));
        });
        const csvStr = lines.join('\r\n');
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        tabulatorRef.current.download('csv', filename);
      }
    },
    getCsvString: () => {
      if (!tabulatorRef.current) return '';
      const columns = tabulatorRef.current.getColumns();
      const fields = columns.map(c => c.getField()).filter(Boolean);
      const titles = columns.map(c => c.getDefinition().title || c.getField()).filter((_, i) => fields[i]);
      const selectedRows = tabulatorRef.current.getSelectedRows();
      const rows = selectedRows.length > 0
        ? selectedRows.map(r => r.getData())
        : tabulatorRef.current.getData();
      const escape = (val: unknown) => {
        const str = val == null ? '' : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      };
      const lines = [titles.map(escape).join(',')];
      rows.forEach(row => {
        lines.push(fields.map(f => escape(row[f])).join(','));
      });
      return lines.join('\r\n');
    },
    getSelectedRowCount: () => {
      if (!tabulatorRef.current) return 0;
      return tabulatorRef.current.getSelectedRows().length;
    },
  }), [getColumnConfig, executeActionOnSelectedRows, fetchData]);

  const fetchDrilldown = useCallback(async (
    rowIndex: number,
    drilldownId: string,
    query: Query,
    linkField: string,
    linkValue: string,
    parameterMappings: Record<string, string>,
    rowData: Record<string, unknown>
  ) => {
    const key = `${rowIndex}-${drilldownId}`;
    setLoadingDrilldowns(prev => new Set(prev).add(key));

    try {
      const result = await executeQuery(query, linkValue, linkField, parameterMappings, rowData);
      setDrilldownData(prev => ({
        ...prev,
        [rowIndex]: {
          ...(prev[rowIndex] || {}),
          [drilldownId]: result
        }
      }));
    } catch (err) {
      console.error('Failed to fetch drilldown:', err);
    } finally {
      setLoadingDrilldowns(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [executeQuery]);

  const toggleRow = useCallback((rowIndex: number, rowData: RowData) => {
    const isExpanded = expandedRows.has(rowIndex);

    if (isExpanded) {
      removeInlineDrilldown(rowIndex);
      setExpandedRows(prev => {
        const next = new Set(prev);
        next.delete(rowIndex);
        return next;
      });
    } else {
      setExpandedRows(prev => new Set(prev).add(rowIndex));

      if (tabulatorRef.current) {
        const rows = tabulatorRef.current.getRows();
        const row = rows[rowIndex];
        if (row) {
          renderInlineDrilldown(row.getElement(), rowIndex);
        }
      }

      cell.drilldowns?.forEach(drilldown => {
        const query = drilldown.queries;
        if (query) {
          const paramMappings = (drilldown.parameter_mappings as Record<string, string>) || {};
          const hasParamMappings = Object.keys(paramMappings).length > 0;
          const linkValue = drilldown.link_field ? String(rowData[drilldown.link_field] || '') : '';

          if (hasParamMappings || (drilldown.link_field && linkValue)) {
            fetchDrilldown(
              rowIndex,
              drilldown.id,
              query,
              drilldown.link_field,
              linkValue,
              paramMappings,
              rowData as Record<string, unknown>
            );
          }
        }
      });
    }
  }, [expandedRows, cell.drilldowns, fetchDrilldown, removeInlineDrilldown, renderInlineDrilldown]);

  toggleRowRef.current = toggleRow;

  useEffect(() => {

    if (!tableRef.current || data.length === 0) {
      return;
    }

    if (tabulatorRef.current) {
      tabulatorRef.current.destroy();
    }

    columnFilterState.clear();
    columnAllValues.clear();
    columnTextFilterState.clear();
    columnFilterModeState.clear();
    columnCalcState.clear();
    setExpandedRows(new Set());

    const savedFilters = activeTemplateRef.current?.headerFilters;
    if (savedFilters && savedFilters.length > 0) {
      savedFilters.forEach(f => {
        if (f.type === 'in' && Array.isArray(f.value)) {
          columnFilterState.set(f.field, new Set(f.value as string[]));
        } else if (typeof f.value === 'string' && f.value.trim()) {
          columnTextFilterState.set(f.field, f.value);
          columnFilterModeState.set(f.field, f.type);
        }
      });
    }

    const firstRow = data[0];
    const columns: Tabulator.ColumnDefinition[] = [];

    if (cell.enable_row_selection) {
      columns.push({
        title: '',
        field: '_rowSelect',
        width: 40,
        headerSort: false,
        hozAlign: 'center',
        formatter: 'rowSelection',
        titleFormatter: 'rowSelection',
        headerHozAlign: 'center'
      });
    }

    if (hasDrilldowns) {
      columns.push({
        title: '',
        field: '_expand',
        width: 40,
        headerSort: false,
        hozAlign: 'center',
        formatter: (tabulatorCell) => {
          const rowIndex = tabulatorCell.getRow().getPosition() - 1;
          const hasDrilldownData = drilldownAvailabilityRef.current.has(rowIndex);

          if (!hasDrilldownData) {
            return '<span class="w-4 h-4 inline-block"></span>';
          }

          const isExpanded = expandedRowsRef.current.has(rowIndex);
          return `<button class="expand-btn p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" data-row="${rowIndex}">
            ${isExpanded
              ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>'
              : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>'
            }
          </button>`;
        },
        cellClick: (_e, tabulatorCell) => {
          const rowIndex = tabulatorCell.getRow().getPosition() - 1;
          const hasDrilldownData = drilldownAvailabilityRef.current.has(rowIndex);

          if (!hasDrilldownData) {
            return;
          }

          const rowData = tabulatorCell.getRow().getData() as RowData;
          toggleRowRef.current?.(rowIndex, rowData);
          setTimeout(() => {
            try {
              if (tabulatorRef.current) {
                tabulatorCell.getRow().reformat();
              }
            } catch {
              // Tabulator may have been destroyed
            }
          }, 0);
        }
      });
    }

    const currentTemplate = activeTemplateRef.current;
    const templateColumns = currentTemplate?.columns || [];
    const templateMap = new Map(templateColumns.map(tc => [tc.field, tc]));

    const currentFormattingRules = formattingRulesRef.current;
    const savedColumnOrder = currentFormattingRules.columnOrder;

    const dataColumns: { key: string; position: number }[] = [];
    Object.keys(firstRow).forEach(key => {
      if (!key.startsWith('_')) {
        let position: number;
        if (savedColumnOrder) {
          const orderIndex = savedColumnOrder.indexOf(key);
          position = orderIndex >= 0 ? orderIndex : 999;
        } else {
          const tc = templateMap.get(key);
          position = tc?.position ?? 999;
        }
        dataColumns.push({ key, position });
      }
    });

    dataColumns.sort((a, b) => a.position - b.position);

    const hiddenColumns = currentFormattingRules.hiddenColumns || [];
    const visibleColumns = dataColumns.filter(({ key }) => !hiddenColumns.includes(key));

    const detectedColumns = visibleColumns.map(({ key }) => key);
    onColumnsDetectedRef.current?.(detectedColumns);

    const gridFormatting = currentFormattingRules.grid || {};
    const columnFormattings = currentFormattingRules.columns || {};
    const conditionalFormatting = currentFormattingRules.conditionalFormatting || [];
    const showFilterIcon = currentFormattingRules.showFilterIcon !== false;
    const showCalculationsIcon = currentFormattingRules.showCalculationsIcon !== false;
    const showFilterInput = currentFormattingRules.showFilterInput !== false;

    const evaluateCondition = (condition: ConditionalFormattingCondition, rowData: Record<string, unknown>): boolean => {
      const cellValue = rowData[condition.column];
      const compareValue = condition.value;

      if (condition.comparison === 'Is Null or Empty') {
        return cellValue === null || cellValue === undefined || cellValue === '';
      }

      const strCellValue = String(cellValue ?? '').trim();
      const strCompareValue = String(compareValue ?? '').trim();

      const isNumericComparison = ['Integer', 'Integer (Fixed)', 'Double', 'Double (Fixed)'].includes(condition.dataType);

      if (isNumericComparison) {
        const numCell = parseFloat(strCellValue);
        const numCompare = parseFloat(strCompareValue);
        if (isNaN(numCell) || isNaN(numCompare)) return false;

        switch (condition.comparison) {
          case 'Equals': return numCell === numCompare;
          case 'Not Equals': return numCell !== numCompare;
          case 'Greater Than': return numCell > numCompare;
          case 'Greater Than or Equal': return numCell >= numCompare;
          case 'Less Than': return numCell < numCompare;
          case 'Less Than or Equal': return numCell <= numCompare;
          default: return false;
        }
      }

      const isDateComparison = ['Date', 'Date (Fixed)'].includes(condition.dataType);
      if (isDateComparison) {
        const dateCell = new Date(strCellValue).getTime();
        const dateCompare = new Date(strCompareValue).getTime();
        if (isNaN(dateCell) || isNaN(dateCompare)) return false;

        switch (condition.comparison) {
          case 'Equals': return dateCell === dateCompare;
          case 'Not Equals': return dateCell !== dateCompare;
          case 'Greater Than': return dateCell > dateCompare;
          case 'Greater Than or Equal': return dateCell >= dateCompare;
          case 'Less Than': return dateCell < dateCompare;
          case 'Less Than or Equal': return dateCell <= dateCompare;
          default: return false;
        }
      }

      const lowerCell = strCellValue.toLowerCase();
      const lowerCompare = strCompareValue.toLowerCase();

      switch (condition.comparison) {
        case 'Equals': return lowerCell === lowerCompare;
        case 'Not Equals': return lowerCell !== lowerCompare;
        case 'Contains': return lowerCell.includes(lowerCompare);
        case 'Not Contains': return !lowerCell.includes(lowerCompare);
        case 'Starts With': return lowerCell.startsWith(lowerCompare);
        case 'Doesnt Start With': return !lowerCell.startsWith(lowerCompare);
        case 'Is Like': {
          const pattern = lowerCompare.replace(/%/g, '.*').replace(/_/g, '.');
          return new RegExp(`^${pattern}$`).test(lowerCell);
        }
        case 'Is Not Like': {
          const pattern = lowerCompare.replace(/%/g, '.*').replace(/_/g, '.');
          return !new RegExp(`^${pattern}$`).test(lowerCell);
        }
        default: return false;
      }
    };

    const evaluateRule = (rule: ConditionalFormattingRule, rowData: Record<string, unknown>): boolean => {
      if (!rule.enabled || rule.conditions.length === 0) return false;

      if (rule.conditionType === 'AND') {
        return rule.conditions.every(c => evaluateCondition(c, rowData));
      } else {
        return rule.conditions.some(c => evaluateCondition(c, rowData));
      }
    };

    const findMatchingRule = (target: string, rowData: Record<string, unknown>): ConditionalFormattingRule | null => {
      const targetFormatting = conditionalFormatting.find(cf => cf.target === target);
      if (!targetFormatting) return null;

      const sortedRules = [...targetFormatting.rules].sort((a, b) => a.sequence - b.sequence);
      for (const rule of sortedRules) {
        if (evaluateRule(rule, rowData)) {
          return rule;
        }
      }
      return null;
    };

    const applyFormattingToElement = (element: HTMLElement, cellElement: HTMLElement, formatting: ConditionalFormattingAppearance) => {
      if (formatting.backgroundColor) {
        cellElement.style.backgroundColor = formatting.backgroundColor;
      }
      if (formatting.textColor) {
        element.style.color = formatting.textColor;
      }
      if (formatting.fontFamily) {
        element.style.fontFamily = formatting.fontFamily;
      }
      if (formatting.fontSize) {
        element.style.fontSize = `${formatting.fontSize}px`;
      }
      if (formatting.bold) {
        element.style.fontWeight = 'bold';
      }
      if (formatting.italic) {
        element.style.fontStyle = 'italic';
      }
      if (formatting.underline) {
        element.style.textDecoration = 'underline';
      }
      if (formatting.blinking?.enabled) {
        cellElement.classList.add(`blink-${formatting.blinking.speed}`);
      }
    };

    const buildCellFormatter = (field: string): Tabulator.Formatter | undefined => {
      const colFormatting = columnFormattings[field] || {};
      const hasGridFormatting = Object.keys(gridFormatting).some(k => gridFormatting[k as keyof GridColumnFormatting]);
      const hasColFormatting = Object.keys(colFormatting).some(k => colFormatting[k as keyof GridColumnFormatting]);
      const hasConditional = conditionalFormatting.length > 0;

      if (!hasGridFormatting && !hasColFormatting && !hasConditional) return undefined;

      return (tabulatorCell: Tabulator.CellComponent): string | HTMLElement => {
        const value = tabulatorCell.getValue();
        const rowData = tabulatorCell.getRow().getData() as Record<string, unknown>;
        const element = document.createElement('span');
        const cellElement = tabulatorCell.getElement();

        const merged: GridColumnFormatting = { ...gridFormatting, ...colFormatting };

        if (merged.numberFormat) {
          const formatted = formatNumberValue(value, merged.numberFormat);
          element.textContent = formatted !== null ? formatted : (value !== null && value !== undefined ? String(value) : '');
          if (merged.numberFormat.negativeFormat === 'red' && Number(value) < 0) {
            element.style.color = '#dc2626';
          }
        } else if (merged.dateFormat) {
          const formatted = formatDateValue(value, merged.dateFormat, companyTimezone);
          element.textContent = formatted !== null ? formatted : (value !== null && value !== undefined ? String(value) : '');
        } else {
          element.textContent = value !== null && value !== undefined ? String(value) : '';
        }

        if (merged.backgroundColor) {
          cellElement.style.backgroundColor = merged.backgroundColor;
        }
        if (merged.textColor) {
          element.style.color = merged.textColor;
        }
        if (merged.fontFamily) {
          element.style.fontFamily = merged.fontFamily;
        }
        if (merged.fontSize) {
          element.style.fontSize = `${merged.fontSize}px`;
        }
        if (merged.bold) {
          element.style.fontWeight = 'bold';
        }
        if (merged.italic) {
          element.style.fontStyle = 'italic';
        }
        if (merged.underline) {
          element.style.textDecoration = 'underline';
        }

        const gridRule = findMatchingRule('grid', rowData);
        if (gridRule) {
          applyFormattingToElement(element, cellElement, gridRule.formatting);
        }

        const fieldRule = findMatchingRule(field, rowData);
        if (fieldRule) {
          applyFormattingToElement(element, cellElement, fieldRule.formatting);
        }

        return element;
      };
    };

    const buildContextMenu = (_e: Event, cellComponent: Tabulator.CellComponent): Tabulator.MenuObject<Tabulator.CellComponent>[] => {
      const rowData = cellComponent.getRow().getData() as Record<string, unknown>;
      const cellContextMenu: Tabulator.MenuObject<Tabulator.CellComponent>[] = [
      {
        label: 'Copy Cell Value',
        action: (_e, cellComponent) => {
          const value = cellComponent.getValue();
          const text = value !== null && value !== undefined ? String(value) : '';
          navigator.clipboard.writeText(text);
        }
      },
      {
        label: 'Copy Row',
        action: (_e, cellComponent) => {
          const rd = cellComponent.getRow().getData() as Record<string, unknown>;
          const values = Object.entries(rd)
            .filter(([k]) => !k.startsWith('_'))
            .map(([, v]) => v !== null && v !== undefined ? String(v) : '')
            .join('\t');
          navigator.clipboard.writeText(values);
        }
      },
      { separator: true },
      {
        label: 'Copy Column',
        action: (_e, cellComponent) => {
          const field = cellComponent.getField();
          const tableData = cellComponent.getTable().getData() as Record<string, unknown>[];
          const values = tableData
            .map(row => row[field])
            .filter(v => v !== null && v !== undefined)
            .map(v => String(v))
            .join('\n');
          navigator.clipboard.writeText(values);
        }
      },
      { separator: true },
      {
        label: '<span style="font-weight:500;color:#0369a1;">Group by this column</span>',
        action: (_e, cellComponent) => {
          const field = cellComponent.getField();
          const currentGroupBy = formattingRulesRef.current.groupBy || [];
          if (!currentGroupBy.includes(field)) {
            onGroupByChangeRef.current?.([...currentGroupBy, field]);
          }
        }
      },
      {
        label: '<span style="color:#dc2626;">Clear grouping</span>',
        action: () => {
          onGroupByChangeRef.current?.([]);
        }
      }
    ];

    const contextMenuActions = cellActionsRef.current.filter(a => a.display_mode === 'context_menu' || a.display_mode === 'both');
    if (contextMenuActions.length > 0) {
      const executeActionFromMenu = async (action: DashboardCellActionWithQuery, cellComp: Tabulator.CellComponent) => {
        if (action.action_type === 'popup') {
          const rd = cellComp.getRow().getData() as Record<string, unknown>;
          const template = (typeof action.popup_template === 'string' ? action.popup_template : '') || '';
          onPopupActionRef.current?.(action.display_name, template, rd);
          return;
        }

        if (action.action_type === 'link') {
          const rd = cellComp.getRow().getData() as Record<string, unknown>;
          const prompts = getPromptMappings(action);
          const fvListMappings = getFixedValueListMappings(action, fixedValues);
          const allPromptMappings = [...prompts, ...fvListMappings];
          if (allPromptMappings.length > 0) {
            setPromptDialog({
              action,
              mappings: allPromptMappings,
              values: Object.fromEntries(allPromptMappings.map(p => [p.parameterName, ''])),
              rows: [rd],
            });
            promptResolveRef.current = () => {};
            return;
          }
          executeLinkAction(action, rd, undefined, fixedValues);
          return;
        }

        const clickedRow = cellComp.getRow().getData() as Record<string, unknown>;
        let rows: Record<string, unknown>[] = [];

        if (cell.enable_row_selection && tabulatorRef.current) {
          const selectedRows = tabulatorRef.current.getSelectedRows();
          if (selectedRows.length > 1) {
            rows = selectedRows.map((r: { getData: () => Record<string, unknown> }) => r.getData());
          }
        }

        if (rows.length === 0) {
          rows = [clickedRow];
        }

        const prompts = getPromptMappings(action);
        const fvListMappings = getFixedValueListMappings(action, fixedValues);
        const allPromptMappings = [...prompts, ...fvListMappings];
        if (allPromptMappings.length > 0) {
          setPromptDialog({
            action,
            mappings: allPromptMappings,
            values: Object.fromEntries(allPromptMappings.map(p => [p.parameterName, ''])),
            rows,
          });
          promptResolveRef.current = (result) => {
            onActionCompleteRef.current?.(action.display_name, result);
          };
          return;
        }

        setCellProcessing({ name: action.display_name, current: 0, total: rows.length });
        const result = await executeActionForRows(action, rows, (current, total) => {
          setCellProcessing({ name: action.display_name, current, total });
        }, undefined, fixedValues);
        setCellProcessing(null);

        if (action.refresh_after_execute) {
          fetchDataRef.current?.();
        }

        onActionCompleteRef.current?.(action.display_name, result);
      };

      const visibleActions = contextMenuActions.filter(a =>
        evaluateVisibilityCondition(a.visibility_condition as ActionVisibilityCondition | null, rowData)
      );

      if (visibleActions.length > 0) {
        cellContextMenu.push({ separator: true } as Tabulator.MenuObject<Tabulator.CellComponent>);

        const executeActions = visibleActions.filter(a => a.action_type === 'execute');
        const popupActions = visibleActions.filter(a => a.action_type === 'popup');
        const linkActions = visibleActions.filter(a => a.action_type === 'link');

      if (executeActions.length > 0) {
        if (executeActions.length === 1) {
          const action = executeActions[0];
          cellContextMenu.push({
            label: `<span style="font-weight:500;color:#d97706;">&#9889; ${action.display_name}</span>`,
            action: (_e, cellComponent) => {
              executeActionFromMenu(action, cellComponent);
            }
          } as Tabulator.MenuObject<Tabulator.CellComponent>);
        } else {
          const subMenu = executeActions.map(action => ({
            label: `<span style="color:#d97706;">&#9889; ${action.display_name}</span>`,
            action: (_e: Event, cellComponent: Tabulator.CellComponent) => {
              executeActionFromMenu(action, cellComponent);
            }
          }));
          cellContextMenu.push({
            label: '<span style="font-weight:500;color:#d97706;">&#9889; Execute</span>',
            menu: subMenu
          } as unknown as Tabulator.MenuObject<Tabulator.CellComponent>);
        }
      }

      if (linkActions.length > 0) {
        if (linkActions.length === 1) {
          const action = linkActions[0];
          cellContextMenu.push({
            label: `<span style="font-weight:500;color:#059669;">&#128279; ${action.display_name}</span>`,
            action: (_e, cellComponent) => {
              executeActionFromMenu(action, cellComponent);
            }
          } as Tabulator.MenuObject<Tabulator.CellComponent>);
        } else {
          const subMenu = linkActions.map(action => ({
            label: `<span style="color:#059669;">&#128279; ${action.display_name}</span>`,
            action: (_e: Event, cellComponent: Tabulator.CellComponent) => {
              executeActionFromMenu(action, cellComponent);
            }
          }));
          cellContextMenu.push({
            label: '<span style="font-weight:500;color:#059669;">&#128279; Open Link</span>',
            menu: subMenu
          } as unknown as Tabulator.MenuObject<Tabulator.CellComponent>);
        }
      }

      if (popupActions.length > 0) {
        if (popupActions.length === 1) {
          const action = popupActions[0];
          cellContextMenu.push({
            label: `<span style="font-weight:500;color:#0284c7;">&#128196; ${action.display_name}</span>`,
            action: (_e, cellComponent) => {
              executeActionFromMenu(action, cellComponent);
            }
          } as Tabulator.MenuObject<Tabulator.CellComponent>);
        } else {
          const subMenu = popupActions.map(action => ({
            label: `<span style="color:#0284c7;">&#128196; ${action.display_name}</span>`,
            action: (_e: Event, cellComponent: Tabulator.CellComponent) => {
              executeActionFromMenu(action, cellComponent);
            }
          }));
          cellContextMenu.push({
            label: '<span style="font-weight:500;color:#0284c7;">&#128196; Popup</span>',
            menu: subMenu
          } as unknown as Tabulator.MenuObject<Tabulator.CellComponent>);
        }
      }
      }
    }

      return cellContextMenu;
    };

    visibleColumns.forEach(({ key }) => {
      const tc = templateMap.get(key);
      const colFormatting = columnFormattings[key] || {};
      const displayName = colFormatting.displayName || tc?.title || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const cellFormatter = buildCellFormatter(key);

      const colShowFilterIcon = colFormatting.showFilterIcon !== undefined ? colFormatting.showFilterIcon : showFilterIcon;
      const colShowCalculationsIcon = colFormatting.showCalculationsIcon !== undefined ? colFormatting.showCalculationsIcon : showCalculationsIcon;
      const colShowFilterInput = colFormatting.showFilterInput !== undefined ? colFormatting.showFilterInput : showFilterInput;

      const selectedCalcs = columnCalcState.get(key);
      const firstCalc = selectedCalcs && selectedCalcs.size > 0 ? Array.from(selectedCalcs)[0] : null;

      const calcLabels: Record<string, string> = {
        'sum': 'Sum',
        'avg': 'Avg',
        'count': 'Count',
        'min': 'Min',
        'max': 'Max'
      };

      const colDef: Tabulator.ColumnDefinition = {
        title: displayName,
        field: key,
        width: tc?.width && tc.width <= 100 ? `${tc.width}%` : undefined,
        headerSort: false,
        titleFormatter: createTitleWithFilter as unknown as Tabulator.Formatter,
        titleFormatterParams: { showFilterIcon: colShowFilterIcon, showCalculationsIcon: colShowCalculationsIcon, showFilterInput: colShowFilterInput, headerFontSize: colFormatting.fontSize || gridFormatting.fontSize },
        formatter: cellFormatter,
        contextMenu: buildContextMenu
      };

      if (firstCalc) {
        colDef.bottomCalc = firstCalc as Tabulator.StandardCalc;
        colDef.bottomCalcFormatter = (cell: Tabulator.CellComponent) => {
          const value = cell.getValue();
          const formattedValue = typeof value === 'number'
            ? (firstCalc === 'count' ? value : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
            : value;
          return `${calcLabels[firstCalc] || firstCalc} = ${formattedValue}`;
        };
      }

      columns.push(colDef);
    });

    let groupByFields = currentFormattingRules.groupBy || [];
    let groupStartOpen: boolean | ((value: string) => boolean) = true;
    if (groupByFields.length === 0 && cell.auto_group_by_column) {
      groupByFields = [cell.auto_group_by_column];
      groupStartOpen = !cell.auto_group_collapsed;
    }

    // If we have saved group state, use it as the groupStartOpen function
    // so each group is created in its correct state from the start
    const savedState = savedGroupStateRef.current.size > 0 ? new Map(savedGroupStateRef.current) : null;
    if (savedState) {
      savedGroupStateRef.current.clear();
      const defaultOpen = typeof groupStartOpen === 'boolean' ? groupStartOpen : true;
      groupStartOpen = (value: string) => {
        const wasVisible = savedState.get(String(value));
        return wasVisible !== undefined ? wasVisible : defaultOpen;
      };
    }

    const tabulatorOptions: Record<string, unknown> = {
      data: data,
      columns: columns,
      layout: 'fitDataFill',
      movableColumns: true,
      resizableColumns: true,
      resizableColumnFit: false,
      placeholder: 'No data available',
      height: '100%',
      selectable: cell.enable_row_selection ? true : false
    };

    if (groupByFields.length > 0) {
      tabulatorOptions.groupBy = groupByFields.length === 1 ? groupByFields[0] : groupByFields;
      tabulatorOptions.groupStartOpen = groupStartOpen;
      tabulatorOptions.groupHeader = (value: unknown, count: number, _data: unknown, group: { getField: () => string }) => {
        const field = group.getField();
        const colFormatting = columnFormattings[field] || {};
        const displayName = colFormatting.displayName || field.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        return `${displayName}: ${value ?? '(empty)'} <span style="color:#6b7280;margin-left:8px;">(${count} item${count !== 1 ? 's' : ''})</span>`;
      };
    }

    tabulatorRef.current = new Tabulator(tableRef.current, tabulatorOptions as Tabulator.Options);

    tabulatorRef.current.on('columnMoved', () => {
      debouncedColumnChange();
    });
    tabulatorRef.current.on('columnResized', () => {
      debouncedColumnChange();
    });

    const templateFilters = activeTemplateRef.current?.headerFilters;
    if (templateFilters && templateFilters.length > 0) {
      tabulatorRef.current.on('tableBuilt', () => {
        templateFilters.forEach(f => {
          try {
            if (f.type === 'in' && Array.isArray(f.value)) {
              tabulatorRef.current?.addFilter(f.field, 'in', f.value);
            } else if (typeof f.value === 'string' && f.value.trim()) {
              const tabulatorType = f.type === 'contains' ? 'like' :
                f.type === 'starts' ? 'starts' :
                f.type === 'ends' ? 'ends' :
                f.type === 'equals' ? '=' :
                f.type === 'notcontains' ? 'like' :
                f.type === 'notequals' ? '!=' : 'like';
              tabulatorRef.current?.addFilter(f.field, tabulatorType, f.value);
            }
          } catch {
            // Column may not exist
          }
        });
      });
    }


    return () => {
      if (columnChangeDebounceRef.current) {
        clearTimeout(columnChangeDebounceRef.current);
        columnChangeDebounceRef.current = null;
      }

      drilldownTabulatorsRef.current.forEach(entry => entry.tabulator.destroy());
      drilldownTabulatorsRef.current.clear();

      if (tabulatorRef.current) {
        // Save group expansion state before destroying so it can be restored on rebuild
        try {
          const groups = tabulatorRef.current.getGroups?.();
          if (groups && groups.length > 0) {
            savedGroupStateRef.current.clear();
            const saveState = (groupList: Tabulator.GroupComponent[]) => {
              groupList.forEach((g: Tabulator.GroupComponent) => {
                const key = String(g.getKey());
                savedGroupStateRef.current.set(key, g.isVisible());
                const subGroups = g.getSubGroups?.();
                if (subGroups && subGroups.length > 0) {
                  saveState(subGroups);
                }
              });
            };
            saveState(groups);
          }
        } catch {
          // Tabulator may be in inconsistent state
        }
        tabulatorRef.current.destroy();
        tabulatorRef.current = null;
      }
    };
  }, [data, hasDrilldowns, cell.enable_row_selection, templateId, formattingRulesKey, debouncedColumnChange]);

  useEffect(() => {
    if (!tabulatorRef.current || !hasDrilldowns) return;
    try {
      tabulatorRef.current.getRows().forEach(row => row.reformat());
    } catch {
      // Tabulator may be in inconsistent state
    }
  }, [drilldownAvailability, hasDrilldowns]);

  useEffect(() => {
    if (!tabulatorRef.current || calcUpdateTrigger === 0) return;

    const calcLabels: Record<string, string> = {
      'sum': 'Sum',
      'avg': 'Avg',
      'count': 'Count',
      'min': 'Min',
      'max': 'Max'
    };

    columnCalcState.forEach((calcs, field) => {
      const firstCalc = calcs.size > 0 ? Array.from(calcs)[0] : null;

      if (firstCalc) {
        tabulatorRef.current?.updateColumnDefinition(field, {
          bottomCalc: firstCalc as Tabulator.StandardCalc,
          bottomCalcFormatter: (cell: Tabulator.CellComponent) => {
            const value = cell.getValue();
            const formattedValue = typeof value === 'number'
              ? (firstCalc === 'count' ? value : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
              : value;
            return `${calcLabels[firstCalc] || firstCalc} = ${formattedValue}`;
          }
        });
      } else {
        tabulatorRef.current?.updateColumnDefinition(field, {
          bottomCalc: undefined,
          bottomCalcFormatter: undefined
        });
      }
    });
  }, [calcUpdateTrigger]);

  const handlePromptSubmit = useCallback(async () => {
    if (!promptDialog) return;
    const { action, values, rows, onProgress } = promptDialog;
    setPromptDialog(null);

    if (action.action_type === 'link') {
      executeLinkAction(action, rows[0], values, fixedValues);
      if (promptResolveRef.current) {
        promptResolveRef.current({ success: 1, failed: 0, pulseTriggered: 0, errors: [] });
        promptResolveRef.current = null;
      }
      return;
    }

    const progressCallback: ActionProgressCallback = onProgress || ((current, total) => {
      setCellProcessing({ name: action.display_name, current, total });
    });

    if (!onProgress) {
      setCellProcessing({ name: action.display_name, current: 0, total: rows.length });
    }

    const result = await executeActionForRows(action, rows, progressCallback, values, fixedValues);

    if (!onProgress) {
      setCellProcessing(null);
    }

    if (action.refresh_after_execute) {
      fetchData();
    }

    if (promptResolveRef.current) {
      promptResolveRef.current(result);
      promptResolveRef.current = null;
    }
  }, [promptDialog, fetchData]);

  const handlePromptCancel = useCallback(() => {
    setPromptDialog(null);
    if (promptResolveRef.current) {
      promptResolveRef.current({ success: 0, failed: 0, pulseTriggered: 0, errors: [] });
      promptResolveRef.current = null;
    }
  }, []);

  const handlePromptValueChange = useCallback((paramName: string, value: string) => {
    setPromptDialog(prev => prev ? { ...prev, values: { ...prev.values, [paramName]: value } } : null);
  }, []);

  const activeGroupBy = formattingRules.groupBy || [];

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {activeGroupBy.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/20 border-b border-sky-200 dark:border-sky-800 flex-shrink-0">
          <span className="text-xs font-medium text-sky-700 dark:text-sky-300">Grouped by:</span>
          {activeGroupBy.map(field => {
            const colFormatting = formattingRules.columns?.[field] || {};
            const displayName = colFormatting.displayName || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            return (
              <span
                key={field}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-800/40 text-xs font-medium text-sky-800 dark:text-sky-200"
              >
                {displayName}
                <button
                  onClick={() => onGroupByChange?.(activeGroupBy.filter(f => f !== field))}
                  className="ml-0.5 text-sky-500 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-200"
                  title={`Remove ${displayName} grouping`}
                >
                  &times;
                </button>
              </span>
            );
          })}
          <button
            onClick={() => onGroupByChange?.([])}
            className="ml-2 text-xs text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200 underline"
          >
            Clear all
          </button>
        </div>
      )}
      <div ref={tableRef} className="flex-1 min-h-0" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-gray-900 dark:border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading data...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Error loading data</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">{error}</p>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      )}

      {!cell.queries && !loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">No query configured for this cell</p>
        </div>
      )}

      {cellProcessing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl px-8 py-6 w-80 flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Processing Action
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {cellProcessing.name}
              </p>
            </div>
            <div className="w-full">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${cellProcessing.total > 0 ? (cellProcessing.current / cellProcessing.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                {cellProcessing.current} of {cellProcessing.total} row{cellProcessing.total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {promptDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                {promptDialog.action.prompt_title || 'Enter Parameter Values'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {promptDialog.action.prompt_description || 'Provide values for the following parameters before executing.'}
              </p>
            </div>
            <div className="p-4 space-y-3">
              {promptDialog.mappings.map(m => {
                const vt = m.valueType || 'text';
                const inputType = vt === 'date' ? 'date' : vt === 'integer' || vt === 'double' ? 'number' : 'text';
                const inputStep = vt === 'double' ? '0.01' : undefined;
                const isLookupMapping = m.target === 'lookup' && (m.lookupQueryId || m.fixedValueId);
                const isFixedValueList = m.target === 'fixed_value' && m.fixedValueId;

                if (isFixedValueList) {
                  const fv = fixedValues.find(f => f.id === m.fixedValueId);
                  const listItems = fv?.list_values || [];
                  return (
                    <div key={m.parameterName}>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {m.promptText || m.parameterName}
                        <span className="ml-2 text-gray-400 font-normal">(list)</span>
                      </label>
                      <CustomDropdown
                        value={promptDialog.values[m.parameterName] || ''}
                        onChange={(val) => handlePromptValueChange(m.parameterName, val)}
                        options={listItems.map(item => ({ value: item.value, label: item.label || item.value }))}
                        placeholder="Select a value..."
                        size="sm"
                        searchable
                      />
                    </div>
                  );
                }

                if (isLookupMapping) {
                  const lookupState = m.lookupQueryId
                    ? getLookupStateByQueryId(m.lookupQueryId)
                    : getLookupState(m.fixedValueId!);
                  return (
                    <div key={m.parameterName}>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {m.promptText || m.parameterName}
                        <span className="ml-2 text-gray-400 font-normal">(lookup)</span>
                      </label>
                      {lookupState.loading ? (
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-500">
                          <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                          Loading options...
                        </div>
                      ) : lookupState.error ? (
                        <p className="text-xs text-red-500">{lookupState.error}</p>
                      ) : (
                        <CustomDropdown
                          value={promptDialog.values[m.parameterName] || ''}
                          onChange={(val) => handlePromptValueChange(m.parameterName, val)}
                          options={lookupState.options.map(o => ({ value: o.value, label: o.label }))}
                          placeholder="Select a value..."
                          size="sm"
                          searchable
                        />
                      )}
                    </div>
                  );
                }

                return (
                  <div key={m.parameterName}>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {m.promptText || m.parameterName}
                      <span className="ml-2 text-gray-400 font-normal">({vt})</span>
                    </label>
                    {vt === 'boolean' ? (
                      <CustomDropdown
                        value={promptDialog.values[m.parameterName] || ''}
                        onChange={(val) => handlePromptValueChange(m.parameterName, val)}
                        options={[
                          { value: '', label: 'Select...' },
                          { value: 'true', label: 'True' },
                          { value: 'false', label: 'False' },
                        ]}
                        placeholder="Select..."
                        size="sm"
                      />
                    ) : vt === 'date' ? (
                      <DatePicker
                        value={promptDialog.values[m.parameterName] || ''}
                        onChange={(val) => handlePromptValueChange(m.parameterName, val)}
                        placeholder="Select date"
                        size="sm"
                      />
                    ) : (
                      <input
                        type={inputType}
                        step={inputStep}
                        value={promptDialog.values[m.parameterName] || ''}
                        onChange={(e) => handlePromptValueChange(m.parameterName, e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder={`Enter ${vt} value`}
                        autoFocus={promptDialog.mappings[0].parameterName === m.parameterName}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handlePromptCancel}
                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handlePromptSubmit}
                className="px-3 py-1.5 text-sm text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded hover:bg-gray-800 dark:hover:bg-gray-100"
              >
                Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default DashboardCell;
