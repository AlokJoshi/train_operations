import { Train } from './Train.js'
import { Track } from './Track.js'
import { Tracks } from './Tracks.js'
import { Game } from './Game.js'
import { Intersections } from './Intersections.js'
import { financials } from './Financials.js'

let collisionCount = 0
const CANVASHEIGHT = 840
const CANVASWIDTH = 1240
const CANVASMARGIN = 0
const OFFSET_X = 0
const OFFSET_Y = 0
const gridSize = 100

const canvas = document.querySelector('#canvas')
const ctx = canvas.getContext('2d')

// canvas.height = CANVASHEIGHT
// canvas.width = CANVASWIDTH

const canvasTracks = document.querySelector('#canvas_tracks')
const canvasResults = document.querySelector('#canvas_results')
const ctxTracks = canvasTracks.getContext('2d')
const ctxResults = canvasResults.getContext('2d')
const canvasTemp = document.querySelector('#canvas_temp')
const ctxTemp = canvasTemp.getContext('2d')

canvas.height = canvasTracks.height = canvasTemp.height = canvasResults.height = CANVASHEIGHT + CANVASMARGIN
canvas.width = canvasTracks.width = canvasTemp.width = canvasResults.width = CANVASWIDTH + CANVASMARGIN

let paused = true
let startTrack = false
let click_error = 20
let validTrackPoints = new Set()

function setValidTrackPoints() {
  validTrackPoints.clear()
  for (let x = OFFSET_X; x <= CANVASWIDTH - OFFSET_X; x += gridSize) {
    for (let y = OFFSET_Y; y <= CANVASHEIGHT - OFFSET_Y; y += gridSize) {
      validTrackPoints.add(`${x},${y}`)
    }
  }
}

let intersections = new Intersections(CANVASWIDTH - OFFSET_X * 2, CANVASHEIGHT - OFFSET_Y * 2, gridSize, OFFSET_X, OFFSET_Y)

const game = new Game()

let tracks = new Tracks(ctxTracks)
let track = new Track(ctxTracks,
  [
    { x: CANVASMARGIN + 0, y: CANVASMARGIN + 0 },
    { x: CANVASMARGIN + 400, y: CANVASMARGIN + 0 },
    { x: CANVASMARGIN + 400, y: CANVASMARGIN + 800 },
    { x: CANVASMARGIN + 0, y: CANVASMARGIN + 800 },
    { x: CANVASMARGIN + 0, y: CANVASMARGIN + 0 },
  ], 'Bullet Train'

)
game.addTrain(ctx, ctxTemp, 19, track, 10, 'Bullet Train', 0, intersections)

track = new Track(ctxTracks,
  [
    { x: CANVASMARGIN + 800, y: CANVASMARGIN + 200 },
    { x: CANVASMARGIN + 500, y: CANVASMARGIN + 200 },
    { x: CANVASMARGIN + 500, y: CANVASMARGIN + 500 },
    { x: CANVASMARGIN + 1100, y: CANVASMARGIN + 500 },
    { x: CANVASMARGIN + 1100, y: CANVASMARGIN + 700 },
    { x: CANVASMARGIN + 800, y: CANVASMARGIN + 700 },
    { x: CANVASMARGIN + 800, y: CANVASMARGIN + 200 },
  ], 'Express Train'

)
game.addTrain(ctx, ctxTemp, 18, track, 5, 'Express Train', 0, intersections)
let time = 0
const drawScene = () => {
  if (!paused) {
    time++
    if (time % 100 === 0) {
      // console.log(`Time: ${time}`)
      //display Financials for one second
      const resultsEl = document.querySelector('#canvas_results')
      // if (resultsEl) {
      //   resultsEl.style.display = 'block'
      //   resultsEl.style.zIndex = 10
      // }
      ctxResults.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
      ctxResults.font = '20px Arial'
      ctxResults.fillStyle = 'black'
      const financialsText = `Revenue: $${Math.round(financials.totalRevenue / 1000000)}M | Cost: $${Math.round(financials.totalExpenses / 1000000)}M | Profit: $${Math.round(financials.profit / 1000000)}M`
      ctxResults.fillText(financialsText, 10, 30)
      // setTimeout(() => {
      //   if (resultsEl) {
      //     resultsEl.style.display = 'none'
      //     resultsEl.style.zIndex = -10

      //   } 
      // },6000)
    }
    ctx.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
    game.draw()
    requestAnimationFrame(drawScene)
  }
}
drawScene()

