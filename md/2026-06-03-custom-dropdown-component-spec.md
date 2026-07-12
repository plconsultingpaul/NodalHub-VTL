# Custom Dropdown Component Specification

A detailed reference for replicating the TradeWeave dropdown component in any React + Tailwind CSS application.

---

## Overview

The dropdown is a custom select replacement with a clean, modern SaaS aesthetic. It uses a trigger button that opens a portal-rendered option list positioned below the trigger. The selected item displays a checkmark icon.

---

## Dependencies

- **React 18** (with `createPortal` from `react-dom`)
- **Tailwind CSS 3.4**
- **Lucide React** icons: `ChevronDown`, `Check`

---

## Component API

```typescript
interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  value: string;                    // Currently selected value
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;            // Default: "Select..."
  dark?: boolean;                  // Dark theme variant
  size?: 'sm' | 'md';             // Default: 'md'
  icon?: React.ReactNode;         // Optional icon before label
  disabled?: boolean;
  className?: string;
  dropdownMinWidth?: number;       // Minimum width of the list in px
  autoWidth?: boolean;             // List uses max-content width
  dropdownMaxWidth?: number;       // Cap the list width
}
```

---

## Trigger Button

### Layout
- Flexbox row, `justify-between`, full width
- Label + optional icon on the left, chevron on the right
- Text is truncated with `truncate` when it overflows

### Sizing

| Size | Font    | Padding         |
|------|---------|-----------------|
| `sm` | `text-xs` (12px) | `px-2.5 py-1.5` |
| `md` | `text-sm` (14px) | `px-3 py-2`     |

### Border Radius
- `rounded-lg` (8px)

### Shadow
- `shadow-sm` (subtle default elevation)

### Light Theme (default)
```
Background:      bg-white
Border:          border border-slate-200   (#e2e8f0)
Text (selected): text-slate-900            (#0f172a)
Text (empty):    text-slate-400            (#94a3b8)
Chevron:         text-slate-400            (#94a3b8)
Hover:           hover:border-slate-300 hover:bg-slate-50
```

### Dark Theme (`dark={true}`)
```
Background:      bg-slate-900/50
Border:          border border-slate-600   (#475569)
Text (selected): text-slate-100            (#f1f5f9)
Text (empty):    text-slate-500            (#64748b)
Chevron:         text-slate-500            (#64748b)
Hover:           hover:border-slate-500 hover:bg-slate-900/70
```

### Focus State
```
focus:outline-none
focus:ring-2
focus:ring-blue-500/20
focus:border-blue-500
```

### Disabled State
```
opacity-50
cursor-not-allowed
```

### Chevron Icon
- Size: `w-4 h-4` (md) or `w-3 h-3` (sm)
- `flex-shrink-0`
- Left margin: `ml-2`
- Rotates 180 degrees when open: `rotate-180`
- Transition: `transition-transform duration-200`

---

## Option List (Dropdown Panel)

### Positioning
- **Rendered via React Portal** to `document.body` (avoids overflow clipping)
- Position: `fixed`
- Top: trigger bottom edge + 4px gap
- Left: aligned to trigger left edge
- Width: matches trigger width (or uses `max-content` if `autoWidth` is true)
- Z-index: `9999`

### Container Styling

