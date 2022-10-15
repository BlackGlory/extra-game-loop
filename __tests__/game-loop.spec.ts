import { GameLoop } from '@src/game-loop'
import { ReusableDeferred } from 'extra-promise'
import { go } from '@blackglory/prelude'
import { setTimeout } from 'extra-timers'

const { setImmediate } = jest.requireActual('timers')

const timeoutDeferred = new ReusableDeferred<number>()
const requestIdToCancel = new Map<number, () => void>()
let nextRequestId = 0
let requestAnimationFrameSpy: jest.SpyInstance<
  number
, [callback: FrameRequestCallback]
>
let cancelAnimationFrameSpy: jest.SpyInstance<void, [handle: number]>

beforeEach(() => {
  jest.useFakeTimers()

  requestAnimationFrameSpy = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback: (timestamp: number) => void): number => {
      const requestId = nextRequestId++

      go(async () => {
        try {
          const cancelTimeout = setTimeout(
            await timeoutDeferred
          , () => {
              requestIdToCancel.delete(requestId)
              callback(performance.now())
            }
          )
          requestIdToCancel.set(requestId, cancelTimeout)
        } catch {
          requestIdToCancel.delete(requestId)
        }
      })

      return requestId
    })

  cancelAnimationFrameSpy = jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation((requestId: number) => {
      timeoutDeferred.reject(new Error('Cancel'))
      requestIdToCancel.get(requestId)?.()
      requestIdToCancel.delete(requestId)
    })
})

afterEach(() => {
  jest.clearAllTimers()
  requestAnimationFrameSpy.mockRestore()
  cancelAnimationFrameSpy.mockRestore()
})

