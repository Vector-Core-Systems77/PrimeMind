// lib.rs — مكتبة PrimeMind المطلوبة لـ Tauri على Android
// هذا الملف ضروري لأن Cargo.toml يعرّف [lib] باسم prime_mind_lib

// يُعيد تصدير الوحدات الأساسية
pub mod spectral;

// يُعيد تصدير الدوال العامة التي قد تحتاجها المكونات الأخرى
pub use spectral::{
    char_to_prime,
    expand_primes,
    expand_zeros,
    generate_primes,
    prime_to_char,
    resonance,
    spectral_element,
    spectral_pipeline,
    SpectralResult,
    DEFAULT_G,
    ZETA_ZEROS_DEFAULT,
};
