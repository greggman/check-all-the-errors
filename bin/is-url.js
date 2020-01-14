/* eslint-env node */

const protocolAndDomainRE = /^(?:\w+:)?\/\/(\S+)$/;

module.exports = function isURL(s) {
  return protocolAndDomainRE.test(s);
};
