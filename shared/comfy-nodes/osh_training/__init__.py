"""Studio's bounded dataset and result nodes around ComfyUI native training."""
import json
import os
import re
import shutil
import folder_paths


class OSHTrainingPairs:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'images': ('IMAGE',), 'captions': ('STRING',)}}
    RETURN_TYPES = ('IMAGE', 'STRING')
    OUTPUT_IS_LIST = (True, True)
    FUNCTION = 'pairs'
    CATEGORY = 'Studio/Training'

    def pairs(self, images, captions):
        texts = json.loads(captions)
        if not 1 <= len(texts) <= 24 or len(texts) != images.shape[0] or any(not isinstance(text, str) or not text.strip() or len(text) > 1000 for text in texts):
            raise ValueError('Each training image needs its own caption.')
        return ([images[i:i + 1] for i in range(len(texts))], texts)


class OSHSaveTraining:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'lora': ('LORA_MODEL',), 'loss': ('LOSS_MAP',), 'steps': ('INT',), 'run_id': ('STRING',), 'name': ('STRING',), 'base': ('STRING',)}}
    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = 'save'
    CATEGORY = 'Studio/Training'

    def save(self, lora, loss, steps, run_id, name, base):
        if not re.fullmatch('[a-f0-9]{32}', run_id) or base not in ('z_image_turbo_bf16.safetensors', 'ltxv-2b-0.9.8-distilled.safetensors', 'hunyuan3d-dit-v2-mini.safetensors') or not lora:
            raise ValueError('Invalid training result or incompatible base.')
        import safetensors.torch
        output = os.path.join(folder_paths.get_output_directory(), 'osh_training')
        os.makedirs(output, exist_ok=True)
        weight_name = run_id + '.safetensors'
        weight_path = os.path.join(output, weight_name)
        if os.path.exists(weight_path):
            raise ValueError('This training result already exists.')
        safetensors.torch.save_file(lora, weight_path, metadata={'studio_run': run_id, 'base_model': base, 'name': name})
        folders = folder_paths.get_folder_paths('loras')
        adapter_folder = os.path.join(folders[0] if folders else os.path.join(folder_paths.models_dir, 'loras'), 'studio')
        os.makedirs(adapter_folder, exist_ok=True)
        shutil.copyfile(weight_path, os.path.join(adapter_folder, weight_name))
        points = []
        history = list(enumerate(loss.get('loss', []))) if isinstance(loss.get('loss'), list) else list(loss.items())
        for step, value in history[-500:]:
            try:
                number = float(value)
                if number == number and abs(number) < 1e20:
                    points.append({'step': int(step), 'loss': number})
            except (TypeError, ValueError):
                pass
        metadata = {'id': run_id, 'base': base, 'steps': int(steps), 'loraFile': 'studio/' + weight_name, 'loss': points}
        filename = run_id + '.json'
        with open(os.path.join(output, filename), 'x', encoding='utf-8') as handle:
            json.dump(metadata, handle)
        return {'ui': {'text': [{'filename': filename, 'subfolder': 'osh_training', 'type': 'output'}, {'filename': weight_name, 'subfolder': 'osh_training', 'type': 'output'}]}}


