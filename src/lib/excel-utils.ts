import { AppSwal } from '@/lib/sweetalert';

export async function exportVentasToExcel(filteredVentas: any[], selectedMonth: number, selectedYear: number) {
    if (filteredVentas.length === 0) {
        AppSwal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay ventas para exportar con los filtros actuales.' });
        return;
    }

    try {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ventas');

        // Columnas
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Ejecutivo', key: 'ejecutivo', width: 20 },
            { header: 'Supervisor', key: 'supervisor', width: 20 },
            { header: 'Fecha', key: 'fecha', width: 15 },
            { header: 'Estado', key: 'estado', width: 20 },
            { header: 'RUC', key: 'ruc', width: 15 },
            { header: 'Razón Social', key: 'razonSocial', width: 30 },
            { header: 'Departamento', key: 'departamento', width: 15 },
            { header: 'Provincia', key: 'provincia', width: 15 },
            { header: 'Distrito', key: 'distrito', width: 15 },
            { header: 'Dirección', key: 'direccion', width: 30 },
            { header: 'Correo', key: 'correo', width: 25 },
            { header: 'Segmento', key: 'segmento', width: 15 },
            { header: 'Producto', key: 'producto', width: 20 },
            { header: 'Proceso', key: 'proceso', width: 15 },
            { header: 'Detalle', key: 'detalle', width: 15 },
            { header: 'Líneas', key: 'lineas', width: 10 },
            { header: 'Cargo Fijo', key: 'cargoFijo', width: 15 },
            { header: 'DNI Titular', key: 'dni', width: 15 },
            { header: 'Contacto', key: 'contacto', width: 20 },
            { header: 'Teléfono', key: 'telefono', width: 15 },
            { header: 'Tipo Venta', key: 'tipoVenta', width: 15 },
            { header: 'SR Ingreso', key: 'srIngreso', width: 15 },
            { header: 'Num Orden', key: 'numOrden', width: 15 },
            { header: 'Fecha Activación', key: 'fechaActivacion', width: 15 },
            { header: 'Fecha Inicio', key: 'fechaInicio', width: 20 },
            { header: 'Fecha Fin', key: 'fechaFin', width: 20 },
            { header: 'Período Reporte', key: 'fechaPeriodo', width: 20 },
            { header: 'Observación Mesa', key: 'observacion', width: 30 },
            { header: 'Aprobación Sup', key: 'aprobacion', width: 15 },
        ];

        // Header Style
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF10B981' }
        };

        // Add Data
        filteredVentas.forEach(v => {
            worksheet.addRow({
                ...v,
                cargoFijo: parseFloat(v.cargoFijo?.toString().replace(/,/g, '') || '0')
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `Ventas_Viernes_${selectedMonth}_${selectedYear}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting to excel:', error);
        AppSwal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el archivo Excel.' });
    }
}

/* --------------------------------------------------------------------------
 * Exporta TODAS las ventas en estado ACTIVADO, una hoja por supervisor,
 * ordenadas por ejecutivo y luego por fecha (de enero a la fecha actual).
 * Recibe filas tipo ReporteRow (de getPostVentaReporteData()).
 * ----------------------------------------------------------------------- */

function resolveFechaVenta(r: { fechaActivacion?: string; fechaFin?: string; fechaInicio?: string }):
    { date: Date | null; display: string } {
    const raw = r.fechaActivacion || r.fechaFin || r.fechaInicio || '';
    if (!raw) return { date: null, display: '' };
    const datePart = String(raw).split(',')[0].trim();
    const parts = datePart.split('/');
    if (parts.length < 3) return { date: null, display: datePart };
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return { date: null, display: datePart };
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return { date: new Date(year, month - 1, day), display: `${dd}/${mm}/${year}` };
}

// Nombre de pestaña válido en Excel: sin \ / ? * [ ] :, máx 31 chars, sin duplicados.
function safeSheetName(name: string, used: Set<string>): string {
    let base = (name || 'SIN SUPERVISOR').replace(/[\\\/\?\*\[\]:]/g, ' ').trim() || 'SIN SUPERVISOR';
    base = base.slice(0, 31);
    let candidate = base;
    let i = 2;
    while (used.has(candidate.toLowerCase())) {
        const suffix = ` (${i})`;
        candidate = base.slice(0, 31 - suffix.length) + suffix;
        i++;
    }
    used.add(candidate.toLowerCase());
    return candidate;
}

function styleVentasHeader(row: any) {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
}

export async function exportVentasActivasPorSupervisor(rows: any[]) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const endOfToday = new Date(currentYear, now.getMonth(), now.getDate(), 23, 59, 59).getTime();

    // Solo el año actual (enero → hoy). Las que no tienen fecha legible se
    // conservan (no se pierde ninguna venta activa) y van al final de su grupo.
    const enriched = (rows || [])
        .map(r => ({ ...r, _f: resolveFechaVenta(r) }))
        .filter(r => {
            const d = r._f.date;
            if (!d) return true;
            return d.getFullYear() === currentYear && d.getTime() <= endOfToday;
        });

    if (enriched.length === 0) {
        AppSwal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay ventas en estado ACTIVADO para descargar.' });
        return;
    }

    try {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();

        // Agrupar por supervisor.
        const groups = new Map<string, any[]>();
        for (const r of enriched) {
            const sup = (r.supervisor || '').trim() || 'SIN SUPERVISOR';
            if (!groups.has(sup)) groups.set(sup, []);
            groups.get(sup)!.push(r);
        }
        const supNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, 'es'));

        const COLS = [
            { header: 'N°', key: 'n', width: 6 },
            { header: 'EJECUTIVO', key: 'ejecutivo', width: 24 },
            { header: 'FECHA', key: 'fecha', width: 12 },
            { header: 'ESTADO', key: 'estado', width: 14 },
            { header: 'RUC', key: 'ruc', width: 14 },
            { header: 'RAZÓN SOCIAL', key: 'razonSocial', width: 32 },
            { header: 'SEGMENTO', key: 'segmento', width: 12 },
            { header: 'LÍNEAS', key: 'lineas', width: 9 },
            { header: 'CARGO FIJO', key: 'cargoFijo', width: 13 },
            { header: 'N° ORDEN', key: 'numOrden', width: 14 },
            { header: 'DEPARTAMENTO', key: 'departamento', width: 16 },
            { header: 'PROVINCIA', key: 'provincia', width: 14 },
            { header: 'DISTRITO', key: 'distrito', width: 14 },
            { header: 'CONTACTO', key: 'contacto', width: 22 },
            { header: 'TELÉFONO', key: 'telefono', width: 14 },
            { header: 'OPERADOR', key: 'operador', width: 14 },
            { header: 'ID', key: 'id', width: 8 },
        ];

        // Hoja resumen.
        const resumen = workbook.addWorksheet('RESUMEN');
        resumen.columns = [
            { header: 'SUPERVISOR', key: 'sup', width: 30 },
            { header: 'EJECUTIVOS', key: 'ejes', width: 14 },
            { header: 'VENTAS ACTIVAS', key: 'ventas', width: 16 },
            { header: 'CARGO FIJO TOTAL', key: 'cf', width: 18 },
        ];
        styleVentasHeader(resumen.getRow(1));

        const usedNames = new Set<string>(['resumen']);
        let totalVentas = 0;
        let totalCf = 0;

        for (const sup of supNames) {
            const list = groups.get(sup)!;
            // Ordenar por ejecutivo y luego por fecha ascendente (sin fecha al final).
            list.sort((a, b) => {
                const ea = (a.ejecutivo || '').toUpperCase();
                const eb = (b.ejecutivo || '').toUpperCase();
                if (ea !== eb) return ea.localeCompare(eb, 'es');
                const da = a._f.date ? a._f.date.getTime() : Infinity;
                const db = b._f.date ? b._f.date.getTime() : Infinity;
                return da - db;
            });

            const ws = workbook.addWorksheet(safeSheetName(sup, usedNames));
            ws.columns = COLS;
            styleVentasHeader(ws.getRow(1));

            const ejes = new Set<string>();
            let cfSheet = 0;
            list.forEach((r, idx) => {
                const cf = parseFloat(String(r.cargoFijo ?? '').replace(/,/g, '')) || 0;
                cfSheet += cf;
                if ((r.ejecutivo || '').trim()) ejes.add((r.ejecutivo || '').trim().toUpperCase());
                ws.addRow({
                    n: idx + 1,
                    ejecutivo: r.ejecutivo || '',
                    fecha: r._f.display,
                    estado: r.estado || '',
                    ruc: r.ruc || '',
                    razonSocial: r.razonSocial || '',
                    segmento: r.segmento || '',
                    lineas: r.lineas || '',
                    cargoFijo: cf,
                    numOrden: r.numOrden || '',
                    departamento: r.departamento || '',
                    provincia: r.provincia || '',
                    distrito: r.distrito || '',
                    contacto: r.contacto || '',
                    telefono: r.telefono || '',
                    operador: r.operador || '',
                    id: r.id || '',
                });
            });

            resumen.addRow({ sup, ejes: ejes.size, ventas: list.length, cf: cfSheet });
            totalVentas += list.length;
            totalCf += cfSheet;
        }

        const totalRow = resumen.addRow({ sup: 'TOTAL', ejes: '', ventas: totalVentas, cf: totalCf });
        totalRow.font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `Ventas_Activas_${currentYear}_al_${dd}-${mm}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting ventas activas:', error);
        AppSwal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el archivo Excel.' });
    }
}

/* --------------------------------------------------------------------------
 * Hoja EJECUTIVOS-STANDARD: comparativa mensual de LÍNEAS por ejecutivo
 * (matriz ejecutivo × mes). Las columnas de mes son dinámicas, según la
 * ventana devuelta por getVentasStandardMensual().
 * ----------------------------------------------------------------------- */

export async function exportEjecutivosStandardMensual(
    data: { ejecutivo: string; valores: number[]; total: number }[],
    columnas: { label: string }[],
) {
    if (!data || data.length === 0) {
        AppSwal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay ventas ACTIVADO de ejecutivos STANDAR en el periodo seleccionado.' });
        return;
    }

    try {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('EJECUTIVOS-STANDARD');

        const cols: { header: string; key: string; width: number }[] = [
            { header: 'EJECUTIVO', key: 'ejecutivo', width: 30 },
        ];
        columnas.forEach((c, i) => cols.push({ header: c.label, key: `m${i}`, width: 14 }));
        cols.push({ header: 'TOTAL', key: 'total', width: 12 });
        ws.columns = cols;
        styleVentasHeader(ws.getRow(1));

        const monthTotals = new Array(columnas.length).fill(0);
        let grandTotal = 0;

        data.forEach(e => {
            const row: any = { ejecutivo: e.ejecutivo };
            let rowTotal = 0;
            columnas.forEach((_, i) => {
                const v = Number(e.valores?.[i] || 0);
                row[`m${i}`] = v;
                monthTotals[i] += v;
                rowTotal += v;
            });
            row.total = rowTotal;
            grandTotal += rowTotal;
            ws.addRow(row);
        });

        const totalObj: any = { ejecutivo: 'TOTAL' };
        columnas.forEach((_, i) => { totalObj[`m${i}`] = monthTotals[i]; });
        totalObj.total = grandTotal;
        const totalRow = ws.addRow(totalObj);
        totalRow.font = { bold: true };

        ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const periodo = columnas.length
            ? `${columnas[0].label}_a_${columnas[columnas.length - 1].label}`.replace(/\s+/g, '-')
            : 'periodo';
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `Ejecutivos_Standard_Lineas_${periodo}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting ejecutivos standard:', error);
        AppSwal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el archivo Excel.' });
    }
}
