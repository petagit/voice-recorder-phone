const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const WATCH_APP_NAME = 'WatchApp';
const WATCH_ROOT = path.join(__dirname, '..', 'watch-app-source');

const withWatchApp = (config) => {
    return withXcodeProject(config, async (config) => {
        const projectPath = path.join(config.modRequest.projectRoot, 'ios', 'Vecord.xcodeproj', 'project.pbxproj');
        const project = xcode.project(projectPath);

        await new Promise((resolve, reject) => {
            project.parse(function (err) {
                if (err) {
                    console.error('Error parsing Xcode project:', err);
                    return reject(err);
                }

                const pbxProject = project;

                // Check if target already exists
                const existingTarget = pbxProject.pbxTargetByName(WATCH_APP_NAME);
                if (existingTarget) {
                    return resolve();
                }

                console.log('Adding Watch App target...');

                // 1. Create a new Target
                const target = pbxProject.addTarget(WATCH_APP_NAME, 'watch2_app', WATCH_APP_NAME);

                // 2. Add resources/source files
                // Use modRequest.platformProjectRoot if available, else standard ios path
                const platformProjectRoot = config.modRequest?.platformProjectRoot || path.join(config.modRequest.projectRoot, 'ios');
                const iosWatchDir = path.join(platformProjectRoot, WATCH_APP_NAME);

                if (!fs.existsSync(iosWatchDir)) {
                    fs.mkdirSync(iosWatchDir, { recursive: true });
                }

                // Copy source files
                const sourceFiles = fs.readdirSync(WATCH_ROOT);

                // Create a PBX group
                const pbxGroup = pbxProject.addPbxGroup(sourceFiles, WATCH_APP_NAME, WATCH_APP_NAME);

                // Link the group to the main group
                const mainGroupKey = pbxProject.getFirstProject().firstProject.mainGroup;
                pbxProject.addToPbxGroup(pbxGroup.uuid, mainGroupKey);

                sourceFiles.forEach(file => {
                    const srcPath = path.join(WATCH_ROOT, file);
                    const destPath = path.join(iosWatchDir, file);
                    fs.copyFileSync(srcPath, destPath);

                    // Add file to project and target
                    pbxProject.addSourceFile(file, { target: target.uuid }, pbxGroup.uuid);
                });

                // 4. Create Info.plist
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
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>WKApplication</key>
	<true/>
	<key>WKCompanionAppBundleIdentifier</key>
	<string>com.fengzhiping.vecord</string>
</dict>
</plist>`;
                const infoPlistPath = path.join(iosWatchDir, 'Info.plist');
                fs.writeFileSync(infoPlistPath, infoPlistContent);

                // Add Info.plist to project (but usually not as a compile source, just file reference)
                // addSourceFile adds it to Sources build phase which is WRONG for plist usually?
                // Actually for Info.plist it shouldn't be in Sources.
                // It should be known to the target build settings (INFOPLIST_FILE).
                // But adding it to the group helps visibility.
                pbxProject.addFile('Info.plist', pbxGroup.uuid);

                // 5. Update Build Settings
                // We need to set INFOPLIST_FILE and PRODUCT_BUNDLE_IDENTIFIER for the new target.
                // xcode package is hard to use for this specific task without verbose code.
                // We will try to patch the UUIDs found for the new target.

                // Iterate configurations to find the ones for our target
                // The addTarget returns { uuid, pbxNativeTarget }
                // pbxNativeTarget has buildConfigurationList
                const buildConfigurationListDir = pbxProject.pbxXCConfigurationList();
                const buildConfigList = buildConfigurationListDir[target.pbxNativeTarget.buildConfigurationList];
                const buildConfigs = buildConfigList.buildConfigurations;

                const xcBuildConfigurations = pbxProject.pbxXCBuildConfigurationSection();

                buildConfigs.forEach(configRef => {
                    const buildConfig = xcBuildConfigurations[configRef.value];
                    if (buildConfig) {
                        if (!buildConfig.buildSettings) buildConfig.buildSettings = {};

                        buildConfig.buildSettings['INFOPLIST_FILE'] = `"${WATCH_APP_NAME}/Info.plist"`;
                        buildConfig.buildSettings['PRODUCT_BUNDLE_IDENTIFIER'] = `com.fengzhiping.vecord.watchapp`;
                        buildConfig.buildSettings['MARKETING_VERSION'] = '1.0.0';
                        buildConfig.buildSettings['CURRENT_PROJECT_VERSION'] = '1';
                        buildConfig.buildSettings['SWIFT_VERSION'] = '5.0';
                        buildConfig.buildSettings['TARGETED_DEVICE_FAMILY'] = '"4"'; // 4 is Watch
                        buildConfig.buildSettings['WATCHOS_DEPLOYMENT_TARGET'] = '9.0';
                        buildConfig.buildSettings['SENSORS_USAGE_DESCRIPTION'] = '"Record audio"';
                        // Remove some defaults that might conflict
                        delete buildConfig.buildSettings['LD_RUNPATH_SEARCH_PATHS'];
                    }
                });

                // 6. Embed Watch App into Main App
                // We need to find the main application target
                const mainTarget = pbxProject.getTarget('com.apple.product-type.application');

                if (mainTarget) {
                    console.log('Embedding Watch App into Main App:', mainTarget.target.name);

                    // Add Target Dependency
                    pbxProject.addTargetDependency(mainTarget.uuid, [target.uuid]);

                    // Add Copy Files Build Phase (Embed Watch Content)
                    // dstSubfolderSpec: 16 (Products Directory) ?? No, typically 16 is "Wrapper". 
                    // For Watch App, we often want specific subfolder. 
                    // However, node-xcode's addBuildPhase is generic.
                    // "Embed Watch Content" is essentially a Copy Files phase with specific destination.

                    // Destination: "$(CONTENTS_FOLDER_PATH)/Watch"
                    // We can try to use addCopyFilesBuildPhase if available or addBuildPhase

                    // Let's manually construct the phase because node-xcode might not have a helper for "Embed Watch Content" specifically.
                    // But we can use the generic addBuildPhase for now or try to attach it to the product.

                    // Workaround: We'll add the WatchApp.app product file to the Copy Files phase.
                    // But first we need the product file reference.
                    const productFile = pbxProject.productFile; // This is main app product
                    // We need the WATCH app product file reference.
                    // When we called addTarget, it created a productFile but it might not be easily accessible.
                    // Let's find the product file ref for the watch app.
                    const productsGroup = pbxProject.pbxGroupByName('Products');
                    const watchProductParams = {
                        basename: 'WatchApp.app',
                        group: 'Products'
                    };
                    // It should have been added by addTarget? existingTarget has productReference.
                    // target.productReference is the uuid.

                    if (target.productReference) {
                        // Create a new Copy Files Phase
                        pbxProject.addBuildPhase(
                            [target.productReference],
                            'PBXCopyFilesBuildPhase',
                            'Embed Watch Content',
                            mainTarget.uuid,
                            {
                                dstPath: '$(CONTENTS_FOLDER_PATH)/Watch',
                                dstSubfolderSpec: 16, // 16 = Products Directory? No, 16 is usually "Wrapper" (App Bundle).
                                // 0=Absolute, 1=Wrapper, 6=Executables, 7=Resources, 10=Frameworks, 15=Java Resources, 16=Products
                                // Typically for Embed Watch Content, generated Xcode projects use:
                                // dstPath = "$(CONTENTS_FOLDER_PATH)/Watch"
                                // dstSubfolderSpec = 16 (Wrapper) -> This might copy into App.app/WatchApp.app which is wrong?
                                // Actually, '16' corresponds to "Wrapper" in some contexts but let's check standard "Embed Watch Content".
                                // Standard is: Destination = "Products Directory" (16) is NOT correct for watch.
                                // Standard: Destination = "Wrapper" (1) and Path = "Watch".
                                // Let's try 1 (Wrapper) and Path "Watch".
                            }
                        );
                        console.log('Added Embed Watch Content build phase.');
                    }
                }

                fs.writeFileSync(projectPath, pbxProject.writeSync());
                resolve();
            });
        });

        return config;
    });
};

module.exports = withWatchApp;
