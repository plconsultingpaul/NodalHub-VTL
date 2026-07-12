# API Field Picker Implementation Guide

This document provides a comprehensive guide for implementing the API Field Picker feature - a context-aware button that allows users to select fields from an API endpoint's response schema to build query parameters like `$filter`, `$orderby`, and `$select`.

## Overview

The Field Picker is a `{}` button that appears next to query parameter input fields. When clicked, it opens a modal that displays all available fields from the API endpoint's response schema, allowing users to:

1. Build OData-style filter expressions (e.g., `status eq 'active'`)
2. Add sort fields with direction (e.g., `name desc`)
3. Select multiple fields to return (e.g., `id,name,status`)

The picker is context-aware - it changes its behavior based on which parameter it's editing ($filter, $orderby, or $select).

---

## Database Schema

### Required Tables

#### 1. `api_specs` - Stores uploaded OpenAPI/Swagger specifications

```sql
CREATE TABLE api_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  api_endpoint_id uuid REFERENCES api_endpoints(id) ON DELETE SET NULL,
  name text NOT NULL,
  file_name text NOT NULL,
  spec_content jsonb NOT NULL,
  version text DEFAULT '1.0.0',
  description text DEFAULT '',
  endpoint_count integer DEFAULT 0,
  uploaded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 2. `api_spec_endpoints` - Individual endpoints parsed from specs

```sql
CREATE TABLE api_spec_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_spec_id uuid NOT NULL REFERENCES api_specs(id) ON DELETE CASCADE,
  path text NOT NULL,
  method text NOT NULL,
  summary text DEFAULT '',
  parameters jsonb DEFAULT '[]',
  request_body jsonb,
  responses jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

#### 3. `api_endpoint_fields` - Individual fields extracted from schemas

```sql
CREATE TABLE api_endpoint_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_spec_endpoint_id uuid NOT NULL REFERENCES api_spec_endpoints(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_path text NOT NULL,
  field_type text DEFAULT 'string',
  is_required boolean DEFAULT false,
  description text DEFAULT '',
  example text,
  format text,
  parent_field_id uuid REFERENCES api_endpoint_fields(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
```

### Field Path Convention

Fields are stored with a prefix indicating their location:
- `[query] fieldName` - Query parameters
- `[path] fieldName` - Path parameters
- `[header] fieldName` - Header parameters
- `[body] fieldName` - Request body fields
- `[response] fieldName` - Response body fields

---

## TypeScript Interfaces

### Core Types

```typescript
// Field from API specification
interface ApiSpecField {
  id: string;
  api_spec_endpoint_id: string;
  field_name: string;
  field_path: string;
  field_type: string;
  is_required: boolean;
  description: string;
  example: string | null;
  format: string | null;
}

// Query parameter structure
interface QueryParameter {
  key: string;
  value: string;
  type: string;
  description: string;
  example: string | null;
  enabled: boolean;
  required: boolean;
}
```

### Picker Mode Types

```typescript
type PickerMode = 'filter' | 'orderby' | 'select' | null;

// Determines picker mode based on parameter key
function getPickerMode(paramKey: string): PickerMode {
  const key = paramKey.toLowerCase();
  if (key === '$filter' || key === 'filter') return 'filter';
  if (key === '$orderby' || key === 'orderby' || key === '$order' || key === 'order') return 'orderby';
  if (key === '$select' || key === 'select') return 'select';
  return null;
}
```

---

## OpenAPI Spec Parsing

When an OpenAPI spec is uploaded, fields are extracted from response schemas:

```typescript
const extractFieldsFromSchema = (
  schema: Record<string, unknown>,
  spec: Record<string, unknown>,
  prefix: string,
  parentPath: string = ''
): ParsedField[] => {
  const fields: ParsedField[] = [];

  // Handle $ref references
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref as string, spec);
    if (resolved && typeof resolved === 'object') {
      return extractFieldsFromSchema(resolved, spec, prefix, parentPath);
    }
    return fields;
  }

  const properties = schema.properties as Record<string, unknown>;
  const required = (schema.required as string[]) || [];

  if (properties) {
    for (const [fieldName, fieldDef] of Object.entries(properties)) {
      const basePath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
      const fieldPath = `${prefix} ${basePath}`;

      // Resolve nested $ref
      let resolvedDef = fieldDef;
      if (fieldDef.$ref) {
        const resolved = resolveRef(fieldDef.$ref as string, spec);
        if (resolved) resolvedDef = resolved;
      }

      fields.push({
        field_name: fieldName,
        field_path: fieldPath,
        field_type: resolvedDef.type || 'string',
        is_required: required.includes(fieldName),
        description: resolvedDef.description || '',
        example: resolvedDef.example ? String(resolvedDef.example) : null,
        format: resolvedDef.format || null,
      });

      // Recurse for nested objects
      if (resolvedDef.type === 'object' && resolvedDef.properties) {
        fields.push(...extractFieldsFromSchema(resolvedDef, spec, prefix, basePath));
      }

      // Handle arrays
      if (resolvedDef.type === 'array' && resolvedDef.items) {
        const items = resolvedDef.items;
        if (items.$ref) {
          const resolved = resolveRef(items.$ref, spec);
          if (resolved) {
            fields.push(...extractFieldsFromSchema(resolved, spec, prefix, `${basePath}[]`));
          }
        } else if (items.properties) {
          fields.push(...extractFieldsFromSchema(items, spec, prefix, `${basePath}[]`));
        }
      }
    }
  }

  return fields;
};
```

