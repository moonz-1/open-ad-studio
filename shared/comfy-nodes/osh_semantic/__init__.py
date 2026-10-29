"""Local CPU semantic ranking; Apache-2.0 MiniLM weights, no network at inference."""
import json
import os
import uuid
from functools import lru_cache
import folder_paths

MODEL = os.path.join(folder_paths.models_dir, 'sentence_transformers', 'all-MiniLM-L6-v2')


class OSHSemanticSearch:
    @classmethod
    def INPUT_TYPES(cls):
        ready = all(os.path.isfile(os.path.join(MODEL, name)) for name in ['config.json', 'model.safetensors', 'tokenizer.json'])
        return {'required': {'query': ('STRING',), 'documents': ('STRING',), 'model': (['MiniLM L6 · CPU'] if ready else [],)}}

    RETURN_TYPES = ()
    FUNCTION = 'search'
    OUTPUT_NODE = True
    CATEGORY = 'Studio/Search'

    def search(self, query, documents, model):
        if model != 'MiniLM L6 · CPU' or not query.strip() or len(query) > 256:
            raise ValueError('Choose a local semantic model and a query under 256 characters.')
        docs = json.loads(documents)
        if not isinstance(docs, list) or not 1 <= len(docs) <= 128 or any(not isinstance(d, str) or len(d) > 1200 for d in docs):
            raise ValueError('Search accepts up to 128 local text descriptions.')
        import torch
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        query_vector = embedding(query)
        scores = [(query_vector * embedding(text)).sum().item() for text in docs]
        folder = os.path.join(folder_paths.get_output_directory(), 'osh_semantic')
        os.makedirs(folder, exist_ok=True)
        filename = uuid.uuid4().hex + '.json'
        with open(os.path.join(folder, filename), 'x', encoding='utf-8') as output:
            json.dump({'model': model, 'scores': scores}, output)
        return {'ui': {'text': [{'filename': filename, 'subfolder': 'osh_semantic', 'type': 'output'}]}}


@lru_cache(maxsize=1)
def engine():
    from transformers import AutoTokenizer, AutoModel
    return (AutoTokenizer.from_pretrained(MODEL, local_files_only=True),
            AutoModel.from_pretrained(MODEL, local_files_only=True, use_safetensors=True).to('cpu').eval())


@lru_cache(maxsize=512)
def embedding(text):
    import torch
    import torch.nn.functional as F
    tokenizer, encoder = engine()
    tokens = tokenizer(text, padding=True, truncation=True, max_length=256, return_tensors='pt')
    with torch.inference_mode():
        output = encoder(**tokens).last_hidden_state
        mask = tokens['attention_mask'].unsqueeze(-1).expand(output.size()).float()
        return F.normalize((output * mask).sum(1) / mask.sum(1).clamp(min=1e-9), p=2, dim=1)[0]


NODE_CLASS_MAPPINGS = {'OSHSemanticSearch': OSHSemanticSearch}
NODE_DISPLAY_NAME_MAPPINGS = {'OSHSemanticSearch': 'Studio · semantic search (CPU)'}
