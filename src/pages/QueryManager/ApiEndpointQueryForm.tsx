import { useState, useEffect, useRef } from 'react';
import { Info, Eye, Zap, X, Check, Search, ChevronDown, Braces, Plus, Trash2, FileJson } from 'lucide-react';
import { useEndpoints } from '../../hooks/useEndpoints';
import { useQueries, QueryParameter } from '../../hooks/useQueries';
import { useFixedValues } from '../../hooks/useFixedValues';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import type { ApiEndpoint, ApiSpecEndpoint, Query, ApiSpecField, UserParameter, UserParameterDataType, UserParameterTarget, FixedValue, RequestBodyFieldMapping, RequestBodyFieldDataType, QueryPurposeType } from '../../types/database';

interface ApiEndpointQueryFormProps {
  query?: Query | null;
  onSave: (data: Partial<Query>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  saveError?: string;
  onClearError?: () => void;
  onOpenFixedValues?: () => void;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const USER_PARAM_DATA_TYPES: UserParameterDataType[] = [
  'Text', 'Date', 'Integer', 'Double', 'Boolean',
  'Text (Fixed)', 'Date (Fixed)', 'DateTime (Fixed)', 'Integer (Fixed)', 'Double (Fixed)',
  'Lookup (Fixed)'
];

const FIXED_TYPE_TO_VALUE_TYPE: Record<string, string> = {
  'Text (Fixed)': 'text',
  'Date (Fixed)': 'date',
  'DateTime (Fixed)': 'datetime',
  'Integer (Fixed)': 'integer',
  'Double (Fixed)': 'double',
  'Lookup (Fixed)': 'lookup'
};

function isFixedDataType(dataType: UserParameterDataType): boolean {
  return dataType.includes('(Fixed)');
}

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

function getOperatorsForType(fieldType: string): { value: string; label: string }[] {
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

function buildFilterExpression(field: string, operator: string, value: string, fieldType: string): string {
  const type = fieldType.toLowerCase();
  const isNumeric = type.includes('int') || type.includes('number') || type.includes('decimal') || type.includes('float') || type.includes('double');
  const isBoolean = type.includes('bool');

  if (['contains', 'startswith', 'endswith'].includes(operator)) {
    return `${operator}(${field}, '${value}')`;
  }

  if (isNumeric) {
    return `${field} ${operator} ${value}`;
  }

  if (isBoolean) {
    return `${field} ${operator} ${value.toLowerCase()}`;
  }

  return `${field} ${operator} '${value}'`;
}

function validateFilterValue(value: string, fieldType: string, operator: string): string | null {
  if (!value.trim() && !value.startsWith('${')) {
    return 'Value is required';
  }

  if (value.startsWith('${') && value.endsWith('}')) {
    return null;
  }

  const type = fieldType.toLowerCase();
  const isNumeric = type.includes('int') || type.includes('number') || type.includes('decimal') || type.includes('float') || type.includes('double');
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

export default function ApiEndpointQueryForm({ query, onSave, onCancel, saving, saveError, onClearError, onOpenFixedValues }: ApiEndpointQueryFormProps) {
  const { endpoints } = useEndpoints();
  const { getSpecEndpointsForEndpoint, getFieldsForSpecEndpoint, testQuery, buildFullUrl } = useQueries();
  const { fixedValues } = useFixedValues();

  const [name, setName] = useState(query?.name || '');
  const [purposeType, setPurposeType] = useState<QueryPurposeType>(query?.purpose_type || 'query');
  const [selectedEndpointId, setSelectedEndpointId] = useState(query?.api_endpoint_id || '');
  const [httpMethod, setHttpMethod] = useState(query?.http_method || 'GET');
  const [apiSubPath, setApiSubPath] = useState(query?.api_sub_path || '');
  const [isManualPath, setIsManualPath] = useState(query?.is_manual_path || false);
  const [selectedSpecEndpointId, setSelectedSpecEndpointId] = useState(query?.api_spec_endpoint_id || '');
  const [queryParameters, setQueryParameters] = useState<QueryParameter[]>([]);
  const [urlQueryString, setUrlQueryString] = useState(query?.url_query_string || '');
  const [jsonParameters, setJsonParameters] = useState(
    query?.json_parameters ? JSON.stringify(query.json_parameters, null, 2) : '{}'
  );
  const [userParameters, setUserParameters] = useState<UserParameter[]>(
    (query?.user_parameters as UserParameter[]) || []
  );
  const [requestBodyTemplate, setRequestBodyTemplate] = useState(
    query?.request_body_template || ''
  );
  const [requestBodyFieldMappings, setRequestBodyFieldMappings] = useState<RequestBodyFieldMapping[]>(
    (query?.request_body_field_mappings as RequestBodyFieldMapping[]) || []
  );
  const [pathVariableConfig, setPathVariableConfig] = useState<Record<string, string>>(
    (query?.path_variable_config as Record<string, string>) || {}
  );
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);

  const [specEndpoints, setSpecEndpoints] = useState<ApiSpecEndpoint[]>([]);
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [showFullUrl, setShowFullUrl] = useState(false);
  const [testResult, setTestResult] = useState<{ data?: unknown; error?: string; status?: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [subPathSearch, setSubPathSearch] = useState('');
  const [subPathDropdownOpen, setSubPathDropdownOpen] = useState(false);
  const subPathDropdownRef = useRef<HTMLDivElement>(null);
  const [showResponseFields, setShowResponseFields] = useState(false);
  const [responseFields, setResponseFields] = useState<ApiSpecField[]>([]);
  const [loadingResponseFields, setLoadingResponseFields] = useState(false);
  const [focusedParamIndex, setFocusedParamIndex] = useState<number | null>(null);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [fieldPickerSearch, setFieldPickerSearch] = useState('');
  const [selectedPickerField, setSelectedPickerField] = useState<ApiSpecField | null>(null);
  const [filterOperator, setFilterOperator] = useState('eq');
  const [filterValue, setFilterValue] = useState('');
  const [filterValidationError, setFilterValidationError] = useState('');
  const [orderByDirection, setOrderByDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedSelectFields, setSelectedSelectFields] = useState<string[]>([]);
  const paramInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const selectedEndpoint = endpoints.find(e => e.id === selectedEndpointId) || null;

  const detectPathVariables = (path: string): string[] => {
    const regex = /\{([^}]+)\}/g;
    const vars: string[] = [];
    let match;
    while ((match = regex.exec(path)) !== null) {
      vars.push(match[1]);
    }
    return vars;
  };

  const pathVariables = detectPathVariables(apiSubPath);

  const handlePathVariableChange = (variableName: string, value: string) => {
    setPathVariableConfig(prev => ({ ...prev, [variableName]: value }));
  };

  const getPickerMode = (paramKey: string): 'filter' | 'orderby' | 'select' | null => {
    const key = paramKey.toLowerCase();
    if (key === '$filter' || key === 'filter') return 'filter';
    if (key === '$orderby' || key === 'orderby' || key === '$order' || key === 'order') return 'orderby';
    if (key === '$select' || key === 'select') return 'select';
    return null;
  };

  const shouldShowPickerButton = (param: QueryParameter): boolean => {
    const type = param.type.toLowerCase();
    if (type.includes('int') || type.includes('number') || type === 'integer') return false;
    return getPickerMode(param.key) !== null;
  };

  const focusedParam = focusedParamIndex !== null ? queryParameters[focusedParamIndex] : null;
  const currentPickerMode = focusedParam ? getPickerMode(focusedParam.key) : null;

  const savedParametersRef = useRef<QueryParameter[] | null>(null);
  const processedQueryIdRef = useRef<string | null>(null);

  useEffect(() => {
    console.log('[ApiEndpointQueryForm] Query prop changed:', query);
    console.log('[ApiEndpointQueryForm] query.query_parameters:', query?.query_parameters);
    if (query?.id !== processedQueryIdRef.current) {
      processedQueryIdRef.current = null;
    }
    if (query?.query_parameters && Array.isArray(query.query_parameters)) {
      const params = query.query_parameters as QueryParameter[];
      console.log('[ApiEndpointQueryForm] Setting saved params:', params);
      savedParametersRef.current = params;
      setQueryParameters(params);
    }
  }, [query]);

  useEffect(() => {
    const loadSpecEndpoints = async () => {
      if (!selectedEndpointId) {
        setSpecEndpoints([]);
        return;
      }

      setLoadingSpecs(true);
      const endpoints = await getSpecEndpointsForEndpoint(selectedEndpointId);
      setSpecEndpoints(endpoints);
      setLoadingSpecs(false);
    };

    loadSpecEndpoints();
  }, [selectedEndpointId, getSpecEndpointsForEndpoint]);

  useEffect(() => {
    const loadFields = async () => {
      console.log('[loadFields] Called - selectedSpecEndpointId:', selectedSpecEndpointId, 'isManualPath:', isManualPath);
      console.log('[loadFields] savedParametersRef.current:', savedParametersRef.current);
      if (!selectedSpecEndpointId || isManualPath) {
        console.log('[loadFields] Early return');
        return;
      }

      const fields = await getFieldsForSpecEndpoint(selectedSpecEndpointId);
      const queryFields = fields.filter(f => f.field_path.startsWith('[query]'));
      const pathFields = fields.filter(f => f.field_path.startsWith('[path]'));
      console.log('[loadFields] queryFields from spec:', queryFields.map(f => f.field_name));
      console.log('[loadFields] pathFields from spec:', pathFields.map(f => f.field_name));

      if (pathFields.length > 0) {
        setPathVariableConfig(prev => {
          const updated = { ...prev };
          for (const pf of pathFields) {
            if (!(pf.field_name in updated)) {
              updated[pf.field_name] = '';
            }
          }
          return updated;
        });
      }

      if (query?.id && processedQueryIdRef.current === query.id) {
        console.log('[loadFields] Already processed this query, skipping');
        return;
      }

      if (savedParametersRef.current && savedParametersRef.current.length > 0) {
        console.log('[loadFields] Merging with saved params');
        const savedByKey = new Map(savedParametersRef.current.map(p => [p.key, p]));
        console.log('[loadFields] savedByKey keys:', Array.from(savedByKey.keys()));
        const merged = queryFields.map(f => {
          const saved = savedByKey.get(f.field_name);
          console.log('[loadFields] field:', f.field_name, 'found saved:', !!saved, 'value:', saved?.value);
          if (saved) {
            return {
              ...saved,
              type: f.field_type,
              description: f.description,
              example: f.example,
              required: f.is_required
            };
          }
          return {
            key: f.field_name,
            value: '',
            type: f.field_type,
            description: f.description,
            example: f.example,
            enabled: false,
            required: f.is_required
          };
        });
        console.log('[loadFields] Merged result:', merged);
        setQueryParameters(merged);
        if (query?.id) {
          processedQueryIdRef.current = query.id;
        }
        savedParametersRef.current = null;
      } else if (!query?.id) {
        console.log('[loadFields] New query (no ID), using empty spec fields');
        setQueryParameters(
          queryFields.map(f => ({
            key: f.field_name,
            value: '',
            type: f.field_type,
            description: f.description,
            example: f.example,
            enabled: false,
            required: f.is_required
          }))
        );
      } else {
        console.log('[loadFields] Existing query but no saved params to merge, keeping current state');
      }

      const selectedSpec = specEndpoints.find(s => s.id === selectedSpecEndpointId);
      if (selectedSpec) {
        setApiSubPath(selectedSpec.path);
        setHttpMethod(selectedSpec.method);
      }
    };

    loadFields();
  }, [selectedSpecEndpointId, isManualPath, getFieldsForSpecEndpoint, specEndpoints, query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subPathDropdownRef.current && !subPathDropdownRef.current.contains(event.target as Node)) {
        setSubPathDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSpecEndpoints = specEndpoints.filter(
    e => e.method === httpMethod
  );

  const searchFilteredEndpoints = filteredSpecEndpoints.filter(e => {
    if (!subPathSearch.trim()) return true;
    const searchLower = subPathSearch.toLowerCase();
    return (
      e.path.toLowerCase().includes(searchLower) ||
      (e.summary && e.summary.toLowerCase().includes(searchLower))
    );
  });

  const selectedSpecEndpoint = specEndpoints.find(s => s.id === selectedSpecEndpointId);

  const handleParameterChange = (index: number, field: keyof QueryParameter, value: string | boolean) => {
    const updated = [...queryParameters];
    updated[index] = { ...updated[index], [field]: value };
    setQueryParameters(updated);
  };

  const handleClearAll = () => {
    setQueryParameters(params => params.map(p => ({ ...p, enabled: false, value: '' })));
  };

  const handleAddUserParameter = () => {
    setUserParameters(prev => [
      ...prev,
      { name: '@', prompt: '', dataType: 'Text' }
    ]);
  };

  const handleUpdateUserParameter = (index: number, field: keyof UserParameter, value: string) => {
    setUserParameters(prev => {
      const updated = [...prev];
      if (field === 'name') {
        updated[index] = { ...updated[index], name: value.startsWith('@') ? value : `@${value}` };
      } else if (field === 'dataType') {
        const newDataType = value as UserParameterDataType;
        updated[index] = {
          ...updated[index],
          dataType: newDataType,
          fixedValueId: isFixedDataType(newDataType) ? updated[index].fixedValueId : undefined
        };
      } else if (field === 'fixedValueId') {
        updated[index] = { ...updated[index], fixedValueId: value || undefined };
      } else if (field === 'target') {
        updated[index] = { ...updated[index], target: (value as UserParameterTarget) || 'filter' };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const getFixedValuesForType = (dataType: UserParameterDataType): FixedValue[] => {
    const valueType = FIXED_TYPE_TO_VALUE_TYPE[dataType];
    if (!valueType) return [];
    return fixedValues.filter(fv => fv.value_type === valueType);
  };

  const handleRemoveUserParameter = (index: number) => {
    setUserParameters(prev => prev.filter((_, i) => i !== index));
  };

  const generateRequestBodyFieldMappings = () => {
    if (!requestBodyTemplate.trim()) {
      setJsonParseError('Please enter a JSON template first');
      return;
    }

    try {
      const template = JSON.parse(requestBodyTemplate);
      const fieldMappings: RequestBodyFieldMapping[] = [];

      const extractFields = (obj: unknown, prefix = '') => {
        if (obj === null || obj === undefined) return;

        if (Array.isArray(obj) && obj.length > 0) {
          const firstItem = obj[0];
          if (firstItem && typeof firstItem === 'object') {
            extractFields(firstItem, `${prefix}[0]`);
          }
          return;
        }

        if (typeof obj === 'object') {
          for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            const fieldName = prefix ? `${prefix}.${key}` : key;

            if (Array.isArray(value) && value.length > 0) {
              const firstItem = value[0];
              if (firstItem && typeof firstItem === 'object') {
                extractFields(firstItem, `${fieldName}[0]`);
              }
            } else if (value && typeof value === 'object') {
              extractFields(value, fieldName);
            } else {
              let dataType: RequestBodyFieldDataType = 'string';
              if (typeof value === 'number') {
                dataType = Number.isInteger(value) ? 'integer' : 'double';
              } else if (typeof value === 'boolean') {
                dataType = 'boolean';
              } else if (typeof value === 'string') {
                if (/^\d{4}-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12]\d)((T| )([01]\d|2[0-3]):([0-5]\d):([0-5]\d))?/.test(value)) {
                  dataType = 'datetime';
                }
              }

              fieldMappings.push({
                fieldName,
                type: 'hardcoded',
                value: String(value ?? ''),
                dataType
              });
            }
          }
        }
      };

      extractFields(template);

      const existingFieldNames = new Set(requestBodyFieldMappings.map(m => m.fieldName));
      const newMappings = fieldMappings.filter(m => !existingFieldNames.has(m.fieldName));
      setRequestBodyFieldMappings(prev => [...prev, ...newMappings]);
      setJsonParseError(null);
    } catch (error: unknown) {
      let errorMessage = 'Invalid JSON format. Please check the syntax.';
      if (error instanceof Error && error.message) {
        const positionMatch = error.message.match(/position (\d+)/i);
        if (positionMatch) {
          const position = parseInt(positionMatch[1], 10);
          const lines = requestBodyTemplate.substring(0, position).split('\n');
          const lineNumber = lines.length;
          const columnNumber = lines[lines.length - 1].length + 1;
          errorMessage = `JSON parse error at line ${lineNumber}, column ${columnNumber}: ${error.message}`;
        } else {
          errorMessage = `JSON parse error: ${error.message}`;
        }
      }
      setJsonParseError(errorMessage);
    }
  };

  const handleUpdateFieldMapping = (index: number, field: keyof RequestBodyFieldMapping, value: string) => {
    setRequestBodyFieldMappings(prev => {
      const updated = [...prev];
      if (field === 'type') {
        updated[index] = { ...updated[index], type: value as 'hardcoded' | 'parameter' };
      } else if (field === 'dataType') {
        updated[index] = { ...updated[index], dataType: value as RequestBodyFieldDataType };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleRemoveFieldMapping = (index: number) => {
    setRequestBodyFieldMappings(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddFieldMapping = () => {
    setRequestBodyFieldMappings(prev => [
      ...prev,
      { fieldName: '', type: 'hardcoded', value: '', dataType: 'string' }
    ]);
  };

  const handleViewResponseFields = async () => {
    if (!selectedSpecEndpointId) return;

    setLoadingResponseFields(true);
    setShowResponseFields(true);

    const fields = await getFieldsForSpecEndpoint(selectedSpecEndpointId);
    const responseOnlyFields = fields.filter(f => f.field_path.startsWith('[response]'));
    setResponseFields(responseOnlyFields);
    setLoadingResponseFields(false);
  };

  const handleFieldPickerOpen = async (paramIndex: number) => {
    if (!selectedSpecEndpointId) return;

    setFocusedParamIndex(paramIndex);
    setLoadingResponseFields(true);
    setShowFieldPicker(true);
    setFieldPickerSearch('');
    setSelectedPickerField(null);
    setFilterOperator('eq');
    setFilterValue('');
    setFilterValidationError('');
    setOrderByDirection('asc');
    setSelectedSelectFields([]);

    const fields = await getFieldsForSpecEndpoint(selectedSpecEndpointId);
    const responseOnlyFields = fields.filter(f => f.field_path.startsWith('[response]'));
    setResponseFields(responseOnlyFields);
    setLoadingResponseFields(false);
  };

  const handleFieldSelect = (field: ApiSpecField) => {
    setSelectedPickerField(field);
    setFilterOperator('eq');
    setFilterValue('');
    setFilterValidationError('');
  };

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

    const input = paramInputRefs.current[focusedParamIndex];
    if (input) {
      const currentValue = queryParameters[focusedParamIndex].value;
      const newValue = currentValue.trim()
        ? `${currentValue} and ${expression}`
        : expression;
      handleParameterChange(focusedParamIndex, 'value', newValue);

      setShowFieldPicker(false);
      setSelectedPickerField(null);
      setFilterValue('');
      setFilterValidationError('');

      setTimeout(() => {
        input.focus();
      }, 0);
    }
  };

  const handleAddOrderBy = () => {
    if (focusedParamIndex === null || !selectedPickerField) return;

    const fieldExpression = orderByDirection === 'desc'
      ? `${selectedPickerField.field_name} desc`
      : selectedPickerField.field_name;

    const input = paramInputRefs.current[focusedParamIndex];
    if (input) {
      const currentValue = queryParameters[focusedParamIndex].value;
      const newValue = currentValue.trim()
        ? `${currentValue},${fieldExpression}`
        : fieldExpression;
      handleParameterChange(focusedParamIndex, 'value', newValue);

      setShowFieldPicker(false);
      setSelectedPickerField(null);
      setOrderByDirection('asc');

      setTimeout(() => {
        input.focus();
      }, 0);
    }
  };

  const handleToggleSelectField = (fieldName: string) => {
    setSelectedSelectFields(prev =>
      prev.includes(fieldName)
        ? prev.filter(f => f !== fieldName)
        : [...prev, fieldName]
    );
  };

  const handleAddSelectFields = () => {
    if (focusedParamIndex === null || selectedSelectFields.length === 0) return;

    const input = paramInputRefs.current[focusedParamIndex];
    if (input) {
      const currentValue = queryParameters[focusedParamIndex].value;
      const newFields = selectedSelectFields.join(',');
      const newValue = currentValue.trim()
        ? `${currentValue},${newFields}`
        : newFields;
      handleParameterChange(focusedParamIndex, 'value', newValue);

      setShowFieldPicker(false);
      setSelectedSelectFields([]);

      setTimeout(() => {
        input.focus();
      }, 0);
    }
  };

  const filteredPickerFields = responseFields.filter(field => {
    if (!fieldPickerSearch.trim()) return true;
    const searchLower = fieldPickerSearch.toLowerCase();
    return (
      field.field_name.toLowerCase().includes(searchLower) ||
      (field.description && field.description.toLowerCase().includes(searchLower))
    );
  });

  const handleShowFullUrl = () => {
    setShowFullUrl(true);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!selectedEndpoint) return;

    setTesting(true);
    setTestResult(null);

    let parsedJson = {};
    try {
      parsedJson = JSON.parse(jsonParameters);
    } catch {
      parsedJson = {};
    }

    const result = await testQuery(
      selectedEndpoint,
      apiSubPath,
      httpMethod,
      queryParameters,
      urlQueryString,
      parsedJson,
      pathVariableConfig
    );

    setTestResult(result);
    setTesting(false);
  };

  const handleSave = async () => {
    let parsedJson = {};
    try {
      parsedJson = JSON.parse(jsonParameters);
    } catch {
      parsedJson = {};
    }

    console.log('[ApiEndpointQueryForm] handleSave called');
    console.log('[ApiEndpointQueryForm] queryParameters state:', queryParameters);
    console.log('[ApiEndpointQueryForm] Enabled params:', queryParameters.filter(p => p.enabled));

    const saveData = {
      name,
      purpose_type: purposeType,
      query_type: 'api_endpoint',
      api_endpoint_id: selectedEndpointId || null,
      http_method: httpMethod as Query['http_method'],
      api_sub_path: apiSubPath,
      api_spec_endpoint_id: isManualPath ? null : selectedSpecEndpointId || null,
      query_parameters: queryParameters,
      url_query_string: urlQueryString,
      json_parameters: parsedJson,
      is_manual_path: isManualPath,
      user_parameters: userParameters.filter(p => p.name.length > 1 && p.prompt.trim()),
      request_body_template: requestBodyTemplate || null,
      request_body_field_mappings: requestBodyFieldMappings.length > 0 ? requestBodyFieldMappings : [],
      path_variable_config: Object.keys(pathVariableConfig).length > 0 ? pathVariableConfig : {}
    };

    console.log('[ApiEndpointQueryForm] Save data:', saveData);

    await onSave(saveData);
  };

  const fullUrl = buildFullUrl(selectedEndpoint, apiSubPath, queryParameters, urlQueryString, pathVariableConfig);

  const hasIncompleteUserParams = userParameters.some(p => p.name.length > 1 && !p.prompt.trim());

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      <div>
        <label className="block text-sm font-medium text-orange-500 mb-1">Query Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            onClearError?.();
          }}
          className={`w-full px-3 py-2 border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
            saveError ? 'border-red-500' : 'border-blue-500'
          }`}
          placeholder="Search Container Trips"
        />
        {saveError && (
          <p className="mt-1 text-sm text-red-600">{saveError}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-orange-500 mb-1">Type</label>
        <CustomDropdown
          value={purposeType}
          onChange={(val) => setPurposeType(val as QueryPurposeType)}
          options={[
            { value: 'query', label: 'Query' },
            { value: 'action', label: 'Action' },
            { value: 'lookup', label: 'Lookup' }
          ]}
          className="w-48"
        />
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Step Configuration</h4>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Endpoint</label>
            <CustomDropdown
              value={selectedEndpointId}
              onChange={(val) => {
                setSelectedEndpointId(val);
                setSelectedSpecEndpointId('');
                setApiSubPath('');
                setQueryParameters([]);
              }}
              options={endpoints.map((endpoint) => ({
                value: endpoint.id,
                label: `${endpoint.name} (${endpoint.url})`
              }))}
              placeholder="Select an endpoint..."
              autoWidth
            />
            <p className="mt-1 text-xs text-gray-500">Select from API endpoints configured for this trading partner</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HTTP Method</label>
            <CustomDropdown
              value={httpMethod}
              onChange={(val) => {
                setHttpMethod(val);
                setSelectedSpecEndpointId('');
              }}
              options={HTTP_METHODS.map((method) => ({ value: method, label: method }))}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Sub-path</label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isManualPath}
                  onChange={(e) => {
                    setIsManualPath(e.target.checked);
                    if (e.target.checked) {
                      setSelectedSpecEndpointId('');
                    }
                  }}
                  className="rounded border-gray-300"
                />
                Enter manually
              </label>
            </div>

            {isManualPath ? (
              <input
                type="text"
                value={apiSubPath}
                onChange={(e) => setApiSubPath(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:bg-gray-700 dark:text-white"
                placeholder="api/v1/resource"
              />
            ) : (
              <div ref={subPathDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!loadingSpecs && selectedEndpointId) {
                      setSubPathDropdownOpen(!subPathDropdownOpen);
                      setSubPathSearch('');
                    }
                  }}
                  disabled={loadingSpecs || !selectedEndpointId}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:bg-gray-700 dark:text-white disabled:opacity-50 text-left flex items-center justify-between"
                >
                  <span className={selectedSpecEndpoint ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
                    {selectedSpecEndpoint
                      ? `${selectedSpecEndpoint.path} - ${selectedSpecEndpoint.summary || 'No description'}`
                      : 'Select a path from API specification...'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${subPathDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {subPathDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                    <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={subPathSearch}
                          onChange={(e) => setSubPathSearch(e.target.value)}
                          placeholder="Search endpoints..."
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {searchFilteredEndpoints.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">No matching endpoints</div>
                      ) : (
                        searchFilteredEndpoints.map((spec) => (
                          <button
                            key={spec.id}
                            type="button"
                            onClick={() => {
                              setSelectedSpecEndpointId(spec.id);
                              setSubPathDropdownOpen(false);
                              setSubPathSearch('');
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              spec.id === selectedSpecEndpointId ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                            }`}
                          >
                            <span className="font-medium text-gray-900 dark:text-white">{spec.path}</span>
                            <span className="text-gray-500 dark:text-gray-400"> - {spec.summary || 'No description'}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {filteredSpecEndpoints.length} endpoints available from API specification
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {pathVariables.length > 0 && (
        <div className="border rounded-lg p-4 dark:border-gray-600 bg-amber-50/50 dark:bg-amber-900/10">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Path Variables
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Configure values for path variables in the URL
            </p>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_2fr_auto] gap-2 text-xs font-medium text-gray-500 px-2">
              <div>Variable</div>
              <div>Value</div>
              <div></div>
            </div>

            {pathVariables.map((variable) => (
              <div key={variable} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300 px-2">
                  {'{' + variable + '}'}
                </span>
                <input
                  type="text"
                  value={pathVariableConfig[variable] || ''}
                  onChange={(e) => handlePathVariableChange(variable, e.target.value)}
                  placeholder="value or {{variableName}}"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-black dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => handlePathVariableChange(variable, '')}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Clear value"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Values are substituted into the URL at execution time. Use {'{{variableName}}'} for dynamic references.
          </p>
        </div>
      )}

      {queryParameters.length > 0 && (
        <div className="border rounded-lg p-4 dark:border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Query Parameters ({queryParameters.length} available)
            </h4>
            <button
              onClick={handleClearAll}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 text-xs font-medium text-gray-500 px-2">
              <div></div>
              <div>Key</div>
              <div>Value</div>
              <div></div>
            </div>

            {queryParameters.map((param, index) => (
              <div key={param.key} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
                <input
                  type="checkbox"
                  checked={param.enabled}
                  onChange={(e) => handleParameterChange(index, 'enabled', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <div className="flex items-center gap-1">
                  <span className="text-sm dark:text-white">{param.key}</span>
                  <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                    {param.type}
                  </span>
                  {param.description && (
                    <button className="text-gray-400 hover:text-gray-600" title={param.description}>
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input
                  ref={(el) => { paramInputRefs.current[index] = el; }}
                  type="text"
                  value={param.value}
                  onChange={(e) => handleParameterChange(index, 'value', e.target.value)}
                  onFocus={() => setFocusedParamIndex(index)}
                  placeholder={param.example || 'value'}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-black dark:bg-gray-700 dark:text-white"
                />
                {shouldShowPickerButton(param) ? (
                  <button
                    type="button"
                    onClick={() => handleFieldPickerOpen(index)}
                    disabled={!selectedSpecEndpointId || loadingResponseFields}
                    className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Pick fields"
                  >
                    <Braces className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-6"></div>
                )}
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Parameters from API specification. Check to enable and enter values. Use {'${variableName}'} for dynamic values.
          </p>
        </div>
      )}

      <div className="border rounded-lg p-4 dark:border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            User Parameters
          </h4>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddUserParameter}
          >
            <Plus className="w-4 h-4" />
            Add Parameter
          </Button>
        </div>

        {userParameters.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {purposeType === 'action'
              ? 'No parameters defined. Add parameters that will be mapped to grid column values when this action is triggered from a Dashboard Cell.'
              : 'No user parameters defined. Add parameters to prompt users for values at runtime.'}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_1.5fr_150px_100px_130px_auto] gap-2 text-xs font-medium text-gray-500 px-1">
              <div>Parameter Name</div>
              <div>Prompt Text</div>
              <div>Data Type</div>
              <div>Target</div>
              <div>Fixed Value</div>
              <div></div>
            </div>

            {userParameters.map((param, index) => {
              const availableFixedValues = isFixedDataType(param.dataType) ? getFixedValuesForType(param.dataType) : [];
              return (
                <div key={index} className="grid grid-cols-[1fr_1.5fr_150px_100px_130px_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={param.name}
                    onChange={(e) => handleUpdateUserParameter(index, 'name', e.target.value)}
                    className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                    placeholder="@ParamName"
                  />
                  <input
                    type="text"
                    value={param.prompt}
                    onChange={(e) => handleUpdateUserParameter(index, 'prompt', e.target.value)}
                    className={`px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                      param.name.length > 1 && !param.prompt.trim()
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter a value for..."
                  />
                  <CustomDropdown
                    value={param.dataType}
                    onChange={(val) => handleUpdateUserParameter(index, 'dataType', val)}
                    options={USER_PARAM_DATA_TYPES.map((type) => ({ value: type, label: type }))}
                    size="sm"
                    autoWidth
                    dropdownMinWidth={160}
                  />
                  <CustomDropdown
                    value={param.target || 'filter'}
                    onChange={(val) => handleUpdateUserParameter(index, 'target', val)}
                    options={[
                      { value: 'filter', label: 'Filter' },
                      { value: 'path', label: 'Path' },
                    ]}
                    size="sm"
                  />
                  {isFixedDataType(param.dataType) ? (
                    availableFixedValues.length > 0 ? (
                      <CustomDropdown
                        value={param.fixedValueId || ''}
                        onChange={(val) => handleUpdateUserParameter(index, 'fixedValueId', val)}
                        options={availableFixedValues.map((fv) => ({ value: fv.id, label: fv.name }))}
                        placeholder="Select..."
                        size="sm"
                        autoWidth
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenFixedValues}
                        className="text-xs text-amber-600 dark:text-amber-400 hover:underline whitespace-nowrap px-1"
                        title="Open Fixed Values to create one"
                      >
                        {param.dataType === 'Lookup (Fixed)' ? 'Create a Lookup Fixed Value first' : 'No fixed values available'}
                      </button>
                    )
                  ) : (
                    <div className="text-xs text-gray-400 italic px-2">N/A</div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveUserParameter(index)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                    title="Remove parameter"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-xs text-gray-500">
          User parameters are prompted at runtime. Use "Filter" target to substitute in query values, or "Path" target to substitute in URL path parameters (e.g., {'{vendorId}'}).
        </p>
        {purposeType === 'action' && userParameters.length > 0 && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Action parameters are configured in the Dashboard Cell where this action is used. Parameters will be mapped to grid column values at execution time. The "Prompt Text" field is used as a label in the mapping UI.
            </p>
          </div>
        )}
        {hasIncompleteUserParams && (
          <p className="mt-2 text-xs text-red-600">
            Please enter prompt text for all user parameters. Parameters without prompts cannot be saved.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          URL Query String
          <span className="ml-2 text-xs text-orange-500">(Not used if Query Parameters table is filled)</span>
        </label>
        <textarea
          value={urlQueryString}
          onChange={(e) => setUrlQueryString(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:bg-gray-700 dark:text-white font-mono text-sm"
          rows={2}
          placeholder="$filter=status eq 'active' and date gt '${startDate}'&$select=id,name&limit=10"
        />
        <p className="mt-1 text-xs text-gray-500">
          Custom query string for complex parameters (e.g., $filter, $select, limit). Use {'${variableName}'} for variables.
          Takes precedence over Query Parameters if both are filled.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Query Parameters (JSON)
        </label>
        <textarea
          value={jsonParameters}
          onChange={(e) => setJsonParameters(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:bg-gray-700 dark:text-white font-mono text-sm"
          rows={3}
          placeholder='{"status": "active", "clientId": "${clientId}"}'
        />
        <p className="mt-1 text-xs text-gray-500">
          Use {'${variableName}'} to reference variables. Simpler alternative for basic key-value parameters.
        </p>
      </div>

      {['POST', 'PUT', 'PATCH'].includes(httpMethod) && (
        <div className="border rounded-lg p-4 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Request Body
            </h4>
            <Button
              variant="secondary"
              size="sm"
              onClick={generateRequestBodyFieldMappings}
              disabled={!requestBodyTemplate.trim()}
            >
              <FileJson className="w-4 h-4" />
              Map JSON
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Enter the JSON structure for the request body
              </label>
              <textarea
                value={requestBodyTemplate}
                onChange={(e) => {
                  setRequestBodyTemplate(e.target.value);
                  setJsonParseError(null);
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm ${
                  jsonParseError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                rows={6}
                placeholder={`{
  "name": "assignBooking",
  "inputs": {
    "IBOOKING_NUMBER": "AAAAAA",
    "IORIG_TERMINAL": "AAAAAA"
  }
}`}
              />
              {jsonParseError && (
                <p className="mt-1 text-xs text-red-600">{jsonParseError}</p>
              )}
            </div>

            {requestBodyFieldMappings.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Field Mappings
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleAddFieldMapping}
                  >
                    <Plus className="w-3 h-3" />
                    Add Field
                  </Button>
                </div>
                <div className="border border-gray-200 dark:border-gray-600 rounded-md overflow-visible">
                  <table className="w-full text-sm table-fixed">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-[30%]">Field Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-[18%]">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-[30%]">Value</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-[15%]">Data Type</th>
                        <th className="px-3 py-2 w-[7%]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {requestBodyFieldMappings.map((mapping, index) => (
                        <tr key={index} className="bg-white dark:bg-gray-800">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={mapping.fieldName}
                              onChange={(e) => handleUpdateFieldMapping(index, 'fieldName', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                              placeholder="field.path"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <CustomDropdown
                              value={mapping.type}
                              onChange={(val) => handleUpdateFieldMapping(index, 'type', val)}
                              options={[
                                { value: 'hardcoded', label: 'Hardcoded' },
                                { value: 'parameter', label: 'Parameter' },
                              ]}
                              size="sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {mapping.type === 'parameter' ? (
                              <CustomDropdown
                                value={mapping.value}
                                onChange={(val) => handleUpdateFieldMapping(index, 'value', val)}
                                options={userParameters.filter(p => p.name.length > 1).map(p => ({ value: p.name, label: p.name }))}
                                placeholder="Select parameter..."
                                size="sm"
                              />
                            ) : (
                              <input
                                type="text"
                                value={mapping.value}
                                onChange={(e) => handleUpdateFieldMapping(index, 'value', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                placeholder="Enter value"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <CustomDropdown
                              value={mapping.dataType}
                              onChange={(val) => handleUpdateFieldMapping(index, 'dataType', val)}
                              options={[
                                { value: 'string', label: 'String' },
                                { value: 'integer', label: 'Integer' },
                                { value: 'double', label: 'Double' },
                                { value: 'boolean', label: 'Boolean' },
                                { value: 'date', label: 'Date' },
                                { value: 'datetime', label: 'DateTime' },
                              ]}
                              size="sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveFieldMapping(index)}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Remove mapping"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Set Type to "Parameter" to use user parameter values at runtime.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showFieldPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Braces className="w-4 h-4" />
                {currentPickerMode === 'filter' && (selectedPickerField ? 'Build Filter Expression' : 'Select Field for Filter')}
                {currentPickerMode === 'orderby' && (selectedPickerField ? 'Configure Sort Order' : 'Select Field to Sort By')}
                {currentPickerMode === 'select' && 'Select Fields to Return'}
              </h4>
              <button
                onClick={() => {
                  setShowFieldPicker(false);
                  setSelectedPickerField(null);
                  setSelectedSelectFields([]);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {currentPickerMode === 'select' ? (
              <>
                <div className="p-3 border-b dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={fieldPickerSearch}
                      onChange={(e) => setFieldPickerSearch(e.target.value)}
                      placeholder="Search fields..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {loadingResponseFields ? (
                    <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading fields...</p>
                  ) : filteredPickerFields.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No matching fields found</p>
                  ) : (
                    filteredPickerFields.map((field) => (
                      <label
                        key={field.id}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSelectFields.includes(field.field_name)}
                          onChange={() => handleToggleSelectField(field.field_name)}
                          className="rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-900 dark:text-white">{field.field_name}</span>
                            <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-600 rounded text-gray-600 dark:text-gray-300">
                              {field.field_type}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {selectedSelectFields.length > 0 && (
                  <div className="p-3 border-t dark:border-gray-700">
                    <div className="text-xs text-gray-500 mb-2">
                      Selected: {selectedSelectFields.join(', ')}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setSelectedSelectFields([])}
                      >
                        Clear
                      </Button>
                      <Button onClick={handleAddSelectFields}>
                        <Check className="w-4 h-4" />
                        Add Fields
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : !selectedPickerField ? (
              <>
                <div className="p-3 border-b dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={fieldPickerSearch}
                      onChange={(e) => setFieldPickerSearch(e.target.value)}
                      placeholder="Search fields..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {loadingResponseFields ? (
                    <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading fields...</p>
                  ) : filteredPickerFields.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No matching fields found</p>
                  ) : (
                    filteredPickerFields.map((field) => (
                      <button
                        key={field.id}
                        type="button"
                        onClick={() => handleFieldSelect(field)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-gray-900 dark:text-white">{field.field_name}</span>
                          <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-600 rounded text-gray-600 dark:text-gray-300">
                            {field.field_type}
                          </span>
                        </div>
                        {field.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{field.description}</p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : currentPickerMode === 'orderby' ? (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Selected Field</label>
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <span className="font-mono text-sm text-gray-900 dark:text-white">{selectedPickerField.field_name}</span>
                    <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded text-gray-600 dark:text-gray-300">
                      {selectedPickerField.field_type}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPickerField(null)}
                      className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sort Direction</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOrderByDirection('asc')}
                      className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                        orderByDirection === 'asc'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      Ascending (A-Z, 0-9)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderByDirection('desc')}
                      className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                        orderByDirection === 'desc'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      Descending (Z-A, 9-0)
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t dark:border-gray-700">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Preview</label>
                  <code className="block p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-800 dark:text-gray-200">
                    {orderByDirection === 'desc'
                      ? `${selectedPickerField.field_name} desc`
                      : selectedPickerField.field_name}
                  </code>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedPickerField(null)}
                  >
                    Back
                  </Button>
                  <Button onClick={handleAddOrderBy}>
                    <Check className="w-4 h-4" />
                    Add Sort Field
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Selected Field</label>
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <span className="font-mono text-sm text-gray-900 dark:text-white">{selectedPickerField.field_name}</span>
                    <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded text-gray-600 dark:text-gray-300">
                      {selectedPickerField.field_type}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPickerField(null)}
                      className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Filter Operator</label>
                  <CustomDropdown
                    value={filterOperator}
                    onChange={(val) => {
                      setFilterOperator(val);
                      setFilterValidationError('');
                    }}
                    options={getOperatorsForType(selectedPickerField.field_type)}
                    size="sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Value</label>
                  <input
                    type="text"
                    value={filterValue}
                    onChange={(e) => {
                      setFilterValue(e.target.value);
                      setFilterValidationError('');
                    }}
                    placeholder={selectedPickerField.example || 'Enter value...'}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm ${
                      filterValidationError
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    autoFocus
                  />
                  {filterValidationError && (
                    <p className="mt-1 text-xs text-red-500">{filterValidationError}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Use {'${variableName}'} for dynamic values
                  </p>
                </div>

                <div className="pt-2 border-t dark:border-gray-700">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Preview</label>
                  <code className="block p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-800 dark:text-gray-200">
                    {filterValue
                      ? buildFilterExpression(selectedPickerField.field_name, filterOperator, filterValue, selectedPickerField.field_type)
                      : `${selectedPickerField.field_name} ${filterOperator} ...`}
                  </code>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedPickerField(null)}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleAddFilter}
                    disabled={!filterValue.trim()}
                  >
                    <Check className="w-4 h-4" />
                    Add Filter
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showFullUrl && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Full URL</h4>
            <button onClick={() => setShowFullUrl(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <code className="block text-xs bg-white dark:bg-gray-800 p-2 rounded border break-all">
            {fullUrl || 'Select an endpoint and configure parameters'}
          </code>
        </div>
      )}

      {testResult && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              Test Result
              {testResult.status && (
                <span className={`px-2 py-0.5 text-xs rounded ${
                  testResult.status >= 200 && testResult.status < 300
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {testResult.status}
                </span>
              )}
            </h4>
            <button onClick={() => setTestResult(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          {testResult.error ? (
            <p className="text-sm text-red-600">{testResult.error}</p>
          ) : (
            <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded border overflow-auto max-h-48">
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t dark:border-gray-600">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleShowFullUrl}
            disabled={!selectedEndpoint}
          >
            <Eye className="w-4 h-4" />
            Show Full URL
          </Button>
          <Button
            onClick={handleTestConnection}
            disabled={!selectedEndpoint || testing}
            loading={testing}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Zap className="w-4 h-4" />
            Test Connection
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!name.trim() || !selectedEndpointId || hasIncompleteUserParams}
            title={hasIncompleteUserParams ? 'Please fill in prompt text for all user parameters' : undefined}
          >
            <Check className="w-4 h-4" />
            Save Step
          </Button>
        </div>
      </div>
    </div>
  );
}
