export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          username: string | null;
          avatar_url: string | null;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          email: string;
          username?: string | null;
          avatar_url?: string | null;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          username?: string | null;
          avatar_url?: string | null;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      companies: {
        Row: {
          id: string;
          name: string;
          logo_url: string | null;
          primary_color: string;
          secondary_color: string;
          sidebar_text_color: string;
          login_logo_size: number | null;
          default_timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          sidebar_text_color?: string;
          login_logo_size?: number | null;
          default_timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          sidebar_text_color?: string;
          login_logo_size?: number | null;
          default_timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      company_memberships: {
        Row: {
          id: string;
          user_id: string;
          company_id: string;
          role: 'Admin' | 'User';
          status: 'active' | 'inactive';
          invitation_sent_at: string | null;
          invitation_sent_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_id: string;
          role?: 'Admin' | 'User';
          status?: 'active' | 'inactive';
          invitation_sent_at?: string | null;
          invitation_sent_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_id?: string;
          role?: 'Admin' | 'User';
          status?: 'active' | 'inactive';
          invitation_sent_at?: string | null;
          invitation_sent_count?: number;
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          company_id: string;
          color: string;
          sort_order: number;
          type: 'dashboards' | 'pulse';
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          company_id: string;
          color?: string;
          sort_order?: number;
          type?: 'dashboards' | 'pulse';
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          company_id?: string;
          color?: string;
          sort_order?: number;
          type?: 'dashboards' | 'pulse';
          created_by?: string | null;
          created_at?: string;
        };
      };
      dashboards: {
        Row: {
          id: string;
          name: string;
          project_id: string;
          company_id: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          auto_refresh_minutes: number | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          name: string;
          project_id: string;
          company_id: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          auto_refresh_minutes?: number | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          name?: string;
          project_id?: string;
          company_id?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          auto_refresh_minutes?: number | null;
          sort_order?: number;
        };
      };
      api_endpoints: {
        Row: {
          id: string;
          name: string;
          url: string;
          method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
          headers: Json;
          auth_type: 'none' | 'api_key' | 'bearer' | 'basic';
          auth_config: Json;
          health_endpoint: string | null;
          endpoint_type: 'standard' | 'nodal_connect';
          company_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          url: string;
          method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
          headers?: Json;
          auth_type?: 'none' | 'api_key' | 'bearer' | 'basic';
          auth_config?: Json;
          health_endpoint?: string | null;
          endpoint_type?: 'standard' | 'nodal_connect';
          company_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          url?: string;
          method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
          headers?: Json;
          auth_type?: 'none' | 'api_key' | 'bearer' | 'basic';
          auth_config?: Json;
          health_endpoint?: string | null;
          endpoint_type?: 'standard' | 'nodal_connect';
          company_id?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      nodal_databases: {
        Row: {
          id: string;
          api_endpoint_id: string;
          name: string;
          connection_id: string;
          company_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          api_endpoint_id: string;
          name: string;
          connection_id: string;
          company_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          api_endpoint_id?: string;
          name?: string;
          connection_id?: string;
          company_id?: string;
          created_at?: string;
        };
      };
      dashboard_widgets: {
        Row: {
          id: string;
          dashboard_id: string;
          endpoint_id: string | null;
          title: string;
          position_x: number;
          position_y: number;
          width: number;
          height: number;
          column_config: Json;
          grid_options: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dashboard_id: string;
          endpoint_id?: string | null;
          title?: string;
          position_x?: number;
          position_y?: number;
          width?: number;
          height?: number;
          column_config?: Json;
          grid_options?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dashboard_id?: string;
          endpoint_id?: string | null;
          title?: string;
          position_x?: number;
          position_y?: number;
          width?: number;
          height?: number;
          column_config?: Json;
          grid_options?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      office365_settings: {
        Row: {
          id: string;
          company_id: string;
          send_from_email: string;
          tenant_id: string;
          client_id: string;
          client_secret: string;
          is_configured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          send_from_email?: string;
          tenant_id?: string;
          client_id?: string;
          client_secret?: string;
          is_configured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          send_from_email?: string;
          tenant_id?: string;
          client_id?: string;
          client_secret?: string;
          is_configured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      api_specs: {
        Row: {
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
        };
        Insert: {
          id?: string;
          company_id: string;
          api_endpoint_id?: string | null;
          name: string;
          file_name: string;
          spec_content: Json;
          version?: string;
          description?: string;
          endpoint_count?: number;
          uploaded_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          api_endpoint_id?: string | null;
          name?: string;
          file_name?: string;
          spec_content?: Json;
          version?: string;
          description?: string;
          endpoint_count?: number;
          uploaded_at?: string;
          updated_at?: string;
        };
      };
      api_spec_endpoints: {
        Row: {
          id: string;
          api_spec_id: string;
          path: string;
          method: string;
          summary: string;
          parameters: Json;
          request_body: Json | null;
          responses: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          api_spec_id: string;
          path: string;
          method: string;
          summary?: string;
          parameters?: Json;
          request_body?: Json | null;
          responses?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          api_spec_id?: string;
          path?: string;
          method?: string;
          summary?: string;
          parameters?: Json;
          request_body?: Json | null;
          responses?: Json;
          created_at?: string;
        };
      };
      api_endpoint_fields: {
        Row: {
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
        };
        Insert: {
          id?: string;
          api_spec_endpoint_id: string;
          field_name: string;
          field_path: string;
          field_type?: string;
          is_required?: boolean;
          description?: string;
          example?: string | null;
          format?: string | null;
          parent_field_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          api_spec_endpoint_id?: string;
          field_name?: string;
          field_path?: string;
          field_type?: string;
          is_required?: boolean;
          description?: string;
          example?: string | null;
          format?: string | null;
          parent_field_id?: string | null;
          created_at?: string;
        };
      };
      queries: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          query_type: 'api_endpoint' | 'sql' | 'stored_procedure';
          purpose_type: 'query' | 'action' | 'lookup';
          app_target: 'dashboard' | 'pulse' | 'both';
          api_endpoint_id: string | null;
          http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
          api_sub_path: string;
          api_spec_endpoint_id: string | null;
          query_parameters: Json;
          url_query_string: string;
          json_parameters: Json;
          is_manual_path: boolean;
          user_parameters: Json;
          request_body_template: string | null;
          request_body_field_mappings: Json;
          path_variable_config: Json;
          last_known_columns: string[];
          nodal_db_connection_id: string | null;
          sql_query_text: string | null;
          proc_name: string | null;
          lookup_value_field: string | null;
          lookup_label_field: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          query_type?: 'api_endpoint' | 'sql' | 'stored_procedure';
          purpose_type?: 'query' | 'action' | 'lookup';
          app_target?: 'dashboard' | 'pulse' | 'both';
          api_endpoint_id?: string | null;
          http_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
          api_sub_path?: string;
          api_spec_endpoint_id?: string | null;
          query_parameters?: Json;
          url_query_string?: string;
          json_parameters?: Json;
          is_manual_path?: boolean;
          user_parameters?: Json;
          request_body_template?: string | null;
          request_body_field_mappings?: Json;
          path_variable_config?: Json;
          last_known_columns?: string[];
          nodal_db_connection_id?: string | null;
          sql_query_text?: string | null;
          proc_name?: string | null;
          lookup_value_field?: string | null;
          lookup_label_field?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          query_type?: 'api_endpoint' | 'sql' | 'stored_procedure';
          purpose_type?: 'query' | 'action' | 'lookup';
          app_target?: 'dashboard' | 'pulse' | 'both';
          api_endpoint_id?: string | null;
          http_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
          api_sub_path?: string;
          api_spec_endpoint_id?: string | null;
          query_parameters?: Json;
          url_query_string?: string;
          json_parameters?: Json;
          is_manual_path?: boolean;
          user_parameters?: Json;
          request_body_template?: string | null;
          request_body_field_mappings?: Json;
          path_variable_config?: Json;
          last_known_columns?: string[];
          nodal_db_connection_id?: string | null;
          sql_query_text?: string | null;
          proc_name?: string | null;
          lookup_value_field?: string | null;
          lookup_label_field?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      dashboard_cells: {
        Row: {
          id: string;
          dashboard_id: string;
          query_id: string | null;
          title: string;
          row_index: number;
          col_index: number;
          row_span: number;
          col_span: number;
          width_percent: number;
          height_percent: number;
          enable_row_selection: boolean;
          check_drilldown_existence: boolean;
          show_parameters_in_header: boolean;
          auto_group_by_column: string | null;
          auto_group_collapsed: boolean;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dashboard_id: string;
          query_id?: string | null;
          title?: string;
          row_index?: number;
          col_index?: number;
          row_span?: number;
          col_span?: number;
          width_percent?: number;
          height_percent?: number;
          enable_row_selection?: boolean;
          check_drilldown_existence?: boolean;
          show_parameters_in_header?: boolean;
          auto_group_by_column?: string | null;
          auto_group_collapsed?: boolean;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dashboard_id?: string;
          query_id?: string | null;
          title?: string;
          row_index?: number;
          col_index?: number;
          row_span?: number;
          col_span?: number;
          width_percent?: number;
          height_percent?: number;
          enable_row_selection?: boolean;
          check_drilldown_existence?: boolean;
          show_parameters_in_header?: boolean;
          auto_group_by_column?: string | null;
          auto_group_collapsed?: boolean;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      dashboard_cell_drilldowns: {
        Row: {
          id: string;
          cell_id: string;
          query_id: string;
          display_name: string;
          link_field: string;
          sort_order: number;
          parameter_mappings: Json;
          column_config: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          cell_id: string;
          query_id: string;
          display_name?: string;
          link_field?: string;
          sort_order?: number;
          parameter_mappings?: Json;
          column_config?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          cell_id?: string;
          query_id?: string;
          display_name?: string;
          link_field?: string;
          sort_order?: number;
          parameter_mappings?: Json;
          column_config?: Json;
          created_at?: string;
        };
      };
      dashboard_cell_actions: {
        Row: {
          id: string;
          cell_id: string;
          query_id: string | null;
          display_name: string;
          display_mode: 'context_menu' | 'button' | 'both';
          parameter_mappings: Json;
          sort_order: number;
          refresh_after_execute: boolean;
          action_type: string;
          popup_template: Json;
          link_url_template: string | null;
          post_action_pulse_id: string | null;
          pulse_variable_mappings: Json;
          prompt_title: string | null;
          prompt_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cell_id: string;
          query_id?: string | null;
          display_name?: string;
          display_mode?: 'context_menu' | 'button' | 'both';
          parameter_mappings?: Json;
          sort_order?: number;
          refresh_after_execute?: boolean;
          action_type?: string;
          popup_template?: Json;
          link_url_template?: string | null;
          post_action_pulse_id?: string | null;
          pulse_variable_mappings?: Json;
          prompt_title?: string | null;
          prompt_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cell_id?: string;
          query_id?: string | null;
          display_name?: string;
          display_mode?: 'context_menu' | 'button' | 'both';
          parameter_mappings?: Json;
          sort_order?: number;
          refresh_after_execute?: boolean;
          action_type?: string;
          popup_template?: Json;
          link_url_template?: string | null;
          post_action_pulse_id?: string | null;
          pulse_variable_mappings?: Json;
          prompt_title?: string | null;
          prompt_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      pulses: {
        Row: {
          id: string;
          company_id: string;
          project_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          query_id: string | null;
          run_mode: 'result_set' | 'per_row' | 'per_group';
          group_by_field: string | null;
          parameter_values: Record<string, string>;
          last_run_at: string | null;
          last_run_status: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          canvas_data: PulseCanvasData | null;
          step_configs: Record<string, PulseStepConfig> | null;
          workflow_version: number;
          trigger_type: 'scheduled' | 'action';
          input_variables: PulseInputVariable[];
          sort_order: number;
        };
        Insert: {
          id?: string;
          company_id: string;
          project_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          query_id?: string | null;
          run_mode?: 'result_set' | 'per_row' | 'per_group';
          group_by_field?: string | null;
          parameter_values?: Record<string, string>;
          last_run_at?: string | null;
          last_run_status?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          canvas_data?: PulseCanvasData | null;
          step_configs?: Record<string, PulseStepConfig> | null;
          workflow_version?: number;
          trigger_type?: 'scheduled' | 'action';
          input_variables?: PulseInputVariable[];
          sort_order?: number;
        };
        Update: {
          id?: string;
          company_id?: string;
          project_id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          query_id?: string | null;
          run_mode?: 'result_set' | 'per_row' | 'per_group';
          group_by_field?: string | null;
          parameter_values?: Record<string, string>;
          last_run_at?: string | null;
          last_run_status?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          canvas_data?: PulseCanvasData | null;
          step_configs?: Record<string, PulseStepConfig> | null;
          workflow_version?: number;
          trigger_type?: 'scheduled' | 'action';
          input_variables?: PulseInputVariable[];
          sort_order?: number;
        };
      };
      pulse_schedules: {
        Row: {
          id: string;
          pulse_id: string;
          label: string;
          enabled: boolean;
          cron_expression: string;
          timezone: string;
          last_scheduled_at: string | null;
          next_run_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pulse_id: string;
          label?: string;
          enabled?: boolean;
          cron_expression?: string;
          timezone?: string;
          last_scheduled_at?: string | null;
          next_run_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pulse_id?: string;
          label?: string;
          enabled?: boolean;
          cron_expression?: string;
          timezone?: string;
          last_scheduled_at?: string | null;
          next_run_at?: string | null;
          updated_at?: string;
        };
      };
      pulse_exports: {
        Row: {
          pulse_id: string;
          enabled: boolean;
          format: 'csv' | 'xlsx';
          filename_template: string;
          include_headers: boolean;
          updated_at: string;
        };
        Insert: {
          pulse_id: string;
          enabled?: boolean;
          format?: 'csv' | 'xlsx';
          filename_template?: string;
          include_headers?: boolean;
          updated_at?: string;
        };
        Update: {
          pulse_id?: string;
          enabled?: boolean;
          format?: 'csv' | 'xlsx';
          filename_template?: string;
          include_headers?: boolean;
          updated_at?: string;
        };
      };
      pulse_emails: {
        Row: {
          pulse_id: string;
          enabled: boolean;
          to_recipients: string[];
          cc_recipients: string[];
          bcc_recipients: string[];
          subject_template: string;
          body_template: string;
          attach_export: boolean;
          only_send_if_results: boolean;
          include_results_table: boolean;
          results_table_columns: string[];
          column_aliases: Record<string, string>;
          column_formats: Record<string, string>;
          include_header_row: boolean;
          updated_at: string;
        };
        Insert: {
          pulse_id: string;
          enabled?: boolean;
          to_recipients?: string[];
          cc_recipients?: string[];
          bcc_recipients?: string[];
          subject_template?: string;
          body_template?: string;
          attach_export?: boolean;
          only_send_if_results?: boolean;
          include_results_table?: boolean;
          results_table_columns?: string[];
          column_aliases?: Record<string, string>;
          column_formats?: Record<string, string>;
          include_header_row?: boolean;
          updated_at?: string;
        };
        Update: {
          pulse_id?: string;
          enabled?: boolean;
          to_recipients?: string[];
          cc_recipients?: string[];
          bcc_recipients?: string[];
          subject_template?: string;
          body_template?: string;
          attach_export?: boolean;
          only_send_if_results?: boolean;
          include_results_table?: boolean;
          results_table_columns?: string[];
          column_aliases?: Record<string, string>;
          column_formats?: Record<string, string>;
          include_header_row?: boolean;
          updated_at?: string;
        };
      };
      pulse_post_run_steps: {
        Row: {
          id: string;
          pulse_id: string;
          sort_order: number;
          name: string;
          config: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          pulse_id: string;
          sort_order?: number;
          name?: string;
          config?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          pulse_id?: string;
          sort_order?: number;
          name?: string;
          config?: Json;
          created_at?: string;
        };
      };
      pulse_executions: {
        Row: {
          id: string;
          pulse_id: string;
          started_at: string;
          finished_at: string | null;
          status: 'running' | 'success' | 'error' | 'partial';
          trigger_source: 'manual' | 'schedule';
          row_count: number;
          error_message: string | null;
          result_summary: Json;
          export_path: string | null;
        };
        Insert: {
          id?: string;
          pulse_id: string;
          started_at?: string;
          finished_at?: string | null;
          status?: 'running' | 'success' | 'error' | 'partial';
          trigger_source?: 'manual' | 'schedule';
          row_count?: number;
          error_message?: string | null;
          result_summary?: Json;
          export_path?: string | null;
        };
        Update: {
          id?: string;
          pulse_id?: string;
          started_at?: string;
          finished_at?: string | null;
          status?: 'running' | 'success' | 'error' | 'partial';
          trigger_source?: 'manual' | 'schedule';
          row_count?: number;
          error_message?: string | null;
          result_summary?: Json;
          export_path?: string | null;
        };
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Company = Database['public']['Tables']['companies']['Row'];
export type CompanyMembership = Database['public']['Tables']['company_memberships']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type Dashboard = Database['public']['Tables']['dashboards']['Row'];
export type ApiEndpoint = Database['public']['Tables']['api_endpoints']['Row'];
export type NodalDatabase = Database['public']['Tables']['nodal_databases']['Row'];
export type EndpointType = 'standard' | 'nodal_connect';
export type DashboardWidget = Database['public']['Tables']['dashboard_widgets']['Row'];
export type Office365Settings = Database['public']['Tables']['office365_settings']['Row'];
export type EmailConfiguration = Database['public']['Tables']['email_configurations']['Row'];

export type EmailProvider = 'office365' | 'gmail';

export interface O365Credentials {
  tenant_id: string;
  client_id: string;
  client_secret: string;
}

export interface GmailCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

export type CompanyWithRole = Company & {
  role: 'Admin' | 'User';
};

export type ProjectType = 'dashboards' | 'pulse';

export type Pulse = Database['public']['Tables']['pulses']['Row'];
export type PulseInsert = Database['public']['Tables']['pulses']['Insert'];
export type PulseUpdate = Database['public']['Tables']['pulses']['Update'];
export type PulseSchedule = Database['public']['Tables']['pulse_schedules']['Row'];
export type PulseExport = Database['public']['Tables']['pulse_exports']['Row'];
export type PulseEmail = Database['public']['Tables']['pulse_emails']['Row'];
export type PulsePostRunStep = Database['public']['Tables']['pulse_post_run_steps']['Row'];
export type PulseExecution = Database['public']['Tables']['pulse_executions']['Row'];

export type PulseRunMode = 'result_set' | 'per_row' | 'per_group';
export type PulseExportFormat = 'csv' | 'xlsx';
export type PulseExecutionStatus = 'running' | 'success' | 'error' | 'partial';
export type PulseTriggerSource = 'manual' | 'schedule';

export type PulseNodeType = 'trigger' | 'query' | 'condition' | 'email';

export interface PulseCanvasNode {
  id: string;
  type: PulseNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    stepName?: string;
    configured?: boolean;
    [key: string]: unknown;
  };
  deletable?: boolean;
}

export interface PulseCanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  style?: Record<string, string>;
  labelStyle?: Record<string, string | number>;
  markerEnd?: unknown;
  animated?: boolean;
}

export interface PulseCanvasData {
  nodes: PulseCanvasNode[];
  edges: PulseCanvasEdge[];
}

export interface PulseInputVariable {
  name: string;
  label: string;
  dataType: 'text' | 'number' | 'date';
}

export interface PulseVariableMapping {
  variableName: string;
  source: 'column' | 'hardcode' | 'prompt' | 'current_user';
  sourceValue: string;
  valueType?: 'text' | 'number' | 'date';
}

export interface PulseTriggerStepConfig {
  stepType: 'trigger';
  scheduleType: 'cron' | 'interval' | 'daily' | 'weekly' | 'monthly';
  cronExpression?: string;
  intervalValue?: number;
  intervalUnit?: 'minutes' | 'hours';
  timeOfDay?: string;
  daysOfWeek?: string[];
  dayOfMonth?: number;
  timezone: string;
  active: boolean;
}

export interface PulseQueryStepConfig {
  stepType: 'query';
  name: string;
  stepName: string;
  queryId?: string;
  queryName?: string;
  parameterValues?: Record<string, string>;
  responseVariableName?: string;
  responsePath?: string;
  timeout?: number;
  retryCount?: number;
  onError?: 'stop' | 'continue';
}

export interface PulseConditionStepConfig {
  stepType: 'condition';
  name: string;
  logicMode: 'all' | 'any';
  conditions: Array<{
    leftOperand: string;
    operator: string;
    rightOperand: string;
    dataType: 'string' | 'number' | 'boolean' | 'date' | 'array';
  }>;
}

export interface PulseEmailStepConfig {
  stepType: 'email';
  name: string;
  toRecipients: string[];
  ccRecipients?: string[];
  bccRecipients?: string[];
  subject: string;
  bodyType: 'html' | 'plain';
  body: string;
  includeAttachment?: boolean;
  attachmentFormat?: 'csv' | 'xlsx' | 'json';
  attachmentFilename?: string;
  dataSource?: string;
  columnMapping?: Record<string, string>;
  onlySendIfResults?: boolean;
  resultsTableColumns?: string[];
  columnAliases?: Record<string, string>;
  columnFormats?: Record<string, string>;
  includeHeaderRow?: boolean;
}

export interface PulseActionStepConfig {
  stepType: 'action';
  name: string;
  stepName: string;
  queryId?: string;
  actionName?: string;
  parameterMappings: Array<{
    paramName: string;
    source: 'query_column' | 'hardcoded' | 'input_variable' | 'fixed_value' | 'date_function';
    sourceValue: string;
    sourceNodeId?: string;
  }>;
  onError?: 'stop' | 'continue';
  timeout?: number;
  retryCount?: number;
}

export type PulseStepConfig =
  | PulseTriggerStepConfig
  | PulseQueryStepConfig
  | PulseConditionStepConfig
  | PulseEmailStepConfig
  | PulseActionStepConfig;

export type ProjectWithDashboards = Project & {
  dashboards: Dashboard[];
  pulses: Pulse[];
};

export type ApiSpec = Database['public']['Tables']['api_specs']['Row'];
export type ApiSpecEndpoint = Database['public']['Tables']['api_spec_endpoints']['Row'];
export type ApiEndpointField = Database['public']['Tables']['api_endpoint_fields']['Row'];

export type ApiSpecWithEndpoint = ApiSpec & {
  api_endpoints?: ApiEndpoint | null;
};

export type Query = Database['public']['Tables']['queries']['Row'];
export type QueryType = 'api_endpoint' | 'sql' | 'stored_procedure';
export type QueryPurposeType = 'query' | 'action' | 'lookup';
export type QueryAppTarget = 'dashboard' | 'pulse' | 'both';

export type UserParameterDataType =
  | 'Text' | 'Date' | 'Integer' | 'Double' | 'Boolean'
  | 'Text (Fixed)' | 'Date (Fixed)' | 'DateTime (Fixed)' | 'Integer (Fixed)' | 'Double (Fixed)'
  | 'Lookup (Fixed)';

export type UserParameterTarget = 'filter' | 'path';

export interface UserParameter {
  name: string;
  prompt: string;
  dataType: UserParameterDataType;
  fixedValueId?: string;
  target?: UserParameterTarget;
}

export type RequestBodyFieldMappingType = 'hardcoded' | 'parameter';
export type RequestBodyFieldDataType = 'string' | 'integer' | 'double' | 'boolean' | 'date' | 'datetime';

export interface RequestBodyFieldMapping {
  fieldName: string;
  type: RequestBodyFieldMappingType;
  value: string;
  dataType: RequestBodyFieldDataType;
}

export type QueryWithRelations = Query & {
  api_endpoints?: ApiEndpoint | null;
  api_spec_endpoints?: ApiSpecEndpoint | null;
};

export type DashboardCell = Database['public']['Tables']['dashboard_cells']['Row'];
export type DashboardCellDrilldown = Database['public']['Tables']['dashboard_cell_drilldowns']['Row'];

export type DashboardCellWithRelations = DashboardCell & {
  queries?: Query | null;
  drilldowns?: DashboardCellDrilldownWithQuery[];
};

export type DashboardCellDrilldownWithQuery = DashboardCellDrilldown & {
  queries?: Query | null;
};

export type DashboardCellAction = Database['public']['Tables']['dashboard_cell_actions']['Row'];

export type DashboardCellActionWithQuery = DashboardCellAction & {
  queries?: Query | null;
};

export type ActionMappingValueType = 'text' | 'date' | 'integer' | 'double' | 'boolean';

export interface ActionParameterMapping {
  parameterName: string;
  target: 'column' | 'hardcode' | 'prompt' | 'lookup' | 'fixed_value' | 'user';
  columnName: string;
  hardcodeValue?: string;
  valueType?: ActionMappingValueType;
  promptText?: string;
  fixedValueId?: string;
  lookupQueryId?: string;
  isPathVariable?: boolean;
  userField?: 'username' | 'full_name';
}

export type ActionType = 'execute' | 'popup' | 'link';

export type ActionVisibilityOperator = 'is_not_empty' | 'is_empty' | 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';

export interface ActionVisibilityCondition {
  field: string;
  operator: ActionVisibilityOperator;
  value: string;
}

export function evaluateVisibilityCondition(
  condition: ActionVisibilityCondition | null | undefined,
  rowData: Record<string, unknown>
): boolean {
  if (!condition || !condition.field) return true;
  const raw = rowData[condition.field];
  const val = raw === null || raw === undefined ? '' : String(raw);

  switch (condition.operator) {
    case 'is_not_empty': return val.trim() !== '';
    case 'is_empty': return val.trim() === '';
    case 'equals': return val === condition.value;
    case 'not_equals': return val !== condition.value;
    case 'contains': return val.toLowerCase().includes((condition.value || '').toLowerCase());
    case 'greater_than': return Number(val) > Number(condition.value);
    case 'less_than': return Number(val) < Number(condition.value);
    default: return true;
  }
}

export interface PopupTemplateSegment {
  type: 'text' | 'field';
  value: string;
}

export type FixedValueType = 'date' | 'datetime' | 'integer' | 'double' | 'text' | 'lookup';

export interface FixedValueListItem {
  value: string;
  description: string;
}

export interface FixedValueDateConfig {
  base_date: string;
  string_format: string;
  adjust_years: number;
  adjust_months: number;
  adjust_days: number;
}

export interface FixedValueDateTimeConfig extends FixedValueDateConfig {
  adjust_hours: number;
  adjust_minutes: number;
  adjust_seconds: number;
}


export interface FixedValue {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  value_type: FixedValueType;
  is_list: boolean;
  single_value: string | null;
  list_values: FixedValueListItem[];
  default_value: string | null;
  is_editable: boolean;
  config: FixedValueDateConfig | FixedValueDateTimeConfig | Record<string, unknown>;
  lookup_query_id: string | null;
  lookup_value_field: string | null;
  lookup_label_field: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type DateFunctionBaseDate =
  | 'today'
  | 'today_date_only'
  | 'first_day_of_month'
  | 'last_day_of_month'
  | 'first_day_of_week'
  | 'last_day_of_week'
  | 'first_day_of_year'
  | 'last_day_of_year'
  | 'first_day_of_last_month'
  | 'last_day_of_last_month'
  | 'first_day_of_last_year'
  | 'last_day_of_last_year';

export interface DateFunction {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  base_date: DateFunctionBaseDate;
  string_format: string;
  adjust_years: number;
  adjust_months: number;
  adjust_days: number;
  created_at: string;
  updated_at: string;
}

export interface GridTemplateColumn {
  field: string;
  position: number;
  width: number;
  title: string;
}

export interface GridTemplateDrilldownColumnConfig {
  columns: GridTemplateColumn[];
}

export interface GridTemplateHeaderFilter {
  field: string;
  type: string;
  value: unknown;
}

export interface GridTemplateCellColumnConfig {
  columns: GridTemplateColumn[];
  drilldowns?: Record<string, GridTemplateDrilldownColumnConfig>;
  headerFilters?: GridTemplateHeaderFilter[];
}

export interface GridTemplateColumnConfig {
  cells: Record<string, GridTemplateCellColumnConfig>;
}

export interface NumberFormatConfig {
  type: 'number' | 'currency' | 'percentage' | 'accounting';
  decimals: number;
  thousandsSeparator: boolean;
  currencySymbol?: string;
  currencyPosition?: 'prefix' | 'suffix';
  negativeFormat?: 'minus' | 'parentheses' | 'red';
}

export interface GridColumnFormatting {
  displayName?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  showFilterIcon?: boolean;
  showCalculationsIcon?: boolean;
  showFilterInput?: boolean;
  dateFormat?: string;
  numberFormat?: NumberFormatConfig;
}

export interface DrilldownFormattingRules {
  grid?: GridColumnFormatting;
  columns?: Record<string, GridColumnFormatting>;
  conditionalFormatting?: ConditionalFormatting[];
}

export interface GridCellFormattingRules {
  grid?: GridColumnFormatting;
  columns?: Record<string, GridColumnFormatting>;
  conditionalFormatting?: ConditionalFormatting[];
  showFilterIcon?: boolean;
  showCalculationsIcon?: boolean;
  showFilterInput?: boolean;
  drilldowns?: Record<string, DrilldownFormattingRules>;
  columnOrder?: string[];
  hiddenColumns?: string[];
  groupBy?: string[];
}

export interface GridFormattingRules {
  cells: Record<string, GridCellFormattingRules>;
}

export type ConditionalDataType =
  | 'Text' | 'Text (Fixed)'
  | 'Date' | 'Date (Fixed)'
  | 'Integer' | 'Integer (Fixed)'
  | 'Double' | 'Double (Fixed)';

export type ConditionalComparison =
  | 'Equals' | 'Not Equals'
  | 'Greater Than' | 'Greater Than or Equal'
  | 'Less Than' | 'Less Than or Equal'
  | 'Contains' | 'Not Contains'
  | 'Starts With' | 'Doesnt Start With'
  | 'Is Null or Empty'
  | 'Is Like' | 'Is Not Like';

export type BlinkSpeed = 'slow' | 'medium' | 'fast';

export interface ConditionalFormattingCondition {
  id: string;
  column: string;
  dataType: ConditionalDataType;
  comparison: ConditionalComparison;
  value: string;
  fixedValueId?: string;
}

export interface ConditionalFormattingAppearance extends GridColumnFormatting {
  blinking?: {
    enabled: boolean;
    speed: BlinkSpeed;
  };
  imagePlaceholder?: string;
}

export interface ConditionalFormattingRule {
  id: string;
  name: string;
  sequence: number;
  enabled: boolean;
  conditionType: 'AND' | 'OR';
  conditions: ConditionalFormattingCondition[];
  formatting: ConditionalFormattingAppearance;
}

export interface ConditionalFormatting {
  target: 'grid' | string;
  rules: ConditionalFormattingRule[];
}

export interface GridTemplate {
  id: string;
  dashboard_id: string;
  name: string;
  is_default: boolean;
  column_config: GridTemplateColumnConfig;
  formatting_rules: GridFormattingRules;
  created_at: string;
  updated_at: string;
}
