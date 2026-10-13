use crate::{config, GpuSample, SnapshotCache};
use readiness::{
    GpuHistory, GPU_HISTORY_HOUR_MS, GPU_HISTORY_SOURCE, GPU_HISTORY_WINDOW_MS,
    MAX_GPU_ACTIVE_HOURS, MAX_GPU_BURSTS,
};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::PathBuf,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const HISTORY_VERSION: u32 = 3;
const HISTORY_FILE_NAME: &str = "ollama-activity.json";
const QUIET_PERIOD_MS: u64 = 60_000;
const MAX_FILE_BYTES: u64 = 64 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct History {
    version: u32,
    sampled_at_ms: u64,
    last_active_ms: Option<u64>,
    bursts: Vec<u64>,
    active_hours: Vec<u64>,
}

impl Default for History {
    fn default() -> Self {
        Self {
            version: HISTORY_VERSION,
            sampled_at_ms: 0,
            last_active_ms: None,
            bursts: Vec::new(),
            active_hours: Vec::new(),
        }
    }
}

impl History {
    fn is_valid(&self) -> bool {
        self.version == HISTORY_VERSION
            && self.bursts.len() <= MAX_GPU_BURSTS
            && self.active_hours.len() <= MAX_GPU_ACTIVE_HOURS
            && (self.sampled_at_ms > 0
                || (self.bursts.is_empty()
                    && self.active_hours.is_empty()
                    && self.last_active_ms.is_none()))
            && self.active_hours.iter().all(|hour| {
                *hour <= self.sampled_at_ms / GPU_HISTORY_HOUR_MS * GPU_HISTORY_HOUR_MS
                    && *hour % GPU_HISTORY_HOUR_MS == 0
            })
            && self.active_hours.windows(2).all(|pair| pair[0] < pair[1])
            && self
                .bursts
                .iter()
                .all(|time| *time > 0 && *time <= self.sampled_at_ms)
            && self.bursts.windows(2).all(|pair| pair[0] < pair[1])
            && self
                .last_active_ms
                .is_none_or(|time| time > 0 && time <= self.sampled_at_ms)
            && self
                .bursts
                .last()
                .is_none_or(|time| self.last_active_ms.is_some_and(|last| last >= *time))
    }

    fn observe(&mut self, now_ms: u64, active: Option<bool>) {
        // A clock rollback must not leave future timestamps or invent elapsed quiet time.
        if now_ms < self.sampled_at_ms {
            *self = Self::default();
        }
        let cutoff = now_ms.saturating_sub(GPU_HISTORY_WINDOW_MS);
        self.bursts.retain(|time| *time >= cutoff);
        let first_hour = cutoff / GPU_HISTORY_HOUR_MS * GPU_HISTORY_HOUR_MS;
        self.active_hours.retain(|hour| *hour >= first_hour);
        self.last_active_ms = self.last_active_ms.filter(|time| *time >= cutoff);
        if let Some(active) = active.filter(|_| now_ms > 0) {
            if active {
                let hour = now_ms / GPU_HISTORY_HOUR_MS * GPU_HISTORY_HOUR_MS;
                if self.active_hours.last() != Some(&hour) {
                    self.active_hours.push(hour);
                }
                if self
                    .last_active_ms
                    .is_none_or(|last| now_ms.saturating_sub(last) >= QUIET_PERIOD_MS)
                {
                    self.bursts.push(now_ms);
                }
                self.last_active_ms = Some(now_ms);
            }
            self.sampled_at_ms = now_ms;
        }
        if self.bursts.len() > MAX_GPU_BURSTS {
            self.bursts.drain(..self.bursts.len() - MAX_GPU_BURSTS);
        }
    }

    fn snapshot(&self) -> Option<GpuHistory> {
        (self.sampled_at_ms > 0).then(|| GpuHistory {
            source: GPU_HISTORY_SOURCE.into(),
            sampled_at_ms: self.sampled_at_ms,
            bursts: self.bursts.clone(),
            active_hours: self.active_hours.clone(),
        })
    }
}

struct HistoryStore {
    path: PathBuf,
}

impl HistoryStore {
    fn open(path: PathBuf) -> Option<Self> {
        let parent = path.parent()?;
        let metadata = fs::symlink_metadata(parent).ok()?;
        if !metadata.is_dir() || metadata.file_type().is_symlink() {
            return None;
        }
        // Reuse the configuration's private directory permissions before creating timestamps.
        config::secure_directory(parent).ok()?;
        Some(Self { path })
    }

