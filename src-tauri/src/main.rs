// main.rs — واجهة Tauri v2 لمحرك PrimeMind
// يُعرِّض دوال spectral.rs كأوامر Tauri قابلة للاستدعاء من الواجهة الأمامية

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod spectral;

use spectral::{
    expand_zeros, expand_primes, generate_primes,
    spectral_pipeline, SpectralResult,
    DEFAULT_G, ZETA_ZEROS_DEFAULT,
};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

// ─── الحالة المشتركة (State) ──────────────────────────────────────────────────

/// حالة التطبيق: أصفار زيتا النشطة وثابت الاقتران
struct AppState {
    /// قائمة أصفار زيتا الحالية (قابلة للتوسع)
    zeros: Mutex<Vec<f64>>,
    /// حد الأعداد الأولية الحالي
    prime_limit: Mutex<usize>,
}

// ─── هياكل البيانات الإضافية ──────────────────────────────────────────────────

/// معلومات حالة المحرك (للإبلاغ للواجهة)
#[derive(Debug, Serialize, Deserialize)]
struct EngineStatus {
    zeros_count: usize,
    prime_limit: usize,
    g_constant: f64,
}

// ─── أوامر Tauri ──────────────────────────────────────────────────────────────

/// تشغيل مسار الاستدلال الطيفي الكامل
/// المدخل: نص + ثابت g الاختياري
/// المخرج: SpectralResult كامل
#[tauri::command]
fn run_spectral(
    text: String,
    g: Option<f64>,
    state: State<'_, AppState>,
) -> Result<SpectralResult, String> {
    // التحقق من المدخلات
    if text.is_empty() {
        return Err("النص المُدخل فارغ".to_string());
    }
    if text.len() > 1000 {
        return Err("النص أطول من الحد المسموح (1000 حرف)".to_string());
    }

    // قراءة الحالة الحالية
    let zeros = state.zeros.lock().map_err(|e| e.to_string())?;
    let g_value = g.unwrap_or(DEFAULT_G);

    // تشغيل المسار الطيفي
    let result = spectral_pipeline(&text, &zeros, g_value);
    Ok(result)
}

/// الحصول على قائمة الأعداد الأولية حتى حد معين
#[tauri::command]
fn get_primes(limit: u32, state: State<'_, AppState>) -> Vec<u32> {
    // تحديث الحد في الحالة إذا كان أكبر
    if let Ok(mut current_limit) = state.prime_limit.lock() {
        if limit as usize > *current_limit {
            *current_limit = limit as usize;
        }
    }
    generate_primes(limit as usize)
        .into_iter()
        .map(|p| p as u32)
        .collect()
}

/// الحصول على قائمة أصفار زيتا الحالية
#[tauri::command]
fn get_zeros(state: State<'_, AppState>) -> Vec<f64> {
    state
        .zeros
        .lock()
        .map(|z| z.clone())
        .unwrap_or_else(|_| ZETA_ZEROS_DEFAULT.to_vec())
}

/// توسيع قائمة أصفار زيتا بإضافة أصفار جديدة
#[tauri::command]
fn expand_zeros_cmd(
    new_zeros: Vec<f64>,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    // التحقق من صحة الأصفار
    for &z in &new_zeros {
        if z <= 0.0 || !z.is_finite() {
            return Err(format!("صفر زيتا غير صالح: {}", z));
        }
    }

    let mut zeros = state.zeros.lock().map_err(|e| e.to_string())?;
    expand_zeros(&mut zeros, new_zeros);
    Ok(zeros.len()) // يُعيد العدد الجديد للأصفار
}

/// توسيع قاعدة الأعداد الأولية بزيادة الحد الأعلى
#[tauri::command]
fn expand_primes_cmd(
    new_limit: u32,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    if new_limit < 2 {
        return Err("الحد الأدنى للأعداد الأولية هو 2".to_string());
    }
    if new_limit > 1_000_000 {
        return Err("الحد الأعلى المسموح هو 1,000,000".to_string());
    }

    let mut current_limit = state.prime_limit.lock().map_err(|e| e.to_string())?;
    *current_limit = new_limit as usize;

    let primes = expand_primes(new_limit as usize);
    Ok(primes.len())
}

/// الحصول على حالة المحرك الحالية
#[tauri::command]
fn get_engine_status(state: State<'_, AppState>) -> EngineStatus {
    let zeros_count = state
        .zeros
        .lock()
        .map(|z| z.len())
        .unwrap_or(0);
    let prime_limit = state
        .prime_limit
        .lock()
        .map(|l| *l)
        .unwrap_or(0);

    EngineStatus {
        zeros_count,
        prime_limit,
        g_constant: DEFAULT_G,
    }
}

// ─── نقطة الدخول ─────────────────────────────────────────────────────────────

/// نقطة الدخول لنسخة الجوال (Android/iOS)
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // تهيئة الحالة الأولية بالقيم الافتراضية
    let initial_state = AppState {
        zeros: Mutex::new(ZETA_ZEROS_DEFAULT.to_vec()),
        prime_limit: Mutex::new(1000),
    };

    tauri::Builder::default()
        .manage(initial_state)
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            run_spectral,
            get_primes,
            get_zeros,
            expand_zeros_cmd,
            expand_primes_cmd,
            get_engine_status,
        ])
        .run(tauri::generate_context!())
        .expect("خطأ في تشغيل تطبيق PrimeMind");
}

fn main() {
    run();
}
