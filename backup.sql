

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_late_minutes"("check_in_time" timestamp with time zone) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  work_hours_settings jsonb;
  start_time text;
  check_in_time_only time;
  start_time_only time;
  diff_minutes integer;
BEGIN
  -- Get work hours settings
  SELECT setting_value INTO work_hours_settings
  FROM system_settings
  WHERE setting_key = 'work_hours'
  LIMIT 1;
  
  -- If no settings found, use defaults
  IF work_hours_settings IS NULL THEN
    start_time := '08:00';
  ELSE
    start_time := work_hours_settings->>'startTime';
  END IF;
  
  -- Convert to time types
  check_in_time_only := check_in_time::time;
  start_time_only := start_time::time;
  
  -- Calculate difference in minutes
  diff_minutes := EXTRACT(EPOCH FROM (check_in_time_only - start_time_only))/60;
  
  -- Return late minutes (0 if not late)
  RETURN GREATEST(diff_minutes, 0);
END;
$$;


ALTER FUNCTION "public"."calculate_late_minutes"("check_in_time" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_late_minutes"("check_in_time" timestamp with time zone) IS 'Calculates how many minutes an employee is late based on work hours settings.';



CREATE OR REPLACE FUNCTION "public"."generate_warning_letter"("p_user_id" "uuid", "p_warning_type" "text", "p_reason" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  letter_id UUID;
  letter_number TEXT;
BEGIN
  letter_number := generate_warning_letter_number(p_warning_type);
  
  INSERT INTO warning_letters (
    user_id,
    warning_type,
    letter_number,
    reason,
    description,
    issued_by
  ) VALUES (
    p_user_id,
    p_warning_type,
    letter_number,
    p_reason,
    p_description,
    auth.uid()
  ) RETURNING id INTO letter_id;
  
  -- Create notification for the employee
  INSERT INTO notifications (
    user_id,
    admin_id,
    type,
    title,
    message,
    data
  ) VALUES (
    p_user_id,
    auth.uid(),
    'system_alert',
    'Surat Peringatan ' || p_warning_type,
    'Anda telah menerima surat peringatan ' || p_warning_type || ' dengan nomor ' || letter_number || '. Alasan: ' || p_reason,
    jsonb_build_object(
      'warning_type', p_warning_type,
      'letter_number', letter_number,
      'letter_id', letter_id
    )
  );
  
  RETURN letter_id;
END;
$$;


ALTER FUNCTION "public"."generate_warning_letter"("p_user_id" "uuid", "p_warning_type" "text", "p_reason" "text", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_warning_letter"("p_user_id" "uuid", "p_warning_type" "text", "p_reason" "text", "p_description" "text" DEFAULT NULL::"text", "p_issued_by" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_letter_number text;
  v_year text;
  v_month text;
  v_sequence_number integer;
  v_warning_letter_id uuid;
BEGIN
  -- Get current year and month
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  v_month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::text, 2, '0');
  
  -- Get the next sequence number for this month and year
  SELECT COALESCE(MAX(
    CASE 
      WHEN wl.letter_number ~ ('^SP[0-9]+-[0-9]+-' || v_month || '-' || v_year || '$')
      THEN CAST(SPLIT_PART(SPLIT_PART(wl.letter_number, '-', 2), '-', 1) AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO v_sequence_number
  FROM warning_letters wl
  WHERE EXTRACT(YEAR FROM wl.issue_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    AND EXTRACT(MONTH FROM wl.issue_date) = EXTRACT(MONTH FROM CURRENT_DATE);
  
  -- Generate the letter number: SP{type}-{sequence}-{month}-{year}
  v_letter_number := p_warning_type || '-' || 
                     LPAD(v_sequence_number::text, 3, '0') || '-' || 
                     v_month || '-' || v_year;
  
  -- Insert the new warning letter
  INSERT INTO warning_letters (
    user_id,
    warning_type,
    letter_number,
    reason,
    description,
    issue_date,
    issued_by,
    status
  )
  VALUES (
    p_user_id,
    p_warning_type,
    v_letter_number,
    p_reason,
    p_description,
    CURRENT_DATE,
    p_issued_by,
    'active'
  )
  RETURNING id INTO v_warning_letter_id;
  
  -- Return the created warning letter ID
  RETURN v_warning_letter_id;
END;
$_$;


ALTER FUNCTION "public"."generate_warning_letter"("p_user_id" "uuid", "p_warning_type" "text", "p_reason" "text", "p_description" "text", "p_issued_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_warning_letter_number"("warning_type" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  year_month TEXT;
  sequence_num INTEGER;
  letter_number TEXT;
BEGIN
  year_month := TO_CHAR(CURRENT_DATE, 'YYYY/MM');
  
  SELECT COALESCE(MAX(CAST(SPLIT_PART(SPLIT_PART(letter_number, '/', 4), '-', 1) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM warning_letters
  WHERE letter_number LIKE warning_type || '/' || year_month || '%';
  
  letter_number := warning_type || '/' || year_month || '/' || LPAD(sequence_num::TEXT, 3, '0');
  
  RETURN letter_number;
END;
$$;


ALTER FUNCTION "public"."generate_warning_letter_number"("warning_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_absent_employees"("p_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("id" "uuid", "name" "text", "email" "text", "role" "text", "department" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email,
    p.role,
    p.department
  FROM 
    profiles p
  WHERE 
    p.status = 'active'
    AND p.role != 'admin'  -- Exclude admin users
    AND NOT EXISTS (
      SELECT 1 
      FROM attendance a 
      WHERE a.user_id = p.id 
        AND a.type = 'masuk'
        AND a.status = 'berhasil'
        AND DATE(a.timestamp) = p_date
    );
END;
$$;


ALTER FUNCTION "public"."get_absent_employees"("p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_absent_employees"("p_date" "date") IS 'Returns a list of employees who are absent on a given date, excluding admin users.';



CREATE OR REPLACE FUNCTION "public"."handle_absence_tracking"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check if the user is an admin
  IF NOT should_track_absence(NEW.role) THEN
    -- For admin users, don't track absences
    RETURN NEW;
  END IF;
  
  -- For non-admin users, continue with normal absence tracking
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_absence_tracking"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_absence_tracking"() IS 'Trigger function to handle absence tracking, excluding admin users.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    name, 
    full_name, 
    role,
    title,
    bio,
    status,
    join_date,
    contract_start_date,
    contract_type,
    is_face_registered,
    created_at, 
    updated_at
  )
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', new.email), 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'karyawan'),
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'karyawan') = 'admin' THEN 'Administrator'
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'karyawan') = 'kepala' THEN 'Kepala Bagian'
      ELSE 'Karyawan'
    END,
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'karyawan') = 'admin' THEN 'Administrator sistem absensi'
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'karyawan') = 'kepala' THEN 'Kepala Bagian di sistem absensi'
      ELSE 'Karyawan di sistem absensi'
    END,
    'active',
    CURRENT_DATE,
    CURRENT_DATE,
    'permanent',
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'karyawan') = 'admin' THEN true
      ELSE false
    END,
    now(), 
    now()
  );
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_employee_late"("check_in_time" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  work_hours_settings jsonb;
  start_time text;
  late_threshold integer;
  check_in_time_only time;
  start_time_only time;
  late_threshold_interval interval;
BEGIN
  -- Get work hours settings
  SELECT setting_value INTO work_hours_settings
  FROM system_settings
  WHERE setting_key = 'work_hours'
  LIMIT 1;
  
  -- If no settings found, use defaults
  IF work_hours_settings IS NULL THEN
    start_time := '08:00';
    late_threshold := 15;
  ELSE
    start_time := work_hours_settings->>'startTime';
    late_threshold := (work_hours_settings->>'lateThreshold')::integer;
  END IF;
  
  -- Convert to time types
  check_in_time_only := check_in_time::time;
  start_time_only := start_time::time;
  late_threshold_interval := (late_threshold || ' minutes')::interval;
  
  -- Check if employee is late (after start time + threshold)
  RETURN check_in_time_only > (start_time_only + late_threshold_interval);
END;
$$;


ALTER FUNCTION "public"."is_employee_late"("check_in_time" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_employee_late"("check_in_time" timestamp with time zone) IS 'Determines if an employee is late based on work hours settings.';



CREATE OR REPLACE FUNCTION "public"."process_salary_payment"("p_user_id" "uuid", "p_amount" numeric, "p_payment_method" "text" DEFAULT 'bank_transfer'::"text", "p_payment_reference" "text" DEFAULT NULL::"text", "p_payment_period_start" "date" DEFAULT NULL::"date", "p_payment_period_end" "date" DEFAULT NULL::"date", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  payment_id UUID;
  salary_id UUID;
  user_name TEXT;
  bank_info TEXT;
  payment_details JSONB;
BEGIN
  -- Get the active salary record
  SELECT id INTO salary_id FROM employee_salaries 
  WHERE user_id = p_user_id AND is_active = true
  LIMIT 1;
  
  -- Get user name and bank info
  SELECT 
    name, 
    COALESCE(bank_name || ' - ' || bank_account_number, 'No bank account') 
  INTO user_name, bank_info 
  FROM profiles 
  WHERE id = p_user_id;
  
  -- Create payment details
  payment_details := jsonb_build_object(
    'amount', p_amount,
    'payment_method', p_payment_method,
    'reference', p_payment_reference,
    'bank_info', bank_info,
    'processed_by', auth.uid(),
    'processed_at', NOW()
  );
  
  -- Insert payment record
  INSERT INTO salary_payments (
    user_id,
    salary_id,
    payment_amount,
    payment_method,
    payment_status,
    payment_reference,
    payment_period_start,
    payment_period_end,
    payment_details,
    created_by,
    notes
  ) VALUES (
    p_user_id,
    salary_id,
    p_amount,
    p_payment_method,
    'completed',
    p_payment_reference,
    p_payment_period_start,
    p_payment_period_end,
    payment_details,
    auth.uid(),
    p_notes
  ) RETURNING id INTO payment_id;
  
  -- Update salary record
  UPDATE employee_salaries
  SET 
    payment_status = 'paid',
    last_payment_date = CURRENT_DATE,
    payment_notes = p_notes,
    updated_at = NOW()
  WHERE id = salary_id;
  
  -- Create notification for the employee
  INSERT INTO notifications (
    user_id,
    admin_id,
    type,
    title,
    message,
    data,
    is_read
  ) VALUES (
    p_user_id,
    auth.uid(),
    'salary_info',
    'Pembayaran Gaji',
    'Gaji Anda sebesar ' || p_amount || ' telah dibayarkan via ' || p_payment_method || '.',
    jsonb_build_object(
      'payment_id', payment_id,
      'amount', p_amount,
      'payment_method', p_payment_method,
      'payment_date', CURRENT_DATE,
      'reference', p_payment_reference
    ),
    false
  );
  
  RETURN payment_id;
END;
$$;


ALTER FUNCTION "public"."process_salary_payment"("p_user_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_payment_reference" "text", "p_payment_period_start" "date", "p_payment_period_end" "date", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."should_track_absence"("user_role" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Exclude admin users from absence tracking
  RETURN user_role != 'admin';
END;
$$;


ALTER FUNCTION "public"."should_track_absence"("user_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."should_track_absence"("user_role" "text") IS 'Determines if a user should be tracked for absence based on their role. Admin users are excluded.';



CREATE OR REPLACE FUNCTION "public"."sync_admin_users"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete existing entry if it exists
  DELETE FROM public.temp_admin_users WHERE user_id = NEW.id;
  
  -- Insert new entry if role is admin or kepala
  IF NEW.role IN ('admin', 'kepala') THEN
    INSERT INTO public.temp_admin_users (user_id, role, created_at)
    VALUES (NEW.id, NEW.role, now());
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_admin_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update auth.users metadata when profile changes
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', NEW.role,
    'name', NEW.name,
    'full_name', NEW.full_name
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_auth_user_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update auth.users metadata when profile changes
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', NEW.role,
    'name', NEW.name,
    'full_name', NEW.full_name
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_auth_user_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "action_details" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "status" "text" DEFAULT 'berhasil'::"text" NOT NULL,
    "is_late" boolean DEFAULT false,
    "late_minutes" integer DEFAULT 0,
    "work_hours" numeric(5,2) DEFAULT 0,
    "overtime_hours" numeric(5,2) DEFAULT 0,
    "daily_salary_earned" numeric(15,2) DEFAULT 0,
    "check_in_time" timestamp with time zone,
    "check_out_time" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "attendance_status_check" CHECK (("status" = ANY (ARRAY['berhasil'::"text", 'gagal'::"text", 'wajah_tidak_valid'::"text", 'lokasi_tidak_valid'::"text", 'tidak_hadir'::"text"]))),
    CONSTRAINT "attendance_type_check" CHECK (("type" = ANY (ARRAY['masuk'::"text", 'keluar'::"text", 'absent'::"text"])))
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_warnings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "warning_type" "text" NOT NULL,
    "warning_level" integer NOT NULL,
    "description" "text" NOT NULL,
    "sp_number" "text",
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "issued_by" "uuid",
    "is_resolved" boolean DEFAULT false,
    "resolution_date" "date",
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "attendance_warnings_warning_level_check" CHECK ((("warning_level" >= 1) AND ("warning_level" <= 3))),
    CONSTRAINT "attendance_warnings_warning_type_check" CHECK (("warning_type" = ANY (ARRAY['late'::"text", 'absent'::"text", 'early_leave'::"text", 'misconduct'::"text"])))
);


ALTER TABLE "public"."attendance_warnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_info" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "bank_name" "text" NOT NULL,
    "bank_code" "text",
    "bank_logo" "text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bank_info" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "head_name" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_salaries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "daily_salary" numeric(15,2) DEFAULT 0 NOT NULL,
    "overtime_rate" numeric(5,2) DEFAULT 1.5,
    "bonus" numeric(15,2) DEFAULT 0,
    "deduction" numeric(15,2) DEFAULT 0,
    "effective_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "last_payment_date" "date",
    "payment_notes" "text",
    CONSTRAINT "employee_salaries_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'processing'::"text", 'paid'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."employee_salaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "admin_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "data" "jsonb",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['late_warning'::"text", 'absence_warning'::"text", 'salary_info'::"text", 'system_alert'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_changes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "changed_by" "uuid",
    "change_type" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "password_changes_change_type_check" CHECK (("change_type" = ANY (ARRAY['self_change'::"text", 'admin_reset'::"text", 'forced_reset'::"text"])))
);


ALTER TABLE "public"."password_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name_id" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "description_id" "text",
    "description_en" "text",
    "base_salary" numeric(15,2) DEFAULT 0,
    "min_salary" numeric(15,2) DEFAULT 0,
    "max_salary" numeric(15,2) DEFAULT 0,
    "department" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "full_name" "text",
    "email" "text" NOT NULL,
    "phone" "text",
    "location" "text",
    "title" "text",
    "bio" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'karyawan'::"text" NOT NULL,
    "position_id" "uuid",
    "employee_id" "text",
    "department" "text",
    "salary" numeric(15,2) DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "join_date" "date" DEFAULT CURRENT_DATE,
    "contract_start_date" "date",
    "contract_end_date" "date",
    "contract_type" "text" DEFAULT 'permanent'::"text",
    "is_face_registered" boolean DEFAULT false,
    "last_login" timestamp with time zone,
    "device_info" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "bank_name" "text",
    "bank_account_number" "text",
    "bank_account_name" "text",
    "bank_id" "uuid",
    CONSTRAINT "profiles_contract_type_check" CHECK (("contract_type" = ANY (ARRAY['permanent'::"text", 'contract'::"text", 'internship'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'kepala'::"text", 'karyawan'::"text"]))),
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'terminated'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "salary_id" "uuid",
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_amount" numeric(15,2) NOT NULL,
    "payment_method" "text" DEFAULT 'bank_transfer'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "payment_reference" "text",
    "payment_period_start" "date",
    "payment_period_end" "date",
    "payment_details" "jsonb",
    "created_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "salary_payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['bank_transfer'::"text", 'cash'::"text", 'other'::"text"]))),
    CONSTRAINT "salary_payments_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."salary_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "description" "text",
    "is_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."temp_admin_users" (
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."temp_admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warning_letters" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "warning_type" "text" NOT NULL,
    "letter_number" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "description" "text",
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "issued_by" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "warning_letters_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'resolved'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "warning_letters_warning_type_check" CHECK (("warning_type" = ANY (ARRAY['SP1'::"text", 'SP2'::"text", 'SP3'::"text", 'termination'::"text"])))
);


ALTER TABLE "public"."warning_letters" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_user_timestamp_unique" UNIQUE ("user_id", "timestamp");



ALTER TABLE ONLY "public"."attendance_warnings"
    ADD CONSTRAINT "attendance_warnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_info"
    ADD CONSTRAINT "bank_info_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_salaries"
    ADD CONSTRAINT "employee_salaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_changes"
    ADD CONSTRAINT "password_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_name_id_key" UNIQUE ("name_id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_setting_key_key" UNIQUE ("setting_key");



ALTER TABLE ONLY "public"."temp_admin_users"
    ADD CONSTRAINT "temp_admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."warning_letters"
    ADD CONSTRAINT "warning_letters_letter_number_key" UNIQUE ("letter_number");



ALTER TABLE ONLY "public"."warning_letters"
    ADD CONSTRAINT "warning_letters_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_logs_action_type" ON "public"."activity_logs" USING "btree" ("action_type");



CREATE INDEX "idx_activity_logs_created_at" ON "public"."activity_logs" USING "btree" ("created_at");



CREATE INDEX "idx_activity_logs_user_id" ON "public"."activity_logs" USING "btree" ("user_id");



CREATE INDEX "idx_attendance_status" ON "public"."attendance" USING "btree" ("status");



CREATE INDEX "idx_attendance_timestamp" ON "public"."attendance" USING "btree" ("timestamp");



CREATE INDEX "idx_attendance_type" ON "public"."attendance" USING "btree" ("type");



CREATE INDEX "idx_attendance_user_id" ON "public"."attendance" USING "btree" ("user_id");



CREATE INDEX "idx_attendance_warnings_issue_date" ON "public"."attendance_warnings" USING "btree" ("issue_date");



CREATE INDEX "idx_attendance_warnings_resolved" ON "public"."attendance_warnings" USING "btree" ("is_resolved");



CREATE INDEX "idx_attendance_warnings_user_id" ON "public"."attendance_warnings" USING "btree" ("user_id");



CREATE INDEX "idx_bank_info_active" ON "public"."bank_info" USING "btree" ("is_active");



CREATE INDEX "idx_bank_info_name" ON "public"."bank_info" USING "btree" ("bank_name");



CREATE INDEX "idx_departments_active" ON "public"."departments" USING "btree" ("is_active");



CREATE INDEX "idx_departments_name" ON "public"."departments" USING "btree" ("name");



CREATE INDEX "idx_employee_salaries_active" ON "public"."employee_salaries" USING "btree" ("is_active");



CREATE INDEX "idx_employee_salaries_effective_date" ON "public"."employee_salaries" USING "btree" ("effective_date");



CREATE INDEX "idx_employee_salaries_payment_status" ON "public"."employee_salaries" USING "btree" ("payment_status");



CREATE INDEX "idx_employee_salaries_user_id" ON "public"."employee_salaries" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at");



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_password_changes_created_at" ON "public"."password_changes" USING "btree" ("created_at");



CREATE INDEX "idx_password_changes_user_id" ON "public"."password_changes" USING "btree" ("user_id");



CREATE INDEX "idx_positions_active" ON "public"."positions" USING "btree" ("is_active");



CREATE INDEX "idx_positions_department" ON "public"."positions" USING "btree" ("department");



CREATE INDEX "idx_profiles_bank_id" ON "public"."profiles" USING "btree" ("bank_id");



CREATE INDEX "idx_profiles_department" ON "public"."profiles" USING "btree" ("department");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_employee_id" ON "public"."profiles" USING "btree" ("employee_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_role_status" ON "public"."profiles" USING "btree" ("role", "status");



CREATE INDEX "idx_profiles_status" ON "public"."profiles" USING "btree" ("status");



CREATE INDEX "idx_salary_payments_payment_date" ON "public"."salary_payments" USING "btree" ("payment_date");



CREATE INDEX "idx_salary_payments_payment_status" ON "public"."salary_payments" USING "btree" ("payment_status");



CREATE INDEX "idx_salary_payments_user_id" ON "public"."salary_payments" USING "btree" ("user_id");



CREATE INDEX "idx_system_settings_enabled" ON "public"."system_settings" USING "btree" ("is_enabled");



CREATE INDEX "idx_system_settings_key" ON "public"."system_settings" USING "btree" ("setting_key");



CREATE INDEX "idx_temp_admin_users_role" ON "public"."temp_admin_users" USING "btree" ("role");



CREATE INDEX "idx_warning_letters_issue_date" ON "public"."warning_letters" USING "btree" ("issue_date");



CREATE INDEX "idx_warning_letters_status" ON "public"."warning_letters" USING "btree" ("status");



CREATE INDEX "idx_warning_letters_user_id" ON "public"."warning_letters" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "sync_admin_users_trigger" AFTER INSERT OR UPDATE OF "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_admin_users"();



CREATE OR REPLACE TRIGGER "sync_user_metadata_trigger" AFTER INSERT OR UPDATE OF "role", "name", "full_name" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_metadata"();



CREATE OR REPLACE TRIGGER "update_attendance_warnings_updated_at" BEFORE UPDATE ON "public"."attendance_warnings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_bank_info_updated_at" BEFORE UPDATE ON "public"."bank_info" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_departments_updated_at" BEFORE UPDATE ON "public"."departments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_employee_salaries_updated_at" BEFORE UPDATE ON "public"."employee_salaries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_positions_updated_at" BEFORE UPDATE ON "public"."positions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_salary_payments_updated_at" BEFORE UPDATE ON "public"."salary_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_system_settings_updated_at" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_warning_letters_updated_at" BEFORE UPDATE ON "public"."warning_letters" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_warnings"
    ADD CONSTRAINT "attendance_warnings_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."attendance_warnings"
    ADD CONSTRAINT "attendance_warnings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_salaries"
    ADD CONSTRAINT "employee_salaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "fk_profiles_position" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_changes"
    ADD CONSTRAINT "password_changes_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."password_changes"
    ADD CONSTRAINT "password_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "public"."bank_info"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_salary_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "public"."employee_salaries"("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."warning_letters"
    ADD CONSTRAINT "warning_letters_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."warning_letters"
    ADD CONSTRAINT "warning_letters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can manage all attendance" ON "public"."attendance" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can manage all departments" ON "public"."departments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can manage all notifications" ON "public"."notifications" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can manage all profiles" ON "public"."profiles" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can manage all salaries" ON "public"."employee_salaries" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can manage all salary payments" ON "public"."salary_payments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can manage all warning letters" ON "public"."warning_letters" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can manage all warnings" ON "public"."attendance_warnings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can manage bank info" ON "public"."bank_info" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can manage positions" ON "public"."positions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can manage system settings" ON "public"."system_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can view all activity logs" ON "public"."activity_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Admin can view all password changes" ON "public"."password_changes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = 'admin'::"text")))));



CREATE POLICY "Anyone can read admin users" ON "public"."temp_admin_users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert activity logs" ON "public"."activity_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert password changes" ON "public"."password_changes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can view departments" ON "public"."departments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view positions" ON "public"."positions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view system settings" ON "public"."system_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Kepala can manage warnings" ON "public"."attendance_warnings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = ANY (ARRAY['admin'::"text", 'kepala'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = ANY (ARRAY['admin'::"text", 'kepala'::"text"]))))));



CREATE POLICY "Kepala can view attendance" ON "public"."attendance" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = ANY (ARRAY['admin'::"text", 'kepala'::"text"]))))));



CREATE POLICY "Kepala can view profiles" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = ANY (ARRAY['admin'::"text", 'kepala'::"text"]))))));



