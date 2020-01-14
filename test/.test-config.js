const path = require('path');
module.exports = {
  baseDir: path.join(_dirname, 'tests'),
  ignore: [],
  globs: [
    {
      glob: 'pass-*.html',
      ignore: [],
      expect: 'pass',  // pass, fail, msg, exception, error, pageerror, badlink
      async onBefore(page) {},
      async onAfter(page) {},
    },
    {
      glob: 'fail-*.html',
      expect: 'fail',
    },
  ],
};