/* 上理日历 · 全部测试入口
   node test/run-all.js */
'use strict';

async function main() {
  var failed = 0;

  console.log('\n===== run.js =====');
  failed += require('./run.js').run();

  var suites = [
    { name: 'browser-load.test.js', mod: require('./browser-load.test.js') },
    { name: 'parse-sources.test.js', mod: require('./parse-sources.test.js') },
    { name: 'pwa.test.js', mod: require('./pwa.test.js') }
  ];

  for (var s = 0; s < suites.length; s++) {
    var suite = suites[s];
    console.log('\n===== ' + suite.name + ' =====');
    for (var i = 0; i < suite.mod.tests.length; i++) {
      var t = suite.mod.tests[i];
      try {
        await Promise.resolve(t.fn());
        console.log('  ✓ ' + t.name);
      } catch (e) {
        failed++;
        console.error('  ✗ ' + t.name);
        console.error('    ' + e.message);
      }
    }
  }

  console.log(failed ? '\n有测试失败（' + failed + ' 项）' : '\n全部测试通过');
  process.exit(failed ? 1 : 0);
}

main();
