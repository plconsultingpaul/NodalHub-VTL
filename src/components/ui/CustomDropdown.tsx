import { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  dark?: boolean;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  dropdownMinWidth?: number;
  autoWidth?: boolean;
  dropdownMaxWidth?: number;
  searchable?: boolean;
}

export default function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  dark = false,
  size = 'md',
  icon,
  disabled = false,
  className = '',
  dropdownMinWidth,
  autoWidth = false,
  dropdownMaxWidth,
  searchable = false,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight?: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-sm px-3 py-2',
  };

  const chevronSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  const triggerLight =
    'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50';
  const triggerDark =
    'bg-slate-900/50 border border-slate-600 text-slate-100 hover:border-slate-500 hover:bg-slate-900/70';

  const listLight = 'bg-white border border-slate-100';
  const listDark = 'bg-slate-800 border border-slate-700';

  const scrollbarLight =
    '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200';
  const scrollbarDark =
    '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600';

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const maxDropdownHeight = 256; // max-h-64 = 16rem = 256px
    const estimatedHeight = Math.min(options.length * 36 + 8, maxDropdownHeight);

    if (spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove) {
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(maxDropdownHeight, spaceBelow),
      });
    } else {
      const menuHeight = Math.min(maxDropdownHeight, spaceAbove);
      setPosition({
        top: rect.top - menuHeight - 4,
        left: rect.left,
        width: rect.width,
        maxHeight: menuHeight,
      });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      return;
    }
    updatePosition();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleReposition = () => updatePosition();

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const filteredOptions = searchable && searchTerm
    ? options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const triggerColors = dark ? triggerDark : triggerLight;
  const placeholderColor = dark ? 'text-slate-500' : 'text-slate-400';
  const chevronColor = dark ? 'text-slate-500' : 'text-slate-400';
  const labelColor = selectedOption
    ? dark
      ? 'text-slate-100'
      : 'text-slate-900'
    : placeholderColor;

  const listStyle: React.CSSProperties = {
    position: 'fixed',
    top: position.top,
    left: position.left,
    zIndex: 9999,
    maxHeight: position.maxHeight ?? 256,
    ...(autoWidth
      ? { width: 'max-content', minWidth: dropdownMinWidth ?? position.width }
      : { width: position.width }),
    ...(dropdownMaxWidth ? { maxWidth: dropdownMaxWidth } : {}),
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        className={`flex items-center justify-between w-full rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${sizeClasses[size]} ${triggerColors} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {icon}
          <span className={`truncate text-left ${labelColor}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`${chevronSize} ${chevronColor} flex-shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={listRef}
            style={listStyle}
            className={`rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] ${searchable ? 'pb-1' : 'py-1'} origin-top overflow-y-auto overflow-x-auto ${dark ? listDark : listLight} ${dark ? scrollbarDark : scrollbarLight}`}
          >
            {searchable && (
              <div className={`sticky top-0 z-10 p-1.5 ${dark ? 'bg-slate-800 border-b border-slate-700' : 'bg-white border-b border-slate-100'}`}>
                <div className="relative">
                  <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className={`w-full pl-7 pr-2 py-1.5 text-xs rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 ${dark ? 'bg-slate-900 border-slate-600 text-slate-200 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
            {filteredOptions.length === 0 ? (
              <div className={`${sizeClasses[size]} ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                {searchable && searchTerm ? 'No matches' : 'No options'}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                const baseItem = `relative flex items-center w-full ${sizeClasses[size]} cursor-pointer select-none transition-colors`;
                const stateClasses = isSelected
                  ? dark
                    ? 'bg-blue-500/20 text-blue-400 font-medium'
                    : 'bg-blue-50/50 text-blue-700 font-medium'
                  : dark
                    ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900';
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`${baseItem} ${stateClasses}`}
                  >
                    <span className="whitespace-nowrap flex-1 text-left">{option.label}</span>
                    {isSelected && (
                      <Check
                        className={`w-3.5 h-3.5 flex-shrink-0 ml-2 ${dark ? 'text-blue-400' : 'text-blue-600'}`}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </>
  );
}
