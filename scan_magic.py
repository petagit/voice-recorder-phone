
import os

start_dir = '/Users/fengzhiping/Library/Developer/Xcode/DerivedData/Vecord-bfhvdseedyimlsgnxgmeopflbtjb/Build/Products/Debug-watchsimulator'
target_magic = b'\xd4\x20\x00\x00' # Little Endian D4200000? Or D4 20 00 00?
# Error said: MH_MAGIC[_64]: 0xD4200000
# If read as uint32.
# Valid MachO: FEEDFACF (FE ED FA CF) -> Little Endian CF FA ED FE.
# The user error say: 0xD4200000.
# If that's the value, the bytes are 00 00 20 D4 (Little Endian) or D4 20 00 00 (Big Endian).
# ARM64 is Little Endian.
# So bytes in file likely: 00 00 20 D4   OR   D4 20 00 00 (if printed as big endian hex).
# But BRK instruction is D4 20 00 00 (in hex view).
# Let's check both patterns.

patterns = [
    b'\xd4\x20\x00\x00',
    b'\x00\x00\x20\xd4'
]

print(f"Scanning {start_dir}...")

for root, dirs, files in os.walk(start_dir):
    for name in files:
        if name.startswith('.'): continue
        path = os.path.join(root, name)
        try:
            with open(path, 'rb') as f:
                header = f.read(4)
                if len(header) < 4: continue
                
                for p in patterns:
                    if header == p:
                        print(f"MATCH: {path}")
                        print(f"Header: {header.hex()}")
        except Exception as e:
            # print(f"Error reading {path}: {e}")
            pass