    fn load(&self, now_ms: u64) -> History {
        let read = || -> Option<History> {
            let metadata = fs::symlink_metadata(&self.path).ok()?;
            if !metadata.is_file()
                || metadata.file_type().is_symlink()
                || metadata.len() > MAX_FILE_BYTES
            {
                return None;
            }
            let mut bytes = Vec::new();
            File::open(&self.path)
                .ok()?
                .take(MAX_FILE_BYTES + 1)
                .read_to_end(&mut bytes)
                .ok()?;
            if bytes.len() as u64 > MAX_FILE_BYTES {
                return None;
            }
            let mut history: History = serde_json::from_slice(&bytes).ok()?;
            if !history.is_valid() {
                return None;
            }
            // No sampling occurs while stopped. Expired entries disappear without filling gaps.
            history.observe(now_ms, None);
            Some(history)
        };
        read().unwrap_or_default()
    }

    fn save(&self, history: &History) -> io::Result<()> {
        if !history.is_valid() {
            return Err(io::Error::from(io::ErrorKind::InvalidData));
        }
        match fs::symlink_metadata(&self.path) {
            Ok(metadata) if !metadata.is_file() || metadata.file_type().is_symlink() => {
                return Err(io::Error::from(io::ErrorKind::InvalidInput));
            }
            Err(error) if error.kind() != io::ErrorKind::NotFound => return Err(error),
            _ => {}
        }
        let bytes = serde_json::to_vec(history).map_err(io::Error::other)?;
        if bytes.len() as u64 > MAX_FILE_BYTES {
            return Err(io::Error::from(io::ErrorKind::InvalidData));
        }
        let mut entropy = [0; 8];
        getrandom::fill(&mut entropy)
            .map_err(|_| io::Error::other("Could not create a private history file."))?;
        let suffix: String = entropy.iter().map(|byte| format!("{byte:02x}")).collect();
        let temporary = self
            .path
            .with_file_name(format!(".ollama-activity-{suffix}.tmp"));
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&temporary)?;
        let result = file.write_all(&bytes).and_then(|_| file.sync_all());
        drop(file);
        // Same-directory rename replaces a complete file atomically on supported host platforms.
        let result = result.and_then(|_| fs::rename(&temporary, &self.path));
        if result.is_err() {
            let _ = fs::remove_file(&temporary);
        }
        #[cfg(unix)]
        if result.is_ok() {
            if let Some(parent) = self.path.parent() {
                let _ = File::open(parent).and_then(|directory| directory.sync_all());
            }
        }
        result
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub(crate) async fn collect(cache: SnapshotCache) {
    let store = config::default_path()
        .ok()
        .and_then(|path| HistoryStore::open(path.with_file_name(HISTORY_FILE_NAME)));
    let mut history = store
        .as_ref()
        .map(|store| store.load(now_ms()))
        .unwrap_or_default();
    *cache.gpu_history.write().await = history.snapshot();
    let mut interval = tokio::time::interval(Duration::from_secs(5));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
        let measured_at = tokio::time::Instant::now();
        let metrics = readiness::gpu_metrics().await;
        let active = cache
            .inference_activity(metrics.as_ref().and_then(readiness::GpuMetrics::activity))
            .await;
        *cache.gpu_metrics.write().await = metrics.map(|metrics| GpuSample {
            measured_at,
            metrics,
        });
        let previous = history.clone();
        history.observe(now_ms(), active);
        *cache.gpu_history.write().await = history.snapshot();
        if history != previous {
            if let Some(store) = &store {
                let path = store.path.clone();
                let saved = history.clone();
                // File synchronization does not block the independent readiness loop.
                let _ =
                    tokio::task::spawn_blocking(move || HistoryStore { path }.save(&saved)).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempDirectory(PathBuf);

    impl TempDirectory {
        fn new() -> Self {
            let mut entropy = [0; 8];
            getrandom::fill(&mut entropy).unwrap();
            let suffix: String = entropy.iter().map(|byte| format!("{byte:02x}")).collect();
            let path = std::env::temp_dir().join(format!("shambu-history-test-{suffix}"));
            fs::create_dir(&path).unwrap();
            Self(path)
        }

        fn store(&self) -> HistoryStore {
            HistoryStore::open(self.0.join(HISTORY_FILE_NAME)).unwrap()
        }
    }

    impl Drop for TempDirectory {
        fn drop(&mut self) {
            if let Ok(entries) = fs::read_dir(&self.0) {
                for entry in entries.flatten() {
                    let _ = fs::remove_file(entry.path());
                }
            }
            let _ = fs::remove_dir(&self.0);
        }
    }

    #[test]
    fn short_quiet_gaps_and_hour_changes_do_not_split_a_burst() {
        let mut history = History::default();
        history.observe(3_590_000, Some(false));
        history.observe(3_595_000, Some(true));
        history.observe(3_605_000, Some(true));
        history.observe(3_610_000, Some(false));
        history.observe(3_660_000, Some(true));
        assert_eq!(history.bursts, vec![3_595_000]);
        // One continuous burst fills both hours where actual qualifying samples were observed.
        assert_eq!(history.active_hours, vec![0, 3_600_000]);
        assert_eq!(history.bursts[0] / 3_600_000, 0);
        history.observe(3_665_000, Some(false));
        history.observe(3_720_000, Some(true));
        assert_eq!(history.bursts, vec![3_595_000, 3_720_000]);
        assert_eq!(history.bursts[1] / 3_600_000, 1);
    }

    #[test]
    fn a_minute_since_last_activity_starts_one_new_burst() {
        let mut history = History::default();
        history.observe(1_000, Some(true));
        history.observe(60_999, Some(true));
        assert_eq!(history.bursts, vec![1_000]);
        history.observe(65_999, Some(false));
        history.observe(120_999, Some(true));
        history.observe(120_999, Some(true));
        assert_eq!(history.bursts, vec![1_000, 120_999]);
    }

    #[test]
    fn unavailable_samples_do_not_create_activity_or_claim_a_new_sample() {
        let mut history = History::default();
        history.observe(1_000, None);
        assert!(history.snapshot().is_none());
        history.observe(2_000, Some(true));
        history.observe(80_000, None);
        assert_eq!(history.sampled_at_ms, 2_000);
        assert_eq!(history.bursts, vec![2_000]);
        history.observe(90_000, Some(false));
        assert_eq!(history.bursts, vec![2_000]);
        history.observe(GPU_HISTORY_WINDOW_MS + 2_001, None);
        assert!(history.bursts.is_empty());
        assert_eq!(history.sampled_at_ms, 90_000);
    }

    #[test]
    fn retention_is_bounded_and_includes_the_exact_48_hour_edge() {
        let mut history = History::default();
        history.observe(1_000, Some(true));
        history.observe(GPU_HISTORY_WINDOW_MS + 1_000, Some(false));
        assert_eq!(history.bursts, vec![1_000]);
        history.observe(GPU_HISTORY_WINDOW_MS + 1_001, Some(false));
        assert!(history.bursts.is_empty());
        for time in (1..=4_000).map(|value| GPU_HISTORY_WINDOW_MS + value * QUIET_PERIOD_MS) {
            history.observe(time, Some(true));
        }
        assert!(history.bursts.len() <= MAX_GPU_BURSTS);
        assert!(history.bursts[0] >= history.sampled_at_ms - GPU_HISTORY_WINDOW_MS);
    }

    #[test]
    fn active_hours_keep_the_oldest_partial_hour_without_backfilling_gaps() {
        let mut history = History::default();
        history.observe(1_000, Some(true));
        history.observe(GPU_HISTORY_HOUR_MS * 2 + 1_000, Some(true));
        assert_eq!(history.active_hours, vec![0, GPU_HISTORY_HOUR_MS * 2]);
        history.observe(GPU_HISTORY_WINDOW_MS + 1_001, Some(false));
        assert_eq!(history.active_hours, vec![0, GPU_HISTORY_HOUR_MS * 2]);
        history.observe(GPU_HISTORY_WINDOW_MS + GPU_HISTORY_HOUR_MS, Some(false));
        assert_eq!(history.active_hours, vec![GPU_HISTORY_HOUR_MS * 2]);
        let mut continuous = History::default();
        for hour in 0..100 {
            continuous.observe(hour * GPU_HISTORY_HOUR_MS + 1_000, Some(true));
        }
        assert_eq!(continuous.active_hours.len(), MAX_GPU_ACTIVE_HOURS);
        assert_eq!(continuous.active_hours[0], 51 * GPU_HISTORY_HOUR_MS);
    }

    #[test]
    fn a_clock_rollback_discards_future_evidence_and_resumes_observation() {
        let mut history = History::default();
        history.observe(120_000, Some(true));
        history.observe(60_000, None);
        assert_eq!(history, History::default());
        history.observe(61_000, Some(true));
        assert_eq!(history.bursts, vec![61_000]);
    }

    #[test]
    fn restart_preserves_burst_continuity_and_expired_history_disappears() {
        let directory = TempDirectory::new();
        let store = directory.store();
        let mut history = History::default();
        history.observe(1_000, Some(true));
        history.observe(6_000, Some(true));
        store.save(&history).unwrap();
        let mut loaded = store.load(10_000);
        loaded.observe(11_000, Some(true));
        assert_eq!(loaded.bursts, vec![1_000]);
        store.save(&loaded).unwrap();
        let mut loaded = store.load(80_000);
        loaded.observe(81_000, Some(true));
        assert_eq!(loaded.bursts, vec![1_000, 81_000]);
        store.save(&loaded).unwrap();
        assert!(store.load(GPU_HISTORY_WINDOW_MS + 81_001).bursts.is_empty());
        assert!(store.load(500).snapshot().is_none());
        let json: serde_json::Value =
            serde_json::from_slice(&fs::read(&store.path).unwrap()).unwrap();
        let object = json.as_object().unwrap();
        assert_eq!(object.len(), 5);
        for key in [
            "version",
            "sampledAtMs",
            "lastActiveMs",
            "bursts",
            "activeHours",
        ] {
            assert!(object.contains_key(key));
        }
        assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 1);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&store.path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
    }

    #[test]
    fn corrupt_missing_oversized_and_unsupported_history_recover_without_touching_the_key() {
        let directory = TempDirectory::new();
        let config_path = directory.0.join("config.json");
        config::initialize(&config_path, "http://127.0.0.1:11434").unwrap();
        let config_before = fs::read(&config_path).unwrap();
        let store = directory.store();
        assert_eq!(store.load(100_000), History::default());
        for corrupt in [
            "not json".to_string(),
            " ".repeat(MAX_FILE_BYTES as usize + 1),
            r#"{"version":2,"sampledAtMs":10,"lastActiveMs":10,"bursts":[10],"activeHours":[0]}"#
                .into(),
            r#"{"version":3,"sampledAtMs":10,"lastActiveMs":10,"bursts":[9,8],"activeHours":[0]}"#
                .into(),
            r#"{"version":3,"sampledAtMs":10,"lastActiveMs":10,"bursts":[11],"activeHours":[0]}"#
                .into(),
            r#"{"version":3,"sampledAtMs":10,"lastActiveMs":null,"bursts":[10],"activeHours":[0]}"#
                .into(),
        ] {
            fs::write(&store.path, corrupt).unwrap();
            assert_eq!(store.load(100_000), History::default());
            let mut recovered = store.load(100_000);
            recovered.observe(100_000, Some(true));
            store.save(&recovered).unwrap();
            assert_eq!(store.load(100_000).bursts, vec![100_000]);
            assert_eq!(fs::read(&config_path).unwrap(), config_before);
        }
    }

    #[test]
    fn legacy_all_gpu_history_is_preserved_and_never_imported_as_inference() {
        let directory = TempDirectory::new();
        let legacy_path = directory.0.join("history.json");
        let legacy = br#"{"version":1,"sampledAtMs":1000,"lastActiveMs":1000,"bursts":[1000]}"#;
        fs::write(&legacy_path, legacy).unwrap();
        let store = directory.store();
        let mut history = store.load(5_000);
        assert!(history.bursts.is_empty());
        history.observe(5_000, Some(false));
        store.save(&history).unwrap();
        assert_eq!(history.snapshot().unwrap().source, GPU_HISTORY_SOURCE);
        assert_eq!(fs::read(&legacy_path).unwrap(), legacy);
        assert_eq!(store.path.file_name().unwrap(), HISTORY_FILE_NAME);
        assert!(store.load(5_000).bursts.is_empty());
    }

    #[test]
    fn excessive_entries_and_non_regular_files_are_not_accepted() {
        let directory = TempDirectory::new();
        let store = directory.store();
        let oversized = History {
            version: HISTORY_VERSION,
            sampled_at_ms: 10_000,
            last_active_ms: Some(10_000),
            bursts: (1..=MAX_GPU_BURSTS as u64 + 1).collect(),
            active_hours: vec![0],
        };
        fs::write(&store.path, serde_json::to_vec(&oversized).unwrap()).unwrap();
        assert_eq!(store.load(10_000), History::default());
        assert!(store.save(&oversized).is_err());
        fs::remove_file(&store.path).unwrap();
        fs::create_dir(&store.path).unwrap();
        assert_eq!(store.load(10_000), History::default());
        assert!(store.save(&History::default()).is_err());
        fs::remove_dir(&store.path).unwrap();
    }
}