| Property        | Light                                          | Dark                                     |
|-----------------|------------------------------------------------|------------------------------------------|
| Background      | `bg-white`                                     | `bg-slate-800`                          |
| Border          | `border border-slate-100` (#f1f5f9)           | `border border-slate-700` (#334155)     |
| Border Radius   | `rounded-xl` (12px)                           | `rounded-xl` (12px)                     |
| Shadow          | `0 10px 40px -10px rgba(0,0,0,0.1)`          | same                                     |
| Padding         | `py-1` (4px top/bottom)                       | same                                     |
| Max Height      | `max-h-64` (256px) with vertical scroll       | same                                     |
| Animation       | `origin-top`                                   | same                                     |

### Scrollbar Styling
```css
[&::-webkit-scrollbar]:w-1.5
[&::-webkit-scrollbar]:h-1.5
[&::-webkit-scrollbar-track]:bg-transparent
[&::-webkit-scrollbar-thumb]:rounded-full

/* Light */
[&::-webkit-scrollbar-thumb]:bg-slate-200

/* Dark */
[&::-webkit-scrollbar-thumb]:bg-slate-600
```

---

## Option Items

### Layout
- Full width, flexbox row
- Label text is `whitespace-nowrap`, `flex-1`, `text-left`
- Checkmark icon on the right when selected

### Sizing

| Size | Font    | Padding         |
|------|---------|-----------------|
| `sm` | `text-xs` (12px) | `px-2.5 py-1.5` |
| `md` | `text-sm` (14px) | `px-3 py-2`     |

### States

#### Normal (Light)
```
Text:    text-slate-600     (#475569)
Hover:   hover:bg-slate-50 hover:text-slate-900
```

#### Normal (Dark)
```
Text:    text-slate-300     (#cbd5e1)
Hover:   hover:bg-slate-700 hover:text-white
```

#### Selected (Light)
```
Background:  bg-blue-50/50
Text:        text-blue-700   (#1d4ed8)
Font:        font-medium
Checkmark:   text-blue-600   (#2563eb)
```

#### Selected (Dark)
```
Background:  bg-blue-500/20
Text:        text-blue-400   (#60a5fa)
Font:        font-medium
Checkmark:   text-blue-400   (#60a5fa)
```

### Checkmark Icon
- Lucide `Check` icon
- Size: `w-3.5 h-3.5`
- `flex-shrink-0`
- Left margin: `ml-2`
- Only visible on the selected item

### Cursor & Selection
```
cursor-pointer
select-none
transition-colors
```

---

## Behavior

1. **Click trigger** - toggles the dropdown open/closed
2. **Click outside** - closes the dropdown (uses `mousedown` listener on `document`)
3. **Select option** - calls `onChange(option.value)` and closes the dropdown
4. **Scroll/Resize** - recalculates position while open (attaches listeners on open, removes on close)
5. **Portal rendering** - the list is rendered directly into `document.body` so parent `overflow: hidden` or `z-index` contexts do not clip it

---

## Complete Tailwind Class Reference

### Trigger Button (Light, md)
```
flex items-center justify-between w-full rounded-lg shadow-sm
transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20
focus:border-blue-500 text-sm px-3 py-2 bg-white border border-slate-200
text-slate-700 hover:border-slate-300 hover:bg-slate-50
```

### Dropdown List (Light)
```
rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] py-1 origin-top
max-h-64 overflow-y-auto overflow-x-auto bg-white border border-slate-100
[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5
[&::-webkit-scrollbar-track]:bg-transparent
[&::-webkit-scrollbar-thumb]:rounded-full
[&::-webkit-scrollbar-thumb]:bg-slate-200
```

### Option Item - Unselected (Light, md)
```
relative flex items-center w-full px-3 py-2 text-sm cursor-pointer
select-none transition-colors text-slate-600 hover:bg-slate-50
hover:text-slate-900
```

### Option Item - Selected (Light, md)
```
relative flex items-center w-full px-3 py-2 text-sm cursor-pointer
select-none transition-colors bg-blue-50/50 text-blue-700 font-medium
```

---

## Color Palette Summary

| Token               | Hex       | Usage                         |
|---------------------|-----------|-------------------------------|
| `slate-50`          | `#f8fafc` | Hover background, dropdown bg border |
| `slate-100`         | `#f1f5f9` | List border (light)           |
| `slate-200`         | `#e2e8f0` | Trigger border, scrollbar     |
| `slate-300`         | `#cbd5e1` | Trigger hover border          |
| `slate-400`         | `#94a3b8` | Placeholder text, chevron     |
| `slate-600`         | `#475569` | Option text                   |
| `slate-700`         | `#334155` | Trigger text, dark list border|
| `slate-900`         | `#0f172a` | Selected text, hover text     |
| `blue-50`           | `#eff6ff` | Selected option background    |
| `blue-500`          | `#3b82f6` | Focus ring                    |
| `blue-600`          | `#2563eb` | Checkmark                     |
| `blue-700`          | `#1d4ed8` | Selected option text          |
| `white`             | `#ffffff` | Trigger & list background     |

---

## Implementation Notes

- The dropdown uses `position: fixed` for the list, not `absolute`, so it is immune to parent overflow clipping
- The gap between trigger and list is **4px** (`rect.bottom + 4`)
- The list width defaults to the trigger width; use `autoWidth: true` for content-based sizing
- No animation/opacity transition on open/close -- the list appears immediately
- The `origin-top` class is present for potential CSS animation hooks
