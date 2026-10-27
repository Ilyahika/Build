import subprocess
import sys
import unittest
from pathlib import Path
class GameplayTests(unittest.TestCase):
    def test_transactional_gameplay(self):
        result=subprocess.run([sys.executable,str(Path(__file__).with_name('v11_scenario.py'))],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_rewards_attempts_chat(self):
        result=subprocess.run([sys.executable,str(Path(__file__).with_name('community_scenario.py'))],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_v10_migration_and_concurrency(self):
        result=subprocess.run([sys.executable,str(Path(__file__).with_name('migration_scenario.py'))],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
