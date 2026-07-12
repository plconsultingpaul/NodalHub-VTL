import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { ApiSpec, ApiSpecWithEndpoint } from '../types/database';
import yaml from 'js-yaml';

interface ParsedEndpoint {
  path: string;
  method: string;
  summary: string;
  parameters: unknown[];
  request_body: unknown | null;
  responses: unknown;
}

interface ParsedField {
  field_name: string;
  field_path: string;
  field_type: string;
  is_required: boolean;
  description: string;
  example: string | null;
  format: string | null;
}

const resolveRef = (ref: string, spec: Record<string, unknown>): unknown => {
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

const extractFieldsFromSchema = (
  schema: Record<string, unknown>,
  spec: Record<string, unknown>,
  prefix: string,
  parentPath: string = ''
): ParsedField[] => {
  const fields: ParsedField[] = [];

  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref as string, spec);
    if (resolved && typeof resolved === 'object') {
      return extractFieldsFromSchema(resolved as Record<string, unknown>, spec, prefix, parentPath);
    }
    return fields;
  }

  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (schema.required as string[]) || [];

  if (properties) {
    for (const [fieldName, fieldDef] of Object.entries(properties)) {
      const basePath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
      const fieldPath = `${prefix} ${basePath}`;

      let resolvedDef = fieldDef;
      if (fieldDef.$ref) {
        const resolved = resolveRef(fieldDef.$ref as string, spec);
        if (resolved && typeof resolved === 'object') {
          resolvedDef = resolved as Record<string, unknown>;
        }
      }

      fields.push({
        field_name: fieldName,
        field_path: fieldPath,
        field_type: (resolvedDef.type as string) || 'string',
        is_required: required.includes(fieldName),
        description: (resolvedDef.description as string) || '',
        example: resolvedDef.example ? String(resolvedDef.example) : null,
        format: (resolvedDef.format as string) || null,
      });

      if (resolvedDef.type === 'object' && resolvedDef.properties) {
        fields.push(...extractFieldsFromSchema(resolvedDef as Record<string, unknown>, spec, prefix, basePath));
      }

      if (resolvedDef.type === 'array' && resolvedDef.items) {
        const items = resolvedDef.items as Record<string, unknown>;
        if (items.$ref) {
          const resolved = resolveRef(items.$ref as string, spec);
          if (resolved && typeof resolved === 'object') {
            fields.push(...extractFieldsFromSchema(resolved as Record<string, unknown>, spec, prefix, `${basePath}[]`));
          }
        } else if (items.properties) {
          fields.push(...extractFieldsFromSchema(items as Record<string, unknown>, spec, prefix, `${basePath}[]`));
        }
      }
    }
  }

  return fields;
};

