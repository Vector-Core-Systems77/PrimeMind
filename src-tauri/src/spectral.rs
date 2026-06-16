// spectral.rs — قلب محرك الاستدلال الطيفي لـ PrimeMind
// المؤثر: Ĥ = Σ γₙ|n⟩⟨n| + g Σ (log p)/p^(½+iγ̂) |p⟩⟨γ̂| + h.c.

// ─── ثوابت وأنواع ────────────────────────────────────────────────────────────

/// ثابت الاقتران الافتراضي g = ħc/L_p ≈ 10⁻⁶
pub const DEFAULT_G: f64 = 1e-6;

/// أول 30 صفر لدالة زيتا ريمان (الأجزاء التخيلية)
pub const ZETA_ZEROS_DEFAULT: [f64; 30] = [
    14.134725, 21.022040, 25.010858, 30.424876, 32.935062,
    37.586178, 40.918719, 43.327073, 48.005151, 49.773832,
    52.970321, 56.446248, 59.347044, 60.831779, 65.112544,
    67.079811, 69.546402, 72.067158, 75.704691, 77.144840,
    79.337375, 82.910380, 84.735493, 87.425275, 88.809111,
    92.491899, 94.651344, 95.870634, 98.831194, 101.317851,
];

/// قاموس الحروف ↔ الأعداد الأولية (ثابت)
/// a=2, b=3, c=5, ... z=101, space=103, .=107, ,=109, ?=113, !=127
const CHAR_PRIME_MAP: &[(char, u64)] = &[
    ('a', 2),   ('b', 3),   ('c', 5),   ('d', 7),   ('e', 11),
    ('f', 13),  ('g', 17),  ('h', 19),  ('i', 23),  ('j', 29),
    ('k', 31),  ('l', 37),  ('m', 41),  ('n', 43),  ('o', 47),
    ('p', 53),  ('q', 59),  ('r', 61),  ('s', 67),  ('t', 71),
    ('u', 73),  ('v', 79),  ('w', 83),  ('x', 89),  ('y', 97),
    ('z', 101), (' ', 103), ('.', 107), (',', 109), ('?', 113),
    ('!', 127),
];

// ─── غربال إراتوستينس ────────────────────────────────────────────────────────

/// يولّد جميع الأعداد الأولية حتى الحد المعطى باستخدام غربال إراتوستينس
pub fn generate_primes(limit: usize) -> Vec<u64> {
    if limit < 2 {
        return vec![];
    }
    let mut is_prime = vec![true; limit + 1];
    is_prime[0] = false;
    is_prime[1] = false;

    let mut i = 2usize;
    while i * i <= limit {
        if is_prime[i] {
            let mut j = i * i;
            while j <= limit {
                is_prime[j] = false;
                j += i;
            }
        }
        i += 1;
    }

    (2..=limit)
        .filter(|&n| is_prime[n])
        .map(|n| n as u64)
        .collect()
}

// ─── قاموس حرف ↔ عدد أولي ───────────────────────────────────────────────────

/// يحوّل حرفاً إلى عدد أولي مقابله (حساس للحالة الصغيرة)
pub fn char_to_prime(c: char) -> Option<u64> {
    let lower = c.to_ascii_lowercase();
    CHAR_PRIME_MAP
        .iter()
        .find(|(ch, _)| *ch == lower)
        .map(|(_, p)| *p)
}

/// يحوّل عدداً أولياً إلى الحرف المقابل له
pub fn prime_to_char(p: u64) -> Option<char> {
    CHAR_PRIME_MAP
        .iter()
        .find(|(_, prime)| *prime == p)
        .map(|(ch, _)| *ch)
}

// ─── حسابات طيفية ────────────────────────────────────────────────────────────

