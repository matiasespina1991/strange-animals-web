import {useEffect, useSyncExternalStore} from 'react';

const baseWindowZIndex = 80;
const listeners = new Set<() => void>();
let windowStack: string[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return windowStack;
}

export function registerWindow(windowId: string) {
  if (windowStack.includes(windowId)) {
    return;
  }

  windowStack = [...windowStack, windowId];
  emitChange();
}

export function unregisterWindow(windowId: string) {
  if (!windowStack.includes(windowId)) {
    return;
  }

  windowStack = windowStack.filter((id) => id !== windowId);
  emitChange();
}

export function bringWindowToFront(windowId: string) {
  const nextStack = [...windowStack.filter((id) => id !== windowId), windowId];

  if (
    nextStack.length === windowStack.length &&
    nextStack.every((id, index) => id === windowStack[index])
  ) {
    return;
  }

  windowStack = nextStack;
  emitChange();
}

export function useWindowZIndex(windowId: string, open: boolean) {
  const stack = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!open) {
      unregisterWindow(windowId);
      return;
    }

    registerWindow(windowId);

    return () => {
      unregisterWindow(windowId);
    };
  }, [open, windowId]);

  const stackIndex = stack.indexOf(windowId);

  return baseWindowZIndex + Math.max(stackIndex, 0);
}
