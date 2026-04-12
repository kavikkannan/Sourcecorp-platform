--
-- PostgreSQL database dump
--

\restrict zvpioV1WwEA99ezWjaYnc93jIUcE9DCBDGA9SigS1zsQBeCi2XTFfikWcAsDLlc

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: admin_schema; Type: SCHEMA; Schema: -; Owner: sourcecorp_user
--

CREATE SCHEMA admin_schema;


ALTER SCHEMA admin_schema OWNER TO sourcecorp_user;

--
-- Name: audit_schema; Type: SCHEMA; Schema: -; Owner: sourcecorp_user
--

CREATE SCHEMA audit_schema;


ALTER SCHEMA audit_schema OWNER TO sourcecorp_user;

--
-- Name: auth_schema; Type: SCHEMA; Schema: -; Owner: sourcecorp_user
--

CREATE SCHEMA auth_schema;


ALTER SCHEMA auth_schema OWNER TO sourcecorp_user;

--
-- Name: chat_schema; Type: SCHEMA; Schema: -; Owner: sourcecorp_user
--

CREATE SCHEMA chat_schema;


ALTER SCHEMA chat_schema OWNER TO sourcecorp_user;

--
-- Name: crm_schema; Type: SCHEMA; Schema: -; Owner: sourcecorp_user
--

CREATE SCHEMA crm_schema;


ALTER SCHEMA crm_schema OWNER TO sourcecorp_user;

--
-- Name: finance_schema; Type: SCHEMA; Schema: -; Owner: sourcecorp_user
--

CREATE SCHEMA finance_schema;


ALTER SCHEMA finance_schema OWNER TO sourcecorp_user;

--
-- Name: note_schema; Type: SCHEMA; Schema: -; Owner: sourcecorp_user
--

CREATE SCHEMA note_schema;


ALTER SCHEMA note_schema OWNER TO sourcecorp_user;

--
-- Name: task_schema; Type: SCHEMA; Schema: -; Owner: sourcecorp_user
--

CREATE SCHEMA task_schema;


ALTER SCHEMA task_schema OWNER TO sourcecorp_user;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: check_hierarchy_cycle(); Type: FUNCTION; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE FUNCTION auth_schema.check_hierarchy_cycle() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE
        current_manager UUID;
        visited UUID[] := ARRAY[NEW.subordinate_id];
      BEGIN
        current_manager := NEW.manager_id;
        
        WHILE current_manager IS NOT NULL LOOP
          IF current_manager = ANY(visited) THEN
            RAISE EXCEPTION 'Circular hierarchy detected: cannot create cycle in reporting structure';
          END IF;
          
          visited := array_append(visited, current_manager);
          
          SELECT manager_id INTO current_manager
          FROM auth_schema.user_hierarchy
          WHERE subordinate_id = current_manager;
        END LOOP;
        
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION auth_schema.check_hierarchy_cycle() OWNER TO sourcecorp_user;

--
-- Name: generate_case_number(); Type: FUNCTION; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE FUNCTION crm_schema.generate_case_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    new_number TEXT;
    counter INTEGER;
BEGIN
    SELECT COUNT(*) INTO counter FROM crm_schema.cases;
    new_number := 'CASE-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((counter + 1)::TEXT, 5, '0');
    RETURN new_number;
END;
$$;


ALTER FUNCTION crm_schema.generate_case_number() OWNER TO sourcecorp_user;

--
-- Name: generate_case_number(character varying, uuid); Type: FUNCTION; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE FUNCTION crm_schema.generate_case_number(loan_type_val character varying, user_id_val uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
      DECLARE
        new_number TEXT;
        counter INTEGER;
        prefix TEXT;
        user_id_short TEXT;
      BEGIN
        -- Map loan type to prefix
        CASE loan_type_val
          WHEN 'PERSONAL' THEN prefix := 'PL';
          WHEN 'BUSINESS' THEN prefix := 'BL';
          WHEN 'EDUCATION' THEN prefix := 'EL';
          WHEN 'HOME' THEN prefix := 'HL';
          WHEN 'AUTO' THEN prefix := 'AL';
          ELSE prefix := 'CASE';
        END CASE;

        -- Get short user ID (first 8 characters)
        user_id_short := SUBSTRING(user_id_val::TEXT, 1, 8);

        -- Count cases with same prefix and date
        SELECT COUNT(*) INTO counter 
        FROM crm_schema.cases 
        WHERE case_number LIKE prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || user_id_short || '-%';

        -- Generate new case number: PREFIX-YYYYMMDD-USERID-XXXXX
        new_number := prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || user_id_short || '-' || LPAD((counter + 1)::TEXT, 5, '0');
        
        RETURN new_number;
      END;
      $$;


ALTER FUNCTION crm_schema.generate_case_number(loan_type_val character varying, user_id_val uuid) OWNER TO sourcecorp_user;

--
-- Name: set_case_number(); Type: FUNCTION; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE FUNCTION crm_schema.set_case_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
          NEW.case_number := crm_schema.generate_case_number(NEW.loan_type, NEW.created_by);
        END IF;
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION crm_schema.set_case_number() OWNER TO sourcecorp_user;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE FUNCTION crm_schema.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION crm_schema.update_updated_at_column() OWNER TO sourcecorp_user;

--
-- Name: validate_task_assignment(); Type: FUNCTION; Schema: task_schema; Owner: sourcecorp_user
--

CREATE FUNCTION task_schema.validate_task_assignment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE
        is_subordinate BOOLEAN;
        is_manager BOOLEAN;
      BEGIN
        -- Only validate hierarchy for HIERARCHICAL tasks
        IF NEW.task_type = 'HIERARCHICAL' THEN
          -- For DOWNWARD tasks: assigned_to must be a subordinate of assigned_by
          IF NEW.direction = 'DOWNWARD' THEN
            SELECT EXISTS(
              SELECT 1 FROM auth_schema.user_hierarchy
              WHERE manager_id = NEW.assigned_by
              AND subordinate_id = NEW.assigned_to
            ) INTO is_subordinate;
            
            IF NOT is_subordinate THEN
              RAISE EXCEPTION 'DOWNWARD tasks can only be assigned to direct subordinates';
            END IF;
          END IF;
          
          -- For UPWARD tasks: assigned_to must be the manager of assigned_by
          IF NEW.direction = 'UPWARD' THEN
            SELECT EXISTS(
              SELECT 1 FROM auth_schema.user_hierarchy
              WHERE manager_id = NEW.assigned_to
              AND subordinate_id = NEW.assigned_by
            ) INTO is_manager;
            
            IF NOT is_manager THEN
              RAISE EXCEPTION 'UPWARD tasks can only be raised to direct manager';
            END IF;
          END IF;
        END IF;
        
        -- For PERSONAL tasks: assigned_to must equal assigned_by
        IF NEW.task_type = 'PERSONAL' THEN
          IF NEW.assigned_to != NEW.assigned_by THEN
            RAISE EXCEPTION 'PERSONAL tasks must be assigned to the creator';
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION task_schema.validate_task_assignment() OWNER TO sourcecorp_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcements; Type: TABLE; Schema: admin_schema; Owner: sourcecorp_user
--

CREATE TABLE admin_schema.announcements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    author_id uuid NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    image_path character varying(500),
    category character varying(20) DEFAULT 'GENERAL'::character varying,
    CONSTRAINT announcements_category_check CHECK (((category)::text = ANY ((ARRAY['GENERAL'::character varying, 'BANK_UPDATES'::character varying, 'SALES_REPORT'::character varying])::text[])))
);


ALTER TABLE admin_schema.announcements OWNER TO sourcecorp_user;

--
-- Name: audit_logs; Type: TABLE; Schema: audit_schema; Owner: sourcecorp_user
--

CREATE TABLE audit_schema.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    resource_type character varying(100) NOT NULL,
    resource_id uuid,
    details jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE audit_schema.audit_logs OWNER TO sourcecorp_user;

--
-- Name: permissions; Type: TABLE; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE TABLE auth_schema.permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE auth_schema.permissions OWNER TO sourcecorp_user;

--
-- Name: role_permissions; Type: TABLE; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE TABLE auth_schema.role_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE auth_schema.role_permissions OWNER TO sourcecorp_user;

--
-- Name: roles; Type: TABLE; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE TABLE auth_schema.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE auth_schema.roles OWNER TO sourcecorp_user;

--
-- Name: team_members; Type: TABLE; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE TABLE auth_schema.team_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE auth_schema.team_members OWNER TO sourcecorp_user;

--
-- Name: teams; Type: TABLE; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE TABLE auth_schema.teams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE auth_schema.teams OWNER TO sourcecorp_user;

--
-- Name: user_hierarchy; Type: TABLE; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE TABLE auth_schema.user_hierarchy (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    manager_id uuid NOT NULL,
    subordinate_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_no_self_reference CHECK ((manager_id <> subordinate_id))
);


ALTER TABLE auth_schema.user_hierarchy OWNER TO sourcecorp_user;

--
-- Name: user_roles; Type: TABLE; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE TABLE auth_schema.user_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE auth_schema.user_roles OWNER TO sourcecorp_user;

--
-- Name: users; Type: TABLE; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE TABLE auth_schema.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE auth_schema.users OWNER TO sourcecorp_user;

--
-- Name: attachments; Type: TABLE; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE TABLE chat_schema.attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    mime_type character varying(100) NOT NULL,
    file_size bigint NOT NULL,
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE chat_schema.attachments OWNER TO sourcecorp_user;

--
-- Name: channel_creation_requests; Type: TABLE; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE TABLE chat_schema.channel_creation_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    requested_by uuid NOT NULL,
    channel_name character varying(255) NOT NULL,
    channel_type character varying(20) NOT NULL,
    target_role_id uuid,
    target_team_id uuid,
    requested_members jsonb DEFAULT '[]'::jsonb,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    reviewed_by uuid,
    review_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reviewed_at timestamp without time zone,
    CONSTRAINT channel_creation_requests_channel_type_check CHECK (((channel_type)::text = ANY (ARRAY[('GLOBAL'::character varying)::text, ('ROLE'::character varying)::text, ('TEAM'::character varying)::text, ('GROUP'::character varying)::text]))),
    CONSTRAINT channel_creation_requests_status_check CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('APPROVED'::character varying)::text, ('REJECTED'::character varying)::text])))
);


ALTER TABLE chat_schema.channel_creation_requests OWNER TO sourcecorp_user;

--
-- Name: channel_members; Type: TABLE; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE TABLE chat_schema.channel_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE chat_schema.channel_members OWNER TO sourcecorp_user;

--
-- Name: channels; Type: TABLE; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE TABLE chat_schema.channels (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255),
    type character varying(20) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    CONSTRAINT channels_status_check CHECK (((status)::text = ANY (ARRAY[('ACTIVE'::character varying)::text, ('PENDING'::character varying)::text]))),
    CONSTRAINT channels_type_check CHECK (((type)::text = ANY (ARRAY[('GLOBAL'::character varying)::text, ('ROLE'::character varying)::text, ('TEAM'::character varying)::text, ('GROUP'::character varying)::text, ('DM'::character varying)::text])))
);


ALTER TABLE chat_schema.channels OWNER TO sourcecorp_user;

--
-- Name: messages; Type: TABLE; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE TABLE chat_schema.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    channel_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message_type character varying(20) NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT messages_message_type_check CHECK (((message_type)::text = ANY (ARRAY[('TEXT'::character varying)::text, ('FILE'::character varying)::text, ('IMAGE'::character varying)::text])))
);


ALTER TABLE chat_schema.messages OWNER TO sourcecorp_user;

--
-- Name: case_assignments; Type: TABLE; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TABLE crm_schema.case_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    assigned_to uuid NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE crm_schema.case_assignments OWNER TO sourcecorp_user;

--
-- Name: case_notes; Type: TABLE; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TABLE crm_schema.case_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    note text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    document_id uuid
);


ALTER TABLE crm_schema.case_notes OWNER TO sourcecorp_user;

--
-- Name: case_notifications; Type: TABLE; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TABLE crm_schema.case_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    scheduled_for uuid NOT NULL,
    scheduled_by uuid NOT NULL,
    message text,
    scheduled_at timestamp without time zone NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_read boolean DEFAULT false,
    completion_status character varying(20) DEFAULT 'ONGOING'::character varying,
    document_id uuid,
    change_request_id uuid,
    CONSTRAINT case_notifications_completion_status_check CHECK (((completion_status)::text = ANY (ARRAY[('ONGOING'::character varying)::text, ('COMPLETED'::character varying)::text]))),
    CONSTRAINT case_notifications_status_check CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('SENT'::character varying)::text, ('CANCELLED'::character varying)::text])))
);


ALTER TABLE crm_schema.case_notifications OWNER TO sourcecorp_user;

--
-- Name: case_status_history; Type: TABLE; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TABLE crm_schema.case_status_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    from_status character varying(50),
    to_status character varying(50) NOT NULL,
    changed_by uuid NOT NULL,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    remarks text
);


ALTER TABLE crm_schema.case_status_history OWNER TO sourcecorp_user;

--
-- Name: cases; Type: TABLE; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TABLE crm_schema.cases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    case_number character varying(50) NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255) NOT NULL,
    customer_phone character varying(50) NOT NULL,
    loan_type character varying(100) NOT NULL,
    loan_amount numeric(15,2) NOT NULL,
    current_status character varying(50) DEFAULT 'NEW'::character varying NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_type character varying(10),
    CONSTRAINT cases_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['DSA'::character varying, 'DST'::character varying])::text[])))
);


ALTER TABLE crm_schema.cases OWNER TO sourcecorp_user;

--
-- Name: customer_detail_change_requests; Type: TABLE; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TABLE crm_schema.customer_detail_change_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    requested_for uuid NOT NULL,
    requested_changes jsonb NOT NULL,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    approval_remarks text,
    approved_by uuid,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_detail_change_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


ALTER TABLE crm_schema.customer_detail_change_requests OWNER TO sourcecorp_user;

--
-- Name: customer_detail_sheets; Type: TABLE; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TABLE crm_schema.customer_detail_sheets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    detail_data jsonb NOT NULL,
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE crm_schema.customer_detail_sheets OWNER TO sourcecorp_user;

--
-- Name: customer_detail_template; Type: TABLE; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TABLE crm_schema.customer_detail_template (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    field_key character varying(255) NOT NULL,
    field_label character varying(255) NOT NULL,
    is_visible boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE crm_schema.customer_detail_template OWNER TO sourcecorp_user;

--
-- Name: documents; Type: TABLE; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TABLE crm_schema.documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    mime_type character varying(100) NOT NULL,
    file_size bigint NOT NULL,
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE crm_schema.documents OWNER TO sourcecorp_user;

--
-- Name: cam_entries; Type: TABLE; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TABLE finance_schema.cam_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    template_id uuid,
    cam_data jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    template_snapshot jsonb,
    user_added_fields jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE finance_schema.cam_entries OWNER TO sourcecorp_user;

--
-- Name: cam_fields; Type: TABLE; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TABLE finance_schema.cam_fields (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    template_id uuid NOT NULL,
    section_name character varying(255) NOT NULL,
    field_key character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    field_type character varying(50) NOT NULL,
    is_mandatory boolean DEFAULT false,
    is_user_addable boolean DEFAULT false,
    order_index integer DEFAULT 0 NOT NULL,
    default_value text,
    validation_rules jsonb,
    select_options jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cam_fields_field_type_check CHECK (((field_type)::text = ANY (ARRAY[('text'::character varying)::text, ('number'::character varying)::text, ('currency'::character varying)::text, ('date'::character varying)::text, ('select'::character varying)::text])))
);


ALTER TABLE finance_schema.cam_fields OWNER TO sourcecorp_user;

--
-- Name: cam_templates; Type: TABLE; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TABLE finance_schema.cam_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    loan_type character varying(100) NOT NULL,
    template_definition jsonb,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    template_name character varying(255) DEFAULT 'Default Template'::character varying,
    sections jsonb NOT NULL,
    is_active boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE finance_schema.cam_templates OWNER TO sourcecorp_user;

--
-- Name: eligibility_calculations; Type: TABLE; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TABLE finance_schema.eligibility_calculations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    monthly_income numeric(15,2) NOT NULL,
    eligible_amount numeric(15,2) NOT NULL,
    requested_amount numeric(15,2) NOT NULL,
    result character varying(20) NOT NULL,
    rule_snapshot jsonb NOT NULL,
    calculated_by uuid NOT NULL,
    calculated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT eligibility_calculations_result_check CHECK (((result)::text = ANY (ARRAY[('ELIGIBLE'::character varying)::text, ('NOT_ELIGIBLE'::character varying)::text])))
);


