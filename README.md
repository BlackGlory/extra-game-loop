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
, fixedUpdate(deltaTime: number): State {
    // ...
  }
, update(deltaTime: number): void {
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
class GameLoop<FixedDeltaTime extends number> {
  constructor(options: {
    fixedDeltaTime: FixedDeltaTime /* ms */
    maximumDeltaTime: number /* ms */
    fixedUpdate: (deltaTime: FixedDeltaTime /* ms */) => void
    update: (deltaTime: number /* ms */) => void
    render: (alpha: number /* [0, 1) */) => void
  })

  start(): void
  stop(): void

  getFramesOfSecond(): number
}
```
