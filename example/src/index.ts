// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import {
  DockPanel
} from 'phosphor-dockpanel';

import {
  KeymapManager
} from 'phosphor-keymap';

import {
  ContentsManager
} from 'jupyter-js-services';

import {
  getBaseUrl
} from 'jupyter-js-utils';

import {
  FileHandler, DocumentManager
} from '../../lib/index';


function main(): void {
  let dock = new DockPanel();
  dock.id = 'main';
  dock.attach(document.body);
  window.onresize = () => dock.update();
  let keymapManager = new KeymapManager();
  window.addEventListener('keydown', (event) => {
    keymapManager.processKeydownEvent(event);
  });

  let contentsManager = new ContentsManager(getBaseUrl());
  let handler = new FileHandler(contentsManager);
  let docManager = new DocumentManager();
  docManager.registerDefault(handler);
  docManager.openRequested.connect((manager, widget) => {
    dock.insertTabAfter(widget);
    keymapManager.add([{
      sequence: ['Accel S'],
      selector: '.jp-CodeMirrorWidget',
      handler: () => {
        handler.save(widget);
        return true;
      }
    }, {
      sequence: ['Accel R'],
      selector: '.jp-CodeMirrorWidget',
      handler: () => {
        handler.revert(widget);
        return true;
      }
    }]);
  });
  contentsManager.get('index.html').then(contents => {
    docManager.open(contents);
  });



}

window.onload = main;