ALTER TABLE finance_schema.eligibility_calculations OWNER TO sourcecorp_user;

--
-- Name: eligibility_rules; Type: TABLE; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TABLE finance_schema.eligibility_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    loan_type character varying(100) NOT NULL,
    min_age integer NOT NULL,
    max_age integer NOT NULL,
    max_foir numeric(5,2) NOT NULL,
    income_multiplier numeric(5,2) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE finance_schema.eligibility_rules OWNER TO sourcecorp_user;

--
-- Name: obligation_fields; Type: TABLE; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TABLE finance_schema.obligation_fields (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    template_id uuid NOT NULL,
    field_key character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    field_type character varying(50) NOT NULL,
    is_mandatory boolean DEFAULT false,
    is_repeatable boolean DEFAULT true,
    order_index integer DEFAULT 0 NOT NULL,
    default_value text,
    validation_rules jsonb,
    select_options jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT obligation_fields_field_type_check CHECK (((field_type)::text = ANY (ARRAY[('text'::character varying)::text, ('number'::character varying)::text, ('currency'::character varying)::text, ('date'::character varying)::text, ('select'::character varying)::text])))
);


ALTER TABLE finance_schema.obligation_fields OWNER TO sourcecorp_user;

--
-- Name: obligation_items; Type: TABLE; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TABLE finance_schema.obligation_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    obligation_sheet_id uuid NOT NULL,
    description character varying(255),
    monthly_emi numeric(15,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    item_data jsonb,
    order_index integer DEFAULT 0
);


ALTER TABLE finance_schema.obligation_items OWNER TO sourcecorp_user;

--
-- Name: obligation_sheets; Type: TABLE; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TABLE finance_schema.obligation_sheets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    case_id uuid NOT NULL,
    total_obligation numeric(15,2) NOT NULL,
    net_income numeric(15,2) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    template_id uuid,
    template_snapshot jsonb
);


ALTER TABLE finance_schema.obligation_sheets OWNER TO sourcecorp_user;

--
-- Name: obligation_templates; Type: TABLE; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TABLE finance_schema.obligation_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    template_name character varying(255) NOT NULL,
    sections jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE finance_schema.obligation_templates OWNER TO sourcecorp_user;

--
-- Name: notes; Type: TABLE; Schema: note_schema; Owner: sourcecorp_user
--

CREATE TABLE note_schema.notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    content text NOT NULL,
    created_by uuid NOT NULL,
    linked_case_id uuid,
    visibility character varying(10) DEFAULT 'PRIVATE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notes_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['PRIVATE'::character varying, 'CASE'::character varying])::text[])))
);


ALTER TABLE note_schema.notes OWNER TO sourcecorp_user;

--
-- Name: task_comments; Type: TABLE; Schema: task_schema; Owner: sourcecorp_user
--

CREATE TABLE task_schema.task_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    comment text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE task_schema.task_comments OWNER TO sourcecorp_user;

--
-- Name: tasks; Type: TABLE; Schema: task_schema; Owner: sourcecorp_user
--

CREATE TABLE task_schema.tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    assigned_to uuid NOT NULL,
    assigned_by uuid NOT NULL,
    direction character varying(20),
    status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    due_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    linked_case_id uuid,
    task_type character varying(20) DEFAULT 'PERSONAL'::character varying,
    priority character varying(20) DEFAULT 'MEDIUM'::character varying,
    CONSTRAINT tasks_direction_check CHECK (((((task_type)::text = 'HIERARCHICAL'::text) AND ((direction)::text = ANY ((ARRAY['DOWNWARD'::character varying, 'UPWARD'::character varying])::text[]))) OR (((task_type)::text = ANY ((ARRAY['PERSONAL'::character varying, 'COMMON'::character varying])::text[])) AND (direction IS NULL)))),
    CONSTRAINT tasks_status_check CHECK (((status)::text = ANY (ARRAY[('OPEN'::character varying)::text, ('IN_PROGRESS'::character varying)::text, ('COMPLETED'::character varying)::text])))
);


ALTER TABLE task_schema.tasks OWNER TO sourcecorp_user;

--
-- Data for Name: announcements; Type: TABLE DATA; Schema: admin_schema; Owner: sourcecorp_user
--

COPY admin_schema.announcements (id, title, content, author_id, is_active, created_at, updated_at, image_path, category) FROM stdin;
5a1defae-0de0-49fb-a283-46af9b4ab6d9	INDIVIDUAL PERFORMANCE CONTEST	Dear Team,\r\n\r\nThe Individual Performance Contest is open to everyone for a continuous period of 2 months – February 2026 and March 2026.\r\nKindly refer to the poster for more details.\r\n\r\nRegards,\r\nTeam Management	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	t	2026-02-03 12:00:00.241816	2026-02-03 12:00:00.241816	uploads/announcements/1770120000237-WhatsApp_Image_2026-02-02_at_11.21.12.jpeg	GENERAL
a1d7d308-0ff2-479e-be87-571a9fddd2da	TEAM PERFORMANCE CONTEST	Dear Team,\r\n\r\nThe Team Performance Contest is open to everyone for a continuous period of two months—February 2026 and March 2026.\r\nKindly refer to the poster for more details.\r\n\r\nRegards,\r\nTeam Management	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	t	2026-02-03 12:01:12.554725	2026-02-03 12:01:12.554725	uploads/announcements/1770120072550-WhatsApp_Image_2026-02-02_at_11.58.21.jpeg	GENERAL
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: audit_schema; Owner: sourcecorp_user
--

COPY audit_schema.audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: auth_schema; Owner: sourcecorp_user
--

COPY auth_schema.permissions (id, name, description, created_at, updated_at) FROM stdin;
3d0fc05b-37cb-4a79-87aa-914edce15b16	admin.dashboard.read	View dashboard	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
d0c44d94-564d-4d7e-b7ab-49449c1880d6	admin.users.read	View users	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
b340d18d-cdb4-4920-a70e-34fc585b8c23	admin.users.create	Create users	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
6109f0be-7397-405e-9cac-3b4b294a8d1b	admin.users.update	Update users	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
0076fd45-0652-42c3-8dca-849e7e50c587	admin.users.assign_role	Assign roles to users	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
a84979c1-e514-4126-becc-2b3441398f45	admin.users.remove_role	Remove roles from users	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
19d65553-070e-4ad0-8f47-109fe0a8e7b3	admin.roles.read	View roles	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
142342e3-54cd-40e0-bed5-434980888921	admin.roles.create	Create roles	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
e04324a7-2da9-4bc1-9f8a-72b2178a4136	admin.roles.update	Update roles	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
bacfb6f9-9f78-452c-83f2-4b8604718ab7	admin.roles.delete	Delete roles	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
3c0504d2-1bbe-4827-836d-bc30499def4c	admin.roles.assign_permission	Assign permissions to roles	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
2541ed95-fff3-4f75-8a4e-807ea22023a6	admin.roles.remove_permission	Remove permissions from roles	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
40a93d95-71c0-4a8b-bc3a-fcab5d3e9a17	admin.permissions.read	View permissions	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
85c77d78-bacd-4ab1-9508-f28b66513875	admin.permissions.create	Create permissions	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
244081bf-9867-45b7-acb3-b8b4feb30f3f	admin.permissions.update	Update permissions	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
4c1d08e9-821a-416b-b57b-769e551de602	admin.permissions.delete	Delete permissions	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
861e837f-b8d7-4d95-b690-99b6ba7b8359	admin.teams.read	View teams	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
7cbe7e65-be93-4af9-b6f7-8b3140221404	admin.teams.create	Create teams	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
5cf835f1-e079-4c93-a682-7e2536045cb3	admin.teams.update	Update teams	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
e3ab199f-fdbb-41d2-903c-dd9105151323	admin.teams.delete	Delete teams	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
df6ed4ba-1b98-4847-8662-b4061d67a63b	admin.teams.add_member	Add team members	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
e5445958-4eb1-4de9-878e-39dbc9802526	admin.teams.remove_member	Remove team members	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
5ff9d52b-dad4-44f5-be1c-3201a0bdd856	admin.announcements.read	View announcements	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
59064b60-dcd4-4353-9175-bf86d8470038	admin.announcements.create	Create announcements	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
9f31a545-8c12-4c3a-a0c8-4acf895e6541	admin.announcements.update	Update announcements	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
87c3a465-56d0-4032-9413-6f3906916394	admin.announcements.delete	Delete announcements	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
74432fb7-c594-48f0-a9ec-b01e0fd1115a	admin.audit.read	View audit logs	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
8880ce57-6720-4097-b60f-daa64b233de2	crm.case.create	Create loan cases	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
2d31d56c-7f23-4d76-927d-c8d6fb024e84	crm.case.view	View loan cases	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
d196e471-10c3-4f92-9964-10cd333a8d35	crm.case.assign	Assign cases	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
88c53767-e44e-455e-8df4-a18823414f1e	crm.case.update_status	Update case status	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
a285b8c0-42a6-42f2-9252-74fe1f089285	crm.case.upload_document	Upload documents	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
0d1930cb-abd5-46c9-b574-031770d5ef2b	crm.case.add_note	Add notes	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
75897114-5de3-4abc-b735-c7ac2cc94863	finance.eligibility.calculate	Calculate eligibility	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
0f3adfd0-baf4-4ad2-b47e-3743c86bd26e	finance.eligibility.view	View eligibility	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
0fec0cf4-2bf1-4a74-9d80-40ed142d9af6	finance.obligation.create	Create obligation sheet	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
f28bcad4-e53f-4c4d-9386-d3b7e9bb338b	finance.obligation.view	View obligation sheet	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
2b306985-f7d0-48d1-994e-3c616c5d4323	finance.cam.create	Create CAM entry	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
671dea78-5bab-4a32-b302-16d2523d2df9	finance.cam.view	View CAM entry	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
3bb5c1d7-8b94-492c-8225-5077e6a58861	finance.export	Export financial data	2025-12-24 17:20:19.654872	2025-12-24 17:20:19.654872
a70ac652-3fb0-4ecf-9e59-15d94c3da7d5	admin.hierarchy.manage	Manage reporting hierarchy	2025-12-25 11:52:04.951388	2025-12-25 11:52:04.951388
1af11c8b-f686-4b65-913c-dc6e45d0cef5	task.assign.downward	Assign tasks to subordinates	2025-12-25 11:52:04.951388	2025-12-25 11:52:04.951388
ab9e8162-a5f8-4668-82ca-d67b90ca97e5	task.raise.upward	Raise tasks to manager	2025-12-25 11:52:04.951388	2025-12-25 11:52:04.951388
2ac888a0-6e7e-4352-8a44-98324c3e2ee1	task.view.subordinates	View subordinate tasks	2025-12-25 11:52:04.951388	2025-12-25 11:52:04.951388
a38e4616-05ba-4980-952a-af57e080d69c	finance.template.manage	Manage financial templates	2025-12-26 19:26:41.332727	2025-12-26 19:26:41.332727
be11ddbf-2ef7-4268-b58e-9fc33ec611f2	chat.channel.create	Create new chat channels	2025-12-26 20:21:43.367192	2025-12-26 20:21:43.367192
6e143d7f-0c3d-4010-bd7b-bad70d54ce15	chat.channel.view	View chat channels	2025-12-26 20:21:43.367192	2025-12-26 20:21:43.367192
a09d43d4-6286-45eb-aacd-854fdc718b4f	chat.message.send	Send messages in chat channels	2025-12-26 20:21:43.367192	2025-12-26 20:21:43.367192
5fc33642-31f5-4113-af78-54bfcc252931	chat.file.upload	Upload files in chat	2025-12-26 20:21:43.367192	2025-12-26 20:21:43.367192
d5600195-f922-4eb0-ba04-6a041ce89520	chat.channel.request	Request creation of new chat channels	2025-12-27 07:33:05.457762	2025-12-27 07:33:05.457762
c8e4b346-0287-4b5a-a074-d2c0f3e6a7d2	chat.channel.approve	Approve or reject channel creation requests	2025-12-27 07:33:05.457762	2025-12-27 07:33:05.457762
44b38aa8-4e37-4f13-a706-5de9878d615d	chat.dm.start	Start direct message conversations	2025-12-27 07:33:05.457762	2025-12-27 07:33:05.457762
f3163b24-cad4-4f2c-937a-3514220ac91d	admin.users.delete	Delete users	2026-01-03 11:29:40.595063	2026-01-03 11:29:40.595063
00d3d9c2-63b3-44b0-9d0d-e912f74f407a	note.create	Create notes	2026-01-05 04:12:31.349555	2026-01-05 04:12:31.349555
2634ad72-d50e-4571-9dce-3570f3b377a6	note.view.case	View case-linked notes	2026-01-05 04:12:31.349555	2026-01-05 04:12:31.349555
e876f9ea-34fd-43e9-a5f4-c00b66c18c16	crm.case.delete	Delete loan cases	2026-01-05 16:31:20.30088	2026-01-05 16:31:20.30088
392ad182-55db-4b98-8230-427b28f1a106	chat.delete	Delete chat messages and channels	2026-01-05 18:09:20.179875	2026-01-05 18:09:20.179875
646c51d4-1108-4b13-aa83-4f5a93e07b10	chat.channel.group.create	Create channel groups in chat	2026-01-05 18:09:20.179875	2026-01-05 18:09:20.179875
11403b5e-0f37-4bdb-a2ae-073ad67f16f0	chat.channel.rename	Rename channels and groups	2026-01-05 18:09:20.179875	2026-01-05 18:09:20.179875
938d1492-bd0b-455d-80be-44360c722e96	crm.case.customer_details.modify	Modify customer details directly	2026-01-07 17:57:41.829756	2026-01-07 17:57:41.829756
17eed89b-5568-4189-98f0-42eb79627ede	crm.case.customer_details.request_change	Request changes to customer details	2026-01-07 17:57:41.829756	2026-01-07 17:57:41.829756
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: auth_schema; Owner: sourcecorp_user
--

