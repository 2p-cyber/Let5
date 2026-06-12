/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Project, BgPresetId, MusicPresetId, DanceMoveType } from '../types';
import { 
  Upload, Music, Image as ImageIcon, MessageSquare, Paintbrush, 
  HelpCircle, Eye, RefreshCw, ZoomIn, ArrowUpDown, ChevronRight, Music2
} from 'lucide-react';

interface MediaInputViewProps {
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => void;
  musicPresets: Array<{ id: MusicPresetId; title: string; category: string; bpm: number }>;
}

export default function MediaInputView({ 
  project, 
  onUpdateProject,
  musicPresets 
}: MediaInputViewProps) {
  const faceInputRef = useRef<HTMLInputElement | null>(null);
  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement | null>(null);
  
  const [facePreview, setFacePreview] = useState<string | null>(project.faceImage);
  const [bgPreview, setBgPreview] = useState<string | null>(project.bgCustomImage);

  // Ready-to-use funny face templates for immediate testing if user doesn't have a photo!
  const faceTemplates = [
    { name: '기본 졸라맨', url: '' }, // empty falls back to emoji face
    { name: '장난꾸러기', url: 'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=150&h=150&fit=crop&crop=face' },
    { name: '안경 댕댕이', url: 'https://images.unsplash.com/photo-1534361960057-19889db9621e?w=150&h=150&fit=crop&auto=format' },
    { name: '행복한 고양이', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150&h=150&fit=crop&auto=format' },
    { name: '멋쟁이 선글라스', url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=face' }
  ];

  const speechColors = [
    { name: '화이트 크림', color: '#ffffff' },
    { name: '네온 옐로우', color: '#fcf33f' },
    { name: '베이비 핑크', color: '#ffb3d9' },
    { name: '아쿠아 블루', color: '#a3f3ff' },
    { name: '애플 민트', color: '#b3ffd9' },
  ];

  // Utility to compress and resize images to Base64 to prevent storage bloating
  const handleImageUpload = (
    file: File, 
    onResult: (base64: string) => void,
    targetWidth = 300, 
    targetHeight = 300
  ) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Circular crop or nice square scale center
          const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
          const x = (targetWidth - img.width * scale) / 2;
          const y = (targetHeight - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
          onResult(compressedBase64);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const onFaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImageUpload(file, (base64) => {
      setFacePreview(base64);
      onUpdateProject({ faceImage: base64, faceScale: 1.0, faceOffsetY: 0 });
    }, 200, 200); // 200x200 is plenty for the face!
  };

  const onBgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImageUpload(file, (base64) => {
      setBgPreview(base64);
      onUpdateProject({ bgType: 'custom', bgCustomImage: base64 });
    }, 800, 600); // Higher resolution for background
  };

  const onMusicFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // We create a temporary object URL for immediate playing
    const audioUrl = URL.createObjectURL(file);
    onUpdateProject({
      musicType: 'file',
      musicFileName: file.name,
      musicFileData: audioUrl // Use object URL for current session play without hitting storage quota
    });
  };

  const selectTemplateFace = (url: string) => {
    if (!url) {
      setFacePreview(null);
      onUpdateProject({ faceImage: null });
    } else {
      setFacePreview(url);
      onUpdateProject({ faceImage: url, faceScale: 1.0, faceOffsetY: 0 });
    }
  };

  const backgroundPresets: Array<{ id: BgPresetId; name: string; desc: string; icon: string }> = [
    { id: 'festival', name: '축제 디스코장 🪩', desc: '화려한 미러볼과 춤추는 레이저 조명', icon: '✨' },
    { id: 'field', name: '평화로운 들판 🌿', desc: 'bouncing 노란 태양과 살랑이는 시골 풍경', icon: '☀️' },
    { id: 'space', name: '우주 은하수 🪐', desc: '고리 달린 토성과 반짝이는 항성 성운', icon: '🌌' },
    { id: 'city', name: '시티 레트로 야경 🏙️', desc: '사이버펑크 네온 빌딩과 퍼플 전경', icon: '🌆' },
    { id: 'room', name: '아늑한 방 벽난로 🪵', desc: '따뜻한 모닥불과 어우러지는 홈 인테리어', icon: '🛋️' },
  ];

  const danceMoves: Array<{ id: DanceMoveType; name: string; desc: string }> = [
    { id: 'all', name: '랜덤 춤바람 🔀', desc: '다채로운 정리를 섞어가며 다양하게!' },
    { id: 'wave', name: '바운스 웨이브 🌊', desc: '힙합 리듬의 부드러운 스쿼트 동작' },
    { id: 'spin', name: '공중 회전 점프 🌪️', desc: '3D 축을 따라 회전하며 솟아오르기' },
    { id: 'disco', name: '디스코 열풍 💃', desc: '손가락을 찌르며 골반을 강하게 흔들기' },
    { id: 'slide', name: '글라이드 슬라이드 ⛸️', desc: '바람을 가르듯 앞뒤로 미끄러지는 워킹' },
    { id: 'clap', name: '클랩 클랩 👏', desc: '머리 위에서 신나게 손뼉을 치며 셔플' },
  ];

  return (
    <div className="space-y-6" id="media-customization-root">
      
      {/* SECTION 1: FACE PHOTO ATTACHMENT */}
      <div className="glass rounded-2xl p-5 shadow-lg relative overflow-hidden" id="face-upload-container-section">
        <div className="flex items-center gap-2.5 mb-4 border-b border-white/10 pb-3">
          <div className="p-2 rounded-lg bg-violet-600/10 text-violet-400">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">1. 얼굴 사진 첨부 및 조절 (Face Sync)</h3>
            <p className="text-xs text-gray-400">캐릭터 머리 부분에 합성할 개인 사진을 업로드해 보세요.</p>
          </div>
        </div>

        {/* Upload Box or Current preview */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-4 flex flex-col items-center">
            <div 
              onClick={() => faceInputRef.current?.click()}
              className="relative w-32 h-32 rounded-full border-2 border-dashed border-violet-500/30 hover:border-violet-500 bg-white/5 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all duration-300 group shadow-lg"
              id="face-photo-preview-box"
            >
              {facePreview ? (
                <>
                  <img 
                    src={facePreview} 
                    alt="Face crop preview" 
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold gap-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin-slow text-violet-400" />
                    <span>재업로드</span>
                  </div>
                </>
              ) : (
                <div className="text-center p-3">
                  <Upload className="w-6 h-6 text-violet-400 mx-auto mb-1 animate-bounce" />
                  <span className="text-[11px] font-bold text-white block">사진 첨부</span>
                  <span className="text-[9px] text-gray-500 block">원하는 인물/반려동물</span>
                </div>
              )}
            </div>
            
            {/* Real Hidden File Input */}
            <input 
              ref={faceInputRef}
              type="file" 
              accept="image/*" 
              onChange={onFaceFileChange} 
              className="hidden"
              id="head-face-file-selector"
            />
          </div>

          <div className="md:col-span-8 space-y-4" id="face-dimension-adjuster-panel">
            {/* Slider controls to finely tune scale & offset */}
            <div className="space-y-4 bg-white/5 p-3.5 rounded-xl border border-white/10">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-gray-200">
                  <span className="flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5 text-violet-400" />
                    <span>얼굴 크기 조절 (Zoom Scale)</span>
                  </span>
                  <span className="text-xs font-mono text-violet-400">{(project.faceScale || 1.0).toFixed(2)}x</span>
                </div>
                <input 
                  type="range"
                  min="0.5"
                  max="1.8"
                  step="0.05"
                  value={project.faceScale || 1.0}
                  onChange={(e) => onUpdateProject({ faceScale: parseFloat(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none bg-white/15 cursor-pointer slider-thumb"
                  id="face-scale-slider"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-gray-200">
                  <span className="flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5 text-violet-400" />
                    <span>목 높이 세부 조정 (Vertical Offset)</span>
                  </span>
                  <span className="text-xs font-mono text-violet-400">{(project.faceOffsetY || 0)}px</span>
                </div>
                <input 
                  type="range"
                  min="-25"
                  max="25"
                  step="1"
                  value={project.faceOffsetY || 0}
                  onChange={(e) => onUpdateProject({ faceOffsetY: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 rounded-lg appearance-none bg-white/15 cursor-pointer slider-thumb"
                  id="face-offset-slider"
                />
              </div>
            </div>

            {/* Ready funny presets helper triggers */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-violet-400 block uppercase tracking-widest">⚡ 간편한 샘플 캐릭터 선택</span>
              <div className="flex flex-wrap gap-1.5" id="preset-funny-faces">
                {faceTemplates.map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectTemplateFace(tpl.url)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all border cursor-pointer ${
                      (tpl.url === '' && !facePreview) || (tpl.url !== '' && facePreview === tpl.url)
                        ? 'bg-violet-600 text-white border-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: DANCE TYPE CHOOSER */}
      <div className="glass rounded-2xl p-5 shadow-lg relative overflow-hidden" id="dance-type-section">
        <div className="flex items-center gap-2.5 mb-4 border-b border-white/10 pb-3">
          <div className="p-2 rounded-lg bg-violet-600/10 text-violet-400">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">2. 기본 댄스 무브 선택 (Core Dance Moves)</h3>
            <p className="text-xs text-gray-400">졸라맨이 춤출 때 연출할 메인 안무 리듬을 골라주세요.</p>
          </div>
        </div>

        {/* Dynamic moves grid layout */}
        <div className="grid grid-cols-2 gap-2.5" id="dance-moves-grid">
          {danceMoves.map((move) => (
            <button
              key={move.id}
              onClick={() => onUpdateProject({ danceMoveType: move.id })}
              className={`p-3 text-left rounded-xl transition-all border cursor-pointer flex flex-col justify-between h-20 ${
                project.danceMoveType === move.id
                  ? 'bg-gradient-to-br from-violet-600/20 to-indigo-600/10 text-white border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                  : 'bg-black/20 text-gray-400 border-white/5 hover:bg-white/5 hover:text-white hover:border-white/10'
              }`}
            >
              <span className="text-xs font-bold block">{move.name}</span>
              <span className="text-[10px] text-gray-400 leading-tight mt-1 line-clamp-2">{move.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 3: BACKGROUND CUSTOMIZER */}
      <div className="glass rounded-2xl p-5 shadow-lg relative overflow-hidden" id="bg-selection-section">
        <div className="flex items-center gap-2.5 mb-4 border-b border-white/10 pb-3">
          <div className="p-2 rounded-lg bg-violet-600/10 text-violet-400">
            <Paintbrush className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">3. 무대 배경 선택 및 커스텀 (Stage Scene)</h3>
            <p className="text-xs text-gray-400">원하는 분위기의 프리셋 테마를 고르거나 직접 모니터 배경을 합성하세요.</p>
          </div>
        </div>

        {/* Background Selector Option buttons */}
        <div className="flex gap-2 mb-4" id="bg-source-tab">
          <button
            onClick={() => onUpdateProject({ bgType: 'preset' })}
            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              project.bgType === 'preset'
                ? 'bg-violet-600 text-white border-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
            }`}
          >
            기본 테마 프리셋
          </button>
          <button
            onClick={() => onUpdateProject({ bgType: 'custom' })}
            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              project.bgType === 'custom'
                ? 'bg-violet-600 text-white border-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
            }`}
          >
            소장용 배경 입력
          </button>
        </div>

        {project.bgType === 'preset' ? (
          /* Preset Category Grid */
          <div className="grid grid-cols-1 gap-2" id="bg-presets-list">
            {backgroundPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onUpdateProject({ bgPresetId: preset.id })}
                className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  project.bgPresetId === preset.id
                    ? 'bg-gradient-to-r from-violet-600/10 to-transparent text-white border-violet-500'
                    : 'bg-black/20 text-gray-400 border-white/5 hover:bg-white/5 h-14'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{preset.icon}</span>
                  <div>
                    <span className="text-xs font-bold text-white block">{preset.name}</span>
                    <span className="text-[10px] text-gray-400 block">{preset.desc}</span>
                  </div>
                </div>
                {project.bgPresetId === preset.id && (
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                )}
              </button>
            ))}
          </div>
        ) : (
          /* Custom Photo Uploader for Stage Background */
          <div className="space-y-4" id="custom-bg-uploader-wrapper">
            <div 
              onClick={() => bgInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-violet-500 bg-white/5 rounded-xl p-6 text-center cursor-pointer transition-all duration-300 relative group overflow-hidden"
              id="bg-upload-dropzone"
            >
              {bgPreview ? (
                <div className="space-y-2">
                  <img src={bgPreview} alt="bg crop thumbnail" className="w-full max-h-36 object-contain rounded-lg mx-auto" />
                  <span className="text-[11px] font-bold text-white block">새로운 무대 이미지 교체하려면 클릭</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-violet-400 mx-auto animate-bounce" />
                  <div>
                    <span className="text-xs font-bold text-white block">나만의 무대 배경 사진 등록 (JPG, PNG)</span>
                    <span className="text-[10px] text-gray-400">콘서트장, 방 구조 등 다양한 일러스트 디자인을 업로드 하세요.</span>
                  </div>
                </div>
              )}
            </div>
            
            <input 
              ref={bgInputRef}
              type="file" 
              accept="image/*" 
              onChange={onBgFileChange} 
              className="hidden"
              id="background-custom-file"
            />
          </div>
        )}
      </div>

      {/* SECTION 4: SOUND MANAGER / PLAYER SELECTOR */}
      <div className="glass rounded-2xl p-5 shadow-lg relative overflow-hidden" id="audio-selection-section">
        <div className="flex items-center gap-2.5 mb-4 border-b border-white/10 pb-3">
          <div className="p-2 rounded-lg bg-violet-600/10 text-violet-400">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">4. 라이브 댄스 음향 비트 (Audio Beat Track)</h3>
            <p className="text-xs text-gray-400">캐릭터가 박자를 인지하고 격하게 몸 흔드는 근원적 전자 비트 트랙입니다.</p>
          </div>
        </div>

        {/* Music Source Tabs */}
        <div className="flex bg-white/5 p-1 rounded-xl mb-4 border border-white/5" id="music-sources-bar">
          {(['preset', 'link', 'file'] as const).map((source) => (
            <button
              key={source}
              onClick={() => onUpdateProject({ musicType: source })}
              className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer capitalize ${
                project.musicType === source
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {source === 'preset' ? '프리셋 신디사이저' : source === 'link' ? '웹 오디오 주소' : '로컬 MP3 음악'}
            </button>
          ))}
        </div>

        {project.musicType === 'preset' && (
          /* Preset Category Loop selector */
          <div className="space-y-2" id="music-presets-list">
            <span className="text-[10px] uppercase tracking-widest font-bold text-violet-400 block">장르별 BPM 맞춤 하드웨어 신스 칩 연주</span>
            <div className="grid grid-cols-1 gap-2">
              {musicPresets.map((track) => (
                <button
                  key={track.id}
                  onClick={() => onUpdateProject({ musicPresetId: track.id })}
                  className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    project.musicPresetId === track.id
                      ? 'bg-violet-600/20 border-violet-500 text-white font-bold'
                      : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Music2 className="w-4 h-4 text-violet-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">{track.title}</span>
                      <span className="text-[10px] text-gray-400 block">{track.category} • BPM {track.bpm}</span>
                    </div>
                  </div>
                  {project.musicPresetId === track.id && (
                    <span className="text-[10px] bg-violet-600 text-white font-mono px-2 py-0.5 rounded-md font-bold">ACTIVE</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {project.musicType === 'link' && (
          /* Streaming Url input fields */
          <div className="space-y-3" id="music-link-importer">
            <span className="text-[11px] font-bold text-gray-300 block">온라인 스트리밍 오디오 주소 (Direct Link)</span>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/dance_beat.mp3"
                value={project.musicLink}
                onChange={(e) => onUpdateProject({ musicLink: e.target.value })}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 placeholder-gray-600"
                id="music-link-url-input"
              />
            </div>
            <p className="text-[10px] text-gray-500 leading-normal">
              * 웹 서버의 CORS 헤더 허용 정책을 충족하는 직링크 주소를 입력할 경우 부드럽게 오디오 리동 파장 분석이 지원됩니다.
            </p>
          </div>
        )}

        {project.musicType === 'file' && (
          /* Local files upload */
          <div className="space-y-3" id="music-file-uploader-panel">
            <span className="text-[11px] font-bold text-gray-300 block">로컬 저장장치 음향 탑재 (.mp3, .wav)</span>
            <div 
              onClick={() => musicInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-violet-500 bg-white/5 p-5 rounded-xl text-center cursor-pointer transition-all duration-300"
              id="music-file-dropzone"
            >
              {project.musicFileName ? (
                <div className="space-y-1">
                  <Music2 className="w-7 h-7 text-violet-400 mx-auto animate-bounce" />
                  <span className="text-xs font-bold text-white block truncate max-w-xs mx-auto">{project.musicFileName}</span>
                  <span className="text-[10px] text-gray-500 block">교체하려면 영역을 다시 탭하세요</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Upload className="w-7 h-7 text-violet-400 mx-auto" />
                  <div>
                    <span className="text-xs font-bold text-white block">컴퓨터 음향 파일 업로드</span>
                    <span className="text-[10px] text-gray-400 block">전체 비트 파장이 연동되고 졸라맨이 그에 맞추어 점프합니다!</span>
                  </div>
                </div>
              )}
            </div>
            
            <input 
              ref={musicInputRef}
              type="file" 
              accept="audio/*" 
              onChange={onMusicFileChange} 
              className="hidden"
              id="audio-custom-file-selector"
            />
          </div>
        )}
      </div>

      {/* SECTION 5: SPEECH BUBBLE MANAGER */}
      <div className="glass rounded-2xl p-5 shadow-lg relative overflow-hidden" id="speech-bubble-customization-section">
        <div className="flex items-center gap-2.5 mb-4 border-b border-white/10 pb-3">
          <div className="p-2 rounded-lg bg-violet-600/10 text-violet-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">5. 텍스트 말풍선 (Message Balloon)</h3>
            <p className="text-xs text-gray-400">졸라맨 머리 옆에서 실시간으로 박자에 맞춰 흔들리는 응원 카드를 표시해 보세요.</p>
          </div>
        </div>

        <div className="space-y-4" id="speech-bubble-form">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-300 block">응원/기념 메시지 문구 입력</label>
            <input
              type="text"
              placeholder="예: 생일 축하해!, 졸라맨 격한 댄스타임!, 오늘도 파이팅!"
              maxLength={40}
              value={project.speechText}
              onChange={(e) => onUpdateProject({ speechText: e.target.value })}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 placeholder-gray-600"
              id="speech-balloon-text-box"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-gray-300 block">말풍선 배경 디자인 색 조합</span>
            <div className="flex flex-wrap gap-2" id="speech-bubble-color-palette">
              {speechColors.map((col, idx) => (
                <button
                  key={idx}
                  onClick={() => onUpdateProject({ speechColor: col.color })}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    project.speechColor === col.color
                      ? 'border-violet-500 bg-violet-600/20 text-white'
                      : 'border-white/10 bg-black/30 text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shadow" style={{ backgroundColor: col.color }} />
                  <span>{col.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