class OSHVideoTrainingDataset:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'video': ('VIDEO',), 'vae': ('VAE',), 'clip': ('CLIP',), 'caption': ('STRING',), 'size': ('INT', {'default': 256, 'min': 256, 'max': 512, 'step': 32}), 'frames': ('INT', {'default': 17, 'min': 9, 'max': 49, 'step': 8}), 'fps': ('INT', {'default': 24, 'min': 1, 'max': 60})}}
    RETURN_TYPES = ('LATENT', 'CONDITIONING')
    OUTPUT_IS_LIST = (True, True)
    FUNCTION = 'encode'
    CATEGORY = 'Studio/Training'

    def encode(self, video, vae, clip, caption, size, frames, fps):
        import math
        import comfy.utils
        from comfy_extras.nodes_dataset import _decode_selected_frames
        if not caption.strip() or len(caption) > 1000 or (frames - 1) % 8 or not 9 <= frames <= 49 or size % 32 or not 256 <= size <= 512 or not 1 <= fps <= 60:
            raise ValueError('Invalid video training settings.')
        source_fps = float(video.get_frame_rate())
        if not math.isfinite(source_fps) or source_fps <= 0:
            raise ValueError('Cannot read source frame rate.')
        indices = [round(i * source_fps / fps) for i in range(frames)]
        if indices[-1] >= video.get_frame_count():
            raise ValueError('Clip is too short for the chosen frame count and FPS.')
        images = _decode_selected_frames(video, indices).get_components().images
        images = comfy.utils.common_upscale(images.movedim(-1, 1), size, size, 'area', 'center').movedim(1, -1)
        samples = vae.encode(images[:, :, :, :3])
        positive = clip.encode_from_tokens_scheduled(clip.tokenize(caption))
        positive = [[tensor, {**metadata, 'frame_rate': fps}] for tensor, metadata in positive]
        return ([{'samples': samples}], [positive])


class OSHTrainingConcat:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'latents_a': ('LATENT',), 'positive_a': ('CONDITIONING',), 'latents_b': ('LATENT',), 'positive_b': ('CONDITIONING',)}}
    RETURN_TYPES = ('LATENT', 'CONDITIONING')
    INPUT_IS_LIST = True
    OUTPUT_IS_LIST = (True, True)
    FUNCTION = 'concat'
    CATEGORY = 'Studio/Training'

    def concat(self, latents_a, positive_a, latents_b, positive_b):
        if len(latents_a) != len(positive_a) or len(latents_b) != len(positive_b) or len(latents_a) + len(latents_b) > 24:
            raise ValueError('Invalid paired training dataset.')
        return (latents_a + latents_b, positive_a + positive_b)