COPY auth_schema.role_permissions (id, role_id, permission_id, created_at) FROM stdin;
451ca250-48d0-4cc5-b260-60c25dab3a00	604e61fb-dc1d-46e3-a183-cc7079cb6862	3d0fc05b-37cb-4a79-87aa-914edce15b16	2025-12-24 17:20:19.657703
2aad3b9f-6cbd-4e6a-aa73-f17e19d86321	604e61fb-dc1d-46e3-a183-cc7079cb6862	d0c44d94-564d-4d7e-b7ab-49449c1880d6	2025-12-24 17:20:19.657703
a5208401-300a-447c-b01d-60d5cca0209c	604e61fb-dc1d-46e3-a183-cc7079cb6862	b340d18d-cdb4-4920-a70e-34fc585b8c23	2025-12-24 17:20:19.657703
8f29e710-eec3-467e-8106-06cb2d1a15c4	604e61fb-dc1d-46e3-a183-cc7079cb6862	6109f0be-7397-405e-9cac-3b4b294a8d1b	2025-12-24 17:20:19.657703
83f84644-04da-4c7d-beae-511d09c550c1	604e61fb-dc1d-46e3-a183-cc7079cb6862	0076fd45-0652-42c3-8dca-849e7e50c587	2025-12-24 17:20:19.657703
1972e8bb-6050-4a54-8484-f0cdbd8df0a8	604e61fb-dc1d-46e3-a183-cc7079cb6862	a84979c1-e514-4126-becc-2b3441398f45	2025-12-24 17:20:19.657703
7a404b8b-aedf-4846-aac4-c75a2a8837ae	604e61fb-dc1d-46e3-a183-cc7079cb6862	19d65553-070e-4ad0-8f47-109fe0a8e7b3	2025-12-24 17:20:19.657703
0a80084d-6b74-4efa-b047-9ed817048141	604e61fb-dc1d-46e3-a183-cc7079cb6862	142342e3-54cd-40e0-bed5-434980888921	2025-12-24 17:20:19.657703
a2130522-6805-47b1-85b3-8836af05bdad	604e61fb-dc1d-46e3-a183-cc7079cb6862	e04324a7-2da9-4bc1-9f8a-72b2178a4136	2025-12-24 17:20:19.657703
05251216-0552-4486-b41e-ac81c3941dbc	604e61fb-dc1d-46e3-a183-cc7079cb6862	bacfb6f9-9f78-452c-83f2-4b8604718ab7	2025-12-24 17:20:19.657703
e7403cb6-6554-42b5-ae49-f1f498808a9a	604e61fb-dc1d-46e3-a183-cc7079cb6862	3c0504d2-1bbe-4827-836d-bc30499def4c	2025-12-24 17:20:19.657703
2e1a0e4e-ddea-4cdf-bfea-7ce0f28495ec	604e61fb-dc1d-46e3-a183-cc7079cb6862	2541ed95-fff3-4f75-8a4e-807ea22023a6	2025-12-24 17:20:19.657703
aa517157-7be0-4158-8209-f209ebe636f3	604e61fb-dc1d-46e3-a183-cc7079cb6862	40a93d95-71c0-4a8b-bc3a-fcab5d3e9a17	2025-12-24 17:20:19.657703
1c2f89b3-aeca-49d4-881d-25638026000d	604e61fb-dc1d-46e3-a183-cc7079cb6862	85c77d78-bacd-4ab1-9508-f28b66513875	2025-12-24 17:20:19.657703
219e1ff7-ce93-4ab7-9f3b-1ae944e0bbd9	604e61fb-dc1d-46e3-a183-cc7079cb6862	244081bf-9867-45b7-acb3-b8b4feb30f3f	2025-12-24 17:20:19.657703
b5f457a9-4582-437d-9336-671605017627	604e61fb-dc1d-46e3-a183-cc7079cb6862	4c1d08e9-821a-416b-b57b-769e551de602	2025-12-24 17:20:19.657703
3de85c66-c301-413b-8976-bc963e501919	604e61fb-dc1d-46e3-a183-cc7079cb6862	861e837f-b8d7-4d95-b690-99b6ba7b8359	2025-12-24 17:20:19.657703
f8270bad-ef86-4997-9360-a76fc6ce437c	604e61fb-dc1d-46e3-a183-cc7079cb6862	7cbe7e65-be93-4af9-b6f7-8b3140221404	2025-12-24 17:20:19.657703
1d645b7b-5c37-4203-8fd3-8983a8946f12	604e61fb-dc1d-46e3-a183-cc7079cb6862	5cf835f1-e079-4c93-a682-7e2536045cb3	2025-12-24 17:20:19.657703
0be60c48-1027-47dd-9c9d-96bd56e04628	604e61fb-dc1d-46e3-a183-cc7079cb6862	e3ab199f-fdbb-41d2-903c-dd9105151323	2025-12-24 17:20:19.657703
a9475339-e287-465a-bad0-3f0cb6da3627	604e61fb-dc1d-46e3-a183-cc7079cb6862	df6ed4ba-1b98-4847-8662-b4061d67a63b	2025-12-24 17:20:19.657703
70a90035-284f-4a3c-b869-17775d9ab443	604e61fb-dc1d-46e3-a183-cc7079cb6862	e5445958-4eb1-4de9-878e-39dbc9802526	2025-12-24 17:20:19.657703
e32d2572-c404-4f89-be23-74c29bb9a461	604e61fb-dc1d-46e3-a183-cc7079cb6862	5ff9d52b-dad4-44f5-be1c-3201a0bdd856	2025-12-24 17:20:19.657703
bf47ea67-a1f8-4cb5-9911-9443f521b781	604e61fb-dc1d-46e3-a183-cc7079cb6862	59064b60-dcd4-4353-9175-bf86d8470038	2025-12-24 17:20:19.657703
f13b8789-f371-4335-9d9d-c0b349b44ad3	604e61fb-dc1d-46e3-a183-cc7079cb6862	9f31a545-8c12-4c3a-a0c8-4acf895e6541	2025-12-24 17:20:19.657703
e8fb468f-2fa5-4935-9c00-ae4068572223	604e61fb-dc1d-46e3-a183-cc7079cb6862	87c3a465-56d0-4032-9413-6f3906916394	2025-12-24 17:20:19.657703
ce7f45bd-bf17-446d-88d0-8f9dc3a5cdf1	604e61fb-dc1d-46e3-a183-cc7079cb6862	74432fb7-c594-48f0-a9ec-b01e0fd1115a	2025-12-24 17:20:19.657703
f2b5b75c-0f6e-4ea2-acb8-36975eea31a2	604e61fb-dc1d-46e3-a183-cc7079cb6862	8880ce57-6720-4097-b60f-daa64b233de2	2025-12-24 17:20:19.657703
09210d53-bc92-49be-897c-20dc124b2bed	604e61fb-dc1d-46e3-a183-cc7079cb6862	2d31d56c-7f23-4d76-927d-c8d6fb024e84	2025-12-24 17:20:19.657703
1a49137c-6ed7-44bc-8be4-92454ad5db52	604e61fb-dc1d-46e3-a183-cc7079cb6862	d196e471-10c3-4f92-9964-10cd333a8d35	2025-12-24 17:20:19.657703
1d4fa432-0e21-42c4-b7c7-b1e3a7553431	604e61fb-dc1d-46e3-a183-cc7079cb6862	88c53767-e44e-455e-8df4-a18823414f1e	2025-12-24 17:20:19.657703
bfa8b795-b07c-4014-a5db-c74c83da5baf	604e61fb-dc1d-46e3-a183-cc7079cb6862	a285b8c0-42a6-42f2-9252-74fe1f089285	2025-12-24 17:20:19.657703
ab9245be-e977-4c05-9e54-d10128e2ebc5	604e61fb-dc1d-46e3-a183-cc7079cb6862	0d1930cb-abd5-46c9-b574-031770d5ef2b	2025-12-24 17:20:19.657703
fb511a83-455f-45fc-881d-074cd1e22ca8	604e61fb-dc1d-46e3-a183-cc7079cb6862	75897114-5de3-4abc-b735-c7ac2cc94863	2025-12-24 17:20:19.657703
9ed8461b-a54e-43fb-8758-0ea23e255d8d	604e61fb-dc1d-46e3-a183-cc7079cb6862	0f3adfd0-baf4-4ad2-b47e-3743c86bd26e	2025-12-24 17:20:19.657703
47dab32c-b0ae-45ee-ac7a-73bafe6ac0a3	604e61fb-dc1d-46e3-a183-cc7079cb6862	0fec0cf4-2bf1-4a74-9d80-40ed142d9af6	2025-12-24 17:20:19.657703
9bc86f13-388e-4797-9193-23a9f13fbb7f	604e61fb-dc1d-46e3-a183-cc7079cb6862	f28bcad4-e53f-4c4d-9386-d3b7e9bb338b	2025-12-24 17:20:19.657703
1bd49bd5-17b4-4894-99c0-fe6283bb9443	604e61fb-dc1d-46e3-a183-cc7079cb6862	2b306985-f7d0-48d1-994e-3c616c5d4323	2025-12-24 17:20:19.657703
c0af8ab7-51a8-4958-b743-05c01e46024a	604e61fb-dc1d-46e3-a183-cc7079cb6862	671dea78-5bab-4a32-b302-16d2523d2df9	2025-12-24 17:20:19.657703
3ec1550d-14d1-4375-8001-7d0fdc81207f	604e61fb-dc1d-46e3-a183-cc7079cb6862	3bb5c1d7-8b94-492c-8225-5077e6a58861	2025-12-24 17:20:19.657703
58d023f8-6812-4597-a691-84f847777b45	d1f5450d-3cb4-4f22-b400-99f4870ac25a	0f3adfd0-baf4-4ad2-b47e-3743c86bd26e	2025-12-25 10:05:50.397282
5aaec565-34c2-489a-9c3c-fc2ef0caac8a	d1f5450d-3cb4-4f22-b400-99f4870ac25a	0fec0cf4-2bf1-4a74-9d80-40ed142d9af6	2025-12-25 10:05:56.905935
8bc9c842-4a90-4994-beeb-75a6cca639d9	d1f5450d-3cb4-4f22-b400-99f4870ac25a	2b306985-f7d0-48d1-994e-3c616c5d4323	2025-12-25 10:06:02.728074
adf14b6b-1298-4da2-88e3-4fa434c487ea	d1f5450d-3cb4-4f22-b400-99f4870ac25a	3bb5c1d7-8b94-492c-8225-5077e6a58861	2025-12-25 10:06:05.477492
cdb8bb90-793f-41d3-9042-65b2c96ea743	d1f5450d-3cb4-4f22-b400-99f4870ac25a	671dea78-5bab-4a32-b302-16d2523d2df9	2025-12-25 10:06:10.995531
ad8713b7-f80a-4f68-8268-b0df3bec1ecb	d1f5450d-3cb4-4f22-b400-99f4870ac25a	75897114-5de3-4abc-b735-c7ac2cc94863	2025-12-25 10:06:12.94978
0291b71a-2ac4-433a-bf30-6e108b1c7ed7	d1f5450d-3cb4-4f22-b400-99f4870ac25a	f28bcad4-e53f-4c4d-9386-d3b7e9bb338b	2025-12-25 10:06:23.661156
23fd905f-105b-4b49-8561-ee79668d6f9e	d1f5450d-3cb4-4f22-b400-99f4870ac25a	0d1930cb-abd5-46c9-b574-031770d5ef2b	2025-12-25 10:18:56.058119
a19fdeb1-b44f-4cdd-a399-9e81473ea9ed	d1f5450d-3cb4-4f22-b400-99f4870ac25a	2d31d56c-7f23-4d76-927d-c8d6fb024e84	2025-12-25 10:18:56.058827
02d5a1be-84d3-432e-8aee-5adf6d9339b8	d1f5450d-3cb4-4f22-b400-99f4870ac25a	8880ce57-6720-4097-b60f-daa64b233de2	2025-12-25 10:18:56.059833
3112eed7-f172-4aca-aa04-414e565960f8	d1f5450d-3cb4-4f22-b400-99f4870ac25a	88c53767-e44e-455e-8df4-a18823414f1e	2025-12-25 10:18:56.060488
ebf6f1b2-79d6-4d1d-b671-8953833afa09	d1f5450d-3cb4-4f22-b400-99f4870ac25a	d196e471-10c3-4f92-9964-10cd333a8d35	2025-12-25 10:18:56.085953
04732116-0e68-45bc-9102-6fc57a7aa7ac	d1f5450d-3cb4-4f22-b400-99f4870ac25a	a285b8c0-42a6-42f2-9252-74fe1f089285	2025-12-25 10:18:56.086299
eba2718d-5c36-4d67-8f51-6831ff05a03b	604e61fb-dc1d-46e3-a183-cc7079cb6862	a70ac652-3fb0-4ecf-9e59-15d94c3da7d5	2025-12-25 11:52:04.951388
fb0af93b-f152-4de5-a280-7b1625d5c893	604e61fb-dc1d-46e3-a183-cc7079cb6862	1af11c8b-f686-4b65-913c-dc6e45d0cef5	2025-12-25 11:52:04.951388
a9905690-5d32-441c-81f1-95f39c980a47	604e61fb-dc1d-46e3-a183-cc7079cb6862	ab9e8162-a5f8-4668-82ca-d67b90ca97e5	2025-12-25 11:52:04.951388
2cf3de99-284e-41fe-b95f-974cc00ca8d2	604e61fb-dc1d-46e3-a183-cc7079cb6862	2ac888a0-6e7e-4352-8a44-98324c3e2ee1	2025-12-25 11:52:04.951388
f423dbac-3b63-4457-be92-e35eff36603c	d1f5450d-3cb4-4f22-b400-99f4870ac25a	1af11c8b-f686-4b65-913c-dc6e45d0cef5	2025-12-25 13:09:07.631324
5d383c8e-4d21-48d5-8bd0-05955cd5452b	d1f5450d-3cb4-4f22-b400-99f4870ac25a	ab9e8162-a5f8-4668-82ca-d67b90ca97e5	2025-12-25 13:09:08.900366
fa20a73d-0b45-4ce6-b619-f6193f35928e	d1f5450d-3cb4-4f22-b400-99f4870ac25a	2ac888a0-6e7e-4352-8a44-98324c3e2ee1	2025-12-25 13:09:17.532463
9271fa46-1aa1-4aac-95bd-d3f375b8d894	604e61fb-dc1d-46e3-a183-cc7079cb6862	a38e4616-05ba-4980-952a-af57e080d69c	2025-12-26 19:26:41.332727
d4217aa4-60b6-44ae-8af8-215ca0dc0a9e	604e61fb-dc1d-46e3-a183-cc7079cb6862	6e143d7f-0c3d-4010-bd7b-bad70d54ce15	2025-12-26 20:23:27.131426
f218e3ca-99f5-4695-a835-1fb7f3a4f2c3	604e61fb-dc1d-46e3-a183-cc7079cb6862	a09d43d4-6286-45eb-aacd-854fdc718b4f	2025-12-26 20:23:27.131426
04bdc12c-09ab-45b0-98d9-64963d2a2563	604e61fb-dc1d-46e3-a183-cc7079cb6862	5fc33642-31f5-4113-af78-54bfcc252931	2025-12-26 20:23:27.131426
9a7df307-2e32-4fd5-beda-0bfa090d97c2	d1f5450d-3cb4-4f22-b400-99f4870ac25a	6e143d7f-0c3d-4010-bd7b-bad70d54ce15	2025-12-26 20:23:27.131426
edd8161a-def3-4e97-bcb3-da85f5fe86f6	d1f5450d-3cb4-4f22-b400-99f4870ac25a	a09d43d4-6286-45eb-aacd-854fdc718b4f	2025-12-26 20:23:27.131426
97dd0c3e-af06-4cdb-8b0d-144ef48db22e	d1f5450d-3cb4-4f22-b400-99f4870ac25a	5fc33642-31f5-4113-af78-54bfcc252931	2025-12-26 20:23:27.131426
433f4539-b226-4234-997f-7f5c9d7bc297	604e61fb-dc1d-46e3-a183-cc7079cb6862	be11ddbf-2ef7-4268-b58e-9fc33ec611f2	2025-12-26 20:23:41.065097
6b8c04c4-83af-4532-b78b-d879b536948a	d1f5450d-3cb4-4f22-b400-99f4870ac25a	d5600195-f922-4eb0-ba04-6a041ce89520	2025-12-27 09:58:48.835105
66f88cce-696c-4375-8f2e-8948676b2062	d1f5450d-3cb4-4f22-b400-99f4870ac25a	44b38aa8-4e37-4f13-a706-5de9878d615d	2025-12-27 09:58:50.165109
ce46a293-bf36-482e-8e8d-4be0c76095ff	594e93da-4b9f-409f-a1a9-3a9b0237c31c	8880ce57-6720-4097-b60f-daa64b233de2	2025-12-27 18:27:10.935937
f062c690-3723-4c36-89ff-be7cb8581165	594e93da-4b9f-409f-a1a9-3a9b0237c31c	88c53767-e44e-455e-8df4-a18823414f1e	2025-12-27 18:27:12.712559
7d3ca456-74d6-4b05-9bc7-130ad5cd8ebb	594e93da-4b9f-409f-a1a9-3a9b0237c31c	ab9e8162-a5f8-4668-82ca-d67b90ca97e5	2025-12-27 18:27:31.348027
bb5aea3c-2fa2-47ef-8f4a-7cc3651f562e	e7026902-c194-4850-9f47-41f82f122ffb	8880ce57-6720-4097-b60f-daa64b233de2	2026-01-02 10:38:58.822227
37106b4c-0d2e-443a-9a19-fd7ae3b46a27	e7026902-c194-4850-9f47-41f82f122ffb	0d1930cb-abd5-46c9-b574-031770d5ef2b	2026-01-02 10:38:58.836077
716514b6-6843-4515-85ff-18b3dde0c2e6	e7026902-c194-4850-9f47-41f82f122ffb	a285b8c0-42a6-42f2-9252-74fe1f089285	2026-01-02 10:38:58.868127
e6a1c59d-1467-47c9-ba53-0dacaa217de6	e7026902-c194-4850-9f47-41f82f122ffb	88c53767-e44e-455e-8df4-a18823414f1e	2026-01-02 10:38:58.870282
a17069b8-f4f5-48eb-8c54-089a0a6dee8f	e7026902-c194-4850-9f47-41f82f122ffb	2d31d56c-7f23-4d76-927d-c8d6fb024e84	2026-01-02 10:38:58.874376
95d45497-8c7c-4704-9147-50a1070f8f7b	e7026902-c194-4850-9f47-41f82f122ffb	d196e471-10c3-4f92-9964-10cd333a8d35	2026-01-02 10:38:58.876167
ec513f98-217a-476b-a70a-86434354f3d5	e7026902-c194-4850-9f47-41f82f122ffb	75897114-5de3-4abc-b735-c7ac2cc94863	2026-01-02 10:39:02.978974
305e59dd-30f4-4f18-bbdb-36e48342f046	e7026902-c194-4850-9f47-41f82f122ffb	a38e4616-05ba-4980-952a-af57e080d69c	2026-01-02 10:39:02.9793
6264c3e0-a8a7-4615-bff6-59eb940e4f2a	e7026902-c194-4850-9f47-41f82f122ffb	f28bcad4-e53f-4c4d-9386-d3b7e9bb338b	2026-01-02 10:39:02.983954
45b1ea3d-37a5-4e8d-b892-9f30c64eeb0f	e7026902-c194-4850-9f47-41f82f122ffb	0f3adfd0-baf4-4ad2-b47e-3743c86bd26e	2026-01-02 10:39:02.98642
ac77b581-3b1f-4048-aa23-d0ed0f7f6dd2	e7026902-c194-4850-9f47-41f82f122ffb	671dea78-5bab-4a32-b302-16d2523d2df9	2026-01-02 10:39:02.987297
5edbbe75-eb16-4594-8aca-c611c8a70a73	e7026902-c194-4850-9f47-41f82f122ffb	0fec0cf4-2bf1-4a74-9d80-40ed142d9af6	2026-01-02 10:39:03.027394
7e37697c-7266-4c8a-82ff-710d41b94098	e7026902-c194-4850-9f47-41f82f122ffb	2b306985-f7d0-48d1-994e-3c616c5d4323	2026-01-02 10:39:03.033399
1e0b7945-5ded-4c97-90de-5547a44fd6fc	e7026902-c194-4850-9f47-41f82f122ffb	3bb5c1d7-8b94-492c-8225-5077e6a58861	2026-01-02 10:39:03.03885
82a9ef17-821d-4a7f-b6aa-2fa391380c14	604e61fb-dc1d-46e3-a183-cc7079cb6862	f3163b24-cad4-4f2c-937a-3514220ac91d	2026-01-03 11:29:40.60035
e322d0fc-bd2e-402e-ad3b-219396684e25	e7026902-c194-4850-9f47-41f82f122ffb	1af11c8b-f686-4b65-913c-dc6e45d0cef5	2026-01-03 11:42:09.147215
b1bf6799-4149-46bd-9fda-870f6b4b2d3c	e7026902-c194-4850-9f47-41f82f122ffb	ab9e8162-a5f8-4668-82ca-d67b90ca97e5	2026-01-03 11:42:09.148105
8056be26-bded-4a7e-94e8-1f097c837a7e	e7026902-c194-4850-9f47-41f82f122ffb	2ac888a0-6e7e-4352-8a44-98324c3e2ee1	2026-01-03 11:42:09.148806
2eda5a24-3f6b-4cfe-8eec-6c476556c595	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	8880ce57-6720-4097-b60f-daa64b233de2	2026-01-03 11:42:17.227039
5a0d336a-c276-4e28-9e91-6fb915239478	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	88c53767-e44e-455e-8df4-a18823414f1e	2026-01-03 11:42:17.229406
b0059226-81c9-4fea-8013-c7a80ed71e5a	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	a285b8c0-42a6-42f2-9252-74fe1f089285	2026-01-03 11:42:17.232714
ac5e2e34-3c3f-4128-8f26-accc21f32c22	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	d196e471-10c3-4f92-9964-10cd333a8d35	2026-01-03 11:42:17.236745
c156e366-2774-4e9d-976c-9b898a4b7a85	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	0d1930cb-abd5-46c9-b574-031770d5ef2b	2026-01-03 11:42:17.238272
641dd266-4331-4d0c-b258-71b9784ed433	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	2d31d56c-7f23-4d76-927d-c8d6fb024e84	2026-01-03 11:42:17.239429
e621f1ec-1e39-4561-b971-68c6e37f731d	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	671dea78-5bab-4a32-b302-16d2523d2df9	2026-01-03 11:42:18.999846
6753391a-e27a-4d1d-8baa-8423c7e72b97	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	a38e4616-05ba-4980-952a-af57e080d69c	2026-01-03 11:42:19.00013
0007450e-0c28-4141-a8fa-377fab9dd929	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	75897114-5de3-4abc-b735-c7ac2cc94863	2026-01-03 11:42:19.000492
5c661ead-ebf4-4613-bb28-804590a1ff94	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	0fec0cf4-2bf1-4a74-9d80-40ed142d9af6	2026-01-03 11:42:19.004882
9bb96807-4fe6-4633-9fc1-f4d67d49f559	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	f28bcad4-e53f-4c4d-9386-d3b7e9bb338b	2026-01-03 11:42:19.00516
e3656909-ca96-4466-a644-5d4bf663f695	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	0f3adfd0-baf4-4ad2-b47e-3743c86bd26e	2026-01-03 11:42:19.009941
2d05d664-7efd-41df-92c3-8c9f59c67bbb	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	2b306985-f7d0-48d1-994e-3c616c5d4323	2026-01-03 11:42:19.030734
1674ca93-05ac-44c6-994e-e3756a551fc5	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	3bb5c1d7-8b94-492c-8225-5077e6a58861	2026-01-03 11:42:19.031907
457c5248-3f60-4e99-bfa9-fb26472b6960	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	ab9e8162-a5f8-4668-82ca-d67b90ca97e5	2026-01-03 11:42:24.70301
319cfd8c-d257-4ed0-a389-a9354a7edb0d	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	1af11c8b-f686-4b65-913c-dc6e45d0cef5	2026-01-03 11:42:24.703852
55316c82-eb13-4b43-acc9-37ecc932e457	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	2ac888a0-6e7e-4352-8a44-98324c3e2ee1	2026-01-03 11:42:24.70461
7dd3601f-a303-4457-a182-11b484e756b7	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	8880ce57-6720-4097-b60f-daa64b233de2	2026-01-03 11:42:34.33066
8dc2e210-43b8-4e4a-9387-e511ed87e168	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	a285b8c0-42a6-42f2-9252-74fe1f089285	2026-01-03 11:42:34.334693
ba4fccbf-ea84-4bba-a8fc-2831021bb249	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	0d1930cb-abd5-46c9-b574-031770d5ef2b	2026-01-03 11:42:34.346993
b32118eb-d2b7-4887-b022-556bfbe6c088	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	88c53767-e44e-455e-8df4-a18823414f1e	2026-01-03 11:42:34.347402
b8ddac11-dce7-426a-b1ad-c11b2b11c675	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	2d31d56c-7f23-4d76-927d-c8d6fb024e84	2026-01-03 11:42:34.350713
35ab08f8-70ab-4013-b5b6-6099fc628ca6	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	f28bcad4-e53f-4c4d-9386-d3b7e9bb338b	2026-01-03 11:42:36.991401
bdac5d91-c5af-4ffc-8b4c-075b9fde83b8	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	671dea78-5bab-4a32-b302-16d2523d2df9	2026-01-03 11:42:36.991693
24f90cb9-73dc-448f-a9ed-ca65fec9e2df	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	75897114-5de3-4abc-b735-c7ac2cc94863	2026-01-03 11:42:36.993778
c9fe3abf-316f-4054-b4ab-465058f4f4fd	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	0f3adfd0-baf4-4ad2-b47e-3743c86bd26e	2026-01-03 11:42:36.998535
c6a19b9f-89f1-473c-be1a-5425b1179597	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	3bb5c1d7-8b94-492c-8225-5077e6a58861	2026-01-03 11:42:37.004625
84bc776c-9f85-421c-ac25-129740b802d5	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	1af11c8b-f686-4b65-913c-dc6e45d0cef5	2026-01-03 11:43:05.890037
d73d3d53-e095-4863-ace3-c9e8674b51e6	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	ab9e8162-a5f8-4668-82ca-d67b90ca97e5	2026-01-03 11:43:05.892719
ee6f056d-3e8d-4ddb-ae47-2e3a7bb788e2	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	2ac888a0-6e7e-4352-8a44-98324c3e2ee1	2026-01-03 11:43:05.893072
aa80922f-be9f-4730-bd12-d20fd7cce485	c4dc4ac3-2a1f-423b-abef-01945cdf1589	59064b60-dcd4-4353-9175-bf86d8470038	2026-01-03 12:04:02.854685
27347e59-743e-4064-ac42-2d8ef387e96f	c4dc4ac3-2a1f-423b-abef-01945cdf1589	5ff9d52b-dad4-44f5-be1c-3201a0bdd856	2026-01-03 12:04:04.034883
aa5f7d27-5ae4-459b-99ec-56053c6f54ce	c4dc4ac3-2a1f-423b-abef-01945cdf1589	87c3a465-56d0-4032-9413-6f3906916394	2026-01-03 12:04:07.216828
0e2020a4-e3aa-4ea7-a890-13d462ec8810	c4dc4ac3-2a1f-423b-abef-01945cdf1589	9f31a545-8c12-4c3a-a0c8-4acf895e6541	2026-01-03 12:04:08.25065
ccc881c6-be16-4d3c-a4a5-3af7452fe053	c4dc4ac3-2a1f-423b-abef-01945cdf1589	88c53767-e44e-455e-8df4-a18823414f1e	2026-01-03 12:04:33.031755
a98090ee-10de-4060-8384-85ce8d5bf0dd	c4dc4ac3-2a1f-423b-abef-01945cdf1589	a285b8c0-42a6-42f2-9252-74fe1f089285	2026-01-03 12:04:52.610032
2c349fa2-1de8-45b5-a5b2-6283e2b09935	c4dc4ac3-2a1f-423b-abef-01945cdf1589	8880ce57-6720-4097-b60f-daa64b233de2	2026-01-03 12:04:52.614579
195506db-9300-4325-8f40-3b0a9408c364	c4dc4ac3-2a1f-423b-abef-01945cdf1589	2d31d56c-7f23-4d76-927d-c8d6fb024e84	2026-01-03 12:04:52.660151
6ae9bf85-8531-4e7c-af12-d8b9ad210aff	c4dc4ac3-2a1f-423b-abef-01945cdf1589	0d1930cb-abd5-46c9-b574-031770d5ef2b	2026-01-03 12:04:52.664317
38b32ea6-2425-4cc1-af95-84a44e198513	c4dc4ac3-2a1f-423b-abef-01945cdf1589	d196e471-10c3-4f92-9964-10cd333a8d35	2026-01-03 12:04:52.669835
35ba7136-6c14-4f57-afcf-8e2b9a04be84	604e61fb-dc1d-46e3-a183-cc7079cb6862	d5600195-f922-4eb0-ba04-6a041ce89520	2026-01-04 20:27:38.490713
9f272085-b47c-4c57-9733-3827104a4a2c	604e61fb-dc1d-46e3-a183-cc7079cb6862	c8e4b346-0287-4b5a-a074-d2c0f3e6a7d2	2026-01-04 20:27:38.495331
d3cd5234-ab37-4ad7-9a3d-314892b1042e	604e61fb-dc1d-46e3-a183-cc7079cb6862	44b38aa8-4e37-4f13-a706-5de9878d615d	2026-01-04 20:27:38.5143
d601b86b-4305-4738-9d20-8a3983a56af5	604e61fb-dc1d-46e3-a183-cc7079cb6862	00d3d9c2-63b3-44b0-9d0d-e912f74f407a	2026-01-05 04:12:31.353664
415b46f6-a8ba-44d5-b698-cce1df4e3c21	d1f5450d-3cb4-4f22-b400-99f4870ac25a	00d3d9c2-63b3-44b0-9d0d-e912f74f407a	2026-01-05 04:12:31.353664
115ca5a8-818e-4b08-837c-5f19c2f44b96	594e93da-4b9f-409f-a1a9-3a9b0237c31c	00d3d9c2-63b3-44b0-9d0d-e912f74f407a	2026-01-05 04:12:31.353664
543c6a6f-7a0f-4f6c-a7f9-d5fa3b499777	e7026902-c194-4850-9f47-41f82f122ffb	00d3d9c2-63b3-44b0-9d0d-e912f74f407a	2026-01-05 04:12:31.353664
7db6f676-f2ac-4761-8a44-18615b3c16b9	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	00d3d9c2-63b3-44b0-9d0d-e912f74f407a	2026-01-05 04:12:31.353664
fcd46035-6722-4ae9-8d15-d8dc960f92fa	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	00d3d9c2-63b3-44b0-9d0d-e912f74f407a	2026-01-05 04:12:31.353664
d72801ba-8729-48b7-91bb-fa974c734d88	c4dc4ac3-2a1f-423b-abef-01945cdf1589	00d3d9c2-63b3-44b0-9d0d-e912f74f407a	2026-01-05 04:12:31.353664
7931c920-3ec0-4222-9428-b49d34ed6634	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	2634ad72-d50e-4571-9dce-3570f3b377a6	2026-01-05 04:13:46.452858
03220733-3351-4192-b6a7-0a7fb217c82d	604e61fb-dc1d-46e3-a183-cc7079cb6862	2634ad72-d50e-4571-9dce-3570f3b377a6	2026-01-05 04:14:20.132588
b72722d7-5fc8-4b1e-a674-e816bc3f06ca	c4dc4ac3-2a1f-423b-abef-01945cdf1589	2634ad72-d50e-4571-9dce-3570f3b377a6	2026-01-05 04:52:21.686929
cac1e8d9-5769-4a94-b984-5588a3407941	c4dc4ac3-2a1f-423b-abef-01945cdf1589	2ac888a0-6e7e-4352-8a44-98324c3e2ee1	2026-01-05 04:52:23.9239
f3d04a7f-39ce-4fd1-a00d-24f3f56f0cf6	c4dc4ac3-2a1f-423b-abef-01945cdf1589	ab9e8162-a5f8-4668-82ca-d67b90ca97e5	2026-01-05 04:52:30.214891
df4a4d3e-cff8-45ad-9e92-e075c8bfabb5	c4dc4ac3-2a1f-423b-abef-01945cdf1589	1af11c8b-f686-4b65-913c-dc6e45d0cef5	2026-01-05 04:52:30.967529
dddf4f6f-4aa3-4195-ad10-52834f98b587	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	5ff9d52b-dad4-44f5-be1c-3201a0bdd856	2026-01-05 04:56:08.401813
7ed8c844-c71a-4b4d-be64-623a722e4a3b	604e61fb-dc1d-46e3-a183-cc7079cb6862	e876f9ea-34fd-43e9-a5f4-c00b66c18c16	2026-01-05 16:31:20.30088
678de4be-3f29-40ac-b157-c18092f6e90b	604e61fb-dc1d-46e3-a183-cc7079cb6862	392ad182-55db-4b98-8230-427b28f1a106	2026-01-05 18:09:20.184001
602cee24-1865-4a03-acba-7f16f9c3f527	604e61fb-dc1d-46e3-a183-cc7079cb6862	646c51d4-1108-4b13-aa83-4f5a93e07b10	2026-01-05 18:09:20.184001
d1536867-db52-46cb-86be-bfe447b6c9fe	604e61fb-dc1d-46e3-a183-cc7079cb6862	11403b5e-0f37-4bdb-a2ae-073ad67f16f0	2026-01-05 18:09:20.184001
5bbd7620-bc7c-442b-b45a-c83c75b8cd6e	e7026902-c194-4850-9f47-41f82f122ffb	2634ad72-d50e-4571-9dce-3570f3b377a6	2026-01-06 10:50:48.803915
37c3f12b-5b67-4507-a277-5b1df93fb89b	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	d196e471-10c3-4f92-9964-10cd333a8d35	2026-01-06 10:51:44.944398
aa1f25a4-e912-4c93-a1f3-4195af5d081a	604e61fb-dc1d-46e3-a183-cc7079cb6862	938d1492-bd0b-455d-80be-44360c722e96	2026-01-07 17:57:41.8358
35c0579f-95cd-46c8-9d8a-404b79071fc6	604e61fb-dc1d-46e3-a183-cc7079cb6862	17eed89b-5568-4189-98f0-42eb79627ede	2026-01-07 17:57:41.8358
be12019c-4e9d-47ce-a416-335f1ea5b98d	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	17eed89b-5568-4189-98f0-42eb79627ede	2026-01-07 18:18:40.666708
17d9b5fb-224c-4130-a7b6-77adc943b730	e7026902-c194-4850-9f47-41f82f122ffb	17eed89b-5568-4189-98f0-42eb79627ede	2026-01-07 19:06:19.618687
ff8627db-ec07-4ca3-a4e7-d8bdd6e1d675	e7026902-c194-4850-9f47-41f82f122ffb	938d1492-bd0b-455d-80be-44360c722e96	2026-01-07 19:06:20.263854
10a3e941-0ecb-4208-83dd-9fc1444a9a61	c4dc4ac3-2a1f-423b-abef-01945cdf1589	17eed89b-5568-4189-98f0-42eb79627ede	2026-01-07 19:07:30.414011
4b5cd150-215f-4efb-9aa5-9f42dbc13b4d	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	17eed89b-5568-4189-98f0-42eb79627ede	2026-01-07 19:07:37.894928
c4a95383-4899-4d97-b988-26163c89e1ae	e7026902-c194-4850-9f47-41f82f122ffb	3d0fc05b-37cb-4a79-87aa-914edce15b16	2026-01-08 07:07:13.181348
49cdc263-d918-41ea-92ac-36503cbd2cc5	e7026902-c194-4850-9f47-41f82f122ffb	861e837f-b8d7-4d95-b690-99b6ba7b8359	2026-01-08 07:07:32.225185
acb268c6-5b42-4760-a761-a053dd895a69	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	3d0fc05b-37cb-4a79-87aa-914edce15b16	2026-01-08 07:08:21.649676
9efcb1ab-3b99-43af-98c4-7da77c0ba217	e7026902-c194-4850-9f47-41f82f122ffb	5ff9d52b-dad4-44f5-be1c-3201a0bdd856	2026-01-08 07:08:57.743456
bfca73cc-b298-469c-8e42-98659d19a186	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	5ff9d52b-dad4-44f5-be1c-3201a0bdd856	2026-01-08 07:09:22.373579
4c3eb7de-28b0-49dd-8271-7a7bdb632cac	ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	861e837f-b8d7-4d95-b690-99b6ba7b8359	2026-01-08 07:09:41.265172
c0d26bd9-b52d-48e5-bbbe-d034d1795c3e	4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	861e837f-b8d7-4d95-b690-99b6ba7b8359	2026-01-08 07:10:23.944515
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: auth_schema; Owner: sourcecorp_user
--

