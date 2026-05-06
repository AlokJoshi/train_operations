import { Game } from './Game.js'
import { Intersections } from './Intersections.js'

globalThis.globalTicks = 0

let collisionCount = 0
const CANVASHEIGHT = 800 * 2
const CANVASWIDTH = 1200 * 2
const CANVASMARGIN = 0
const OFFSET_X = 0
const OFFSET_Y = 0
const gridSize = 100

const canvas = document.querySelector('#canvas')
const ctx = canvas.getContext('2d')

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
let startFlyover = false
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

const game = new Game(ctx, ctxTracks, ctxTemp, gridSize, OFFSET_X, OFFSET_Y)


let positions = [
  { x: CANVASMARGIN + 0, y: CANVASMARGIN + 0 },
  { x: CANVASMARGIN + 400, y: CANVASMARGIN + 0 },
  { x: CANVASMARGIN + 400, y: CANVASMARGIN + 800 },
  { x: CANVASMARGIN + 200, y: CANVASMARGIN + 800 }
]


game.addTrain(positions, 19, 3, 'Bullet Train', 0, intersections)


positions = [
  { x: CANVASMARGIN + 800, y: CANVASMARGIN + 200 },
  { x: CANVASMARGIN + 500, y: CANVASMARGIN + 200 },
  { x: CANVASMARGIN + 500, y: CANVASMARGIN + 500 },
  { x: CANVASMARGIN + 1100, y: CANVASMARGIN + 500 },
  { x: CANVASMARGIN + 1100, y: CANVASMARGIN + 700 },
  { x: CANVASMARGIN + 800, y: CANVASMARGIN + 700 }
]
game.addTrain(positions, 18, 5, 'Express Train', 1, intersections)

