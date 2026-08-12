/**
 * Database types — GENERATED from the live schema. Do not hand-edit.
 *
 * Regenerate after every migration:
 *   pnpm gen:types > shared/src/types/database.ts
 *
 * Note: Postgres CHECK constraints do not survive generation, so columns like
 * `status` come through as plain `string`. Where the exact set of values
 * matters, use the domain unions in ./index.ts (OrderStatus, StaffRole, …).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          phone: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          phone?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          phone?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          email: string | null
          id: boolean
          invoice_prefix: string
          legal_name: string | null
          logo_url: string | null
          name: string
          order_prefix: string
          phone: string | null
          require_order_approval: boolean
          tax_name: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: boolean
          invoice_prefix?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          order_prefix?: string
          phone?: string | null
          require_order_approval?: boolean
          tax_name?: string
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: boolean
          invoice_prefix?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          order_prefix?: string
          phone?: string | null
          require_order_approval?: boolean
          tax_name?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_accounts: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          linked_at: string | null
          linked_by: string | null
          phone: string | null
          phone_norm: string | null
          requested_city: string | null
          requested_shop_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id: string
          linked_at?: string | null
          linked_by?: string | null
          phone?: string | null
          phone_norm?: string | null
          requested_city?: string | null
          requested_shop_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          linked_at?: string | null
          linked_by?: string | null
          phone?: string | null
          phone_norm?: string | null
          requested_city?: string | null
          requested_shop_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_limit: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          opening_balance: number
          phone: string | null
          phone_norm: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          phone_norm?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          phone_norm?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goods_receipt_items: {
        Row: {
          goods_receipt_id: string
          id: string
          line_total: number
          product_id: string
          purchase_order_item_id: string
          quantity_received: number
          unit_cost: number
        }
        Insert: {
          goods_receipt_id: string
          id?: string
          line_total: number
          product_id: string
          purchase_order_item_id: string
          quantity_received: number
          unit_cost: number
        }
        Update: {
          goods_receipt_id?: string
          id?: string
          line_total?: number
          product_id?: string
          purchase_order_item_id?: string
          quantity_received?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          amount_paid: number
          branch_id: string
          created_at: string
          created_by: string | null
          grn_number: string
          id: string
          notes: string | null
          payment_status: string
          purchase_order_id: string
          received_date: string
          supplier_id: string
          total_received: number
        }
        Insert: {
          amount_paid?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          grn_number: string
          id?: string
          notes?: string | null
          payment_status?: string
          purchase_order_id: string
          received_date?: string
          supplier_id: string
          total_received?: number
        }
        Update: {
          amount_paid?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          grn_number?: string
          id?: string
          notes?: string | null
          payment_status?: string
          purchase_order_id?: string
          received_date?: string
          supplier_id?: string
          total_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          id: boolean
          updated_at: string
          updated_by: string | null
          whatsapp_access_token: string | null
          whatsapp_phone_number_id: string | null
        }
        Insert: {
          id?: boolean
          updated_at?: string
          updated_by?: string | null
          whatsapp_access_token?: string | null
          whatsapp_phone_number_id?: string | null
        }
        Update: {
          id?: boolean
          updated_at?: string
          updated_by?: string | null
          whatsapp_access_token?: string | null
          whatsapp_phone_number_id?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          reorder_threshold: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          reorder_threshold?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          reorder_threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          created_at: string
          created_by: string | null
          credit: number
          debit: number
          entry_date: string
          id: string
          notes: string | null
          party_id: string
          party_type: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          entry_date?: string
          id?: string
          notes?: string | null
          party_id: string
          party_type: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          entry_date?: string
          id?: string
          notes?: string | null
          party_id?: string
          party_type?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: []
      }
      message_log: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          message_type: string
          party_id: string
          party_type: string
          reference_id: string | null
          reference_type: string | null
          status: string
          to_phone: string
        }
        Insert: {
          channel: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          message_type: string
          party_id: string
          party_type: string
          reference_id?: string | null
          reference_type?: string | null
          status: string
          to_phone: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          message_type?: string
          party_id?: string
          party_type?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          to_phone?: string
        }
        Relationships: []
      }
      mobile_sync_queue: {
        Row: {
          action_type: string
          conflict_reason: string | null
          created_at: string
          device_id: string
          id: string
          local_action_id: string
          payload: Json
          server_reference_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          conflict_reason?: string | null
          created_at?: string
          device_id: string
          id?: string
          local_action_id: string
          payload: Json
          server_reference_id?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          conflict_reason?: string | null
          created_at?: string
          device_id?: string
          id?: string
          local_action_id?: string
          payload?: Json
          server_reference_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
        }
        Insert: {
          audience: string
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          goods_receipt_id: string | null
          id: string
          invoice_id: string | null
          payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          goods_receipt_id?: string | null
          id?: string
          invoice_id?: string | null
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          goods_receipt_id?: string | null
          id?: string
          invoice_id?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_grn_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_invoice_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          direction: string
          id: string
          method: string
          notes: string | null
          party_id: string
          party_type: string
          payment_date: string
          payment_number: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          method: string
          notes?: string | null
          party_id: string
          party_type: string
          payment_date?: string
          payment_number: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          method?: string
          notes?: string | null
          party_id?: string
          party_type?: string
          payment_date?: string
          payment_number?: string
          reference?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          avg_cost: number
          barcode: string | null
          carton_sale_price: number | null
          category_id: string | null
          created_at: string
          id: string
          image_path: string | null
          is_public: boolean
          name: string
          parent_product_id: string | null
          purchase_price: number
          sale_price: number
          sku: string
          status: string
          unit: string
          units_per_carton: number
          updated_at: string
          variant_label: string | null
        }
        Insert: {
          avg_cost?: number
          barcode?: string | null
          carton_sale_price?: number | null
          category_id?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          is_public?: boolean
          name: string
          parent_product_id?: string | null
          purchase_price?: number
          sale_price?: number
          sku: string
          status?: string
          unit?: string
          units_per_carton?: number
          updated_at?: string
          variant_label?: string | null
        }
        Update: {
          avg_cost?: number
          barcode?: string | null
          carton_sale_price?: number | null
          category_id?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          is_public?: boolean
          name?: string
          parent_product_id?: string | null
          purchase_price?: number
          sale_price?: number
          sku?: string
          status?: string
          unit?: string
          units_per_carton?: number
          updated_at?: string
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          line_total: number
          product_id: string
          purchase_order_id: string
          qty_entered: number
          quantity: number
          received_quantity: number
          unit_price: number
          uom: string
        }
        Insert: {
          id?: string
          line_total: number
          product_id: string
          purchase_order_id: string
          qty_entered: number
          quantity: number
          received_quantity?: number
          unit_price: number
          uom?: string
        }
        Update: {
          id?: string
          line_total?: number
          product_id?: string
          purchase_order_id?: string
          qty_entered?: number
          quantity?: number
          received_quantity?: number
          unit_price?: number
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          status: string
          subtotal: number
          supplier_id: string
          total: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          status?: string
          subtotal?: number
          supplier_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          status?: string
          subtotal?: number
          supplier_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          id: string
          line_total: number
          product_id: string
          qty_entered: number
          quantity: number
          quotation_id: string
          unit_price: number
          uom: string
        }
        Insert: {
          id?: string
          line_total: number
          product_id: string
          qty_entered: number
          quantity: number
          quotation_id: string
          unit_price: number
          uom?: string
        }
        Update: {
          id?: string
          line_total?: number
          product_id?: string
          qty_entered?: number
          quantity?: number
          quotation_id?: string
          unit_price?: number
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          quote_date: string
          quote_number: string
          sales_order_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          quote_date?: string
          quote_number: string
          sales_order_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          quote_date?: string
          quote_number?: string
          sales_order_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_sales_order_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_items: {
        Row: {
          id: string
          line_total: number
          product_id: string
          qty_entered: number
          quantity: number
          sales_invoice_id: string
          sales_order_item_id: string | null
          unit_cost: number
          unit_price: number
          uom: string
        }
        Insert: {
          id?: string
          line_total: number
          product_id: string
          qty_entered: number
          quantity: number
          sales_invoice_id: string
          sales_order_item_id?: string | null
          unit_cost?: number
          unit_price: number
          uom?: string
        }
        Update: {
          id?: string
          line_total?: number
          product_id?: string
          qty_entered?: number
          quantity?: number
          sales_invoice_id?: string
          sales_order_item_id?: string | null
          unit_cost?: number
          unit_price?: number
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          amount_paid: number
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          payment_status: string
          sales_order_id: string
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          payment_status?: string
          sales_order_id: string
          status?: string
          subtotal: number
          tax_amount?: number
          tax_rate?: number
          total: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          payment_status?: string
          sales_order_id?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: true
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          id: string
          line_total: number
          product_id: string
          qty_entered: number
          quantity: number
          sales_order_id: string
          unit_price: number
          uom: string
        }
        Insert: {
          id?: string
          line_total: number
          product_id: string
          qty_entered: number
          quantity: number
          sales_order_id: string
          unit_price: number
          uom?: string
        }
        Update: {
          id?: string
          line_total?: number
          product_id?: string
          qty_entered?: number
          quantity?: number
          sales_order_id?: string
          unit_price?: number
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          hold_reason: string | null
          id: string
          notes: string | null
          order_date: string
          so_number: string
          source: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          hold_reason?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          so_number: string
          source?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          hold_reason?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          so_number?: string
          source?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          balance_after: number
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity_delta: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          balance_after: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity_delta: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          balance_after?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity_delta?: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          id: string
          product_id: string
          quantity: number
          stock_transfer_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity: number
          stock_transfer_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          stock_transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_stock_transfer_id_fkey"
            columns: ["stock_transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          created_by: string | null
          from_branch_id: string
          id: string
          notes: string | null
          received_at: string | null
          status: string
          to_branch_id: string
          transfer_number: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_branch_id: string
          id?: string
          notes?: string | null
          received_at?: string | null
          status?: string
          to_branch_id: string
          transfer_number: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_branch_id?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          status?: string
          to_branch_id?: string
          transfer_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          opening_balance: number
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_branch_id: string
          p_movement_type?: string
          p_notes?: string
          p_product_id: string
          p_quantity_delta?: number
          p_reference_id?: string
          p_reference_type?: string
          p_reorder_threshold?: number
        }
        Returns: {
          inventory_id: string
          quantity: number
          reorder_threshold: number
        }[]
      }
      apply_stock_movement: {
        Args: {
          p_branch_id: string
          p_movement_type?: string
          p_notes?: string
          p_product_id: string
          p_quantity_delta?: number
          p_reference_id?: string
          p_reference_type?: string
          p_reorder_threshold?: number
        }
        Returns: {
          inventory_id: string
          quantity: number
          reorder_threshold: number
        }[]
      }
      approve_customer_signup: {
        Args: {
          p_account_id: string
          p_address?: string
          p_credit_limit?: number
          p_name?: string
          p_phone?: string
        }
        Returns: {
          customer_id: string
        }[]
      }
      approve_sales_order: {
        Args: { p_sales_order_id: string }
        Returns: {
          order_status: string
        }[]
      }
      block_customer_account: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      build_sales_order_lines: {
        Args: {
          p_branch_id: string
          p_items: Json
          p_price_from_catalog: boolean
          p_sales_order_id: string
        }
        Returns: {
          hold_reason: string
          subtotal: number
        }[]
      }
      cancel_sales_order: {
        Args: { p_reason?: string; p_sales_order_id: string }
        Returns: {
          order_status: string
        }[]
      }
      cancel_stock_transfer: {
        Args: { p_stock_transfer_id: string }
        Returns: undefined
      }
      convert_quotation: {
        Args: { p_quotation_id: string }
        Returns: {
          hold_reason: string
          order_status: string
          sales_order_id: string
          so_number: string
        }[]
      }
      create_purchase_order: {
        Args: {
          p_branch_id: string
          p_expected_date: string
          p_items: Json
          p_notes: string
          p_supplier_id: string
        }
        Returns: {
          po_number: string
          purchase_order_id: string
          total: number
        }[]
      }
      create_quotation: {
        Args: {
          p_branch_id: string
          p_customer_id: string
          p_items: Json
          p_notes: string
          p_valid_until: string
        }
        Returns: {
          quotation_id: string
          quote_number: string
          total: number
        }[]
      }
      create_sales_invoice: {
        Args: {
          p_invoice_date?: string
          p_notes?: string
          p_sales_order_id: string
        }
        Returns: {
          invoice_number: string
          sales_invoice_id: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
        }[]
      }
      create_sales_order: {
        Args: {
          p_branch_id: string
          p_customer_id: string
          p_items: Json
          p_notes: string
          p_source?: string
        }
        Returns: {
          hold_reason: string
          order_status: string
          sales_order_id: string
          so_number: string
          subtotal: number
          total: number
        }[]
      }
      create_stock_transfer: {
        Args: {
          p_from_branch_id: string
          p_items: Json
          p_notes: string
          p_to_branch_id: string
        }
        Returns: {
          stock_transfer_id: string
          transfer_number: string
        }[]
      }
      current_customer_id: { Args: never; Returns: string }
      current_staff_role: { Args: never; Returns: string }
      customer_available_credit: {
        Args: { p_customer_id: string }
        Returns: number
      }
      customer_balance: { Args: { p_customer_id: string }; Returns: number }
      customer_catalog: {
        Args: {
          p_category_id?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          barcode: string
          carton_price: number
          category_id: string
          category_name: string
          image_path: string
          in_stock: boolean
          name: string
          product_id: string
          sku: string
          unit: string
          unit_price: number
          units_per_carton: number
          variant_label: string
        }[]
      }
      customer_categories: {
        Args: never
        Returns: {
          category_id: string
          name: string
          product_count: number
        }[]
      }
      customer_me: {
        Args: never
        Returns: {
          account_status: string
          address: string
          available_credit: number
          balance: number
          credit_limit: number
          customer_id: string
          name: string
          overdue_invoices: number
          phone: string
        }[]
      }
      customer_my_invoices: {
        Args: { p_limit?: number; p_offset?: number; p_unpaid_only?: boolean }
        Returns: {
          amount_paid: number
          invoice_date: string
          invoice_id: string
          invoice_number: string
          outstanding: number
          payment_status: string
          subtotal: number
          tax_amount: number
          total: number
        }[]
      }
      customer_my_orders: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          invoice_id: string
          invoice_number: string
          item_count: number
          order_date: string
          payment_status: string
          sales_order_id: string
          so_number: string
          status: string
          total: number
        }[]
      }
      customer_my_statement: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          credit: number
          debit: number
          description: string
          entry_date: string
          reference: string
          running_balance: number
        }[]
      }
      customer_order_detail: {
        Args: { p_sales_order_id: string }
        Returns: {
          hold_reason: string
          line_total: number
          notes: string
          order_date: string
          product_name: string
          qty_entered: number
          so_number: string
          status: string
          subtotal: number
          total: number
          unit_price: number
          uom: string
          variant_label: string
        }[]
      }
      customer_place_order: {
        Args: { p_items: Json; p_notes?: string }
        Returns: {
          credit_warning: string
          order_status: string
          sales_order_id: string
          so_number: string
          total: number
        }[]
      }
      customer_would_exceed_credit: {
        Args: { p_amount: number; p_customer_id: string }
        Returns: boolean
      }
      dashboard_summary: { Args: never; Returns: Json }
      field_app_bootstrap: { Args: { p_branch_id?: string }; Returns: Json }
      is_staff: { Args: never; Returns: boolean }
      issue_purchase_order: {
        Args: { p_purchase_order_id: string }
        Returns: undefined
      }
      link_customer_account: {
        Args: { p_account_id: string; p_customer_id: string }
        Returns: undefined
      }
      mark_notifications_read: {
        Args: { p_notification_id?: string }
        Returns: number
      }
      normalize_phone: { Args: { p_phone: string }; Returns: string }
      open_documents: {
        Args: { p_party_id: string; p_party_type: string }
        Returns: {
          amount_paid: number
          document_date: string
          document_id: string
          document_number: string
          outstanding: number
          total: number
        }[]
      }
      product_on_hand: { Args: { p_product_id: string }; Returns: number }
      product_unit_price: {
        Args: {
          p_product: Database["public"]["Tables"]["products"]["Row"]
          p_uom: string
        }
        Returns: number
      }
      receive_purchase_order: {
        Args: {
          p_items: Json
          p_notes: string
          p_purchase_order_id: string
          p_received_date: string
        }
        Returns: {
          goods_receipt_id: string
          grn_number: string
          total_received: number
        }[]
      }
      receive_stock_transfer: {
        Args: { p_stock_transfer_id: string }
        Returns: undefined
      }
      record_payment: {
        Args: {
          p_allocations?: Json
          p_amount: number
          p_direction: string
          p_method: string
          p_notes?: string
          p_party_id: string
          p_party_type: string
          p_payment_date?: string
          p_reference?: string
        }
        Returns: {
          allocated_amount: number
          payment_id: string
          payment_number: string
          unallocated_amount: number
        }[]
      }
      register_push_token: {
        Args: { p_platform?: string; p_token: string }
        Returns: undefined
      }
      reject_quotation: { Args: { p_quotation_id: string }; Returns: undefined }
      report_inventory_status: {
        Args: {
          p_branch_id?: string
          p_category_id?: string
          p_low_stock_only?: boolean
        }
        Returns: {
          branch_name: string
          category_name: string
          cost_value: number
          inventory_id: string
          is_low: boolean
          name: string
          product_id: string
          purchase_price: number
          quantity: number
          reorder_threshold: number
          retail_value: number
          sale_price: number
          sku: string
          unit: string
        }[]
      }
      report_party_balances: {
        Args: { p_party_type: string }
        Returns: {
          balance: number
          credit_limit: number
          name: string
          opening_balance: number
          party_id: string
          phone: string
          total_credit: number
          total_debit: number
        }[]
      }
      report_party_statement: {
        Args: {
          p_end_date?: string
          p_party_id: string
          p_party_type: string
          p_start_date?: string
        }
        Returns: {
          credit: number
          debit: number
          description: string
          entry_date: string
          reference: string
          running_balance: number
        }[]
      }
      report_profit: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          cogs: number
          gross_profit: number
          margin_pct: number
          name: string
          product_id: string
          quantity_sold: number
          revenue: number
          sku: string
        }[]
      }
      report_sales_summary: {
        Args: {
          p_branch_id?: string
          p_customer_id?: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          amount_paid: number
          branch_name: string
          customer_name: string
          invoice_date: string
          invoice_id: string
          invoice_number: string
          outstanding: number
          payment_status: string
          subtotal: number
          tax_amount: number
          total: number
        }[]
      }
      require_customer: { Args: never; Returns: string }
      staff_has_role: { Args: { p_roles: string[] }; Returns: boolean }
      supplier_balance: { Args: { p_supplier_id: string }; Returns: number }
      sync_mobile_action: {
        Args: {
          p_action_type: string
          p_device_id: string
          p_local_action_id: string
          p_payload: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

