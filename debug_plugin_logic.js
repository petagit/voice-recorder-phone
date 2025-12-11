const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const projectPath = path.join(__dirname, 'ios/Vecord.xcodeproj/project.pbxproj');
const project = xcode.project(projectPath);

const WATCH_APP_NAME = 'WatchApp';

project.parse(function (err) {
    if (err) {
        console.error('Error parsing Xcode project:', err);
        return;
    }

    const pbxProject = project;

    // Simulate the logic in plugin
    const target = pbxProject.pbxTargetByName(WATCH_APP_NAME);
    if (!target) {
        console.error('Watch App target not found!');
        return;
    }

    console.log('Found Watch App target. Updating build settings...');

    const buildConfigurationListDir = pbxProject.pbxXCConfigurationList();
    const buildConfigList = buildConfigurationListDir[target.buildConfigurationList];
    const buildConfigs = buildConfigList.buildConfigurations;

    const xcBuildConfigurations = pbxProject.pbxXCBuildConfigurationSection();

    buildConfigs.forEach(configRef => {
        const buildConfig = xcBuildConfigurations[configRef.value];
        if (buildConfig) {
            console.log(`Updating config: ${buildConfig.name}`);
            if (!buildConfig.buildSettings) buildConfig.buildSettings = {};

            // ENFORCE WatchOS settings
            buildConfig.buildSettings['SDKROOT'] = 'watchos';
            buildConfig.buildSettings['SUPPORTED_PLATFORMS'] = 'watchos';
            buildConfig.buildSettings['WATCHOS_DEPLOYMENT_TARGET'] = '9.0';
            buildConfig.buildSettings['TARGETED_DEVICE_FAMILY'] = '4';
            buildConfig.buildSettings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.fengzhiping.vecord.watchapp';
            buildConfig.buildSettings['INFOPLIST_FILE'] = 'WatchApp/Info.plist';
            buildConfig.buildSettings['SWIFT_VERSION'] = '5.0';
            buildConfig.buildSettings['MARKETING_VERSION'] = '1.0.0';
            buildConfig.buildSettings['CURRENT_PROJECT_VERSION'] = '1';
            buildConfig.buildSettings['SENSORS_USAGE_DESCRIPTION'] = '"Record audio"';
            buildConfig.buildSettings['SKIP_INSTALL'] = 'YES';
            buildConfig.buildSettings['MY_TEST_KEY'] = 'YES_WORKS';

            // Remove iOS specific settings
            delete buildConfig.buildSettings['IPHONEOS_DEPLOYMENT_TARGET'];
            delete buildConfig.buildSettings['LD_RUNPATH_SEARCH_PATHS'];

            console.log('Settings after update:', JSON.stringify(buildConfig.buildSettings, null, 2));
        }
    });

    const out = pbxProject.writeSync();
    // fs.writeFileSync('debug_project.pbxproj', out); // Don't overwrite actual file, write to debug
    console.log('Checking for SDKROOT in output...');
    if (out.includes('SDKROOT = watchos')) {
        console.log('SUCCESS: SDKROOT = watchos found.');
    } else {
        console.log('FAILURE: SDKROOT = watchos NOT found.');
    }
    if (out.includes('MY_TEST_KEY = YES_WORKS')) {
        console.log('SUCCESS: MY_TEST_KEY found.');
    } else {
        console.log('FAILURE: MY_TEST_KEY NOT found.');
    }
});
