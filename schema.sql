-- Esquema completo de la base balanzaglobal (sin datos).
-- Generado con: pg_dump --schema-only --no-owner --no-privileges
-- Instalación nueva: createdb balanzaglobal && psql -v ON_ERROR_STOP=1 -d balanzaglobal -f schema.sql
-- Regenerar después de cada migración para que quede al día.

--
-- PostgreSQL database dump
--

\restrict WBzdTBZVYZ2RLUWaamn9iuZbCJOLxqDRfSVI8XsGZ4dQGbIarPyHnj0XmDqpvbs

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

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

--
-- Name: estado_ticket_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_ticket_enum AS ENUM (
    'ABIERTO',
    'CERRADO',
    'ANULADO'
);


--
-- Name: marca_dispositivo_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.marca_dispositivo_enum AS ENUM (
    'hikvision',
    'dahua'
);


--
-- Name: rol_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rol_enum AS ENUM (
    'admin',
    'subalancero',
    'gerente',
    'balancero',
    'logistica',
    'superadmin'
);


--
-- Name: tipo_dispositivo_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_dispositivo_enum AS ENUM (
    'grabadora',
    'balanza'
);


--
-- Name: tipo_documento_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_documento_enum AS ENUM (
    'DNI',
    'PASAPORTE',
    'OTRO'
);


--
-- Name: tipo_pesada_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_pesada_enum AS ENUM (
    'BRUTO',
    'TARA'
);


--
-- Name: tipo_vehiculo_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_vehiculo_enum AS ENUM (
    'CHASIS',
    'SEMI_REMOLQUE',
    'FURGON',
    'CAMION_TANQUE',
    'CHASIS_ACOPLADO',
    'JAULA_DOBLE',
    'BATEA',
    'OTRO'
);


--
-- Name: calcular_neto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calcular_neto() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    peso_bruto NUMERIC(12,2);
    peso_tara  NUMERIC(12,2);
BEGIN
    SELECT peso INTO peso_bruto
    FROM pesada
    WHERE operacion_id = NEW.operacion_id
      AND tipo = 'BRUTO'
    LIMIT 1;

    SELECT peso INTO peso_tara
    FROM pesada
    WHERE operacion_id = NEW.operacion_id
      AND tipo = 'TARA'
    LIMIT 1;

    IF peso_bruto IS NOT NULL AND peso_tara IS NOT NULL THEN
        UPDATE pesada
        SET neto = peso_bruto - peso_tara
        WHERE operacion_id = NEW.operacion_id;

        UPDATE operacion_pesaje
        SET abierta = FALSE
        WHERE id = NEW.operacion_id;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: usuario_localidad_empresa_chk(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.usuario_localidad_empresa_chk() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.localidad_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM localidad l
        WHERE l.id = NEW.localidad_id AND l.empresa_id = NEW.empresa_id
    ) THEN
        RAISE EXCEPTION 'La localidad % no pertenece a la empresa %', NEW.localidad_id, NEW.empresa_id;
    END IF;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chofer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chofer (
    id integer NOT NULL,
    codigo character varying(50),
    apellido_nombre character varying(150) NOT NULL,
    tipo_documento public.tipo_documento_enum,
    nro_documento character varying(30),
    nacionalidad character varying(50),
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cuit character varying(20),
    localidad_id integer NOT NULL
);


--
-- Name: chofer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chofer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chofer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chofer_id_seq OWNED BY public.chofer.id;


--
-- Name: configuracion_dispositivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion_dispositivos (
    id integer NOT NULL,
    tipo_dispositivo public.tipo_dispositivo_enum NOT NULL,
    ip character varying(15) NOT NULL,
    puerto integer,
    usuario character varying(100),
    "contraseña" character varying(255),
    activo boolean DEFAULT true,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    marca public.marca_dispositivo_enum,
    localidad_id integer NOT NULL,
    modo_conexion character varying(10) DEFAULT 'directo'::character varying NOT NULL,
    agente_token_hash text,
    agente_ultima_conexion timestamp with time zone,
    agente_info jsonb,
    canales integer[],
    CONSTRAINT chk_marca_grabador CHECK ((((tipo_dispositivo = 'grabadora'::public.tipo_dispositivo_enum) AND (marca IS NOT NULL)) OR ((tipo_dispositivo <> 'grabadora'::public.tipo_dispositivo_enum) AND (marca IS NULL)))),
    CONSTRAINT configuracion_dispositivos_modo_conexion_chk CHECK (((modo_conexion)::text = ANY ((ARRAY['directo'::character varying, 'agente'::character varying])::text[])))
);


