import * as K from 'kefir'
import * as R from 'ramda'

import * as XHR from './generated/dist/karet.xhr.es.js'

function show(x) {
  switch (typeof x) {
    case 'string':
    case 'object':
      return JSON.stringify(x)
    default:
      return `${x}`
  }
}

const toExpr = f =>
  f
    .toString()
    .replace(/\s+/g, ' ')
    .replace(/^\s*function\s*\(\s*\)\s*{\s*(return\s*)?/, '')
    .replace(/\s*;?\s*}\s*$/, '')
    .replace(/function\s*(\([a-zA-Z0-9, ]*\))\s*/g, '$1 => ')
    .replace(/\(([^),]+)\) =>/, '$1 =>')
    .replace(/{\s*return\s*([^{;]+)\s*;\s*}/g, '$1')
    .replace(/\(0, [^.]*[.]([^)]*)\)/g, '$1')
    .replace(/\$\d+/g, '')

const testEq = (expect, thunk) =>
  it(`${toExpr(thunk)} => ${show(expect)}`, done => {
    const actual = thunk()
    function check(actual) {
      if (!R.equals(actual, expect)) {
        done(new Error(`Expected: ${show(expect)}, actual: ${show(actual)}`))
      } else {
        done()
      }
    }
    if (actual instanceof K.Property) {
      actual.bufferBy(K.never()).observe({value: check, error: check})
    } else {
      check(actual)
    }
  })

const testThrows = thunk =>
  it(`${toExpr(thunk)} => throws`, () => {
    try {
      thunk()
    } catch (_) {
      return
    }
    throw Error('Did not throw as expected.')
  })

if (process.env.NODE_ENV !== 'production') {
  describe('Argument validation', () => {
    testThrows(() => XHR.perform({}))
    testThrows(() =>
      XHR.perform({
        url: {not: 'a string'},
        headers: new Map(),
        withCredentials: 'not boolean',
        unknownParameter: 'bar'
      })
    )
  })

  describe('Names of exported functions', () => {
    it('match their export names', () => {
      for (const k in XHR) {
        const v = XHR[k]
        if (R.is(Function, v) && v.name !== k)
          throw Error(`Name of exported function '${k}' was '${v.name}'`)
      }
    })
  })
}

describe('XHR', () => {
  const startingWithNonXHRs = xhr =>
    K.concat([K.sequentially(0, [false, {}, undefined]), xhr]).toProperty()

  testEq(['', 'Hello, world!'], () =>
    XHR.responseText(
      XHR.perform({
        url: 'http://localhost:3000/text',
        method: 'GET',
        timeout: 10000,
        withCredentials: true
      })
    )
  )
  testEq(['world'], () =>
    XHR.responseHeader('user', XHR.perform({url: 'http://localhost:3000/text'}))
  )
  testEq(['got something'], () =>
    XHR.allResponseHeaders(
      XHR.perform({url: 'http://localhost:3000/text'})
    ).map(text => (text ? 'got something' : text))
  )
  testEq([false, true], () =>
    XHR.statusIsHttpSuccess(XHR.perform({url: 'http://localhost:3000/text'}))
  )
  testEq(['Hello, mocha!'], () =>
    XHR.response(
      XHR.perform({
        url: K.constant('http://localhost:3000/text'),
        timeout: 10000,
        overrideMimeType: 'text/plain',
        user: 'browser',
        password: 'testing',
        headers: K.constant({user: 'mocha'})
      })
    )
  )
  testEq([{user: 'world'}], () =>
    XHR.getJson(K.constant('http://localhost:3000/json'))
  )
  testEq(['http://localhost:3000/json'], () =>
    XHR.responseURL(XHR.performJson('http://localhost:3000/json'))
  )
  testEq([true, false], () =>
    XHR.isProgressing(XHR.performJson({url: 'http://localhost:3000/json'}))
  )
  testEq([false, true, false], () =>
    XHR.isProgressing(
      startingWithNonXHRs(XHR.performJson({url: 'http://localhost:3000/json'}))
    )
  )
  testEq([0, 16], () =>
    XHR.loaded(
      startingWithNonXHRs(XHR.performJson({url: 'http://localhost:3000/json'}))
    )
  )
  testEq([0, 16], () =>
    XHR.total(
      startingWithNonXHRs(XHR.performJson({url: 'http://localhost:3000/json'}))
    )
  )
  testEq([[]], () =>
    XHR.errors(
      startingWithNonXHRs(XHR.performJson({url: 'http://localhost:3000/json'}))
    )
  )
  testEq([false], () =>
    XHR.hasFailed(
      startingWithNonXHRs(XHR.performJson({url: 'http://localhost:3000/json'}))
    )
  )
  testEq([false, true], () =>
    XHR.hasSucceeded(
      startingWithNonXHRs(XHR.performJson({url: 'http://localhost:3000/json'}))
    )
  )
  testEq([{user: '101'}], () =>
    XHR.response(
      XHR.perform({
        url: 'http://localhost:3000/json',
        responseType: 'json',
        headers: K.constant(new Map([['user', 101]]))
      })
    )
  )
  testEq(['[object Object]'], () =>
    XHR.responseXML(
      XHR.perform(
        K.constant({
          url: 'http://localhost:3000/xml',
          responseType: 'document',
          headers: new Map([['user', {}]])
        })
      )
    ).map(xml => xml.firstChild.textContent)
  )
  testEq(['Still there?'], () =>
    XHR.response(
      XHR.perform({url: 'http://localhost:3000/slow', timeout: 2000})
    )
  )
  testEq([], () =>
    XHR.response(XHR.perform({url: 'http://localhost:3000/slow', timeout: 200}))
  )
  testEq([false, true], () =>
    XHR.hasTimedOut(
      XHR.perform({url: 'http://localhost:3000/slow', timeout: 200})
    )
  )
  testEq(['failed'], () =>
    XHR.getJson({
      url: 'http://localhost:3000/slow',
      timeout: 200
    })
      .flatMapErrors(_ => K.constant('failed'))
      .toProperty()
  )
  testEq([false], () =>
    XHR.hasSucceeded(
      XHR.perform({url: 'http://localhost:3000/slow', timeout: 200})
    )
  )
  testEq([false], () =>
    XHR.hasTimedOut(
      XHR.perform({url: 'http://localhost:3000/slow', timeout: 2000})
    ).takeUntilBy(K.later(200, 'anything'))
  )
  testEq([{returnTo: 'sender'}], () =>
    XHR.response(
      XHR.perform({
        url: 'http://localhost:3000/echo',
        method: 'POST',
        responseType: 'json',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({returnTo: 'sender'})
      })
    )
  )
  testEq([true, 'Still there?'], () =>
    XHR.perform({url: 'http://localhost:3000/slow', timeout: 2000})
      .map(xhr => {
        try {
          return XHR.response(xhr)
        } catch (e) {
          return e.message === 'downHasCompleted'
        }
      })
      .skipDuplicates(R.equals)
  )
  testEq([true], () =>
    XHR.perform({url: 'http://localhost:3000/text'})
      .map(XHR.isDone)
      .filter(R.identity)
  )
})

describe('XHR deprecated', () => {
  testEq([false, true], () =>
    XHR.downHasSucceeded(XHR.perform('http://localhost:3000/json'))
  )
})
