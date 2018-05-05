import * as I from 'infestines'
import * as K from 'kefir'
import * as L from 'kefir.partial.lenses'
import * as U from 'karet.util'

const initial = {type: 'initial'}

const eventTypes = ['loadstart', 'progress', 'timeout', 'load', 'error']

const UP = 'up'
const DOWN = 'down'

export const perform = U.through(
  U.template,
  U.flatMapLatest(
    ({
      url,
      method = 'GET',
      user = null,
      password = null,
      headers = I.array0,
      overrideMimeType,
      body = null,
      responseType,
      timeout,
      withCredentials
    }) =>
      K.stream(({emit, end}) => {
        const xhr = new XMLHttpRequest()
        let state = {xhr, up: initial, down: initial}
        const update = (dir, type) => event => {
          emit((state = L.set(dir, {type, event}, state)))
        }
        eventTypes.forEach(type => {
          xhr.addEventListener(type, update(DOWN, type))
          xhr.upload.addEventListener(type, update(UP, type))
        })
        xhr.addEventListener('readystatechange', event => {
          emit((state = L.set('event', event, state)))
        })
        xhr.addEventListener('loadend', event => {
          end(emit((state = L.set('event', event, state))))
        })
        xhr.open(method, url, true, user, password)
        if (responseType) xhr.responseType = responseType
        if (timeout) xhr.timeout = timeout
        if (withCredentials) xhr.withCredentials = withCredentials
        headers.forEach(hv => {
          xhr.setRequestHeader(hv[0], hv[1])
        })
        if (overrideMimeType) xhr.overrideMimeType(overrideMimeType)
        xhr.send(body)
        return () => {
          xhr.abort()
        }
      })
  ),
  U.toProperty
)

const is = I.curry((values, dir) =>
  L.get([dir, 'type', value => values.includes(value)])
)
const hasStarted = is(eventTypes)
const isProgressing = is(['progress', 'loadstart'])
const hasSucceeded = is(['load'])
const hasFailed = is(['error'])
const hasTimedOut = is(['timeout'])
const hasEnded = is(['load', 'error', 'timeout'])
const event = I.curry((prop, dir) => L.get([dir, 'event', prop]))
const loaded = event('loaded')
const total = event('total')
const error = event('error')

export const upHasStarted = hasStarted(UP)
export const upIsProgressing = isProgressing(UP)
export const upHasSucceeded = hasSucceeded(UP)
export const upHasFailed = hasFailed(UP)
export const upHasTimedOut = hasTimedOut(UP)
export const upHasEnded = hasEnded(UP)
export const upLoaded = loaded(UP)
export const upTotal = total(UP)
export const upError = error(UP)

export const downHasStarted = hasStarted(DOWN)
export const downIsProgressing = isProgressing(DOWN)
export const downHasSucceeded = hasSucceeded(DOWN)
export const downHasFailed = hasFailed(DOWN)
export const downHasTimedOut = hasTimedOut(DOWN)
export const downHasEnded = hasEnded(DOWN)
export const downLoaded = loaded(DOWN)
export const downTotal = total(DOWN)
export const downError = error(DOWN)

export const readyState = L.get(['xhr', 'readyState'])
export const response = U.through(
  L.get(['xhr', 'response']),
  U.skipDuplicates(I.acyclicEqualsU)
)
export const responseType = L.get(['xhr', 'responseType'])
export const responseURL = L.get(['xhr', 'responseURL'])
export const status = L.get(['xhr', 'status'])
export const statusText = L.get(['xhr', 'statusText'])
export const responseHeader = I.curry((header, xhr) =>
  L.get(['xhr', L.reread(xhr => xhr.getResponseHeader(header))], xhr)
)
export const allResponseHeaders = L.get([
  'xhr',
  L.reread(xhr => xhr.getAllResponseHeaders())
])

export const isHttpSuccess = U.lift(status => 200 <= status && status < 300)