window.addEventListener('load', () => {
  const startPausebutton = document.querySelector('#startPauseBtn')
  let positions = []
  const handleTrainHotkeys = (event) => {
    if (event.repeat || !event.code) return

    // console.log('Event object:', event);
    // console.log('Event code:', event.code);

    const isDigitKey = event.code.startsWith('Digit') || event.code.startsWith('Numpad')
    if (!isDigitKey) return

    const trainNumber = Number.parseInt(event.key, 10)
    if (!Number.isInteger(trainNumber) || trainNumber < 1 || trainNumber > 9) return

    game.startStopTrain(trainNumber)
  }

  startPausebutton.addEventListener('click', () => {
    paused = !paused
    drawScene()
  })

  document.addEventListener('keydown', handleTrainHotkeys)

  document.querySelector('#canvas_temp').addEventListener('click', (event) => {
    if (startTrack) {
      const x = CANVASMARGIN + Math.round((event.pageX - CANVASMARGIN) / 100) * 100
      const y = CANVASMARGIN + Math.round((event.pageY - CANVASMARGIN) / 100) * 100
      if ((Math.abs(x - event.pageX) < click_error) && (Math.abs(y - event.pageY) < click_error)) {
        // console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y}`)
        if (!validTrackPoints.has(`${x},${y}`)) {
          // console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y} but it's not a valid track point`)
          return
        }
        positions.push({ x, y })
        updateCanvasTemp(x, y)
      } else {
        // console.log(`Clicked at ${event.pageX},${event.pageY}, not close enough to snap to a grid point`)
      }
    }
  })
  document.querySelector('#canvas_temp').addEventListener('mousemove', (event) => {
    //console.log(`mouse move event listener added`)
    if (startTrack) {
      //console.log(`mouse movin inside startTrack`)
      const x = CANVASMARGIN + Math.round((event.pageX - CANVASMARGIN) / 100) * 100
      const y = CANVASMARGIN + Math.round((event.pageY - CANVASMARGIN) / 100) * 100
      // console.log(`Mouse moved at Page(${event.pageX},${event.pageY}), x and y (${x},${y})`)
      if (Math.abs(x - event.pageX) < click_error && Math.abs(y - event.pageY) < click_error) {
        if (!validTrackPoints.has(`${x},${y}`)) {
          event.target.style = "cursor:default"
          return
        }
        event.target.style = "cursor:pointer"
      } else {
        event.target.style = "cursor:default"
      }
    }
  })

  document.querySelector('#startTrack').addEventListener('click', () => {
    startTrack = true
    document.querySelector('#canvas_temp').style = 'cursor:crosshair'
    setValidTrackPoints()
    positions = []
    // const endTrackBtn = document.querySelector('#endTrack')
    // if (endTrackBtn) {
    //   endTrackBtn.style.visibility = 'visible'
    // }
    //console.log(`Start Track Button clicked`)
  })

  // document.querySelector('#endTrack').addEventListener('click', () => {
  //   ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
  //   if (startTrack) {
  //     startTrack = false
  //     document.querySelector('#canvas').style = 'cursor:default'
  //     const track = new Track(ctxTracks, positions,'SuperFast')
  //     tracks.add(track)
  //     tracks.draw()
  //     let speed = Math.ceil(Math.random() * 19)
  //     game.addTrain(ctx, ctxTemp, speed, track, 5, 'SuperFast', 0, intersections)
  //     positions = []
  //     setValidTrackPoints()
  //     ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
  //   }
  //   const startTrackBtn = document.querySelector('#startTrack')
  //   if (startTrackBtn) {
  //     startTrackBtn.style.visibility = 'visible'
  //   }
  // })

  //set up the grid
  drawGrid(ctxTracks)
  function updateCanvasTemp() {
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    //for each of the positions draw a small circle on ctxTemp
    positions.forEach(position => {
      const { x, y } = position
      ctxTemp.save()
      ctxTemp.beginPath()
      ctxTemp.moveTo(x, y)
      ctxTemp.fillStyle = 'blue'
      ctxTemp.arc(x, y, 7, 0, Math.PI * 2)
      ctxTemp.closePath()
      ctxTemp.fill()
      ctxTemp.restore()
    })

    //clear the set and set it again with new valid points
    validTrackPoints.clear()

    //mark all points in the same row and column as the last position with a light green
    const { x: last_x, y: last_y } = positions[positions.length - 1]
    const lastRow = last_y / gridSize
    for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
      if (row == lastRow || row == lastRow - 1 || row == lastRow + 1) {
        //go to next iteration since we want only gradual change in track direction and not sharp turns
        continue
      } else {
        //drawCircle
        ctxTemp.beginPath()
        ctxTemp.moveTo(last_x + click_error, row * gridSize)
        ctxTemp.arc(last_x, row * gridSize, click_error, 0, Math.PI * 2)
        ctxTemp.strokeStyle = `rgba(0,255,0,0.3)`
        ctxTemp.closePath()
        ctxTemp.stroke()
        validTrackPoints.add(`${last_x},${row * gridSize}`)
      }
    }

    const lastCol = last_x / gridSize
    for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
      if (col == lastCol || col == lastCol - 1 || col == lastCol + 1) {
        //go to next iteration since we want only gradual change in track direction and not sharp turns
        continue
      } else {
        //drawCircle
        ctxTemp.beginPath()
        ctxTemp.moveTo(col * gridSize + click_error, last_y)
        ctxTemp.arc(col * gridSize, last_y, click_error, 0, Math.PI * 2)
        ctxTemp.strokeStyle = `rgba(0,255,0,0.3)`
        ctxTemp.closePath()
        ctxTemp.stroke()
        validTrackPoints.add(`${col * gridSize},${last_y}`)
      }
    }
  }
  window.addEventListener('collision', (event) => {
    // console.log(`Collision between train ${event.train1} and train ${event.train2}`)
    // count total collisions
    collisionCount++
    displayCollision(event.col, event.row)
    financials.incrementCollisionCost()
    pauseBothTrains(event.train1, event.train2)
    showCustomAlert(`Collision detected between train ${event.train1} and train ${event.train2} at intersection (${event.row},${event.col}). Total collisions: ${collisionCount}`)
    setTimeout(() => {
      clearCollision(event.col, event.row)
    }, 3000)
    //we want to inform the train about the collision and set its state to 
    //dysfunctional so that it does not move any further till the dysfunctional state is cleared. This will prevent multiple collision events for the same intersection as the train will not move further till the collision is cleared.
    game.trains[event.train1 - 1].setDysfunctional(true)
    game.trains[event.train2 - 1].setDysfunctional(true)
  })

  window.speedtrain = (direction, trainnumber) => {
    if (direction === 'up') {
      game.increaseTrainSpeed(trainnumber)
    } else if (direction === 'down') {
      game.decreaseTrainSpeed(trainnumber)
    }
  }

  window.startStopTrain = (trainnumber) => {
    game.startStopTrain(trainnumber)
  }

  window.starttrack = () => {
    startTrack = true
    const cancelTrackBtn = document.querySelector('#cancelTrack')
    const startTrackBtn = document.querySelector('#startTrack')
    if (startTrackBtn) {
      startTrackBtn.style.display = 'none'
    }
    if (cancelTrackBtn) {
      cancelTrackBtn.style.display = 'block'
    }
    document.querySelector('#canvas_temp').style = 'cursor:crosshair'
  }

  window.canceltrack = () => {
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    if (startTrack) {
      startTrack = false
      document.querySelector('#canvas').style = 'cursor:default'
      positions = []
      setValidTrackPoints()
      const startTrackBtn = document.querySelector('#startTrack')
      if (startTrackBtn) {
        startTrackBtn.style.display = 'block'
      }
      const cancelTrackBtn = document.querySelector('#cancelTrack')
      if (cancelTrackBtn) {
        cancelTrackBtn.style.display = 'none'
      }
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    }
  }

  window.removetrain = (trainnumber) => {
    ctxTracks.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    drawGrid(ctxTracks)
    game.removeTrain(trainnumber)
    intersections.removeTrain(trainnumber)
    //clear intersections from ctxTemp for the removed train
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
  }

  window.newtrain = () => {

    if (positions.length < 2) {
      if (positions.length === 1) {
        new swal(`You have specified a starting point and no ending point. To create a track, you need to specify at least two points.`)
      } else {
        new swal(`You have not specified any points for the track. To create a track, you need to specify at least two points.`)
      }
      return
    }
    
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    const speedEl = document.querySelector('#speed')
    const numCoachesEl = document.querySelector('#numcoaches')
    const trainNameEl = document.querySelector('#trainname')
    const parsedSpeed = Number.parseInt(speedEl?.value ?? '', 10)
    const speed = Number.isInteger(parsedSpeed) && parsedSpeed >= 1 && parsedSpeed <= 19
      ? parsedSpeed
      : Math.ceil(Math.random() * 19)

    const parsedNumCoaches = Number.parseInt(numCoachesEl?.value ?? '', 10)
    const numCoaches = Number.isInteger(parsedNumCoaches) && parsedNumCoaches >= 0
      ? parsedNumCoaches
      : 5

    const defaultTrainName = `Train${game.trains.length + 1}`
    const trainName = trainNameEl?.value?.trim() ? trainNameEl.value.trim() : defaultTrainName
    const track = new Track(ctxTracks, positions, trainName)
    tracks.add(track)
    tracks.draw()
    if (track) {
      game.addTrain(ctx, ctxTemp, speed, track, numCoaches, trainName, 0, intersections)
    } else {
      console.log(`No tracks available to add a new train`)
    }
    //set the icon to play
    const startTrackBtn = document.querySelector('#startTrack')
    if (startTrackBtn) {
      startTrackBtn.style.display = 'block'
    }
    const cancelTrackBtn = document.querySelector('#cancelTrack')
    if (cancelTrackBtn) {
      cancelTrackBtn.style.display = 'none'
    }

  }
})