---

## Filter Expression Builder

### Operators by Field Type

```typescript
const FILTER_OPERATORS = {
  string: [
    { value: 'eq', label: 'Equals (eq)' },
    { value: 'ne', label: 'Not Equals (ne)' },
    { value: 'contains', label: 'Contains' },
    { value: 'startswith', label: 'Starts With' },
    { value: 'endswith', label: 'Ends With' },
  ],
  number: [
    { value: 'eq', label: 'Equals (eq)' },
    { value: 'ne', label: 'Not Equals (ne)' },
    { value: 'gt', label: 'Greater Than (gt)' },
    { value: 'ge', label: 'Greater Than or Equal (ge)' },
    { value: 'lt', label: 'Less Than (lt)' },
    { value: 'le', label: 'Less Than or Equal (le)' },
  ],
  boolean: [
    { value: 'eq', label: 'Equals (eq)' },
    { value: 'ne', label: 'Not Equals (ne)' },
  ],
  date: [
    { value: 'eq', label: 'Equals (eq)' },
    { value: 'ne', label: 'Not Equals (ne)' },
    { value: 'gt', label: 'Greater Than (gt)' },
    { value: 'ge', label: 'Greater Than or Equal (ge)' },
    { value: 'lt', label: 'Less Than (lt)' },
    { value: 'le', label: 'Less Than or Equal (le)' },
  ],
};

function getOperatorsForType(fieldType: string): Operator[] {
  const type = fieldType.toLowerCase();
  if (type.includes('int') || type.includes('number') || type.includes('decimal') || type.includes('float') || type.includes('double')) {
    return FILTER_OPERATORS.number;
  }
  if (type.includes('bool')) {
    return FILTER_OPERATORS.boolean;
  }
  if (type.includes('date') || type.includes('time')) {
    return FILTER_OPERATORS.date;
  }
  return FILTER_OPERATORS.string;
}
```

### Building Filter Expressions

```typescript
function buildFilterExpression(
  field: string,
  operator: string,
  value: string,
  fieldType: string
): string {
  const type = fieldType.toLowerCase();
  const isNumeric = type.includes('int') || type.includes('number') ||
                    type.includes('decimal') || type.includes('float') || type.includes('double');
  const isBoolean = type.includes('bool');

  // Function-style operators
  if (['contains', 'startswith', 'endswith'].includes(operator)) {
    return `${operator}(${field}, '${value}')`;
  }

  // Numeric values (no quotes)
  if (isNumeric) {
    return `${field} ${operator} ${value}`;
  }

  // Boolean values (no quotes, lowercase)
  if (isBoolean) {
    return `${field} ${operator} ${value.toLowerCase()}`;
  }

  // String values (with quotes)
  return `${field} ${operator} '${value}'`;
}
```

### Validation

```typescript
function validateFilterValue(
  value: string,
  fieldType: string,
  operator: string
): string | null {
  // Allow dynamic variables
  if (value.startsWith('${') && value.endsWith('}')) {
    return null;
  }

  if (!value.trim()) {
    return 'Value is required';
  }

  const type = fieldType.toLowerCase();
  const isNumeric = type.includes('int') || type.includes('number');
  const isBoolean = type.includes('bool');

  if (isNumeric && !['contains', 'startswith', 'endswith'].includes(operator)) {
    if (isNaN(Number(value))) {
      return 'Value must be a number';
    }
  }

  if (isBoolean) {
    const lower = value.toLowerCase();
    if (lower !== 'true' && lower !== 'false') {
      return 'Value must be true or false';
    }
  }

  return null;
}
```

---

## React Component Implementation

### State Management

