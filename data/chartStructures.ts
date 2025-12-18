import { FinancialStructure, ChartNode } from '../types';

const acc = (id: string, name: string): ChartNode => ({
  id,
  name,
  level: 'ACCOUNT'
});

const sub = (id: string, name: string, children: ChartNode[]): ChartNode => ({
  id,
  name,
  level: 'SUBGROUP',
  children
});

// 1. BALANCE DE SITUACIÓN GENERAL
export const BALANCE_GENERAL: FinancialStructure = {
  id: 'BG_GUA',
  title: 'BALANCE DE SITUACIÓN GENERAL',
  obligatoryRules: [
    "ACTIVO",
    "NO CORRIENTE",
    "CORRIENTE",
    "Suma del Activo",
    "PATRIMONIO NETO",
    "PASIVO",
    "NO CORRIENTE",
    "CORRIENTE",
    "Suma del Patrimonio Neto y Pasivo"
  ],
  rootNodes: [
    {
      id: 'bg_activo',
      name: 'ACTIVO',
      level: 'GROUP',
      children: [
        sub('bg_anc', 'ACTIVO NO CORRIENTE', [
          sub('bg_ppe', 'PROPIEDAD, PLANTA Y EQUIPO', [
            acc('bg_inm', 'Inmuebles'),
            acc('bg_maq', 'Maquinaria'),
            acc('bg_mye', 'Mobiliario y Equipo'),
            acc('bg_veh', 'Vehículos'),
            acc('bg_edc', 'Equipo de Computación'),
            acc('bg_her', 'Herramientas'),
            acc('bg_por', 'Porcelana'),
            acc('bg_cri', 'Cristalería'),
            acc('bg_pel', 'Peltre'),
            acc('bg_man', 'Mantelería'),
            acc('bg_dep_ac', '(Menos Depreciación Acumulada)')
          ]),
          sub('bg_ilp', 'INVERSIONES A LARGO PLAZO', [
            acc('bg_inv_lp', 'Inversiones a Largo Plazo'),
            acc('bg_vm_lp', 'Valores Mobiliarios a Largo Plazo'),
            acc('bg_dcc_lp', 'Documentos Comerciales por Cobrar a Largo Plazo')
          ]),
          sub('bg_int', 'ACTIVOS INTANGIBLES', [
            acc('bg_gdo', 'Gastos de Organización/Constitución'),
            acc('bg_gdi', 'Gastos de Instalación'),
            acc('bg_myp', 'Marcas y Patentes'),
            acc('bg_ddl', 'Derecho de Llave'),
            acc('bg_crm', 'Crédito Mercantil'),
            acc('bg_fdn', 'Fama del Negocio'),
            acc('bg_dli', 'Derechos Literarios'),
            acc('bg_for', 'Fórmulas'),
            acc('bg_con', 'Concesiones'),
            acc('bg_ama', '(Menos Amortización Acumulada)')
          ]),
          acc('bg_oanc', 'OTROS ACTIVOS NO CORRIENTES')
        ]),
        sub('bg_ac', 'ACTIVO CORRIENTE', [
          sub('bg_inv', 'INVENTARIOS', [
            acc('bg_mp', 'Materia Prima'),
            acc('bg_pp', 'Productos en Proceso'),
            acc('bg_pt', 'Productos Terminados'),
            acc('bg_mer', 'Mercaderías'),
            acc('bg_mpt', 'Mercaderías/Materias Primas en Tránsito'),
            acc('bg_mpa', 'Mercaderías/Materias Primas en Aduana'),
            acc('bg_mde', 'Material de Empaque'),
            acc('bg_pyu', 'Papelería y Útiles'),
            acc('bg_rya', 'Repuestos y Accesorios'),
            acc('bg_gya', 'Grasas y Aceites'),
            acc('bg_uye', 'Útiles y Enseres'),
            acc('bg_ere', 'Envases Retornables'),
            acc('bg_esf', 'Especies Fiscales (Timbres Fiscales)')
          ]),
          sub('bg_it', 'INVERSIONES TEMPORALES', [
            acc('bg_vm_cp', 'Valores Mobiliarios a Corto Plazo'),
            acc('bg_inv_cp', 'Inversiones a Corto Plazo')
          ]),
          sub('bg_cxc', 'CUENTAS POR COBRAR', [
            sub('bg_cdc_g', 'Clientes/Deudores Comerciales', [
              acc('bg_rci', '(Menos Reserva para Cuentas Incobrables)')
            ]),
            acc('bg_ocxc_cp', 'Otras Cuentas por Cobrar a Corto Plazo'),
            acc('bg_ixc', 'Intereses por Cobrar'),
            acc('bg_comxc', 'Comisiones por Cobrar'),
            acc('bg_cor_d', 'Corresponsales (Deudor)'),
            acc('bg_iva_xc', 'IVA por Cobrar'),
            acc('bg_iso_xa', 'ISO por Acreditar'),
            acc('bg_isr_xa', 'ISR Retenido por Acreditar Sobre Ventas'),
            acc('bg_apv', 'Anticipo a Proveedores'),
            acc('bg_asc', 'Anticipo sobre Compras'),
            sub('bg_dcc_cp_g', 'Documentos Comerciales por Cobrar a Corto Plazo', [
              acc('bg_dd', '(Menos Documentos Descontados)')
            ]),
            acc('bg_cpr', 'Cuenta Promesa'),
            acc('bg_iva_ce', 'IVA Conforme Constancias de Exención'),
            acc('bg_iva_rpc', 'IVA Retenciones por Compensar'),
            acc('bg_cxct', 'Cuentas por Cobrar Tarjeta de Débito/Crédito')
          ]),
          sub('bg_ad', 'ACTIVOS DIFERIDOS', [
            acc('bg_mod_pa', 'Mano de Obra Directa Pagada por Anticipado'),
            acc('bg_moi_pa', 'Mano de Obra Indirecta Pagada por Anticipado'),
            acc('bg_sp_pa', 'Seguros Pagados por Anticipado'),
            acc('bg_sup_pa', 'Sueldos Pagados por Anticipado'),
            acc('bg_bop_pa', 'Bonificaciones Pagadas por Anticipado'),
            acc('bg_alp_pa', 'Alquileres Pagados por Anticipado'),
            acc('bg_comp_pa', 'Comisiones Pagadas por Anticipado'),
            acc('bg_intp_pa', 'Intereses Pagadas por Anticipado'),
            acc('bg_pubp_pa', 'Publicidad Pagada por Anticipado'),
            acc('bg_prop_pa', 'Propaganda Pagada por Anticipado')
          ]),
          sub('bg_eye', 'EFECTIVO Y EQUIVALENTES', [
            acc('bg_caja', 'Caja'),
            acc('bg_caja_ch', 'Caja Chica'),
            acc('bg_bancos', 'Bancos')
          ])
        ])
      ]
    },
    {
      id: 'bg_pasivo',
      name: 'PASIVO',
      level: 'GROUP',
      children: [
        sub('bg_pnc', 'PASIVO NO CORRIENTE', [
          sub('bg_dlp', 'DEUDAS A LARGO PLAZO', [
            acc('bg_hip_lp', 'Hipotecas/Acreedores Hipotecarios a Largo Plazo'),
            acc('bg_acre_lp', 'Acreedores a Largo Plazo'),
            acc('bg_pre_lp', 'Préstamos Bancarios a Largo Plazo'),
            acc('bg_doc_lp', 'Documentos por Pagar a Largo Plazo'),
            acc('bg_ocxp_lp', 'Otras Cuentas por Pagar a Largo Plazo'),
            acc('bg_emb', 'Emisión de Bonos')
          ]),
          sub('bg_plp', 'PROVISIONES A LARGO PLAZO', [
            acc('bg_ri', 'Reserva para Indemnizaciones'),
            acc('bg_rj', 'Reserva para Jubilaciones')
          ])
        ]),
        sub('bg_pc', 'PASIVO CORRIENTE', [
          sub('bg_of', 'OBLIGACIONES FINANCIERAS', [
            acc('bg_pre_cp', 'Préstamos Bancarios a Corto Plazo'),
            acc('bg_hip_cp', 'Hipotecas a Corto Plazo'),
            acc('bg_doc_cp', 'Documentos Comerciales por Pagar a Corto Plazo')
          ]),
          sub('bg_cxpc', 'CUENTAS POR PAGAR COMERCIALES', [
            acc('bg_prov', 'Proveedores/Acreedores Comerciales'),
            acc('bg_anc_g', 'Acreedores no Comerciales'),
            acc('bg_ocxp_cp', 'Otras Cuentas por Pagar a Corto Plazo')
          ]),
          sub('bg_ipp', 'IMPUESTOS POR PAGAR', [
            acc('bg_iva_pp', 'IVA por Pagar'),
            acc('bg_igss_pp', 'IGSS por Pagar/Cuotas Patronales y Laborales por Pagar'),
            acc('bg_iusi_pp', 'Impuesto Único Sobre Inmuebles por Pagar'),
            sub('bg_isr_pp_g', 'Impuesto Sobre la Renta por Pagar', [
              acc('bg_isr_tr_acr', '(Menos ISR Trimestral por Acreditar)'),
              acc('bg_iso_acr_g', '(Menos ISO por Acreditar)')
            ]),
            acc('bg_isr_ret_pg', 'ISR Retenido por Pagar Sobre Ganancias de Capital'),
            acc('bg_isr_pg_sc', 'ISR por Pagar Sobre Compras'),
            acc('bg_isr_ret_rc', 'ISR Retenido por Pagar Sobre Rentas de Capital'),
            acc('bg_iso_pp', 'ISO por Pagar')
          ]),
          sub('bg_ol', 'OBLIGACIONES LABORALES', [
            acc('bg_pl_pp', 'Prestaciones Laborales por Pagar'),
            acc('bg_cp_pp', 'Cuotas Patronales por Pagar')
          ]),
          sub('bg_oo', 'OTRAS OBLIGACIONES', [
            acc('bg_asv', 'Anticipo sobre Ventas'),
            acc('bg_cor_a', 'Corresponsales (Acreedor)'),
            acc('bg_ixp', 'Intereses por Pagar'),
            acc('bg_coxp', 'Comisiones por Pagar')
          ]),
          sub('bg_idif', 'INGRESOS DIFERIDOS', [
            sub('bg_acpa_g', 'Alquileres Cobrados por Anticipado', [
              acc('bg_apnd', 'Alquileres Percibidos no Devengados')
            ]),
            sub('bg_ccpa_g', 'Comisiones Cobradas por Anticipado', [
              acc('bg_cpnd', 'Comisiones Percibidas no Devengadas')
            ]),
            sub('bg_icpa_g', 'Intereses Cobrados por Anticipado', [
              acc('bg_ipnd', 'Intereses Percibidos no Devengados')
            ])
          ])
        ])
      ]
    },
    {
      id: 'bg_pat',
      name: 'PATRIMONIO',
      level: 'GROUP',
      children: [
        acc('bg_cap', 'Capital'),
        acc('bg_cap_s', 'Capital Social'),
        sub('bg_cap_a_g', 'Capital Autorizado', [
          acc('bg_aps', '(Menos Acciones por Suscribir)'),
          acc('bg_sda', '(Menos Suscripciones de Acciones)')
        ]),
        acc('bg_cap_d', 'Capital Donado'),
        acc('bg_res_l', 'Reserva Legal'),
        acc('bg_sup_a', 'Superávit Acumulado'),
        acc('bg_def_a', 'Déficit Acumulado'),
        acc('bg_afac', 'Aportaciones para Futuros Aumentos de Capital'),
        acc('bg_gun_e', 'Ganancia/Utilidad Neta del Ejercicio'),
        acc('bg_pne', 'Pérdida Neta del Ejercicio'),
        acc('bg_ur', 'Utilidades Retenidas'),
        acc('bg_pa', 'Pérdidas Acumuladas'),
        acc('bg_rea', 'Resultados de Ejercicios Anteriores'),
        acc('bg_re', 'Reserva Estatutaria'),
        acc('bg_rc', 'Reserva Contractual'),
        acc('bg_pc_g', '(Pérdida de Capital)')
      ]
    }
  ]
};

