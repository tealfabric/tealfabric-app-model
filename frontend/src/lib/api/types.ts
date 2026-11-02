export type ApiError = {
  code: string;
  message: string;
  details?: string;
};

export type ApiResponse<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: ApiError };

export type PlatformUser = {
  user_id: string;
  email: string;
  full_name?: string;
  role: string;
  tenant_id?: string;
};

export type AppItem = {
  data_id?: string;
  title: string;
  description?: string;
  status: string;
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type AppFile = {
  filename: string;
  storage_path: string;
  uploaded_by?: string;
  uploaded_at?: string;
  size_bytes?: number;
};

export type IntegrationSummary = {
  integration_id: string;
  name?: string;
  connector_type?: string;
  status?: string;
};

export type BffAction =
  | { action: "health" }
  | { action: "auth_login"; email: string; password: string }
  | { action: "auth_logout" }
  | { action: "auth_bootstrap" }
  | { action: "auth_session" }
  | { action: "list_items"; limit?: number; offset?: number; status?: string }
  | { action: "create_item"; title: string; description?: string; status?: string }
  | { action: "list_files"; prefix?: string }
  | { action: "upload_file"; filename: string; content_base64: string }
  | { action: "list_integrations" }
  | { action: "integration_status" };