COPY auth_schema.roles (id, name, description, created_at, updated_at) FROM stdin;
604e61fb-dc1d-46e3-a183-cc7079cb6862	Admin	System Administrator	2025-12-24 17:20:19.65299	2025-12-24 17:20:19.65299
d1f5450d-3cb4-4f22-b400-99f4870ac25a	hr	\N	2025-12-24 17:43:55.555241	2025-12-24 17:43:55.555241
594e93da-4b9f-409f-a1a9-3a9b0237c31c	aabc	\N	2025-12-27 18:27:00.773753	2025-12-27 18:27:00.773753
e7026902-c194-4850-9f47-41f82f122ffb	operational head	\N	2026-01-02 10:37:55.661043	2026-01-02 10:37:55.661043
ecf77d9e-65bc-45aa-9ca7-aafc2fb506ac	Backend	\N	2026-01-03 11:41:08.77724	2026-01-03 11:41:08.77724
4bf6549a-a9ca-429d-96fd-5f05ce7de1c3	Executive	\N	2026-01-03 11:41:51.628834	2026-01-03 11:41:51.628834
c4dc4ac3-2a1f-423b-abef-01945cdf1589	Digital Marketing	\N	2026-01-03 12:00:11.606199	2026-01-03 12:00:11.606199
\.


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: auth_schema; Owner: sourcecorp_user
--