// 2. ESTADO DE COSTO DE PRODUCCIÓN
export const COSTO_PRODUCCION: FinancialStructure = {
  id: 'CP_GUA',
  title: 'ESTADO DE COSTO DE PRODUCCIÓN',
  obligatoryRules: [
    "MOVIMIENTO DE MATERIA PRIMA",
    "Materia Prima, Inventario Inicial",
    "Materia prima disponible",
    "Materia Prima Empleada",
    "Costo Primo",
    "GASTOS DE FABRICACIÓN",
    "Total de Cargos",
    "Subtotal",
    "Costo de Producción"
  ],
  rootNodes: [
    {
      id: 'cp_mpc',
      name: 'MATERIA PRIMA CONSUMIDA',
      level: 'GROUP',
      children: [
        acc('cp_mp_ii', 'Materia Prima, Inventario Inicial'),
        acc('cp_mp_comp', '(+) Compras de Materia Prima'),
        acc('cp_mp_gscomp', '(+) Gastos sobre Compras de Materia Prima'),
        acc('cp_mp_dev', '(-) Devoluciones y Rebajas sobre Compras de Materia Prima'),
        acc('cp_mp_if', '(-) Materia Prima, Inventario Final')
      ]
    },
    {
      id: 'cp_cpri',
      name: 'COSTO PRIMO',
      level: 'GROUP',
      children: [
        acc('cp_mpc_v', '(+) Materia Prima Consumida'),
        acc('cp_mod', '(+) Mano de Obra Directa')
      ]
    },
    {
      id: 'cp_gf',
      name: 'GASTOS DE FABRICACIÓN',
      level: 'GROUP',
      children: [
        acc('cp_moi', 'Mano de Obra Indirecta'),
        acc('cp_bi_f', 'Bonificación Incentivo Fábrica'),
        acc('cp_cp_f', 'Cuotas Patronales Fábrica'),
        acc('cp_pl_f', 'Prestaciones Laborales Fábrica'),
        acc('cp_ag_f', 'Aguinaldos Fábrica'),
        acc('cp_b14_f', 'Bono 14 Fábrica'),
        acc('cp_ind_f', 'Indemnización Fábrica'),
        acc('cp_vac_f', 'Vacaciones Fábrica'),
        acc('cp_alq_f', 'Alquileres Fábrica'),
        acc('cp_ee_f', 'Energía Eléctrica Fábrica'),
        acc('cp_fm_f', 'Fuerza Motriz Fábrica'),
        acc('cp_rya_f', 'Repuestos y Accesorios Consumidos'),
        acc('cp_ayg_f', 'Aceites y Grasas Consumidos'),
        acc('cp_rm_m', 'Reparación y Mantenimiento de Maquinaria'),
        acc('cp_iusi_f', 'IUSI Fábrica'),
        acc('cp_sv_f', 'Seguros Vencidos Fábrica'),
        acc('cp_mpi', 'Materia Prima Inservible'),
        acc('cp_mec_f', 'Material de Empaque Consumido Fábrica'),
        acc('cp_sc_f', 'Suministros Consumidos Fábrica'),
        acc('cp_gg_f', 'Gastos Generales Fábrica'),
        acc('cp_def_f', 'Depreciación Edificios Fábrica'),
        acc('cp_dm', 'Depreciación Maquinaria'),
        acc('cp_dh', 'Depreciación Herramientas'),
        acc('cp_dmef', 'Depreciación Mobiliario y Equipo Fábrica'),
        acc('cp_decf', 'Depreciación Equipo de Computación Fábrica'),
        acc('cp_agif', 'Amortización Gastos de Instalación Fábrica')
      ]
    },
    {
      id: 'cp_pep',
      name: 'PRODUCTOS EN PROCESO',
      level: 'GROUP',
      children: [
        acc('cp_pep_ii', '(+) Inventario Inicial'),
        acc('cp_pep_if', '(-) Inventario Final')
      ]
    }
  ]
};

