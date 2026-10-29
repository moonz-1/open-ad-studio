export type Capability = { name: string; status: 'ready' | 'prompt' | 'unavailable'; detail: string; control?: 'motion' | 'shotPromptInput' | 'kp' | 'els' | 'timeline' };
export type ModelChoice = {
  id: string; parentId?:string;loraFile?:string;label: string; family: string; description: string;
  capabilities: Capability[];
  generation?:{preferredFps?:number;fpsNote?:string;steps:number;stepNote:string};
  timing: { low: number; high: number; width: number; height: number; duration?: number; basis: string };
};
const common: Capability[] = [
  { name: 'JSON posing', status: 'unavailable', detail: 'No structured pose parser or pose-control workflow connected.' },
  { name: 'Elements', status: 'prompt', control: 'els', detail: 'Names/descriptions enter the prompt; reference identity conditioning is not connected.' },
  { name: 'LoRA stylization', status: 'unavailable', detail: 'Adapter loading is not connected to this app workflow yet. Compatibility requires the correct base model.' },
];
export const imageModel: ModelChoice = {
  id: 'z_image_turbo_bf16.safetensors', label: 'Z-Image Turbo', family: 'Z-Image',
  description: 'Fast local text-to-image keyframes · 8 steps',
  generation:{steps:8,stepNote:'Z-Image Turbo is distilled for few-step sampling. This connected workflow uses an 8-step preset; more steps are not automatically better.'},
  capabilities: [{ name: 'Text to image', status: 'ready', control: 'kp', detail: 'Generate a keyframe from a text prompt.' }, ...common,
    { name: 'Reference image editing', status: 'unavailable', detail: 'Current workflow starts from noise; it does not edit the selected image.' }],
  timing: { low: 7, high: 20, width: 768, height: 448, basis: 'Prior local RTX 4070 Super runs, including cold-load variation. Approximate; excludes queue time.' },
};
export const videoModel: ModelChoice = {
  id: 'ltxv-2b-0.9.8-distilled.safetensors', label: 'LTX-Video 2B · distilled', family: 'LTX-Video 0.9.8',
  description: 'Local development video model · 8 steps · 24 fps',
  generation:{preferredFps:30,fpsNote:'30 FPS is the published LTX-Video default; 24 FPS is our tested local preset. Other FPS values remain editable.',steps:8,stepNote:'This distilled LTX workflow uses an 8-step sampling preset. Step count and scheduler must suit the checkpoint; more steps are not automatically better.'},
  capabilities: [{ name: 'Shot prompt', status: 'ready', control: 'shotPromptInput', detail: 'Describe the scene and visual details. The workflow combines this with your motion instructions in its text conditioning.' },
    { name: 'Keyframe-guided video', status: 'ready', control: 'timeline', detail: 'Up to eight timed image guides; guidance does not guarantee exact reproduction.' },
    { name: 'Motion prompt', status: 'ready', control: 'motion', detail: 'Text describes desired motion; no exact camera trajectory control.' }, ...common],
  timing: { low: 15, high: 35, width: 768, height: 448, duration: 4, basis: 'Prior local RTX 4070 Super runs. Scaled approximately by generated frame count; excludes queue time.' },
};

// Higher-quality packs (see models.json). Timings are rough until local renders are measured.
export const qwenImageModel: ModelChoice = {
  id: 'qwen_image_2512_fp8_e4m3fn.safetensors', label: 'Qwen-Image 2512', family: 'Qwen-Image',
  description: 'Best-quality local text-to-image · 50 steps · strong text rendering',
  generation:{steps:50,stepNote:'Official Qwen-Image 2512 settings: 50 steps, CFG 4. Slower than Z-Image, with much higher detail and prompt adherence.'},
  capabilities: [{ name: 'Text to image', status: 'ready', control: 'kp', detail: 'Generate a keyframe from a text prompt, including legible in-image text.' }, ...common],
  timing: { low: 40, high: 180, width: 1328, height: 1328, basis: 'Estimate for a 24 GB+ GPU; not yet measured locally. Excludes model loading and queue time.' },
};
export const zImageBaseModel: ModelChoice = {
  id: 'z_image_bf16.safetensors', label: 'Z-Image', family: 'Z-Image',
  description: 'High-quality local text-to-image · 50 steps',
  generation:{steps:50,stepNote:'Official Z-Image (base) settings: 50 steps, CFG 4. The Turbo model trades this quality for 8-step speed.'},
  capabilities: [{ name: 'Text to image', status: 'ready', control: 'kp', detail: 'Generate a keyframe from a text prompt.' }, ...common],
  timing: { low: 25, high: 90, width: 768, height: 448, basis: 'Estimate from the 8-step Turbo timing scaled to 50 steps with CFG; not yet measured locally.' },
};
export const ltx25Model: ModelChoice = {
  id: 'ltx-2.5-22b-distilled-transformer-bf16.safetensors', label: 'LTX-2.5 22B · distilled', family: 'LTX-2.5',
  description: 'Best-quality local video · two-stage with 2× latent upscale',
  generation:{preferredFps:24,fpsNote:'The official LTX-2.5 two-stage workflow renders at 24 FPS.',steps:11,stepNote:'Official distilled two-stage preset: 8 steps at half resolution, then 3 refinement steps after the 2× latent upscale.'},
  capabilities: [{ name: 'Shot prompt', status: 'ready', control: 'shotPromptInput', detail: 'Describe the scene and visual details.' },
    { name: 'Start-frame guide', status: 'ready', control: 'timeline', detail: 'The first keyframe becomes the opening frame. Additional keyframes are not used by this workflow; use LTX-Video 13B for multi-keyframe shots.' },
    { name: 'Motion prompt', status: 'ready', control: 'motion', detail: 'Text describes desired motion; no exact camera trajectory control.' }, ...common],
  timing: { low: 60, high: 300, width: 768, height: 448, duration: 4, basis: 'Estimate for a 32 GB+ GPU; not yet measured locally. Excludes model loading and queue time.' },
};
export const ltxv13bModel: ModelChoice = {
  ...videoModel,
  id: 'ltxv-13b-0.9.8-distilled-fp8.safetensors', label: 'LTX-Video 13B · distilled', family: 'LTX-Video 0.9.8',
  description: 'High-quality local video · keyframe guides · 8 steps',
  timing: { low: 45, high: 150, width: 768, height: 448, duration: 4, basis: 'Estimate scaled from the 2B model by parameter count; not yet measured locally.' },
};
