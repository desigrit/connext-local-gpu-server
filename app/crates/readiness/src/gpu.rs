use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const GPU_METRICS_MAX_AGE_MS: u64 = 15_000;

pub(crate) fn deserialize_metrics<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<GpuMetrics>, D::Error> {
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(serde_json::from_value::<GpuMetrics>(value)
        .ok()
        .filter(GpuMetrics::is_valid))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GpuReading {
    pub index: u32,
    pub load_percent: Option<u8>,
    pub memory_used_mib: Option<u64>,
    pub memory_total_mib: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GpuMetrics {
    // Relative age avoids requiring the client and GPU PC clocks to agree.
    pub sample_age_ms: u64,
    pub devices: Vec<GpuReading>,
}

impl GpuMetrics {
    pub fn is_valid(&self) -> bool {
        let mut indices = HashSet::new();
        self.sample_age_ms <= GPU_METRICS_MAX_AGE_MS
            && !self.devices.is_empty()
            && self.devices.len() <= 64
            && self.devices.iter().all(|gpu| {
                indices.insert(gpu.index)
                    && gpu.index < 1024
                    && gpu.load_percent.is_none_or(|load| load <= 100)
                    && gpu.memory_used_mib.is_none_or(|used| used <= 16_777_216)
                    && gpu
                        .memory_total_mib
                        .is_none_or(|total| total > 0 && total <= 16_777_216)
                    && gpu
                        .memory_used_mib
                        .zip(gpu.memory_total_mib)
                        .is_none_or(|(used, total)| used <= total)
            })
    }

    pub fn activity(&self) -> Option<bool> {
        if !self.is_valid() {
            return None;
        }
        if self
            .devices
            .iter()
            .any(|gpu| gpu.load_percent.is_some_and(|load| load >= 5))
        {
            Some(true)
        } else if self.devices.iter().all(|gpu| gpu.load_percent.is_some()) {
            Some(false)
        } else {
            None
        }
    }
}