// 3. ESTADO DE RESULTADOS
export const ESTADO_RESULTADOS: FinancialStructure = {
  id: 'ER_GUA',
  title: 'ESTADO DE RESULTADOS',
  obligatoryRules: [
    "INGRESO DE OPERACIONES",
    "Ventas Brutas",
    "Ventas netas",
    "COSTO DE VENTA",
    "Inventario inicial de Artículos Terminados",
    "(+) Costo de Producción",
    "Artículos disponibles",
    "(-) Inventario final de artículos disponibles",
    "Costo de Ventas",
    "Margen Bruto",
    "GASTO DE OPERACIÓN",
    "Gastos de operación",
    "Resultado de Operación Positivo",
    "GASTOS FINANCIEROS",
    "Diferencia Positiva",
    "Ganancia después del Impuesto y reserva"
  ],
  rootNodes: [
    {
      id: 'er_iop',
      name: 'INGRESOS DE OPERACIÓN',
      level: 'GROUP',
      children: [
        sub('er_v_g', 'Ventas', [
          acc('er_drv', '(-) Devoluciones y Rebajas Sobre Ventas')
        ]),
        acc('er_oiop', 'Otros Ingresos de Operación'),
        acc('er_oip', 'Otros Ingresos permanentes')
      ]
    },
    {
      id: 'er_cdv',
      name: 'COSTO DE VENTAS',
      level: 'GROUP',
      children: [
        acc('er_mii', '(+) Mercaderías (Inventario Inicial)'),
        acc('er_comp', '(+) Compras'),
        acc('er_gsc', '(+) Gastos sobre Compras'),
        acc('er_drsc', '(-) Devoluciones y Rebajas sobre Compras'),
        acc('er_mif', '(-) Mercaderías (Inventario Final)')
      ]
    },
    {
      id: 'er_gop',
      name: 'GASTOS DE OPERACIÓN',
      level: 'GROUP',
      children: [
        sub('er_gv_g', 'GASTOS DE VENTAS', [
          acc('er_ssv', 'Sueldos Sala de Ventas'),
          acc('er_csv', 'Comisiones Sobre Ventas'),
          acc('er_bisv', 'Bonificaciones Incentivo Sala de Ventas'),
          acc('er_rvr', 'Reparación de Vehículos de Reparto'),
          acc('er_svsv', 'Seguros Vencidos Sala de Ventas'),
          acc('er_dvr', 'Depreciación Vehículos de Reparto'),
          acc('er_dmesv', 'Depreciación Mobiliario y Equipo Sala de Ventas'),
          acc('er_decsv', 'Depreciación Equipo de Computación Sala de Ventas'),
          acc('er_desv', 'Depreciación Edificios Sala de Ventas'),
          acc('er_cpsv', 'Cuotas Patronales Sala de Ventas'),
          acc('er_mec', 'Material de Empaque Consumido'),
          acc('er_pup', 'Publicidad o Propaganda'),
          acc('er_tdp', 'Timbre de Prensa'),
          acc('er_cylcsv', 'Combustibles y Lubricantes Consumidos Sala de Ventas'),
          acc('er_asv_alq', 'Alquiler Sala de Ventas'),
          acc('er_isv', 'Indemnización Sala de Ventas'),
          acc('er_agsv', 'Aguinaldos Sala de Ventas'),
          acc('er_b14sv', 'Bono 14 Sala de Ventas'),
          acc('er_vsv', 'Vacaciones Sala de Ventas'),
          acc('er_iusisv', 'IUSI Sala de Ventas'),
          acc('er_gdsv', 'Gastos Diversos Sala de Ventas'),
          acc('er_plsv', 'Prestaciones Laborales Sala de Ventas'),
          acc('er_ctdc', 'Comisiones Tarjeta de Débito o Crédito')
        ]),
        sub('er_ga_g', 'GASTOS DE ADMINISTRACIÓN', [
          acc('er_sadm', 'Sueldos de Administración'),
          acc('er_biadm', 'Bonificaciones Incentivo de Administración'),
          acc('er_rvo', 'Reparación de Vehículos de Oficina'),
          acc('er_svo', 'Seguros Vencidos de Oficina'),
          acc('er_dvo', 'Depreciación Vehículos de Oficina'),
          acc('er_dmeo', 'Depreciación Mobiliario y Equipo de Oficina'),
          acc('er_deo', 'Depreciación Edificios de Oficina'),
          acc('er_deco', 'Depreciación Equipo de Computación de Oficina'),
          acc('er_ago', 'Amortización Gastos de Organización'),
          acc('er_agc', 'Amortización Gastos de Constitución'),
          acc('er_amp', 'Amortización Marcas y Patentes'),
          acc('er_adl', 'Amortización Derecho de Llave'),
          acc('er_acm', 'Amortización Crédito Mercantil'),
          acc('er_adl_lit', 'Amortización Derechos Literarios'),
          acc('er_cuadm', 'Cuotas Patronales de Administración'),
          acc('er_cylco', 'Combustibles y Lubricantes Consumidos de Oficina'),
          acc('er_alqof', 'Alquiler de Oficinas'),
          acc('er_iadm', 'Indemnización de Administración'),
          acc('er_agadm', 'Aguinaldos de Administración'),
          acc('er_b14adm', 'Bono 14 de Administración'),
          acc('er_vadm', 'Vacaciones de Administración'),
          acc('er_pyuc', 'Papelería y Útiles Consumidos'),
          acc('er_iusiof', 'IUSI de Oficinas'),
          acc('er_ci', 'Cuentas Incobrables'),
          acc('er_gdof', 'Gastos Diversos de Oficina'),
          acc('er_plof', 'Prestaciones Laborales de Oficina')
        ])
      ]
    },
    {
      id: 'er_oiyg',
      name: 'OTROS INGRESOS Y GASTOS',
      level: 'GROUP',
      children: [
        sub('er_oi_g', 'OTROS INGRESOS', [
          acc('er_cre', 'Créditos Recuperados'),
          acc('er_rep', 'Regalías Percibidas'),
          acc('er_ipc', 'Intereses Percibidos/Cobrados/Ganados'),
          acc('er_dsc', 'Descuentos Sobre Compras'),
          acc('er_divp', 'Dividendos Percibidos'),
          acc('er_psa', 'Prima sobre Acciones'),
          acc('er_acpg', 'Alquileres Cobrados/Percibidos/Ganados'),
          acc('er_ccpg', 'Comisiones Percibidas/Cobradas/Ganadas'),
          acc('er_gdc', 'Ganancia de Capital'),
          acc('er_pdl', 'Premios de Lotería')
        ]),
        sub('er_og_g', 'OTROS GASTOS', [
          acc('er_reg', 'Regalías'),
          acc('er_intg', 'Intereses Gasto'),
          acc('er_comb', 'Comisiones Bancarias'),
          acc('er_dsv', 'Descuentos Sobre Ventas'),
          acc('er_dsa', 'Descuento sobre Acciones'),
          acc('er_don', 'Donativos'),
          acc('er_myr', 'Multas y Recargos'),
          acc('er_pdc_g', 'Pérdida de Capital'),
          acc('er_isr_gdc', 'ISR sobre Ganancias de Capital'),
          acc('er_isr_rdc', 'ISR sobre Rentas de Capital'),
          acc('er_isr_psa', 'ISR sobre Prima de Acciones')
        ])
      ]
    },
    {
      id: 'er_isr_g',
      name: 'IMPUESTO SOBRE LA RENTA',
      level: 'GROUP',
      children: [acc('er_isr', 'Impuesto sobre la Renta')]
    },
    {
      id: 'er_gf_g',
      name: 'GASTOS FINANCIEROS',
      level: 'GROUP',
      children: [acc('er_gf', 'Gastos Financieros')]
    },
    {
      id: 'er_dp_g',
      name: 'DIFERENCIA POSITIVA',
      level: 'GROUP',
      children: [acc('er_dp', 'Diferencia Positiva')]
    }
  ]
};

export const ALL_STRUCTURES = [BALANCE_GENERAL, COSTO_PRODUCCION, ESTADO_RESULTADOS];
