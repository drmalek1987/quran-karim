# Writes what the base model and out\best each hear in HA's 99 clips (inspect.json) and uploads it for Claude.
import os, json, torch, soundfile as sf
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from transformers import WhisperProcessor, WhisperForConditionalGeneration, GenerationConfig
from huggingface_hub import snapshot_download, HfApi
base = snapshot_download('deepdml/whisper-base-ar-quran-mix-norm'); proc = WhisperProcessor.from_pretrained(base)
gc = GenerationConfig.from_pretrained('openai/whisper-base'); items = json.load(open('ha_test/meta-ha.json', encoding='utf8'))
out = [{'id': x['id'], 'ref': x['text'], 'sec': round(len(sf.read('ha_test/%s.wav' % x['id'])[0]) / 16000, 1)} for x in items]
for name, path in (('base', base), ('new', 'out/best')):
    m = WhisperForConditionalGeneration.from_pretrained(path).cuda().eval(); m.generation_config = gc
    for o in out:
        f = proc.feature_extractor(sf.read('ha_test/%s.wav' % o['id'], dtype='float32')[0], sampling_rate=16000, return_tensors='pt').input_features.cuda()
        with torch.no_grad(): o[name] = proc.batch_decode(m.generate(f, language='ar', task='transcribe', max_new_tokens=200, no_repeat_ngram_size=3), skip_special_tokens=True)[0]
    print(name, 'done', flush=True)
json.dump(out, open('inspect.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
api = HfApi(token=open('hf_write_token.txt').read().strip()); repo = api.whoami()['name'] + '/quran-train-progress'
api.upload_file(path_or_fileobj='inspect.json', path_in_repo='inspect.json', repo_id=repo, repo_type='dataset'); print('uploaded inspect.json')
