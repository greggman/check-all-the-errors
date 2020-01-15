/* eslint-env node */

const fs = require('fs');
const path = require('path');
const Servez = require('servez-lib');
const Runner = require('../lib/runner');
const runTests = require('../lib/run-tests');
const makeOptions = require('optionator');
const assert = require('assert');

const optionSpec = {
  options: [
    { option: 'help', alias: 'h',       type: 'Boolean',  description: 'displays help' },
    { option: 'write-expected-results', type: 'Boolean',  description: 'write expected test results' },
  ],
};
const optionator = makeOptions(optionSpec);

let args;
try {
  args = optionator.parse(process.argv);
} catch (e) {
  console.error(e);
  printHelp();
}

function printHelp() {
  console.log(optionator.generateHelp());
  process.exit(1);  // eslint-disable-line no-process-exit
}

if (args.help) {
  printHelp();
}

const baseDir = path.join(__dirname, 'tests');

const filenames = fs.readdirSync(baseDir)
    .filter(v => v.endsWith('.html'));

const server = new Servez(Object.assign({
  root: baseDir,
  port: 8090,
  scan: true,
}));
server.on('start', ({baseUrl}) => {
  process.nextTick(() => {
    run(baseUrl);
  });
});

async function run(baseUrl) {
  //const urlToIdFn = url => `${url.origin}${url.pathname}${useSearch ? url.search : ''}${useHash ? url.hash : ''}`,
  const urlToIdFn = url => `${url.origin}${url.pathname}`;
  //const urlToIdFn = url => url.href;
  let numErrors = 0;
  const runner = new Runner();
  for (const filename of filenames) {
    console.log('test :', filename);
    const hrefs = [
      `${baseUrl}/${filename}`,
    ];
    const options = {
      hrefs,
      timeout: 5000,
      followLinks: 'both',
      urlToIdFn,
    };
    const tester = await runner.createTester();
    const result = await runTests(tester, options);
    const expectedFilename =  `${filename}.expected.json`;
    const expectedFilePath = path.join(baseDir, '..', 'expected', expectedFilename);
    if (args.writeExpectedResults) {
      console.log('write:', expectedFilename);
      fs.writeFileSync(expectedFilePath, JSON.stringify(result, null, 2));
    } else {
      try {
        const expected = JSON.parse(fs.readFileSync(expectedFilePath, 'utf8'));
        assert.deepStrictEqual(result, expected);
        console.log(' pass');
      } catch (e) {
        ++numErrors;
        console.log(' fail:', e.toString());
      }
    }
  }
  runner.close();
  server.close();
  console.log('--done--');
  const exitCode = numErrors ? 1 : 0;
  process.exit(exitCode);  // eslint-disable-line no-process-exit
}

