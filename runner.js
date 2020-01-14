/* eslint-env node */

const puppeteer = require('puppeteer');
const EventEmitter = require('events');
const debug = require('debug')('check-all-the-things');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

class UrlInfo {
  constructor(url) {
    this.url = url;
    this.linkedFrom = new Set();
    this.responseStatus = -1;
  }
  get href() {
    return this.url.href;
  }
  addLink(url) {
    this.linkedFrom.add(url);
  }
  links() {
    return Array.from(this.linkedFrom);
  }
  ok() {
    return this.responseStatus >= 200 && this.responseStatus <= 299;
  }
  get status() {
    return this.responseStatus;
  }
  isStatusSet() {
    return this.responseStatus !== -1;
  }
  setStatus(status) {
    this.responseStatus = status;
  }
}

class Runner extends EventEmitter {
  constructor(options) {
    super();
    process.nextTick(() => this._start(options));
  }
  _start(options) {
    // Annoying but url of means a string but there is also URL.
    // Let's try to keep the code so href = a string like 'http://foo.com/bar/page.html?a=b#d'
    // and url = an instance of URL.
    let exiting = false;
    const {hrefs, timeout, verbose, followLinks} = options;
    const urls = hrefs.map(v => new URL(v));
    const followLocal = followLinks === 'local' || followLinks === 'both';
    const followRemote = followLinks === 'remote' || followLinks === 'both';

    // these maps map hrefs to UrlInfos
    const localURLInfoMap = new Map();
    const remoteURLInfoMap = new Map();
    const foundURLInfoMap = new Map();

    // Using href which means foo.com/bar, foo.com/bar?a=b, and foo.com/bar#def are all different
    // Originally I thought that was a waste but each one might generate its own issues
    function getUrlInfoFn(urlInfoMap) {
      return function(url) {
        let urlInfo = urlInfoMap.get(url.href);
        const isNew = !urlInfo;
        if (isNew) {
          urlInfo = new UrlInfo(url);
          urlInfoMap.set(url.href, urlInfo);
        }
        return {isNew, urlInfo};
      };
    }

    const getLocalUrlInfo = getUrlInfoFn(localURLInfoMap);
    const getRemoteUrlInfo = getUrlInfoFn(remoteURLInfoMap);
    const getFoundUrlInfo = getUrlInfoFn(foundURLInfoMap);

    const test = async() => {
      const browser = await puppeteer.launch({
        handleSIGINT: false,
      });
      const page = await browser.newPage();

      const cleanup = async() => {
        if (exiting) {
          return;
        }

        // I actually don't understand how to clean up here!
        // I tried one thing and it seemed to work but then switching machines it stopped
        // I see that even though I'm here other code is still running. I'm guessing it's
        // the await which makes sense but it means I need to handle all the loops and stuff
        // that are queued?
        exiting = true;
        await page.close();
        await browser.close();
      };
      process.on('SIGINT', async() => {
        await cleanup();
        process.exit(0);  // eslint-disable-line no-process-exit
      });

      // this is needed because as of at least puppeteer 2.0.0 a heavy rAF loop
      // prevents `networkIdle2` from firing.
      const inject = fs.readFileSync(path.join(__dirname, 'inject.js'), 'utf8');
      await page.evaluateOnNewDocument(inject);

      let currentHref;
      page.on('console', (msg) => {
        // Total Hack! Each string starts with `[JsHandle]`
        if (verbose) {
          console.log(...msg.args().map(v => v.toString().substr(9)));
        }
        if (msg.type() === 'error') {
          this.emit('error', {
            type: 'msg',
            href: currentHref,
            location: msg.location(),
            text: msg.text(),
            msg: [...msg.args().map(v => v.toString())].join(' '),
          });
        }
      });

      page.on('error', (e) => {
        this.emit('error', {type: 'error', href: currentHref, error: e});
      });
      page.on('pageerror', (e) => {
        this.emit('error', {type: 'pageerror', href: currentHref, error: e});
      });
      page.on('response', response => {
        const {urlInfo} = getFoundUrlInfo(new URL(response.url()));
        if (!urlInfo.isStatusSet()) {
          urlInfo.setStatus(response.status());
        }
      });

      async function addLinks(pageURL, page, urls) {
        const elemHandles = await page.$$('a');
        for (const elemHandle of elemHandles) {
          const linkHrefHandle = await elemHandle.getProperty('href');
          if (!linkHrefHandle) {
            continue;
          }
          const linkHref = await linkHrefHandle.jsonValue();
          if (!linkHref) {
            continue;
          }
          debug('checking:', linkHref);
          const linkURL = new URL(linkHref, pageURL);
          const isLocalURL = pageURL.origin === linkURL.origin;
          if (isLocalURL) {
            debug('  is local:', linkHref);
            if (followLocal) {
              const {urlInfo, isNew} = getLocalUrlInfo(linkURL);
              debug('    new:', isNew, linkHref);
              if (isNew) {
                debug('    add:', linkHref);
                urls.push(linkURL);
              }
              urlInfo.addLink(pageURL);
            }
          } else {
            debug('  is remote:', linkHref);
            const {urlInfo} = getRemoteUrlInfo(linkURL);
            urlInfo.addLink(pageURL);
          }
        }
      }

      // add all the urls passed in.
      urls.forEach(url => getLocalUrlInfo(url));

      while (!exiting && urls.length) {
        const url = urls.shift();
        const href = url.href;
        currentHref = href;
        this.emit('load', {href});
        try {
          const result = await page.goto(href, {waitUntil: 'networkidle2', timeout});
          if (result.status() >= 200 && result.status() <= 299) {
            if (followLinks !== 'none') {
              await addLinks(url, page, urls);
            }
          }
        } catch (e) {
          this.emit('error', {type: 'exception', href, error: e});
        }
        this.emit('idle', {href, page});
      }

      const reportMissingLinks = (urlInfoMap) => {
        if (exiting) {
          return;
        }
        for (const [href, urlInfo] of urlInfoMap) {
          const foundURLInfo = foundURLInfoMap.get(href);
          if ((!foundURLInfo || !foundURLInfo.ok()) && urlInfo.links().length) {
            this.emit('error', {
              type: 'badlink',
              href,
              links: urlInfo.links(),
              status: foundURLInfo ? foundURLInfo.status : -1,
            });
          }
        }
      };

      reportMissingLinks(localURLInfoMap);

      if (!exiting && followRemote) {
        for (const [href, remoteURLInfo] of remoteURLInfoMap) {
          this.emit('load', {href});
          try {
            const {urlInfo} = getFoundUrlInfo(remoteURLInfo.url);
            if (!urlInfo.isStatusSet()) {
              const res = await fetch(href, {method: 'HEAD'});
              urlInfo.setStatus(res.status);
            }
          } catch (e) {
            //
          }
        }

        reportMissingLinks(remoteURLInfoMap);
      }

      await cleanup();
      this.emit('finish');
    };
    test();
  }
}

module.exports = Runner;

