/* eslint-env browser */

export const $ = q => {
  return document.querySelector(q);
};

export const $$ = q => {
  return document.querySelectorAll(q);
};
