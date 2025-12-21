const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WATCH_APP_NAME = 'WatchApp';
const WATCH_ROOT = path.join(__dirname, '..', 'watch-app-source');

const withWatchApp = (config) => {
    return withXcodeProject(config, async (config) => {
        // Expo provides the parsed Xcode project in config.modResults
        const project = config.modResults;
        const pbxProject = project;

        // Check if target already exists
        let targetUuid;
        let targetParams;

        const existingTarget = pbxProject.pbxTargetByName(WATCH_APP_NAME);
        if (existingTarget) {
            console.log('Watch App target already exists.');
            // existingTarget is the native target object, or a wrapper?
            // node-xcode pbxTargetByName returns the target entry from the project
            // We need the UUID. pbxTargetByName returns the entry in the section.
            // But checking xcode source, pbxTargetByName(WATCH_APP_NAME) returned something used later? 
            // Actually in debug script I did: const target = pbxProject.pbxTargetByName(WATCH_APP_NAME);
            // and then used target.buildConfigurationList.
            // The pbxTargetByName returns the NativeTarget JSON object directly usually? 
            // No, looking at `node-xcode` source code:
            // return { uuid: key, target: target }
            // So existingTarget.uuid is what we want.
            // And existingTarget.target is the PBXNativeTarget object.

            // However, addTarget returns { uuid: ..., pbxNativeTarget: ... }
            // Normalized:
            // If existing, we need to construct a similar object to use downstream logic or adapt downstream logic.

            // Let's just grab the UUID and the Native Target object correctly.
            // Actually, let's verify what pbxTargetByName returns. 
            // In my debug script: const target = pbxProject.pbxTargetByName(WATCH_APP_NAME);
            // target.buildConfigurationList worked. So target IS the NativeTarget object? 
            // NO. pbxTargetByName (in some versions) returns the object. 

            // To be safe, let's look at how I use it.
            // addTarget returns { uuid, pbxNativeTarget }. 
            // I'll assume I need to find the existing UUID. Or just use a unified flow.

            // Hacky way: If existing, DELETE it? No, that's destructive.

            // Better way: Identify the target reference, then execute updates.

            // Note: pbxTargetByName might return the object but without UUID property attached if it's just the value.
            // Searching for UUID is safer.

            const targets = pbxProject.pbxNativeTargetSection();
            for (const uuid in targets) {
                if (targets[uuid].name === WATCH_APP_NAME || (targets[uuid].productName === WATCH_APP_NAME)) {
                    if (!uuid.endsWith('_comment')) {
                        targetUuid = uuid;
                        targetParams = { uuid: uuid, pbxNativeTarget: targets[uuid] };
                        break;
                    }
                }
            }
        }

        if (!targetParams) {
            console.log('Adding Watch App target...');
            targetParams = pbxProject.addTarget(WATCH_APP_NAME, 'watch2_app', WATCH_APP_NAME);

            // Explicitly create build phases since addTarget might not for watch2_app
            pbxProject.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', targetParams.uuid);
            pbxProject.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetParams.uuid);
            pbxProject.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetParams.uuid);


            // Setup Resources loop only on creation to avoid duplicates/mess (idempotency is hard)
            // ... OR we should check if files exist? 
            // Ideally we should update resources too, but for now let's focus on Build Settings.
            // I'll keep the resource copying inside the "creation" block for now to minimize risk 
            // (Copying again might be fine if using same UUIDs, but addSourceFile creates new refs).

            // 2. Add resources/source files
            const platformProjectRoot = config.modRequest?.platformProjectRoot || path.join(config.modRequest.projectRoot, 'ios');
            const iosWatchDir = path.join(platformProjectRoot, WATCH_APP_NAME);

            if (!fs.existsSync(iosWatchDir)) {
                fs.mkdirSync(iosWatchDir, { recursive: true });
            }

            // Copy source files
            const sourceFiles = fs.readdirSync(WATCH_ROOT);

            // Create a PBX group (Empty files list to avoid creating duplicate refs, Path is empty to allow explicit paths)
            const pbxGroup = pbxProject.addPbxGroup([], WATCH_APP_NAME, WATCH_APP_NAME); // 3rd arg is path. If we set it, children are relative.

            // Resetting path logic:
            // If we set Group Path to WATCH_APP_NAME ('WatchApp'), children should just be 'filename'.
            // But verify addSourceFile behavior.

            // BETTER APPROACH: Make Group abstract (no path) or correct path.
            // Let's use: Group Path = WATCH_APP_NAME. Child Path = filename.

            // To do this, we must ensure addSourceFile doesn't fail.
            // Earlier failure might be due to addPbxGroup creating refs.
            // So we pass [] to addPbxGroup.


            // Link the group to the main group
            const mainGroupKey = pbxProject.getFirstProject().firstProject.mainGroup;
            pbxProject.addToPbxGroup(pbxGroup.uuid, mainGroupKey);

            sourceFiles.forEach(file => {
                const srcPath = path.join(WATCH_ROOT, file);
                const destPath = path.join(iosWatchDir, file);
                fs.copyFileSync(srcPath, destPath);

                // Add file to project and target
                // If Group has path 'WatchApp', we just use 'file' (e.g. 'WatchApp.swift')
                pbxProject.addSourceFile(file, { target: targetParams.uuid }, pbxGroup.uuid);
            });

            const bundleIdentifier = config.ios?.bundleIdentifier || 'com.example.app';
            const watchBundleIdentifier = `${bundleIdentifier}.watchapp`;

            const infoPlistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleDisplayName</key>
	<string>Vecord Watch</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>WKApplication</key>
	<true/>
	<key>WKRunsIndependentlyOfCompanionApp</key>
	<true/>
	<key>WKCompanionAppBundleIdentifier</key>
	<string>${bundleIdentifier}</string>
</dict>
</plist>`;
            const infoPlistPath = path.join(iosWatchDir, 'Info.plist');
            fs.writeFileSync(infoPlistPath, infoPlistContent);

            pbxProject.addFile('Info.plist', pbxGroup.uuid);
        }

        // NOW: Always update Build Settings
        console.log('Updating Watch App Build Settings...');
        const buildConfigurationListDir = pbxProject.pbxXCConfigurationList();
        const buildConfigList = buildConfigurationListDir[targetParams.pbxNativeTarget.buildConfigurationList];
        const buildConfigs = buildConfigList.buildConfigurations;

        // Get Main App Development Team
        const mainAppTarget = pbxProject.getTarget('com.apple.product-type.application');
        let mainDevTeam = '';
        if (mainAppTarget) {
            const mainBuildConfigList = buildConfigurationListDir[mainAppTarget.target.buildConfigurationList];
            const mainBuildConfigs = mainBuildConfigList.buildConfigurations;
            // Just grab from the first one (Debug usually)
            const mainConfig = pbxProject.pbxXCBuildConfigurationSection()[mainBuildConfigs[0].value];
            if (mainConfig && mainConfig.buildSettings && mainConfig.buildSettings['DEVELOPMENT_TEAM']) {
                mainDevTeam = mainConfig.buildSettings['DEVELOPMENT_TEAM'];
                console.log('Found Main App Development Team:', mainDevTeam);
            }
        }


        const xcBuildConfigurations = pbxProject.pbxXCBuildConfigurationSection();

        buildConfigs.forEach(configRef => {
            const buildConfig = xcBuildConfigurations[configRef.value];

            if (buildConfig) {
                if (!buildConfig.buildSettings) buildConfig.buildSettings = {};

                // Remove baseConfigurationReference to avoid inheriting iOS Pods settings
                delete buildConfig.baseConfigurationReference;

                // ENFORCE WatchOS settings
                buildConfig.buildSettings['SDKROOT'] = '"watchos"';
                buildConfig.buildSettings['SUPPORTED_PLATFORMS'] = '"watchos watchsimulator"';
                buildConfig.buildSettings['WATCHOS_DEPLOYMENT_TARGET'] = '9.0';
                buildConfig.buildSettings['TARGETED_DEVICE_FAMILY'] = '4'; // 4 is Watch

                // Dynamic Bundle ID
                const bundleIdentifier = config.ios?.bundleIdentifier || 'com.example.app';
                buildConfig.buildSettings['PRODUCT_BUNDLE_IDENTIFIER'] = `"${bundleIdentifier}.watchapp"`;

                buildConfig.buildSettings['INFOPLIST_FILE'] = '"WatchApp/Info.plist"';
                buildConfig.buildSettings['SWIFT_VERSION'] = '5.0';
                buildConfig.buildSettings['MARKETING_VERSION'] = config.version || '1.0.0';
                buildConfig.buildSettings['CURRENT_PROJECT_VERSION'] = config.ios?.buildNumber || '1';
                buildConfig.buildSettings['SENSORS_USAGE_DESCRIPTION'] = '"Record audio"';
                // buildConfig.buildSettings['SENSORS_USAGE_DESCRIPTION'] = '"Record audio"'; // Removed duplicate
                buildConfig.buildSettings['SKIP_INSTALL'] = 'YES';

                if (config.ios?.appleTeamId) {
                    buildConfig.buildSettings['DEVELOPMENT_TEAM'] = config.ios.appleTeamId;
                } else if (mainDevTeam) {
                    buildConfig.buildSettings['DEVELOPMENT_TEAM'] = mainDevTeam;
                } else {
                    // Removed hardcoded fallback to allow Xcode automatic signing or user to set it via other means
                    // buildConfig.buildSettings['DEVELOPMENT_TEAM'] = 'SYHV2CQ5LW'; 
                }

                // Remove iOS specific settings that might conflict
                delete buildConfig.buildSettings['IPHONEOS_DEPLOYMENT_TARGET'];
                buildConfig.buildSettings['LD_RUNPATH_SEARCH_PATHS'] = '"$(inherited) @executable_path/Frameworks"';
            }
        });

        // 6. Embed Watch App into Main App
        // DECOUPLED: As per user request, we are NOT embedding the Watch App automatically.
        // This allows 'npx expo run:ios' to build ONLY the iOS app.
        // The Watch App should be built separately via Xcode.

        /* 
        const mainTarget = pbxProject.getTarget('com.apple.product-type.application');

        if (mainTarget) {
            console.log('Embedding Watch App into Main App:', mainTarget.target.name);
            // ... (Embedding logic removed for separate dev flow) ...
        }
        */

        // Write debug file
        require('fs').writeFileSync(require('path').join(config.modRequest.projectRoot, 'debug_project.pbxproj'), pbxProject.writeSync());
        console.log('Dumped debug_project.pbxproj');
        console.log('Dumped debug_project.pbxproj');

        // We DO NOT need to manualy writeSync. Expo will handle writing modResults back to the file.
        return config;
    });
};



const withWatchAppPodfile = (config) => {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
            let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

            if (!podfileContent.includes("target 'WatchApp'")) {
                console.log('Adding WatchApp target to Podfile...');
                const watchAppPodConfig = `
target 'WatchApp' do
  platform :watchos, '9.0'
  use_frameworks! :linkage => :static
end
`;
                podfileContent += watchAppPodConfig;
                fs.writeFileSync(podfilePath, podfileContent);
            } else {
                console.log('WatchApp target already exists in Podfile.');
            }

            return config;
        },
    ]);
};

module.exports = (config) => {
    config = withWatchApp(config);
    config = withWatchAppPodfile(config);
    return config;
};
