/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Project, BgPresetId, MusicPresetId, DanceMoveType } from './types';
import DanceView from './components/DanceView';
import MediaInputView from './components/MediaInputView';
import ProjectListView from './components/ProjectListView';
import { Volume2, VolumeX, FolderHeart, Music, Sliders, CheckCircle, Smartphone, Info, Cloud, CloudOff, LogIn, LogOut, Loader2, QrCode, Share2, Copy, ExternalLink, X, ChevronLeft, PlusCircle } from 'lucide-react';
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
  
  // Shared View Mode state
  const [isSharedView, setIsSharedView] = useState<boolean>(false);
  const [sharedUserId, setSharedUserId] = useState<string>('');
  const [sharedProjectId, setSharedProjectId] = useState<string>('');
  const [sharedProject, setSharedProject] = useState<Project | null>(null);
  const [sharedLoading, setSharedLoading] = useState<boolean>(false);

  // QR share modal states
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [qrLoaded, setQrLoaded] = useState<boolean>(false);
  
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

  // Shared Viewer URL parameter detector
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sUserId = urlParams.get('userId');
    const sProjectId = urlParams.get('projectId');
    const mode = urlParams.get('mode');

    if (sUserId && sProjectId && mode === 'view') {
      setIsSharedView(true);
      setSharedUserId(sUserId);
      setSharedProjectId(sProjectId);
      setSharedLoading(true);

      const projectRef = ref(db, `projects/${sUserId}/${sProjectId}`);
      const unsubscribe = onValue(projectRef, (snapshot) => {
        if (snapshot.exists()) {
          setSharedProject({ id: sProjectId, ...snapshot.val() } as Project);
        } else {
          console.error("Shared project not found in Realtime Database");
          setSharedProject(null);
        }
        setSharedLoading(false);
      }, (error) => {
        console.error("Failed to fetch shared project", error);
        setSharedLoading(false);
      });

      return () => unsubscribe();
    } else {
      setIsSharedView(false);
      setSharedProject(null);
      setSharedUserId('');
      setSharedProjectId('');
    }
  }, []);

  // Reactive Firebase Sync Engine
  useEffect(() => {
    if (authLoading) return;
    if (isSharedView) return; // Skip synchronization of current user projects in sharing mode!

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
  const activeProject = isSharedView ? sharedProject : projects.find((p) => p.id === activeProjectId);

  // Update active project helpers
  const handleUpdateActiveProject = async (updates: Partial<Project>) => {
    if (isSharedView) {
      if (sharedProject) {
        setSharedProject({ ...sharedProject, ...updates });
      }
      return;
    }

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

  // Construct direct connection url for sharing
  const getShareUrl = () => {
    const ownerId = isSharedView ? sharedUserId : user?.uid;
    const projId = isSharedView ? sharedProjectId : activeProjectId;
    if (!ownerId || !projId) return '';
    return `${window.location.origin}${window.location.pathname}?userId=${ownerId}&projectId=${projId}&mode=view`;
  };

  const renderShareModal = () => {
    if (!isShareModalOpen) return null;

    const shareUrl = getShareUrl();
    const qrUrl = shareUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}` : '';

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" id="qr-sharing-modal">
        <div className="bg-[#12121e] border border-white/10 rounded-3xl max-w-sm w-full p-6 relative overflow-hidden shadow-2xl animate-zoom-in" style={{ animationDuration: '0.2s' }}>
          
          {/* Subtle gradient light background spot inside modal */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-violet-600/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-600/20 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-violet-400" />
              <h3 className="text-base font-bold text-white">나의 졸라맨 무대 공유하기</h3>
            </div>
            <button
              onClick={() => { setIsShareModalOpen(false); setIsCopied(false); setQrLoaded(false); }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Content */}
          {user || isSharedView ? (
            <div className="space-y-5 text-center">
              <p className="text-xs text-gray-400 leading-relaxed">
                스마트폰 카메라로 아래 QR 코드를 스캔하거나 링크를 복사하여 친구들에게 나만의 전설적인 댄스 무대를 자랑해 보세요! 🪩
              </p>

              {/* QR Code Container */}
              <div className="relative w-44 h-44 mx-auto bg-white p-3 rounded-2xl shadow-inner flex items-center justify-center group overflow-hidden">
                {!qrLoaded && (
                  <div className="absolute inset-0 bg-white flex flex-col items-center justify-center">
                    <Loader2 className="w-7 h-7 text-violet-600 animate-spin mb-1" />
                    <span className="text-[10px] text-gray-500 font-bold">QR 생성 중...</span>
                  </div>
                )}
                <img
                  src={qrUrl}
                  alt="Stage QR Code"
                  onLoad={() => setQrLoaded(true)}
                  className={`w-full h-full object-contain transition-opacity duration-300 ${qrLoaded ? 'opacity-100' : 'opacity-0'}`}
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Display share link with a Copy button */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-violet-400 block text-left">무대 연결 주소 (Direct Link)</span>
                <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 p-2.5 rounded-xl">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-transparent text-xs text-gray-300 outline-none select-all truncate px-1"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors flex items-center justify-center shrink-0 cursor-pointer text-xs font-semibold gap-1 min-w-[65px]"
                  >
                    {isCopied ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                        <span>복사됨</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                        <span>복사</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // User not logged in, explain cloud requirements
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-violet-600/10 text-violet-400 flex items-center justify-center mx-auto text-xl">
                ☁️
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white">모바일 감상 및 공유 연동 시작</h4>
                <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
                  현재 오프라인(로컬 저장소) 모드입니다. 다른 기기에서도 볼 수 있도록 1초 간편 구글 로그인을 하시면 실시간으로 클라우드에 백업되어 큐알코드 링크가 실시간 활성화됩니다!
                </p>
              </div>

              <button
                onClick={async () => {
                  try {
                    const loggedInUser = await signInWithGoogle();
                    if (loggedInUser) {
                      setIsShareModalOpen(false);
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-white transition-all transform active:scale-95 shadow-lg shadow-violet-600/20 text-xs cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>구글 로그인하고 스테이지 공유하기</span>
              </button>
            </div>
          )}

          {/* Quick instructions indicator */}
          <div className="mt-5 border-t border-white/5 pt-3.5 flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
            <Smartphone className="w-3.5 h-3.5" />
            <span>무대 연동 완료 • 모바일 웹 뷰포트 완벽 대응</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {isSharedView ? (
        sharedLoading ? (
          <main className="min-h-screen bg-[#050505] text-[#f3f4f6] flex flex-col items-center justify-center font-sans relative" id="applet-main-body">
            <div className="absolute top-0 left-0 right-0 h-full stage-gradient -z-10 pointer-events-none opacity-45" />
            <Loader2 className="w-12 h-12 text-violet-500 animate-spin mb-4" />
            <p className="text-sm font-semibold text-gray-300">공유받은 졸라맨 무대를 불러오는 중...</p>
          </main>
        ) : !sharedProject ? (
          <main className="min-h-screen bg-[#050505] text-[#f3f4f6] flex flex-col items-center justify-center font-sans p-6 text-center relative" id="applet-main-body">
            <div className="absolute top-0 left-0 right-0 h-full stage-gradient -z-10 pointer-events-none opacity-45" />
            <div className="w-16 h-16 bg-red-650/10 text-red-500 rounded-full flex items-center justify-center mb-4 text-3xl">⚠️</div>
            <h2 className="text-lg font-extrabold mb-2 text-white">공연 무대를 찾을 수 없습니다</h2>
            <p className="text-sm text-gray-400 mb-6 max-w-md">친구의 무대 링크가 유효하지 않거나 삭제되었을 수 있습니다. 직접 나만의 새로운 졸라맨을 제작해 보세요!</p>
            <button
              onClick={() => window.location.href = window.location.origin + window.location.pathname}
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm tracking-wide transition-all shadow-lg neon-glow cursor-pointer"
            >
              새로운 졸라맨 만들기
            </button>
          </main>
        ) : (
          <main className="min-h-screen bg-[#050505] text-[#f3f4f6] font-sans antialiased flex flex-col justify-between relative overflow-x-hidden animate-fade-in" id="applet-main-body">
            <div className="absolute top-0 left-0 right-0 h-full stage-gradient -z-10 pointer-events-none opacity-45" />

            {/* SHARED HEADER */}
            <header className="px-6 py-4 glass border-b border-white/10 flex items-center justify-between z-10" id="app-nav-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-violet-600 rounded-lg flex items-center justify-center font-extrabold text-white text-lg tracking-tighter neon-glow">
                  🕺
                </div>
                <div>
                  <h1 className="text-sm font-extrabold text-white flex items-center gap-1.5 leading-none tracking-tight">
                    <span>공유받은 졸라맨 무대</span>
                    <span className="text-[10px] bg-emerald-600 text-white font-mono px-2 py-0.5 rounded-md select-none font-bold uppercase shadow-[0_0_10px_rgba(16,185,129,0.3)]">Viewer Mode</span>
                  </h1>
                  <span className="text-[10.5px] text-gray-400 mt-1 block leading-none">
                    친구가 정밀 튜닝한 졸라맨 무대입니다. 재생을 켜고 리바이브에 맞춰 춤을 감상하세요!
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.location.href = window.location.origin + window.location.pathname}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white neon-glow transition-all active:scale-95 cursor-pointer shadow-lg border border-violet-500"
                  id="make-my-own-button"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>나도 댄싱 졸라맨 만들기</span>
                </button>
              </div>
            </header>

            {/* SHARED STAGE MAIN */}
            <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center z-10" id="center-workspace-grid">
              <section className="md:col-span-8 w-full h-full max-h-[640px] flex flex-col" id="left-dancing-stage-box">
                <DanceView
                  project={sharedProject}
                  onUpdateProject={handleUpdateActiveProject}
                  audioAnalyser={analyserRef.current}
                  isPlaying={isPlaying}
                  onTogglePlay={handleTogglePlay}
                  beatFactor={beatFactor}
                  onOpenShare={() => setIsShareModalOpen(true)}
                />
              </section>

              {/* SHARED SIDEBAR QR ENHANCEMENT */}
              <div className="md:col-span-4 flex flex-col gap-4">
                <div className="glass border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[350px]">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-xl pointer-events-none" />
                  <div className="w-9 h-9 rounded-full bg-violet-600/15 flex items-center justify-center mb-3">
                    <QrCode className="w-4.5 h-4.5 text-violet-400" />
                  </div>
                  <h3 className="text-xs font-bold text-white mb-1.5 flex items-center gap-1 justify-center">
                    <span>스마트폰 간편 스캔</span>
                    <span className="text-[9px] bg-violet-600 text-white font-mono px-1 py-0.5 rounded leading-none">QR 🦖</span>
                  </h3>
                  <p className="text-[10.5px] text-gray-400 leading-relaxed mb-4 max-w-[240px]">
                    스마트폰으로 우측 QR 코드를 스캔하여, 현재 이 라이브 졸라맨 무대를 모바일에서 즉시 감상하고 연동하세요!
                  </p>
                  
                  {/* Dino QR Code */}
                  <div className="bg-white p-2.5 rounded-xl shadow-inner relative w-32 h-32 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform duration-200">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getShareUrl())}`}
                      alt="Mobile View QR"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <div className="mt-4 w-full">
                    <button
                      onClick={() => {
                        const url = getShareUrl();
                        if (url) {
                          navigator.clipboard.writeText(url);
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                        }
                      }}
                      className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[10.5px] font-bold text-gray-300 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 border border-white/10"
                    >
                      {isCopied ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>복사 완료!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>연결 공연 주소 복사</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SHARED FOOTER */}
            <footer className="py-4 glass border-t border-white/10 text-center text-xs text-gray-400 flex flex-col sm:flex-row items-center justify-between px-6 gap-2 z-10" id="studio-system-footer">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>클라우드 서버에서 실시간 공유되고 있는 라이브 댄스 스튜디오 스테이지입니다.</span>
              </div>
              <div>
                <span>Crafted in Custom Dance Engine Workspace • AI Studio 2026</span>
              </div>
            </footer>

            {renderShareModal()}
          </main>
        )
      ) : (
        <main className="min-h-screen bg-[#050505] text-[#f3f4f6] font-sans antialiased flex flex-col justify-between relative overflow-x-hidden" id="applet-main-body">
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
            
            {/* LEFT PANEL: STICKMAN PLAYING VIEW + SPEED SLIDER */}
            <section className="lg:col-span-7 flex flex-col h-full" id="left-dancing-stage-box">
              {activeProject ? (
                <DanceView
                  project={activeProject}
                  onUpdateProject={handleUpdateActiveProject}
                  audioAnalyser={analyserRef.current}
                  isPlaying={isPlaying}
                  onTogglePlay={handleTogglePlay}
                  beatFactor={beatFactor}
                  onOpenShare={() => setIsShareModalOpen(true)}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center glass rounded-2xl p-8 text-center text-gray-400">
                  <span>활성화된 프로젝트가 없습니다. 불러오거나 새로 생성하세요!</span>
                </div>
              )}
            </section>

            {/* RIGHT PANEL: USER CONFIGURATIONS AND PROJECTS ARCHIVE */}
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
              <div className="flex-1 overflow-y-auto max-h-[560px] pr-1" id="dashboard-tab-content-container">
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

              {/* FIXED MOBILITY LINK ACCELERATOR (QR INSERT) */}
              <div className="mt-4 p-4 glass border border-white/10 rounded-2xl flex items-center justify-between gap-3 relative overflow-hidden shrink-0" id="dashboard-qr-inline-widget">
                <div className="absolute top-0 right-0 w-20 h-20 bg-violet-600/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 rounded bg-violet-600/20 text-violet-400">
                      <QrCode className="w-3.5 h-3.5" />
                    </span>
                    <h4 className="text-[11.5px] font-bold text-white flex items-center gap-1">
                      <span>실시간 모바일 감상 QR</span>
                      <span className="text-[9px] bg-violet-600 text-white font-bold px-1.5 py-0.5 rounded leading-none">LIVE 🦖</span>
                    </h4>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-normal max-w-[180px]">
                    우측 큐알코드를 스마트폰으로 스캔하시면 실시간 졸라맨 댄스 무대가 연동됩니다!
                  </p>
                  <button
                    onClick={() => {
                      const shareUrl = getShareUrl();
                      if (shareUrl) {
                        navigator.clipboard.writeText(shareUrl);
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }
                    }}
                    className="text-[9.5px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors mt-1.5 cursor-pointer"
                  >
                    {isCopied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? '복사 완료!' : '공연 무대 다이렉트 주소 복사'}</span>
                  </button>
                </div>
                
                {/* QR Code thumbnail */}
                <div 
                  className="relative shrink-0 w-20 h-20 bg-white p-1.5 rounded-xl flex items-center justify-center overflow-hidden hover:scale-105 transition-transform cursor-pointer" 
                  onClick={() => setIsShareModalOpen(true)} 
                  title="크게 보기 / 공유하기"
                >
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getShareUrl() || window.location.href)}`}
                    alt="Quick Access QR"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200 font-bold text-[9px] text-center">
                    확대
                  </div>
                </div>
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

          {renderShareModal()}
        </main>
      )}
    </>
  );
}