const drawScene = () => {
  if (!paused) {
    globalThis.globalTicks++
    if (globalThis.globalTicks % 100 === 0) {
      // console.log(`Time: ${globalThis.globalTicks}`)
      //display Financials for one second
      ctxResults.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
      ctxResults.font = '20px Arial'
      ctxResults.fillStyle = 'black'
      const financialSummary = game.getFinancialSummary(globalThis.globalTicks)
      const financialsText = `Revenue: $${Math.round(financialSummary.totalRevenue / 1000000)}M | Cost: $${Math.round(financialSummary.totalExpenses / 1000000)}M | Profit: $${Math.round(financialSummary.profit / 1000000)}M`
      ctxResults.fillText(financialsText, 10, 30)
      const finacialSummaryByTrain = game.getFinancialSummaryByTrain(globalThis.globalTicks)
      finacialSummaryByTrain.totalRevenue.forEach((revenue, index) => {
        if (revenue > 0 || finacialSummaryByTrain.totalExpenses[index] > 0) {
          const trainFinancialsText = `Train ${index + 1} - Revenue: $${Math.round(revenue / 1000000)}M | Cost: $${Math.round(finacialSummaryByTrain.totalExpenses[index] / 1000000)}M | Profit: $${Math.round(finacialSummaryByTrain.profit[index] / 1000000)}M`
          ctxResults.fillText(trainFinancialsText, 10, 60 + index * 30)
        }
      })
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
  let showingPopulationMap = false
  const handleTrainHotkeys = (event) => {

    // NEW: Do nothing if the user is typing in an input or textarea
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }

    if (event.repeat || !event.code) return
    const isDigitKey = event.code.startsWith('Digit') || event.code.startsWith('Numpad')
    if (isDigitKey) {
      const trainNumber = Number.parseInt(event.key, 10)
      if (!Number.isInteger(trainNumber) || trainNumber < 1 || trainNumber > 9) return
      game.startStopTrain(trainNumber)
    } else if (event.code === 'KeyT') {
      //if the code is T then show the Button Group 1 (trains)
      const buttonGroup1 = document.querySelector('#buttonGroup1')
      if (buttonGroup1.style.display === 'none') {
        buttonGroup1.style.display = 'flex'
      } else {
        buttonGroup1.style.display = 'none'
      }
    } else if (event.code === 'KeyF') {
      //if the code is F then show the possible Flyover related controls
      const FlyoverControls = document.querySelector('#buttonGroup2')
      if (FlyoverControls.style.display === 'none') {
        FlyoverControls.style.display = 'flex'
      } else {
        FlyoverControls.style.display = 'none'
      }
    } else if (event.code === 'KeyX') {
      //if the code is X then show the population Map
      if (!showingPopulationMap) {
        ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
        const populationMap = game.population.getAll()
        const maxPopulation = Math.max(...populationMap.map(p => p.population))
        const rMaxSquare = (gridSize / 2) ** 2
        populationMap.forEach(p => {
          const radiusSquare = rMaxSquare * (p.population / maxPopulation)
          const radius = Math.sqrt(radiusSquare)
          ctxTemp.beginPath()
          ctxTemp.arc(p.x, p.y, radius, 0, 2 * Math.PI)
          ctxTemp.fillStyle = 'rgba(255,0,0,0.5)'
          ctxTemp.fill()
        })
      } else {
        ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      }
      showingPopulationMap = !showingPopulationMap

    } else if (event.code === 'KeyP') {
      //if the code is P then Start/Pause the game
      startPauseGame()
    }
  }

  startPausebutton.addEventListener('click', () => {
    startPauseGame()
  })

  const startPauseGame = () => {
    //switch the play button to pause
    const startPauseButton = document.querySelector('#startPauseBtn')
    if (startPauseButton.classList.contains('fa-play')) {
      startPauseButton.classList.remove('fa-play')
      startPauseButton.classList.add('fa-pause')
    } else {
      startPauseButton.classList.remove('fa-pause')
      startPauseButton.classList.add('fa-play')
    }
    paused = !paused
    drawScene()
  }

  document.addEventListener('keydown', handleTrainHotkeys)

  const getCanvasPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  document.querySelector('#canvas_temp').addEventListener('click', (event) => {
    const point = getCanvasPoint(event)
    if (startTrack) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize
      if ((Math.abs(x - point.x) < click_error) && (Math.abs(y - point.y) < click_error)) {
        // console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y}`)
        if (!validTrackPoints.has(`${x},${y}`)) {
          // console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y} but it's not a valid track point`)
          return
        }
        positions.push({ x, y })
        updateCanvasTemp(x, y)
      }
    }
    if (startFlyover) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize
      if ((Math.abs(x - point.x) < click_error) && (Math.abs(y - point.y) < click_error)) {
        // console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y}`)
        console.log(`Flyover added at (${(x / gridSize) + 1},${(y / gridSize) + 1})`)
        swal.fire({
          title: `Add Flyover`,
          text: `Do you want to add a Flyover at (Row ${(y / gridSize) + 1}, Col ${(x / gridSize) + 1})?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes',
          cancelButtonText: 'No'
        }).then((result) => {
          if (result.isConfirmed) {
            const n = game.getNumberOfFlyovers()
            intersections.updateIntersectionsWithFlyoverLocation(y / gridSize, x / gridSize, true)
            //use swal to ask user for Flyover name and then add the Flyover to the game with the given name and the row and col corresponding to the x and y coordinates of the click event. The Flyover name should be in the format "Flyover n" where n is the number of Flyovers currently in the game + 1. After adding the Flyover, we should also update the intersections object to mark the intersection at the Flyover location as a Flyover intersection so that we do not register collisions at that intersection.
            //convert flyover name to 04-08 format where 04 is the row and 08 is the column. This is to make it easier for the user to identify the location of the Flyover based on its name.
            const defaultFlyoverName = `Flyover ${String((y / gridSize) + 1).padStart(2, '0')}-${String((x / gridSize) + 1).padStart(2, '0')}`
            swal.fire({
              title: 'Enter Flyover Name',
              input: 'text',
              inputLabel: 'Flyover Name',
              inputValue: defaultFlyoverName,
              showCancelButton: true,
              confirmButtonText: 'Add Flyover',
              cancelButtonText: 'Cancel',
              inputValidator: (value) => {
                if (!value) {
                  return 'Please enter a Flyover name'
                }
                return null
              }
            }).then((result) => {
              if (result.isConfirmed) {
                //as far as game is concerned the Flyover is added counting row and column from 0
                game.addFlyover(result.value, y / gridSize, x / gridSize)
                startFlyover = false
              }
            })
          }
        })
      }
    }
  })
  document.querySelector('#canvas_temp').addEventListener('mousemove', (event) => {
    const point = getCanvasPoint(event)
    //console.log(`mouse move event listener added`)
    if (startTrack) {
      //console.log(`mouse movin inside startTrack`)
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize
      // console.log(`Mouse moved at Page(${event.pageX},${event.pageY}), x and y (${x},${y})`)
      if (Math.abs(x - point.x) < click_error && Math.abs(y - point.y) < click_error) {
        if (!validTrackPoints.has(`${x},${y}`)) {
          event.target.style = "cursor:default"
          return
        }
        event.target.style = "cursor:pointer"
      } else {
        event.target.style = "cursor:default"
      }
    }
    if (startFlyover) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize
      if (Math.abs(x - point.x) < click_error && Math.abs(y - point.y) < click_error) {
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
  })

  window.startFlyover = function () {
    startFlyover = true
    startTrack = false
    window.showPossibleFlyoverLocations()
  }

  window.cancelFlyover = function () {
    startFlyover = false
    document.querySelector('#canvas_temp').style = 'cursor:default'
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
  }

  window.setPossibleFlyoverLocations = function () {
    const possibleLocations = []
    game.trains.forEach((train, index) => {
      train.track.possibleFlyoverLocations.forEach(location => {
        possibleLocations.forEach(possibleLocation => {
          if (possibleLocation.location.x === location.x && possibleLocation.location.y === location.y && possibleLocation.index !== index) {
            possibleLocation.count++
          }
        })
        possibleLocations.push({ location: location, index, count: 1 })
      })
    })
    Flyovers.setPossibleFlyoverLocations(possibleLocations.map(location => location.location))
  }

  window.showPossibleFlyoverLocations = function () {
    const possibleLocations = []
    game.trains.forEach((train, index) => {
      train.track.possibleFlyoverLocations.forEach(location => {
        possibleLocations.forEach(possibleLocation => {
          if (possibleLocation.location.x === location.x && possibleLocation.location.y === location.y && possibleLocation.index !== index) {
            possibleLocation.count++
          }
        })
        possibleLocations.push({ location: location, index, count: 1 })
      })
    })
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    possibleLocations.forEach(location => {
      if (!(location.count > 1)) {
        return;
      }
      const x = location.location.x
      const y = location.location.y
      ctxTemp.beginPath()
      ctxTemp.moveTo(x, y)
      ctxTemp.fillStyle = 'yellow'
      ctxTemp.arc(x, y, 10, 0, Math.PI * 2)
      ctxTemp.closePath()
      ctxTemp.fill()
    })
  }

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
    let x_before_last_x = null
    let y_before_last_y = null
    if (positions.length > 1) {
      x_before_last_x = positions[positions.length - 2].x
      y_before_last_y = positions[positions.length - 2].y
    }

    const lastRow = last_y / gridSize
    const lastCol = last_x / gridSize
    const increasingRow = y_before_last_y !== null && last_y > y_before_last_y
    const decreasingRow = y_before_last_y !== null && last_y < y_before_last_y
    const increasingCol = x_before_last_x !== null && last_x > x_before_last_x
    const decreasingCol = x_before_last_x !== null && last_x < x_before_last_x

    for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
      if (row == lastRow || row == lastRow - 1 || row == lastRow + 1 || (y_before_last_y !== null && ((increasingRow && row < lastRow) || (decreasingRow && row > lastRow)))) {
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

    for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
      if (col == lastCol || col == lastCol - 1 || col == lastCol + 1 || (x_before_last_x !== null && ((increasingCol && col < lastCol) || (decreasingCol && col > lastCol)))) {
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
    game.incrementCollisionCost(globalThis.globalTicks, event.train1, event.train2)
    pauseBothTrains(event.train1, event.train2)
    showCustomAlert(`Collision detected between train ${event.train1} and train ${event.train2} at intersection (${event.col + 1},${event.row + 1}). Total collisions: ${collisionCount}`)
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
    const train = game.trains[trainnumber - 1]
    const trainName = train ? train.name : `Train ${trainnumber}`
    swal.fire({
      title: `Remove ${trainName}`,
      text: `Are you sure you want to remove ${trainName}? This action cannot be undone. Also please note that 
      you will only recover the deperciated cost of coaches and engine but not the track.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove it!',
      cancelButtonText: 'No, keep it'
    }).then((result) => {
      if (result.isConfirmed) {
        ctxTracks.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
        drawGrid(ctxTracks)
        game.removeTrain(trainnumber)
        intersections.removeTrain(trainnumber)
        //clear intersections from ctxTemp for the removed train
        ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      }
    })
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

    const colorConfig = game.TRAINCONFIG[(game.trains.length) % game.TRAINCONFIG.length]
    const defaultTrainName = colorConfig.defaultName
    const trainName = trainNameEl?.value?.trim() ? trainNameEl.value.trim() : defaultTrainName

    game.addTrain(positions, speed, numCoaches, trainName, 0, intersections)
    game.setPossibleFlyoverLocations()

    //set the icon to play
    const startTrackBtn = document.querySelector('#startTrack')
    if (startTrackBtn) {
      startTrackBtn.style.display = 'block'
    }
    const cancelTrackBtn = document.querySelector('#cancelTrack')
    if (cancelTrackBtn) {
      cancelTrackBtn.style.display = 'none'
    }

    startTrack = false
  }

  function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    // You can use the whole div or a specific handle to drag
    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      const interactiveSelector = 'input, textarea, select, button, label, i, a'
      if (e.target.closest(interactiveSelector)) {
        return
      }
      e.preventDefault();
      // Get cursor position at startup
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      // Calculate new cursor position
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // Set the element's new position
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      // Stop moving when mouse button is released
      document.onmouseup = null;
      document.onmousemove = null;
    }

  }

  window.addCoach = function (trainNumber) {
    game.addCoach(trainNumber)
  }

  window.removeCoach = function (trainNumber) {
    game.removeCoach(trainNumber)
  }

  // Initialize dragging for your control group
  const buttonGroup1 = document.querySelector('#buttonGroup1');
  makeDraggable(buttonGroup1);

  const buttonGroup2 = document.querySelector('#buttonGroup2');
  makeDraggable(buttonGroup2);


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
  });
}

function pauseBothTrains(train1Number, train2Number) {
  const train1 = game.trains[train1Number - 1]
  const train2 = game.trains[train2Number - 1]
  train1.startStop()
  train2.startStop()
}

