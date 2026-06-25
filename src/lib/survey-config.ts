// Definición única de la Encuesta Mensual de Percepción (RAYDERS).
// La consumen el modal (UI) y la server action (Google Sheets), de modo que
// las preguntas y las columnas de la hoja nunca se desincronizan.

export type SurveyBlock =
    | { type: 'text' | 'para'; key: string; header: string; label: string; placeholder?: string }
    | { type: 'scale'; key: string; header: string; label: string; min: number; max: number; low: string; high: string }
    | { type: 'choice'; key: string; header: string; label: string; options: string[]; other?: boolean; otherKey?: string }
    | { type: 'likert'; legend: string; items: { key: string; header: string; label: string }[] };

export interface SurveySection {
    title: string;
    subtitle: string;
    note?: string;
    blocks: SurveyBlock[];
}

export const SECTIONS: SurveySection[] = [
    {
        title: 'Información General',
        subtitle: 'Cuéntanos quién eres (puedes mantener el anonimato).',
        blocks: [
            { type: 'text', key: 'nombre', header: 'NOMBRE', label: 'Nombre', placeholder: 'Opcional — puedes dejarlo en blanco' },
            { type: 'text', key: 'sede', header: 'SEDE', label: 'Sede', placeholder: 'Ej. Lima Centro' },
            { type: 'text', key: 'supervisor', header: 'SUPERVISOR', label: 'Supervisor directo', placeholder: 'Nombre de tu supervisor' },
            { type: 'choice', key: 'campana', header: 'CAMPANA', label: 'Campaña', options: ['RUC 10', 'RUC 20'] },
            { type: 'choice', key: 'tiempoEmpresa', header: 'TIEMPO_EMPRESA', label: 'Tiempo en la empresa', other: true, otherKey: 'tiempoEmpresaOtra', options: ['Menos de 3 meses', '3 a 6 meses', '6 a 12 meses', '1 a 2 años', 'Más de 2 años', 'Otra'] },
        ],
    },
    {
        title: '¿Cómo viviste este mes?',
        subtitle: 'Tu experiencia general durante el último mes.',
        blocks: [
            { type: 'scale', key: 'calMes', header: 'CAL_MES', label: 'Calificación general del mes', min: 1, max: 5, low: 'Muy malo', high: 'Excelente' },
            { type: 'para', key: 'mejor', header: 'LO_MEJOR', label: '¿Qué fue lo mejor que te ocurrió este mes?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'complicado', header: 'LO_COMPLICADO', label: '¿Qué fue lo más complicado?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'ayudo', header: 'LO_QUE_AYUDO', label: '¿Qué fue lo que más te ayudó a lograr tus resultados?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'obstaculizo', header: 'LO_QUE_OBSTACULIZO', label: '¿Qué obstaculizó tu desempeño?', placeholder: 'Escribe con libertad…' },
        ],
    },
    {
        title: 'Mi Supervisor',
        subtitle: 'Evalúa el liderazgo de tu supervisor directo.',
        blocks: [
            { type: 'likert', legend: '1 = Deficiente · 5 = Excelente', items: [
                { key: 'sup_comunicacion', header: 'SUP_COMUNICACION', label: 'Comunicación' },
                { key: 'sup_disponibilidad', header: 'SUP_DISPONIBILIDAD', label: 'Disponibilidad' },
                { key: 'sup_apoyo', header: 'SUP_APOYO', label: 'Apoyo' },
                { key: 'sup_coaching', header: 'SUP_COACHING', label: 'Coaching' },
                { key: 'sup_retro', header: 'SUP_RETROALIMENTACION', label: 'Retroalimentación' },
                { key: 'sup_motivacion', header: 'SUP_MOTIVACION', label: 'Motivación' },
                { key: 'sup_resolucion', header: 'SUP_RESOLUCION', label: 'Resolución de problemas' },
                { key: 'sup_liderazgo', header: 'SUP_LIDERAZGO', label: 'Liderazgo' },
                { key: 'sup_respeto', header: 'SUP_RESPETO', label: 'Respeto' },
                { key: 'sup_desarrollo', header: 'SUP_DESARROLLO', label: 'Capacidad para desarrollar personas' },
            ] },
            { type: 'para', key: 'sup_bien', header: 'SUP_HACE_BIEN', label: '¿Qué hace muy bien tu supervisor?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'sup_mejorar', header: 'SUP_MEJORAR', label: '¿Qué debería mejorar?', placeholder: 'Escribe con libertad…' },
        ],
    },
    {
        title: 'Ambiente de Trabajo',
        subtitle: 'Cómo se siente el día a día con tu equipo.',
        blocks: [
            { type: 'likert', legend: '1 = Deficiente · 5 = Excelente', items: [
                { key: 'amb_respeto', header: 'AMB_RESPETO', label: 'Respeto' },
                { key: 'amb_equipo', header: 'AMB_TRABAJO_EQUIPO', label: 'Trabajo en equipo' },
                { key: 'amb_comunicacion', header: 'AMB_COMUNICACION', label: 'Comunicación' },
                { key: 'amb_companerismo', header: 'AMB_COMPANERISMO', label: 'Compañerismo' },
                { key: 'amb_integracion', header: 'AMB_INTEGRACION', label: 'Integración' },
                { key: 'amb_reconocimiento', header: 'AMB_RECONOCIMIENTO', label: 'Reconocimiento' },
                { key: 'amb_confianza', header: 'AMB_CONFIANZA', label: 'Confianza' },
                { key: 'amb_motivacion', header: 'AMB_MOTIVACION', label: 'Motivación' },
                { key: 'amb_orgullo', header: 'AMB_ORGULLO', label: 'Orgullo de pertenecer a la empresa' },
            ] },
            { type: 'text', key: 'amb_palabra', header: 'AMB_PALABRA', label: 'Describe el ambiente laboral con una sola palabra', placeholder: 'Una palabra' },
        ],
    },
    {
        title: 'Herramientas y Operación',
        subtitle: 'Lo que necesitas para hacer bien tu trabajo.',
        blocks: [
            { type: 'likert', legend: '1 = Deficiente · 5 = Excelente', items: [
                { key: 'op_crm', header: 'OP_CRM', label: 'CRM' },
                { key: 'op_bases', header: 'OP_BASES_DATOS', label: 'Bases de datos' },
                { key: 'op_procesos', header: 'OP_PROCESOS', label: 'Procesos' },
                { key: 'op_campanas', header: 'OP_CAMPANAS', label: 'Campañas' },
                { key: 'op_info', header: 'OP_INFORMACION', label: 'Información recibida' },
                { key: 'op_capacitacion', header: 'OP_CAPACITACION', label: 'Capacitación' },
                { key: 'op_apoyo', header: 'OP_APOYO_AREAS', label: 'Apoyo de otras áreas' },
                { key: 'op_tiempo', header: 'OP_TIEMPO_RESPUESTA', label: 'Tiempo de respuesta' },
                { key: 'op_tecnologia', header: 'OP_TECNOLOGIA', label: 'Tecnología' },
            ] },
            { type: 'para', key: 'op_mejorar', header: 'OP_MEJORAR', label: '¿Qué deberíamos mejorar primero?', placeholder: 'Escribe con libertad…' },
        ],
    },
    {
        title: 'Motivación',
        subtitle: 'Cómo cierras el mes a nivel personal.',
        blocks: [
            { type: 'scale', key: 'mot_nivel', header: 'MOT_NIVEL', label: '¿Cómo termina tu motivación este mes?', min: 1, max: 10, low: 'Muy baja', high: 'Muy alta' },
            { type: 'para', key: 'mot_motivo', header: 'MOT_MOTIVO', label: '¿Qué fue lo que más te motivó?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'mot_desmotivo', header: 'MOT_DESMOTIVO', label: '¿Qué fue lo que más te desmotivó?', placeholder: 'Escribe con libertad…' },
            { type: 'text', key: 'mot_incentivo', header: 'MOT_INCENTIVO', label: '¿Qué incentivo te gustaría recibir?', placeholder: 'Ej. reconocimiento, bono, día libre…' },
        ],
    },
    {
        title: 'Gerencia Comercial',
        subtitle: 'Tu percepción sobre la dirección del área.',
        blocks: [
            { type: 'likert', legend: '1 = Deficiente · 5 = Excelente', items: [
                { key: 'ger_comunicacion', header: 'GER_COMUNICACION', label: 'Comunicación' },
                { key: 'ger_direccion', header: 'GER_DIRECCION', label: 'Dirección' },
                { key: 'ger_organizacion', header: 'GER_ORGANIZACION', label: 'Organización' },
                { key: 'ger_escuchar', header: 'GER_ESCUCHAR', label: 'Capacidad de escuchar' },
                { key: 'ger_velocidad', header: 'GER_VELOCIDAD', label: 'Velocidad para resolver problemas' },
                { key: 'ger_vision', header: 'GER_VISION', label: 'Visión' },
                { key: 'ger_confianza', header: 'GER_CONFIANZA', label: 'Confianza' },
            ] },
            { type: 'para', key: 'ger_espera', header: 'GER_ESPERA', label: '¿Qué esperas de la Gerencia el próximo mes?', placeholder: 'Escribe con libertad…' },
        ],
    },
    {
        title: 'Iniciativa y Mejora',
        subtitle: 'Tu disposición a proponer y liderar cambios.',
        note: 'En Rayders creemos que las mejores soluciones nacen del propio equipo. Esta sección es para conocer tus ideas y tu disposición a hacerlas realidad.',
        blocks: [
            { type: 'scale', key: 'ini_disposicion', header: 'INI_DISPOSICION', label: 'Si tuvieras la opción de encargarte de un proyecto de solución o mejora en la empresa, ¿qué tan dispuesto estarías a liderarlo?', min: 1, max: 5, low: 'Nada dispuesto', high: 'Totalmente dispuesto' },
            { type: 'para', key: 'ini_proyecto', header: 'INI_PROYECTO', label: '¿Tienes algún proyecto o idea de mejora en mente? Cuéntanos de qué se trata.', placeholder: 'Describe tu idea con libertad…' },
            { type: 'para', key: 'ini_problema', header: 'INI_PROBLEMA', label: '¿Qué problema concreto resolvería esa idea?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'ini_necesita', header: 'INI_NECESITA', label: '¿Qué necesitarías para llevarlo a cabo (apoyo, recursos, tiempo, herramientas)?', placeholder: 'Escribe con libertad…' },
        ],
    },
    {
        title: 'La Voz del Colaborador',
        subtitle: 'El espacio más importante de esta encuesta.',
        note: 'Este espacio está pensado para que puedas expresar cualquier comentario que consideres importante y que quizá no fue abordado antes. Tu sinceridad es lo más valioso para nosotros.',
        blocks: [
            { type: 'para', key: 'voz_cambiarYa', header: 'VOZ_CAMBIAR_YA', label: '¿Qué deberíamos cambiar inmediatamente?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'voz_nuncaCambiar', header: 'VOZ_NUNCA_CAMBIAR', label: '¿Qué nunca deberíamos cambiar?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'voz_gerentePorDia', header: 'VOZ_GERENTE_POR_DIA', label: '¿Qué decisión tomarías si fueras Gerente Comercial por un día?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'voz_empezar', header: 'VOZ_EMPEZAR', label: '¿Qué te gustaría que la empresa empiece a hacer?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'voz_dejar', header: 'VOZ_DEJAR', label: '¿Qué te gustaría que la empresa deje de hacer?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'voz_confidencial', header: 'VOZ_CONFIDENCIAL', label: '¿Hay alguna situación que quieras comunicar de manera confidencial?', placeholder: 'Escribe con libertad…' },
            { type: 'para', key: 'voz_bienestar', header: 'VOZ_BIENESTAR', label: '¿Tienes alguna propuesta para mejorar el bienestar del equipo?', placeholder: 'Escribe con libertad…' },
        ],
    },
    {
        title: 'Recomendación Final',
        subtitle: 'Una última pregunta.',
        blocks: [
            { type: 'scale', key: 'nps', header: 'NPS', label: '¿Qué tan probable es que recomiendes trabajar en esta empresa a un amigo?', min: 0, max: 10, low: 'Nada probable', high: 'Muy probable' },
            { type: 'para', key: 'nps_porque', header: 'NPS_PORQUE', label: '¿Por qué elegiste esa puntuación?', placeholder: 'Escribe con libertad…' },
        ],
    },
];

// Metadatos que agrega el sistema (no son preguntas).
export const METADATA_HEADERS = ['FECHA_ENVIO', 'DNI', 'USUARIO'] as const;

export interface SurveyField {
    header: string;
    key: string;
    /** Para preguntas de opción con "Otra": clave del texto libre. */
    otherKey?: string;
}

/** Lista plana de campos de encuesta, en orden de columna. */
export function getSurveyFields(): SurveyField[] {
    const out: SurveyField[] = [];
    for (const sec of SECTIONS) {
        for (const b of sec.blocks) {
            if (b.type === 'likert') {
                for (const it of b.items) out.push({ header: it.header, key: it.key });
            } else if (b.type === 'choice' && b.other) {
                out.push({ header: b.header, key: b.key, otherKey: b.otherKey });
            } else {
                out.push({ header: b.header, key: b.key });
            }
        }
    }
    return out;
}

/** Encabezados completos de la hoja (metadatos + preguntas), en orden. */
export function getSheetHeaders(): string[] {
    return [...METADATA_HEADERS, ...getSurveyFields().map(f => f.header)];
}