describe('GameLoop', () => {
  test('order of execution', async () => {
    const orderOfExecution: string[] = []
    const update = jest.fn(() => {
      orderOfExecution.push('Update')
    })
    const fixedUpdate = jest.fn(() => {
      orderOfExecution.push('FixedUpdate')
    })
    const lateUpdate = jest.fn(() => {
      orderOfExecution.push('LateUpdate')
    })
    const render = jest.fn(() => {
      orderOfExecution.push('Render')
    })
    const gameLoop = new GameLoop({
      fixedDeltaTime: 500
    , maximumDeltaTime: Infinity
    , update
    , fixedUpdate
    , lateUpdate
    , render
    })
    gameLoop.start()

    try {
      // frame 1
      expect(orderOfExecution).toStrictEqual([
        'Update'
      , 'LateUpdate'
      , 'Render'
      ])
      orderOfExecution.length = 0

      await advanceTimersByTime(500) // 500ms, frame 2

      expect(orderOfExecution).toStrictEqual([
        'Update'
      , 'FixedUpdate'
      , 'LateUpdate'
      , 'Render'
      ])
    } finally {
      gameLoop.stop()
    }
  })

  test('fixedDeltaTime', async () => {
    const update = jest.fn()
    const fixedUpdate = jest.fn()
    const lateUpdate = jest.fn()
    const render = jest.fn()
    const gameLoop = new GameLoop({
      fixedDeltaTime: 500
    , maximumDeltaTime: Infinity
    , update
    , fixedUpdate
    , lateUpdate
    , render
    })
    gameLoop.start()

    try {
      expect(fixedUpdate).toBeCalledTimes(0)

      await advanceTimersByTime(499) // 499ms, frame 1
      expect(fixedUpdate).toBeCalledTimes(0)

      await advanceTimersByTime(1) // 500ms, frame 2
      expect(fixedUpdate).toBeCalledTimes(1)

      await advanceTimersByTime(1000) // 1500ms, frame 4
      expect(fixedUpdate).toBeCalledTimes(3)
    } finally {
      gameLoop.stop()
    }
  })

  test('maximumDeltaTime', async () => {
    const update = jest.fn()
    const fixedUpdate = jest.fn()
    const lateUpdate = jest.fn()
    const render = jest.fn()
    const gameLoop = new GameLoop({
      fixedDeltaTime: 500
    , maximumDeltaTime: 500
    , update
    , fixedUpdate
    , lateUpdate
    , render
    })
    gameLoop.start()

    try {
      expect(fixedUpdate).toBeCalledTimes(0)

      await advanceTimersByTime(499) // 499ms, frame 1
      expect(fixedUpdate).toBeCalledTimes(0)

      await advanceTimersByTime(1) // 500ms, frame 2
      expect(fixedUpdate).toBeCalledTimes(1)

      await advanceTimersByTime(1000) // 1500ms, frame 3
      expect(fixedUpdate).toBeCalledTimes(2)
    } finally {
      gameLoop.stop()
    }
  })

  test('update', async () => {
    const update = jest.fn()
    const fixedUpdate = jest.fn()
    const lateUpdate = jest.fn()
    const render = jest.fn()
    const gameLoop = new GameLoop({
      fixedDeltaTime: 500
    , maximumDeltaTime: Infinity
    , update
    , fixedUpdate
    , lateUpdate
    , render
    })
    gameLoop.start()

    try {
      expect(update).toBeCalledTimes(1) // 0ms, frame 1
      const [deltaTime1] = update.mock.lastCall
      expect(deltaTime1).toBe(0)

      await advanceTimersByTime(1) // 1ms, frame 2
      expect(update).toBeCalledTimes(2)
      const [deltaTime2] = update.mock.lastCall
      expect(deltaTime2).toBe(1)
    } finally {
      gameLoop.stop()
    }
  })

  test('fixedUpdate', async () => {
    const update = jest.fn()
    const fixedUpdate = jest.fn()
    const lateUpdate = jest.fn()
    const render = jest.fn()
    const gameLoop = new GameLoop({
      fixedDeltaTime: 500
    , maximumDeltaTime: Infinity
    , update
    , fixedUpdate
    , lateUpdate
    , render
    })
    gameLoop.start()

    try {
      expect(fixedUpdate).toBeCalledTimes(0) // 0ms, frame 1

      await advanceTimersByTime(500) // 500ms, frame 2
      expect(fixedUpdate).toBeCalledTimes(1)
      const [deltaTime1] = fixedUpdate.mock.lastCall
      expect(deltaTime1).toBe(1000 / 2)

      await advanceTimersByTime(1000) // 1500ms, frame 3
      expect(fixedUpdate).toBeCalledTimes(3)
      const [deltaTime2] = fixedUpdate.mock.calls[fixedUpdate.mock.calls.length - 2]
      expect(deltaTime2).toBe(1000 / 2)
      const [deltaTime3] = fixedUpdate.mock.lastCall
      expect(deltaTime3).toBe(1000 / 2)
    } finally {
      gameLoop.stop()
    }
  })

  test('lateUpdate', async () => {
    const update = jest.fn()
    const fixedUpdate = jest.fn()
    const lateUpdate = jest.fn()
    const render = jest.fn()
    const gameLoop = new GameLoop({
      fixedDeltaTime: 500
    , maximumDeltaTime: Infinity
    , update
    , fixedUpdate
    , lateUpdate
    , render
    })
    gameLoop.start()

    try {
      expect(lateUpdate).toBeCalledTimes(1) // 0ms, frame 1
      const [deltaTime1, alpha1] = lateUpdate.mock.lastCall
      expect(deltaTime1).toBe(0)
      expect(alpha1).toBe(0) // 第一帧的alpha一定为0, 因为deltaTime为0

      await advanceTimersByTime(1) // 1ms, frame 2
      expect(lateUpdate).toBeCalledTimes(2)
      const [deltaTime2, alpha2] = lateUpdate.mock.lastCall
      expect(deltaTime2).toBe(1)
      expect(alpha2).toBe(0.002) // 第二帧的alpha为`1ms / 500ms = 0.002`
    } finally {
      gameLoop.stop()
    }
  })

  test('render', async () => {
    const update = jest.fn()
    const fixedUpdate = jest.fn()
    const lateUpdate = jest.fn()
    const render = jest.fn()
    const gameLoop = new GameLoop({
      fixedDeltaTime: 500
    , maximumDeltaTime: Infinity
    , update
    , fixedUpdate
    , lateUpdate
    , render
    })
    gameLoop.start()

    try {
      expect(render).toBeCalledTimes(1) // 0ms, frame 1
      expect(render).lastCalledWith(expect.any(Number))
      const alpha1 = render.mock.lastCall[0]
      expect(alpha1).toBe(0) // 第一帧的alpha一定为0, 因为deltaTime为0

      await advanceTimersByTime(1) // 1ms, frame 2
      expect(render).toBeCalledTimes(2)
      expect(render).lastCalledWith(expect.any(Number))
      const alpha2 = render.mock.lastCall[0]
      expect(alpha2).toBe(0.002) // 第二帧的alpha为`1ms / 500ms = 0.002`
    } finally {
      gameLoop.stop()
    }
  })

  describe('getFramesOfSecond', () => {
    test('running', async () => {
      const update = jest.fn()
      const fixedUpdate = jest.fn()
      const lateUpdate = jest.fn()
      const render = jest.fn()
      const gameLoop = new GameLoop({
        fixedDeltaTime: Infinity
      , maximumDeltaTime: Infinity
      , update
      , fixedUpdate
      , lateUpdate
      , render
      })
      gameLoop.start()

      try {
        expect(gameLoop.getFramesOfSecond()).toBe(0)

        for (let i = 60 /* fps */ * 60 /* seconds */; i--;) {
          await advanceTimersByTime(1000 / 60)
        }

        expect(Math.round(gameLoop.getFramesOfSecond())).toBeGreaterThan(50)
        expect(Math.round(gameLoop.getFramesOfSecond())).toBeLessThanOrEqual(60)
      } finally {
        gameLoop.stop()
      }
    })

    test('not running', () => {
      const update = jest.fn()
      const fixedUpdate = jest.fn()
      const lateUpdate = jest.fn()
      const render = jest.fn()
      const gameLoop = new GameLoop({
        fixedDeltaTime: Infinity
      , maximumDeltaTime: Infinity
      , update
      , fixedUpdate
      , lateUpdate
      , render
      })

      const result = gameLoop.getFramesOfSecond()

      expect(result).toBe(0)
    })
  })
})

async function advanceTimersByTime(timeout: number): Promise<void> {
  timeoutDeferred.resolve(timeout)
  await new Promise(resolve => setImmediate(resolve))
  jest.advanceTimersByTime(timeout)
  await new Promise(resolve => setImmediate(resolve))
}
