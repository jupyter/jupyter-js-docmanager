// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

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
  let contentsManager = new ContentsManager(getBaseUrl());
  let handler = new FileHandler(contentsManager);
  let docManager = new DocumentManager();
  docManager.registerDefault(handler);
  docManager.openRequested.connect((manager, widget) => {
    widget.id = 'main'
    widget.attach(document.body);
    widget.attach(document.body);
    window.onresize = () => widget.update();
  });
  contentsManager.get('index.html').then(contents => {
    docManager.open(contents);
  });
}

window.onload = main;
