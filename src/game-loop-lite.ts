import { FiniteStateMachine, IFiniteStateMachineSchema } from 'extra-fsm'

interface IGameLoopLiteOptions {
  /**
   * 每帧运行一次, 总是最早运行.
   */
  update?: (deltaTime: number) => void

  /**
   * 每帧运行一次, 总是最晚运行.
   */
  render?: () => void
}

enum State {
  Stopped = 'stopped'
, Running = 'running'
}

type Event =
| 'start'
| 'stop'

const schema: IFiniteStateMachineSchema<State, Event> = {
  [State.Stopped]: { start: State.Running }
, [State.Running]: { stop: State.Stopped }
}

export class GameLoopLite {
  private readonly fsm = new FiniteStateMachine(schema, State.Stopped)
  private readonly update?: (deltaTime: number) => void
  private readonly render?: () => void
  private requstId?: number
  private lastTimestamp?: number
  private lastDeltaTime = 0

  constructor(options: IGameLoopLiteOptions) {
    this.update = options.update
    this.render = options.render
  }

  start(): void {
    this.fsm.send('start')

    const timestamp = performance.now()
    this.lastTimestamp = timestamp
    this.loop(timestamp)
  }

  stop(): void {
    this.fsm.send('stop')

    cancelAnimationFrame(this.requstId!)

    delete this.requstId
    delete this.lastTimestamp
    this.lastDeltaTime = 0
  }

  getFramesOfSecond(): number {
    if (this.fsm.matches(State.Running)) {
      return this.lastDeltaTime !== 0
           ? 1000 / this.lastDeltaTime
           : 0
    } else {
      return 0
    }
  }

  private loop = (timestamp: number): void => {
    // 如果传入的timestamp可能来自`performance.now()`, 则有可能出现deltaTime小于0的情况.
    // 因为rAF的时间戳来自V-Sync, 出于动画帧同步方面的原因, 它的值可能会小于`performance.now()`.
    const deltaTime = Math.max(timestamp - this.lastTimestamp!, 0)

    this.lastDeltaTime = deltaTime
    this.lastTimestamp = timestamp

    this.nextFrame(deltaTime)

    this.requstId = requestAnimationFrame(this.loop)
  }

  nextFrame(deltaTime: number): void {
    this.update?.(deltaTime)

    this.render?.()
  }
}
