import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, Table2, Columns3, RotateCcw, Layers, GripVertical, Eye, EyeOff } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import ConditionalFormattingTab from './ConditionalFormattingTab';
import { DATE_FORMAT_PRESETS, formatDateValue } from '../../lib/dateFormat';
import { NUMBER_FORMAT_TYPES, DECIMAL_OPTIONS, CURRENCY_SYMBOLS, CURRENCY_POSITIONS, NEGATIVE_FORMATS, formatNumberValue } from '../../lib/numberFormat';
import type { GridCellFormattingRules, GridColumnFormatting, DrilldownFormattingRules, NumberFormatConfig } from '../../types/database';

export interface DrilldownDefinition {
  id: string;
  displayName: string;
  columns: string[];
}

interface GridFormattingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rules: GridCellFormattingRules) => void;
  columns: string[];
  initialRules: GridCellFormattingRules;
  drilldowns?: DrilldownDefinition[];
}

const FONT_FAMILIES = [
  { value: '', label: 'Default' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
  { value: '"Lucida Console", Monaco, monospace', label: 'Lucida Console' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];

const COLOR_PALETTE = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
  ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
  ['#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79'],
  ['#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47'],
  ['#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'],
];

interface ColorSwatchPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function ColorSwatchPicker({ value, onChange }: ColorSwatchPickerProps) {
  return (
    <div className="space-y-1">
      <div className="flex flex-col gap-0.5">
        {COLOR_PALETTE.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-0.5">
            {row.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onChange(color)}
                className={`w-4 h-4 rounded-sm border transition-transform hover:scale-110 ${
                  value?.toLowerCase() === color.toLowerCase()
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            {rowIndex === 0 && (
              <button
                type="button"
                onClick={() => onChange('')}
                className={`w-4 h-4 rounded-sm border transition-transform hover:scale-110 relative overflow-hidden ${
                  !value
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                style={{ backgroundColor: '#ffffff' }}
                title="No color"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-0.5 bg-red-500 rotate-45 absolute" />
                </div>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_FORMATTING: GridColumnFormatting = {
  displayName: '',
  backgroundColor: '',
  textColor: '',
  fontFamily: '',
  fontSize: undefined,
  bold: false,
  italic: false,
  underline: false,
};

type SelectedTarget =
  | { type: 'grid' }
  | { type: 'column'; field: string }
  | { type: 'drilldown-grid'; drilldownId: string }
  | { type: 'drilldown-column'; drilldownId: string; field: string };

export default function GridFormattingModal({
  isOpen,
  onClose,
  onSave,
  columns,
  initialRules,
  drilldowns = [],
}: GridFormattingModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'conditional' | 'columnOrder'>('basic');
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>({ type: 'grid' });
  const [expandedColumns, setExpandedColumns] = useState(true);
  const [expandedDrilldowns, setExpandedDrilldowns] = useState<Record<string, boolean>>({});
  const [formattingRules, setFormattingRules] = useState<GridCellFormattingRules>(initialRules);
  const [columnOrder, setColumnOrder] = useState<string[]>(columns);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setFormattingRules(initialRules);
      setSelectedTarget({ type: 'grid' });
      const initialExpanded: Record<string, boolean> = {};
      drilldowns.forEach(d => { initialExpanded[d.id] = false; });
      setExpandedDrilldowns(initialExpanded);
      const savedOrder = initialRules.columnOrder || [];
      const stillExisting = savedOrder.filter(c => columns.includes(c));
      const newColumns = columns.filter(c => !savedOrder.includes(c));
      setColumnOrder(stillExisting.length > 0 ? [...stillExisting, ...newColumns] : columns);
      setHiddenColumns(initialRules.hiddenColumns || []);
      setGroupBy(initialRules.groupBy || []);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialRules, drilldowns, columns]);

  const currentFormatting = useMemo((): GridColumnFormatting => {
    if (selectedTarget.type === 'grid') {
      return formattingRules.grid || { ...DEFAULT_FORMATTING };
    }
    if (selectedTarget.type === 'column') {
      return formattingRules.columns?.[selectedTarget.field] || { ...DEFAULT_FORMATTING };
    }
    if (selectedTarget.type === 'drilldown-grid') {
      return formattingRules.drilldowns?.[selectedTarget.drilldownId]?.grid || { ...DEFAULT_FORMATTING };
    }
    if (selectedTarget.type === 'drilldown-column') {
      return formattingRules.drilldowns?.[selectedTarget.drilldownId]?.columns?.[selectedTarget.field] || { ...DEFAULT_FORMATTING };
    }
    return { ...DEFAULT_FORMATTING };
  }, [selectedTarget, formattingRules]);

  const updateFormatting = (updates: Partial<GridColumnFormatting>) => {
    setFormattingRules(prev => {
      if (selectedTarget.type === 'grid') {
        return {
          ...prev,
          grid: { ...prev.grid, ...updates },
        };
      }
      if (selectedTarget.type === 'column') {
        return {
          ...prev,
          columns: {
            ...prev.columns,
            [selectedTarget.field]: { ...prev.columns?.[selectedTarget.field], ...updates },
          },
        };
      }
      if (selectedTarget.type === 'drilldown-grid') {
        const drilldownId = selectedTarget.drilldownId;
        return {
          ...prev,
          drilldowns: {
            ...prev.drilldowns,
            [drilldownId]: {
              ...prev.drilldowns?.[drilldownId],
              grid: { ...prev.drilldowns?.[drilldownId]?.grid, ...updates },
            },
          },
        };
      }
      if (selectedTarget.type === 'drilldown-column') {
        const drilldownId = selectedTarget.drilldownId;
        const field = selectedTarget.field;
        return {
          ...prev,
          drilldowns: {
            ...prev.drilldowns,
            [drilldownId]: {
              ...prev.drilldowns?.[drilldownId],
              columns: {
                ...prev.drilldowns?.[drilldownId]?.columns,
                [field]: { ...prev.drilldowns?.[drilldownId]?.columns?.[field], ...updates },
              },
            },
          },
        };
      }
      return prev;
    });
  };

  const handleReset = () => {
    if (selectedTarget.type === 'grid') {
      setFormattingRules(prev => ({ ...prev, grid: { ...DEFAULT_FORMATTING } }));
    } else if (selectedTarget.type === 'column') {
      setFormattingRules(prev => {
        const newColumns = { ...prev.columns };
        delete newColumns[selectedTarget.field];
        return { ...prev, columns: newColumns };
      });
    } else if (selectedTarget.type === 'drilldown-grid') {
      const drilldownId = selectedTarget.drilldownId;
      setFormattingRules(prev => ({
        ...prev,
        drilldowns: {
          ...prev.drilldowns,
          [drilldownId]: {
            ...prev.drilldowns?.[drilldownId],
            grid: { ...DEFAULT_FORMATTING },
          },
        },
      }));
    } else if (selectedTarget.type === 'drilldown-column') {
      const drilldownId = selectedTarget.drilldownId;
      const field = selectedTarget.field;
      setFormattingRules(prev => {
        const drilldownColumns = { ...prev.drilldowns?.[drilldownId]?.columns };
        delete drilldownColumns[field];
        return {
          ...prev,
          drilldowns: {
            ...prev.drilldowns,
            [drilldownId]: {
              ...prev.drilldowns?.[drilldownId],
              columns: drilldownColumns,
            },
          },
        };
      });
    }
  };

  const handleSave = () => {
    const rulesToSave: GridCellFormattingRules = {
      ...formattingRules,
      columnOrder,
      hiddenColumns: hiddenColumns.length > 0 ? hiddenColumns : undefined,
      groupBy: groupBy.length > 0 ? groupBy : undefined
    };
    onSave(rulesToSave);
    onClose();
  };

  const getPreviewStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {};
    if (currentFormatting.backgroundColor) {
      style.backgroundColor = currentFormatting.backgroundColor;
    }
    if (currentFormatting.textColor) {
      style.color = currentFormatting.textColor;
    }
    if (currentFormatting.fontFamily) {
      style.fontFamily = currentFormatting.fontFamily;
    }
    if (currentFormatting.fontSize) {
      style.fontSize = `${currentFormatting.fontSize}px`;
    }
    if (currentFormatting.bold) {
      style.fontWeight = 'bold';
    }
    if (currentFormatting.italic) {
      style.fontStyle = 'italic';
    }
    if (currentFormatting.underline) {
      style.textDecoration = 'underline';
    }
    return style;
  };

  const formatColumnName = (field: string): string => {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Grid Formatting" size="3xl">
      <div className="flex flex-col h-[700px]">
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'basic'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Basic Properties
            {activeTab === 'basic' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('conditional')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'conditional'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Conditional Formatting
            {activeTab === 'conditional' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('columnOrder')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'columnOrder'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Column Order
            {activeTab === 'columnOrder' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
        </div>

        {activeTab === 'basic' ? (
          <div className="flex flex-1 gap-4 min-h-0">
            <div className="w-56 flex-shrink-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col">
              <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Target
                </span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Main Table</span>
                </div>
                <button
                  onClick={() => setSelectedTarget({ type: 'grid' })}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    selectedTarget.type === 'grid'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Table2 className="w-4 h-4" />
                  <span className="font-medium">Grid (All Rows)</span>
                </button>

                <div className="border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setExpandedColumns(!expandedColumns)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {expandedColumns ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <Columns3 className="w-4 h-4" />
                    <span className="font-medium">Columns</span>
                  </button>

                  {expandedColumns && (
                    <div className="pl-6">
                      {columns.map(col => (
                        <button
                          key={col}
                          onClick={() => setSelectedTarget({ type: 'column', field: col })}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                            selectedTarget.type === 'column' && selectedTarget.field === col
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                          <span className="truncate">{formatColumnName(col)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {drilldowns.length > 0 && drilldowns.map(drilldown => (
                  <div key={drilldown.id} className="border-t border-gray-200 dark:border-gray-700">
                    <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-700/50">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Drilldown: {drilldown.displayName}</span>
                    </div>
                    <button
                      onClick={() => setSelectedTarget({ type: 'drilldown-grid', drilldownId: drilldown.id })}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        selectedTarget.type === 'drilldown-grid' && selectedTarget.drilldownId === drilldown.id
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span className="font-medium">Grid (All Rows)</span>
                    </button>

                    <button
                      onClick={() => setExpandedDrilldowns(prev => ({ ...prev, [drilldown.id]: !prev[drilldown.id] }))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      {expandedDrilldowns[drilldown.id] ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <Columns3 className="w-4 h-4" />
                      <span className="font-medium">Columns</span>
                    </button>

                    {expandedDrilldowns[drilldown.id] && (
                      <div className="pl-6">
                        {drilldown.columns.map(col => (
                          <button
                            key={col}
                            onClick={() => setSelectedTarget({ type: 'drilldown-column', drilldownId: drilldown.id, field: col })}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                              selectedTarget.type === 'drilldown-column' && selectedTarget.drilldownId === drilldown.id && selectedTarget.field === col
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                            <span className="truncate">{formatColumnName(col)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-1">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedTarget.type === 'grid' && 'Grid Settings'}
                    {selectedTarget.type === 'column' && `Column: ${formatColumnName(selectedTarget.field)}`}
                    {selectedTarget.type === 'drilldown-grid' && `Drilldown: ${drilldowns.find(d => d.id === selectedTarget.drilldownId)?.displayName || 'Unknown'} - Grid Settings`}
                    {selectedTarget.type === 'drilldown-column' && `Drilldown Column: ${formatColumnName(selectedTarget.field)}`}
                  </h3>
                  <Button variant="secondary" size="sm" onClick={handleReset}>
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset to Default
                  </Button>
                </div>

                {(selectedTarget.type === 'column' || selectedTarget.type === 'drilldown-column') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={currentFormatting.displayName || ''}
                      onChange={(e) => updateFormatting({ displayName: e.target.value })}
                      placeholder={formatColumnName(selectedTarget.type === 'column' ? selectedTarget.field : selectedTarget.field)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Background Color
                    </label>
                    <ColorSwatchPicker
                      value={currentFormatting.backgroundColor || ''}
                      onChange={(color) => updateFormatting({ backgroundColor: color })}
                    />
                    <div className="flex gap-2 mt-2">
                      <input
                        type="color"
                        value={currentFormatting.backgroundColor || '#ffffff'}
                        onChange={(e) => updateFormatting({ backgroundColor: e.target.value })}
                        className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={currentFormatting.backgroundColor || ''}
                        onChange={(e) => updateFormatting({ backgroundColor: e.target.value })}
                        placeholder="#ffffff"
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Text Color
                    </label>
                    <ColorSwatchPicker
                      value={currentFormatting.textColor || ''}
                      onChange={(color) => updateFormatting({ textColor: color })}
                    />
                    <div className="flex gap-2 mt-2">
                      <input
                        type="color"
                        value={currentFormatting.textColor || '#000000'}
                        onChange={(e) => updateFormatting({ textColor: e.target.value })}
                        className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={currentFormatting.textColor || ''}
                        onChange={(e) => updateFormatting({ textColor: e.target.value })}
                        placeholder="#000000"
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Font Family
                    </label>
                    <CustomDropdown
                      value={currentFormatting.fontFamily || ''}
                      onChange={(val) => updateFormatting({ fontFamily: val })}
                      options={FONT_FAMILIES.map(font => ({ value: font.value, label: font.label }))}
                      size="sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Font Size
                    </label>
                    <CustomDropdown
                      value={String(currentFormatting.fontSize || '')}
                      onChange={(val) => updateFormatting({ fontSize: val ? parseInt(val) : undefined })}
                      options={[
                        { value: '', label: 'Default' },
                        ...FONT_SIZES.map(size => ({ value: String(size), label: `${size}px` }))
                      ]}
                      size="sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Text Style
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateFormatting({ bold: !currentFormatting.bold })}
                      className={`px-4 py-2 text-sm font-bold border rounded-md transition-colors ${
                        currentFormatting.bold
                          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      B
                    </button>
                    <button
                      onClick={() => updateFormatting({ italic: !currentFormatting.italic })}
                      className={`px-4 py-2 text-sm italic border rounded-md transition-colors ${
                        currentFormatting.italic
                          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      I
                    </button>
                    <button
                      onClick={() => updateFormatting({ underline: !currentFormatting.underline })}
                      className={`px-4 py-2 text-sm underline border rounded-md transition-colors ${
                        currentFormatting.underline
                          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      U
                    </button>
                  </div>
                </div>

                {(selectedTarget.type === 'column' || selectedTarget.type === 'drilldown-column') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date Format
                  </label>
                  <CustomDropdown
                    value={currentFormatting.dateFormat || ''}
                    onChange={(val) => updateFormatting({ dateFormat: val || undefined, numberFormat: val ? undefined : currentFormatting.numberFormat })}
                    options={DATE_FORMAT_PRESETS.map(p => ({
                      value: p.value,
                      label: p.value ? `${p.label}  (${p.example})` : p.label
                    }))}
                    placeholder="None (Raw Value)"
                    size="sm"
                    disabled={!!currentFormatting.numberFormat}
                  />
                  {currentFormatting.dateFormat && (
                    <div className="mt-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Preview: </span>
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {formatDateValue(new Date().toISOString(), currentFormatting.dateFormat) || 'Invalid format'}
                      </span>
                    </div>
                  )}
                </div>
                )}

                {(selectedTarget.type === 'column' || selectedTarget.type === 'drilldown-column') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Number Format
                  </label>
                  <CustomDropdown
                    value={currentFormatting.numberFormat?.type || ''}
                    onChange={(val) => {
                      if (!val) {
                        updateFormatting({ numberFormat: undefined });
                      } else {
                        updateFormatting({
                          numberFormat: {
                            type: val as NumberFormatConfig['type'],
                            decimals: currentFormatting.numberFormat?.decimals ?? 2,
                            thousandsSeparator: currentFormatting.numberFormat?.thousandsSeparator ?? true,
                            currencySymbol: val === 'currency' ? (currentFormatting.numberFormat?.currencySymbol || '$') : undefined,
                            currencyPosition: val === 'currency' ? (currentFormatting.numberFormat?.currencyPosition || 'prefix') : undefined,
                            negativeFormat: currentFormatting.numberFormat?.negativeFormat || 'minus',
                          },
                          dateFormat: undefined,
                        });
                      }
                    }}
                    options={NUMBER_FORMAT_TYPES}
                    placeholder="None (Raw Value)"
                    size="sm"
                    disabled={!!currentFormatting.dateFormat}
                  />

                  {currentFormatting.numberFormat && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Decimal Places</label>
                          <CustomDropdown
                            value={String(currentFormatting.numberFormat.decimals)}
                            onChange={(val) => updateFormatting({ numberFormat: { ...currentFormatting.numberFormat!, decimals: parseInt(val) } })}
                            options={DECIMAL_OPTIONS}
                            size="sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Negative Format</label>
                          <CustomDropdown
                            value={currentFormatting.numberFormat.negativeFormat || 'minus'}
                            onChange={(val) => updateFormatting({ numberFormat: { ...currentFormatting.numberFormat!, negativeFormat: val as NumberFormatConfig['negativeFormat'] } })}
                            options={NEGATIVE_FORMATS}
                            size="sm"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentFormatting.numberFormat.thousandsSeparator}
                          onChange={(e) => updateFormatting({ numberFormat: { ...currentFormatting.numberFormat!, thousandsSeparator: e.target.checked } })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Thousands Separator (,)</span>
                      </label>

                      {currentFormatting.numberFormat.type === 'currency' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Symbol</label>
                            <CustomDropdown
                              value={currentFormatting.numberFormat.currencySymbol || '$'}
                              onChange={(val) => updateFormatting({ numberFormat: { ...currentFormatting.numberFormat!, currencySymbol: val } })}
                              options={CURRENCY_SYMBOLS}
                              size="sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Position</label>
                            <CustomDropdown
                              value={currentFormatting.numberFormat.currencyPosition || 'prefix'}
                              onChange={(val) => updateFormatting({ numberFormat: { ...currentFormatting.numberFormat!, currencyPosition: val as 'prefix' | 'suffix' } })}
                              options={CURRENCY_POSITIONS}
                              size="sm"
                            />
                          </div>
                        </div>
                      )}

                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Preview: </span>
                        <span className="text-sm text-gray-800 dark:text-gray-200">
                          {formatNumberValue(1234.5678, currentFormatting.numberFormat)}
                        </span>
                        {currentFormatting.numberFormat.negativeFormat && (
                          <span className={`text-sm ml-3 ${currentFormatting.numberFormat.negativeFormat === 'red' ? 'text-red-600' : 'text-gray-800 dark:text-gray-200'}`}>
                            {formatNumberValue(-1234.5678, currentFormatting.numberFormat)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {(selectedTarget.type === 'grid' || selectedTarget.type === 'column') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Header Filter Options
                    {selectedTarget.type !== 'grid' && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(overrides grid default)</span>
                    )}
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTarget.type === 'grid'
                          ? formattingRules.showFilterIcon !== false
                          : (currentFormatting.showFilterIcon !== undefined
                            ? currentFormatting.showFilterIcon !== false
                            : formattingRules.showFilterIcon !== false)}
                        onChange={(e) => {
                          if (selectedTarget.type === 'grid') {
                            setFormattingRules(prev => {
                              const updated = { ...prev, showFilterIcon: e.target.checked };
                              if (prev.columns) {
                                const cleanedColumns = { ...prev.columns };
                                Object.keys(cleanedColumns).forEach(key => {
                                  if (cleanedColumns[key]?.showFilterIcon !== undefined) {
                                    cleanedColumns[key] = { ...cleanedColumns[key] };
                                    delete cleanedColumns[key].showFilterIcon;
                                  }
                                });
                                updated.columns = cleanedColumns;
                              }
                              return updated;
                            });
                          } else {
                            updateFormatting({ showFilterIcon: e.target.checked });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Show Filter Icon</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTarget.type === 'grid'
                          ? formattingRules.showCalculationsIcon !== false
                          : (currentFormatting.showCalculationsIcon !== undefined
                            ? currentFormatting.showCalculationsIcon !== false
                            : formattingRules.showCalculationsIcon !== false)}
                        onChange={(e) => {
                          if (selectedTarget.type === 'grid') {
                            setFormattingRules(prev => {
                              const updated = { ...prev, showCalculationsIcon: e.target.checked };
                              if (prev.columns) {
                                const cleanedColumns = { ...prev.columns };
                                Object.keys(cleanedColumns).forEach(key => {
                                  if (cleanedColumns[key]?.showCalculationsIcon !== undefined) {
                                    cleanedColumns[key] = { ...cleanedColumns[key] };
                                    delete cleanedColumns[key].showCalculationsIcon;
                                  }
                                });
                                updated.columns = cleanedColumns;
                              }
                              return updated;
                            });
                          } else {
                            updateFormatting({ showCalculationsIcon: e.target.checked });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Show Calculations Icon</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTarget.type === 'grid'
                          ? formattingRules.showFilterInput !== false
                          : (currentFormatting.showFilterInput !== undefined
                            ? currentFormatting.showFilterInput !== false
                            : formattingRules.showFilterInput !== false)}
                        onChange={(e) => {
                          if (selectedTarget.type === 'grid') {
                            setFormattingRules(prev => {
                              const updated = { ...prev, showFilterInput: e.target.checked };
                              if (prev.columns) {
                                const cleanedColumns = { ...prev.columns };
                                Object.keys(cleanedColumns).forEach(key => {
                                  if (cleanedColumns[key]?.showFilterInput !== undefined) {
                                    cleanedColumns[key] = { ...cleanedColumns[key] };
                                    delete cleanedColumns[key].showFilterInput;
                                  }
                                });
                                updated.columns = cleanedColumns;
                              }
                              return updated;
                            });
                          } else {
                            updateFormatting({ showFilterInput: e.target.checked });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Show Filter Input</span>
                    </label>
                  </div>
                </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Preview
                  </label>
                  <div
                    className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md"
                    style={getPreviewStyle()}
                  >
                    {currentFormatting.numberFormat
                      ? formatNumberValue(1234.5678, currentFormatting.numberFormat) || 'Example Text'
                      : currentFormatting.dateFormat
                        ? formatDateValue(new Date().toISOString(), currentFormatting.dateFormat) || 'Example Text'
                        : 'Example Text'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'conditional' ? (
          <ConditionalFormattingTab
            columns={columns}
            formattingRules={formattingRules}
            onFormattingChange={setFormattingRules}
          />
        ) : (
          <div className="flex-1 overflow-y-auto px-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Drag columns to reorder. This order will be applied when the formatting is saved.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const allCols = [...columns, ...hiddenColumns.filter(c => !columns.includes(c))];
                  setColumnOrder(allCols);
                }}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset Order
              </Button>
            </div>
            <div className="space-y-1">
              {columnOrder.map((col, index) => {
                const isHidden = hiddenColumns.includes(col);
                return (
                <div
                  key={col}
                  draggable
                  onDragStart={() => { dragItemRef.current = index; }}
                  onDragEnter={() => { dragOverItemRef.current = index; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={() => {
                    if (dragItemRef.current === null || dragOverItemRef.current === null) return;
                    const reordered = [...columnOrder];
                    const [removed] = reordered.splice(dragItemRef.current, 1);
                    reordered.splice(dragOverItemRef.current, 0, removed);
                    setColumnOrder(reordered);
                    dragItemRef.current = null;
                    dragOverItemRef.current = null;
                  }}
                  className={`flex items-center gap-3 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md cursor-grab active:cursor-grabbing hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all select-none ${isHidden ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6 text-right">
                    {index + 1}
                  </span>
                  <span className={`text-sm flex-1 ${isHidden ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                    {formatColumnName(col)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHiddenColumns(prev =>
                        prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
                      );
                    }}
                    className={`p-1 rounded transition-colors ${isHidden ? 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300' : 'text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'}`}
                    title={isHidden ? 'Show column' : 'Hide column'}
                  >
                    {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Group By</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Select columns to group rows by. Rows with matching values will be collapsed together.
                  </p>
                </div>
                {groupBy.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setGroupBy([])}>
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {groupBy.map(field => (
                  <span
                    key={field}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-100 dark:bg-sky-800/40 text-xs font-medium text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-700"
                  >
                    {formatColumnName(field)}
                    <button
                      onClick={() => setGroupBy(groupBy.filter(f => f !== field))}
                      className="text-sky-500 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-200"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                {groupBy.length === 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">No grouping applied</span>
                )}
              </div>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value=""
                onChange={(e) => {
                  if (e.target.value && !groupBy.includes(e.target.value)) {
                    setGroupBy([...groupBy, e.target.value]);
                  }
                  e.target.value = '';
                }}
              >
                <option value="">Add column to group by...</option>
                {columns.filter(c => !groupBy.includes(c)).map(col => (
                  <option key={col} value={col}>{formatColumnName(col)}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}
