/*
 * notion-enhancer
 * (c) 2020 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * under the MIT license
 */

'use strict';
const fs = require('fs-extra'),
  path = require('path'),
  helpers = require('./helpers.js'),
  store = require('./store.js'),
  caller = require('caller-path');

let __notion = helpers.getNotion();
module.exports = async function () {
  let __file = caller();
  __notion = await __notion;
  __file = __file
    .slice(path.resolve(__notion, 'app').length + 1)
    .replace(/\\/g, '/');

  const modules = {
    source: await fs.readdir(path.resolve(__dirname, '..', 'mods')),
    invalid: [],
    loaded: [],
  };
  for (let dir of modules.source) {
    try {
      const mod = require(`../mods/${dir}/mod.js`);
      if (
        !mod.id ||
        !mod.name ||
        !mod.version ||
        !mod.author ||
        !['extension', 'theme', 'core'].includes(mod.type)
      )
        throw Error;
      if (mod.type === 'core' || store('mods', { [mod.id]: false })[mod.id]) {
        if (mod.hacks && mod.hacks[__file])
          mod.hacks[__file]((...args) =>
            args.length === 1 ? store(mod.id, args[0]) : store(args[0], args[1])
          );
        if (
          __file === 'renderer/preload.js' &&
          (await fs.pathExists(
            path.resolve(__dirname, '..', 'mods', dir, 'styles.css')
          ))
        ) {
          document.addEventListener('readystatechange', (event) => {
            if (document.readyState !== 'complete') return false;
            const style = document.createElement('link');
            style.rel = 'stylesheet';
            style.href = `enhancement://${dir}/styles.css`;
            document.querySelector('head').appendChild(style);
          });
        }
      }
      modules.loaded.push(mod.name);
    } catch (err) {
      modules.invalid.push(dir);
    }
  }

  if (__file === 'main/main.js') {
    require('electron')
      .session.fromPartition('persist:notion')
      .protocol.registerFileProtocol('enhancement', (req, callback) => {
        callback({
          path: path.resolve(
            __dirname,
            '..',
            'mods',
            req.url.slice('enhancement://'.length)
          ),
        });
      });
  }

  if (__file === 'renderer/preload.js') {
    if (modules.loaded.length)
      console.info(
        `<notion-enhancer> enhancements loaded: ${modules.loaded.join(', ')}.`
      );
    if (modules.invalid.length)
      console.error(
        `<notion-enhancer> invalid mods found: ${modules.invalid.join(', ')}.`
      );
  }
};