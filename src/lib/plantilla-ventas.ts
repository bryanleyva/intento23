// Formato de la plantilla erpviernes (plantilla_ventas_cierre.xlsx → hoja "Ventas").
// Compartido entre la server action (lectura de VENTAS) y el panel cliente.

export interface PlantillaRow {
    fecha: string;
    cliente: string;
    doc: string;
    canal: string;
    plan: string;
    tipo: string;
    lineas: string;
    cargo: string;
    direccion: string;
    sr: string;
    nro_orden: string;
    oit: string;
    vendedor_dni: string;
    vendedor: string;
    supervisor_dni: string;
    supervisor: string;
    equipo: string;
    estado: string;
}

// Orden EXACTO de columnas de la plantilla.
export const PLANTILLA_HEADERS: (keyof PlantillaRow)[] = [
    'fecha', 'cliente', 'doc', 'canal', 'plan', 'tipo', 'lineas', 'cargo',
    'direccion', 'sr', 'nro_orden', 'oit', 'vendedor_dni', 'vendedor',
    'supervisor_dni', 'supervisor', 'equipo', 'estado',
];