COPY auth_schema.team_members (id, team_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: auth_schema; Owner: sourcecorp_user
--

COPY auth_schema.teams (id, name, description, created_at, updated_at) FROM stdin;
d4833ff3-98a7-4bb3-a1ee-284b0c3e991b	abc	\N	2025-12-24 17:56:03.56663	2025-12-24 17:56:03.56663
d23f8f03-a7b9-4517-a444-25f173b75774	kk	\N	2025-12-25 11:10:36.881594	2025-12-25 11:10:36.881594
\.


--
-- Data for Name: user_hierarchy; Type: TABLE DATA; Schema: auth_schema; Owner: sourcecorp_user
--

COPY auth_schema.user_hierarchy (id, manager_id, subordinate_id, created_at) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: auth_schema; Owner: sourcecorp_user
--

COPY auth_schema.user_roles (id, user_id, role_id, created_at) FROM stdin;
58d8675a-d231-4699-8d44-2a1babed9574	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	604e61fb-dc1d-46e3-a183-cc7079cb6862	2025-12-24 17:20:19.664869
14299bac-fbd6-4ac5-acf9-a7ae6e37bf9e	b64ff57d-946b-499e-8629-3bf1662905a8	604e61fb-dc1d-46e3-a183-cc7079cb6862	2026-01-03 11:44:44.670556
7c15c06a-e983-4dcd-bfa0-fe86cf854237	8ca5cef3-9674-4243-8fef-016bdfef4974	604e61fb-dc1d-46e3-a183-cc7079cb6862	2026-01-03 11:45:57.013561
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth_schema; Owner: sourcecorp_user
--

COPY auth_schema.users (id, email, password_hash, first_name, last_name, is_active, created_at, updated_at) FROM stdin;
8ca5cef3-9674-4243-8fef-016bdfef4974	VIGNESWAR@SOURCECORP.IN	$2a$10$nf2QDNm8cXIUkivqj6bcCen4mX48OinRJ9GnkFlCkcIbkjM5l1e8C	VIGNESWAR	VENKATESAN	t	2026-01-03 11:45:50.744165	2026-01-03 11:45:50.744165
03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	admin@gmail.com	$2a$10$FHwu0olsn/t.7.qTAUy7TOmwbqbjIeKbmSPfUM8xw9EDB15NruVIO	Kavik	Kannan	t	2025-12-24 17:20:19.647068	2026-01-10 08:40:38.041613
b64ff57d-946b-499e-8629-3bf1662905a8	shayinabegum@sourcecorp.in	$2a$10$TQFDMLBS7O79DlCoYlYxQ.pTyRtbgY66RCjqlQuuwEaGmtfbCL3DO	shayin	j	t	2026-01-02 10:42:34.046702	2026-02-23 10:14:30.2475
\.


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: chat_schema; Owner: sourcecorp_user
--

COPY chat_schema.attachments (id, message_id, file_name, file_path, mime_type, file_size, uploaded_by, uploaded_at) FROM stdin;
\.


--
-- Data for Name: channel_creation_requests; Type: TABLE DATA; Schema: chat_schema; Owner: sourcecorp_user
--

COPY chat_schema.channel_creation_requests (id, requested_by, channel_name, channel_type, target_role_id, target_team_id, requested_members, status, reviewed_by, review_notes, created_at, reviewed_at) FROM stdin;
\.


--
-- Data for Name: channel_members; Type: TABLE DATA; Schema: chat_schema; Owner: sourcecorp_user
--

COPY chat_schema.channel_members (id, channel_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: channels; Type: TABLE DATA; Schema: chat_schema; Owner: sourcecorp_user
--

COPY chat_schema.channels (id, name, type, created_by, created_at, status) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: chat_schema; Owner: sourcecorp_user
--

COPY chat_schema.messages (id, channel_id, sender_id, message_type, content, created_at) FROM stdin;
\.


--
-- Data for Name: case_assignments; Type: TABLE DATA; Schema: crm_schema; Owner: sourcecorp_user
--

COPY crm_schema.case_assignments (id, case_id, assigned_to, assigned_by, assigned_at) FROM stdin;
\.


--
-- Data for Name: case_notes; Type: TABLE DATA; Schema: crm_schema; Owner: sourcecorp_user
--

COPY crm_schema.case_notes (id, case_id, note, created_by, created_at, document_id) FROM stdin;
\.


--
-- Data for Name: case_notifications; Type: TABLE DATA; Schema: crm_schema; Owner: sourcecorp_user
--

COPY crm_schema.case_notifications (id, case_id, scheduled_for, scheduled_by, message, scheduled_at, status, created_at, updated_at, is_read, completion_status, document_id, change_request_id) FROM stdin;
\.


--
-- Data for Name: case_status_history; Type: TABLE DATA; Schema: crm_schema; Owner: sourcecorp_user
--

COPY crm_schema.case_status_history (id, case_id, from_status, to_status, changed_by, changed_at, remarks) FROM stdin;
\.


--
-- Data for Name: cases; Type: TABLE DATA; Schema: crm_schema; Owner: sourcecorp_user
--

COPY crm_schema.cases (id, case_number, customer_name, customer_email, customer_phone, loan_type, loan_amount, current_status, created_by, created_at, updated_at, source_type) FROM stdin;
\.


--
-- Data for Name: customer_detail_change_requests; Type: TABLE DATA; Schema: crm_schema; Owner: sourcecorp_user
--

COPY crm_schema.customer_detail_change_requests (id, case_id, requested_by, requested_for, requested_changes, status, approval_remarks, approved_by, approved_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_detail_sheets; Type: TABLE DATA; Schema: crm_schema; Owner: sourcecorp_user
--

COPY crm_schema.customer_detail_sheets (id, case_id, detail_data, uploaded_by, uploaded_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_detail_template; Type: TABLE DATA; Schema: crm_schema; Owner: sourcecorp_user
--

COPY crm_schema.customer_detail_template (id, field_key, field_label, is_visible, display_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: crm_schema; Owner: sourcecorp_user
--

COPY crm_schema.documents (id, case_id, file_name, file_path, mime_type, file_size, uploaded_by, uploaded_at) FROM stdin;
\.


--
-- Data for Name: cam_entries; Type: TABLE DATA; Schema: finance_schema; Owner: sourcecorp_user
--

COPY finance_schema.cam_entries (id, case_id, template_id, cam_data, version, created_by, created_at, template_snapshot, user_added_fields) FROM stdin;
\.


--
-- Data for Name: cam_fields; Type: TABLE DATA; Schema: finance_schema; Owner: sourcecorp_user
--

COPY finance_schema.cam_fields (id, template_id, section_name, field_key, label, field_type, is_mandatory, is_user_addable, order_index, default_value, validation_rules, select_options, created_at) FROM stdin;
584c8827-95bd-4d17-90aa-0bc961317fbc	9ef2e115-70d7-4acc-85c0-001fe383ec10	test 2 sec 2	field_2	phone	text	f	t	1	\N	\N	\N	2025-12-26 19:37:02.12023
9d69f805-ad96-48f0-9e44-e24b13792360	9ef2e115-70d7-4acc-85c0-001fe383ec10	test sec 1	field_1	Customer name	text	t	f	0	\N	\N	\N	2025-12-26 19:37:02.12251
d8987235-a42b-41dc-a2b2-742c8122136a	6ab0b572-eaed-458b-afab-a7f7297ca90c	Applicant Profile	applicant_name	Applicant Name	text	t	f	0	\N	\N	\N	2025-12-27 11:11:40.274226
2e0f7873-0d66-46a5-9ba3-7dd7602600d3	6ab0b572-eaed-458b-afab-a7f7297ca90c	Applicant Profile	applicant_age	Age	number	t	f	1	\N	\N	\N	2025-12-27 11:11:40.281178
db509f07-c292-4935-88c1-9feb396d457c	6ab0b572-eaed-458b-afab-a7f7297ca90c	Applicant Profile	applicant_occupation	Occupation	text	t	f	2	\N	\N	\N	2025-12-27 11:11:40.283575
e1e63c5e-f82e-4ed2-803a-631069adfc02	6ab0b572-eaed-458b-afab-a7f7297ca90c	Applicant Profile	applicant_experience_years	Years of Experience	number	f	f	3	\N	\N	\N	2025-12-27 11:11:40.285856
6f1ad641-39a0-4b67-ba34-d47fb90fd43d	6ab0b572-eaed-458b-afab-a7f7297ca90c	Applicant Profile	co_applicant_name	Co-Applicant Name	text	f	f	4	\N	\N	\N	2025-12-27 11:11:40.288096
7cc61afa-b898-4d8a-80c6-91595426d9bb	6ab0b572-eaed-458b-afab-a7f7297ca90c	Loan Proposal	loan_amount	Loan Amount Requested	currency	t	f	0	\N	\N	\N	2025-12-27 11:11:40.290455
ca5e4d64-b05e-4b92-b19c-f8ebf295c8f9	6ab0b572-eaed-458b-afab-a7f7297ca90c	Loan Proposal	loan_purpose	Loan Purpose	select	t	f	1	\N	\N	["Purchase", "Construction", "Renovation", "Balance Transfer", "Top-up", "Other"]	2025-12-27 11:11:40.292568
3cf6c322-2b69-4ecc-9676-f8e5ef993abc	6ab0b572-eaed-458b-afab-a7f7297ca90c	Loan Proposal	loan_tenure_months	Loan Tenure (Months)	number	t	f	2	\N	\N	\N	2025-12-27 11:11:40.294734
7516979b-0512-44f3-87a5-a15c5ec65251	6ab0b572-eaed-458b-afab-a7f7297ca90c	Loan Proposal	interest_rate	Interest Rate (%)	number	t	f	3	\N	\N	\N	2025-12-27 11:11:40.297111
8049cd5a-d572-4433-9b71-229535fc2549	6ab0b572-eaed-458b-afab-a7f7297ca90c	Loan Proposal	emi_amount	Proposed EMI	currency	t	f	4	\N	\N	\N	2025-12-27 11:11:40.299308
04ef43b8-d44e-4b35-9489-4020744b513f	6ab0b572-eaed-458b-afab-a7f7297ca90c	Financial Details	monthly_income	Monthly Income	currency	t	f	0	\N	\N	\N	2025-12-27 11:11:40.301894
8f728133-6d64-4704-bbce-1d814693d700	6ab0b572-eaed-458b-afab-a7f7297ca90c	Financial Details	monthly_obligations	Monthly Obligations	currency	t	f	1	\N	\N	\N	2025-12-27 11:11:40.303873
8e9dc8a7-e40d-47f5-b4dc-879ceeb355f8	6ab0b572-eaed-458b-afab-a7f7297ca90c	Financial Details	net_monthly_income	Net Monthly Income	currency	t	f	2	\N	\N	\N	2025-12-27 11:11:40.305735
b2551d6d-b221-4c1f-b8f0-b0c1aeb95bd8	6ab0b572-eaed-458b-afab-a7f7297ca90c	Financial Details	foir_percentage	FOIR (%)	number	t	f	3	\N	\N	\N	2025-12-27 11:11:40.307701
92265533-444f-4350-b9f9-65858c9ae342	6ab0b572-eaed-458b-afab-a7f7297ca90c	Financial Details	credit_score	Credit Score	number	f	f	4	\N	\N	\N	2025-12-27 11:11:40.309473
4526390b-4733-4d53-a0d5-496d51e056af	6ab0b572-eaed-458b-afab-a7f7297ca90c	Financial Details	existing_loans	Existing Loans	text	f	f	5	\N	\N	\N	2025-12-27 11:11:40.311437
a0526421-1e02-48e7-992c-ce3b68f5a0ab	6ab0b572-eaed-458b-afab-a7f7297ca90c	Property Details	property_type	Property Type	select	t	f	0	\N	\N	["Residential", "Commercial", "Plot", "Under Construction", "Ready to Move"]	2025-12-27 11:11:40.313308
afd3027c-1808-4e7a-a347-abb4442782d5	6ab0b572-eaed-458b-afab-a7f7297ca90c	Property Details	property_value	Property Value	currency	t	f	1	\N	\N	\N	2025-12-27 11:11:40.315135
fa2b07b4-95fe-493e-b8a9-c271c109a9a5	6ab0b572-eaed-458b-afab-a7f7297ca90c	Property Details	ltv_percentage	LTV (%)	number	t	f	2	\N	\N	\N	2025-12-27 11:11:40.316992
0f2cf7a2-ee7a-4afd-a657-4dcfa81704f1	6ab0b572-eaed-458b-afab-a7f7297ca90c	Property Details	property_location	Property Location	text	t	f	3	\N	\N	\N	2025-12-27 11:11:40.318434
78d833c8-5f34-4816-a82e-dfb3f38c66d4	6ab0b572-eaed-458b-afab-a7f7297ca90c	Risk Assessment	risk_level	Risk Level	select	t	f	0	\N	\N	["Low", "Medium", "High"]	2025-12-27 11:11:40.320481
56028ac9-f601-4164-a340-01560a8c7fd6	6ab0b572-eaed-458b-afab-a7f7297ca90c	Risk Assessment	risk_factors	Risk Factors	text	f	f	1	\N	\N	\N	2025-12-27 11:11:40.32218
66e93cf3-c129-4931-9ec1-13ae7f4e6f16	6ab0b572-eaed-458b-afab-a7f7297ca90c	Risk Assessment	mitigation_measures	Mitigation Measures	text	f	f	2	\N	\N	\N	2025-12-27 11:11:40.323665
5c688a3d-908a-4f15-863a-a4299e6dc131	6ab0b572-eaed-458b-afab-a7f7297ca90c	Justification	justification	Justification for Loan Approval	text	t	f	0	\N	\N	\N	2025-12-27 11:11:40.3261
64a5df97-cfce-4793-8a33-13bdd5c1bc00	6ab0b572-eaed-458b-afab-a7f7297ca90c	Justification	additional_notes	Additional Notes	text	f	t	1	\N	\N	\N	2025-12-27 11:11:40.328038
5be3b165-a5ec-40a2-be1a-3a8bd520723f	6ab0b572-eaed-458b-afab-a7f7297ca90c	Conclusion	recommendation	Recommendation	select	t	f	0	\N	\N	["Approve", "Approve with Conditions", "Reject", "Refer to Higher Authority"]	2025-12-27 11:11:40.329679
06e6af4e-adb5-40ad-8c62-25b503d65e40	6ab0b572-eaed-458b-afab-a7f7297ca90c	Conclusion	approved_amount	Approved Amount	currency	f	f	1	\N	\N	\N	2025-12-27 11:11:40.33138
8c6e065d-c4b4-43c8-81fa-3857cdb5c4eb	6ab0b572-eaed-458b-afab-a7f7297ca90c	Conclusion	approval_conditions	Approval Conditions	text	f	t	2	\N	\N	\N	2025-12-27 11:11:40.333
7eed4bf2-c6b3-4722-babc-000bc05b8d9d	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Applicant Profile	applicant_name	Applicant Name	text	t	f	0	\N	\N	\N	2025-12-27 11:16:04.039549
6de03c68-bf1e-45bb-a283-bf25d7b85975	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Applicant Profile	applicant_age	Age	number	t	f	1	\N	\N	\N	2025-12-27 11:16:04.043395
3b4eacdb-cf94-4835-b394-397df0aac0c1	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Applicant Profile	applicant_occupation	Occupation	text	t	f	2	\N	\N	\N	2025-12-27 11:16:04.045346
60d1137a-161e-4526-b363-c9561c35c841	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Applicant Profile	applicant_experience_years	Years of Experience	number	f	f	3	\N	\N	\N	2025-12-27 11:16:04.04722
6c8d4a98-f70a-40d3-a955-155193f55b8a	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Applicant Profile	co_applicant_name	Co-Applicant Name	text	f	f	4	\N	\N	\N	2025-12-27 11:16:04.049477
c9ab958e-31f3-4d0c-be39-468d2aef1789	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Loan Proposal	loan_amount	Loan Amount Requested	currency	t	f	0	\N	\N	\N	2025-12-27 11:16:04.051557
dfc8112a-3cdf-47a1-afb2-e60587f2b5e5	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Loan Proposal	loan_purpose	Loan Purpose	select	t	f	1	\N	\N	["Purchase", "Construction", "Renovation", "Balance Transfer", "Top-up", "Other"]	2025-12-27 11:16:04.053559
d748e2f7-b19c-4a1d-9bae-bdf925378dfa	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Loan Proposal	loan_tenure_months	Loan Tenure (Months)	number	t	f	2	\N	\N	\N	2025-12-27 11:16:04.056111
49e890e6-9214-40e5-8524-a4dd46263869	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Loan Proposal	interest_rate	Interest Rate (%)	number	t	f	3	\N	\N	\N	2025-12-27 11:16:04.058242
b6eb43b6-d515-4795-8bc1-4a7e6c761878	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Loan Proposal	emi_amount	Proposed EMI	currency	t	f	4	\N	\N	\N	2025-12-27 11:16:04.060837
c4f0a9c5-dd1c-4645-992c-61c2da189ee6	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Financial Details	monthly_income	Monthly Income	currency	t	f	0	\N	\N	\N	2025-12-27 11:16:04.063389
60343231-18a9-4034-98f9-69930c3bb9db	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Financial Details	monthly_obligations	Monthly Obligations	currency	t	f	1	\N	\N	\N	2025-12-27 11:16:04.065433
c95705fe-3a9c-4acb-a6f3-a7a66c90c93e	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Financial Details	net_monthly_income	Net Monthly Income	currency	t	f	2	\N	\N	\N	2025-12-27 11:16:04.06731
9eeb9165-c262-4a8e-9c53-9f8cf4749b2e	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Financial Details	foir_percentage	FOIR (%)	number	t	f	3	\N	\N	\N	2025-12-27 11:16:04.069149
42b52f1f-c6df-4889-81a5-41168ef3158e	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Financial Details	credit_score	Credit Score	number	f	f	4	\N	\N	\N	2025-12-27 11:16:04.071164
27f75d23-69af-43fe-a71c-d93b82ddcac7	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Financial Details	existing_loans	Existing Loans	text	f	f	5	\N	\N	\N	2025-12-27 11:16:04.073302
04ac1db9-7ee7-4ee0-b106-a8b0e8e6038f	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Property Details	property_type	Property Type	select	t	f	0	\N	\N	["Residential", "Commercial", "Plot", "Under Construction", "Ready to Move"]	2025-12-27 11:16:04.075355
1656a654-1fae-4e5d-8d86-c80f232366af	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Property Details	property_value	Property Value	currency	t	f	1	\N	\N	\N	2025-12-27 11:16:04.077108
fb65fe1c-154c-4e46-804b-974af5bba703	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Property Details	ltv_percentage	LTV (%)	number	t	f	2	\N	\N	\N	2025-12-27 11:16:04.078611
102f4fde-0bb7-4505-817e-74468d135c41	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Property Details	property_location	Property Location	text	t	f	3	\N	\N	\N	2025-12-27 11:16:04.080097
a7fe5be5-6cde-4002-8f8d-5678d0d2f014	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Risk Assessment	risk_level	Risk Level	select	t	f	0	\N	\N	["Low", "Medium", "High"]	2025-12-27 11:16:04.081863
08c3ecb1-2fe5-41e8-a0a5-817d6059f572	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Risk Assessment	risk_factors	Risk Factors	text	f	f	1	\N	\N	\N	2025-12-27 11:16:04.083518
5b759021-6cf8-4463-970e-6eb352279cff	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Risk Assessment	mitigation_measures	Mitigation Measures	text	f	f	2	\N	\N	\N	2025-12-27 11:16:04.087591
8c78028d-8092-4467-971d-7439403e2e48	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Justification	justification	Justification for Loan Approval	text	t	f	0	\N	\N	\N	2025-12-27 11:16:04.0895
1002ad56-56b1-4e4c-8ba5-5669ecdb7449	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Justification	additional_notes	Additional Notes	text	f	t	1	\N	\N	\N	2025-12-27 11:16:04.091332
ff990ae0-a3a2-482a-8433-c0903266c3a0	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Conclusion	recommendation	Recommendation	select	t	f	0	\N	\N	["Approve", "Approve with Conditions", "Reject", "Refer to Higher Authority"]	2025-12-27 11:16:04.092953
926621dd-243c-4228-b287-6dd19128f574	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Conclusion	approved_amount	Approved Amount	currency	f	f	1	\N	\N	\N	2025-12-27 11:16:04.094627
3e09c09c-b21e-4478-8372-b10c033b6dff	52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Conclusion	approval_conditions	Approval Conditions	text	f	t	2	\N	\N	\N	2025-12-27 11:16:04.096224
\.


--
-- Data for Name: cam_templates; Type: TABLE DATA; Schema: finance_schema; Owner: sourcecorp_user
--

COPY finance_schema.cam_templates (id, loan_type, template_definition, created_by, created_at, template_name, sections, is_active, updated_at) FROM stdin;
9ef2e115-70d7-4acc-85c0-001fe383ec10	Personal Loan	\N	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	2025-12-26 19:32:51.029568	test 1 PL	["test sec 1", "test 2 sec 2"]	t	2026-04-12 17:23:03.2311
6ab0b572-eaed-458b-afab-a7f7297ca90c	HOME	\N	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	2025-12-27 11:11:40.266255	Standard Bank CAM Template - Home Loan	["Applicant Profile", "Loan Proposal", "Financial Details", "Property Details", "Risk Assessment", "Justification", "Conclusion"]	t	2026-04-12 17:23:03.2311
52bd2fea-d1d3-4050-bf8e-02dbbcd1cb16	Home Loan	\N	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	2025-12-27 11:16:04.032649	Standard Bank CAM Template - Home Loan	["Applicant Profile", "Loan Proposal", "Financial Details", "Property Details", "Risk Assessment", "Justification", "Conclusion"]	t	2026-04-12 17:23:03.2311
\.


--
-- Data for Name: eligibility_calculations; Type: TABLE DATA; Schema: finance_schema; Owner: sourcecorp_user
--

COPY finance_schema.eligibility_calculations (id, case_id, monthly_income, eligible_amount, requested_amount, result, rule_snapshot, calculated_by, calculated_at) FROM stdin;
\.


--
-- Data for Name: eligibility_rules; Type: TABLE DATA; Schema: finance_schema; Owner: sourcecorp_user
--

COPY finance_schema.eligibility_rules (id, loan_type, min_age, max_age, max_foir, income_multiplier, created_by, created_at) FROM stdin;
6a31dc3e-610d-4a56-a912-48216801e73f	PERSONAL	21	65	0.60	60.00	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	2025-12-24 17:51:39.760028
bcc6a575-0603-454c-8e60-9eb5a700a83e	BUSINESS	21	65	0.60	60.00	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	2025-12-25 11:16:40.583489
6213cdb4-ebc4-447d-9104-2e2903633054	HOME	21	65	0.60	60.00	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	2026-01-03 11:10:08.379885
8c498078-cacc-4369-aee2-fcec081fbab2	AUTO	21	65	0.60	60.00	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	2026-01-05 05:15:36.374487
\.


--
-- Data for Name: obligation_fields; Type: TABLE DATA; Schema: finance_schema; Owner: sourcecorp_user
--

COPY finance_schema.obligation_fields (id, template_id, field_key, label, field_type, is_mandatory, is_repeatable, order_index, default_value, validation_rules, select_options, created_at) FROM stdin;
a652ea9f-86a2-4c75-9630-fe12fd25021e	184012dd-3db8-4418-9a03-5f5a77805b85	finan insti	about fin instit	text	t	t	0	asf	\N	\N	2025-12-26 19:43:47.149437
18de5868-6cbe-4384-a5b2-40cddd431821	184012dd-3db8-4418-9a03-5f5a77805b85	kk	kkkk	text	f	t	1	\N	\N	\N	2025-12-26 19:43:47.154262
0dbcc17a-b957-4cb7-976c-46f900aaceb1	aec633ec-d51c-4473-92e7-f05ce880d6f0	obligation_type	Obligation Type	select	t	t	0	\N	\N	["Home Loan", "Personal Loan", "Car Loan", "Two Wheeler Loan", "Gold Loan", "App Loan", "Property Loan", "Consumer Durable Loan", "Credit Card", "Other Loan"]	2026-01-04 16:25:40.383966
965bc45b-63a9-4642-a864-e82164d7c2c6	aec633ec-d51c-4473-92e7-f05ce880d6f0	lender_name	Lender/Bank Name	text	t	t	1	\N	\N	\N	2026-01-04 16:25:40.386587
1d887679-bdf3-4a97-92ae-03592c89e06c	aec633ec-d51c-4473-92e7-f05ce880d6f0	loan_account_number	Loan Account Number	text	f	t	2	\N	\N	\N	2026-01-04 16:25:40.387482
50992ee4-6029-45f4-a9c6-0b25d2cfd02f	aec633ec-d51c-4473-92e7-f05ce880d6f0	sanctioned_amount	Sanctioned Amount	currency	f	t	3	\N	\N	\N	2026-01-04 16:25:40.388304
ef6f04c0-acc6-45d3-acf8-aad07b9c6373	aec633ec-d51c-4473-92e7-f05ce880d6f0	outstanding_balance	Outstanding Balance	currency	t	t	4	\N	\N	\N	2026-01-04 16:25:40.389103
f74abd08-86f1-4183-9b10-e5e2bcfc64eb	aec633ec-d51c-4473-92e7-f05ce880d6f0	monthly_emi	Monthly EMI	currency	t	t	5	\N	\N	\N	2026-01-04 16:25:40.38992
39f1592a-77c8-4372-aff5-d806be7c063b	aec633ec-d51c-4473-92e7-f05ce880d6f0	interest_rate	Interest Rate (%)	number	f	t	6	\N	\N	\N	2026-01-04 16:25:40.391842
e43b7596-2dda-46f1-8302-d2082c615f77	aec633ec-d51c-4473-92e7-f05ce880d6f0	loan_tenure_months	Loan Tenure (Months)	number	f	t	7	\N	\N	\N	2026-01-04 16:25:40.393396
40501910-9108-48d5-be13-f9503d9fa39a	aec633ec-d51c-4473-92e7-f05ce880d6f0	loan_start_date	Loan Start Date	date	f	t	8	\N	\N	\N	2026-01-04 16:25:40.394952
dc394099-b9f2-428c-9e49-9d64610f12da	aec633ec-d51c-4473-92e7-f05ce880d6f0	loan_end_date	Loan End Date	date	f	t	9	\N	\N	\N	2026-01-04 16:25:40.395755
d3cb20ad-bcba-4692-a9a3-dfb4b4613cc5	aec633ec-d51c-4473-92e7-f05ce880d6f0	remaining_tenure_months	Remaining Tenure (Months)	number	f	t	10	\N	\N	\N	2026-01-04 16:25:40.397027
85a6b333-2ec0-4d5c-b0c6-18e008392b9b	aec633ec-d51c-4473-92e7-f05ce880d6f0	remarks	Remarks	text	f	t	12	\N	\N	\N	2026-01-04 16:25:40.398154
ba5cd947-cb1a-42f1-bfa1-c0ffde3c34f1	aec633ec-d51c-4473-92e7-f05ce880d6f0	Is Oblicated	Is Oblicated	select	t	t	12	\N	\N	["Yes", "No"]	2026-01-04 16:25:40.398999
cb74cb9c-6549-4ac2-a856-b3cc08d85b5f	aec633ec-d51c-4473-92e7-f05ce880d6f0	Account Type	Account Type	select	t	t	13	\N	\N	["Individual", "Joint", "Guaranteed"]	2026-01-04 16:25:40.399771
\.


--
-- Data for Name: obligation_items; Type: TABLE DATA; Schema: finance_schema; Owner: sourcecorp_user
--

COPY finance_schema.obligation_items (id, obligation_sheet_id, description, monthly_emi, created_at, item_data, order_index) FROM stdin;
\.


--
-- Data for Name: obligation_sheets; Type: TABLE DATA; Schema: finance_schema; Owner: sourcecorp_user
--

COPY finance_schema.obligation_sheets (id, case_id, total_obligation, net_income, created_by, created_at, updated_at, template_id, template_snapshot) FROM stdin;
\.


--
-- Data for Name: obligation_templates; Type: TABLE DATA; Schema: finance_schema; Owner: sourcecorp_user
--

COPY finance_schema.obligation_templates (id, template_name, sections, is_active, created_by, created_at, updated_at) FROM stdin;
184012dd-3db8-4418-9a03-5f5a77805b85	stand oblicat temp	["sec 1", "sec2"]	t	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	2025-12-26 19:43:47.145657	2026-04-12 17:23:03.2311
aec633ec-d51c-4473-92e7-f05ce880d6f0	Standard Bank Obligation Template	["Obligation Details"]	t	03f01fc0-a1b3-4224-8c0b-11eee9ad3ce8	2025-12-27 10:09:07.726407	2026-04-12 17:23:03.2311
\.


--
-- Data for Name: notes; Type: TABLE DATA; Schema: note_schema; Owner: sourcecorp_user
--

COPY note_schema.notes (id, content, created_by, linked_case_id, visibility, created_at) FROM stdin;
\.


--
-- Data for Name: task_comments; Type: TABLE DATA; Schema: task_schema; Owner: sourcecorp_user
--

COPY task_schema.task_comments (id, task_id, comment, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: task_schema; Owner: sourcecorp_user
--

COPY task_schema.tasks (id, title, description, assigned_to, assigned_by, direction, status, due_date, created_at, updated_at, linked_case_id, task_type, priority) FROM stdin;
\.


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: admin_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY admin_schema.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: audit_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY audit_schema.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.team_members
    ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: user_hierarchy user_hierarchy_pkey; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.user_hierarchy
    ADD CONSTRAINT user_hierarchy_pkey PRIMARY KEY (id);


--
-- Name: user_hierarchy user_hierarchy_subordinate_id_key; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.user_hierarchy
    ADD CONSTRAINT user_hierarchy_subordinate_id_key UNIQUE (subordinate_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_key; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: channel_creation_requests channel_creation_requests_pkey; Type: CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.channel_creation_requests
    ADD CONSTRAINT channel_creation_requests_pkey PRIMARY KEY (id);


--
-- Name: channel_members channel_members_channel_id_user_id_key; Type: CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.channel_members
    ADD CONSTRAINT channel_members_channel_id_user_id_key UNIQUE (channel_id, user_id);


--
-- Name: channel_members channel_members_pkey; Type: CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.channel_members
    ADD CONSTRAINT channel_members_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: case_assignments case_assignments_pkey; Type: CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_assignments
    ADD CONSTRAINT case_assignments_pkey PRIMARY KEY (id);


--
-- Name: case_notes case_notes_pkey; Type: CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_notes
    ADD CONSTRAINT case_notes_pkey PRIMARY KEY (id);


--
-- Name: case_notifications case_notifications_pkey; Type: CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_notifications
    ADD CONSTRAINT case_notifications_pkey PRIMARY KEY (id);


--
-- Name: case_status_history case_status_history_pkey; Type: CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_status_history
    ADD CONSTRAINT case_status_history_pkey PRIMARY KEY (id);


--
-- Name: cases cases_case_number_key; Type: CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.cases
    ADD CONSTRAINT cases_case_number_key UNIQUE (case_number);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: customer_detail_change_requests customer_detail_change_requests_pkey; Type: CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.customer_detail_change_requests
    ADD CONSTRAINT customer_detail_change_requests_pkey PRIMARY KEY (id);


--
-- Name: customer_detail_sheets customer_detail_sheets_pkey; Type: CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.customer_detail_sheets
    ADD CONSTRAINT customer_detail_sheets_pkey PRIMARY KEY (id);


--
-- Name: customer_detail_template customer_detail_template_field_key_key; Type: CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.customer_detail_template
    ADD CONSTRAINT customer_detail_template_field_key_key UNIQUE (field_key);


--
-- Name: customer_detail_template customer_detail_template_pkey; Type: CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.customer_detail_template
    ADD CONSTRAINT customer_detail_template_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: cam_entries cam_entries_pkey; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.cam_entries
    ADD CONSTRAINT cam_entries_pkey PRIMARY KEY (id);


--
-- Name: cam_fields cam_fields_pkey; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.cam_fields
    ADD CONSTRAINT cam_fields_pkey PRIMARY KEY (id);


--
-- Name: cam_fields cam_fields_template_id_section_name_field_key_key; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.cam_fields
    ADD CONSTRAINT cam_fields_template_id_section_name_field_key_key UNIQUE (template_id, section_name, field_key);


--
-- Name: cam_templates cam_templates_pkey; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.cam_templates
    ADD CONSTRAINT cam_templates_pkey PRIMARY KEY (id);


--
-- Name: eligibility_calculations eligibility_calculations_pkey; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.eligibility_calculations
    ADD CONSTRAINT eligibility_calculations_pkey PRIMARY KEY (id);


--
-- Name: eligibility_rules eligibility_rules_pkey; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.eligibility_rules
    ADD CONSTRAINT eligibility_rules_pkey PRIMARY KEY (id);


--
-- Name: obligation_fields obligation_fields_pkey; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_fields
    ADD CONSTRAINT obligation_fields_pkey PRIMARY KEY (id);


--
-- Name: obligation_fields obligation_fields_template_id_field_key_key; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_fields
    ADD CONSTRAINT obligation_fields_template_id_field_key_key UNIQUE (template_id, field_key);


--
-- Name: obligation_items obligation_items_pkey; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_items
    ADD CONSTRAINT obligation_items_pkey PRIMARY KEY (id);


--
-- Name: obligation_sheets obligation_sheets_pkey; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_sheets
    ADD CONSTRAINT obligation_sheets_pkey PRIMARY KEY (id);


--
-- Name: obligation_templates obligation_templates_pkey; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_templates
    ADD CONSTRAINT obligation_templates_pkey PRIMARY KEY (id);


--
-- Name: obligation_templates obligation_templates_template_name_key; Type: CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_templates
    ADD CONSTRAINT obligation_templates_template_name_key UNIQUE (template_name);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: note_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY note_schema.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: task_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY task_schema.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: task_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY task_schema.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: idx_announcements_active; Type: INDEX; Schema: admin_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_announcements_active ON admin_schema.announcements USING btree (is_active);


--
-- Name: idx_announcements_category; Type: INDEX; Schema: admin_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_announcements_category ON admin_schema.announcements USING btree (category);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: audit_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_audit_logs_action ON audit_schema.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: audit_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_audit_logs_created_at ON audit_schema.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: audit_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_audit_logs_user_id ON audit_schema.audit_logs USING btree (user_id);


--
-- Name: idx_role_permissions_permission_id; Type: INDEX; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_role_permissions_permission_id ON auth_schema.role_permissions USING btree (permission_id);


--
-- Name: idx_role_permissions_role_id; Type: INDEX; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_role_permissions_role_id ON auth_schema.role_permissions USING btree (role_id);


--
-- Name: idx_team_members_team_id; Type: INDEX; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_team_members_team_id ON auth_schema.team_members USING btree (team_id);


--
-- Name: idx_team_members_user_id; Type: INDEX; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_team_members_user_id ON auth_schema.team_members USING btree (user_id);


--
-- Name: idx_user_hierarchy_manager_id; Type: INDEX; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_user_hierarchy_manager_id ON auth_schema.user_hierarchy USING btree (manager_id);


--
-- Name: idx_user_hierarchy_subordinate_id; Type: INDEX; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_user_hierarchy_subordinate_id ON auth_schema.user_hierarchy USING btree (subordinate_id);


--
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_user_roles_role_id ON auth_schema.user_roles USING btree (role_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_user_roles_user_id ON auth_schema.user_roles USING btree (user_id);


--
-- Name: idx_users_active; Type: INDEX; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_users_active ON auth_schema.users USING btree (is_active);


--
-- Name: idx_users_email; Type: INDEX; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_users_email ON auth_schema.users USING btree (email);


--
-- Name: idx_attachments_message_id; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_attachments_message_id ON chat_schema.attachments USING btree (message_id);


--
-- Name: idx_channel_members_channel_id; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_channel_members_channel_id ON chat_schema.channel_members USING btree (channel_id);


--
-- Name: idx_channel_members_user_id; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_channel_members_user_id ON chat_schema.channel_members USING btree (user_id);


--
-- Name: idx_channel_requests_requested_by; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_channel_requests_requested_by ON chat_schema.channel_creation_requests USING btree (requested_by);


--
-- Name: idx_channel_requests_reviewed_by; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_channel_requests_reviewed_by ON chat_schema.channel_creation_requests USING btree (reviewed_by);


--
-- Name: idx_channel_requests_status; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_channel_requests_status ON chat_schema.channel_creation_requests USING btree (status);


--
-- Name: idx_channels_created_by; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_channels_created_by ON chat_schema.channels USING btree (created_by);


--
-- Name: idx_channels_status; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_channels_status ON chat_schema.channels USING btree (status);


--
-- Name: idx_channels_type; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_channels_type ON chat_schema.channels USING btree (type);


--
-- Name: idx_messages_channel_id; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_messages_channel_id ON chat_schema.messages USING btree (channel_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_messages_created_at ON chat_schema.messages USING btree (created_at);


--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: chat_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_messages_sender_id ON chat_schema.messages USING btree (sender_id);


--
-- Name: idx_case_assignments_assigned_to; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_assignments_assigned_to ON crm_schema.case_assignments USING btree (assigned_to);


--
-- Name: idx_case_assignments_case_id; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_assignments_case_id ON crm_schema.case_assignments USING btree (case_id);


--
-- Name: idx_case_notes_case_id; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_notes_case_id ON crm_schema.case_notes USING btree (case_id);


--
-- Name: idx_case_notes_document_id; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_notes_document_id ON crm_schema.case_notes USING btree (document_id);


--
-- Name: idx_case_notifications_case_id; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_notifications_case_id ON crm_schema.case_notifications USING btree (case_id);


--
-- Name: idx_case_notifications_change_request_id; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_notifications_change_request_id ON crm_schema.case_notifications USING btree (change_request_id);


--
-- Name: idx_case_notifications_completion_status; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_notifications_completion_status ON crm_schema.case_notifications USING btree (completion_status);


--
-- Name: idx_case_notifications_document_id; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_notifications_document_id ON crm_schema.case_notifications USING btree (document_id);


--
-- Name: idx_case_notifications_is_read; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_notifications_is_read ON crm_schema.case_notifications USING btree (is_read);


--
-- Name: idx_case_notifications_scheduled_at; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_notifications_scheduled_at ON crm_schema.case_notifications USING btree (scheduled_at);


--
-- Name: idx_case_notifications_scheduled_by; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_notifications_scheduled_by ON crm_schema.case_notifications USING btree (scheduled_by);


--
-- Name: idx_case_notifications_scheduled_for; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_notifications_scheduled_for ON crm_schema.case_notifications USING btree (scheduled_for);


--
-- Name: idx_case_notifications_status; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_notifications_status ON crm_schema.case_notifications USING btree (status);


--
-- Name: idx_case_status_history_case_id; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_status_history_case_id ON crm_schema.case_status_history USING btree (case_id);


--
-- Name: idx_case_status_history_changed_at; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_case_status_history_changed_at ON crm_schema.case_status_history USING btree (changed_at);


--
-- Name: idx_cases_case_number; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_cases_case_number ON crm_schema.cases USING btree (case_number);


--
-- Name: idx_cases_created_at; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_cases_created_at ON crm_schema.cases USING btree (created_at);


--
-- Name: idx_cases_created_by; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_cases_created_by ON crm_schema.cases USING btree (created_by);


--
-- Name: idx_cases_current_status; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_cases_current_status ON crm_schema.cases USING btree (current_status);


--
-- Name: idx_customer_detail_change_requests_case_id; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_customer_detail_change_requests_case_id ON crm_schema.customer_detail_change_requests USING btree (case_id);


--
-- Name: idx_customer_detail_change_requests_requested_by; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_customer_detail_change_requests_requested_by ON crm_schema.customer_detail_change_requests USING btree (requested_by);


--
-- Name: idx_customer_detail_change_requests_requested_for; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_customer_detail_change_requests_requested_for ON crm_schema.customer_detail_change_requests USING btree (requested_for);


--
-- Name: idx_customer_detail_change_requests_status; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_customer_detail_change_requests_status ON crm_schema.customer_detail_change_requests USING btree (status);


--
-- Name: idx_customer_detail_sheets_case_id; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_customer_detail_sheets_case_id ON crm_schema.customer_detail_sheets USING btree (case_id);


--
-- Name: idx_customer_detail_template_field_key; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_customer_detail_template_field_key ON crm_schema.customer_detail_template USING btree (field_key);


--
-- Name: idx_documents_case_id; Type: INDEX; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_documents_case_id ON crm_schema.documents USING btree (case_id);


--
-- Name: idx_cam_entries_case_id; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_cam_entries_case_id ON finance_schema.cam_entries USING btree (case_id);


--
-- Name: idx_cam_entries_template_id; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_cam_entries_template_id ON finance_schema.cam_entries USING btree (template_id);


--
-- Name: idx_cam_entries_version; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_cam_entries_version ON finance_schema.cam_entries USING btree (case_id, version);


--
-- Name: idx_cam_fields_section; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_cam_fields_section ON finance_schema.cam_fields USING btree (template_id, section_name);


--
-- Name: idx_cam_fields_template_id; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_cam_fields_template_id ON finance_schema.cam_fields USING btree (template_id);


--
-- Name: idx_cam_templates_active; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_cam_templates_active ON finance_schema.cam_templates USING btree (is_active);


--
-- Name: idx_cam_templates_loan_type; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_cam_templates_loan_type ON finance_schema.cam_templates USING btree (loan_type);


--
-- Name: idx_eligibility_calculations_calculated_at; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_eligibility_calculations_calculated_at ON finance_schema.eligibility_calculations USING btree (calculated_at);


--
-- Name: idx_eligibility_calculations_case_id; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_eligibility_calculations_case_id ON finance_schema.eligibility_calculations USING btree (case_id);


--
-- Name: idx_eligibility_rules_loan_type; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_eligibility_rules_loan_type ON finance_schema.eligibility_rules USING btree (loan_type);


--
-- Name: idx_obligation_fields_template_id; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_obligation_fields_template_id ON finance_schema.obligation_fields USING btree (template_id);


--
-- Name: idx_obligation_items_sheet_id; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_obligation_items_sheet_id ON finance_schema.obligation_items USING btree (obligation_sheet_id);


--
-- Name: idx_obligation_sheets_case_id; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_obligation_sheets_case_id ON finance_schema.obligation_sheets USING btree (case_id);


--
-- Name: idx_obligation_sheets_template_id; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_obligation_sheets_template_id ON finance_schema.obligation_sheets USING btree (template_id);


--
-- Name: idx_obligation_templates_active; Type: INDEX; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_obligation_templates_active ON finance_schema.obligation_templates USING btree (is_active);


--
-- Name: idx_notes_created_at; Type: INDEX; Schema: note_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_notes_created_at ON note_schema.notes USING btree (created_at);


--
-- Name: idx_notes_created_by; Type: INDEX; Schema: note_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_notes_created_by ON note_schema.notes USING btree (created_by);


--
-- Name: idx_notes_linked_case_id; Type: INDEX; Schema: note_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_notes_linked_case_id ON note_schema.notes USING btree (linked_case_id);


--
-- Name: idx_notes_visibility; Type: INDEX; Schema: note_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_notes_visibility ON note_schema.notes USING btree (visibility);


--
-- Name: idx_task_comments_created_at; Type: INDEX; Schema: task_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_task_comments_created_at ON task_schema.task_comments USING btree (created_at);


--
-- Name: idx_task_comments_created_by; Type: INDEX; Schema: task_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_task_comments_created_by ON task_schema.task_comments USING btree (created_by);


--
-- Name: idx_task_comments_task_id; Type: INDEX; Schema: task_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_task_comments_task_id ON task_schema.task_comments USING btree (task_id);


--
-- Name: idx_tasks_assigned_by; Type: INDEX; Schema: task_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_tasks_assigned_by ON task_schema.tasks USING btree (assigned_by);


--
-- Name: idx_tasks_assigned_to; Type: INDEX; Schema: task_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_tasks_assigned_to ON task_schema.tasks USING btree (assigned_to);


--
-- Name: idx_tasks_created_at; Type: INDEX; Schema: task_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_tasks_created_at ON task_schema.tasks USING btree (created_at);


--
-- Name: idx_tasks_direction; Type: INDEX; Schema: task_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_tasks_direction ON task_schema.tasks USING btree (direction);


--
-- Name: idx_tasks_linked_case_id; Type: INDEX; Schema: task_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_tasks_linked_case_id ON task_schema.tasks USING btree (linked_case_id);


--
-- Name: idx_tasks_priority; Type: INDEX; Schema: task_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_tasks_priority ON task_schema.tasks USING btree (priority);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: task_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_tasks_status ON task_schema.tasks USING btree (status);


--
-- Name: idx_tasks_task_type; Type: INDEX; Schema: task_schema; Owner: sourcecorp_user
--

CREATE INDEX idx_tasks_task_type ON task_schema.tasks USING btree (task_type);


--
-- Name: user_hierarchy trigger_check_hierarchy_cycle; Type: TRIGGER; Schema: auth_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_check_hierarchy_cycle BEFORE INSERT OR UPDATE ON auth_schema.user_hierarchy FOR EACH ROW EXECUTE FUNCTION auth_schema.check_hierarchy_cycle();


--
-- Name: cases trigger_set_case_number; Type: TRIGGER; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_set_case_number BEFORE INSERT ON crm_schema.cases FOR EACH ROW EXECUTE FUNCTION crm_schema.set_case_number();


--
-- Name: case_notifications trigger_update_case_notifications_updated_at; Type: TRIGGER; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_update_case_notifications_updated_at BEFORE UPDATE ON crm_schema.case_notifications FOR EACH ROW EXECUTE FUNCTION crm_schema.update_updated_at_column();


--
-- Name: cases trigger_update_cases_updated_at; Type: TRIGGER; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_update_cases_updated_at BEFORE UPDATE ON crm_schema.cases FOR EACH ROW EXECUTE FUNCTION crm_schema.update_updated_at_column();


--
-- Name: customer_detail_change_requests trigger_update_customer_detail_change_requests_updated_at; Type: TRIGGER; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_update_customer_detail_change_requests_updated_at BEFORE UPDATE ON crm_schema.customer_detail_change_requests FOR EACH ROW EXECUTE FUNCTION crm_schema.update_updated_at_column();


--
-- Name: customer_detail_sheets trigger_update_customer_detail_sheets_updated_at; Type: TRIGGER; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_update_customer_detail_sheets_updated_at BEFORE UPDATE ON crm_schema.customer_detail_sheets FOR EACH ROW EXECUTE FUNCTION crm_schema.update_updated_at_column();


--
-- Name: customer_detail_template trigger_update_customer_detail_template_updated_at; Type: TRIGGER; Schema: crm_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_update_customer_detail_template_updated_at BEFORE UPDATE ON crm_schema.customer_detail_template FOR EACH ROW EXECUTE FUNCTION crm_schema.update_updated_at_column();


--
-- Name: cam_templates trigger_update_cam_templates_updated_at; Type: TRIGGER; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_update_cam_templates_updated_at BEFORE UPDATE ON finance_schema.cam_templates FOR EACH ROW EXECUTE FUNCTION crm_schema.update_updated_at_column();


--
-- Name: obligation_sheets trigger_update_obligation_sheets_updated_at; Type: TRIGGER; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_update_obligation_sheets_updated_at BEFORE UPDATE ON finance_schema.obligation_sheets FOR EACH ROW EXECUTE FUNCTION crm_schema.update_updated_at_column();


--
-- Name: obligation_templates trigger_update_obligation_templates_updated_at; Type: TRIGGER; Schema: finance_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_update_obligation_templates_updated_at BEFORE UPDATE ON finance_schema.obligation_templates FOR EACH ROW EXECUTE FUNCTION crm_schema.update_updated_at_column();


--
-- Name: tasks trigger_update_tasks_updated_at; Type: TRIGGER; Schema: task_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_update_tasks_updated_at BEFORE UPDATE ON task_schema.tasks FOR EACH ROW EXECUTE FUNCTION crm_schema.update_updated_at_column();


--
-- Name: tasks trigger_validate_task_assignment; Type: TRIGGER; Schema: task_schema; Owner: sourcecorp_user
--

CREATE TRIGGER trigger_validate_task_assignment BEFORE INSERT OR UPDATE ON task_schema.tasks FOR EACH ROW EXECUTE FUNCTION task_schema.validate_task_assignment();


--
-- Name: announcements announcements_author_id_fkey; Type: FK CONSTRAINT; Schema: admin_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY admin_schema.announcements
    ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth_schema.users(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: audit_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY audit_schema.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth_schema.users(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES auth_schema.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES auth_schema.roles(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES auth_schema.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth_schema.users(id) ON DELETE CASCADE;


--
-- Name: user_hierarchy user_hierarchy_manager_id_fkey; Type: FK CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.user_hierarchy
    ADD CONSTRAINT user_hierarchy_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES auth_schema.users(id) ON DELETE CASCADE;


--
-- Name: user_hierarchy user_hierarchy_subordinate_id_fkey; Type: FK CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.user_hierarchy
    ADD CONSTRAINT user_hierarchy_subordinate_id_fkey FOREIGN KEY (subordinate_id) REFERENCES auth_schema.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES auth_schema.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: auth_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY auth_schema.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth_schema.users(id) ON DELETE CASCADE;


--
-- Name: attachments attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.attachments
    ADD CONSTRAINT attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES chat_schema.messages(id) ON DELETE CASCADE;


--
-- Name: attachments attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.attachments
    ADD CONSTRAINT attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth_schema.users(id);


--
-- Name: channel_creation_requests channel_creation_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.channel_creation_requests
    ADD CONSTRAINT channel_creation_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth_schema.users(id);


--
-- Name: channel_creation_requests channel_creation_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.channel_creation_requests
    ADD CONSTRAINT channel_creation_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth_schema.users(id);


--
-- Name: channel_creation_requests channel_creation_requests_target_role_id_fkey; Type: FK CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.channel_creation_requests
    ADD CONSTRAINT channel_creation_requests_target_role_id_fkey FOREIGN KEY (target_role_id) REFERENCES auth_schema.roles(id);


--
-- Name: channel_creation_requests channel_creation_requests_target_team_id_fkey; Type: FK CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.channel_creation_requests
    ADD CONSTRAINT channel_creation_requests_target_team_id_fkey FOREIGN KEY (target_team_id) REFERENCES auth_schema.teams(id);


--
-- Name: channel_members channel_members_channel_id_fkey; Type: FK CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.channel_members
    ADD CONSTRAINT channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chat_schema.channels(id) ON DELETE CASCADE;


--
-- Name: channel_members channel_members_user_id_fkey; Type: FK CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.channel_members
    ADD CONSTRAINT channel_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth_schema.users(id) ON DELETE CASCADE;


--
-- Name: channels channels_created_by_fkey; Type: FK CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.channels
    ADD CONSTRAINT channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth_schema.users(id);


--
-- Name: messages messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.messages
    ADD CONSTRAINT messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chat_schema.channels(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: chat_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY chat_schema.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth_schema.users(id);


--
-- Name: case_assignments case_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_assignments
    ADD CONSTRAINT case_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth_schema.users(id);


--
-- Name: case_assignments case_assignments_assigned_to_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_assignments
    ADD CONSTRAINT case_assignments_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth_schema.users(id);


--
-- Name: case_assignments case_assignments_case_id_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_assignments
    ADD CONSTRAINT case_assignments_case_id_fkey FOREIGN KEY (case_id) REFERENCES crm_schema.cases(id) ON DELETE CASCADE;


--
-- Name: case_notes case_notes_case_id_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_notes
    ADD CONSTRAINT case_notes_case_id_fkey FOREIGN KEY (case_id) REFERENCES crm_schema.cases(id) ON DELETE CASCADE;


--
-- Name: case_notes case_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_notes
    ADD CONSTRAINT case_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth_schema.users(id);


--
-- Name: case_notes case_notes_document_id_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_notes
    ADD CONSTRAINT case_notes_document_id_fkey FOREIGN KEY (document_id) REFERENCES crm_schema.documents(id) ON DELETE SET NULL;


--
-- Name: case_notifications case_notifications_case_id_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_notifications
    ADD CONSTRAINT case_notifications_case_id_fkey FOREIGN KEY (case_id) REFERENCES crm_schema.cases(id) ON DELETE CASCADE;


--
-- Name: case_notifications case_notifications_change_request_id_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_notifications
    ADD CONSTRAINT case_notifications_change_request_id_fkey FOREIGN KEY (change_request_id) REFERENCES crm_schema.customer_detail_change_requests(id) ON DELETE CASCADE;


--
-- Name: case_notifications case_notifications_document_id_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_notifications
    ADD CONSTRAINT case_notifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES crm_schema.documents(id) ON DELETE SET NULL;


--
-- Name: case_notifications case_notifications_scheduled_by_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_notifications
    ADD CONSTRAINT case_notifications_scheduled_by_fkey FOREIGN KEY (scheduled_by) REFERENCES auth_schema.users(id);


--
-- Name: case_notifications case_notifications_scheduled_for_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_notifications
    ADD CONSTRAINT case_notifications_scheduled_for_fkey FOREIGN KEY (scheduled_for) REFERENCES auth_schema.users(id);


--
-- Name: case_status_history case_status_history_case_id_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_status_history
    ADD CONSTRAINT case_status_history_case_id_fkey FOREIGN KEY (case_id) REFERENCES crm_schema.cases(id) ON DELETE CASCADE;


--
-- Name: case_status_history case_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.case_status_history
    ADD CONSTRAINT case_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth_schema.users(id);


--
-- Name: cases cases_created_by_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.cases
    ADD CONSTRAINT cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth_schema.users(id);


--
-- Name: customer_detail_change_requests customer_detail_change_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.customer_detail_change_requests
    ADD CONSTRAINT customer_detail_change_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth_schema.users(id);


--
-- Name: customer_detail_change_requests customer_detail_change_requests_case_id_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.customer_detail_change_requests
    ADD CONSTRAINT customer_detail_change_requests_case_id_fkey FOREIGN KEY (case_id) REFERENCES crm_schema.cases(id) ON DELETE CASCADE;


--
-- Name: customer_detail_change_requests customer_detail_change_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.customer_detail_change_requests
    ADD CONSTRAINT customer_detail_change_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth_schema.users(id);


--
-- Name: customer_detail_change_requests customer_detail_change_requests_requested_for_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.customer_detail_change_requests
    ADD CONSTRAINT customer_detail_change_requests_requested_for_fkey FOREIGN KEY (requested_for) REFERENCES auth_schema.users(id);


--
-- Name: customer_detail_sheets customer_detail_sheets_case_id_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.customer_detail_sheets
    ADD CONSTRAINT customer_detail_sheets_case_id_fkey FOREIGN KEY (case_id) REFERENCES crm_schema.cases(id) ON DELETE CASCADE;


--
-- Name: customer_detail_sheets customer_detail_sheets_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.customer_detail_sheets
    ADD CONSTRAINT customer_detail_sheets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth_schema.users(id);


--
-- Name: documents documents_case_id_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.documents
    ADD CONSTRAINT documents_case_id_fkey FOREIGN KEY (case_id) REFERENCES crm_schema.cases(id) ON DELETE CASCADE;


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: crm_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY crm_schema.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth_schema.users(id);


--
-- Name: cam_entries cam_entries_case_id_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.cam_entries
    ADD CONSTRAINT cam_entries_case_id_fkey FOREIGN KEY (case_id) REFERENCES crm_schema.cases(id) ON DELETE CASCADE;


--
-- Name: cam_entries cam_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.cam_entries
    ADD CONSTRAINT cam_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth_schema.users(id);


--
-- Name: cam_entries cam_entries_template_id_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.cam_entries
    ADD CONSTRAINT cam_entries_template_id_fkey FOREIGN KEY (template_id) REFERENCES finance_schema.cam_templates(id);


--
-- Name: cam_fields cam_fields_template_id_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.cam_fields
    ADD CONSTRAINT cam_fields_template_id_fkey FOREIGN KEY (template_id) REFERENCES finance_schema.cam_templates(id) ON DELETE CASCADE;


--
-- Name: cam_templates cam_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.cam_templates
    ADD CONSTRAINT cam_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth_schema.users(id);


--
-- Name: eligibility_calculations eligibility_calculations_calculated_by_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.eligibility_calculations
    ADD CONSTRAINT eligibility_calculations_calculated_by_fkey FOREIGN KEY (calculated_by) REFERENCES auth_schema.users(id);


--
-- Name: eligibility_calculations eligibility_calculations_case_id_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.eligibility_calculations
    ADD CONSTRAINT eligibility_calculations_case_id_fkey FOREIGN KEY (case_id) REFERENCES crm_schema.cases(id) ON DELETE CASCADE;


--
-- Name: eligibility_rules eligibility_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.eligibility_rules
    ADD CONSTRAINT eligibility_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth_schema.users(id);


--
-- Name: obligation_fields obligation_fields_template_id_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_fields
    ADD CONSTRAINT obligation_fields_template_id_fkey FOREIGN KEY (template_id) REFERENCES finance_schema.obligation_templates(id) ON DELETE CASCADE;


--
-- Name: obligation_items obligation_items_obligation_sheet_id_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_items
    ADD CONSTRAINT obligation_items_obligation_sheet_id_fkey FOREIGN KEY (obligation_sheet_id) REFERENCES finance_schema.obligation_sheets(id) ON DELETE CASCADE;


--
-- Name: obligation_sheets obligation_sheets_case_id_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_sheets
    ADD CONSTRAINT obligation_sheets_case_id_fkey FOREIGN KEY (case_id) REFERENCES crm_schema.cases(id) ON DELETE CASCADE;


--
-- Name: obligation_sheets obligation_sheets_created_by_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_sheets
    ADD CONSTRAINT obligation_sheets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth_schema.users(id);


--
-- Name: obligation_sheets obligation_sheets_template_id_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_sheets
    ADD CONSTRAINT obligation_sheets_template_id_fkey FOREIGN KEY (template_id) REFERENCES finance_schema.obligation_templates(id);


--
-- Name: obligation_templates obligation_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: finance_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY finance_schema.obligation_templates
    ADD CONSTRAINT obligation_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth_schema.users(id);


--
-- Name: notes notes_created_by_fkey; Type: FK CONSTRAINT; Schema: note_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY note_schema.notes
    ADD CONSTRAINT notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth_schema.users(id) ON DELETE CASCADE;


--
-- Name: notes notes_linked_case_id_fkey; Type: FK CONSTRAINT; Schema: note_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY note_schema.notes
    ADD CONSTRAINT notes_linked_case_id_fkey FOREIGN KEY (linked_case_id) REFERENCES crm_schema.cases(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_created_by_fkey; Type: FK CONSTRAINT; Schema: task_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY task_schema.task_comments
    ADD CONSTRAINT task_comments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth_schema.users(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: task_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY task_schema.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES task_schema.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assigned_by_fkey; Type: FK CONSTRAINT; Schema: task_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY task_schema.tasks
    ADD CONSTRAINT tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth_schema.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: task_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY task_schema.tasks
    ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth_schema.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_linked_case_id_fkey; Type: FK CONSTRAINT; Schema: task_schema; Owner: sourcecorp_user
--

ALTER TABLE ONLY task_schema.tasks
    ADD CONSTRAINT tasks_linked_case_id_fkey FOREIGN KEY (linked_case_id) REFERENCES crm_schema.cases(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict zvpioV1WwEA99ezWjaYnc93jIUcE9DCBDGA9SigS1zsQBeCi2XTFfikWcAsDLlc