--
-- Name: configuracion_dispositivos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.configuracion_dispositivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracion_dispositivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.configuracion_dispositivos_id_seq OWNED BY public.configuracion_dispositivos.id;


--
-- Name: empresa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    cuit character varying(20),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: empresa_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_config (
    empresa_id integer NOT NULL,
    nombre_fantasia character varying(150),
    logo_url text,
    color_primario character varying(20),
    modulos jsonb DEFAULT '{}'::jsonb NOT NULL,
    parametros jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: empresa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_id_seq OWNED BY public.empresa.id;


--
-- Name: localidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.localidad (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    provincia_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    empresa_id integer NOT NULL
);


--
-- Name: localidad_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.localidad_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: localidad_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.localidad_id_seq OWNED BY public.localidad.id;


--
-- Name: operacion_pesaje; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operacion_pesaje (
    id integer NOT NULL,
    vehiculo_patente character varying(15) NOT NULL,
    abierta boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sentido character varying(10) DEFAULT 'INGRESO'::character varying NOT NULL,
    localidad_id integer NOT NULL,
    CONSTRAINT chk_sentido CHECK (((sentido)::text = ANY (ARRAY[('INGRESO'::character varying)::text, ('SALIDA'::character varying)::text])))
);


--
-- Name: operacion_pesaje_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operacion_pesaje_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operacion_pesaje_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operacion_pesaje_id_seq OWNED BY public.operacion_pesaje.id;


--
-- Name: pesada; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pesada (
    id integer NOT NULL,
    operacion_id integer NOT NULL,
    tipo public.tipo_pesada_enum NOT NULL,
    peso numeric(12,2) NOT NULL,
    chofer_id integer NOT NULL,
    productor_id integer NOT NULL,
    neto numeric(12,2),
    transporte_id integer NOT NULL,
    producto_id integer NOT NULL,
    vehiculo_patente character varying(15) NOT NULL,
    fecha_hora timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    balancero text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    nro_remito text,
    ruta character varying(255),
    fotos jsonb,
    peso_vgm integer,
    es_contenedor boolean DEFAULT false,
    nro_contenedor character varying(50),
    tara_contenedor numeric(12,2),
    cantidad_bultos integer,
    nro_proforma character varying(100),
    nro_permiso_embarque character varying(100),
    dispositivo_id integer NOT NULL,
    CONSTRAINT check_contenedor_fields CHECK (((es_contenedor = false) OR (nro_contenedor IS NOT NULL))),
    CONSTRAINT chk_peso_positivo CHECK ((peso >= (0)::numeric))
);


--
-- Name: pesada_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pesada_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pesada_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pesada_id_seq OWNED BY public.pesada.id;


--
-- Name: producto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto (
    id integer NOT NULL,
    codigo character varying(50),
    nombre character varying(150) NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    localidad_id integer NOT NULL
);


--
-- Name: producto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.producto_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: producto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.producto_id_seq OWNED BY public.producto.id;


--
-- Name: productor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productor (
    id integer NOT NULL,
    codigo character varying(50),
    nombre character varying(150) NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    localidad_id integer NOT NULL
);


--
-- Name: productor_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productor_id_seq OWNED BY public.productor.id;


--
-- Name: provincia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provincia (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: provincia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.provincia_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: provincia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.provincia_id_seq OWNED BY public.provincia.id;


--
-- Name: reporte; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reporte (
    id integer NOT NULL,
    numero_reporte bigint NOT NULL,
    cantidad_pesadas integer DEFAULT 0 NOT NULL,
    total_bruto numeric(14,2),
    total_tara numeric(14,2),
    total_neto numeric(14,2),
    pesadas_data jsonb DEFAULT '[]'::jsonb NOT NULL,
    observaciones text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    localidad_id integer NOT NULL
);


--
-- Name: reporte_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reporte_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reporte_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reporte_id_seq OWNED BY public.reporte.id;


--
-- Name: reporte_numero_reporte_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reporte_numero_reporte_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reporte_numero_reporte_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reporte_numero_reporte_seq OWNED BY public.reporte.numero_reporte;


--
-- Name: ticket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket (
    id integer CONSTRAINT ticket_id_not_null1 NOT NULL,
    numero_ticket bigint CONSTRAINT ticket_numero_ticket_not_null1 NOT NULL,
    estado public.estado_ticket_enum DEFAULT 'ABIERTO'::public.estado_ticket_enum,
    observaciones text,
    cantidad_ops integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    localidad_id integer NOT NULL
);


--
-- Name: ticket_old; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_old (
    id integer CONSTRAINT ticket_id_not_null NOT NULL,
    numero_ticket bigint CONSTRAINT ticket_numero_ticket_not_null NOT NULL,
    pesada_id integer,
    estado public.estado_ticket_enum DEFAULT 'ABIERTO'::public.estado_ticket_enum,
    observaciones text,
    nro_remito character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ticket_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_id_seq OWNED BY public.ticket_old.id;


--
-- Name: ticket_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_id_seq1 OWNED BY public.ticket.id;


--
-- Name: ticket_numero_ticket_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_numero_ticket_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_numero_ticket_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_numero_ticket_seq OWNED BY public.ticket_old.numero_ticket;


--
-- Name: ticket_numero_ticket_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_numero_ticket_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_numero_ticket_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_numero_ticket_seq1 OWNED BY public.ticket.numero_ticket;


--
-- Name: ticket_operacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_operacion (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    operacion_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ticket_operacion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_operacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_operacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_operacion_id_seq OWNED BY public.ticket_operacion.id;


--
-- Name: transporte; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transporte (
    id integer NOT NULL,
    codigo character varying(50),
    nombre character varying(150) NOT NULL,
    cuit character varying(20),
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    localidad_id integer NOT NULL
);


--
-- Name: transporte_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transporte_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transporte_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transporte_id_seq OWNED BY public.transporte.id;


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash text NOT NULL,
    rol public.rol_enum DEFAULT 'gerente'::public.rol_enum NOT NULL,
    localidad_id integer,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    empresa_id integer,
    CONSTRAINT chk_usuario_empresa CHECK (((rol = 'superadmin'::public.rol_enum) OR (empresa_id IS NOT NULL)))
);


--
-- Name: usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_id_seq OWNED BY public.usuario.id;


--
-- Name: vehiculo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehiculo (
    id integer NOT NULL,
    patente character varying(15) NOT NULL,
    patente_acoplado character varying(15),
    tipo_vehiculo public.tipo_vehiculo_enum NOT NULL,
    activo boolean DEFAULT true,
    observaciones text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    localidad_id integer NOT NULL
);


--
-- Name: vehiculo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehiculo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehiculo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehiculo_id_seq OWNED BY public.vehiculo.id;


--
-- Name: chofer id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chofer ALTER COLUMN id SET DEFAULT nextval('public.chofer_id_seq'::regclass);


--
-- Name: configuracion_dispositivos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_dispositivos ALTER COLUMN id SET DEFAULT nextval('public.configuracion_dispositivos_id_seq'::regclass);


--
-- Name: empresa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa ALTER COLUMN id SET DEFAULT nextval('public.empresa_id_seq'::regclass);


--
-- Name: localidad id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.localidad ALTER COLUMN id SET DEFAULT nextval('public.localidad_id_seq'::regclass);


--
-- Name: operacion_pesaje id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operacion_pesaje ALTER COLUMN id SET DEFAULT nextval('public.operacion_pesaje_id_seq'::regclass);


--
-- Name: pesada id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesada ALTER COLUMN id SET DEFAULT nextval('public.pesada_id_seq'::regclass);


--
-- Name: producto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto ALTER COLUMN id SET DEFAULT nextval('public.producto_id_seq'::regclass);


--
-- Name: productor id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productor ALTER COLUMN id SET DEFAULT nextval('public.productor_id_seq'::regclass);


--
-- Name: provincia id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provincia ALTER COLUMN id SET DEFAULT nextval('public.provincia_id_seq'::regclass);


--
-- Name: reporte id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte ALTER COLUMN id SET DEFAULT nextval('public.reporte_id_seq'::regclass);


--
-- Name: reporte numero_reporte; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte ALTER COLUMN numero_reporte SET DEFAULT nextval('public.reporte_numero_reporte_seq'::regclass);


--
-- Name: ticket id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket ALTER COLUMN id SET DEFAULT nextval('public.ticket_id_seq1'::regclass);


--
-- Name: ticket numero_ticket; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket ALTER COLUMN numero_ticket SET DEFAULT nextval('public.ticket_numero_ticket_seq1'::regclass);


--
-- Name: ticket_old id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_old ALTER COLUMN id SET DEFAULT nextval('public.ticket_id_seq'::regclass);


--
-- Name: ticket_old numero_ticket; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_old ALTER COLUMN numero_ticket SET DEFAULT nextval('public.ticket_numero_ticket_seq'::regclass);


--
-- Name: ticket_operacion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_operacion ALTER COLUMN id SET DEFAULT nextval('public.ticket_operacion_id_seq'::regclass);


--
-- Name: transporte id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporte ALTER COLUMN id SET DEFAULT nextval('public.transporte_id_seq'::regclass);


--
-- Name: usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id SET DEFAULT nextval('public.usuario_id_seq'::regclass);


--
-- Name: vehiculo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculo ALTER COLUMN id SET DEFAULT nextval('public.vehiculo_id_seq'::regclass);


--
-- Name: chofer chofer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chofer
    ADD CONSTRAINT chofer_pkey PRIMARY KEY (id);


--
-- Name: configuracion_dispositivos configuracion_dispositivo_tipo_localidad_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_dispositivos
    ADD CONSTRAINT configuracion_dispositivo_tipo_localidad_key UNIQUE (tipo_dispositivo, localidad_id);


--
-- Name: configuracion_dispositivos configuracion_dispositivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_dispositivos
    ADD CONSTRAINT configuracion_dispositivos_pkey PRIMARY KEY (id);


--
-- Name: empresa_config empresa_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_config
    ADD CONSTRAINT empresa_config_pkey PRIMARY KEY (empresa_id);


--
-- Name: empresa empresa_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_nombre_key UNIQUE (nombre);


--
-- Name: empresa empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_pkey PRIMARY KEY (id);


--
-- Name: localidad localidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.localidad
    ADD CONSTRAINT localidad_pkey PRIMARY KEY (id);


--
-- Name: operacion_pesaje operacion_pesaje_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operacion_pesaje
    ADD CONSTRAINT operacion_pesaje_pkey PRIMARY KEY (id);


--
-- Name: pesada pesada_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesada
    ADD CONSTRAINT pesada_pkey PRIMARY KEY (id);


--
-- Name: producto producto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT producto_pkey PRIMARY KEY (id);


--
-- Name: productor productor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productor
    ADD CONSTRAINT productor_pkey PRIMARY KEY (id);


--
-- Name: provincia provincia_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provincia
    ADD CONSTRAINT provincia_nombre_key UNIQUE (nombre);


--
-- Name: provincia provincia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provincia
    ADD CONSTRAINT provincia_pkey PRIMARY KEY (id);


--
-- Name: reporte reporte_numero_reporte_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte
    ADD CONSTRAINT reporte_numero_reporte_key UNIQUE (numero_reporte);


--
-- Name: reporte reporte_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte
    ADD CONSTRAINT reporte_pkey PRIMARY KEY (id);


--
-- Name: ticket ticket_numero_ticket_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket
    ADD CONSTRAINT ticket_numero_ticket_key UNIQUE (numero_ticket);


--
-- Name: ticket_old ticket_old_numero_ticket_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_old
    ADD CONSTRAINT ticket_old_numero_ticket_key UNIQUE (numero_ticket);


--
-- Name: ticket_old ticket_old_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_old
    ADD CONSTRAINT ticket_old_pkey PRIMARY KEY (id);


--
-- Name: ticket_operacion ticket_operacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_operacion
    ADD CONSTRAINT ticket_operacion_pkey PRIMARY KEY (id);


--
-- Name: ticket_operacion ticket_operacion_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_operacion
    ADD CONSTRAINT ticket_operacion_unique UNIQUE (ticket_id, operacion_id);


--
-- Name: ticket ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket
    ADD CONSTRAINT ticket_pkey PRIMARY KEY (id);


--
-- Name: transporte transporte_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporte
    ADD CONSTRAINT transporte_pkey PRIMARY KEY (id);


--
-- Name: pesada unica_pesada_por_tipo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesada
    ADD CONSTRAINT unica_pesada_por_tipo UNIQUE (operacion_id, tipo);


--
-- Name: chofer uq_chofer_codigo_loc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chofer
    ADD CONSTRAINT uq_chofer_codigo_loc UNIQUE (codigo, localidad_id);


--
-- Name: chofer uq_chofer_documento_loc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chofer
    ADD CONSTRAINT uq_chofer_documento_loc UNIQUE (nro_documento, localidad_id);


--
-- Name: chofer uq_chofer_nombre_loc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chofer
    ADD CONSTRAINT uq_chofer_nombre_loc UNIQUE (apellido_nombre, localidad_id);


--
-- Name: localidad uq_localidad_provincia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.localidad
    ADD CONSTRAINT uq_localidad_provincia UNIQUE (nombre, provincia_id);


--
-- Name: producto uq_producto_codigo_loc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT uq_producto_codigo_loc UNIQUE (codigo, localidad_id);


--
-- Name: producto uq_producto_nombre_loc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT uq_producto_nombre_loc UNIQUE (nombre, localidad_id);


--
-- Name: productor uq_productor_codigo_loc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productor
    ADD CONSTRAINT uq_productor_codigo_loc UNIQUE (codigo, localidad_id);


--
-- Name: productor uq_productor_nombre_loc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productor
    ADD CONSTRAINT uq_productor_nombre_loc UNIQUE (nombre, localidad_id);


--
-- Name: transporte uq_transporte_codigo_loc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporte
    ADD CONSTRAINT uq_transporte_codigo_loc UNIQUE (codigo, localidad_id);


--
-- Name: transporte uq_transporte_nombre_loc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporte
    ADD CONSTRAINT uq_transporte_nombre_loc UNIQUE (nombre, localidad_id);


--
-- Name: vehiculo uq_vehiculo_patente_loc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculo
    ADD CONSTRAINT uq_vehiculo_patente_loc UNIQUE (patente, localidad_id);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id);


--
-- Name: usuario usuario_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_username_key UNIQUE (username);


--
-- Name: vehiculo vehiculo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculo
    ADD CONSTRAINT vehiculo_pkey PRIMARY KEY (id);


--
-- Name: configuracion_dispositivos_agente_token_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX configuracion_dispositivos_agente_token_uq ON public.configuracion_dispositivos USING btree (agente_token_hash) WHERE (agente_token_hash IS NOT NULL);


--
-- Name: idx_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activo ON public.configuracion_dispositivos USING btree (activo);


--
-- Name: idx_chofer_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chofer_activo ON public.chofer USING btree (activo);


--
-- Name: idx_chofer_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chofer_codigo ON public.chofer USING btree (codigo);


--
-- Name: idx_chofer_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chofer_documento ON public.chofer USING btree (nro_documento);


--
-- Name: idx_chofer_localidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chofer_localidad ON public.chofer USING btree (localidad_id);


--
-- Name: idx_localidad_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_localidad_empresa ON public.localidad USING btree (empresa_id);


--
-- Name: idx_localidad_provincia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_localidad_provincia ON public.localidad USING btree (provincia_id);


--
-- Name: idx_operacion_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operacion_fecha ON public.operacion_pesaje USING btree (created_at);


--
-- Name: idx_operacion_patente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operacion_patente ON public.operacion_pesaje USING btree (vehiculo_patente);


--
-- Name: idx_pesada_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pesada_fecha ON public.pesada USING btree (fecha_hora);


--
-- Name: idx_producto_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_activo ON public.producto USING btree (activo);


--
-- Name: idx_producto_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_codigo ON public.producto USING btree (codigo);


--
-- Name: idx_producto_localidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_localidad ON public.producto USING btree (localidad_id);


--
-- Name: idx_productor_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productor_activo ON public.productor USING btree (activo);


--
-- Name: idx_productor_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productor_codigo ON public.productor USING btree (codigo);


--
-- Name: idx_productor_localidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productor_localidad ON public.productor USING btree (localidad_id);


--
-- Name: idx_reporte_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reporte_created_at ON public.reporte USING btree (created_at DESC);


--
-- Name: idx_ticket_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_estado ON public.ticket_old USING btree (estado);


--
-- Name: idx_ticket_operacion_operacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_operacion_operacion ON public.ticket_operacion USING btree (operacion_id);


--
-- Name: idx_ticket_operacion_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_operacion_ticket ON public.ticket_operacion USING btree (ticket_id);


--
-- Name: idx_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tipo ON public.configuracion_dispositivos USING btree (tipo_dispositivo);


--
-- Name: idx_transporte_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transporte_activo ON public.transporte USING btree (activo);


--
-- Name: idx_transporte_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transporte_codigo ON public.transporte USING btree (codigo);


--
-- Name: idx_transporte_localidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transporte_localidad ON public.transporte USING btree (localidad_id);


--
-- Name: idx_usuario_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_activo ON public.usuario USING btree (activo);


--
-- Name: idx_usuario_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_empresa ON public.usuario USING btree (empresa_id);


--
-- Name: idx_usuario_localidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_localidad ON public.usuario USING btree (localidad_id);


--
-- Name: idx_usuario_rol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_rol ON public.usuario USING btree (rol);


--
-- Name: idx_vehiculo_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehiculo_activo ON public.vehiculo USING btree (activo);


--
-- Name: idx_vehiculo_localidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehiculo_localidad ON public.vehiculo USING btree (localidad_id);


--
-- Name: idx_vehiculo_patente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehiculo_patente ON public.vehiculo USING btree (patente);


--
-- Name: idx_vehiculo_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehiculo_tipo ON public.vehiculo USING btree (tipo_vehiculo);


--
-- Name: unica_operacion_abierta_por_camion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unica_operacion_abierta_por_camion ON public.operacion_pesaje USING btree (vehiculo_patente) WHERE (abierta = true);


--
-- Name: uq_chofer_cuit; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_chofer_cuit ON public.chofer USING btree (cuit) WHERE (cuit IS NOT NULL);


--
-- Name: pesada trg_calcular_neto; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_calcular_neto AFTER INSERT ON public.pesada FOR EACH ROW EXECUTE FUNCTION public.calcular_neto();


--
-- Name: usuario trg_usuario_localidad_empresa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usuario_localidad_empresa BEFORE INSERT OR UPDATE OF localidad_id, empresa_id ON public.usuario FOR EACH ROW EXECUTE FUNCTION public.usuario_localidad_empresa_chk();


--
-- Name: chofer chofer_localidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chofer
    ADD CONSTRAINT chofer_localidad_id_fkey FOREIGN KEY (localidad_id) REFERENCES public.localidad(id);


--
-- Name: configuracion_dispositivos configuracion_dispositivos_localidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_dispositivos
    ADD CONSTRAINT configuracion_dispositivos_localidad_id_fkey FOREIGN KEY (localidad_id) REFERENCES public.localidad(id);


--
-- Name: empresa_config empresa_config_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_config
    ADD CONSTRAINT empresa_config_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id) ON DELETE CASCADE;


--
-- Name: pesada fk_operacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesada
    ADD CONSTRAINT fk_operacion FOREIGN KEY (operacion_id) REFERENCES public.operacion_pesaje(id) ON DELETE CASCADE;


--
-- Name: operacion_pesaje fk_operacion_vehiculo_loc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operacion_pesaje
    ADD CONSTRAINT fk_operacion_vehiculo_loc FOREIGN KEY (vehiculo_patente, localidad_id) REFERENCES public.vehiculo(patente, localidad_id);


--
-- Name: localidad localidad_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.localidad
    ADD CONSTRAINT localidad_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- Name: localidad localidad_provincia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.localidad
    ADD CONSTRAINT localidad_provincia_id_fkey FOREIGN KEY (provincia_id) REFERENCES public.provincia(id) ON DELETE RESTRICT;


--
-- Name: operacion_pesaje operacion_pesaje_localidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operacion_pesaje
    ADD CONSTRAINT operacion_pesaje_localidad_id_fkey FOREIGN KEY (localidad_id) REFERENCES public.localidad(id);


--
-- Name: pesada pesada_chofer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesada
    ADD CONSTRAINT pesada_chofer_id_fkey FOREIGN KEY (chofer_id) REFERENCES public.chofer(id);


--
-- Name: pesada pesada_dispositivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesada
    ADD CONSTRAINT pesada_dispositivo_id_fkey FOREIGN KEY (dispositivo_id) REFERENCES public.configuracion_dispositivos(id);


--
-- Name: pesada pesada_operacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesada
    ADD CONSTRAINT pesada_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operacion_pesaje(id) ON DELETE CASCADE;


--
-- Name: pesada pesada_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesada
    ADD CONSTRAINT pesada_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id);


