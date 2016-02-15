// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import * as CodeMirror
  from 'codemirror';

import {
  IContentsModel, IContentsManager
} from 'jupyter-js-services';

import * as arrays
  from 'phosphor-arrays';

import {
  CodeMirrorWidget
} from 'phosphor-codemirror';

import {
  IMessageFilter, IMessageHandler, Message, installMessageFilter,
  removeMessageFilter
} from 'phosphor-messaging';

import {
  Property
} from 'phosphor-properties';

import {
  ISignal, Signal
} from 'phosphor-signaling';

import {
  Widget, Title
} from 'phosphor-widget';

import {
  JupyterCodeMirrorWidget
} from './widget';

import {
  loadModeByFileName
} from './utils';


/**
 * The class name added to a dirty documents.
 */
const DIRTY_CLASS = 'jp-mod-dirty';


/**
 * An implementation of a file handler.
 */
export
abstract class AbstractFileHandler implements IMessageFilter {

  /**
   * Construct a new source file handler.
   */
  constructor(manager: IContentsManager) {
    this._manager = manager;
    document.addEventListener('focus', this._onFocus.bind(this), true);
  }

  /**
   * Get the list of file extensions explicitly supported by the handler.
   */
  get fileExtensions(): string[] {
    return []
  }

  /**
   * Get the list of mime types explicitly supported by the handler.
   */
  get mimeTypes(): string[] {
    return []
  }

  /**
   * Get the contents manager used by the handler.
   *
   * #### Notes
   * This is a read-only property
   */
  get manager(): IContentsManager {
    return this._manager;
  }

  /**
   * A signal emitted when the file handler has finished loading the
   * contents of the widget.
   */
  get finished(): ISignal<AbstractFileHandler, IContentsModel> {
    return AbstractFileHandler.finishedSignal.bind(this);
  }

  /**
   * A signal emitted when the file handler is activated.
   */
  get activated(): ISignal<AbstractFileHandler, void> {
    return AbstractFileHandler.activatedSignal.bind(this);
  }

  /**
   * Deactivate the handler.
   */
  deactivate(): void {
    this._activeWidget = null;
  }

  /**
   * Open a contents model and return a widget.
   */
  open(model: IContentsModel): Widget {
    let path = model.path;
    let index = arrays.findIndex(this._widgets,
      (widget, ind) => {
        return AbstractFileHandler.modelProperty.get(widget).path === path;
      }
    );
    if (index !== -1) {
      return this._widgets[index];
    }
    var widget = this.createWidget(model);
    widget.title.closable = true;
    widget.title.changed.connect(this.titleChanged, this);
    AbstractFileHandler.modelProperty.set(widget, model);
    this._widgets.push(widget);
    installMessageFilter(widget, this);

    this.getContents(model).then(contents => {
      this.setState(widget, contents).then(
        () => this.finished.emit(model)
      );
    });

    return widget;
  }

  /**
   * Save widget contents.
   *
   * @param widget - The widget to save (defaults to current active widget).
   *
   * returns A promise that resolves to the contents of the widget.
   */
  save(widget?: Widget): Promise<IContentsModel> {
    widget = widget || this._activeWidget;
    if (this._widgets.indexOf(widget) === -1) {
      return;
    }
    let model = AbstractFileHandler.modelProperty.get(widget);
    return this.getState(widget).then(contents => {
      return this.manager.save(model.path, contents).then(contents => {
        widget.title.className = widget.title.className.replace(DIRTY_CLASS, '');
        return contents;
      });
    });
  }

  /**
   * Revert widget contents.
   *
   * @param widget - The widget to revert (defaults to current active widget).
   *
   * returns A promise that resolves to the new contents of the widget.
   */
  revert(widget?: Widget): Promise<IContentsModel> {
    widget = widget || this._activeWidget;
    if (this._widgets.indexOf(widget) === -1) {
      return;
    }
    let model = AbstractFileHandler.modelProperty.get(widget);
    return this.getContents(model).then(contents => {
      return this.setState(widget, contents).then(() => {
        widget.title.className = widget.title.className.replace(DIRTY_CLASS, '');
        return contents;
      });
    });
  }

  /**
   * Close a widget.
   *
   * @param widget - The widget to close (defaults to current active widget).
   *
   * returns A boolean indicating whether the widget was closed.
   */
  close(widget?: Widget): boolean {
    widget = widget || this._activeWidget;
    let index = this._widgets.indexOf(widget);
    if (index === -1) {
      return false;
    }
    widget.dispose();
    this._widgets.splice(index, 1);
    if (widget === this._activeWidget) {
      this._activeWidget = null;
    }
    return true;
  }