CREATE POLICY "Kepala can view salaries" ON "public"."employee_salaries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."temp_admin_users"
  WHERE (("temp_admin_users"."user_id" = "auth"."uid"()) AND ("temp_admin_users"."role" = ANY (ARRAY['admin'::"text", 'kepala'::"text"]))))));



CREATE POLICY "System can manage admin users" ON "public"."temp_admin_users" TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "Users can insert own attendance" ON "public"."attendance" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view bank info" ON "public"."bank_info" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view own activity logs" ON "public"."activity_logs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own attendance" ON "public"."attendance" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own password changes" ON "public"."password_changes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own salary" ON "public"."employee_salaries" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own salary payments" ON "public"."salary_payments" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own warning letters" ON "public"."warning_letters" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own warnings" ON "public"."attendance_warnings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_warnings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_info" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_salaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."salary_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temp_admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."warning_letters" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."calculate_late_minutes"("check_in_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_late_minutes"("check_in_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_late_minutes"("check_in_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_warning_letter"("p_user_id" "uuid", "p_warning_type" "text", "p_reason" "text", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_warning_letter"("p_user_id" "uuid", "p_warning_type" "text", "p_reason" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_warning_letter"("p_user_id" "uuid", "p_warning_type" "text", "p_reason" "text", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_warning_letter"("p_user_id" "uuid", "p_warning_type" "text", "p_reason" "text", "p_description" "text", "p_issued_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_warning_letter"("p_user_id" "uuid", "p_warning_type" "text", "p_reason" "text", "p_description" "text", "p_issued_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_warning_letter"("p_user_id" "uuid", "p_warning_type" "text", "p_reason" "text", "p_description" "text", "p_issued_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_warning_letter_number"("warning_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_warning_letter_number"("warning_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_warning_letter_number"("warning_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_absent_employees"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_absent_employees"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_absent_employees"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_absence_tracking"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_absence_tracking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_absence_tracking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_employee_late"("check_in_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."is_employee_late"("check_in_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_employee_late"("check_in_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_salary_payment"("p_user_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_payment_reference" "text", "p_payment_period_start" "date", "p_payment_period_end" "date", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_salary_payment"("p_user_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_payment_reference" "text", "p_payment_period_start" "date", "p_payment_period_end" "date", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_salary_payment"("p_user_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_payment_reference" "text", "p_payment_period_start" "date", "p_payment_period_end" "date", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."should_track_absence"("user_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."should_track_absence"("user_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."should_track_absence"("user_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_admin_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_admin_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_admin_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_auth_user_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_auth_user_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_auth_user_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_warnings" TO "anon";
GRANT ALL ON TABLE "public"."attendance_warnings" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_warnings" TO "service_role";



GRANT ALL ON TABLE "public"."bank_info" TO "anon";
GRANT ALL ON TABLE "public"."bank_info" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_info" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."employee_salaries" TO "anon";
GRANT ALL ON TABLE "public"."employee_salaries" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_salaries" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."password_changes" TO "anon";
GRANT ALL ON TABLE "public"."password_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."password_changes" TO "service_role";



GRANT ALL ON TABLE "public"."positions" TO "anon";
GRANT ALL ON TABLE "public"."positions" TO "authenticated";
GRANT ALL ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."salary_payments" TO "anon";
GRANT ALL ON TABLE "public"."salary_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_payments" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."temp_admin_users" TO "anon";
GRANT ALL ON TABLE "public"."temp_admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."temp_admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."warning_letters" TO "anon";
GRANT ALL ON TABLE "public"."warning_letters" TO "authenticated";
GRANT ALL ON TABLE "public"."warning_letters" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
