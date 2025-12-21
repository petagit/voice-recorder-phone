
import sys
import re

def parse_pbxproj():
    try:
        with open('ios/Vecord.xcodeproj/project.pbxproj', 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"Error: {e}")
        return

    # Helper to extract section content
    def get_section(name):
        start = content.find(f'/* Begin {name} section */')
        end = content.find(f'/* End {name} section */')
        if start == -1 or end == -1: return ""
        return content[start:end]

    native_targets = get_section("PBXNativeTarget")
    sources_phases = get_section("PBXSourcesBuildPhase")
    build_files = get_section("PBXBuildFile")
    file_refs = get_section("PBXFileReference")

    # 1. Find WatchApp Target ID
    # usage: 13B07F861A680F5B00A75B9A /* Vecord */ = { ... productName = Vecord; ... };
    # usage: [ID] /* WatchApp */ = { ... productName = WatchApp; ... };
    
    watch_target_id = None
    ios_target_id = None
    
    # Regex to find targets
    # ID /* Name */ = { ... productName = Name; ... };
    target_pattern = re.compile(r'([0-9A-F]{24}) /\* (.*?) \*/ = \{.*?productName = (.*?);', re.DOTALL)
    
    for match in target_pattern.finditer(native_targets):
        tid, name, prod_name = match.groups()
        print(f"Found Target: {name} (ID: {tid}, Product: {prod_name})")
        if "WatchApp" in name or "WatchApp" in prod_name:
            watch_target_id = tid
        elif "Vecord" in name:
            ios_target_id = tid

    if not watch_target_id:
        print("CRITICAL: WatchApp target not found in PBXNativeTarget.")
        return

    # 2. Get Build Phases for WatchApp Target
    # We need to extract the 'buildPhases = ( ... );' block for this target.
    # It's tricky with regex on the whole file, let's look at the specific block in native_targets
    
    target_block_start = native_targets.find(watch_target_id)
    target_block_end = native_targets.find("};", target_block_start)
    target_block = native_targets[target_block_start:target_block_end]
    
    # Extract buildPhases IDs
    bp_match = re.search(r'buildPhases = \((.*?)\);', target_block, re.DOTALL)
    if not bp_match:
        print("CRITICAL: No build phases found for WatchApp target.")
        return
        
    bp_ids = [x.strip().split()[0] for x in bp_match.group(1).split(',')]
    print(f"WatchApp Target Build Phases: {bp_ids}")

    # 3. Find the Sources Build Phase ID among them
    watch_sources_phase_id = None
    for bp_id in bp_ids:
        # Check if this ID exists in PBXSourcesBuildPhase section
        if bp_id in sources_phases:
            watch_sources_phase_id = bp_id
            print(f"Found WatchApp Sources Phase: {bp_id}")
            break
    
    if not watch_sources_phase_id:
        print("CRITICAL: WatchApp target is missing a PBXSourcesBuildPhase.")
        return

    # 4. List files in this Sources Phase
    # Find the phase definition in sources_phases
    phase_start = sources_phases.find(watch_sources_phase_id)
    phase_end = sources_phases.find("};", phase_start)
    phase_block = sources_phases[phase_start:phase_end]
    
    files_match = re.search(r'files = \((.*?)\);', phase_block, re.DOTALL)
    if not files_match:
        print("WatchApp Sources Phase is EMPTY.")
        return
        
    file_ids = [x.strip().split()[0] for x in files_match.group(1).split(',')]
    
    print(f"Files in WatchApp Sources Phase: {len(file_ids)}")
    
    # 5. Check if WatchApp.swift is in there
    # We need to resolve BuildFileID -> FileRefID -> Name
    found_swift = False
    for build_file_id in file_ids:
        # Find BuildFile entry
        bf_start = build_files.find(build_file_id)
        bf_end = build_files.find("};", bf_start)
        bf_block = build_files[bf_start:bf_end]
        
        # Extract fileRef
        fr_match = re.search(r'fileRef = ([0-9A-F]{24})', bf_block)
        if fr_match:
            fr_id = fr_match.group(1)
            # Find FileRef entry to get name
            fr_start = file_refs.find(fr_id)
            fr_line = file_refs[fr_start:].split('\n')[0]
            
            if "WatchApp.swift" in fr_line:
                print(f"SUCCESS: WatchApp.swift Found in WatchApp Target! (BuildFile: {build_file_id})")
                found_swift = True
            elif "ConnectivityProvider.swift" in fr_line:
                print(f"Found ConnectivityProvider.swift ({build_file_id})")
            elif "ContentView.swift" in fr_line:
                print(f"Found ContentView.swift ({build_file_id})")

    if not found_swift:
        print("FAILURE: WatchApp.swift is NOT in the WatchApp Target sources.")

if __name__ == "__main__":
    parse_pbxproj()