  /**
   * Close all widgets.
   */
  closeAll(): void {
    for (let w of this._widgets) {
      w.close();
    }
    this._activeWidget = null;
  }

  /**
   * Filter messages on the widget.
   */
  filterMessage(handler: IMessageHandler, msg: Message): boolean {
    if (msg.type == 'close-request') {
      return this.close(handler as Widget);
    }
    return false;
  }

  /**
   * Get file contents given a path.
   *
   * #### Notes
   * Subclasses are free to use any or none of the information in
   * the model.
   */
  protected abstract getContents(model: IContentsModel): Promise<IContentsModel>;

  /**
   * Create the widget from a path.
   */
  protected abstract createWidget(model: IContentsModel): Widget;

  /**
   * Populate a widget from `IContentsModel`.
   *
   * #### Notes
   * Subclasses are free to use any or none of the information in
   * the model.
   */
  protected abstract setState(widget: Widget, model: IContentsModel): Promise<void>;

  /**
   * Get the contents model for a widget.
   */
  protected abstract getState(widget: Widget): Promise<IContentsModel>;

  /**
   * Get the path from the old path widget title text.
   *
   * #### Notes
   * This is intended to be subclassed by other file handlers.
   */
  protected getNewPath(oldPath: string, title: string): string {
    let dirname = oldPath.slice(0, oldPath.lastIndexOf('/') + 1);
    return dirname + title;
  }

  /**
   * Handle a change to one of the widget titles.
   */
  protected titleChanged(title: Title, args: IChangedArgs<any>): void {
    let widget = arrays.find(this._widgets,
      (w, index) => { return w.title === title; });
    if (widget === void 0) {
      return
    }
    if (args.name == 'text') {
      let model = AbstractFileHandler.modelProperty.get(widget);
      let newPath = this.getNewPath(model.path, args.newValue);
      this.manager.rename(model.path, newPath).then(contents =>
        AbstractFileHandler.modelProperty.set(widget, contents));
    }
  }

  /**
   * Handle a focus events.
   */
  private _onFocus = (event: Event) {
    let target = event.target as HTMLElement;
    let prev = this._activeWidget;
    let widget = arrays.find(this._widgets,
      w => w.isVisible && w.node.contains(target));
    if (widget) {
      this._activeWidget = widget;
      if (!prev) this.activated.emit(void 0);
    }
  }

  private _manager: IContentsManager = null;
  private _widgets: Widget[] = [];
  private _activeWidget: Widget = null;
}


/**
 * An implementation of a file handler.
 */
export
class FileHandler extends AbstractFileHandler {
  /**
   * Get file contents given a path.
   *
   * #### Notes
   * Subclasses are free to use any or none of the information in
   * the model.
   */
  protected getContents(model: IContentsModel): Promise<IContentsModel> {
    return this.manager.get(model.path, { type: 'file', format: 'text' });
  }

  /**
   * Create the widget from an `IContentsModel`.
   */
  protected createWidget(model: IContentsModel): Widget {
    let widget = new JupyterCodeMirrorWidget();
    widget.title.text = model.path.split('/').pop();
    return widget as Widget;
  }

  /**
   * Populate a widget from `IContentsModel`.
   *
   * #### Notes
   * Subclasses are free to use any or none of the information in
   * the model.
   */
  protected setState(widget: Widget, model: IContentsModel): Promise<void> {
    let mirror = widget as CodeMirrorWidget;
    mirror.editor.getDoc().setValue(model.content);
    loadModeByFileName(mirror.editor, model.name);
    mirror.editor.on('change', () => {
      let className = widget.title.className;
      if (className.indexOf(DIRTY_CLASS) === -1) {
        widget.title.className += ` ${DIRTY_CLASS}`;
      }
    });
    return Promise.resolve(void 0);
  }

  /**
   * Get the contents model for a widget.
   */
  protected getState(widget: Widget): Promise<IContentsModel> {
    let model = AbstractFileHandler.modelProperty.get(widget);
    let name = model.path.split('/').pop();
    name = name.split('.')[0];
    let content = (widget as CodeMirrorWidget).editor.getDoc().getValue();
    return Promise.resolve({ path: model.path, content, name,
                             type: 'file', format: 'text' });
  }

}


/**
 * A namespace for AbstractFileHandler statics.
 */
export
namespace AbstractFileHandler {
  /**
   * An attached property with the widget path.
   */
  export
  const modelProperty = new Property<Widget, IContentsModel>({
    name: 'model',
    value: null
  });

  /**
   * A signal emitted when a file handler is activated.
   */
  export
  const activatedSignal = new Signal<AbstractFileHandler, void>();

  /**
   * A signal emitted when a file handler has finished populating a widget.
   */
  export
  const finishedSignal = new Signal<AbstractFileHandler, IContentsModel>();
}