/// يحسب عنصر التفاعل الطيفي المركب:
/// V(p, γ) = g * log(p) / p^(0.5 + i*γ)
/// = g * log(p) * p^(-0.5) * (cos(γ·log p) - i·sin(γ·log p))
/// يُعيد (الجزء الحقيقي، الجزء التخيلي)
#[allow(dead_code)]
pub fn spectral_element(p: u64, gamma: f64, g: f64) -> (f64, f64) {
    let lnp = (p as f64).ln();
    let amplitude = g * lnp * (p as f64).powf(-0.5);
    let phase = gamma * lnp;

    let re = amplitude * phase.cos();
    // بعد الجمع مع h.c.، الجزء التخيلي يلغي نفسه
    (2.0 * re, 0.0)
}

/// يحسب قوة الرنين لعدد أولي عبر جميع أصفار زيتا:
/// الرنين = متوسط |V(p, γₙ)| على كل الأصفار
pub fn resonance(p: u64, gamma_list: &[f64], g: f64) -> f64 {
    if gamma_list.is_empty() {
        return 0.0;
    }
    let lnp = (p as f64).ln();
    let amplitude = g * lnp * (p as f64).powf(-0.5);

    let total: f64 = gamma_list
        .iter()
        .map(|&gamma| {
            let phase = gamma * lnp;
            let re = amplitude * phase.cos();
            let im = -amplitude * phase.sin();
            (re * re + im * im).sqrt()
        })
        .sum();

    total / gamma_list.len() as f64
}

// ─── المسار الكامل ────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};

/// نتيجة مسار الاستدلال الطيفي الكامل
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpectralResult {
    /// النص الأصلي المُدخل
    pub input_text: String,
    /// الأعداد الأولية المقابلة للحروف
    pub input_primes: Vec<u64>,
    /// قوة الرنين لكل عدد أولي (عبر كل الأصفار)
    pub resonance_strengths: Vec<f64>,
    /// أعداد أولية اجتازت عتبة الرنين
    pub inferred_primes: Vec<u64>,
    /// النص الناتج بعد التحويل العكسي
    pub output_text: String,
    /// عدد أصفار زيتا المستخدمة
    pub zeros_used: usize,
    /// قيمة g المستخدمة
    pub g_used: f64,
    /// أعلى قيمة رنين في هذا التحليل
    pub max_resonance: f64,
}

/// المسار الكامل: نص → أعداد أولية → رنين → استنتاج → نص
///
/// الخطوات:
/// 1. حوّل كل حرف في النص إلى عدده الأولي
/// 2. احسب قوة الرنين لكل عدد أولي عبر جميع أصفار زيتا
/// 3. اجمع الأعداد الأولية التي تجاوزت العتبة (threshold)
/// 4. حوّل الأعداد المستنتجة إلى نص
pub fn spectral_pipeline(
    text: &str,
    gamma_list: &[f64],
    g: f64,
) -> SpectralResult {
    // ── الخطوة 1: نص → أعداد أولية ─────────────────────────────────────────
    let input_primes: Vec<u64> = text
        .chars()
        .filter_map(char_to_prime)
        .collect();

    if input_primes.is_empty() {
        return SpectralResult {
            input_text: text.to_string(),
            input_primes: vec![],
            resonance_strengths: vec![],
            inferred_primes: vec![],
            output_text: String::new(),
            zeros_used: gamma_list.len(),
            g_used: g,
            max_resonance: 0.0,
        };
    }

    // ── الخطوة 2: حساب قوة الرنين لكل عدد أولي ─────────────────────────────
    let resonance_strengths: Vec<f64> = input_primes
        .iter()
        .map(|&p| resonance(p, gamma_list, g))
        .collect();

    // ── الخطوة 3: تحديد العتبة والاستنتاج ──────────────────────────────────
    let mean_resonance = if resonance_strengths.is_empty() {
        0.0
    } else {
        resonance_strengths.iter().sum::<f64>() / resonance_strengths.len() as f64
    };

    let max_resonance = resonance_strengths
        .iter()
        .cloned()
        .fold(f64::NEG_INFINITY, f64::max);

    let inferred_primes: Vec<u64> = input_primes
        .iter()
        .zip(resonance_strengths.iter())
        .filter(|(_, &r)| r >= mean_resonance)
        .map(|(&p, _)| p)
        .collect();

    // ── الخطوة 4: أعداد أولية → نص ─────────────────────────────────────────
    let output_text: String = inferred_primes
        .iter()
        .filter_map(|&p| prime_to_char(p))
        .collect();

    SpectralResult {
        input_text: text.to_string(),
        input_primes,
        resonance_strengths,
        inferred_primes,
        output_text,
        zeros_used: gamma_list.len(),
        g_used: g,
        max_resonance,
    }
}