const parseOpenApiSpec = (spec: Record<string, unknown>): { endpoints: ParsedEndpoint[]; fields: Map<string, ParsedField[]> } => {
  const endpoints: ParsedEndpoint[] = [];
  const fieldsMap = new Map<string, ParsedField[]>();

  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined;
  if (!paths) return { endpoints, fields: fieldsMap };

  for (const [path, pathItem] of Object.entries(paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete'];

    for (const method of methods) {
      const operation = pathItem[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const endpointKey = `${method.toUpperCase()}:${path}`;
      const endpointFields: ParsedField[] = [];

      const parameters = (operation.parameters as Record<string, unknown>[]) || [];
      for (const param of parameters) {
        let resolvedParam = param;
        if (param.$ref) {
          const resolved = resolveRef(param.$ref as string, spec);
          if (resolved && typeof resolved === 'object') {
            resolvedParam = resolved as Record<string, unknown>;
          }
        }

        const paramIn = resolvedParam.in as string;
        const paramSchema = resolvedParam.schema as Record<string, unknown> | undefined;

        endpointFields.push({
          field_name: resolvedParam.name as string,
          field_path: `[${paramIn}] ${resolvedParam.name}`,
          field_type: paramSchema?.type as string || 'string',
          is_required: (resolvedParam.required as boolean) || false,
          description: (resolvedParam.description as string) || '',
          example: resolvedParam.example ? String(resolvedParam.example) : null,
          format: paramSchema?.format as string || null,
        });
      }

      const requestBody = operation.requestBody as Record<string, unknown> | undefined;
      if (requestBody) {
        const content = requestBody.content as Record<string, Record<string, unknown>> | undefined;
        const jsonContent = content?.['application/json'];
        if (jsonContent?.schema) {
          endpointFields.push(...extractFieldsFromSchema(jsonContent.schema as Record<string, unknown>, spec, '[body]'));
        }
      }

      const responses = operation.responses as Record<string, Record<string, unknown>> | undefined;
      if (responses) {
        for (const statusCode of ['200', '201', '202', '204']) {
          const response = responses[statusCode];
          if (response?.content) {
            const content = response.content as Record<string, Record<string, unknown>>;
            const jsonContent = content['application/json'];
            if (jsonContent?.schema) {
              endpointFields.push(...extractFieldsFromSchema(jsonContent.schema as Record<string, unknown>, spec, '[response]'));
              break;
            }
          }
        }
      }

      endpoints.push({
        path: path.replace(/^\//, ''),
        method: method.toUpperCase(),
        summary: (operation.summary as string) || (operation.description as string) || '',
        parameters,
        request_body: requestBody || null,
        responses: responses || {},
      });

      fieldsMap.set(endpointKey, endpointFields);
    }
  }

  return { endpoints, fields: fieldsMap };
};

export function useApiSpecs() {
  const { activeCompany } = useAuth();
  const [specs, setSpecs] = useState<ApiSpecWithEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSpecs = useCallback(async () => {
    if (!activeCompany?.id) {
      setSpecs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('api_specs')
      .select(`
        *,
        api_endpoints (id, name, url)
      `)
      .eq('company_id', activeCompany.id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching specs:', error);
    } else {
      setSpecs(data || []);
    }
    setLoading(false);
  }, [activeCompany?.id]);

  useEffect(() => {
    fetchSpecs();
  }, [fetchSpecs]);

  const uploadSpec = async (
    file: File,
    apiEndpointId: string | null
  ): Promise<{ error?: string }> => {
    if (!activeCompany?.id) return { error: 'No company selected' };

    try {
      const content = await file.text();
      let specContent: Record<string, unknown>;

      if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        specContent = yaml.load(content) as Record<string, unknown>;
      } else {
        specContent = JSON.parse(content);
      }

      const info = specContent.info as Record<string, unknown> | undefined;
      if (!info?.title) {
        return { error: 'Invalid spec: missing info.title' };
      }

      const { endpoints, fields } = parseOpenApiSpec(specContent);

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

      if (specError) {
        return { error: specError.message };
      }

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

        if (endpointError) {
          console.error('Error inserting endpoint:', endpointError);
          continue;
        }

        const endpointKey = `${endpoint.method}:/${endpoint.path}`;
        const endpointFields = fields.get(endpointKey) || [];

        if (endpointFields.length > 0) {
          const { error: fieldsError } = await supabase
            .from('api_endpoint_fields')
            .insert(
              endpointFields.map(f => ({
                api_spec_endpoint_id: endpointData.id,
                ...f,
              }))
            );

          if (fieldsError) {
            console.error('Error inserting fields:', fieldsError);
          }
        }
      }

      await fetchSpecs();
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to parse spec file' };
    }
  };

  const deleteSpec = async (specId: string): Promise<{ error?: string }> => {
    const { error: childError } = await supabase
      .from('api_spec_endpoints')
      .delete()
      .eq('api_spec_id', specId);

    if (childError) {
      return { error: childError.message };
    }

    const { error } = await supabase
      .from('api_specs')
      .delete()
      .eq('id', specId);

    if (error) {
      return { error: error.message };
    }

    await fetchSpecs();
    return {};
  };

  const downloadSpec = (spec: ApiSpec) => {
    const content = JSON.stringify(spec.spec_content, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = spec.file_name.replace(/\.(yaml|yml)$/, '.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    specs,
    loading,
    uploadSpec,
    deleteSpec,
    downloadSpec,
    refetch: fetchSpecs,
  };
}