class OSH3DTrainingDataset:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'image': ('IMAGE',), 'clip_vision': ('CLIP_VISION',), 'mesh_obj': ('STRING',), 'seed': ('INT', {'default': 7, 'min': 0, 'max': 2147483647})}}
    RETURN_TYPES = ('LATENT', 'CONDITIONING')
    OUTPUT_IS_LIST = (True, True)
    FUNCTION = 'encode'
    CATEGORY = 'Studio/Training'

    def encode(self, image, clip_vision, mesh_obj, seed):
        import numpy as np
        import torch
        import comfy.model_management
        from comfy.ldm.hunyuan3d.vae import ShapeVAE
        if len(mesh_obj) > 5 * 1024 * 1024:
            raise ValueError('Training OBJ exceeds 5 MB.')
        vertices, faces = [], []
        for line in mesh_obj.splitlines():
            parts = line.split()
            if not parts:
                continue
            if parts[0] == 'v' and len(parts) >= 4:
                vertices.append([float(n) for n in parts[1:4]])
            elif parts[0] == 'f' and len(parts) >= 4:
                indices = [int(p.split('/')[0]) for p in parts[1:]]
                indices = [i - 1 if i > 0 else len(vertices) + i for i in indices]
                faces.extend([[indices[0], indices[i], indices[i + 1]] for i in range(1, len(indices) - 1)])
            if len(vertices) > 100000 or len(faces) > 200000:
                raise ValueError('Training mesh is too complex; simplify a copy first.')
        v = np.asarray(vertices, dtype=np.float32)
        f = np.asarray(faces, dtype=np.int64)
        if not len(v) or not len(f) or not np.isfinite(v).all() or f.min() < 0 or f.max() >= len(v):
            raise ValueError('Choose a valid OBJ with finite vertices and triangle faces.')
        extent = np.max(v.max(axis=0) - v.min(axis=0))
        if not np.isfinite(extent) or extent <= 0:
            raise ValueError('Training mesh has no volume bounds.')
        v = (v - (v.max(axis=0) + v.min(axis=0)) / 2) * (1.9 / extent)
        triangles = v[f]
        cross = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
        area = np.linalg.norm(cross, axis=1)
        if not np.isfinite(area).all() or area.sum() <= 0:
            raise ValueError('Training mesh has no nondegenerate surface.')
        rng = np.random.default_rng(seed)
        face_ids = rng.choice(len(f), size=81920, p=area / area.sum())
        selected = triangles[face_ids]
        uv = rng.random((81920, 2))
        outside = uv.sum(axis=1) > 1
        uv[outside] = 1 - uv[outside]
        points = selected[:, 0] + uv[:, :1] * (selected[:, 1] - selected[:, 0]) + uv[:, 1:] * (selected[:, 2] - selected[:, 0])
        normals = cross[face_ids] / area[face_ids, None]
        surface = np.concatenate([points, normals, np.zeros((81920, 1))], axis=1)
        if not np.isfinite(surface).all():
            raise ValueError('Training mesh has invalid surface normals.')
        path = folder_paths.get_full_path_or_raise('vae', 'hunyuan3d-vae-v2-mini-withencoder.ckpt')
        encoder = ShapeVAE(num_latents=512, scale_factor=1.0188137142395404)
        encoder.pre_kl = torch.nn.Linear(1024, 128)
        encoder.load_state_dict(torch.load(path, map_location='cpu', weights_only=True), strict=True)
        # The native point sampler currently creates CPU indices. Keep this
        # frozen preprocessing encoder on CPU; diffusion training still uses GPU.
        device = torch.device('cpu')
        # Evict cached generation models before this frozen mesh encoder runs.
        comfy.model_management.unload_all_models()
        encoder.eval().requires_grad_(False).to(device=device, dtype=torch.float32)
        try:
            with torch.inference_mode(), torch.random.fork_rng(devices=[device] if device.type == 'cuda' else []):
                torch.manual_seed(seed)
                latent = encoder.encode(torch.from_numpy(surface.astype(np.float32))[None].to(device)).movedim(-1, -2).cpu()
        finally:
            encoder.to('cpu')
            del encoder
            comfy.model_management.soft_empty_cache()
        vision = clip_vision.encode_image(image[:1])
        return ([{'samples': latent, 'type': 'hunyuan3dv2'}], [[[vision.last_hidden_state, {}]]])


class OSHSaveGeometry:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'mesh': ('MESH',), 'filename_prefix': ('STRING', {'default': 'osh/shape'})}}
    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = 'save'
    CATEGORY = 'Studio/3D'

    def save(self, mesh, filename_prefix):
        from comfy_extras.nodes_save_3d import mesh_item_to_glb_bytes
        output, name, counter, subfolder, _ = folder_paths.get_save_image_path('osh/shape', folder_paths.get_output_directory())
        data = mesh_item_to_glb_bytes(mesh, 0, {})
        if data is None:
            raise ValueError('Geometry generation returned an empty mesh.')
        filename = f'{name}_{counter:05}_.glb'
        with open(os.path.join(output, filename), 'xb') as handle:
            handle.write(data)
        # The SDK currently ignores native UI "3d" outputs. Its file-output
        # descriptor contract is supported without bypassing SDK/proxy transport.
        return {'ui': {'text': [{'filename': filename, 'subfolder': subfolder, 'type': 'output'}]}}


NODE_CLASS_MAPPINGS = {'OSHTrainingPairs': OSHTrainingPairs, 'OSHSaveTraining': OSHSaveTraining, 'OSHVideoTrainingDataset': OSHVideoTrainingDataset, 'OSHTrainingConcat': OSHTrainingConcat, 'OSH3DTrainingDataset': OSH3DTrainingDataset, 'OSHSaveGeometry': OSHSaveGeometry}
NODE_DISPLAY_NAME_MAPPINGS = {'OSHTrainingPairs': 'Studio · training image/caption pairs', 'OSHSaveTraining': 'Studio · save LoRA and training result'}
