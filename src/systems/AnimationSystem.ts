import * as THREE from 'three';

export interface AnimationState {
  isSpeaking: boolean;
  isThinking: boolean;
  audioLevel: number;
  emotion: 'neutral' | 'happy' | 'thinking' | 'surprised' | 'concerned';
}

interface BoneTargets {
  [boneName: string]: {
    rotation?: THREE.Euler;
    position?: THREE.Vector3;
  };
}

export class AnimationSystem {
  private bones: Map<string, THREE.Bone> = new Map();
  private timer = new THREE.Timer();
  private state: AnimationState = {
    isSpeaking: false,
    isThinking: false,
    audioLevel: 0,
    emotion: 'neutral',
  };

  private breathPhase = 0;
  private idlePhase = 0;
  private headDriftPhase = 0;
  private gesturePhase = 0;
  private blinkTimer = 0;
  private nextBlinkAt = 2 + Math.random() * 4;
  private isBlinking = false;
  private blinkProgress = 0;

  // Smoothed values for natural interpolation
  private smoothAudioLevel = 0;
  private smoothHeadNod = 0;
  private targetHeadNod = 0;

  init(skeleton: THREE.Skeleton) {
    for (const bone of skeleton.bones) {
      this.bones.set(bone.name, bone);
    }
  }

  setState(partial: Partial<AnimationState>) {
    Object.assign(this.state, partial);
  }

  update() {
    this.timer.update();
    const dt = this.timer.getDelta();
    const t = this.timer.getElapsed();

    this.smoothAudioLevel += (this.state.audioLevel - this.smoothAudioLevel) * Math.min(dt * 12, 1);

    this.updateBreathing(t, dt);
    this.updateIdleMotion(t, dt);
    this.updateHeadMovement(t, dt);
    this.updateSpeakingAnimation(t, dt);
    this.updateShoulders(t, dt);
    this.updateArms(t, dt);
  }

  private getBone(name: string): THREE.Bone | undefined {
    return this.bones.get(name);
  }

  private updateBreathing(t: number, dt: number) {
    this.breathPhase += dt * 0.8;
    const breathAmount = Math.sin(this.breathPhase * Math.PI * 2) * 0.003;
    const breathChest = Math.sin(this.breathPhase * Math.PI * 2) * 0.008;

    const spine = this.getBone('Spine');
    const spine1 = this.getBone('Spine1');
    const spine2 = this.getBone('Spine2');

    if (spine) {
      spine.rotation.x += breathAmount;
    }
    if (spine1) {
      spine1.rotation.x += breathChest * 0.6;
    }
    if (spine2) {
      spine2.rotation.x += breathChest;
    }
  }

  private updateIdleMotion(t: number, _dt: number) {
    const spine = this.getBone('Spine');
    if (!spine) return;

    // Subtle weight shifting
    const sway = Math.sin(t * 0.3) * 0.004 + Math.sin(t * 0.17) * 0.002;
    spine.rotation.z += sway;

    // Very subtle forward/back lean
    const lean = Math.sin(t * 0.23) * 0.003;
    spine.rotation.x += lean;
  }

  private updateHeadMovement(t: number, dt: number) {
    const head = this.getBone('Head');
    const neck = this.getBone('Neck');
    if (!head || !neck) return;

    // Base idle head drift
    const headDriftX = Math.sin(t * 0.4) * 0.015 + Math.sin(t * 0.27) * 0.008;
    const headDriftY = Math.sin(t * 0.33) * 0.02 + Math.sin(t * 0.19) * 0.01;
    const headDriftZ = Math.sin(t * 0.25) * 0.008;

    // Speaking nodding
    if (this.state.isSpeaking) {
      this.targetHeadNod = Math.sin(t * 2.5) * 0.02 * this.smoothAudioLevel +
                           Math.sin(t * 1.7) * 0.015 * this.smoothAudioLevel;
    } else {
      this.targetHeadNod = 0;
    }
    this.smoothHeadNod += (this.targetHeadNod - this.smoothHeadNod) * Math.min(dt * 8, 1);

    // Thinking look-away
    let thinkOffset = 0;
    if (this.state.isThinking) {
      thinkOffset = Math.sin(t * 0.8) * 0.04 + 0.03;
    }

    neck.rotation.x += headDriftX * 0.4 + this.smoothHeadNod * 0.3;
    neck.rotation.y += headDriftY * 0.3 + thinkOffset * 0.3;

    head.rotation.x += headDriftX * 0.6 + this.smoothHeadNod * 0.7;
    head.rotation.y += headDriftY * 0.7 + thinkOffset * 0.7;
    head.rotation.z += headDriftZ;
  }

  private updateSpeakingAnimation(t: number, _dt: number) {
    if (!this.state.isSpeaking) return;

    const level = this.smoothAudioLevel;

    // Subtle spine movement when speaking
    const spine2 = this.getBone('Spine2');
    if (spine2) {
      spine2.rotation.x += Math.sin(t * 3.1) * 0.005 * level;
      spine2.rotation.y += Math.sin(t * 2.3) * 0.004 * level;
    }

    // Hand gesture during speech
    const rightArm = this.getBone('RightArm');
    const rightForeArm = this.getBone('RightForeArm');
    if (rightArm && level > 0.3) {
      rightArm.rotation.z += Math.sin(t * 1.8) * 0.03 * level;
      rightArm.rotation.x += Math.sin(t * 2.2) * 0.02 * level;
    }
    if (rightForeArm && level > 0.3) {
      rightForeArm.rotation.x += Math.sin(t * 2.5) * 0.02 * level;
    }
  }

  private updateShoulders(t: number, _dt: number) {
    const leftShoulder = this.getBone('LeftShoulder');
    const rightShoulder = this.getBone('RightShoulder');

    const breathLift = Math.sin(this.breathPhase * Math.PI * 2) * 0.003;

    if (leftShoulder) {
      leftShoulder.rotation.z += breathLift;
    }
    if (rightShoulder) {
      rightShoulder.rotation.z -= breathLift;
    }
  }

  private updateArms(_t: number, _dt: number) {
    // Relaxed arm pose adjustment
    const leftArm = this.getBone('LeftArm');
    const rightArm = this.getBone('RightArm');
    const leftForeArm = this.getBone('LeftForeArm');
    const rightForeArm = this.getBone('RightForeArm');

    if (leftArm) {
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, 0.1, 0.02);
    }
    if (rightArm) {
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, -0.1, 0.02);
    }
    if (leftForeArm) {
      leftForeArm.rotation.y = THREE.MathUtils.lerp(leftForeArm.rotation.y, 0.15, 0.02);
    }
    if (rightForeArm) {
      rightForeArm.rotation.y = THREE.MathUtils.lerp(rightForeArm.rotation.y, -0.15, 0.02);
    }
  }

  dispose() {
    this.bones.clear();
  }
}
