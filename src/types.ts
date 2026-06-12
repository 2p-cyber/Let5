/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BgPresetId = 'festival' | 'field' | 'space' | 'city' | 'room';

export type MusicPresetId = 'retro_synth' | 'hiphop_groove' | 'disco_fever' | 'acoustic_breeze' | 'edm_party';

export type DanceMoveType = 'all' | 'wave' | 'spin' | 'disco' | 'slide' | 'clap';

export interface MusicPreset {
  id: MusicPresetId;
  title: string;
  category: string;
  url: string; // fallback synthesised audio / standard audio
  bpm: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  // Face configuration
  faceImage: string | null; // Base64 data url
  faceScale: number;
  faceOffsetY: number;
  // Background selection
  bgType: 'preset' | 'custom';
  bgPresetId: BgPresetId;
  bgCustomImage: string | null; // Base64 data url
  // Music options
  musicType: 'preset' | 'link' | 'file';
  musicPresetId: MusicPresetId;
  musicLink: string;
  musicFileName: string | null;
  musicFileData: string | null; // Base64 or local blob reference
  // Speech bubble text
  speechText: string;
  speechColor: string;
  // Speed parameter (dancing speed)
  danceSpeed: number; // 0.2 (Slow) to 2.0 (Fast)
  danceMoveType: DanceMoveType;
  userId?: string;
}