--
-- Name: pesada pesada_productor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesada
    ADD CONSTRAINT pesada_productor_id_fkey FOREIGN KEY (productor_id) REFERENCES public.productor(id);


--
-- Name: pesada pesada_transporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesada
    ADD CONSTRAINT pesada_transporte_id_fkey FOREIGN KEY (transporte_id) REFERENCES public.transporte(id);


--
-- Name: producto producto_localidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT producto_localidad_id_fkey FOREIGN KEY (localidad_id) REFERENCES public.localidad(id);


--
-- Name: productor productor_localidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productor
    ADD CONSTRAINT productor_localidad_id_fkey FOREIGN KEY (localidad_id) REFERENCES public.localidad(id);


--
-- Name: reporte reporte_localidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte
    ADD CONSTRAINT reporte_localidad_id_fkey FOREIGN KEY (localidad_id) REFERENCES public.localidad(id);


--
-- Name: ticket ticket_localidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket
    ADD CONSTRAINT ticket_localidad_id_fkey FOREIGN KEY (localidad_id) REFERENCES public.localidad(id);


--
-- Name: ticket_operacion ticket_operacion_operacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_operacion
    ADD CONSTRAINT ticket_operacion_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operacion_pesaje(id);


--
-- Name: ticket_operacion ticket_operacion_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_operacion
    ADD CONSTRAINT ticket_operacion_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.ticket(id) ON DELETE CASCADE;


--
-- Name: ticket_old ticket_pesada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_old
    ADD CONSTRAINT ticket_pesada_id_fkey FOREIGN KEY (pesada_id) REFERENCES public.pesada(id);


--
-- Name: transporte transporte_localidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporte
    ADD CONSTRAINT transporte_localidad_id_fkey FOREIGN KEY (localidad_id) REFERENCES public.localidad(id);


--
-- Name: usuario usuario_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(id);


--
-- Name: usuario usuario_localidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_localidad_id_fkey FOREIGN KEY (localidad_id) REFERENCES public.localidad(id);


--
-- Name: vehiculo vehiculo_localidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculo
    ADD CONSTRAINT vehiculo_localidad_id_fkey FOREIGN KEY (localidad_id) REFERENCES public.localidad(id);


--
-- PostgreSQL database dump complete
--

\unrestrict WBzdTBZVYZ2RLUWaamn9iuZbCJOLxqDRfSVI8XsGZ4dQGbIarPyHnj0XmDqpvbs

