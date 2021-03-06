// todo needs comment

import { getPrototypeOf } from './commons';

export class ScopeHandler {
  // Properties stored on the handler are not available from the proxy.

  // the Proxy is only used by with(), so the Handler only needs to implement
  // a few properties: has, get, set (which we leave at the default)

  // todo: throw if any traps other than get/set/has are run (e.g.
  // getOwnPropertyDescriptors, apply, getPrototypeOf) . Make this handler
  // inherit from a second one whose 'get' property always throws.

  constructor(unsafeRec) {
    this.unsafeGlobal = unsafeRec.unsafeGlobal;
    this.unsafeEval = unsafeRec.unsafeEval;

    // this flag allow us to determine if the eval() call is a controlled
    // eval done by the realm's code or if it is user-land invocation, so
    // we can react differently.
    this.useUnsafeEvaluator = false;

    // todo: this.shadowTarget = getPrototypeOf(somehow_get_target)
  }

  get(target, prop) {
    // Special treatment for eval. The very first lookup of 'eval' gets the
    // unsafe (real direct) eval, so it will get the lexical scope that uses
    // the 'with' context.
    if (prop === 'eval') {
      // test that it is true rather than merely truthy
      if (this.useUnsafeEvaluator === true) {
        // reset before use
        this.useUnsafeEvaluator = false;
        return this.unsafeEval;
      }
      return target.eval;
    }

    if (prop === Symbol.unscopables) {
      // Safe to return a primal realm Object here because the only code that
      // can do a get() on a non-string is the internals of with() itself,
      // and the only thing it does is to look for properties on it. User
      // code cannot do a lookup on non-strings.
      return undefined;
    }

    // Properties of the global.
    if (prop in target) {
      return target[prop];
    }
    // Prevent the lookup for other properties.
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  set(target, prop, value) {
    // Set the value on the shadow. The target itself is an empty
    // object that is only used to prevent a froxen eval property.
    // todo: use this.shadowTarget, for speedup
    getPrototypeOf(target)[prop] = value;
    // Return true after successful set.
    return true;
  }

  // we need has() to return false for some names to prevent the lookup  from
  // climbing the scope chain and eventually reaching the unsafeGlobal
  // object, which is bad.

  // note: unscopables! every string in Object[Symbol.unscopables]

  // todo: we'd like to just have has() return true for everything, and then
  // use get() to raise a ReferenceError for anything not on the safe global.
  // But we want to be compatible with ReferenceError in the normal case and
  // the lack of ReferenceError in the 'typeof' case. Must either reliably
  // distinguish these two cases (the trap behavior might be different), or
  // we rely on a mandatory source-to-source transform to change 'typeof abc'
  // to XXX. We already need a mandatory parse to prevent the 'import' and
  // 'import.meta' expressions, since they're special forms instead of merely
  // being a global variable

  // note: if we make has() return true always, then we must implement a
  // set() trap to avoid subverting the protection of strict mode (it would
  // accept assignments to undefined globals, when it ought to throw
  // ReferenceError for such assignments)

  has(target, prop) {
    // proxies stringify 'prop', so no TOCTTOU danger here
    if (prop === 'eval') {
      return true;
    }
    if (prop === 'arguments') {
      return false;
    }
    if (prop in target) {
      return true;
    }
    // hide all properties of unsafeGlobal at the expense of 'typeof' being
    // wrong for those properties
    if (prop in this.unsafeGlobal) {
      // in browser, 'document = 3', this will add a property to your safeGlobal
      return true;
    }
    return false;
  }
}
