/* eslint-env node */

const puppeteer = require('puppeteer');
const EventEmitter = require('events');
const debug = require('debug')('runner');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

class UrlInfo {
  constructor(url) {
    this.url = url;
    this.urlsLinkedFrom = new Set();
    this.responseStatus = -1;
  }
  get href() {
    return this.url.href;
  }
  addLinkURL(url) {
    this.urlsLinkedFrom.add(url);
  }
  linkURLs() {
    return Array.from(this.urlsLinkedFrom);
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

function urlToHref(url) {
  return url.href;
}

class Tester extends EventEmitter {
  constructor(runner) {
    super();
    this.runner = runner;
  }
  async run(options) {
    // Annoying but url of means a string but there is also URL.
    // Let's try to keep the code so href = a string like 'http://foo.com/bar/page.html?a=b#d'
    // and url = an instance of URL.
    const {hrefs, timeout, verbose, followLinks, urlToIdFn = urlToHref} = options;
    const urls = hrefs.map(v => new URL(v));
    const followLocal = followLinks === 'local' || followLinks === 'both';
    const followRemote = followLinks === 'remote' || followLinks === 'both';
    const browser = await this.runner.browser();

    // these maps map hrefs to UrlInfos
    const localURLInfoMap = new Map();
    const remoteURLInfoMap = new Map();
    const foundURLInfoMap = new Map();

    // Using href which means foo.com/bar, foo.com/bar?a=b, and foo.com/bar#def are all different
    // Originally I thought that was a waste but each one might generate its own issues
    function getUrlInfoFn(urlInfoMap) {
      return function(url) {
        const pageId = urlToIdFn(url);
        let urlInfo = urlInfoMap.get(pageId);
        const isNew = !urlInfo;
        if (isNew) {
          urlInfo = new UrlInfo(url);
          urlInfoMap.set(pageId, urlInfo);
        }
        return {isNew, urlInfo};
      };
    }

    const getLocalUrlInfo = getUrlInfoFn(localURLInfoMap);
    const getRemoteUrlInfo = getUrlInfoFn(remoteURLInfoMap);
    const getFoundUrlInfo = getUrlInfoFn(foundURLInfoMap);

    const page = await browser.newPage();

    // this is needed because as of at least puppeteer 2.0.0 a heavy rAF loop
    // prevents `networkIdle2` from firing.
    const inject = fs.readFileSync(path.join(__dirname, 'inject.js'), 'utf8');
    await page.evaluateOnNewDocument(inject);

    let currentHref;
    page.on('console', (msg) => {
      // Total Hack! Each string starts with `JsHandle:`
      if (verbose) {
        console.log(...msg.args().map(v => v.toString().substr(9)));
      }
      if (msg.type() === 'error') {
        const {url, lineNumber, columnNumber} = msg.location();
        this.emit('error', {
          type: 'msg',
          href: currentHref,
          location: {
            ...url && {url},
            ...lineNumber && {lineNumber},
            ...columnNumber && {columnNumber},
          },
          text: msg.text(),
        });
      }
    });

    page.on('error', (e) => {
      this.emit('error', {type: 'error', href: currentHref, error: e.toString()});
    });
    page.on('pageerror', (e) => {
      this.emit('error', {type: 'pageerror', href: currentHref, error: e.toString()});
    });
    page.on('response', response => {
      const {urlInfo} = getFoundUrlInfo(new URL(response.url()));
      if (!urlInfo.isStatusSet()) {
        urlInfo.setStatus(response.status());
        this.emit('response', {href: response.url(), status: response.status()});
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
            urlInfo.addLinkURL(pageURL);
          }
        } else {
          debug('  is remote:', linkHref);
          const {urlInfo} = getRemoteUrlInfo(linkURL);
          urlInfo.addLinkURL(pageURL);
        }
      }
    }

    // add all the urls passed in.
    urls.forEach(url => getLocalUrlInfo(url));

    while (!this.runner.exiting && urls.length) {
      const url = urls.shift();
      const href = url.href;
      currentHref = href;
      this.emit('load', {href});
      try {
        // this is needed because of the last page was the same page but say a different hash
        // then the browser doesn't load the page, it just searches for the hash. ATM I think
        // I want it to load the page.
        await page.goto('about:blank', {waitUntil: 'networkidle2', timeout: 3000});
        const result = await page.goto(href, {waitUntil: 'networkidle2', timeout});
        const status = result.status();
        this.emit('status', {href, status});
        if (status >= 200 && status <= 299) {
          if (followLinks !== 'none') {
            await addLinks(url, page, urls);
          }
        }
      } catch (e) {
        this.emit('error', {
          type: 'exception',
          href,
          error: `${e.toString()}${e.message ? `:${e.message}` : ''}`,
        });
      }
    }

    const reportMissingLinks = (urlInfoMap) => {
      if (this.runner.exiting) {
        return;
      }
      for (const [href, urlInfo] of urlInfoMap) {
        const pageId = urlToIdFn(urlInfo.url);
        const foundURLInfo = foundURLInfoMap.get(pageId);
        const status = foundURLInfo ? foundURLInfo.status : -1;
        if ((!foundURLInfo || !foundURLInfo.ok()) && urlInfo.linkURLs().length) {
          for (const linkURL of urlInfo.linkURLs()) {
            this.emit('error', {
              type: 'badlink',
              href: linkURL.href,
              link: href,
              status: status,
            });
          }
        }
      }
    };

    reportMissingLinks(localURLInfoMap);

    if (!this.runner.exiting && followRemote) {
      for (const [href, remoteURLInfo] of remoteURLInfoMap) {
        this.emit('loadRemote', {href});
        try {
          const {urlInfo} = getFoundUrlInfo(remoteURLInfo.url);
          if (!urlInfo.isStatusSet()) {
            // I wanted to use HEAD here but lots of servers reject it :(
            const res = await fetch(href, {method: 'GET'});
            urlInfo.setStatus(res.status);
            this.emit('response', {href, status: res.status});
          }
        } catch (e) {
          //
        }
      }

      reportMissingLinks(remoteURLInfoMap);
    }

    if (!this.runner.exiting) {
      await page.close();
    }
    this.emit('finish');
  }
}

class Runner {
  constructor() {
    this.exiting = false;
    this.browserP = puppeteer.launch({
      handleSIGINT: false,
    });

    this.cleanup = async() => {
      if (this.exiting) {
        return;
      }

      // I actually don't understand how to clean up here!
      // I tried one thing and it seemed to work but then switching machines it stopped
      // I see that even though I'm here other code is still running. I'm guessing it's
      // the await which makes sense but it means I need to handle all the loops and stuff
      // that are queued?
      this.exiting = true;

      const browser = await this.browserP;
      await browser.close();
    };

    process.on('SIGINT', async() => {
      await this.cleanup();
      process.exit(0);  // eslint-disable-line no-process-exit
    });
  }
  async browser() {
    const browser = await this.browserP;
    return browser;
  }
  async close() {
    return await this.cleanup();
  }
  async createTester() {
    return new Tester(this);
  }
}

module.exports = Runner;

