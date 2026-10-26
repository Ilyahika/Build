import subprocess
import sys
import unittest
from pathlib import Path
class GameplayTests(unittest.TestCase):
    def test_transactional_gameplay(self):
        result=subprocess.run([sys.executable,str(Path(__file__).with_name('scenario.py'))],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
