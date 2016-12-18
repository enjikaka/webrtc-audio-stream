/* eslint-env browser */

const $ = q => {
  return document.querySelector(q);
};

const $$ = q => {
  return document.querySelectorAll(q);
};

export default { $, $$ };
