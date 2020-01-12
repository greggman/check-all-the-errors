/* eslint-env node */

const puppeteer = require('puppeteer');
const express = require('express');
const EventEmitter = require('events');
const app = express();

class Runner extends EventEmitter {
  constructor(options) {
    super();
    process.nextTick(() => this._start(options));
  }
  _start(options) {
    const {dir, port, urls, timeout} = options;
    app.use(express.static(dir));
    const server = app.listen(port, () => {
      console.log(`Example app listening on port ${port}!`);
      test.call(this, port);
    });

    async function test() {
      console.log('launching puppeteer');
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      let currentURL;
      page.on('console', (msg) => {
        // Total Hack!
        console.log(...msg.args().map(v => v.toString().substr(9)));
        if (msg.type() === 'error') {
          this.emit('error', {
            type: 'msg',
            url: currentURL,
            location: msg.location(),
            text: msg.text(),
            msg: [...msg.args().map(v => v.toString())].join(' '),
          });
        }
      });

      page.on('error', (e) => {
        this.emit('error', {type: 'error', url: currentURL, error: e});
      });
      page.on('pageerror', (e) => {
        this.emit('error', {type: 'pageerror', url: currentURL, error: e});
      });

      for (const url of urls) {
        currentURL = url;
        this.emit('load', {url});
        try {
          await page.goto(url, {waitUntil: 'networkidle2', timeout});
        } catch (e) {
          this.emit('error', {type: 'exception', url: currentURL, error: e});
        }
        this.emit('idle', {url, page});
      }

      await browser.close();
      server.close();
      this.emit('finish');
    }
  }
}

module.exports = Runner;

