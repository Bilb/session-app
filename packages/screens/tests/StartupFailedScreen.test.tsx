import { appLog, memoryPorts, resetPorts, setPorts } from '@session/app'
import {
  createKeylessTransport,
  createRefusingTransport,
  createSessionClient,
  keyMissing,
  keyUnavailable,
  SessionClientError,
  type BridgeTransport,
  type SessionClient,
} from '@session/client'
import { createFakeTransport, friends } from '@session/client/fake'
import { tr } from '@session/localization'
import { createSessionStore, type SessionStore } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { ModalStackRoot } from '@session/ui'
import { byId, nodeOf } from '@session/render-tier'
import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockInstance,
} from 'vitest'

import { StartupFailedScreen } from '#src/StartupFailedScreen'

import { renderScreen } from './support/render'

function alice(): SessionClient {
  const client = friends(['Alice', 'Bob']).clients['Alice']
  if (!client) throw new Error('fixture did not produce a client')
  return client
}

/** A client whose first read is refused with `message`, as an open database refuses one. */
function refusing(message: string): SessionClient {
  const client = alice()
  client.getAccountInfo = () => Promise.reject(new SessionClientError(message))
  return client
}

function keyless(transport: BridgeTransport): SessionClient {
  return createSessionClient(transport)
}

/** Starts the store on `client` and draws the screen its failure lands on. */
async function failedStart(client: SessionClient): Promise<SessionStore> {
  const store = createSessionStore(client)
  await store.actions.start()
  const { startupError, startupFailureKind } = store.getState()
  if (startupError === null || startupFailureKind === null) throw new Error('the start succeeded')
  renderScreen(
    <ModalStackRoot closeLabel={tr('close')} backLabel={tr('back')}>
      <StartupFailedScreen error={startupError} kind={startupFailureKind} />
    </ModalStackRoot>,
    { store },
  )
  return store
}

let close: Mock<() => void>
let critical: MockInstance<typeof appLog.critical>

beforeEach(() => {
  close = vi.fn<() => void>()
  const ports = memoryPorts()
  setPorts({ ...ports, window: { ...ports.window, close } })
  critical = vi.spyOn(appLog, 'critical').mockImplementation(() => undefined)
})

afterEach(() => {
  critical.mockRestore()
  resetPorts()
})

/** What the store's classification reaches the screen as, from the refusal each path makes. */
describe('the startup-failure screen', () => {
  it.each([
    [
      'a database the key does not open',
      () => refusing('file is not a database'),
      'shareExtensionDatabaseError',
    ],
    [
      'a malformed database',
      () => refusing('database disk image is malformed'),
      'shareExtensionDatabaseError',
    ],
    [
      'a key that is gone',
      () =>
        keyless(createKeylessTransport(keyMissing(), () => Promise.reject(new Error('unused')))),
      'shareExtensionDatabaseError',
    ],
    ['a locked database', () => refusing('database is locked'), 'shareExtensionDatabaseError'],
    ['a full disk', () => refusing('database or disk is full'), 'shareExtensionDatabaseError'],
    [
      'a locked keychain',
      () =>
        keyless(
          createKeylessTransport(keyUnavailable('locked'), () =>
            Promise.reject(new Error('unused')),
          ),
        ),
      'shareExtensionDatabaseError',
    ],
  ] as const)('explains %s, and offers a clear', async (_name, client, key) => {
    await failedStart(client())
    expect(byId(ELEMENT.startupFailed.explanation).textContent).toBe(
      tr(key).replaceAll('<br/>', '\n'),
    )
    expect(nodeOf(ELEMENT.startupFailed.clear)).not.toBeNull()
  })

  it('offers no clear, and blames no database, where the bridge could not be made', async () => {
    await failedStart(createSessionClient(createRefusingTransport('no module')))
    expect(byId(ELEMENT.startupFailed.explanation).textContent).toBe(tr('errorUnknown'))
    expect(nodeOf(ELEMENT.startupFailed.clear)).toBeNull()
  })

  it('asks before clearing with what is lost and what restores it, and logs each press', async () => {
    const user = userEvent.setup()
    await failedStart(refusing('database is locked'))

    await user.click(byId(ELEMENT.startupFailed.clear))
    const warning = tr('databaseErrorClearDeviceWarning').replaceAll('<br/>', '\n')
    expect(byId(ELEMENT.startupFailed.confirmClear).textContent).toContain(warning)
    expect(byId(ELEMENT.startupFailed.confirmClearButton).textContent).toBe(tr('clear'))
    expect(byId(ELEMENT.startupFailed.cancelClear).textContent).toBe(tr('cancel'))
    await user.click(byId(ELEMENT.startupFailed.cancelClear))

    await user.click(byId(ELEMENT.startupFailed.copyReason))
    await user.click(byId(ELEMENT.startupFailed.quit))
    expect(close).toHaveBeenCalledTimes(1)

    expect(critical.mock.calls).toEqual([
      ['startup', 'pressed clear device', { kind: 'transient' }],
      ['startup', 'pressed cancel clear', { kind: 'transient' }],
      ['startup', 'pressed copy reason', { kind: 'transient' }],
      ['startup', 'pressed quit', { kind: 'transient' }],
    ])
  })

  it('clears a device whose key is gone without a key, and starts again in place', async () => {
    const user = userEvent.setup()
    const clear = vi.fn(() => Promise.resolve(createFakeTransport(alice())))
    const store = await failedStart(keyless(createKeylessTransport(keyMissing(), clear)))
    expect(clear).not.toHaveBeenCalled()

    await user.click(byId(ELEMENT.startupFailed.clear))
    await user.click(byId(ELEMENT.startupFailed.confirmClearButton))

    await vi.waitFor(() => {
      expect(store.getState().hydrated).toBe(true)
    })
    expect(clear).toHaveBeenCalledTimes(1)
    expect(store.getState().startupError).toBeNull()
    expect(critical.mock.calls.map(([, message]) => message)).toEqual([
      'pressed clear device',
      'pressed confirm clear',
    ])
    expect(screen.queryByTestId(ELEMENT.startupFailed.confirmClear)).toBeNull()
  })
})