function displayCollision(col, row) {
  const x = OFFSET_X + col * gridSize
  const y = OFFSET_Y + row * gridSize
  ctxTemp.beginPath()
  ctxTemp.fillStyle = 'rgba(255,0,0,0.5)'
  ctxTemp.moveTo(x, y)
  ctxTemp.arc(x, y, 50, 0, Math.PI * 2)
  ctxTemp.fill()
}

function clearCollision(col, row) {
  const x = OFFSET_X + col * gridSize
  const y = OFFSET_Y + row * gridSize
  ctxTemp.clearRect(x - 50, y - 50, 100, 100)
}

function drawGrid(ctx) {
  const numCols = (CANVASWIDTH - 0.5 * CANVASMARGIN) / gridSize
  const numRows = (CANVASHEIGHT - 0.5 * CANVASMARGIN) / gridSize
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.beginPath()

  for (let i = 0; i <= numCols; i++) {
    ctx.moveTo(CANVASMARGIN + i * gridSize, CANVASMARGIN)
    ctx.lineTo(CANVASMARGIN + i * gridSize, CANVASHEIGHT - CANVASMARGIN)
  }
  for (let j = 0; j <= numRows; j++) {
    ctx.moveTo(CANVASMARGIN + 0, CANVASMARGIN + j * gridSize)
    ctx.lineTo(CANVASWIDTH - CANVASMARGIN, CANVASMARGIN + j * gridSize)
  }
  ctx.closePath()
  ctx.stroke()
}

async function showCustomAlert(message) {
  new swal({
    title: 'Train Operations-Alert',
    text: message
    // buttons: {
    //   confirm: {
    //     text: 'OK',
    //     className: 'custom-confirm-button'
    //   }
    // }
  });
}

function pauseBothTrains(train1Number, train2Number) {
  const train1 = game.trains[train1Number - 1]
  const train2 = game.trains[train2Number - 1]
  train1.startStop()
  train2.startStop()
}

