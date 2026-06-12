/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Project, BgPresetId, MusicPresetId, DanceMoveType } from './types';
import DanceView from './components/DanceView';
import MediaInputView from './components/MediaInputView';
import ProjectListView from './components/ProjectListView';
import { Volume2, VolumeX, FolderHeart, Music, Sliders, CheckCircle, Smartphone, Info, Cloud, CloudOff, LogIn, LogOut, Loader2 } from 'lucide-react';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logoutUser, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, set, remove, onValue } from 'firebase/database';

const MUSIC_PRESETS = [
  { id: 'retro_synth' as MusicPresetId, title: '레트로 신스 비트 (Synthwave Loop)', category: 'Electronic Retro', bpm: 122 },
  { id: 'hiphop_groove' as MusicPresetId, title: '딥 힙합 그루브 (808 Bounce)', category: 'Hip-hop / Trap', bpm: 92 },
  { id: 'disco_fever' as MusicPresetId, title: '디스코 피버 (Funky 70s)', category: 'Disco / Funk', bpm: 128 },
  { id: 'acoustic_breeze' as MusicPresetId, title: '어쿠스틱 브리즈 (Snappy Pluck)', category: 'Acoustic Pop', bpm: 86 },
  { id: 'edm_party' as MusicPresetId, title: 'EDM 일렉트로 파티 (Rising Banger)', category: 'EDM / Dance', bpm: 140 },
];

