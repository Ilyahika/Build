"""Protect against the original bug: a fish name pointing at an unrelated atlas cell."""
import json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from fishing import FISH,LOCATIONS
from catalog_v11 import SPECIES
class FishAssetTests(unittest.TestCase):
 def test_species_asset_mapping(self):
  manifest=json.loads((ROOT/'assets/fish_manifest_v12.json').read_text())
  self.assertEqual(len(manifest),120)
  cells=set()
  for li,loc in enumerate(LOCATIONS):
   rows=[f for f in FISH if f['location']==loc['key']]
   for i,f in enumerate(rows):
    a=manifest[f['key']]
    self.assertEqual(f['name'],SPECIES[loc['key']][i][0])
    self.assertEqual(a['name'],f['name'])
    self.assertEqual(a['atlas'],f'fish12_{li*4+i//6:02d}')
    self.assertEqual(a['rect'],[i%6%3*512,i%6//3*512,512,512])
    self.assertEqual(f['art']['atlas'],a['atlas'])
    cell=(a['atlas'],tuple(a['rect']));self.assertNotIn(cell,cells);cells.add(cell)
 def test_transparent_local_webp_assets(self):
  for i in range(20):
   data=(ROOT/f'assets/fish12_{i:02d}.webp').read_bytes()
   self.assertEqual(data[:4],b'RIFF');self.assertEqual(data[8:12],b'WEBP')
   self.assertEqual(data[12:16],b'VP8X')
   self.assertTrue(data[20]&0x10,'Transparent alpha channel missing')
   self.assertEqual(int.from_bytes(data[24:27],'little')+1,1536)
   self.assertEqual(int.from_bytes(data[27:30],'little')+1,1024)
