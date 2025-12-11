
import sys
import re

def check_project():
    try:
        with open('ios/Vecord.xcodeproj/project.pbxproj', 'r') as f:
            content = f.read()
    except:
        print("Could not open project.pbxproj")
        return

    # 1. Find WatchApp.swift file ref ID
    # 7A385AAB1C9F421286ECF6A9 /* WatchApp.swift */ = {isa = PBXFileReference ...
    file_ref_match = re.search(r'([0-9A-F]{24}) /\* WatchApp.swift \*/ = {isa = PBXFileReference', content)
    if not file_ref_match:
        print("WatchApp.swift file reference not found in project.")
        return
    file_ref_id = file_ref_match.group(1)
    print(f"WatchApp.swift File Ref ID: {file_ref_id}")

    # 2. Find PBXBuildFile that points to this File Ref
    # [ID] /* WatchApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = [FileRefID]; ... };
    build_file_pattern = re.compile(r'([0-9A-F]{24}) /\* WatchApp.swift in Sources \*/ = {isa = PBXBuildFile; fileRef = ' + file_ref_id)
    build_file_match = build_file_pattern.search(content)
    
    if not build_file_match:
        print("WatchApp.swift does NOT have a PBXBuildFile entry (not prepared for build phases).")
        # Proceed to check phases anyway to be sure
        build_file_id = None
    else:
        build_file_id = build_file_match.group(1)
        print(f"WatchApp.swift Build File ID: {build_file_id}")

    # 3. Find WatchApp Target
    # Find target by name
    # targets = ( ... );
    # ...
    # [TargetID] /* WatchApp */ = { ... buildPhases = ( ... ); ... };
    
    # We need to find the PBXNativeTarget section
    # Simplified regex to find WatchApp target ID
    target_match = re.search(r'([0-9A-F]{24}) /\* WatchApp \*/ = {isa = PBXNativeTarget;', content)
    if not target_match:
         print("WatchApp target not found")
         return
    target_id = target_match.group(1)
    print(f"WatchApp Target ID: {target_id}")

    # 4. Find the Sources Build Phase for this target
    # We need to parse the target definition to find buildPhases
    # This is hard with regex.
    # Let's just search for the Sources phase definition and see if our build file is in it.
    
    # Sources Build Phase usually looks like:
    # [PhaseID] /* Sources */ = {
    #   isa = PBXSourcesBuildPhase;
    #   buildActionMask = ...;
    #   files = (
    #       [BuildFileID] /* ... */,
    #   );
    #   runOnlyForDeploymentPostprocessing = 0;
    # };
    
    # If we have a Build File ID, we can check if it appears inside files = ( ... ) of ANY Sources phase.
    # Ideally satisfy that it's the WatchApp's phase, but just existence is a good start.

    if build_file_id:
        if re.search(build_file_id + r' /\* WatchApp.swift in Sources \*/,', content):
             print("SUCCESS: WatchApp.swift IS in a Sources Build Phase.")
        else:
             print("FAILURE: WatchApp.swift Build File exists but is NOT in any file list.")
    else:
        print("FAILURE: WatchApp.swift is not set up for build.")

if __name__ == "__main__":
    check_project()
