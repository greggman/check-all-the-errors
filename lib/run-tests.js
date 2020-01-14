/* eslint-env node */
const debug = require('debug')('run-tests');

const noopLogger = {
  log() {},
  error() {},
};

// honestly I don't remember why I structured
// the code to use events (T_T)

function runTests(tester, options) {
  return new Promise((resolve) => {
    const resultInfoMap = new Map();

    function getResultInfo(href) {
      let info = resultInfoMap.get(href);
      if (!info) {
        info = {
          status: -1,  // not visited
          errors: [],
        };
        resultInfoMap.set(href, info);
      }
      return info;
    }

    const logger = Object.assign({}, noopLogger, options.logger || {});
    const log = logger.log;
    const error = logger.error;

    const responses = [];
    let numErrors = 0;
    // page that we're about to try to load
    tester.on('load', (e) => {
      debug('load:', e.href);
      getResultInfo(e.href);
      log('load:', e.href);
    });
    // status of page that was loaded
    tester.on('status', (e) => {
      debug('status:', e.href, e.status);
      getResultInfo(e.href).status = e.status;
    });
    // status of network requests (html, jpg, png, css, etc)
    tester.on('response', (e) => {
      debug('response:', e.href, e.status);
      // note: if a page fails to finish we may have downloaded the page
      // but some error prevented it from running/timedout etc...
      const info = resultInfoMap.get(e.href);
      if (info) {
        info.status = e.status;
      }
      responses.push(e);
    });
    // errors of all types
    tester.on('error', (e) => {
      ++numErrors;
      const info = getResultInfo(e.href);
      const err = Object.assign({}, e);
      delete err.href;
      info.errors.push(err);
      switch (e.type) {
        case 'msg':
          error('error msg:', e.href, e.type, e.text, e.msg);
          break;
        case 'exception':
          error('exception:', e.href, e.type, e.error);
          break;
        case 'error':
          error('error:', e.href, e.type, e.error);
          break;
        case 'pageerror':
          error('pageerror:', e.href, e.type, e.error);
          break;
        case 'badlink':
          error('missing link:', e.link, `[${e.status}] referenced by ${e.href}`);
          break;
        default:
          throw new Error('unhandled error type');
      }
    });
    tester.on('finish', () => {
      log('---done---');
      resolve({
        numErrors,
        pages: Object.fromEntries(resultInfoMap.entries()),
        responses,
      });
    });
    tester.run(options);
  });
}

module.exports = runTests;