import { useEffect, useRef, useState } from 'react';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import type { ApiEndpoint, DashboardWidget, Json } from '../../types/database';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface TabulatorWidgetProps {
  widget: DashboardWidget;
  endpoint: ApiEndpoint | null;
}

interface ColumnConfig {
  field: string;
  title: string;
  width?: number;
  formatter?: string;
}

interface GridOptions {
  pagination?: boolean;
  pageSize?: number;
  sortable?: boolean;
}

export default function TabulatorWidget({ widget, endpoint }: TabulatorWidgetProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const tabulatorRef = useRef<Tabulator | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, unknown>[]>([]);

  const columnConfig = (widget.column_config as ColumnConfig[]) || [];
  const gridOptions = (widget.grid_options as GridOptions) || { pagination: true, pageSize: 10, sortable: true };

  const fetchData = async () => {
    if (!endpoint) {
      setError('No endpoint configured');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(endpoint.headers as Record<string, string> || {})
      };

      if (endpoint.auth_type === 'bearer') {
        const config = endpoint.auth_config as { token?: string };
        if (config?.token) {
          headers['Authorization'] = `Bearer ${config.token}`;
        }
      } else if (endpoint.auth_type === 'api_key') {
        const config = endpoint.auth_config as { header_name?: string; api_key?: string };
        if (config?.header_name && config?.api_key) {
          headers[config.header_name] = config.api_key;
        }
      } else if (endpoint.auth_type === 'basic') {
        const config = endpoint.auth_config as { username?: string; password?: string };
        if (config?.username && config?.password) {
          headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
        }
      }

      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      let tableData: Record<string, unknown>[] = [];
      if (Array.isArray(result)) {
        tableData = result;
      } else if (result.data && Array.isArray(result.data)) {
        tableData = result.data;
      } else if (result.results && Array.isArray(result.results)) {
        tableData = result.results;
      } else if (result.items && Array.isArray(result.items)) {
        tableData = result.items;
      } else {
        const arrayProp = Object.keys(result).find(key => Array.isArray(result[key]));
        if (arrayProp) {
          tableData = result[arrayProp];
        } else {
          tableData = [result];
        }
      }

      setData(tableData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [endpoint?.id]);

  useEffect(() => {
    if (!tableRef.current || data.length === 0) return;

    if (tabulatorRef.current) {
      tabulatorRef.current.destroy();
    }

    let columns: Tabulator.ColumnDefinition[] = [];

    if (columnConfig.length > 0) {
      columns = columnConfig.map(col => ({
        title: col.title,
        field: col.field,
        width: col.width,
        headerSort: gridOptions.sortable !== false,
        formatter: col.formatter as Tabulator.StandardFormatterName | undefined
      }));
    } else if (data.length > 0) {
      const firstRow = data[0];
      columns = Object.keys(firstRow).map(key => ({
        title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        field: key,
        headerSort: gridOptions.sortable !== false
      }));
    }

    tabulatorRef.current = new Tabulator(tableRef.current, {
      data: data,
      columns: columns,
      layout: 'fitDataFill',
      pagination: gridOptions.pagination !== false,
      paginationSize: gridOptions.pageSize || 10,
      paginationSizeSelector: [5, 10, 25, 50],
      movableColumns: true,
      resizableColumns: true,
      placeholder: 'No data available'
    });

    return () => {
      if (tabulatorRef.current) {
        tabulatorRef.current.destroy();
        tabulatorRef.current = null;
      }
    };
  }, [data, columnConfig, gridOptions]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-red-50 p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-700">Error loading data</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!endpoint) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-sm text-gray-500">No API endpoint configured</p>
          <p className="text-xs text-gray-400 mt-1">Edit this widget to select an endpoint</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        <div ref={tableRef} className="h-full" />
      </div>
    </div>
  );
}
