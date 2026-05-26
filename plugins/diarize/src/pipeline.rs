//! End-to-end diarization pipeline on top of `pyannote-local`'s primitives:
//! load audio → voice-activity segmentation → per-segment ECAPA embedding →
//! online greedy cosine clustering → speaker turns with timestamps.
//!
//! Online greedy clustering is the simplest viable choice: walk segments in
//! time order, keep a running centroid per speaker, assign each new segment
//! to the closest centroid above `MERGE_THRESHOLD` (cosine), or open a new
//! speaker otherwise. Cap at `MAX_SPEAKERS`. Good enough for typical 2–5
//! person meetings; if quality matters more than simplicity we can swap
//! in spectral clustering later.

use std::fs::File;
use std::path::Path;

use rodio::{Decoder, Source};
use simsimd::SpatialSimilarity;

use meetspace_pyannote_local::{embedding::EmbeddingExtractor, segmentation::Segmenter};

use crate::error::{Error, Result};

const SAMPLE_RATE: u32 = 16_000;
/// Cosine similarity above which two segments are considered the same speaker.
/// 0.5 is conservative; tune up if we see speakers merging, down if splitting.
const MERGE_THRESHOLD: f32 = 0.5;
const MAX_SPEAKERS: usize = 10;

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SpeakerTurn {
    pub start_ms: u32,
    pub end_ms: u32,
    /// 0-based; UI typically presents these as Speaker 1, Speaker 2 …
    pub speaker_index: u32,
}

pub fn diarize_file(audio_path: impl AsRef<Path>) -> Result<Vec<SpeakerTurn>> {
    let samples = load_mono_16k(audio_path)?;
    let mut segmenter = Segmenter::new(SAMPLE_RATE)?;
    let segments = segmenter.process(&samples, SAMPLE_RATE)?;

    if segments.is_empty() {
        return Ok(Vec::new());
    }

    let mut extractor = EmbeddingExtractor::new();

    // Per-speaker accumulated centroid (sum + count for online running mean).
    let mut centroid_sums: Vec<Vec<f32>> = Vec::new();
    let mut centroid_counts: Vec<u32> = Vec::new();

    let mut turns = Vec::with_capacity(segments.len());

    for seg in &segments {
        if seg.samples.is_empty() {
            continue;
        }
        let emb = match extractor.compute(seg.samples.iter().copied()) {
            Ok(e) if !e.is_empty() => e,
            _ => continue,
        };

        // Pick the closest existing speaker (cosine similarity > threshold).
        // simsimd::cosine returns distance (0 = identical), so similarity = 1 - d.
        let mut best: Option<(usize, f32)> = None;
        for (idx, sum) in centroid_sums.iter().enumerate() {
            let count = centroid_counts[idx] as f32;
            let centroid_mean: Vec<f32> = sum.iter().map(|v| v / count).collect();
            let dist = f32::cosine(&emb, &centroid_mean).unwrap_or(1.0) as f32;
            let sim = 1.0 - dist;
            if sim > MERGE_THRESHOLD && best.map_or(true, |(_, prev)| sim > prev) {
                best = Some((idx, sim));
            }
        }

        let speaker_index = match best {
            Some((idx, _)) => {
                // Update centroid by summing the new embedding in.
                for (s, e) in centroid_sums[idx].iter_mut().zip(emb.iter()) {
                    *s += *e;
                }
                centroid_counts[idx] += 1;
                idx
            }
            None if centroid_sums.len() < MAX_SPEAKERS => {
                let idx = centroid_sums.len();
                centroid_sums.push(emb);
                centroid_counts.push(1);
                idx
            }
            // Cap hit — bucket into the closest centroid even if below threshold.
            None => {
                let mut closest = 0usize;
                let mut best_sim = f32::MIN;
                for (idx, sum) in centroid_sums.iter().enumerate() {
                    let count = centroid_counts[idx] as f32;
                    let centroid_mean: Vec<f32> = sum.iter().map(|v| v / count).collect();
                    let dist = f32::cosine(&emb, &centroid_mean).unwrap_or(1.0) as f32;
                    let sim = 1.0 - dist;
                    if sim > best_sim {
                        best_sim = sim;
                        closest = idx;
                    }
                }
                for (s, e) in centroid_sums[closest].iter_mut().zip(emb.iter()) {
                    *s += *e;
                }
                centroid_counts[closest] += 1;
                closest
            }
        };

        turns.push(SpeakerTurn {
            start_ms: (seg.start * 1000.0).max(0.0) as u32,
            end_ms: (seg.end * 1000.0).max(0.0) as u32,
            speaker_index: speaker_index as u32,
        });
    }

    Ok(merge_adjacent(turns))
}

/// Coalesce consecutive turns of the same speaker into one.
fn merge_adjacent(turns: Vec<SpeakerTurn>) -> Vec<SpeakerTurn> {
    let mut out: Vec<SpeakerTurn> = Vec::with_capacity(turns.len());
    for t in turns {
        match out.last_mut() {
            Some(prev)
                if prev.speaker_index == t.speaker_index && t.start_ms <= prev.end_ms + 250 =>
            {
                prev.end_ms = t.end_ms;
            }
            _ => out.push(t),
        }
    }
    out
}

/// Decode any rodio-supported audio file into 16 kHz mono i16. rodio 0.22's
/// decoder yields f32 samples directly; channels / sample_rate are NonZero so
/// we call `.get()` to unwrap them. Linear resampling is perceptually fine
/// for speech and an order of magnitude simpler than polyphase.
fn load_mono_16k(path: impl AsRef<Path>) -> Result<Vec<i16>> {
    let file = File::open(path.as_ref())?;
    let decoded = Decoder::try_from(file).map_err(|e| Error::Decode(e.to_string()))?;

    let source_rate = decoded.sample_rate().get();
    let source_channels = decoded.channels().get() as usize;

    let interleaved: Vec<f32> = decoded.collect();

    // Sum-mix to mono.
    let mut mono: Vec<f32> = Vec::with_capacity(interleaved.len() / source_channels.max(1));
    for frame in interleaved.chunks(source_channels) {
        let avg = frame.iter().sum::<f32>() / frame.len() as f32;
        mono.push(avg);
    }

    // Linear-resample to 16 kHz if needed.
    let resampled: Vec<f32> = if source_rate == SAMPLE_RATE {
        mono
    } else {
        let target_len = (mono.len() as u64 * SAMPLE_RATE as u64 / source_rate as u64) as usize;
        let ratio = source_rate as f64 / SAMPLE_RATE as f64;
        (0..target_len)
            .map(|i| {
                let src = (i as f64 * ratio) as usize;
                mono.get(src).copied().unwrap_or(0.0)
            })
            .collect()
    };

    Ok(resampled
        .into_iter()
        .map(|s| (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
        .collect())
}
