/* eslint-env node */

const puppeteer = require('puppeteer');
const express = require('express');
const EventEmitter = require('events');
const app = express();
const debug = require('debug')('check-all-the-things');

class UrlInfo {
  constructor(url) {
    this.url = url;
    this.linkedFrom = new Set();
    this.found = false;
  }
  addLink(url) {
    this.linkedFrom.add(url);
  }
  links() {
    return Array.from(this.linkedFrom);
  }
  setFound() {
    this.found = true;
  }
}

class Runner extends EventEmitter {
  constructor(options) {
    super();
    process.nextTick(() => this._start(options));
  }
  _start(options) {
    const {dir, port, urls, timeout, verbose, followLinks} = options;
    const followLocal = followLinks === 'local' || followLinks === 'both';
    const followRemote = followLinks === 'remote' || followLinks === 'both';
    const localURLInfoMap = new Map();
    const remoteURLInfoMap = new Map();
    app.use(express.static(dir));
    const server = app.listen(port, () => {
      console.log(`Example app listening on port ${port}!`);
      test.call(this, port);
    });

    async function test() {
      console.log('launching puppeteer');
      let browser = await puppeteer.launch({
        handleSIGINT: false,
      });

      const cleanup = async() => {
        if (!browser) {
          return;
        }

        const b = browser;
        browser = undefined;
        await b.close();
        server.close();
      };
      process.on('SIGINT', async() => {
        await cleanup();
        process.exit(0);  // eslint-disable-line no-process-exit
      });

      const page = await browser.newPage();

      let currentURLString;
      page.on('console', (msg) => {
        // Total Hack! Each string starts with `[JsHandle]`
        if (verbose) {
          console.log(...msg.args().map(v => v.toString().substr(9)));
        }
        if (msg.type() === 'error') {
          this.emit('error', {
            type: 'msg',
            url: currentURLString,
            location: msg.location(),
            text: msg.text(),
            msg: [...msg.args().map(v => v.toString())].join(' '),
          });
        }
      });

      page.on('error', (e) => {
        this.emit('error', {type: 'error', url: currentURLString, error: e});
      });
      page.on('pageerror', (e) => {
        this.emit('error', {type: 'pageerror', url: currentURLString, error: e});
      });

      function fullPathname(url) {
        return `${url.origin}${url.pathname}`;
      }

      function getLocalUrlInfo(url) {
        const pathname = fullPathname(url);
        let urlInfo = localURLInfoMap.get(pathname);
        const isNew = !urlInfo;
        if (isNew) {
          urlInfo = new UrlInfo(url);
          localURLInfoMap.set(pathname, urlInfo);
        }
        return {isNew, urlInfo};
      }

      async function addLinks(pageUrl, page, urls) {
        const elemHandles = await page.$$('a');
        const pageURL = new URL(pageUrl);
        const pagePathname = fullPathname(pageURL);
        for (const elemHandle of elemHandles) {
          const hrefHandle = await elemHandle.getProperty('href');
          if (!hrefHandle) {
            continue;
          }
          const href = await hrefHandle.jsonValue();
          if (!href) {
            continue;
          }
          debug('checking:', href);
          const linkURL = new URL(href, pagePathname);
          const linkPathname = fullPathname(linkURL);
          const isLocalURL = pageURL.origin === linkURL.origin;
          if (isLocalURL) {
            debug('  is local:', href);
            if (followLocal) {
              const {urlInfo, isNew} = getLocalUrlInfo(linkURL);
              debug('    new:', isNew, href);
              if (isNew) {
                debug('    add:', href);
                urls.push(linkURL.href);
              }
              urlInfo.addLink(pageURL);
            }
          } else {
            debug('  is remote:', href);
            if (!remoteURLInfoMap.has(linkPathname)) {
              remoteURLInfoMap.set(linkPathname, new UrlInfo(linkURL));
            }
          }
        }
      }

      // add all the urls passed in.
      urls.forEach(urlString => getLocalUrlInfo(new URL(urlString)));

      while (urls.length) {
        const urlString = urls.shift();
        const url = new URL(urlString);
        const {urlInfo} = getLocalUrlInfo(url);
        currentURLString = urlString;
        this.emit('load', {url: urlString});
        try {
          const result = await page.goto(urlString, {waitUntil: 'networkidle2', timeout});
          if (result.status() === 200) {
            urlInfo.setFound(true);
            if (followLinks !== 'none') {
              await addLinks(urlString, page, urls);
            }
          }
        } catch (e) {
          this.emit('error', {type: 'exception', url: currentURLString, error: e});
        }
        this.emit('idle', {url: urlString, page});
      }

      for (const [linkPathname, urlInfo] of localURLInfoMap) {
        if (!urlInfo.found) {
          this.emit('error', {
            type: 'badlink',
            url: linkPathname,
            links: urlInfo.links(),
          });
        }
      }

      if (followRemote) {
        for (const [linkPathname /*, urlInfo */] of remoteURLInfoMap.entries()) {
          console.log('remote:', linkPathname);
        }
      }

      await page.close();
      await cleanup();
      this.emit('finish');
    }
  }
}

module.exports = Runner;

