/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project, BgPresetId } from '../types';
import { Plus, Trash2, Copy, FolderOpen, Calendar, Music, Sparkles, Check } from 'lucide-react';

interface ProjectListViewProps {
  projects: Array<Project>;
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onCloneProject: (id: string) => void;
  onCreateNewProject: (name: string) => void;
  onUpdateActiveProjectName: (name: string) => void;
  activeProjectName: string;
}

export default function ProjectListView({
  projects,
  activeProjectId,
  onSelectProject,
  onDeleteProject,
  onCloneProject,
  onCreateNewProject,
  onUpdateActiveProjectName,
  activeProjectName,
}: ProjectListViewProps) {
  const [newProjectName, setNewProjectName] = useState('');
  const [editActiveName, setEditActiveName] = useState(activeProjectName);
  const [isRenaming, setIsRenaming] = useState(false);

  const getBgPresetEmoji = (id: BgPresetId) => {
    switch (id) {
      case 'festival': return '🪩';
      case 'field': return '☀️';
      case 'space': return '🪐';
      case 'city': return '🌆';
      case 'room': return '🛋️';
      default: return '🌌';
    }
  };

  const getBgPresetKoreanName = (id: BgPresetId) => {
    switch (id) {
      case 'festival': return '디스코 클럽 축제';
      case 'field': return '평화로운 시골 들판';
      case 'space': return '우주 공간';
      case 'city': return '레트로 야경';
      case 'room': return '아늑한 방';
      default: return '테마';
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const nameToUse = newProjectName.trim() || `새로운 댄싱 프로젝트 #${projects.length + 1}`;
    onCreateNewProject(nameToUse);
    setNewProjectName('');
  };

  const saveRename = () => {
    const trimmed = editActiveName.trim();
    if (trimmed) {
      onUpdateActiveProjectName(trimmed);
      setIsRenaming(false);
    }
  };

  return (
    <div className="space-y-6" id="projects-management-sub-view">
      
      {/* PANEL 1: EDIT CURRENT ACTIVE PROJECT TITLE */}
      <div className="glass rounded-2xl p-5 shadow-lg relative overflow-hidden" id="rename-current-project-panel">
        <h4 className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2.5">현재 선택된 프로젝트 정보</h4>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {isRenaming ? (
            <div className="flex flex-1 gap-2">
              <input
                type="text"
                value={editActiveName}
                onChange={(e) => setEditActiveName(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                maxLength={25}
                id="rename-project-input"
              />
              <button
                onClick={saveRename}
                className="px-4 py-2 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                id="rename-project-save"
              >
                저장
              </button>
              <button
                onClick={() => { setIsRenaming(false); setEditActiveName(activeProjectName); }}
                className="px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 cursor-pointer"
                id="rename-project-cancel"
              >
                취소
              </button>
            </div>
          ) : (
            <div className="flex justify-between items-center flex-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-lg shadow-sm">
                  📁
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">{activeProjectName}</h3>
                  <span className="text-[10px] text-gray-400">자동 클라우드 동기화 팩 활성화 상태</span>
                </div>
              </div>
              <button
                onClick={() => { setEditActiveName(activeProjectName); setIsRenaming(true); }}
                className="px-3.5 py-1.5 rounded-xl text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold transition-all cursor-pointer"
                id="rename-project-button"
              >
                이름 변경
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PANEL 2: CREATE NEW WORKSPACE */}
      <div className="glass rounded-2xl p-5 shadow-lg relative overflow-hidden" id="creation-new-project-panel">
        <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
          <span>새 프로젝트 생성</span>
          <span className="text-[9px] bg-violet-600 text-white font-mono px-2 py-0.5 rounded-md font-bold">CREATE</span>
        </h3>
        <p className="text-xs text-gray-400 mb-4">새로운 춤과 사진 설정을 담아내는 독립된 가상 댄싱 무브 프로젝트를 하나 생성합니다.</p>
        
        <form onSubmit={handleCreate} className="flex gap-2.5" id="new-project-form">
          <input
            type="text"
            placeholder="예: 7080 디스코 트래킹 무대"
            value={newProjectName}
            maxLength={25}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-violet-500 placeholder-gray-600"
            id="new-project-name-input"
          />
          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all transform active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-lg neon-glow"
            id="new-project-submit"
          >
            <Plus className="w-4 h-4" />
            <span>프로젝트 생성</span>
          </button>
        </form>
      </div>

      {/* PANEL 3: SAVED CHANNELS LIST */}
      <div className="glass rounded-2xl p-5 shadow-lg space-y-4 relative overflow-hidden" id="project-directories-list-panel">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">보관함 리스트</h3>
            <p className="text-xs text-gray-400">저장된 총 {projects.length}개의 작품을 이력별로 전환하여 불러올 수 있습니다.</p>
          </div>
          <span className="text-[10px] text-violet-400 font-bold bg-violet-600/10 px-2.5 py-1 rounded-md select-none border border-violet-500/25 uppercase tracking-widest">Storage</span>
        </div>

        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1" id="project-scrollable-container">
          {projects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            const bgText = proj.bgType === 'preset' ? getBgPresetKoreanName(proj.bgPresetId) : '내 커스텀 배경 사진';
            const bgEmoji = proj.bgType === 'preset' ? getBgPresetEmoji(proj.bgPresetId) : '🖼️';
            
            return (
              <div
                key={proj.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border transition-all duration-300 gap-3 relative ${
                  isActive
                    ? 'bg-violet-600/10 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                    : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/5'
                }`}
                id={`project-card-${proj.id}`}
              >
                {/* Visual detail badge on left click to load */}
                <div 
                  onClick={() => onSelectProject(proj.id)}
                  className="flex items-center gap-3.5 flex-1 cursor-pointer select-none py-1 w-full"
                  id={`project-click-area-${proj.id}`}
                >
                  <div className="relative w-12 h-12 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center bg-black/40 shadow-inner shrink-0">
                    {proj.faceImage ? (
                      <img src={proj.faceImage} alt="proj face thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">🕺</span>
                    )}
                    <div className="absolute top-0 right-0 bg-white/5 border-l border-b border-white/10 text-[10px] w-4 h-4 rounded-bl-lg flex items-center justify-center">
                      {bgEmoji}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white truncate">{proj.name}</span>
                      {isActive && (
                        <span className="flex items-center gap-0.5 text-[8.5px] font-mono bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-md uppercase">
                          <Check className="w-2.5 h-2.5" />
                          <span>선택됨</span>
                        </span>
                      )}
                    </div>
                    
                    {/* Attributes tags list */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[10px] text-gray-400 font-medium font-mono">
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-3 h-3 text-violet-400" />
                        <span>{proj.createdAt}</span>
                      </span>
                      <span>•</span>
                      <span>동작: {proj.danceMoveType === 'all' ? '전체무브' : proj.danceMoveType === 'wave' ? '웨이브' : proj.danceMoveType === 'spin' ? '스핀점프' : proj.danceMoveType === 'disco' ? '디스코' : proj.danceMoveType === 'slide' ? '글라이딩' : '클래핑'}</span>
                      <span>•</span>
                      <span>{bgText}</span>
                    </div>

                    {proj.speechText && (
                      <div className="text-[10px] text-violet-300 mt-1 bg-violet-600/10 px-2 py-0.5 rounded border border-violet-500/20 inline-block font-semibold">
                        말풍선: "{proj.speechText}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive tools row on right */}
                <div className="flex items-center gap-1 sm:self-center w-full sm:w-auto justify-end border-t border-white/5 sm:border-t-0 pt-2.5 sm:pt-0" id={`project-actions-${proj.id}`}>
                  {/* Copy Project button */}
                  <button
                    onClick={() => onCloneProject(proj.id)}
                    title="프로젝트 복제하기"
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-all cursor-pointer"
                    id={`project-clone-${proj.id}`}
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Load project folder button */}
                  <button
                    onClick={() => onSelectProject(proj.id)}
                    title="불러오기"
                    className="p-2 rounded-lg bg-violet-600/20 hover:bg-violet-600 border border-violet-500/20 text-white transition-all cursor-pointer"
                    id={`project-load-${proj.id}`}
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>

                  {/* Trash project delete button (protect active or single left) */}
                  <button
                    onClick={() => onDeleteProject(proj.id)}
                    title="프로젝트 영구 삭제"
                    disabled={projects.length <= 1}
                    className="p-2 rounded-lg bg-white/5 hover:bg-red-950/80 hover:text-red-400 border border-white/5 hover:border-red-900/30 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    id={`project-delete-${proj.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}
