import { FiniteStateMachine, IFiniteStateMachineSchema } from '@blackglory/structures'
import { assert } from '@blackglory/prelude'

interface IGameLoopOptions<FixedDeltaTime extends number> {
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
   * 每物理帧运行一次, 运行早于update.
   * deltaTime固定等于fixedDeltaTime.
   * 一帧中可能运行零次, 一次, 或数十次, 不应在此处理物理计算以外的繁重操作.
   */
  fixedUpdate: (deltaTime: FixedDeltaTime) => void

  /**
   * 每帧运行一次, 运行晚于fixedUpdate.
   * 在此处理用户输入等与物理计算无关的操作, 在update里改变的状态直到下一物理帧时才会反应.
   */
  update: (deltaTime: number) => void

  /**
   * 每帧运行一次, 总是运行在fixedUpdate和udpate之后.
   */
  render: () => void
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
  private readonly fixedUpdate: (fixedDeltaTime: FixedDeltaTime) => void
  private readonly update: (deltaTime: number) => void
  private readonly render: () => void
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

    this.fixedUpdate = options.fixedUpdate
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

  /**
   * nextFrame依序做以下几件事:
   * 1. 响应游戏世界从上一帧更新后到这一帧更新之前发生的物理变化.
   *    注意, 如果渲染帧率比物理帧率快, 且运行性能良好, 则物理帧不一定会在此帧更新.
   * 2. 响应用户输入, 为这一帧的游戏世界做出非物理方面的更新, 例如角色转向, 改变武器瞄准角度等.
   * 3. 渲染经过更新后的最新状态.
   */
  private nextFrame(deltaTime: number): void {
    this.deltaTimeAccumulator = Math.min(
      this.deltaTimeAccumulator + deltaTime
    , this.maximumDeltaTime
    )

    while (this.deltaTimeAccumulator >= this.fixedDeltaTime) {
      this.fixedUpdate(this.fixedDeltaTime)
      this.deltaTimeAccumulator -= this.fixedDeltaTime
    }
    this.update(deltaTime)
    this.render()
  }
}
