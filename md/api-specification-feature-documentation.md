# API Specification Upload & Field Viewer Documentation

This document provides a detailed guide on how OpenAPI/Swagger specifications are uploaded, parsed, stored, and displayed in the application. It covers the complete data flow from file upload through to the field viewer modal.

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [OpenAPI Spec Parsing](#openapi-spec-parsing)
4. [Upload Flow](#upload-flow)
5. [Viewer Modal Implementation](#viewer-modal-implementation)
6. [Field Path Convention](#field-path-convention)
7. [React Component Structure](#react-component-structure)

---

## Overview

The API Specification feature allows users to:

1. Upload OpenAPI/Swagger specification files (JSON or YAML)
2. Link specs to configured API endpoints
3. View parsed endpoints and their fields in a dual-pane viewer
4. Filter fields by type (PARAMS, BODY, RESPONSE)
5. Search and filter endpoints by HTTP method
6. Download specs for offline use

### Supported Formats

- **OpenAPI 3.0+** (JSON or YAML)
- **Swagger 2.0** (JSON or YAML)

File extensions: `.json`, `.yaml`, `.yml`
Maximum file size: 10MB

---

## Database Schema

### Three-Table Architecture

The specification data is stored across three related tables:

#### 1. `api_specs` - The main specification record

```sql
CREATE TABLE api_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  api_endpoint_id uuid REFERENCES api_endpoints(id) ON DELETE SET NULL,
  name text NOT NULL,                    -- From info.title in spec
  file_name text NOT NULL,               -- Original uploaded filename
  spec_content jsonb NOT NULL,           -- Full raw spec content
  version text DEFAULT '1.0.0',          -- From info.version
  description text DEFAULT '',           -- From info.description
  endpoint_count integer DEFAULT 0,      -- Count of parsed endpoints
  uploaded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 2. `api_spec_endpoints` - Individual endpoints from the spec

```sql
CREATE TABLE api_spec_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_spec_id uuid NOT NULL REFERENCES api_specs(id) ON DELETE CASCADE,
  path text NOT NULL,                    -- e.g., "orders/{orderId}"
  method text NOT NULL,                  -- GET, POST, PUT, PATCH, DELETE
  summary text DEFAULT '',               -- Operation summary
  parameters jsonb DEFAULT '[]',         -- Raw parameters array
  request_body jsonb,                    -- Raw requestBody object
  responses jsonb DEFAULT '{}',          -- Raw responses object
  created_at timestamptz DEFAULT now()
);
```

#### 3. `api_endpoint_fields` - Extracted fields with metadata

```sql
CREATE TABLE api_endpoint_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_spec_endpoint_id uuid NOT NULL REFERENCES api_spec_endpoints(id) ON DELETE CASCADE,
  field_name text NOT NULL,              -- Simple field name (e.g., "orderId")
  field_path text NOT NULL,              -- Full path with prefix (e.g., "[response] orders[].orderId")
  field_type text DEFAULT 'string',      -- string, integer, number, boolean, array, object
  is_required boolean DEFAULT false,     -- From schema required array
  description text DEFAULT '',           -- Field description
  example text,                          -- Example value
  format text,                           -- Format (date-time, email, uuid, etc.)
  parent_field_id uuid REFERENCES api_endpoint_fields(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
```

### Entity Relationship

```
api_specs (1) ──────── (N) api_spec_endpoints (1) ──────── (N) api_endpoint_fields
     │
     │
     └── api_endpoint_id ─── (optional link to) ─── api_endpoints
```

---

## OpenAPI Spec Parsing

### Parser Architecture

The `useApiSpecs` hook contains the parsing logic that extracts endpoints and fields from an OpenAPI spec.

### Reference Resolution

OpenAPI specs use `$ref` for schema references. The parser resolves these recursively:

```typescript
const resolveRef = (ref: string, spec: Record<string, unknown>): unknown => {
  // ref format: "#/components/schemas/Order"
  const parts = ref.replace('#/', '').split('/');
  let current: unknown = spec;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return current;
};
```

### Field Extraction from Schema

The recursive `extractFieldsFromSchema` function processes object schemas:

```typescript
const extractFieldsFromSchema = (
  schema: Record<string, unknown>,
  spec: Record<string, unknown>,
  prefix: string,           // "[query]", "[body]", "[response]"
  parentPath: string = ''
): ParsedField[] => {
  const fields: ParsedField[] = [];

  // Step 1: Resolve $ref if present
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref as string, spec);
    if (resolved && typeof resolved === 'object') {
      return extractFieldsFromSchema(resolved, spec, prefix, parentPath);
    }
    return fields;
  }

  // Step 2: Process properties
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  const required = (schema.required as string[]) || [];

  if (properties) {
    for (const [fieldName, fieldDef] of Object.entries(properties)) {
      // Build the path: parentPath.fieldName or just fieldName
      const basePath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
      const fieldPath = `${prefix} ${basePath}`;

      // Resolve nested $ref in field definition
      let resolvedDef = fieldDef;
      if (fieldDef.$ref) {
        const resolved = resolveRef(fieldDef.$ref as string, spec);
        if (resolved) resolvedDef = resolved;
      }

      // Add the field
      fields.push({
        field_name: fieldName,
        field_path: fieldPath,
        field_type: resolvedDef.type || 'string',
        is_required: required.includes(fieldName),
        description: resolvedDef.description || '',
        example: resolvedDef.example ? String(resolvedDef.example) : null,
        format: resolvedDef.format || null,
      });

      // Step 3: Recurse for nested objects
      if (resolvedDef.type === 'object' && resolvedDef.properties) {
        fields.push(...extractFieldsFromSchema(resolvedDef, spec, prefix, basePath));
      }

      // Step 4: Handle arrays - append [] to path
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

### Main Parsing Function

```typescript
const parseOpenApiSpec = (spec: Record<string, unknown>): {
  endpoints: ParsedEndpoint[];
  fields: Map<string, ParsedField[]>;
} => {
  const endpoints: ParsedEndpoint[] = [];
  const fieldsMap = new Map<string, ParsedField[]>();

  const paths = spec.paths as Record<string, Record<string, unknown>>;
  if (!paths) return { endpoints, fields: fieldsMap };

  for (const [path, pathItem] of Object.entries(paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete'];

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const endpointKey = `${method.toUpperCase()}:${path}`;
      const endpointFields: ParsedField[] = [];

      // 1. Extract PARAMETERS (query, path, header)
      const parameters = operation.parameters || [];
      for (const param of parameters) {
        let resolvedParam = param;
        if (param.$ref) {
          resolvedParam = resolveRef(param.$ref, spec) || param;
        }

        const paramIn = resolvedParam.in; // "query", "path", "header"
        const paramSchema = resolvedParam.schema || {};

        endpointFields.push({
          field_name: resolvedParam.name,
          field_path: `[${paramIn}] ${resolvedParam.name}`,
          field_type: paramSchema.type || 'string',
          is_required: resolvedParam.required || false,
          description: resolvedParam.description || '',
          example: resolvedParam.example ? String(resolvedParam.example) : null,
          format: paramSchema.format || null,
        });
      }

      // 2. Extract REQUEST BODY fields
      const requestBody = operation.requestBody;
      if (requestBody) {
        const jsonContent = requestBody.content?.['application/json'];
        if (jsonContent?.schema) {
          endpointFields.push(...extractFieldsFromSchema(jsonContent.schema, spec, '[body]'));
        }
      }

      // 3. Extract RESPONSE fields (from 200/201/202/204)
      const responses = operation.responses;
      if (responses) {
        for (const statusCode of ['200', '201', '202', '204']) {
          const response = responses[statusCode];
          if (response?.content?.['application/json']?.schema) {
            endpointFields.push(
              ...extractFieldsFromSchema(response.content['application/json'].schema, spec, '[response]')
            );
            break; // Only process first successful response
          }
        }
      }

      // Store endpoint and its fields
      endpoints.push({
        path: path.replace(/^\//, ''), // Remove leading slash
        method: method.toUpperCase(),
        summary: operation.summary || operation.description || '',
        parameters,
        request_body: requestBody || null,
        responses: responses || {},
      });

      fieldsMap.set(endpointKey, endpointFields);
    }
  }

  return { endpoints, fields: fieldsMap };
};
```

---

## Upload Flow

### Step-by-Step Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. USER UPLOADS FILE                         │
│  - Accepts .json, .yaml, .yml files                            │
│  - Maximum size: 10MB                                           │
│  - Optional: Link to existing API Endpoint                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. PARSE FILE CONTENT                        │
│  - YAML files: Parsed using js-yaml library                    │
│  - JSON files: Parsed using JSON.parse()                       │
│  - Validate info.title exists (required)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. EXTRACT DATA                              │
│  - parseOpenApiSpec() extracts endpoints and fields            │
│  - Fields organized by endpoint with path prefixes             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. SAVE TO api_specs TABLE                   │
│  INSERT INTO api_specs:                                         │
│    - company_id                                                 │
│    - api_endpoint_id (optional link)                           │
│    - name (from info.title)                                    │
│    - file_name (original filename)                             │
│    - spec_content (full JSON content)                          │
│    - version (from info.version)                               │
│    - description (from info.description)                       │
│    - endpoint_count (number of endpoints parsed)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              5. SAVE EACH ENDPOINT (api_spec_endpoints)         │
│  FOR EACH endpoint:                                             │
│    INSERT INTO api_spec_endpoints:                              │
│      - api_spec_id                                              │
│      - path, method, summary                                    │
│      - parameters (raw JSON)                                    │
│      - request_body (raw JSON)                                  │
│      - responses (raw JSON)                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              6. SAVE FIELDS (api_endpoint_fields)               │
│  FOR EACH endpoint's fields:                                    │
│    INSERT INTO api_endpoint_fields:                             │
│      - api_spec_endpoint_id                                     │
│      - field_name, field_path                                   │
│      - field_type, is_required                                  │
│      - description, example, format                             │
└─────────────────────────────────────────────────────────────────┘
```

### Upload Hook Implementation

```typescript
const uploadSpec = async (
  file: File,
  apiEndpointId: string | null
): Promise<{ error?: string }> => {
  if (!activeCompany?.id) return { error: 'No company selected' };

  try {
    // Step 1: Read file content
    const content = await file.text();
    let specContent: Record<string, unknown>;

    // Step 2: Parse based on file type
    if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
      specContent = yaml.load(content) as Record<string, unknown>;
    } else {
      specContent = JSON.parse(content);
    }

    // Step 3: Validate spec structure
    const info = specContent.info as Record<string, unknown>;
    if (!info?.title) {
      return { error: 'Invalid spec: missing info.title' };
    }

    // Step 4: Parse endpoints and fields
    const { endpoints, fields } = parseOpenApiSpec(specContent);

    // Step 5: Save main spec record
    const { data: specData, error: specError } = await supabase
      .from('api_specs')
      .insert({
        company_id: activeCompany.id,
        api_endpoint_id: apiEndpointId,
        name: info.title as string,
        file_name: file.name,
        spec_content: specContent,
        version: (info.version as string) || '1.0.0',
        description: (info.description as string) || '',
        endpoint_count: endpoints.length,
      })
      .select()
      .single();

    if (specError) return { error: specError.message };

    // Step 6: Save each endpoint and its fields
    for (const endpoint of endpoints) {
      const { data: endpointData, error: endpointError } = await supabase
        .from('api_spec_endpoints')
        .insert({
          api_spec_id: specData.id,
          path: endpoint.path,
          method: endpoint.method,
          summary: endpoint.summary,
          parameters: endpoint.parameters,
          request_body: endpoint.request_body,
          responses: endpoint.responses,
        })
        .select()
        .single();

      if (endpointError) continue;

      // Get fields for this endpoint
      const endpointKey = `${endpoint.method}:/${endpoint.path}`;
      const endpointFields = fields.get(endpointKey) || [];

      if (endpointFields.length > 0) {
        await supabase
          .from('api_endpoint_fields')
          .insert(
            endpointFields.map(f => ({
              api_spec_endpoint_id: endpointData.id,
              ...f,
            }))
          );
      }
    }

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to parse spec file' };
  }
};
```

---

## Field Path Convention

### Path Prefixes

Fields are stored with a prefix indicating their source location:

| Prefix | Description | Example |
|--------|-------------|---------|
| `[query]` | URL query parameters | `[query] $filter` |
| `[path]` | URL path parameters | `[path] orderId` |
| `[header]` | HTTP header parameters | `[header] Authorization` |
| `[body]` | Request body fields | `[body] customer.name` |
| `[response]` | Response body fields | `[response] orders[].status` |

### Nested Path Notation

```
Simple field:          [response] count
Nested object:         [response] customer.address.city
Array element:         [response] orders
Array element field:   [response] orders[].orderId
Deeply nested:         [response] orders[].aCharges[].aChargeCode
```

### Visual Example from Screenshot

```
Field Path                                              Type
─────────────────────────────────────────────────────────────
[response] count                                        integer
[response] filter                                       string
[response] limit                                        integer
[response] offset                                       integer
[response] orders                                       array
[response] orders[].aCharges                           array
[response] orders[].aCharges[].aChargeCode             string
[response] orders[].aCharges[].aChargeCurrencyRates    object
[response] orders[].aCharges[].aChargeCurrencyRates.amount  number
```

---

## Viewer Modal Implementation

### Dual-Pane Layout

The viewer modal displays:
- **Left Pane**: Searchable, filterable list of endpoints
- **Right Pane**: Fields for the selected endpoint

### State Management

```typescript
// Endpoints list state
const [endpoints, setEndpoints] = useState<ApiSpecEndpoint[]>([]);
const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
const [endpointSearchQuery, setEndpointSearchQuery] = useState('');
const [methodFilter, setMethodFilter] = useState('ALL');

// Fields list state
const [fields, setFields] = useState<ApiEndpointField[]>([]);
const [fieldSearchQuery, setFieldSearchQuery] = useState('');
const [fieldTypeFilter, setFieldTypeFilter] = useState('ALL'); // ALL, PARAMS, BODY, RESPONSE

// Loading states
const [loadingEndpoints, setLoadingEndpoints] = useState(true);
const [loadingFields, setLoadingFields] = useState(false);
```

### Loading Endpoints

```typescript
useEffect(() => {
  const fetchEndpoints = async () => {
    setLoadingEndpoints(true);

    const { data, error } = await supabase
      .from('api_spec_endpoints')
      .select('*')
      .eq('api_spec_id', spec.id)
      .order('path');

    if (!error && data) {
      setEndpoints(data);
    }
    setLoadingEndpoints(false);
  };

  fetchEndpoints();
}, [spec.id]);
```

### Loading Fields for Selected Endpoint

```typescript
const handleSelectEndpoint = async (endpoint: ApiSpecEndpoint) => {
  setSelectedEndpointId(endpoint.id);
  setLoadingFields(true);
  setFields([]);
  setFieldSearchQuery('');
  setFieldTypeFilter('ALL');

  const { data, error } = await supabase
    .from('api_endpoint_fields')
    .select('*')
    .eq('api_spec_endpoint_id', endpoint.id)
    .order('field_path');

  if (!error && data) {
    setFields(data);
  }
  setLoadingFields(false);
};
```

### Field Filtering Logic

```typescript
const filteredFields = fields.filter((field) => {
  // Search filter
  const matchesSearch = !fieldSearchQuery ||
    field.field_path.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
    field.description?.toLowerCase().includes(fieldSearchQuery.toLowerCase());

  // Type filter (PARAMS, BODY, RESPONSE)
  const matchesType = fieldTypeFilter === 'ALL' ||
    (fieldTypeFilter === 'PARAMS' && (
      field.field_path.startsWith('[query]') ||
      field.field_path.startsWith('[path]') ||
      field.field_path.startsWith('[header]')
    )) ||
    (fieldTypeFilter === 'BODY' && field.field_path.startsWith('[body]')) ||
    (fieldTypeFilter === 'RESPONSE' && field.field_path.startsWith('[response]'));

  return matchesSearch && matchesType;
});
```

### Color-Coded Type Badges

#### HTTP Method Colors

```typescript
const getMethodBadgeClasses = (method: string) => {
  switch (method) {
    case 'GET': return 'bg-blue-100 text-blue-700';
    case 'POST': return 'bg-green-100 text-green-700';
    case 'PUT': return 'bg-yellow-100 text-yellow-700';
    case 'PATCH': return 'bg-orange-100 text-orange-700';
    case 'DELETE': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};
```

#### Field Type Colors

```typescript
const getFieldTypeBadgeClasses = (fieldType: string) => {
  switch (fieldType) {
    case 'string': return 'bg-blue-100 text-blue-700';
    case 'number':
    case 'integer': return 'bg-green-100 text-green-700';
    case 'boolean': return 'bg-teal-100 text-teal-700';
    case 'array': return 'bg-orange-100 text-orange-700';
    case 'object': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};
```

---

## React Component Structure

### File Organization

```
src/
├── hooks/
│   └── useApiSpecs.ts          # Upload, parse, delete, download logic
├── pages/
│   └── Settings/
│       └── ApiSpecs.tsx        # List view & upload modal
├── components/
│   └── ApiSpecViewerModal.tsx  # Dual-pane viewer modal
└── types/
    └── database.ts             # TypeScript interfaces
```

### TypeScript Interfaces

```typescript
interface ApiSpec {
  id: string;
  company_id: string;
  api_endpoint_id: string | null;
  name: string;
  file_name: string;
  spec_content: Json;
  version: string;
  description: string;
  endpoint_count: number;
  uploaded_at: string;
  updated_at: string;
}

interface ApiSpecEndpoint {
  id: string;
  api_spec_id: string;
  path: string;
  method: string;
  summary: string;
  parameters: Json;
  request_body: Json | null;
  responses: Json;
  created_at: string;
}

interface ApiEndpointField {
  id: string;
  api_spec_endpoint_id: string;
  field_name: string;
  field_path: string;
  field_type: string;
  is_required: boolean;
  description: string;
  example: string | null;
  format: string | null;
  parent_field_id: string | null;
  created_at: string;
}

// Extended type with joined data
interface ApiSpecWithEndpoint extends ApiSpec {
  api_endpoints?: {
    id: string;
    name: string;
    url: string;
  } | null;
}
```

### Modal Component Props

```typescript
interface ApiSpecViewerModalProps {
  spec: ApiSpecWithEndpoint;
  onClose: () => void;
  onDownload: (spec: ApiSpecWithEndpoint) => void;
}
```

### Main List Component Features

The `ApiSpecs.tsx` component provides:

1. **Spec List Display**
   - Shows name, version, linked endpoint, file name, upload date, endpoint count
   - Action buttons: View, Download, Delete

2. **Upload Modal**
   - Optional API endpoint selection for linking
   - File input for JSON/YAML files
   - Validation feedback

3. **Filter by Endpoint**
   - Dropdown to filter specs by linked API endpoint

4. **Delete Confirmation**
   - Confirmation modal before deletion
   - Cascade delete removes all endpoints and fields

---

## Usage in Other Features

### Query Manager Integration

The extracted fields are used by the Field Picker in the Query Manager:

```typescript
// Get response fields for an endpoint
const getFieldsForSpecEndpoint = async (specEndpointId: string): Promise<ApiEndpointField[]> => {
  const { data } = await supabase
    .from('api_endpoint_fields')
    .select('*')
    .eq('api_spec_endpoint_id', specEndpointId)
    .order('field_path');

  return data || [];
};

// Filter to only response fields
const responseFields = fields.filter(f => f.field_path.startsWith('[response]'));

// Filter to only query parameters
const queryParams = fields.filter(f => f.field_path.startsWith('[query]'));
```

---

## Summary

The API Specification feature provides a complete workflow for:

1. **Uploading** OpenAPI specs with YAML/JSON support
2. **Parsing** endpoints, parameters, request bodies, and response schemas
3. **Storing** structured data across three related tables
4. **Viewing** with searchable dual-pane interface
5. **Filtering** by HTTP method and field type (PARAMS/BODY/RESPONSE)
6. **Displaying** nested fields with clear path notation and type badges

This extracted field data is then used by the Field Picker feature in the Query Manager to help users build filter expressions, sort orders, and field selections.
