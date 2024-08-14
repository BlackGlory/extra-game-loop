import { GameLoopLite } from '@src/game-loop-lite'
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

describe('GameLoopLite', () => {
  test('order of execution', async () => {
    const orderOfExecution: string[] = []
    const update = jest.fn(() => {
      orderOfExecution.push('Update')
    })
    const render = jest.fn(() => {
      orderOfExecution.push('Render')
    })
    const gameLoop = new GameLoopLite({
      update
    , render
    })
    gameLoop.start()

    try {
      // frame 1
      expect(orderOfExecution).toStrictEqual([
        'Update'
      , 'Render'
      ])
      orderOfExecution.length = 0

      await advanceTimersByTime(500) // 500ms, frame 2

      expect(orderOfExecution).toStrictEqual([
        'Update'
      , 'Render'
      ])
    } finally {
      gameLoop.stop()
    }
  })

  test('update', async () => {
    const update = jest.fn()
    const render = jest.fn()
    const gameLoop = new GameLoopLite({
      update
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

  test('render', async () => {
    const update = jest.fn()
    const render = jest.fn()
    const gameLoop = new GameLoopLite({
      update
    , render
    })
    gameLoop.start()

    try {
      expect(render).toBeCalledTimes(1) // 0ms, frame 1

      await advanceTimersByTime(1) // 1ms, frame 2
      expect(render).toBeCalledTimes(2)
    } finally {
      gameLoop.stop()
    }
  })

  describe('getFramesOfSecond', () => {
    test('running', async () => {
      const update = jest.fn()
      const render = jest.fn()
      const gameLoop = new GameLoopLite({
        update
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
      const render = jest.fn()
      const gameLoop = new GameLoopLite({
        update
      , render
      })

      const result = gameLoop.getFramesOfSecond()

      expect(result).toBe(0)
    })
  })

  test('nextFrame', async () => {
    const orderOfExecution: string[] = []
    const update = jest.fn(() => {
      orderOfExecution.push('Update')
    })
    const render = jest.fn(() => {
      orderOfExecution.push('Render')
    })
    const gameLoop = new GameLoopLite({
      update
    , render
    })

    gameLoop.nextFrame(0)
    // 0ms, frame 1
    expect(orderOfExecution).toStrictEqual([
      'Update'
    , 'Render'
    ])

    orderOfExecution.length = 0

    gameLoop.nextFrame(500) // 500ms, frame 2
    expect(orderOfExecution).toStrictEqual([
      'Update'
    , 'Render'
    ])
  })
})

async function advanceTimersByTime(timeout: number): Promise<void> {
  timeoutDeferred.resolve(timeout)
  await new Promise(resolve => setImmediate(resolve))
  jest.advanceTimersByTime(timeout)
  await new Promise(resolve => setImmediate(resolve))
}
