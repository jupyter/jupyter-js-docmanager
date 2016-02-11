// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import {
  IContentsModel
} from 'jupyter-js-services';

import * as arrays
 from 'phosphor-arrays';

import {
  ISignal, Signal
} from 'phosphor-signaling';

import {
  Widget
} from 'phosphor-widget';

import {
  AbstractFileHandler
} from './handler';

/**
 * The class name added to document widgets.
 */
export
const DOCUMENT_CLASS = 'jp-Document';


/**
 * A document manager for Jupyter.
 */
export
class DocumentManager {

  /**
   * Construct a new document manager.
   */
  constructor() {
    document.addEventListener('focus', this._onFocus.bind(this), true);
  }

  /**
   * Get the most recently focused widget.
   *
   * #### Notes
   * This is a read-only property.
   */
  get activeWidget(): Widget {
    for (let h of this._handlers) {
      if (h.activeWidget) {
        return h.activeWidget;
      }
    }
  }

  /**
   * Get the most recently focused handler.
   *
   * #### Notes
   * This is a read-only property.
   */
  get activeHandler(): AbstractFileHandler {
    for (let h of this._handlers) {
      if (h.activeWidget) {
        return h;
      }
    }
  }

  /**
   * Get the open requested signal.
   */
  get openRequested(): ISignal<DocumentManager, Widget> {
    return Private.openRequestedSignal.bind(this);
  }

  /**
   * Register a file handler.
   */
  register(handler: AbstractFileHandler): void {
    this._handlers.push(handler);
  }

  /**
   * Register a default file handler.
   */
  registerDefault(handler: AbstractFileHandler): void {
    if (this._defaultHandler !== -1) {
      throw Error('Default handler already registered');
    }
    this._handlers.push(handler);
    this._defaultHandler = this._handlers.length - 1;
  }

  /**
   * Open a file and add it to the application shell.
   */
  open(model: IContentsModel): Widget {
    if (this._handlers.length === 0) {
      return;
    }
    let path = model.path;
    let ext = '.' + path.split('.').pop();
    let handlers: AbstractFileHandler[] = [];
    // Look for matching file extensions.
    for (let h of this._handlers) {
      if (h.fileExtensions.indexOf(ext) !== -1) handlers.push(h);
    }
    let widget: Widget;
    // If there was only one match, use it.
    if (handlers.length === 1) {
      widget = this._open(handlers[0], model);

    // If there were no matches, use default handler.
    } else if (handlers.length === 0) {
      if (this._defaultHandler !== -1) {
        widget = this._open(this._handlers[this._defaultHandler], model);
      } else {
        throw new Error(`Could not open file '${path}'`);
      }

    // There are more than one possible handlers.
    } else {
      // TODO: Ask the user to choose one.
      widget = this._open(handlers[0], model);
    }
    widget.addClass(DOCUMENT_CLASS);
    return widget;
  }

  /**
   * Save the active document.
   */
  save(): void {
    let handler = this.activeHandler;
    if (handler) handler.save();
  }

  /**
   * Revert the active document.
   */
  revert(): void {
    let handler = this.activeHandler;
    if (handler) handler.revert();
  }

  /**
   * Close the active document.
   */
  close(): void {
    let handler = this.activeHandler;
    if (handler) {
      handler.close();
      handler.activeWidget = null;
    }
  }

  /**
   * Close all documents.
   */
  closeAll(): void {
    for (let h of this._handlers) {
      for (let w of h.widgets) {
        w.close();
      }
      h.activeWidget = null;
    }
  }

  /**
   * Open a file and emit an `openRequested` signal.
   */
  private _open(handler: AbstractFileHandler, model: IContentsModel): Widget {
    let widget = handler.open(model);
    handler.activeWidget = widget;
    // Clear all other active widgets.
    for (let h of this._handlers) {
      if (h !== handler) handler.activeWidget = null;
    }
    this.openRequested.emit(widget);
    return widget;
  }

  /**
   * Handle a focus event on the document.
   */
  private _onFocus(event: Event) {
    for (let h of this._handlers) {
      // If the widget belongs to the handler, update the focused widget.
      let widget = arrays.find(h.widgets,
        w => { return w.isVisible && w.node.contains(event.target as HTMLElement); });
      h.activeWidget = widget;
    }
  }

  private _handlers: AbstractFileHandler[] = [];
  private _defaultHandler = -1;
}


/**
 * The namespace for the document handler private data.
 */
namespace Private {
  /**
   * A signal emitted when the an open is requested.
   */
  export
  const openRequestedSignal = new Signal<DocumentManager, Widget>();
}
