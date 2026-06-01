// Baremos dinámicos por deporte / categoría / sexo.
// Cada métrica define umbrales de semáforo:
//   green  → rendimiento óptimo (safe)
//   yellow → zona de monitoreo (warning)
//   (por debajo de yellow → danger)
//
// Unidades:
//   cmj / sj / dj        → cm
//   rsi                  → adimensional (m/s dividido por s)
//   iue                  → %
//   lsi                  → % (asimetría; más bajo = mejor)
//   sprint10 / sprint30  → s (más bajo = mejor; umbrales invertidos)
//   vo2max               → ml/kg/min
//   vam                  → km/h
//   acwr_high            → ratio (límite superior de zona óptima)
//   acwr_low             → ratio (límite inferior de zona óptima)

const DEFAULT_THRESHOLDS = {
  football: {
    senior: {
      male: {
        cmj:      { green: 40,   yellow: 30   },
        sj:       { green: 36,   yellow: 27   },
        dj:       { green: 38,   yellow: 28   },
        rsi:      { green: 2.0,  yellow: 1.5  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },  // invertido: < green = safe
        sprint10: { green: 1.75, yellow: 1.90 },  // invertido: < green = safe
        sprint30: { green: 4.10, yellow: 4.50 },  // invertido
        vo2max:   { green: 50,   yellow: 40   },
        vam:      { green: 14.0, yellow: 12.0 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
      female: {
        cmj:      { green: 30,   yellow: 22   },
        sj:       { green: 27,   yellow: 20   },
        dj:       { green: 28,   yellow: 20   },
        rsi:      { green: 1.6,  yellow: 1.2  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.90, yellow: 2.05 },
        sprint30: { green: 4.50, yellow: 4.90 },
        vo2max:   { green: 44,   yellow: 35   },
        vam:      { green: 12.5, yellow: 10.5 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
    },
    sub18: {
      male: {
        cmj:      { green: 36,   yellow: 27   },
        sj:       { green: 32,   yellow: 24   },
        dj:       { green: 34,   yellow: 25   },
        rsi:      { green: 1.8,  yellow: 1.3  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.80, yellow: 1.95 },
        sprint30: { green: 4.25, yellow: 4.65 },
        vo2max:   { green: 48,   yellow: 38   },
        vam:      { green: 13.5, yellow: 11.5 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
      female: {
        cmj:      { green: 27,   yellow: 20   },
        sj:       { green: 24,   yellow: 18   },
        dj:       { green: 25,   yellow: 18   },
        rsi:      { green: 1.4,  yellow: 1.0  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.95, yellow: 2.10 },
        sprint30: { green: 4.65, yellow: 5.05 },
        vo2max:   { green: 40,   yellow: 32   },
        vam:      { green: 11.5, yellow: 9.5  },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
    },
    sub15: {
      male: {
        cmj:      { green: 32,   yellow: 24   },
        sj:       { green: 28,   yellow: 21   },
        dj:       { green: 30,   yellow: 22   },
        rsi:      { green: 1.6,  yellow: 1.1  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.88, yellow: 2.02 },
        sprint30: { green: 4.40, yellow: 4.80 },
        vo2max:   { green: 45,   yellow: 36   },
        vam:      { green: 12.5, yellow: 10.5 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
      female: {
        cmj:      { green: 24,   yellow: 18   },
        sj:       { green: 21,   yellow: 16   },
        dj:       { green: 22,   yellow: 16   },
        rsi:      { green: 1.2,  yellow: 0.9  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 2.00, yellow: 2.15 },
        sprint30: { green: 4.80, yellow: 5.20 },
        vo2max:   { green: 38,   yellow: 30   },
        vam:      { green: 11.0, yellow: 9.0  },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
    },
  },

  rugby: {
    senior: {
      male: {
        cmj:      { green: 42,   yellow: 32   },
        sj:       { green: 38,   yellow: 28   },
        dj:       { green: 40,   yellow: 30   },
        rsi:      { green: 2.2,  yellow: 1.6  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.72, yellow: 1.87 },
        sprint30: { green: 4.05, yellow: 4.45 },
        vo2max:   { green: 52,   yellow: 42   },
        vam:      { green: 15.0, yellow: 13.0 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
      female: {
        cmj:      { green: 32,   yellow: 24   },
        sj:       { green: 28,   yellow: 21   },
        dj:       { green: 30,   yellow: 22   },
        rsi:      { green: 1.7,  yellow: 1.3  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.88, yellow: 2.03 },
        sprint30: { green: 4.45, yellow: 4.85 },
        vo2max:   { green: 46,   yellow: 37   },
        vam:      { green: 13.0, yellow: 11.0 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
    },
    sub18: {
      male: {
        cmj:      { green: 38,   yellow: 29   },
        sj:       { green: 34,   yellow: 25   },
        dj:       { green: 36,   yellow: 27   },
        rsi:      { green: 2.0,  yellow: 1.4  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.77, yellow: 1.92 },
        sprint30: { green: 4.20, yellow: 4.60 },
        vo2max:   { green: 49,   yellow: 39   },
        vam:      { green: 14.0, yellow: 12.0 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
      female: {
        cmj:      { green: 28,   yellow: 21   },
        sj:       { green: 25,   yellow: 19   },
        dj:       { green: 26,   yellow: 19   },
        rsi:      { green: 1.5,  yellow: 1.1  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.93, yellow: 2.08 },
        sprint30: { green: 4.60, yellow: 5.00 },
        vo2max:   { green: 42,   yellow: 34   },
        vam:      { green: 12.0, yellow: 10.0 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
    },
    sub15: {
      male: {
        cmj:      { green: 34,   yellow: 25   },
        sj:       { green: 30,   yellow: 22   },
        dj:       { green: 32,   yellow: 24   },
        rsi:      { green: 1.7,  yellow: 1.2  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.83, yellow: 1.98 },
        sprint30: { green: 4.35, yellow: 4.75 },
        vo2max:   { green: 46,   yellow: 37   },
        vam:      { green: 13.0, yellow: 11.0 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
      female: {
        cmj:      { green: 25,   yellow: 19   },
        sj:       { green: 22,   yellow: 17   },
        dj:       { green: 23,   yellow: 17   },
        rsi:      { green: 1.3,  yellow: 0.95 },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.98, yellow: 2.13 },
        sprint30: { green: 4.75, yellow: 5.15 },
        vo2max:   { green: 39,   yellow: 31   },
        vam:      { green: 11.0, yellow: 9.0  },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
    },
  },

  hockey: {
    senior: {
      male: {
        cmj:      { green: 38,   yellow: 29   },
        sj:       { green: 34,   yellow: 25   },
        dj:       { green: 36,   yellow: 27   },
        rsi:      { green: 2.0,  yellow: 1.5  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.77, yellow: 1.92 },
        sprint30: { green: 4.15, yellow: 4.55 },
        vo2max:   { green: 50,   yellow: 40   },
        vam:      { green: 14.0, yellow: 12.0 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
      female: {
        cmj:      { green: 30,   yellow: 22   },
        sj:       { green: 27,   yellow: 20   },
        dj:       { green: 28,   yellow: 21   },
        rsi:      { green: 1.6,  yellow: 1.2  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.90, yellow: 2.05 },
        sprint30: { green: 4.50, yellow: 4.90 },
        vo2max:   { green: 46,   yellow: 37   },
        vam:      { green: 13.0, yellow: 11.0 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
    },
    sub18: {
      male: {
        cmj:      { green: 34,   yellow: 25   },
        sj:       { green: 30,   yellow: 22   },
        dj:       { green: 32,   yellow: 24   },
        rsi:      { green: 1.8,  yellow: 1.3  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.82, yellow: 1.97 },
        sprint30: { green: 4.30, yellow: 4.70 },
        vo2max:   { green: 47,   yellow: 38   },
        vam:      { green: 13.5, yellow: 11.5 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
      female: {
        cmj:      { green: 27,   yellow: 20   },
        sj:       { green: 24,   yellow: 18   },
        dj:       { green: 25,   yellow: 19   },
        rsi:      { green: 1.4,  yellow: 1.0  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.95, yellow: 2.10 },
        sprint30: { green: 4.65, yellow: 5.05 },
        vo2max:   { green: 42,   yellow: 34   },
        vam:      { green: 12.0, yellow: 10.0 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
    },
    sub15: {
      male: {
        cmj:      { green: 30,   yellow: 22   },
        sj:       { green: 26,   yellow: 19   },
        dj:       { green: 28,   yellow: 21   },
        rsi:      { green: 1.5,  yellow: 1.1  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 1.88, yellow: 2.03 },
        sprint30: { green: 4.45, yellow: 4.85 },
        vo2max:   { green: 44,   yellow: 35   },
        vam:      { green: 12.5, yellow: 10.5 },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
      female: {
        cmj:      { green: 24,   yellow: 18   },
        sj:       { green: 21,   yellow: 16   },
        dj:       { green: 22,   yellow: 16   },
        rsi:      { green: 1.2,  yellow: 0.9  },
        iue:      { green: 15,   yellow: 10   },
        lsi:      { green: 8,    yellow: 15   },
        sprint10: { green: 2.00, yellow: 2.15 },
        sprint30: { green: 4.80, yellow: 5.20 },
        vo2max:   { green: 40,   yellow: 32   },
        vam:      { green: 11.5, yellow: 9.5  },
        acwr_high: 1.3,
        acwr_low:  0.8,
      },
    },
  },
};

/**
 * Retorna los baremos para un contexto dado.
 * Si localStorage contiene la clave "fieldlab_thresholds", los valores
 * presentes en ese objeto se fusionan sobre los defaults (override parcial).
 *
 * @param {string} sport    - 'football' | 'rugby' | 'hockey'
 * @param {string} category - 'senior' | 'sub18' | 'sub15'
 * @param {string} sex      - 'male' | 'female'
 * @returns {object} baremos fusionados
 */
export function getThresholds(sport, category, sex) {
  const base =
    DEFAULT_THRESHOLDS[sport]?.[category]?.[sex] ??
    DEFAULT_THRESHOLDS.football.senior.male;
  try {
    const override = JSON.parse(localStorage.getItem('fieldlab_thresholds') || '{}');
    return { ...base, ...override };
  } catch {
    return base;
  }
}

export default DEFAULT_THRESHOLDS;
