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

    this.lastTimestamp = performance.now()
    this.loop()
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

  private loop = (): void => {
    // requestAnimationFrame的实现存在陷阱, 它提供的timestamp参数有时会比`performance.now()`早.
    // 因此主动调用`performance.now()`来获取时间戳.
    // https://stackoverflow.com/questions/50895206/exact-time-of-display-requestanimationframe-usage-and-timeline
    const timestamp = performance.now()
    const deltaTime = timestamp - this.lastTimestamp!
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
