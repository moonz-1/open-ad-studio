"""CPU fixtures only: hardware failures and finally-cleanup, no provider calls."""
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import Mock, patch


def load(name):
    path = pathlib.Path(__file__).with_name(name + '.py')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


h = load('qwen-preflight')
runner = load('qwen-execute')


class HardwareTests(unittest.TestCase):
    def setUp(self):
        self.stats = {'torch': '2.10.0+cu128', 'cuda': True, 'deviceCount': 1,
                      'gpuName': 'NVIDIA A40', 'vramBytes': 47699722240,
                      'cpuCount': 9, 'ramBytes': 50 * 1000 ** 3,
                      'diskFreeBytes': 79 * 1000 ** 3}

    def test_captured_a40_memory_passes_corrected_floor(self):
        # CUDA-visible bytes captured on the second approved A40 attempt.
        # Replay on CPU; this test itself neither allocates nor measures a GPU.
        self.assertLess(self.stats['vramBytes'], 45 * h.GIB)
        h.validate_hardware(self.stats)

    def test_bad_allocations_remain_rejected_with_named_diagnostics(self):
        for field, value, diagnostic in [
            ('torch', '2.8.0', 'Torch'), ('cuda', False, 'CUDA'),
            ('deviceCount', 2, 'single device'), ('gpuName', 'A100', 'identity'),
            ('vramBytes', 40 * h.GIB, 'VRAM'), ('cpuCount', 4, 'CPU'),
            ('ramBytes', 32 * 1000 ** 3, 'RAM'), ('diskFreeBytes', 50 * 1000 ** 3, 'workspace'),
        ]:
            with self.subTest(field=field), self.assertRaisesRegex(RuntimeError, diagnostic):
                h.validate_hardware(self.stats | {field: value})


class CleanupTests(unittest.TestCase):
    def exercise(self, failure, campaign=False):
        with tempfile.TemporaryDirectory() as folder:
            out = pathlib.Path(folder)
            lease = {'version': 1, 'podId': 'owned', 'name': 'adstudio-qwen2511-fixture',
                     'created': time.time() - 100, 'deadline': time.time() + 7000,
                     'gpuRate': .59, 'storageHourly': .02, 'cap': 2, 'image': 'pinned'}
            (out / 'lease.json').write_text(json.dumps(lease))
            kinds = ['authenticity','intimate','campaign'] if campaign else ['lighting','cinematic']
            (out / 'plan.json').write_text(json.dumps({'cases':[{'id':k} for k in kinds]}))
            calls = []
            deleted = False

            def api(path, method='GET', body=None):
                nonlocal deleted
                calls.append(method)
                self.assertEqual(path, '/pods/owned')
                if method == 'DELETE':
                    deleted = True
                    return 204, None
                return (404, None) if deleted else (200, {'id': 'owned', 'name': lease['name']})

            def command(args, **kwargs):
                if '--check-plan' in args:
                    return
                render = any('qwen-render-runpod.mjs' in str(arg) for arg in args)
                setup = '--collect' not in args and not render
                if (failure == 'setup' and setup) or (failure == 'render' and render):
                    raise subprocess.CalledProcessError(1, 'fixture')
                if failure == 'interrupt' and setup:
                    raise KeyboardInterrupt()
                if render:
                    for kind in kinds:
                        target = out / 'candidates' / kind
                        target.mkdir(parents=True)
                        data = b'fixture output; this test does not claim inference'
                        (target / 'raw.png').write_bytes(data)
                        (target / 'render.json').write_text(json.dumps({
                            'status': 'complete', 'rawSha256': hashlib.sha256(data).hexdigest(),
                            'podId': 'owned'}))

            tunnel = Mock()
            tunnel.poll.return_value = None
            response = Mock()
            response.__enter__ = Mock(return_value=Mock(status=200))
            response.__exit__ = Mock(return_value=False)
            with patch.object(runner.g, 'OUT', out), patch.object(runner.g, 'load_key'), \
                    patch.object(runner.g, 'request', side_effect=api), \
                    patch.object(runner.subprocess, 'run', side_effect=command), \
                    patch.object(runner.subprocess, 'Popen', return_value=tunnel), \
                    patch('urllib.request.urlopen', return_value=response), \
                    patch.object(sys, 'argv', ['qwen-execute.py', '--approved'] + (['--plan',str(out/'plan.json')] if campaign else [])):
                if failure:
                    with self.assertRaises(KeyboardInterrupt if failure == 'interrupt' else subprocess.CalledProcessError):
                        runner.main()
                else:
                    runner.main()
            self.assertTrue(deleted)
            self.assertEqual(calls, ['GET', 'DELETE', 'GET'])
            record = json.loads((out / 'execution.json').read_text())
            self.assertEqual(record['termination'], 'VERIFIED_404')
            self.assertLess(record['conservativeCostUpperEstimateUSD'], 2)
            self.assertEqual(record['status'], 'failed' if failure else ('three-images-collected' if campaign else 'two-images-collected'))
            if failure not in ['setup', 'interrupt']:
                tunnel.terminate.assert_called_once()

    def test_setup_failure_terminates(self):
        self.exercise('setup')

    def test_render_failure_terminates(self):
        self.exercise('render')

    def test_keyboard_interrupt_terminates(self):
        self.exercise('interrupt')

    def test_verified_collection_terminates(self):
        self.exercise(None)

    def test_three_concept_collection_terminates(self):
        self.exercise(None, campaign=True)

    def test_three_concept_render_failure_terminates(self):
        self.exercise('render', campaign=True)


if __name__ == '__main__':
    unittest.main()
