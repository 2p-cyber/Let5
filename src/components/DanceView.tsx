/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Project, DanceMoveType, BgPresetId } from '../types';
import { Play, Pause, FastForward, Sliders, Volume2, Sparkles, QrCode } from 'lucide-react';

interface DanceViewProps {
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => void;
  audioAnalyser: AnalyserNode | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  beatFactor: number; // calculated in parent (0 to 1 pulsing)
  onOpenShare?: () => void;
}

export default function DanceView({
  project,
  onUpdateProject,
  audioAnalyser,
  isPlaying,
  onTogglePlay,
  beatFactor,
  onOpenShare,
}: DanceViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });
  const [headPos, setHeadPos] = useState({ x: 250, y: 150 });
  
  // Animation state values
  const animTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  // Particles for background
  const particlesRef = useRef<Array<{ x: number; y: number; size: number; speedX: number; speedY: number; color: string; angle?: number; decay?: number }>>([]);

  // Resize handler for scaling the canvas nicely
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // set dimensions maintaining aspect ratio or filling container
        const targetWidth = Math.max(width, 320);
        const targetHeight = Math.max(height, 350);
        setDimensions({ width: targetWidth, height: targetHeight });
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Initialize and update particles based on preset
  useEffect(() => {
    const list: Array<any> = [];
    const colorOptions = ['#ff2a5f', '#05d9e8', '#f5e025', '#01012b', '#b33bf6', '#ff007f'];
    
    for (let i = 0; i < 40; i++) {
      list.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        size: Math.random() * 4 + 2,
        speedX: (Math.random() - 0.5) * 2,
        speedY: (Math.random() - 0.5) * 2 - (project.bgPresetId === 'room' ? 0.3 : 0), // room fireplace sparks float up
        color: colorOptions[Math.floor(Math.random() * colorOptions.length)],
        angle: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = list;
  }, [project.bgPresetId]);

  // Handle Canvas Drawing Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    // Load custom face image if exists
    const faceImg = new Image();
    let isFaceLoaded = false;
    if (project.faceImage) {
      faceImg.src = project.faceImage;
      faceImg.onload = () => {
        isFaceLoaded = true;
      };
    }

    // Load custom background image if exists
    const bgImg = new Image();
    let isBgLoaded = false;
    if (project.bgType === 'custom' && project.bgCustomImage) {
      bgImg.src = project.bgCustomImage;
      bgImg.onload = () => {
        isBgLoaded = true;
      };
    }

    const draw = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const deltaTime = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Update animation internal time accumulator based on dancing speed and active playing state
      if (isPlaying) {
        animTimeRef.current += deltaTime * project.danceSpeed * 4.5;
      } else {
        // Slow sway when paused
        animTimeRef.current += deltaTime * 0.4;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const t = animTimeRef.current;

      // --- DRAW BACKGROUND ---
      if (project.bgType === 'custom' && isBgLoaded) {
        // Draw user uploaded image stretched and blurred slightly or styled nicely
        ctx.save();
        // subtle beat-synced zooming
        const scale = 1 + (beatFactor * 0.03);
        ctx.translate(width / 2, height / 2);
        ctx.scale(scale, scale);
        ctx.drawImage(bgImg, -width / 2, -height / 2, width, height);
        ctx.restore();

        // Overlay transparent screen to ensure stickman legibility
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, width, height);
      } else {
        // Draw preset decorative background
        drawPresetBackground(ctx, width, height, project.bgPresetId, t, beatFactor);
      }

      // --- CALCULATE STICKMAN JOINTS ---
      // We position the stickman relative to center of stage
      const centerX = width / 2;
      const groundY = height * 0.78; // ground horizontal floor
      const spineLength = 80;
      
      // Calculate active base vertical bouncing offset (jump offset)
      let jumpY = 0;
      let angleOffset = 0;
      let sideSwayX = 0;
      let isSpinning = false;
      let spinAngle = 0;

      const activeMove = project.danceMoveType === 'all' 
        ? (Math.floor(t / 20) % 5 === 0 ? 'wave' : Math.floor(t / 20) % 5 === 1 ? 'spin' : Math.floor(t / 20) % 5 === 2 ? 'disco' : Math.floor(t / 20) % 5 === 3 ? 'slide' : 'clap')
        : project.danceMoveType;

      // 1. Dance Move Logic
      if (activeMove === 'spin') {
        // Spin has intermittent jump/squat and heavy rotation
        const cycle = t % (Math.PI * 4);
        if (cycle > Math.PI * 2) {
          // Jumping stage
          const jumpPhase = (cycle - Math.PI * 2) / (Math.PI * 2); // 0 to 1
          jumpY = -Math.sin(jumpPhase * Math.PI) * 110;
          isSpinning = true;
          spinAngle = jumpPhase * Math.PI * 4; // spin twice in the air
          angleOffset = Math.sin(t) * 0.15;
        } else {
          // Pre-jump squatting
          jumpY = Math.abs(Math.sin(cycle)) * 25;
        }
      } else if (activeMove === 'wave') {
        // Rhythmic hip-hop bouncy bobbing
        jumpY = Math.abs(Math.sin(t)) * 18 - 8;
        sideSwayX = Math.cos(t / 2) * 20;
        angleOffset = Math.sin(t) * 0.08;
      } else if (activeMove === 'disco') {
        // Disco sway
        jumpY = Math.abs(Math.sin(t * 1.5)) * 10;
        sideSwayX = Math.sin(t) * 25;
        angleOffset = Math.cos(t) * 0.15;
      } else if (activeMove === 'slide') {
        // 滑 (glide) left and right back and forth
        sideSwayX = Math.sin(t * 0.5) * (width * 0.28);
        jumpY = Math.abs(Math.cos(t * 2)) * 6;
        angleOffset = -Math.cos(t * 0.5) * 0.22; // tilt body towards the movement direction
      } else if (activeMove === 'clap') {
        // Clap hand shuffle
        jumpY = Math.abs(Math.sin(t * 2)) * 12;
        sideSwayX = Math.sin(t * 3) * 8;
        angleOffset = Math.sin(t) * 0.04;
      }

      // Add music beat impact
      const musicPush = beatFactor * 14;
      jumpY -= musicPush;

      // Base pelvis position (hip pivot)
      const pelvisX = centerX + sideSwayX;
      const pelvisY = groundY + jumpY;

      // Head calculation
      let neckX = pelvisX - Math.sin(angleOffset) * spineLength;
      let neckY = pelvisY - Math.cos(angleOffset) * spineLength;

      // Head center
      const headRadius = 24;
      const headLenX = Math.sin(angleOffset) * 20;
      const headLenY = Math.cos(angleOffset) * 20;
      const headX = neckX - headLenX;
      const headY = neckY - headLenY;

      // Save head position coordinate in React state so speech overlay can track it!
      setHeadPos({ x: headX, y: headY });

      // Join definition helpers
      const lHipX = pelvisX - 12;
      const lHipY = pelvisY;
      const rHipX = pelvisX + 12;
      const rHipY = pelvisY;

      // Leg positions calculation
      let lKneeX = lHipX - 15, lKneeY = pelvisY + 35;
      let rKneeX = rHipX + 15, rKneeY = pelvisY + 35;
      let lFootX = lHipX - 25, lFootY = groundY;
      let rFootX = rHipX + 25, rFootY = groundY;

      // Legs animation
      if (activeMove === 'wave') {
        const legPhase = t;
        lKneeX = lHipX - 18 + Math.sin(legPhase) * 10;
        lKneeY = pelvisY + 32 + Math.cos(legPhase) * 5;
        rKneeX = rHipX + 18 + Math.cos(legPhase) * 10;
        rKneeY = pelvisY + 32 + Math.sin(legPhase) * 5;
        
        lFootX = lHipX - 25 + Math.sin(legPhase) * 6;
        rFootX = rHipX + 25 - Math.sin(legPhase) * 6;
      } else if (activeMove === 'spin') {
        if (isSpinning) {
          // legs tucked in while spinning
          lKneeX = pelvisX - 15 * Math.cos(spinAngle);
          lKneeY = pelvisY + 20;
          rKneeX = pelvisX + 15 * Math.cos(spinAngle);
          rKneeY = pelvisY + 20;
          lFootX = pelvisX - 8 * Math.cos(spinAngle);
          lFootY = pelvisY + 35;
          rFootX = pelvisX + 8 * Math.cos(spinAngle);
          rFootY = pelvisY + 35;
        } else {
          // Bending prep
          const factor = Math.abs(jumpY) / 25;
          lKneeY += factor * 12;
          rKneeY += factor * 12;
          lKneeX -= factor * 5;
          rKneeX += factor * 5;
        }
      } else if (activeMove === 'disco') {
        // sway knees with hips
        lKneeX = lHipX - 10 + Math.sin(t) * 18;
        rKneeX = rHipX + 15 + Math.sin(t) * 18;
        lFootX = lHipX - 30;
        rFootX = rHipX + 15 + Math.cos(t) * 20;
      } else if (activeMove === 'slide') {
        // slide: legs look like cycling/walking back and forth
        const slidePhase = t * 1.5;
        lKneeX = lHipX - 15 + Math.sin(slidePhase) * 15;
        lKneeY = pelvisY + 25 + Math.cos(slidePhase) * 10;
        rKneeX = rHipX + 15 - Math.sin(slidePhase) * 15;
        rKneeY = pelvisY + 25 - Math.cos(slidePhase) * 10;
        
        lFootX = lHipX - 25 + Math.sin(slidePhase) * 25;
        rFootX = rHipX + 25 - Math.sin(slidePhase) * 25;
      } else if (activeMove === 'clap') {
        // quick footsteps
        const footPhase = t * 4;
        lFootX = lHipX - 15 + Math.cos(footPhase) * 12;
        rFootX = rHipX + 15 + Math.sin(footPhase) * 12;
      }

      // Hand positions calculation
      let lShoulderX = neckX - 20 * Math.cos(angleOffset);
      let lShoulderY = neckY - 20 * Math.sin(angleOffset) + 16;
      let rShoulderX = neckX + 20 * Math.cos(angleOffset);
      let rShoulderY = neckY + 20 * Math.sin(angleOffset) + 16;

      let lElbowX = lShoulderX - 25, lElbowY = lShoulderY + 25;
      let rElbowX = rShoulderX + 25, rElbowY = rShoulderY + 25;
      let lHandX = lElbowX - 20, lHandY = lElbowY + 20;
      let rHandX = rElbowX + 20, rHandY = rElbowY + 20;

      // Arms animation based on activeMove
      if (activeMove === 'wave') {
        // wavy smooth arm motions
        lElbowX = lShoulderX - 30 + Math.cos(t) * 15;
        lElbowY = lShoulderY + 15 + Math.sin(t) * 15;
        lHandX = lElbowX - 20 + Math.sin(t * 1.5) * 20;
        lHandY = lElbowY - 10 + Math.cos(t * 1.5) * 25;

        rElbowX = rShoulderX + 30 + Math.sin(t) * 15;
        rElbowY = rShoulderY + 15 + Math.cos(t) * 15;
        rHandX = rElbowX + 20 + Math.cos(t * 1.5) * 20;
        rHandY = rElbowY - 10 + Math.sin(t * 1.5) * 25;
      } else if (activeMove === 'spin') {
        if (isSpinning) {
          // arms flaring out or raised high
          const angleMul = Math.sin(spinAngle);
          lElbowX = lShoulderX - 20 * angleMul;
          lElbowY = lShoulderY - 30;
          lHandX = lShoulderX - 35 * angleMul;
          lHandY = lShoulderY - 60;
          
          rElbowX = rShoulderX + 20 * angleMul;
          rElbowY = rShoulderY - 30;
          rHandX = rShoulderX + 35 * angleMul;
          rHandY = rShoulderY - 60;
        } else {
          // squat prep: arms in
          lHandX = neckX - 10;
          lHandY = neckY + 30;
          rHandX = neckX + 10;
          rHandY = neckY + 30;
        }
      } else if (activeMove === 'disco') {
        // Right hand points high up
        rElbowX = rShoulderX + 30;
        rElbowY = rShoulderY - 30;
        rHandX = rShoulderX + 60 + Math.sin(t * 3) * 10;
        rHandY = rShoulderY - 70 + Math.cos(t * 3) * 10;

        // Left hand on hip
        lElbowX = lShoulderX - 25;
        lElbowY = lShoulderY + 10;
        lHandX = pelvisX - 20;
        lHandY = pelvisY - 10;
      } else if (activeMove === 'slide') {
        // cool swagger slide arms sliding forward/back
        lElbowX = lShoulderX - 25 + Math.cos(t) * 15;
        lElbowY = lShoulderY + 20;
        lHandX = lElbowX - 10;
        lHandY = lElbowY - 30 + Math.sin(t) * 25;

        rElbowX = rShoulderX + 25 - Math.cos(t) * 15;
        rElbowY = rShoulderY + 20;
        rHandX = rElbowX + 10;
        rHandY = rElbowY - 30 - Math.sin(t) * 25;
      } else if (activeMove === 'clap') {
        // Clapping above the head sequentially
        const isClapFrame = Math.sin(t * 3) > 0.4;
        const clapY = neckY - 45 - (beatFactor * 10);
        const clapX = neckX + Math.sin(t * 0.5) * 15;

        if (isClapFrame || beatFactor > 0.6) {
          lHandX = clapX - 8;
          lHandY = clapY;
          rHandX = clapX + 8;
          rHandY = clapY;
          
          lElbowX = lShoulderX - 10;
          lElbowY = lShoulderY - 15;
          rElbowX = rShoulderX + 10;
          rElbowY = rShoulderY - 15;

          // Draw a small colorful clap impact burst
          ctx.fillStyle = '#ffdf00';
          ctx.beginPath();
          ctx.arc(clapX, clapY, 8 + beatFactor * 14, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Open arms wide preparing for clap
          lHandX = lShoulderX - 40;
          lHandY = lShoulderY - 20;
          rHandX = rShoulderX + 40;
          rHandY = rShoulderY - 20;
          
          lElbowX = lShoulderX - 25;
          lElbowY = lShoulderY - 5;
          rElbowX = rShoulderX + 25;
          rElbowY = rShoulderY - 5;
        }
      }

      // Apply 3D spinning horizontal scaling if spinning is active
      let joints = {
        pelvis: { x: pelvisX, y: pelvisY },
        neck: { x: neckX, y: neckY },
        head: { x: headX, y: headY },
        lHip: { x: lHipX, y: lHipY },
        rHip: { x: rHipX, y: rHipY },
        lKnee: { x: lKneeX, y: lKneeY },
        rKnee: { x: rKneeX, y: rKneeY },
        lFoot: { x: lFootX, y: lFootY },
        rFoot: { x: rFootX, y: rFootY },
        lShoulder: { x: lShoulderX, y: lShoulderY },
        rShoulder: { x: rShoulderX, y: rShoulderY },
        lElbow: { x: lElbowX, y: lElbowY },
        rElbow: { x: rElbowX, y: rElbowY },
        lHand: { x: lHandX, y: lHandY },
        rHand: { x: rHandX, y: rHandY },
      };

      if (isSpinning) {
        // Compress X matrix relative to center pelvis
        const spinCos = Math.cos(spinAngle);
        const mapSpin = (pt: { x: number; y: number }) => {
          const dx = pt.x - pelvisX;
          return { x: pelvisX + dx * spinCos, y: pt.y };
        };
        joints.neck = mapSpin(joints.neck);
        joints.head = mapSpin(joints.head);
        joints.lShoulder = mapSpin(joints.lShoulder);
        joints.rShoulder = mapSpin(joints.rShoulder);
        joints.lElbow = mapSpin(joints.lElbow);
        joints.rElbow = mapSpin(joints.rElbow);
        joints.lHand = mapSpin(joints.lHand);
        joints.rHand = mapSpin(joints.rHand);
      }

      // --- RENDER STICKMAN BONES ---
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const boneWidth = 10;
      const shadowColor = 'rgba(0,0,0,0.3)';

      // Draw shadow representation on the ground
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      const shadowRadius = 40 + (joints.pelvis.y - groundY) * 0.15 + (beatFactor * 10);
      ctx.ellipse(joints.pelvis.x, groundY + 10, shadowRadius, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer glow/stroke style
      const drawBone = (p1: { x: number; y: number }, p2: { x: number; y: number }, color: string = '#ffffff') => {
        // Bone shadow
        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = boneWidth + 3;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Actual bone
        ctx.strokeStyle = color;
        ctx.lineWidth = boneWidth;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Inner highlighted shine bone
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = boneWidth / 3;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y + 1);
        ctx.lineTo(p2.x, p2.y + 1);
        ctx.stroke();
      };

      const stickmanColor = '#000000'; // high-contrast black line stickman

      // Draw Spine/Torso
      drawBone(joints.pelvis, joints.neck, stickmanColor);

      // Draw Shoulders line
      drawBone(joints.lShoulder, joints.rShoulder, stickmanColor);

      // Draw Arms left
      drawBone(joints.lShoulder, joints.lElbow, stickmanColor);
      drawBone(joints.lElbow, joints.lHand, stickmanColor);

      // Draw Arms right
      drawBone(joints.rShoulder, joints.rElbow, stickmanColor);
      drawBone(joints.rElbow, joints.rHand, stickmanColor);

      // Draw Hips line
      drawBone(joints.lHip, joints.rHip, stickmanColor);

      // Draw Legs left
      drawBone(joints.lHip, joints.lKnee, stickmanColor);
      drawBone(joints.lKnee, joints.lFoot, stickmanColor);

      // Draw Legs right
      drawBone(joints.rHip, joints.rKnee, stickmanColor);
      drawBone(joints.rKnee, joints.rFoot, stickmanColor);

      // --- DRAW FACE PHOTO ON HEAD ---
      if (isFaceLoaded && project.faceImage) {
        ctx.save();
        ctx.translate(joints.head.x, joints.head.y);
        ctx.rotate(angleOffset);

        const customFaceScale = project.faceScale || 1.0;
        const customFaceOffsetY = project.faceOffsetY || 0;
        const size = (headRadius * 2.8) * customFaceScale;

        // Draw elegant decorative white border frame for face crop
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, customFaceOffsetY, (size / 2) + 4, 0, Math.PI * 2);
        ctx.fill();

        // Reset shadows for clipping path
        ctx.shadowBlur = 0;

        // Circular clipping for photo face
        ctx.beginPath();
        ctx.arc(0, customFaceOffsetY, size / 2, 0, Math.PI * 2);
        ctx.clip();

        // Draw custom image centered
        ctx.drawImage(faceImg, -size / 2, -size / 2 + customFaceOffsetY, size, size);
        ctx.restore();
      } else {
        // Draw standard cartoon stickman face, styled beautifully
        ctx.save();
        ctx.translate(joints.head.x, joints.head.y);
        ctx.rotate(angleOffset);
        
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 5;

        // Head outer
        ctx.fillStyle = '#f5e025'; // smiling emoji face
        ctx.strokeStyle = stickmanColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Eyes bouncing with beat
        const eyeSize = 3 + beatFactor * 3;
        ctx.fillStyle = stickmanColor;
        // left eye
        ctx.beginPath();
        ctx.arc(-8, -4, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        // right eye
        ctx.beginPath();
        ctx.arc(8, -4, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // Happy Smile
        ctx.strokeStyle = stickmanColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        if (beatFactor > 0.5) {
          // Open big smile on beat
          ctx.arc(0, 4, 11, 0, Math.PI);
        } else {
          // Normal happy smile
          ctx.arc(0, 4, 8, 0.1 * Math.PI, 0.9 * Math.PI);
        }
        ctx.stroke();

        // Blush cheeks
        ctx.fillStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.beginPath();
        ctx.arc(-14, 5, 4, 0, Math.PI * 2);
        ctx.arc(14, 5, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [project, isPlaying, beatFactor]);

  // Helper background renderer
  const drawPresetBackground = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    preset: BgPresetId,
    t: number,
    beat: number
  ) => {
    if (preset === 'festival') {
      // 1. Club Festival / Disco Mirror Ball
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0521');
      grad.addColorStop(1, '#02010d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Draw light beams
      ctx.save();
      const beamCount = 4;
      const activeColor = `rgba(${100 + Math.floor(Math.sin(t) * 155)}, ${50 + Math.floor(Math.cos(t * 1.5) * 105)}, 255, 0.22)`;
      
      for (let i = 0; i < beamCount; i++) {
        const offsetAngle = t * 0.3 + (i * Math.PI / 2);
        const pivotX = w / 2;
        const pivotY = 30;
        
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        // Beam spreads downwards
        const targetX1 = pivotX + Math.sin(offsetAngle - 0.25) * w;
        const targetX2 = pivotX + Math.sin(offsetAngle + 0.25) * w;
        ctx.lineTo(targetX1, h);
        ctx.lineTo(targetX2, h);
        ctx.closePath();

        const beamGrad = ctx.createLinearGradient(pivotX, pivotY, pivotX, h);
        beamGrad.addColorStop(0, `rgba(255, 255, 255, ${0.4 + beat * 0.4})`);
        beamGrad.addColorStop(0.3, activeColor);
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = beamGrad;
        ctx.fill();
      }
      ctx.restore();

      // Floor grid tiles
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      const startFloorY = h * 0.72;
      for (let i = 0; i < 9; i++) {
        const xOffset = w * (i / 8);
        ctx.beginPath();
        ctx.moveTo(xOffset, h);
        ctx.lineTo(w / 2 + (xOffset - w / 2) * 0.35, startFloorY);
        ctx.stroke();
      }
      // Horizontal floor grids
      for (let i = 0; i < 4; i++) {
        const gridY = startFloorY + (h - startFloorY) * (i / 3);
        ctx.strokeStyle = `rgba(${255 * beat}, 50, 255, ${0.2 + (i / 4) * 0.4})`;
        ctx.lineWidth = 1 + i;
        ctx.beginPath();
        ctx.moveTo(0, gridY);
        ctx.lineTo(w, gridY);
        ctx.stroke();
      }

      // Mirror ball drawing
      const mirrorBallX = w / 2;
      const mirrorBallY = 45;
      const ballRadius = 25 + beat * 4;

      // Hanger string
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mirrorBallX, 0);
      ctx.lineTo(mirrorBallX, mirrorBallY - ballRadius);
      ctx.stroke();

      // Glowing Aura surrounding ball
      const ballGlow = ctx.createRadialGradient(mirrorBallX, mirrorBallY, ballRadius - 5, mirrorBallX, mirrorBallY, ballRadius + 40);
      ballGlow.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      ballGlow.addColorStop(0.5, `rgba(255, 0, 127, ${0.4 + beat * 0.4})`);
      ballGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ballGlow;
      ctx.beginPath();
      ctx.arc(mirrorBallX, mirrorBallY, ballRadius + 40, 0, Math.PI * 2);
      ctx.fill();

      // Draw simple mirror tiles
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#b3c8e8';
      ctx.beginPath();
      ctx.arc(mirrorBallX, mirrorBallY, ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Mirror vertical/horizontal grid lines
      ctx.beginPath();
      for (let offset = -ballRadius + 5; offset < ballRadius; offset += 7) {
        // Horiz
        ctx.moveTo(mirrorBallX - Math.sqrt(ballRadius*ballRadius - offset*offset), mirrorBallY + offset);
        ctx.lineTo(mirrorBallX + Math.sqrt(ballRadius*ballRadius - offset*offset), mirrorBallY + offset);
        // Vert
        ctx.moveTo(mirrorBallX + offset, mirrorBallY - Math.sqrt(ballRadius*ballRadius - offset*offset));
        ctx.lineTo(mirrorBallX + offset, mirrorBallY + Math.sqrt(ballRadius*ballRadius - offset*offset));
      }
      ctx.stroke();

      // Draw floating beat stars/particles
      drawParticles(ctx, w, h, true, beat);

    } else if (preset === 'field') {
      // 2. Peaceful Field
      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#75c6ff');
      skyGrad.addColorStop(0.7, '#daefff');
      skyGrad.addColorStop(1, '#90db86');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Bouncing yellow sun
      ctx.save();
      const sunX = w * 0.85;
      const sunY = h * 0.22 + Math.sin(t * 1.5) * 15;
      const sunRadius = 32 + beat * 6;

      const sunGlow = ctx.createRadialGradient(sunX, sunY, sunRadius - 5, sunX, sunY, sunRadius + 30);
      sunGlow.addColorStop(0, '#ffea75');
      sunGlow.addColorStop(0.3, '#ffaa00');
      sunGlow.addColorStop(1, 'rgba(255,234,117,0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius + 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffcc00';
      ctx.strokeStyle = '#eeaa00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Sun rays
      ctx.strokeStyle = '#ffbb00';
      ctx.lineWidth = 4;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        const offset = t * 0.05 + a;
        ctx.beginPath();
        ctx.moveTo(sunX + Math.cos(offset) * (sunRadius + 3), sunY + Math.sin(offset) * (sunRadius + 3));
        ctx.lineTo(sunX + Math.cos(offset) * (sunRadius + 14), sunY + Math.sin(offset) * (sunRadius + 14));
        ctx.stroke();
      }
      ctx.restore();

      // Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      const drawCloud = (cx: number, cy: number, size: number) => {
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.arc(cx + size * 0.8, cy - size * 0.3, size * 0.8, 0, Math.PI * 2);
        ctx.arc(cx - size * 0.8, cy - size * 0.2, size * 0.7, 0, Math.PI * 2);
        ctx.arc(cx + size * 1.5, cy, size * 0.6, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      };
      
      const cloudOffset1 = (t * 8) % (w + 200) - 100;
      const cloudOffset2 = (t * 4 + 200) % (w + 200) - 100;
      drawCloud(cloudOffset1, h * 0.15, 22);
      drawCloud(cloudOffset2, h * 0.28, 16);

      // Rolling Hills
      ctx.fillStyle = '#4fa83f';
      ctx.beginPath();
      ctx.ellipse(w * 0.25, h * 0.84, w * 0.65, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#61c24e';
      ctx.beginPath();
      ctx.ellipse(w * 0.78, h * 0.87, w * 0.6, h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Simple ground details / flowers
      drawParticles(ctx, w, h, false, beat);

    } else if (preset === 'space') {
      // 3. Cosmic Nebula Space
      ctx.fillStyle = '#010014';
      ctx.fillRect(0, 0, w, h);

      // Ambient Nebula color swirls
      const nebula = ctx.createRadialGradient(w/2, h/2, 20, w/2, h/2, w/2);
      nebula.addColorStop(0, `rgba(50, 10, 100, ${0.43 + beat * 0.15})`);
      nebula.addColorStop(0.5, `rgba(10, 60, 120, ${0.28 + beat * 0.1})`);
      nebula.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);

      // Planet Spinning
      ctx.save();
      const planetX = w * 0.18;
      const planetY = h * 0.25;
      const pr = 40 + beat * 2;
      
      // Ring
      ctx.strokeStyle = 'rgba(235, 140, 255, 0.6)';
      ctx.lineWidth = 14;
      ctx.save();
      ctx.translate(planetX, planetY);
      ctx.rotate(-0.25 * Math.PI);
      ctx.scale(1.9, 0.25);
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Planet ball
      const planetGrad = ctx.createRadialGradient(planetX - 10, planetY - 10, 5, planetX, planetY, pr);
      planetGrad.addColorStop(0, '#00d2ff');
      planetGrad.addColorStop(0.5, '#7b00ff');
      planetGrad.addColorStop(1, '#1b004a');
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(planetX, planetY, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Starfield twinkle
      drawParticles(ctx, w, h, true, beat);

    } else if (preset === 'city') {
      // 4. Cyberpunk City Night Outline
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#04001c');
      grad.addColorStop(0.6, '#130128');
      grad.addColorStop(1, '#2c0022');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Grid floor
      const horizonY = h * 0.65;
      ctx.fillStyle = '#0f0014';
      ctx.fillRect(0, horizonY, w, h - horizonY);

      // Big cyber moon/sun
      ctx.save();
      const sunX = w / 2;
      const sunY = horizonY - 10;
      const sunR = 85 + beat * 8;
      const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY);
      sunGrad.addColorStop(0, '#ff007c');
      sunGrad.addColorStop(0.6, '#ff5000');
      sunGrad.addColorStop(1, '#ffc000');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, Math.PI, 0); // top half circle
      ctx.fill();

      // Cyber retro horizontal slot cutouts in the sun
      ctx.fillStyle = '#04001c';
      for (let sy = sunY - sunR; sy < sunY; sy += 11) {
        if (sy > sunY - 4) continue;
        const widthPercent = 3.2 + (sy - (sunY - sunR)) / 10;
        ctx.fillRect(sunX - sunR - 10, sy, (sunR + 10) * 2, widthPercent);
      }
      ctx.restore();

      // City Building outlines matching neon rhythm
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.strokeStyle = `rgba(10, 240, 255, ${0.43 + beat * 0.4})`;
      ctx.lineWidth = 1.5;

      const buildings = [
        { x: 10, w: 55, h: 140 },
        { x: 75, w: 45, h: 180 },
        { x: 130, w: 65, h: 110 },
        { x: 210, w: 40, h: 220 },
        { x: widthPercentToPx(w, 70), w: 50, h: 160 },
        { x: widthPercentToPx(w, 82), w: 45, h: 195 },
        { x: widthPercentToPx(w, 92), w: 60, h: 130 },
      ];

      buildings.forEach((b) => {
        const drawH = b.h + Math.sin(t + b.x) * 8; // subtle movement
        ctx.fillRect(b.x, horizonY - drawH, b.w, drawH);
        ctx.strokeRect(b.x, horizonY - drawH, b.w, drawH);

        // draw random yellow neon window pixels
        ctx.fillStyle = 'rgba(255, 230, 0, 0.5)';
        for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 14) {
          for (let wy = horizonY - drawH + 12; wy < horizonY - 12; wy += 26) {
            if (Math.sin(wx * wy + t) > 0.25) {
              ctx.fillRect(wx, wy, 4, 6);
            }
          }
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      });

      // Neon linear grids
      ctx.strokeStyle = `rgba(255, 0, 150, ${0.5 + beat * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(w, horizonY);
      ctx.stroke();

      for (let i = 0; i < 11; i++) {
        const xOffset = w * (i / 10);
        ctx.beginPath();
        ctx.moveTo(xOffset, h);
        ctx.lineTo(w / 2 + (xOffset - w / 2) * 0.25, horizonY);
        ctx.stroke();
      }

      drawParticles(ctx, w, h, true, beat);

    } else if (preset === 'room') {
      // 5. Cozy Study Room with warm lighting
      // Dark cozy wood paneling background
      ctx.fillStyle = '#2b1b17';
      ctx.fillRect(0, 0, w, h);

      // Window projection
      const winX = w * 0.12, winY = h * 0.08, winW = 100, winH = 140;
      const winGrad = ctx.createLinearGradient(winX, winY, winX, winY + winH);
      winGrad.addColorStop(0, '#221538');
      winGrad.addColorStop(1, '#0b0417');
      ctx.fillStyle = winGrad;
      ctx.fillRect(winX, winY, winW, winH);

      // Star moon inside window
      ctx.fillStyle = '#ffebab';
      ctx.beginPath();
      ctx.arc(winX + winW * 0.7, winY + winH * 0.35, 12, 0, Math.PI * 2);
      ctx.fill();

      // Window frames
      ctx.strokeStyle = '#543b35';
      ctx.lineWidth = 4;
      ctx.strokeRect(winX, winY, winW, winH);
      // horizontal frame
      ctx.beginPath();
      ctx.moveTo(winX, winY + winH / 2);
      ctx.lineTo(winX + winW, winY + winH / 2);
      // vertical frame
      ctx.moveTo(winX + winW / 2, winY);
      ctx.lineTo(winX + winW / 2, winY + winH);
      ctx.stroke();

      // Draw cozy ambient warm glowing lamp cone
      ctx.save();
      const lampX = w * 0.85;
      const lampY = h * 0.25;
      ctx.beginPath();
      ctx.moveTo(lampX, lampY);
      ctx.lineTo(lampX - 100, h * 0.75);
      ctx.lineTo(lampX + 100, h * 0.75);
      ctx.closePath();
      const coneGrad = ctx.createLinearGradient(lampX, lampY, lampX, h);
      coneGrad.addColorStop(0, `rgba(255, 180, 80, ${0.4 + beat * 0.15})`);
      coneGrad.addColorStop(1, 'rgba(255, 180, 80, 0.0)');
      ctx.fillStyle = coneGrad;
      ctx.fill();
      ctx.restore();

      // Fireplace in the right bottom corner
      const fireX = w * 0.88;
      const fireY = h * 0.72;
      ctx.fillStyle = '#1c1311';
      ctx.beginPath();
      ctx.arc(fireX, fireY + 10, 45, Math.PI, 0);
      ctx.fill();

      // Flickering wood flame
      for (let i = 0; i < 5; i++) {
        const fireHeight = 22 + Math.abs(Math.sin(t * 3 + i)) * 18 * (1 + beat * 0.5);
        const fireOffset = i * 8 - 16;
        ctx.fillStyle = i % 2 === 0 ? '#ff4000' : '#ff9000';
        ctx.beginPath();
        ctx.moveTo(fireX + fireOffset - 8, fireY + 12);
        ctx.quadraticCurveTo(fireX + fireOffset, fireY - fireHeight, fireX + fireOffset + 8, fireY + 12);
        ctx.fill();
      }

      // Draw firewood logs
      ctx.strokeStyle = '#3d2520';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(fireX - 22, fireY + 14);
      ctx.lineTo(fireX + 22, fireY + 16);
      ctx.moveTo(fireX - 16, fireY + 18);
      ctx.lineTo(fireX + 22, fireY + 10);
      ctx.stroke();

      // Floor base line
      ctx.strokeStyle = '#3a2723';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.78);
      ctx.lineTo(w, h * 0.78);
      ctx.stroke();

      // Room warm sparks floating
      drawParticles(ctx, w, h, false, beat);
    }
  };

  const helperFunc_1 = (w: number, target: number) => {
    return w * (target / 100);
  };
  const widthPercentToPx = (w: number, target: number) => helperFunc_1(w, target);

  // Helper particle updater/drawer
  const drawParticles = (ctx: CanvasRenderingContext2D, w: number, h: number, radialGlow: boolean, beat: number) => {
    particlesRef.current.forEach((p) => {
      // update placement
      p.x += p.speedX;
      p.y += p.speedY;

      // Wrap around wall boundaries
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h * 0.75;
      if (p.y > h * 0.78) p.y = 0;

      // Render
      ctx.save();
      const currentSize = p.size * (1 + beat * 0.5);
      
      if (radialGlow) {
        // glowing bright aura
        ctx.shadowBlur = 6 + beat * 8;
        ctx.shadowColor = p.color;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };

  // Determine speech bubble display styling classes dynamically
  const isSpeechBubbleVisible = project.speechText && project.speechText.trim().length > 0;

  // Render Axis Speed control labels / visual indicators
  const getSpeedLabel = (val: number) => {
    if (val < 0.6) return '잔잔한 클래식 (슬로우)';
    if (val < 1.0) return '기분좋은 리듬 (미디엄)';
    if (val < 1.4) return '신나는 바이브 (빠르게)';
    return '광란의 파티 (울트라 터보)';
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] rounded-2xl border border-white/10 overflow-hidden shadow-2xl glass-card relative" id="dance-view-container">
      {/* Decorative Mirror Ball SVG (matches the prototype design!) */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-16 opacity-30 pointer-events-none z-0">
        <svg className="animate-spin-slow" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="white" stroke-width="0.5" stroke-dasharray="2 2"/>
          <path d="M10 50 Q 50 10 90 50 Q 50 90 10 50" fill="none" stroke="white" stroke-width="0.5"/>
        </svg>
      </div>

      {/* Header Panel with Active Track Info */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/40 border-b border-white/10 z-10" id="dance-view-header">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-violet-600 shadow-[0_0_15px_rgba(139,92,246,0.3)] shrink-0">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block font-bold">재생 스테이지</span>
            <span className="text-sm font-bold text-white truncate max-w-[150px] sm:max-w-xs block">{project.name || '새 프로젝트'}</span>
          </div>
        </div>

        {/* Action Toggle controls */}
        <div className="flex items-center gap-2">
          {onOpenShare && (
            <button
              onClick={onOpenShare}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all transform active:scale-95 cursor-pointer shadow-md select-none"
              id="open-share-dialog-button"
            >
              <QrCode className="w-4 h-4 text-violet-400" />
              <span>QR 공유</span>
            </button>
          )}

          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 transform active:scale-95 cursor-pointer shadow-lg ${
              isPlaying
                ? 'bg-violet-600 hover:bg-violet-500 text-white neon-glow'
                : 'bg-white text-black hover:bg-gray-100 font-extrabold'
            }`}
            id="play-pause-stage-button"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-white" />
                <span>댄스 멈추기</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current animate-pulse" />
                <span>댄스 시작!</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Primary Stage rendering with Absolute Overlay speech bubble */}
      <div 
        ref={containerRef}
        className="relative flex-1 bg-black/20 flex items-center justify-center overflow-hidden min-h-[350px] z-10"
        id="dance-stage-wrapper"
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="block max-w-full max-h-full transition-all duration-500 rounded-lg outline-none"
          id="dancing-stickman-canvas"
        />

        {/* Dynamic Beat-Responsive Speech Bubble Overlay anchored near the head */}
        {isSpeechBubbleVisible && (
          <div
            className="absolute transition-all duration-75 pointer-events-none"
            style={{
              left: `${Math.min(Math.max(headPos.x + 40, 20), dimensions.width - 200)}px`,
              top: `${Math.min(Math.max(headPos.y - 75 + (beatFactor * -8), 10), dimensions.height - 120)}px`,
            }}
            id="speech-bubble-overlay"
          >
            {/* Elegant speech bubble message tail */}
            <div 
              className="relative p-4 rounded-2xl text-sm font-bold shadow-2xl animate-bounce backdrop-blur-md max-w-[200px] border border-white/20 break-all text-center"
              style={{
                backgroundColor: project.speechColor || '#ffffff',
                color: '#121212',
              }}
            >
              <span>{project.speechText}</span>
              {/* Pointing triangle offset */}
              <div 
                className="absolute w-4 h-4 -left-2 top-3/4 transform -translate-y-1/2 rotate-45"
                style={{
                  backgroundColor: project.speechColor || '#ffffff',
                  borderLeft: '1px solid rgba(255,255,255,0.15)',
                  borderBottom: '1px solid rgba(255,255,255,0.15)',
                }}
              />
            </div>
          </div>
        )}

        {/* Floating live particle/beat status on bottom center */}
        {isPlaying && (
          <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white/90 text-xs font-mono" id="visualizer-badge">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-spin" />
            <span>BEAT ACTIVE: {Math.max(1, Math.floor(beatFactor * 100))}%</span>
          </div>
        )}
      </div>

      {/* Axis Panel For Tactile Speed Dragging: '잔잔하게' --- '신나게' */}
      <div className="p-6 bg-black/40 border-t border-white/10 z-10" id="dancing-speed-axis-panel">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-violet-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">속도 조절 감도 축 (Tempo Axis)</h4>
          </div>
          <span className="text-xs font-mono bg-white/5 border border-white/10 text-violet-300 px-2.5 py-1 rounded-md">
            {project.danceSpeed.toFixed(1)}x
          </span>
        </div>

        {/* Spatial Axis Slider Track with styled slider input dot */}
        <div className="relative group py-2" id="tactile-axis-slider-group">
          {/* Axis Progress Track Background */}
          <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-violet-900/60" />
          <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${(project.danceSpeed - 0.3) / 1.7 * 100}%` }} />
          
          <input
            type="range"
            min="0.3"
            max="2.0"
            step="0.1"
            value={project.danceSpeed}
            onChange={(e) => onUpdateProject({ danceSpeed: parseFloat(e.target.value) })}
            className="relative w-full h-8 opacity-100 cursor-grab active:cursor-grabbing appearance-none bg-transparent focus:outline-none"
            id="tactile-speed-axis-input"
            style={{
              WebkitAppearance: 'none',
            }}
          />
        </div>

        {/* Axis Labels indicating Slow to Fast */}
        <div className="flex justify-between items-center text-[11px] text-gray-400 px-1 font-semibold" id="axis-labels">
          <span className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
            <span>🐢 슬로우 템포</span>
          </span>
          <span className="hidden sm:inline text-violet-400 text-[10px] font-mono uppercase tracking-widest">
            {getSpeedLabel(project.danceSpeed)}
          </span>
          <span className="flex items-center gap-1 hover:text-violet-400 transition-colors">
            <span>하이퍼 댄스 🔥</span>
          </span>
        </div>
      </div>
    </div>
  );
}
