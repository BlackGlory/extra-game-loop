# extra-game-loop
## Install
```sh
npm install --save extra-game-loop
# or
yarn add extra-game-loop
```

## Usage
```ts
import { GameLoop } from 'extra-game-loop'

const gameLoop = new GameLoop({
  fixedDeltaTime: 1000 / 50
, maximumDeltaTime: (1000 / 50) * 30
, update(deltaTime: number): void {
    // ...
  }
, fixedUpdate(deltaTime: number): void {
    // ...
  }
, lateUpdate(deltaTime: number, alpha: number): void {
    // ...
  }
, render(alpha: number): void {
    // ...
  }
})

gameLoop.start()
```

## API
### GameLoop
```ts
class GameLoop<FixedDeltaTime extends number = number> {
  constructor(options: {
    fixedDeltaTime: FixedDeltaTime /* ms */
    maximumDeltaTime: number /* ms */
    update?: (deltaTime: number /* ms */) => void
    fixedUpdate?: (deltaTime: FixedDeltaTime /* ms */) => void
    lateUpdate?: (deltaTime: number /* ms */, alpha: number) => void
    render?: (alpha: number /* [0, 1) */) => void
  })

  start(): void
  stop(): void
  getFramesOfSecond(): number

  /**
   * This method allows you to manually advance to the next frame.
   */
  nextFrame(deltaTime: number): void
}
```

### GameLoopLite
```ts
class GameLoopLite {
  constructor(options: {
    update?: (deltaTime: number /* ms */) => void
    render?: () => void
  })

  start(): void
  stop(): void
  getFramesOfSecond(): number

  /**
   * This method allows you to manually advance to the next frame.
   */
  nextFrame(deltaTime: number): void
}
```

The lite version of `GameLoop` for situations where the physics system is not needed.

Basically, it can be seen as an OOP wrapper for `requestAnimationFrame`,
so it can be used for non-game projects as well.
