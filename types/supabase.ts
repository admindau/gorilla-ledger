export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          amount_minor: number
          category_id: string
          created_at: string
          id: string
          month: number
          updated_at: string
          user_id: string
          wallet_id: string | null
          year: number
        }
        Insert: {
          amount_minor: number
          category_id: string
          created_at?: string
          id?: string
          month: number
          updated_at?: string
          user_id: string
          wallet_id?: string | null
          year: number
        }
        Update: {
          amount_minor?: number
          category_id?: string
          created_at?: string
          id?: string
          month?: number
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: string | null
          message: string
          name: string
          organisation: string | null
          source_path: string | null
          type: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          message: string
          name: string
          organisation?: string | null
          source_path?: string | null
          type?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          message?: string
          name?: string
          organisation?: string | null
          source_path?: string | null
          type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          decimals: number
          name: string
          symbol: string | null
        }
        Insert: {
          code: string
          created_at?: string
          decimals?: number
          name: string
          symbol?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          decimals?: number
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      fixing_schedule: {
        Row: {
          created_at: string
          created_by: string | null
          created_email: string | null
          id: string
          next_fixing_date: string
          notes: string | null
          updated_at: string
          window_label: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_email?: string | null
          id?: string
          next_fixing_date: string
          notes?: string | null
          updated_at?: string
          window_label?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_email?: string | null
          id?: string
          next_fixing_date?: string
          notes?: string | null
          updated_at?: string
          window_label?: string | null
        }
        Relationships: []
      }
      fx_daily_rates: {
        Row: {
          as_of_date: string
          base_currency: string
          created_at: string
          id: number
          is_manual_override: boolean
          is_official: boolean
          quote_currency: string
          rate_mid: number
          source_id: number
        }
        Insert: {
          as_of_date: string
          base_currency: string
          created_at?: string
          id?: number
          is_manual_override?: boolean
          is_official?: boolean
          quote_currency: string
          rate_mid: number
          source_id?: number
        }
        Update: {
          as_of_date?: string
          base_currency?: string
          created_at?: string
          id?: number
          is_manual_override?: boolean
          is_official?: boolean
          quote_currency?: string
          rate_mid?: number
          source_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fx_daily_rates_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_daily_rates_quote_currency_fkey"
            columns: ["quote_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_daily_rates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "fx_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_import_jobs: {
        Row: {
          created_at: string
          finished_at: string | null
          id: number
          import_type: Database["public"]["Enums"]["fx_import_type"]
          log: string | null
          raw_location: string | null
          source_id: number
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: number
          import_type: Database["public"]["Enums"]["fx_import_type"]
          log?: string | null
          raw_location?: string | null
          source_id?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: number
          import_type?: Database["public"]["Enums"]["fx_import_type"]
          log?: string | null
          raw_location?: string | null
          source_id?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_import_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "fx_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_import_raw: {
        Row: {
          created_at: string
          id: number
          job_id: number
          row_data: Json
          row_index: number
        }
        Insert: {
          created_at?: string
          id?: number
          job_id?: number
          row_data: Json
          row_index: number
        }
        Update: {
          created_at?: string
          id?: number
          job_id?: number
          row_data?: Json
          row_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "fx_import_raw_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "fx_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_sources: {
        Row: {
          code: string
          created_at: string
          id: number
          is_official: boolean
          label: string
          priority: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: number
          is_official?: boolean
          label: string
          priority?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: number
          is_official?: boolean
          label?: string
          priority?: number
        }
        Relationships: []
      }
      manual_fixings: {
        Row: {
          as_of_date: string
          base_currency: string
          created_at: string
          created_by: string | null
          created_email: string | null
          id: string
          is_manual_override: boolean
          is_official: boolean
          notes: string | null
          quote_currency: string
          rate_mid: number
        }
        Insert: {
          as_of_date: string
          base_currency: string
          created_at?: string
          created_by?: string | null
          created_email?: string | null
          id?: string
          is_manual_override?: boolean
          is_official?: boolean
          notes?: string | null
          quote_currency: string
          rate_mid: number
        }
        Update: {
          as_of_date?: string
          base_currency?: string
          created_at?: string
          created_by?: string | null
          created_email?: string | null
          id?: string
          is_manual_override?: boolean
          is_official?: boolean
          notes?: string | null
          quote_currency?: string
          rate_mid?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_currency: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          original_name?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_run_logs: {
        Row: {
          created_at: string
          details: string | null
          id: string
          rule_id: string
          run_at: string
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          rule_id: string
          run_at?: string
          status: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          rule_id?: string
          run_at?: string
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_run_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_run_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_run_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          amount_minor: number
          category_id: string | null
          created_at: string
          currency_code: string
          day_of_month: number | null
          day_of_week: number | null
          description: string | null
          end_date: string | null
          frequency: string
          id: string
          interval: number
          is_active: boolean
          last_run_at: string | null
          next_run_at: string
          start_date: string
          total_runs: number
          type: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount_minor: number
          category_id?: string | null
          created_at?: string
          currency_code: string
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          interval?: number
          is_active?: boolean
          last_run_at?: string | null
          next_run_at: string
          start_date: string
          total_runs?: number
          type: string
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount_minor?: number
          category_id?: string | null
          created_at?: string
          currency_code?: string
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          interval?: number
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string
          start_date?: string
          total_runs?: number
          type?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_minor: number
          category_id: string | null
          created_at: string
          currency_code: string
          description: string | null
          id: string
          occurred_at: string
          total_runs: number
          type: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount_minor: number
          category_id?: string | null
          created_at?: string
          currency_code: string
          description?: string | null
          id?: string
          occurred_at?: string
          total_runs?: number
          type: string
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount_minor?: number
          category_id?: string | null
          created_at?: string
          currency_code?: string
          description?: string | null
          id?: string
          occurred_at?: string
          total_runs?: number
          type?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          created_at: string
          currency_code: string
          id: string
          name: string
          starting_balance_minor: number
          total_runs: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          id?: string
          name: string
          starting_balance_minor?: number
          total_runs?: number
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          id?: string
          name?: string
          starting_balance_minor?: number
          total_runs?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      category_spending_current_month: {
        Row: {
          category_name: string | null
          currency: string | null
          total_spent: number | null
        }
        Relationships: []
      }
      category_spending_current_year: {
        Row: {
          category_name: string | null
          currency: string | null
          total_spent: number | null
        }
        Relationships: []
      }
      daily_income_expense: {
        Row: {
          currency_code: string | null
          day: string | null
          expense: number | null
          income: number | null
        }
        Relationships: []
      }
      daily_income_expense_last_12_months: {
        Row: {
          currency_code: string | null
          day: string | null
          expense: number | null
          income: number | null
        }
        Relationships: []
      }
      fx_daily_rates_default: {
        Row: {
          as_of_date: string | null
          base_currency: string | null
          created_at: string | null
          id: number | null
          is_manual_override: boolean | null
          is_official: boolean | null
          quote_currency: string | null
          rate_mid: number | null
          source_code: string | null
          source_id: number | null
          source_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fx_daily_rates_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_daily_rates_quote_currency_fkey"
            columns: ["quote_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_daily_rates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "fx_sources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_admin: { Args: { p_uid?: string }; Returns: boolean }
    }
    Enums: {
      fx_import_type: "UPLOAD" | "URL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      fx_import_type: ["UPLOAD", "URL"],
    },
  },
} as const