```typescript
const [focusedParamIndex, setFocusedParamIndex] = useState<number | null>(null);
const [showFieldPicker, setShowFieldPicker] = useState(false);
const [fieldPickerSearch, setFieldPickerSearch] = useState('');
const [selectedPickerField, setSelectedPickerField] = useState<ApiSpecField | null>(null);
const [responseFields, setResponseFields] = useState<ApiSpecField[]>([]);
const [loadingResponseFields, setLoadingResponseFields] = useState(false);

// Filter mode state
const [filterOperator, setFilterOperator] = useState('eq');
const [filterValue, setFilterValue] = useState('');
const [filterValidationError, setFilterValidationError] = useState('');

// OrderBy mode state
const [orderByDirection, setOrderByDirection] = useState<'asc' | 'desc'>('asc');

// Select mode state
const [selectedSelectFields, setSelectedSelectFields] = useState<string[]>([]);

// References to parameter inputs for focus management
const paramInputRefs = useRef<(HTMLInputElement | null)[]>([]);
```

### Opening the Field Picker

```typescript
const handleFieldPickerOpen = async (paramIndex: number) => {
  if (!selectedSpecEndpointId) return;

  setFocusedParamIndex(paramIndex);
  setLoadingResponseFields(true);
  setShowFieldPicker(true);

  // Reset state
  setFieldPickerSearch('');
  setSelectedPickerField(null);
  setFilterOperator('eq');
  setFilterValue('');
  setFilterValidationError('');
  setOrderByDirection('asc');
  setSelectedSelectFields([]);

  // Fetch response fields from database
  const fields = await getFieldsForSpecEndpoint(selectedSpecEndpointId);
  const responseOnlyFields = fields.filter(f => f.field_path.startsWith('[response]'));
  setResponseFields(responseOnlyFields);
  setLoadingResponseFields(false);
};
```

### Adding Filter Expression

```typescript
const handleAddFilter = () => {
  if (focusedParamIndex === null || !selectedPickerField) return;

  const validation = validateFilterValue(filterValue, selectedPickerField.field_type, filterOperator);
  if (validation) {
    setFilterValidationError(validation);
    return;
  }

  const expression = buildFilterExpression(
    selectedPickerField.field_name,
    filterOperator,
    filterValue,
    selectedPickerField.field_type
  );

  // Get current value and append with 'and' if not empty
  const currentValue = queryParameters[focusedParamIndex].value;
  const newValue = currentValue.trim()
    ? `${currentValue} and ${expression}`
    : expression;

  handleParameterChange(focusedParamIndex, 'value', newValue);

  // Close picker and reset
  setShowFieldPicker(false);
  setSelectedPickerField(null);
  setFilterValue('');
  setFilterValidationError('');

  // Return focus to input
  const input = paramInputRefs.current[focusedParamIndex];
  if (input) setTimeout(() => input.focus(), 0);
};
```

### Adding OrderBy Field

```typescript
const handleAddOrderBy = () => {
  if (focusedParamIndex === null || !selectedPickerField) return;

  const fieldExpression = orderByDirection === 'desc'
    ? `${selectedPickerField.field_name} desc`
    : selectedPickerField.field_name;

  const currentValue = queryParameters[focusedParamIndex].value;
  const newValue = currentValue.trim()
    ? `${currentValue},${fieldExpression}`
    : fieldExpression;

  handleParameterChange(focusedParamIndex, 'value', newValue);

  setShowFieldPicker(false);
  setSelectedPickerField(null);
  setOrderByDirection('asc');

  const input = paramInputRefs.current[focusedParamIndex];
  if (input) setTimeout(() => input.focus(), 0);
};
```

### Adding Select Fields

```typescript
const handleToggleSelectField = (fieldName: string) => {
  setSelectedSelectFields(prev =>
    prev.includes(fieldName)
      ? prev.filter(f => f !== fieldName)
      : [...prev, fieldName]
  );
};

const handleAddSelectFields = () => {
  if (focusedParamIndex === null || selectedSelectFields.length === 0) return;

  const currentValue = queryParameters[focusedParamIndex].value;
  const newFields = selectedSelectFields.join(',');
  const newValue = currentValue.trim()
    ? `${currentValue},${newFields}`
    : newFields;

  handleParameterChange(focusedParamIndex, 'value', newValue);

  setShowFieldPicker(false);
  setSelectedSelectFields([]);

  const input = paramInputRefs.current[focusedParamIndex];
  if (input) setTimeout(() => input.focus(), 0);
};
```

---

## UI Component Structure

### Picker Button Visibility

