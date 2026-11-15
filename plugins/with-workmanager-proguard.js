const {withDangerousMod} = require('expo/config-plugins');
const fs = require('fs/promises');
const path = require('path');

const rules = [
  '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
  '-keep class * extends androidx.work.InputMerger { <init>(); }',
];

module.exports = function withWorkManagerProguard(config) {
  return withDangerousMod(config, [
    'android',
    async config => {
      const rulesPath = path.join(config.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      let contents = '';
      try {
        contents = await fs.readFile(rulesPath, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      const missingRules = rules.filter(rule => !contents.includes(rule));
      if (missingRules.length) {
        const addition = `\n# Keep Room and WorkManager constructors used through reflection.\n${missingRules.join('\n')}\n`;
        await fs.writeFile(rulesPath, `${contents.trimEnd()}${addition}`);
      }
      return config;
    },
  ]);
};