// ─── دوال التوسع ─────────────────────────────────────────────────────────────

/// يُضيف أصفاراً جديدة إلى قائمة موجودة (يتجنب التكرار)
pub fn expand_zeros(current: &mut Vec<f64>, new_zeros: Vec<f64>) {
    for z in new_zeros {
        if !current.iter().any(|&existing| (existing - z).abs() < 0.001) {
            current.push(z);
        }
    }
    current.sort_by(|a, b| a.partial_cmp(b).unwrap());
}

/// يوسّع قاعدة الأعداد الأولية بزيادة الحد الأعلى
pub fn expand_primes(new_limit: usize) -> Vec<u64> {
    generate_primes(new_limit)
}

// ─── اختبارات ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_primes_basic() {
        let primes = generate_primes(30);
        assert_eq!(primes, vec![2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
    }

    #[test]
    fn test_generate_primes_empty() {
        let primes = generate_primes(1);
        assert!(primes.is_empty());
    }

    #[test]
    fn test_char_to_prime() {
        assert_eq!(char_to_prime('a'), Some(2));
        assert_eq!(char_to_prime('e'), Some(11));
        assert_eq!(char_to_prime('z'), Some(101));
        assert_eq!(char_to_prime(' '), Some(103));
        assert_eq!(char_to_prime('A'), Some(2));
        assert_eq!(char_to_prime('0'), None);
    }

    #[test]
    fn test_prime_to_char() {
        assert_eq!(prime_to_char(2), Some('a'));
        assert_eq!(prime_to_char(11), Some('e'));
        assert_eq!(prime_to_char(103), Some(' '));
        assert_eq!(prime_to_char(999), None);
    }

    #[test]
    fn test_spectral_element_finite() {
        let (re, im) = spectral_element(2, 14.134725, DEFAULT_G);
        assert!(re.is_finite(), "الجزء الحقيقي يجب أن يكون منتهياً");
        assert!(im.is_finite(), "الجزء التخيلي يجب أن يكون منتهياً");
    }

    #[test]
    fn test_resonance_positive() {
        let zeros: Vec<f64> = ZETA_ZEROS_DEFAULT.to_vec();
        let r = resonance(11, &zeros, DEFAULT_G);
        assert!(r >= 0.0, "الرنين يجب أن يكون غير سالب");
        assert!(r.is_finite(), "الرنين يجب أن يكون منتهياً");
    }

    #[test]
    fn test_pipeline_hello() {
        let zeros: Vec<f64> = ZETA_ZEROS_DEFAULT.to_vec();
        let result = spectral_pipeline("hello", &zeros, DEFAULT_G);

        assert_eq!(result.input_text, "hello");
        assert_eq!(result.input_primes.len(), 5);
        assert_eq!(result.zeros_used, 30);
        assert!(!result.output_text.is_empty(), "يجب أن يكون هناك نص ناتج");
        assert!(result.max_resonance >= 0.0);
    }

    #[test]
    fn test_pipeline_empty() {
        let zeros: Vec<f64> = ZETA_ZEROS_DEFAULT.to_vec();
        let result = spectral_pipeline("", &zeros, DEFAULT_G);
        assert!(result.input_primes.is_empty());
        assert!(result.output_text.is_empty());
    }

    #[test]
    fn test_expand_zeros() {
        let mut zeros = vec![14.134725, 21.022040];
        expand_zeros(&mut zeros, vec![25.010858, 14.134725]);
        assert_eq!(zeros.len(), 3);
        assert!((zeros[2] - 25.010858).abs() < 0.001);
    }

    #[test]
    fn test_expand_primes() {
        let primes = expand_primes(50);
        assert!(primes.contains(&47));
        assert!(!primes.contains(&48));
    }
}