```typescript
const shouldShowPickerButton = (param: QueryParameter): boolean => {
  const type = param.type.toLowerCase();
  // Don't show for integer/number parameters (like limit, offset)
  if (type.includes('int') || type.includes('number') || type === 'integer') {
    return false;
  }
  return getPickerMode(param.key) !== null;
};
```

### Button Rendering

```tsx
{shouldShowPickerButton(param) ? (
  <button
    type="button"
    onClick={() => handleFieldPickerOpen(index)}
    disabled={!selectedSpecEndpointId || loadingResponseFields}
    className="p-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
    title="Pick fields"
  >
    <Braces className="w-4 h-4" />
  </button>
) : (
  <div className="w-6"></div>
)}
```

### Modal Structure (Simplified)

```tsx
{showFieldPicker && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h4 className="text-sm font-medium">
          {currentPickerMode === 'filter' && 'Build Filter Expression'}
          {currentPickerMode === 'orderby' && 'Configure Sort Order'}
          {currentPickerMode === 'select' && 'Select Fields to Return'}
        </h4>
        <button onClick={() => setShowFieldPicker(false)}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content varies by mode */}
      {currentPickerMode === 'select' ? (
        <SelectFieldsUI />
      ) : !selectedPickerField ? (
        <FieldSelectionList />
      ) : currentPickerMode === 'orderby' ? (
        <OrderByConfigUI />
      ) : (
        <FilterConfigUI />
      )}
    </div>
  </div>
)}
```

---

## Data Flow Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                    OpenAPI Spec Upload                           │
│  1. User uploads .yaml/.json spec file                          │
│  2. Parser extracts endpoints and schemas                        │
│  3. Fields stored in api_endpoint_fields table                   │
│     - Query params: field_path = "[query] fieldName"            │
│     - Response fields: field_path = "[response] fieldName"       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Query Configuration                           │
│  1. User selects API endpoint                                    │
│  2. Query parameters loaded from api_endpoint_fields             │
│     (where field_path starts with "[query]")                     │
│  3. Parameters displayed in editable table                       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Field Picker Trigger                          │
│  1. User clicks {} button next to $filter/$orderby/$select       │
│  2. System loads response fields from api_endpoint_fields        │
│     (where field_path starts with "[response]")                  │
│  3. Modal opens with appropriate UI for parameter type           │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Expression Building                           │
│  Filter Mode:                                                    │
│    - Select field → Choose operator → Enter value                │
│    - Output: "fieldName eq 'value'" or "contains(field, 'x')"   │
│                                                                  │
│  OrderBy Mode:                                                   │
│    - Select field → Choose direction (asc/desc)                  │
│    - Output: "fieldName" or "fieldName desc"                     │
│                                                                  │
│  Select Mode:                                                    │
│    - Check multiple fields                                       │
│    - Output: "field1,field2,field3"                             │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Value Insertion                               │
│  1. Expression appended to existing parameter value              │
│     - Filter: " and newExpression" (if value exists)            │
│     - OrderBy: ",newField" (if value exists)                     │
│     - Select: ",newFields" (if value exists)                     │
│  2. Modal closes, focus returns to input                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## User Parameter Integration

The field picker works with user parameters (runtime variables):

```typescript
// User can enter ${variableName} as filter value
// Example: status eq '${@status}'

// These are defined separately and prompted at runtime
interface UserParameter {
  name: string;        // e.g., "@status"
  prompt: string;      // e.g., "Enter a Status"
  dataType: string;    // e.g., "Text (Fixed)"
  fixedValueId?: string; // Link to predefined values
  target?: 'filter' | 'path';
}
```

The validation function allows `${...}` values to pass through without type checking, enabling dynamic substitution at runtime.

---

## Key Implementation Notes

1. **Response fields only**: The picker shows only `[response]` fields, not query parameters or request body fields.

2. **Context-aware UI**: The modal changes completely based on whether you're editing `$filter`, `$orderby`, or `$select`.

3. **Cumulative building**: Values are appended with appropriate separators (`and` for filters, `,` for others).

4. **Type-aware operators**: Filter operators change based on field type (string vs number vs boolean vs date).

5. **Focus management**: After inserting a value, focus returns to the parameter input for continued editing.

6. **Searchable fields**: Large field lists are filterable via a search input.

7. **Preview**: Filter mode shows a preview of the expression being built before adding it.

---

## Example Output

Given a "Drivers" endpoint with fields: `driverId`, `name`, `status`, `currentZone`:

**$filter value:**
```
status eq '@status' and contains(name, 'John')
```

**$orderby value:**
```
name,currentZone desc
```

**$select value:**
```
driverId,currentZone,currentZoneDesc,name,current
```