export default function App() {
  const [projects, setProjects] = useState<Array<Project>>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'media' | 'projects'>('media');
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [beatFactor, setBeatFactor] = useState<number>(0); // dynamic pulse 0 to 1
  const [synthVolume, setSynthVolume] = useState<number>(0.6); // synthesizer volume

  const audioContextRef = useRef<AudioContext | null>(null);
  const synthIntervalRef = useRef<any>(null);
  const currentStepRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Custom Audio Element (or fallback synth)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const beatDecayRef = useRef<number>(0);

  // Firebase Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Track Auth and Sync State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Reactive Firebase Sync Engine
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      // Connect to Realtime Database endpoint for user's projects
      const projectsRef = ref(db, `projects/${user.uid}`);

      const unsubscribe = onValue(projectsRef, async (snapshot) => {
        const fetchedProjects: Array<Project> = [];
        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const val = childSnapshot.val();
            fetchedProjects.push({ id: childSnapshot.key, ...val } as Project);
          });
        }

        if (fetchedProjects.length === 0) {
          // If Realtime Database is empty, migrate existing local storage projects to RTDB
          const saved = localStorage.getItem('stickman_dance_projects_v2');
          if (saved) {
            try {
              const parsed = JSON.parse(saved) as Array<Project>;
              for (const p of parsed) {
                const docRef = ref(db, `projects/${user.uid}/${p.id}`);
                await set(docRef, { ...p, userId: user.uid });
              }
            } catch (err) {
              console.error('Failed to migrate local projects to RTDB', err);
            }
          } else {
            // Seed defaults directly in Realtime Database
            const seedId = 'default_seed_project_id';
            const defaultProject: Project = {
              id: seedId,
              name: '나의 첫 번째 댄싱 졸라맨 🕺',
              createdAt: new Date().toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              faceImage: null,
              faceScale: 1.0,
              faceOffsetY: 0,
              bgType: 'preset',
              bgPresetId: 'festival',
              bgCustomImage: null,
              musicType: 'preset',
              musicPresetId: 'retro_synth',
              musicLink: '',
              musicFileName: null,
              musicFileData: null,
              speechText: '생일 축하해! 신나게 춤춰보자!!! 🎉',
              speechColor: '#fcf33f',
              danceSpeed: 1.0,
              danceMoveType: 'all',
              userId: user.uid,
            };
            try {
              await set(ref(db, `projects/${user.uid}/${seedId}`), defaultProject);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `projects/${user.uid}/${seedId}`);
            }
          }
        } else {
          setProjects(fetchedProjects);
          if (!activeProjectId || !fetchedProjects.some((p) => p.id === activeProjectId)) {
            setActiveProjectId(fetchedProjects[0].id);
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `projects/${user.uid}`);
      });

      return () => unsubscribe();
    } else {
      // Fallback local storage for sandbox offline use
      const saved = localStorage.getItem('stickman_dance_projects_v2');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Array<Project>;
          if (parsed.length > 0) {
            setProjects(parsed);
            if (!activeProjectId || !parsed.some((p) => p.id === activeProjectId)) {
              setActiveProjectId(parsed[0].id);
            }
            return;
          }
        } catch (e) {
          console.error('Error loading projects from localStorage', e);
        }
      }

      const defaultProject: Project = {
        id: 'default_seed_project_id',
        name: '나의 첫 번째 댄싱 졸라맨 🕺',
        createdAt: new Date().toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        faceImage: null,
        faceScale: 1.0,
        faceOffsetY: 0,
        bgType: 'preset',
        bgPresetId: 'festival',
        bgCustomImage: null,
        musicType: 'preset',
        musicPresetId: 'retro_synth',
        musicLink: '',
        musicFileName: null,
        musicFileData: null,
        speechText: '생일 축하해! 신나게 춤춰보자!!! 🎉',
        speechColor: '#fcf33f',
        danceSpeed: 1.0,
        danceMoveType: 'all',
      };

      const initialList = [defaultProject];
      setProjects(initialList);
      setActiveProjectId(defaultProject.id);
      localStorage.setItem('stickman_dance_projects_v2', JSON.stringify(initialList));
    }
  }, [user, authLoading]);

  // Sync projects locally if offline
  const saveProjectsToStorage = async (updatedList: Array<Project>) => {
    setProjects(updatedList);
    if (!user) {
      localStorage.setItem('stickman_dance_projects_v2', JSON.stringify(updatedList));
    }
  };

  // Get active project helper
  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Update active project helpers
  const handleUpdateActiveProject = async (updates: Partial<Project>) => {
    if (!activeProjectId) return;
    const newList = projects.map((proj) => {
      if (proj.id === activeProjectId) {
        return { ...proj, ...updates };
      }
      return proj;
    });
    
    await saveProjectsToStorage(newList);

    if (user) {
      const activeProj = newList.find((p) => p.id === activeProjectId);
      if (activeProj) {
        try {
          await set(ref(db, `projects/${user.uid}/${activeProjectId}`), {
            ...activeProj,
            userId: user.uid
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `projects/${user.uid}/${activeProjectId}`);
        }
      }
    }
  };

  // Create workspace project
  const handleCreateNewProject = async (name: string) => {
    const freshId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const freshProject: Project = {
      id: freshId,
      name: name,
      createdAt: new Date().toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      faceImage: null,
      faceScale: 1.0,
      faceOffsetY: 0,
      bgType: 'preset',
      bgPresetId: 'festival',
      bgCustomImage: null,
      musicType: 'preset',
      musicPresetId: 'retro_synth',
      musicLink: '',
      musicFileName: null,
      musicFileData: null,
      speechText: '신나는 졸라맨 타임! 🤩',
      speechColor: '#ffffff',
      danceSpeed: 1.0,
      danceMoveType: 'all',
    };

    if (user) {
      freshProject.userId = user.uid;
      try {
        await set(ref(db, `projects/${user.uid}/${freshId}`), freshProject);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `projects/${user.uid}/${freshId}`);
      }
    } else {
      const newList = [freshProject, ...projects];
      await saveProjectsToStorage(newList);
    }
    
    setActiveProjectId(freshId);
    // Switch to settings/inputs tab right after creating
    setActiveTab('media');
    
    // Stop dancing if playing to switch context
    stopAudio();
  };

  // Delete project
  const handleDeleteProject = async (id: string) => {
    if (projects.length <= 1) return;
    const filtered = projects.filter((p) => p.id !== id);
    
    if (user) {
      try {
        await remove(ref(db, `projects/${user.uid}/${id}`));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `projects/${user.uid}/${id}`);
      }
    } else {
      await saveProjectsToStorage(filtered);
    }
    
    if (activeProjectId === id) {
      setActiveProjectId(filtered[0].id);
      stopAudio();
    }
  };

  // Clone project
  const handleCloneProject = async (id: string) => {
    const toClone = projects.find((p) => p.id === id);
    if (!toClone) return;

    const clonedId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cloned: Project = {
      ...toClone,
      id: clonedId,
      name: `${toClone.name} (사본)`,
      createdAt: new Date().toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };

    if (user) {
      cloned.userId = user.uid;
      try {
        await set(ref(db, `projects/${user.uid}/${clonedId}`), cloned);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `projects/${user.uid}/${clonedId}`);
      }
    } else {
      const newList = [cloned, ...projects];
      await saveProjectsToStorage(newList);
    }
    
    setActiveProjectId(clonedId);
  };

  // Rename current active project name
  const handleUpdateActiveProjectName = (newName: string) => {
    handleUpdateActiveProject({ name: newName });
  };

  // AUDIO ENGINE CONTROLLERS
  // Triggered when clicking Play/Pause inside DanceView
  const handleTogglePlay = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  const startAudio = () => {
    if (!activeProject) return;

    // Check/Instantiate AudioContext
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const audioCtx = audioContextRef.current;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    setIsPlaying(true);

    if (activeProject.musicType === 'preset') {
      // PLAY SYNTHESIZED PROCEDURAL COMPUTER BEAT
      const presetTrack = MUSIC_PRESETS.find((m) => m.id === activeProject.musicPresetId) || MUSIC_PRESETS[0];
      const bpm = presetTrack.bpm;
      const beatIntervalMs = (60 / bpm / 2) * 1000; // Eighth note interval

      currentStepRef.current = 0;

      // Stop previous scheduler loop
      if (synthIntervalRef.current) clearInterval(synthIntervalRef.current);

      synthIntervalRef.current = setInterval(() => {
        const step = currentStepRef.current;
        const speedMultiplier = activeProject.danceSpeed;
        
        // play procedural synthesised instrument tracks
        playSynthBeatsStep(audioCtx, step, activeProject.musicPresetId);

        // Every beat 0, 2, 4, 6 yields a heavy pulsing trigger (or on snare step 4)
        if (step % 2 === 0) {
          // Pulse the beat factor to 1.0
          setBeatFactor(1.0);
        }

        currentStepRef.current = (step + 1) % 8;
      }, beatIntervalMs / activeProject.danceSpeed);

      // Simple beat decayed fallback animation loop
      startBeatDecayAnimation();

    } else {
      // PLAY CUSTOM AUDIO (LINK OR FILE)
      let srcUrl = '';
      if (activeProject.musicType === 'link') {
        srcUrl = activeProject.musicLink;
      } else if (activeProject.musicType === 'file' && activeProject.musicFileData) {
        srcUrl = activeProject.musicFileData;
      }

      if (!srcUrl) {
        // Fallback to preset synth if empty details
        handleUpdateActiveProject({ musicType: 'preset' });
        alert('입력된 음악 링크나 업로드된 파일이 없어 기본 내장 댄스 비트로 대체합니다!');
        setIsPlaying(false);
        return;
      }

      // Initialize HTML Audio element
      let audio = audioElement;
      if (!audio) {
        audio = new Audio();
        audio.crossOrigin = 'anonymous'; 
        setAudioElement(audio);
      }

      audio.src = srcUrl;
      audio.loop = true;
      audio.playbackRate = activeProject.danceSpeed; // Adjust song tempo based on dance speed!

      // Setup analyser inside Web Audio
      if (!analyserRef.current) {
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        if (!audioSourceRef.current) {
          audioSourceRef.current = audioCtx.createMediaElementSource(audio);
          audioSourceRef.current.connect(analyser);
          analyser.connect(audioCtx.destination);
        }
      }

      audio.play()
        .then(() => {
          // Dynamic Web Audio Analyse frequency loop
          const bufferLength = analyserRef.current!.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const checkFrequency = () => {
            if (!isPlaying && !audio.paused) return; // guard
            
            analyserRef.current!.getByteFrequencyData(dataArray);
            
            // Average volume of low to mid bass beats (frequencies 0 to 4 in 64 bucket)
            let sumBasses = 0;
            for (let i = 0; i < 4; i++) {
              sumBasses += dataArray[i];
            }
            const averageBass = sumBasses / 4;
            // Scale beatFactor from 0.0 to 1.0 based on amplitude
            const intensity = Math.min(1.0, averageBass / 190);
            setBeatFactor(intensity > 0.15 ? intensity : intensity * 0.2);

            requestAnimationFrame(checkFrequency);
          };

          requestAnimationFrame(checkFrequency);
        })
        .catch((err) => {
          console.error('Audio playback failed', err);
          alert('CORS 또는 파일 포맷 제한으로 이 오디오 링크를 온라인에서 직접 로드하지 못했습니다! 우회 재생 혹은 다운받은 오디오 로컬 파일을 사용해보세요.');
          stopAudio();
        });
    }
  };

  const stopAudio = () => {
    setIsPlaying(false);
    setBeatFactor(0);
    
    if (synthIntervalRef.current) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }

    if (audioElement) {
      audioElement.pause();
    }
  };

  // Gracefully transition beat factor down inside loop for procedural rhythm pulsing
  const startBeatDecayAnimation = () => {
    const decay = () => {
      setBeatFactor((prev) => {
        if (prev <= 0.05) return 0;
        return prev - 0.08; // smooth spring decay
      });
      if (isPlaying) {
        requestAnimationFrame(decay);
      }
    };
    requestAnimationFrame(decay);
  };

  // Procedural 8-step offline synthesizer loop
  const playSynthBeatsStep = (audioCtx: AudioContext, step: number, presetId: MusicPresetId) => {
    const t = audioCtx.currentTime;

    // Bass instrument pitches definition
    const freqs = {
      C2: 65.41, Eb2: 73.42, F2: 87.31, G2: 98.00, Bb2: 116.54,
      C3: 130.81, D3: 146.83, A2: 110.00, G3: 196.00, E3: 164.81,
      Eb3: 155.56, F3: 174.61, Bb3: 233.08, C4: 261.63
    };

    if (presetId === 'retro_synth') {
      // Step 0: Kick. Step 4: Kick + Snare.
      if (step === 0 || step === 4) {
        triggerSynthKick(audioCtx, t, 120);
      }
      if (step === 4) {
        triggerSynthSnare(audioCtx, t, 0.4);
      }
      // Pulley Hi-Hat syncopated offbeat (step 1, 3, 5, 7)
      if (step % 2 === 1) {
        triggerSynthNoiseHat(audioCtx, t, 0.12);
      }

      // Synth Bass track melody
      const melody = [freqs.C2, freqs.Eb2, freqs.F2, freqs.Eb2, freqs.G2, freqs.Bb2, freqs.C3, freqs.Bb2];
      triggerSynthPluck(audioCtx, melody[step], 0.15, t);

    } else if (presetId === 'hiphop_groove') {
      // Step 0, 3: Heavy boom kicks. Step 4: Trap Snare click
      if (step === 0 || step === 3) {
        triggerSynthKick(audioCtx, t, 65, 0.4); // deep fat sub 808 kick
      }
      if (step === 4) {
        triggerSynthSnare(audioCtx, t, 0.65, 380); // higher pitch snap snare
      }
      
      // Fast hi-hat double steps (trap hats)
      if (step % 2 === 0) {
        triggerSynthNoiseHat(audioCtx, t, 0.08);
      }

      // Cute high bell chime pluck on step 2, 6
      if (step === 2 || step === 6) {
        triggerSynthPluck(audioCtx, freqs.G3, 0.4, t, 'sine');
      }

    } else if (presetId === 'disco_fever') {
      // Upbeat four on the floor Kicks (0, 2, 4, 6)
      if (step % 2 === 0) {
        triggerSynthKick(audioCtx, t, 90, 0.2);
      }
      // Offbeat open hi-hat hats (1, 3, 5, 7)
      if (step % 2 === 1) {
        triggerSynthNoiseHat(audioCtx, t, 0.25); // longer open hats
      }
      if (step === 4) {
        triggerSynthSnare(audioCtx, t, 0.3);
      }

      // Funky walking bass line notes
      const discoBass = [freqs.C2, freqs.C3, freqs.Eb2, freqs.F2, freqs.G2, freqs.G3, freqs.Bb2, freqs.C2];
      triggerSynthPluck(audioCtx, discoBass[step], 0.12, t, 'triangle');

    } else if (presetId === 'acoustic_breeze') {
      // Snappy finger snaps and light bongos sound
      if (step === 0) {
        triggerSynthKick(audioCtx, t, 110, 0.1);
      }
      if (step === 4) {
        triggerSynthSnare(audioCtx, t, 0.25, 450); // crispy snapping finger
      }
      
      // Beautiful harmonic acoustic harp plucks
      const harpMelody = [freqs.C3, freqs.E3, freqs.G3, freqs.G3, freqs.A2, freqs.C3, freqs.E3, freqs.G3];
      triggerSynthPluck(audioCtx, harpMelody[step] * 2, 0.3, t, 'triangle');

    } else if (presetId === 'edm_party') {
      // Energetic fast electro pacing
      triggerSynthKick(audioCtx, t, 150, 0.18); // relentless house beats
      if (step === 4) {
        triggerSynthSnare(audioCtx, t, 0.82, 180); // heavy clap/snare
      }
      if (step % 2 === 1) {
        triggerSynthNoiseHat(audioCtx, t, 0.15);
      }

      // Ecstatic aggressive synth screamer melody
      const edmRiff = [freqs.C3, freqs.C3, freqs.Eb3 || freqs.Eb2 * 2, freqs.F3 || freqs.F2 * 2, freqs.G3, freqs.Bb3 || freqs.Bb2 * 2, freqs.C4 || freqs.C3 * 2, freqs.C3];
      triggerSynthPluck(audioCtx, edmRiff[step] * 1.5, 0.12, t, 'sawtooth');
    }
  };

  // INDIVIDUAL OSCILLATOR TRIGGERS
  const triggerSynthKick = (ctx: AudioContext, time: number, startFreq: number, duration = 0.25) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + duration);
    
    gain.gain.setValueAtTime(synthVolume * 1.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.start(time);
    osc.stop(time + duration);
  };

  const triggerSynthSnare = (ctx: AudioContext, time: number, duration = 0.2, filterFreq = 250) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(filterFreq, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + duration);
    
    gain.gain.setValueAtTime(synthVolume * 0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.start(time);
    osc.stop(time + duration);
  };

  const triggerSynthNoiseHat = (ctx: AudioContext, time: number, duration = 0.12) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth'; // mock high-frequency noisy clicks
    
    // Bandpass filter to isolate high frequency hiss
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(10000, time);
    
    gain.gain.setValueAtTime(synthVolume * 0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.start(time);
    osc.stop(time + duration);
  };

  const triggerSynthPluck = (ctx: AudioContext, freq: number, duration: number, time: number, type: 'sawtooth' | 'triangle' | 'sine' = 'sawtooth') => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;

    // Filter to give a smooth pluck decay
    const lowPass = ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(freq * 3, time);
    lowPass.frequency.exponentialRampToValueAtTime(freq * 1.1, time + duration);

    osc.connect(lowPass);
    lowPass.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(synthVolume * 0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.start(time);
    osc.stop(time + duration);
  };

  // Clean elements on unmount
  useEffect(() => {
    return () => {
      if (synthIntervalRef.current) clearInterval(synthIntervalRef.current);
    };
  }, []);

  // Sync music tempo dynamically if active project's playback speed is modified on the fly
  useEffect(() => {
    if (isPlaying && activeProject) {
      // Re-trigger startAudio to apply new timing settings immediately
      startAudio();
    }
  }, [activeProject?.danceSpeed, activeProject?.musicPresetId, activeProject?.musicType, activeProject?.musicLink, activeProject?.musicFileData]);

  return (
    <main className="min-h-screen bg-[#050505] text-[#f3f4f6] font-sans antialiased flex flex-col justify-between relative overflow-x-hidden" id="applet-main-body">
      
      {/* Immersive radial background stage glow in the center */}
      <div className="absolute top-0 left-0 right-0 h-full stage-gradient -z-10 pointer-events-none opacity-45" />

      {/* 1. TOP MAIN HEADER with glass finish */}
      <header className="px-6 py-4 glass border-b border-white/10 flex items-center justify-between z-10" id="app-nav-header">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-lg flex items-center justify-center font-extrabold text-white text-lg tracking-tighter neon-glow">
            🕺
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white flex items-center gap-1.5 leading-none tracking-tight">
              <span>졸라맨 댄스 스튜디오</span>
              <span className="text-[10px] bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-mono px-2 py-0.5 rounded-md select-none font-bold shadow-[0_0_10px_rgba(139,92,246,0.3)]">STAGE LAB V2</span>
            </h1>
            <span className="text-[10.5px] text-gray-400 mt-1 block leading-none">
              내 사진을 붙인 졸라맨이 흘러나오는 비트에 맞춰 춤을 추는 무대를 지휘해 보세요.
            </span>
          </div>
        </div>

        {/* Global Control Widgets */}
        {/* Global Control Widgets */}
        <div className="flex items-center gap-3" id="global-nav-controllers">
          
          {/* Real-time Firebase Sync Status Badge */}
          {!authLoading && (
            <div className="flex items-center gap-1.5 text-[10.5px] px-2.5 py-1.5 rounded-lg glass font-medium select-none">
              {user ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider hidden sm:inline">구름 연동 중</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-orange-400 text-[10px] uppercase font-bold tracking-wider hidden sm:inline">로컬 저장소</span>
                </>
              )}
            </div>
          )}

          {/* Synth Volume Slider panel */}
          {activeProject?.musicType === 'preset' && (
            <div className="hidden md:flex items-center gap-2 glass px-3.5 py-1.5 rounded-xl text-xs text-slate-300" id="synth-volume-dock">
              {synthVolume === 0 ? <VolumeX className="w-4 h-4 text-gray-500" /> : <Volume2 className="w-4 h-4 text-violet-400" />}
              <span>음원 볼륨</span>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.1"
                value={synthVolume}
                onChange={(e) => setSynthVolume(parseFloat(e.target.value))}
                className="w-16 h-1 bg-white/15 appearance-none rounded-lg cursor-pointer slider-thumb"
                id="global-volume-slider"
              />
            </div>
          )}

          {/* Auth Button and User Profile Area */}
          {authLoading ? (
            <div className="flex items-center justify-center w-8 h-8 rounded-lg glass" id="auth-spinner">
              <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
            </div>
          ) : user ? (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2 sm:px-3 py-1 rounded-xl" id="auth-connected-profile">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "Google User"} 
                  className="w-5 h-5 rounded-full ring-1 ring-violet-500"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {user.displayName?.charAt(0) || "U"}
                </div>
              )}
              <span className="text-[11px] text-gray-200 font-bold hidden sm:inline leading-none truncate max-w-[80px]">
                {user.displayName?.split(' ')[0]}
              </span>
              <button
                onClick={logoutUser}
                title="로그아웃"
                className="p-1 text-gray-400 hover:text-red-400 rounded-md transition-colors cursor-pointer"
                id="logout-header-action"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-violet-600 hover:bg-violet-500 text-white neon-glow transition-all active:scale-95 cursor-pointer shadow-lg"
              id="login-header-action"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>로그인</span>
            </button>
          )}

          <span className="text-[10px] font-mono glass text-gray-400 px-2.5 py-1.5 rounded-lg leading-none select-none hidden sm:inline">
            ⏰ 2026-06-12
          </span>
        </div>
      </header>

      {/* 2. DUAL-PANEL CENTER STAGE WORKSPACE */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 z-10" id="center-workspace-grid">
        
        {/* LEFT PANEL: STICKMAN PLAYING VIEW + SPEED SLIDER (LG COLL-7) */}
        <section className="lg:col-span-7 flex flex-col h-full" id="left-dancing-stage-box">
          {activeProject ? (
            <DanceView
              project={activeProject}
              onUpdateProject={handleUpdateActiveProject}
              audioAnalyser={analyserRef.current}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              beatFactor={beatFactor}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center glass rounded-2xl p-8 text-center text-gray-400">
              <span>활성화된 프로젝트가 없습니다. 불러오거나 새로 생성하세요!</span>
            </div>
          )}
        </section>

        {/* RIGHT PANEL: USER CONFIGURATIONS AND PROJECTS ARCHIVE (LG COLL-5) */}
        <aside className="lg:col-span-5 flex flex-col h-full" id="right-dashboard-control-panels">
          {/* TAB HEADERS selector */}
          <div className="flex bg-white/5 p-1 border border-white/10 rounded-2xl mb-4 text-xs font-bold" id="management-hub-tabs">
            <button
              onClick={() => setActiveTab('media')}
              className={`flex-1 py-3 text-center rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'media'
                  ? 'bg-violet-600/90 text-white shadow-lg font-bold neon-glow'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              id="tab-media-inputs"
            >
              <Sliders className="w-4 h-4" />
              <span>미디어 커스텀 입력</span>
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex-1 py-3 text-center rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'projects'
                  ? 'bg-violet-600/90 text-white shadow-lg font-bold neon-glow'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              id="tab-project-list"
            >
              <FolderHeart className="w-4 h-4" />
              <span>보관함 프로젝트 관리</span>
            </button>
          </div>

          {/* ACTIVE TAB VIEWS CONTAINER WITH SMOOTH OVERFLOW SCROLL */}
          <div className="flex-1 overflow-y-auto max-h-[720px] pr-1" id="dashboard-tab-content-container">
            {activeProject ? (
              activeTab === 'media' ? (
                <MediaInputView
                  project={activeProject}
                  onUpdateProject={handleUpdateActiveProject}
                  musicPresets={MUSIC_PRESETS}
                />
              ) : (
                <ProjectListView
                  projects={projects}
                  activeProjectId={activeProjectId}
                  onSelectProject={(id) => { setActiveProjectId(id); stopAudio(); }}
                  onDeleteProject={handleDeleteProject}
                  onCloneProject={handleCloneProject}
                  onCreateNewProject={handleCreateNewProject}
                  onUpdateActiveProjectName={handleUpdateActiveProjectName}
                  activeProjectName={activeProject.name}
                />
              )
            ) : (
              <div className="p-8 text-center text-gray-500" id="fallback-no-active-project">
                프로젝트를 먼저 생성해주세요!
              </div>
            )}
          </div>
        </aside>

      </div>

      {/* 3. FOOTER */}
      <footer className="py-4 glass border-t border-white/10 text-center text-xs text-gray-400 flex flex-col sm:flex-row items-center justify-between px-6 gap-2 z-10" id="studio-system-footer">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>브라우저 LocalStorage 동기화로 이력이 실시간 저장됩니다.</span>
        </div>
        <div>
          <span>Crafted in Custom Dance Engine Workspace • AI Studio 2026</span>
        </div>
      </footer>
    </main>
  );
}
