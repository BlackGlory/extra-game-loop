import { FiniteStateMachine, IFiniteStateMachineSchema } from 'extra-fsm'
import { assert } from '@blackglory/prelude'

interface IGameLoopOptions<FixedDeltaTime extends number = number> {
  /**
   * 物理帧一帧经过的时间, 可以通过`1000/fps`得来, 或物理引擎指示的最小deltaTime.
   */
  fixedDeltaTime: FixedDeltaTime

  /**
   * 将渲染帧的deltaTime拆分成物理帧时, 允许的最大渲染帧deltaTime,
   * 如果实际的渲染帧deltaTime超过此值, 则它会被重置为此值.
   * 这可以在性能较差的设备上解决因物理帧执行需要带时间过长而导致渲染帧率无限下降的"死亡螺旋"问题.
   */
  maximumDeltaTime: number

  /**
   * 每帧运行一次, 总是最早运行.
   * 在此处理用户输入等与物理计算无关的操作, 在update里改变的状态直到下一物理帧时才会反应.
   */
  update?: (deltaTime: number) => void

  /**
   * 每物理帧运行一次, 运行晚于update, 早于lateUpdate.
   * deltaTime固定等于fixedDeltaTime.
   * 一帧中可能运行零次, 一次, 或数十次, 不应在此处理物理计算以外的繁重操作.
   */
  fixedUpdate?: (deltaTime: FixedDeltaTime) => void

  /**
   * 每帧运行一次, 运行晚于fixedUpdate, 能获得alpha.
   * 出于各种原因, 你可能会想使用它.
   */
  lateUpdate?: (deltaTime: number, alpha: number) => void

  /**
   * 每帧运行一次, 总是最晚运行.
   */
  render?: (alpha: number) => void
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

export class GameLoop<FixedDeltaTime extends number> {
  private readonly fsm = new FiniteStateMachine(schema, State.Stopped)
  private readonly fixedDeltaTime: FixedDeltaTime
  private readonly maximumDeltaTime: number
  private readonly update?: (deltaTime: number) => void
  private readonly fixedUpdate?: (fixedDeltaTime: FixedDeltaTime) => void
  private readonly lateUpdate?: (deltaTime: number, alpha: number) => void
  private readonly render?: (alpha: number) => void
  private requstId?: number
  private lastTimestamp?: number
  private deltaTimeAccumulator = 0
  private lastDeltaTime = 0

  constructor(options: IGameLoopOptions<FixedDeltaTime>) {
    this.fixedDeltaTime = options.fixedDeltaTime
    this.maximumDeltaTime = options.maximumDeltaTime
    assert(
      this.maximumDeltaTime >= this.fixedDeltaTime
    , 'maximumDeltaTime must be greater than or equal to fixedDeltaTime'
    )

    this.update = options.update
    this.fixedUpdate = options.fixedUpdate
    this.lateUpdate = options.lateUpdate
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

  /**
   * nextFrame依序做以下几件事:
   * 1. 响应用户输入, 为这一帧的游戏世界做出非物理方面的更新, 例如角色转向, 改变武器瞄准角度等.
   * 2. 响应游戏世界从上一帧更新后到这一帧更新之前发生的物理变化.
   *    注意, 如果渲染帧率比物理帧率快, 且运行性能良好, 则物理帧不一定会在此帧更新.
   * 3. 渲染经过更新后的最新状态, 渲染器可以根据alpha参数执行插值渲染.
   */
  nextFrame(deltaTime: number): void {
    this.deltaTimeAccumulator = Math.min(
      this.deltaTimeAccumulator + deltaTime
    , this.maximumDeltaTime
    )

    this.update?.(deltaTime)

    while (this.deltaTimeAccumulator >= this.fixedDeltaTime) {
      this.fixedUpdate?.(this.fixedDeltaTime)
      this.deltaTimeAccumulator -= this.fixedDeltaTime
    }

    const alpha = this.deltaTimeAccumulator / this.fixedDeltaTime
    this.lateUpdate?.(deltaTime, alpha)
    this.render?.(alpha)
  }
}
