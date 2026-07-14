import { Game } from './Game.js'
import { Intersections } from './Intersections.js'
import { makeDraggable, alpha, getDetailedSegmentsMap, getCommonSegmentsMap } from './utility.js'

globalThis.globalTicks = 0

let collisionCount = 0
const CANVASHEIGHT = 800 * 2
const CANVASWIDTH = 1200 * 2
const CANVASMARGIN = 0
const OFFSET_X = 0
const OFFSET_Y = 0
const gridSize = 50

const canvas = document.querySelector('#canvas')
const ctx = canvas.getContext('2d')

const canvasTracks = document.querySelector('#canvas_tracks')
const canvasResults = document.querySelector('#canvas_results')
const canvasMaps = document.querySelector('#canvas_maps')
const canvasTemp = document.querySelector('#canvas_temp')
const ctxTracks = canvasTracks.getContext('2d')
const ctxResults = canvasResults.getContext('2d')
const ctxMaps = canvasMaps.getContext('2d')
const ctxTemp = canvasTemp.getContext('2d')

canvas.height = canvasTracks.height = canvasTemp.height = canvasResults.height = canvasMaps.height = CANVASHEIGHT + CANVASMARGIN
canvas.width = canvasTracks.width = canvasTemp.width = canvasResults.width = canvasMaps.width = CANVASWIDTH + CANVASMARGIN

let paused = true
let startTrack = false
let startExtendTrain = false
let startFlyover = false
let startStation = false
let showingResults = false
let showingInfo = false
let showingHowToPlay = false
let click_error = 20
let validTrackPoints = new Set()
let validStartingPoints = new Set()
let positionsForExtendTrain = []
const collisionAnimations = new Map()
let collisionAnimationFrameId = null
const collisionAnimationDurationMs = 3000
const collisionClearRadius = 96

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

const collisionCostValueEl = document.querySelector('#collisionCostValue')
if (collisionCostValueEl) {
  collisionCostValueEl.textContent = `$${game.getCollisionCost().toLocaleString('en-US')}`
}
const flyoverCostValueEl = document.querySelector('#flyoverCost')
if (flyoverCostValueEl) {
  flyoverCostValueEl.textContent = `$${game.getFlyoverCost().toLocaleString('en-US')}`
}
const stationCostValueEl = document.querySelector('#stationCost')
if (stationCostValueEl) {
  stationCostValueEl.textContent = `$${game.getStationCost().toLocaleString('en-US')}`
}
const engineCostValueEl = document.querySelector('#engineCost')
if (engineCostValueEl) {
  engineCostValueEl.textContent = `$${game.getEngineCost().toLocaleString('en-US')}`
}
const trackCostValueEl = document.querySelector('#trackCost')
if (trackCostValueEl) {
  trackCostValueEl.textContent = `$${game.getTrackCostPerUnit().toLocaleString('en-US')}`
}

const coachCapacityValueEl = document.querySelector('#coachCapacity')
if (coachCapacityValueEl) {
  coachCapacityValueEl.textContent = `${game.getCoachCapacity().toLocaleString('en-US')}`
}
const totalTimeUnitsValueEl = document.querySelector('#totalTimeUnits')
if (totalTimeUnitsValueEl) {
  totalTimeUnitsValueEl.textContent = `${game.getTotalTimeUnits().toLocaleString('en-US')}`
}
const maxNumCoachesValueEl = document.querySelector('#maxNumCoaches')
if (maxNumCoachesValueEl) {
  maxNumCoachesValueEl.textContent = `${game.getMaxNumCoaches().toLocaleString('en-US')}`
}
const maxNumFreightWagonsValueEl = document.querySelector('#maxNumFreightWagons')
if (maxNumFreightWagonsValueEl) {
  maxNumFreightWagonsValueEl.textContent = `${game.getMaxNumFreightWagons().toLocaleString('en-US')}`
}
const coachCostValueEl = document.querySelector('#coachCost')
if (coachCostValueEl) {
  coachCostValueEl.textContent = `$${game.getCoachCost().toLocaleString('en-US')}`
}
const freightWagonCostValueEl = document.querySelector('#freightWagonCost')
if (freightWagonCostValueEl) {
  freightWagonCostValueEl.textContent = `$${game.getFreightWagonCost().toLocaleString('en-US')}`
}
const engineUpgradeCostValueEl = document.querySelector('#engineUpgradeCost')
if (engineUpgradeCostValueEl) {
  engineUpgradeCostValueEl.textContent = `$${game.getEngineUpgradeCost().toLocaleString('en-US')}`
}
const initialCashValueEl = document.querySelector('#initialCash')
if (initialCashValueEl) {
  initialCashValueEl.textContent = `$${game.getInitialCash().toLocaleString('en-US')}`
}
const timeUnitDurationValueEl = document.querySelector('#timeUnitDuration')
if (timeUnitDurationValueEl) {
  timeUnitDurationValueEl.textContent = `${game.getTimeUnitDuration()}`
}


let positions = [
  { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 500 },
  { x: CANVASMARGIN + 1450, y: CANVASMARGIN + 500 },
  { x: CANVASMARGIN + 1450, y: CANVASMARGIN + 1000 },
  { x: CANVASMARGIN + 1900, y: CANVASMARGIN + 1000 }
]


game.addTrain(positions, 7, 0, intersections, { trainType: 'passenger', partOfInitialSetup: true })


positions = [
  { x: CANVASMARGIN + 800, y: CANVASMARGIN + 200 },
  { x: CANVASMARGIN + 500, y: CANVASMARGIN + 200 },
  { x: CANVASMARGIN + 500, y: CANVASMARGIN + 500 },
  { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 500 },
  { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 1000 },
  { x: CANVASMARGIN + 700, y: CANVASMARGIN + 1000 }
]
let trainNumber = game.addTrain(positions, 1, 0, intersections,
  { trainType: 'passenger', partOfInitialSetup: true })
game.addStation(trainNumber, 500, 300, `S${trainNumber}0604`, 30, { partOfInitialSetup: true })
game.addStation(trainNumber, 1200, 900, `S${trainNumber}1310`, 30, { partOfInitialSetup: true })

// check statically entered freight train
positions = [
  { x: CANVASMARGIN + 1900, y: CANVASMARGIN + 200 },
  { x: CANVASMARGIN + 1900, y: CANVASMARGIN + 600 },
  { x: CANVASMARGIN + 300, y: CANVASMARGIN + 600 }
]
trainNumber = game.addFreightTrain(positions, 50, 0, intersections,
  { partOfInitialSetup: true })
game.addStation(trainNumber, 1800, 600, `S${trainNumber}1907`, 30, { partOfInitialSetup: true })

const drawScene = () => {
  if (!paused) {
    globalThis.globalTicks++
    if (globalThis.globalTicks % game.ticksPerTimeUnit === 0) {
      //display the current time unit for one second on ctxResults
      // console.log(`Time: ${globalThis.globalTicks / game.ticksPerTimeUnit}`)
      const currentTimeUnit = Math.floor(globalThis.globalTicks / game.ticksPerTimeUnit)
      ctxResults.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
      ctxResults.save()
      ctxResults.font = '600px Arial'
      ctxResults.fillStyle = 'black'
      ctxResults.globalAlpha = 0.2
      const textMetrics = ctxResults.measureText(`${currentTimeUnit}`)
      ctxResults.fillText(`${currentTimeUnit}`, CANVASWIDTH / 2 - textMetrics.width / 2, CANVASHEIGHT / 2 - textMetrics.actualBoundingBoxDescent / 2)
      ctxResults.restore()
      //do not clear the ctxResults at all
      // window.setTimeout(() => {
      //   ctxResults.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
      // }, 10000)
      if (currentTimeUnit === 100) {
        paused = true
        swal.fire({
          title: 'Game Ended',
          text: `The game has ended after ${game.totalTimeUnits} periods. 
           Your rank in the game is ${game.getRank()} based on the cumulative profit of your trains $${Math.floor(game.getCumProfit() / 1000000)} Million. 
           You can view the financial summary of your trains by pressing the R key for results.`,
          icon: 'info',
          confirmButtonText: 'OK'
        })
      }
      game.trains.forEach(train => {
        if (!train) return
        game.financials.incrementExpensesOfStationMaintenance(currentTimeUnit, train, train.getNumStations())
        const distanceTraveledInTimeUnit = train.consumeDistanceTraveledInTimeUnit()
        game.financials.incrementExpensesOfTrackMaintenance(currentTimeUnit, train, distanceTraveledInTimeUnit)
        game.financials.incrementExpensesOfEngineAndCoachesDepreciation(currentTimeUnit, train.trainNumber, train.getNumCoachesOrFreightWagons())
      })
      game.incrementTimeUnit()
    }
    if (globalThis.globalTicks % 100 === 0) {
      if (showingResults) {
        displayFinancialResults()
      }
    }
    ctx.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
    game.draw()
    ctx.font = '14px Arial'
    ctx.fillStyle = 'black'
    ctx.fillText(`Ticks: ${globalThis.globalTicks}`, CANVASWIDTH - 150, 20)
  }
  requestAnimationFrame(drawScene)
}
drawScene()

window.addEventListener('load', () => {
  const startPausebutton = document.querySelector('#startPauseBtn')
  let positions = []
  let showingPopulationMap = false
  let showingRawmaterialsMap = false
  let showingRawmaterialDemandMap = false
  let positionsForExtendTrain = []
  let activeTrainExtensionTrainNumber = null

  const drawValidTrackPoint = (ctx, x, y, click_error) => {
    ctx.beginPath()
    ctx.moveTo(x + click_error, y)
    ctx.arc(x, y, click_error, 0, Math.PI * 2)
    ctx.lineWidth = 5
    ctx.strokeStyle = `rgba(0,255,0,0.3)`
    ctx.closePath()
    ctx.stroke()
  }

  const getActiveTrainExtensionTrainNumber = (fallbackTrainNumber = null) => {
    const resolvedTrainNumber = Number.isInteger(fallbackTrainNumber)
      ? fallbackTrainNumber
      : activeTrainExtensionTrainNumber
    return Number.isInteger(resolvedTrainNumber) ? resolvedTrainNumber : null
  }

  const clearTrainExtensionState = () => {
    startExtendTrain = false
    positionsForExtendTrain = []
    validStartingPoints.clear()
    activeTrainExtensionTrainNumber = null
    document.querySelectorAll('[id^="trainExtensionControls"]').forEach(control => {
      control.style.display = 'none'
    })
  }

  const handleTrainHotkeys = (event) => {

    if(!startTrack && !startExtendTrain && !startFlyover && event.key==='Escape') {
      ctxMaps.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      return;
    }

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
    } else if (event.code === 'KeyS') {
      //if the code is S then show the possible Station related controls
      const StationControls = document.querySelector('#buttonGroup3')
      if (StationControls.style.display === 'none') {
        StationControls.style.display = 'flex'
      } else {
        StationControls.style.display = 'none'
      }
      startStationSelection()
    } else if (event.code === 'KeyX') {
      //if the code is X then show the population Map
      if (!showingPopulationMap) {
        // ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
        const populationMap = game.population.getAll()
        const maxPopulation = Math.max(...populationMap.map(p => p.population))
        const rMaxSquare = (gridSize / 2) ** 2
        populationMap.forEach(p => {
          const radiusSquare = rMaxSquare * (p.population / maxPopulation)
          const radius = 2 * Math.sqrt(radiusSquare)
          ctxTemp.beginPath()
          ctxTemp.arc(p.x, p.y, radius, 0, 2 * Math.PI)
          ctxTemp.fillStyle = 'rgba(0,255,0,0.5)'
          ctxTemp.fill()
        })
      } else {
        ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      }
      showingPopulationMap = !showingPopulationMap

    } else if (event.code === 'KeyY') {
      //if the code is Y then show the rawmaterials Map
      if (!showingRawmaterialsMap) {
        // ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
        const rawmaterialsMap = game.rawmaterials.getAll()
        const maxRawmaterial = Math.max(...rawmaterialsMap.map(p => p.rawmaterial))
        const rMaxSquare = (gridSize / 2) ** 2
        rawmaterialsMap.forEach(p => {
          const radiusSquare = rMaxSquare * (p.rawmaterial / maxRawmaterial)
          const radius = Math.sqrt(radiusSquare)
          ctxMaps.beginPath()
          ctxMaps.arc(p.x, p.y, radius, 0, 2 * Math.PI)
          ctxMaps.fillStyle = 'rgba(255,255,0,0.5)'
          ctxMaps.fill()
        })
      } else {
        ctxMaps.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      }
      showingRawmaterialsMap = !showingRawmaterialsMap
    } else if (event.code === 'KeyZ') {
      //if the code is Z then show the rawmaterial demand Map
      if (!showingRawmaterialDemandMap) {
        // ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
        const rawmaterialDemandMap = game.rawmaterialDemand.getAll()
        const maxRawmaterialDemand = Math.max(...rawmaterialDemandMap.map(p => p.rawmaterial))

        const rMaxSquare = (gridSize / 2) ** 3
        rawmaterialDemandMap.forEach(p => {
          if (p.rawmaterial !== 0) {

            const radiusSquare = rMaxSquare * (p.rawmaterial / maxRawmaterialDemand)
            const radius = Math.sqrt(radiusSquare)
            ctxMaps.beginPath()
            ctxMaps.arc(p.x, p.y, radius, 0, 2 * Math.PI)
            ctxMaps.fillStyle = 'rgba(0,0,255,0.5)'
            ctxMaps.fill()

            ctxMaps.font = '20px Arial'
            ctxMaps.fillStyle = 'black'
            const textMetrics = ctxMaps.measureText(`${Math.floor(p.rawmaterial)}`)
            ctxMaps.fillText(`${Math.floor(p.rawmaterial)}`, p.x - textMetrics.width / 2, p.y + 10)
          }
        })
      } else {
        ctxMaps.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      }
      showingRawmaterialDemandMap = !showingRawmaterialDemandMap
    } else if (event.code === 'KeyR') {
      //if the code is R then show the results 
      const modal = document.querySelector('#buttonGroup4')
      if (!showingResults) {
        modal.style.display = 'flex'
        displayFinancialResults()
      } else {
        modal.style.display = 'none'
      }
      showingResults = !showingResults
    } else if (event.code === 'KeyI') {
      //if the code is I then show the info on train operations widget
      const modal = document.querySelector('#buttonGroup7')
      const div = document.querySelector('#infoForTrain')
      div.replaceChildren()
      for (let i = 1; i <= game.trains.length; i++) {
        const span = document.createElement('span')
        span.dataset.value = String(i)
        span.textContent = `T${i}`
        span.style = 'cursor:pointer;font-size:1.0em;padding:2px;margin:1px;border:1px solid black;display:inline-block'
        span.addEventListener('click', () => {
          console.log(`Train ${i} clicked`)
          //hide all
          for (let j = 1; j <= game.trains.length; j++) {
            const infoDiv = document.querySelector(`#infotrainoperations${j}`)
            infoDiv.style.display = 'none'
          }
          const infoDiv = document.querySelector(`#infotrainoperations${i}`)
          infoDiv.style.display = 'block'
        })
        div.appendChild(span)
      }
      if (!showingInfo) {
        modal.style.display = 'flex'
      } else {
        modal.style.display = 'none'
      }
      showingInfo = !showingInfo
    } else if (event.key === '?') {
      //if the code is ? then show the 'How to play' widget
      const modal = document.querySelector('#buttonGroup5')
      if (!showingHowToPlay) {
        modal.style.display = 'flex'
      } else {
        modal.style.display = 'none'
      }
      showingHowToPlay = !showingHowToPlay
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
  }

  document.addEventListener('keydown', handleTrainHotkeys)

  const hotkeyCodeMap = {
    '?': 'Slash',
    'P': 'KeyP',
    'T': 'KeyT',
    'S': 'KeyS',
    'F': 'KeyF',
    'R': 'KeyR',
    'I': 'KeyI',
    'X': 'KeyX',
    'Y': 'KeyY',
    'Z': 'KeyZ'
  }

  const sendHotkeyToDocument = (hotkey) => {
    const normalizedHotkey = hotkey === '?' ? '?' : String(hotkey).toUpperCase()
    const code = hotkeyCodeMap[normalizedHotkey]
    if (!code) return
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: normalizedHotkey,
      code,
      repeat: false,
      bubbles: true,
      cancelable: true
    }))
  }

  document.querySelectorAll('#buttonGroup6 [data-hotkey]').forEach((button) => {
    button.addEventListener('click', () => {
      const hotkey = (button.getAttribute('data-hotkey') || '').toUpperCase()
      const normalizedHotkey = hotkey === '?' ? '?' : hotkey
      sendHotkeyToDocument(normalizedHotkey)
    })
  })

  const pauseHotkeyButton = document.getElementById('P')
  if (pauseHotkeyButton) {
    pauseHotkeyButton.addEventListener('click', () => {
      sendHotkeyToDocument('P')
    })
  }
  const trainHotkeyButton = document.getElementById('T')
  if (trainHotkeyButton) {
    trainHotkeyButton.addEventListener('click', () => {
      sendHotkeyToDocument('T')
    })
  }
  const stationHotkeyButton = document.getElementById('S')
  if (stationHotkeyButton) {
    stationHotkeyButton.addEventListener('click', () => {
      sendHotkeyToDocument('S')
    })
  }
  const flyoverHotkeyButton = document.getElementById('F')
  if (flyoverHotkeyButton) {
    flyoverHotkeyButton.addEventListener('click', () => {
      sendHotkeyToDocument('F')
    })
  }
  const xHotkeyButton = document.getElementById('X')
  if (xHotkeyButton) {
    xHotkeyButton.addEventListener('click', () => {
      sendHotkeyToDocument('X')
    })
  }
  const yHotkeyButton = document.getElementById('Y')
  if (yHotkeyButton) {
    yHotkeyButton.addEventListener('click', () => {
      sendHotkeyToDocument('Y')
    })
  }
  const zHotkeyButton = document.getElementById('Z')
  if (zHotkeyButton) {
    zHotkeyButton.addEventListener('click', () => {
      sendHotkeyToDocument('Z')
    })
  }
  const infoHotkeyButton = document.getElementById('I')
  if (infoHotkeyButton) {
    infoHotkeyButton.addEventListener('click', () => {
      sendHotkeyToDocument('I')
    })
  }

  const getCanvasPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  document.querySelector('#canvas_temp').addEventListener('click', (event) => {
    const point = getCanvasPoint(event)
    if (startExtendTrain) {
      //check which train is selected for extension
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize
      if ((Math.abs(x - point.x) < click_error) && (Math.abs(y - point.y) < click_error)) {
        // console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y}`)
        if ((positionsForExtendTrain.length === 0) && (!validStartingPoints.has(`${x},${y}`))) {
          console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y} but it's not a valid track point`)
          return
        }
        console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y} and it's a valid starting point for track extension`)
        positionsForExtendTrain.push({ x, y })
        updateCanvasTempForExtendTrain()
      }
    }
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
    if (startStation) {
      // user is selecting one of the locations highlighted for station placement. So we will check if the click is within the click_error range of any of the highlighted locations and if it is then we will add a station at that location for the selected train.

      const selectedTrainNumber = Number.parseInt(document.querySelector('#stationFortrain span.selected')?.dataset.value, 10)

      if (!selectedTrainNumber) {
        swal.fire({
          title: 'No Train Selected',
          text: 'Please select a train before placing a station.',
          icon: 'warning',
          confirmButtonText: 'OK'
        })
        return
      }
      const train = game.trains[selectedTrainNumber - 1]
      const possibleStationLocations = train.track.getPossibleStationLocations()
      possibleStationLocations.forEach(location => {
        if ((Math.abs(location.x - point.x) < click_error) && (Math.abs(location.y - point.y) < click_error)) {
          // console.log(`Station added for Train ${selectedTrainNumber} at (${location.x},${location.y})`)
          swal.fire({
            title: `Add Station for Train ${selectedTrainNumber}`,
            text: `Do you want to add a Station for Train ${selectedTrainNumber} at (Row ${(location.y / gridSize) + 1}, Col ${(location.x / gridSize) + 1})?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
          }).then((result) => {
            if (result.isConfirmed) {
              game.addStation(selectedTrainNumber, location.x, location.y, `S${selectedTrainNumber}${String((location.x / gridSize) + 1).padStart(2, '0')}${String((location.y / gridSize) + 1).padStart(2, '0')}`, 30)
              //clear the canvasTemp after adding the station
              ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
            }
            startStation = false
          })
        }
      })
    }
    if (startFlyover) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize
      if ((Math.abs(x - point.x) < click_error) && (Math.abs(y - point.y) < click_error)) {
        // console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y}`)
        // console.log(`Flyover added at (${(x / gridSize) + 1},${(y / gridSize) + 1})`)
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
            game.addFlyover(y / gridSize, x / gridSize)
            startFlyover = false
          }


        })
      }
    }
  })
  document.querySelector('#canvas_temp').addEventListener('mousemove', (event) => {
    const point = getCanvasPoint(event)
    //console.log(`mouse move event listener added`)
    if(!startTrack && !startExtendTrain && !startFlyover){
      if ( (point.x<click_error || point.x>CANVASWIDTH-click_error || point.y<click_error || point.y>CANVASHEIGHT-click_error) && Math.abs(CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize - point.x) < click_error && Math.abs(CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize - point.y) < click_error) {
        //draw a horizontal or vertical dashed line on the ctxTemp
        ctxMaps.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
        ctxMaps.save()
        ctxMaps.beginPath()
        ctxMaps.strokeStyle = 'black'
        ctxMaps.setLineDash([5, 5])
        ctxMaps.moveTo(CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize, CANVASMARGIN)
        ctxMaps.lineTo(CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize, CANVASHEIGHT - CANVASMARGIN)
        ctxMaps.moveTo(CANVASMARGIN, CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize)
        ctxMaps.lineTo(CANVASWIDTH - CANVASMARGIN, CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize)
        ctxMaps.stroke()
        ctxMaps.setLineDash([])
        ctxMaps.restore()
      }
    }
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
    if (startExtendTrain) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize
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

  window.cancelStation = function () {
    startStation = false
    document.querySelector('#canvas_temp').style = 'cursor:default'
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
  }

  window.completeTrainExtension = function () {
    const selectedTrainNumber = getActiveTrainExtensionTrainNumber()
    if (!selectedTrainNumber) {
      swal.fire({
        title: 'No Train Selected',
        text: 'Please start a train extension before completing it.',
        icon: 'warning',
        confirmButtonText: 'OK'
      })
      return
    }
    if (positionsForExtendTrain.length < 2) {
      swal.fire({
        title: 'Invalid Track Extension',
        text: 'Please select at least two valid track points to extend the train. The first of these is the terminal station. If you do not want to extend the train then click on the Cross Icon in the Train Extension Controls to cancel the extension process.',
        icon: 'warning',
        confirmButtonText: 'OK'
      })
      return
    }
    //invoke the extendTrain function in the game object and pass it the positions for extend train and the
    //selected train number for extension.
    game.extendTrain(selectedTrainNumber, positionsForExtendTrain)
    console.log(`Completing extension for train ${selectedTrainNumber}`)
    clearTrainExtensionState()
    //clear the canvas Temp
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
  }
  const startStationSelection = function () {
    startFlyover = false
    startTrack = false
    // startStation = true
    document.querySelector('#stationFortrain').style.display = 'block'
    const div = document.querySelector('#stationFortrain')
    div.replaceChildren()
    div.onclick = (event) => {
      if (event.target.tagName === 'SPAN') {
        div.querySelectorAll('span').forEach(span => span.classList.remove('selected'))
        event.target.classList.add('selected')

        const trainNumber = Number.parseInt(event.target.dataset.value, 10)
        // console.log(`Selected train number: ${trainNumber}`)
        const train = game.trains[trainNumber - 1]
        if (train) {
          startStation = true
          // highlight all the possible station locations along the track where a station does not already exist.
          // get the track
          const track = train.track
          // get the possible station locations along the track
          const possibleStationLocations = track.getPossibleStationLocations()
          ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
          possibleStationLocations.forEach(location => {
            ctxTemp.beginPath()
            ctxTemp.moveTo(location.x, location.y)
            ctxTemp.fillStyle = 'purple'
            ctxTemp.arc(location.x, location.y, 10, 0, Math.PI * 2)
            ctxTemp.closePath()
            ctxTemp.fill()
          })
        } else {
          console.log(`Train with number ${trainNumber} not found`)
        }
      }
    }

    for (let i = 1; i <= game.trains.length; i++) {
      const span = document.createElement('span')
      span.dataset.value = String(i)
      span.textContent = `T${i}`
      span.style = 'cursor:pointer;font-size:1.0em;padding:2px;margin:1px;border:1px solid black;display:inline-block'
      div.appendChild(span)
    }
    document.querySelector('#canvas_temp').style = 'cursor:crosshair'
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

  function updateCanvasTempForExtendTrain() {

    //find out the train number
    const el = document.querySelector('#buttonGroup1')
    const trainNumber = Number.parseInt(el.dataset.extendingTrainNumber, 10)

    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    //for each of the positions for extend train draw a small circle on ctxTemp
    positionsForExtendTrain.forEach(position => {
      const { x, y } = position
      ctxTemp.save()
      ctxTemp.beginPath()
      ctxTemp.moveTo(x, y)
      ctxTemp.fillStyle = 'orange'
      ctxTemp.arc(x, y, 7, 0, Math.PI * 2)
      ctxTemp.closePath()
      ctxTemp.fill()
      ctxTemp.restore()
    })

    //clear the set and set it again with new valid points
    validTrackPoints.clear()

    if (positionsForExtendTrain.length === 0) {
      return
    }

    const { x: last_x, y: last_y } = positionsForExtendTrain[positionsForExtendTrain.length - 1]
    //when extending the train we want to allow the user to extend the train in the same 
    // direction as the last track segment or make a gradual turn but we do not want to allow sharp turns. 
    // Since if the user makes a sharp turn, we will lose the station as it will no longer be on the track.
    // So we will calculate the direction of the last track segment and then only show valid track points in the same direction 
    // for the first segment. The later logic will remain the same.

    // if there is only one position in the positionsForExtendTrain then we will get the 
    // x-before_last_x from the train object
    let x_before_last_x = null
    let y_before_last_y = null
    if (positionsForExtendTrain.length === 1) {
      const train = game.trains[trainNumber - 1]
      if (train) {
        // in the train's positions array, match the positioinsForExtendTrain[0].x and positionsForExtendTrain[0}.y
        if (train.track.positions[0].x === positionsForExtendTrain[0].x &&
          train.track.positions[0].y === positionsForExtendTrain[0].y) {
          //the train is being extended from the starting station
          x_before_last_x = train.track.positions[1].x
          y_before_last_y = train.track.positions[1].y
        } else if (train.track.positions[train.track.positions.length - 1].x === positionsForExtendTrain[0].x &&
          train.track.positions[train.track.positions.length - 1].y === positionsForExtendTrain[0].y) {
          //the train is being extended from the terminal station   
          x_before_last_x = train.track.positions[train.track.positions.length - 2].x
          y_before_last_y = train.track.positions[train.track.positions.length - 2].y
        }
      }
    }


    if (positionsForExtendTrain.length > 1) {
      x_before_last_x = positionsForExtendTrain[positionsForExtendTrain.length - 2].x
      y_before_last_y = positionsForExtendTrain[positionsForExtendTrain.length - 2].y
    }

    const lastRow = last_y / gridSize
    const lastCol = last_x / gridSize
    const increasingRow = y_before_last_y !== null && last_y > y_before_last_y
    const decreasingRow = y_before_last_y !== null && last_y < y_before_last_y
    const increasingCol = x_before_last_x !== null && last_x > x_before_last_x
    const decreasingCol = x_before_last_x !== null && last_x < x_before_last_x

    // special logic only for the first point after selecting the starting point
    if (positionsForExtendTrain.length === 1) {
      if (increasingRow || decreasingRow) {
        for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
          if ((decreasingRow && row < lastRow - 1) || (increasingRow && row > lastRow + 1)) {
            //drawCircle
            ctxTemp.beginPath()
            ctxTemp.moveTo(last_x + click_error, row * gridSize)
            ctxTemp.arc(last_x, row * gridSize, click_error, 0, Math.PI * 2)
            ctxTemp.strokeStyle = `rgb(9, 108, 2)`
            ctxTemp.closePath()
            ctxTemp.stroke()
            validTrackPoints.add(`${last_x},${row * gridSize}`)
          }
        }
      } else if (increasingCol || decreasingCol) {
        for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
          if ((decreasingCol && col < lastCol - 1) || (increasingCol && col > lastCol + 1)) {
            //drawCircle
            ctxTemp.beginPath()
            ctxTemp.moveTo(col * gridSize + click_error, last_y)
            ctxTemp.arc(col * gridSize, last_y, click_error, 0, Math.PI * 2)
            ctxTemp.strokeStyle = `rgb(9,108,2)`
            ctxTemp.closePath()
            ctxTemp.stroke()
            validTrackPoints.add(`${col * gridSize},${last_y}`)
          }
        }
      }
      return
    }


    for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
      if (row == lastRow || row == lastRow - 1 || row == lastRow + 1 || (y_before_last_y !== null && ((increasingRow && row < lastRow) || (decreasingRow && row > lastRow)))) {
        //go to next iteration since we want only gradual change in track direction and not sharp turns
        continue
      } else {
        //drawCircle
        ctxTemp.beginPath()
        ctxTemp.moveTo(last_x + click_error, row * gridSize)
        ctxTemp.arc(last_x, row * gridSize, click_error, 0, Math.PI * 2)
        ctxTemp.lineWidth = 5
        ctxTemp.strokeStyle = `rgb(9,108,2)`
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
        ctxTemp.lineWidth = 5
        ctxTemp.strokeStyle = `rgb(9,108,2)`
        ctxTemp.closePath()
        ctxTemp.stroke()
        validTrackPoints.add(`${col * gridSize},${last_y}`)
      }
    }
  }

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

    if (positions.length === 0) {
      return
    }

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

    for (let row = 0; row <= CANVASHEIGHT / gridSize; row++) {
      
      if (increasingRow && row > lastRow) {
        drawValidTrackPoint(ctxTemp, last_x, row * gridSize, click_error)
        validTrackPoints.add(`${last_x},${row * gridSize}`)
      }
      else if (decreasingRow && row < lastRow) {
        drawValidTrackPoint(ctxTemp, last_x, row * gridSize, click_error)
        validTrackPoints.add(`${last_x},${row * gridSize}`)
      }
      else if (!increasingRow && !decreasingRow && (row < lastRow - 3 || row > lastRow + 3)) {
        drawValidTrackPoint(ctxTemp, last_x, row * gridSize, click_error)
        validTrackPoints.add(`${last_x},${row * gridSize}`)
      }

    }
    

    for (let col = 0; col <= CANVASWIDTH / gridSize; col++) {

      if (increasingCol && col > lastCol) {
        drawValidTrackPoint(ctxTemp,col * gridSize, last_y, click_error)
        validTrackPoints.add(`${col * gridSize},${last_y}`)
      }
      else if (decreasingCol && col < lastCol) {
        drawValidTrackPoint(ctxTemp,col * gridSize, last_y, click_error)
        validTrackPoints.add(`${col * gridSize},${last_y}`)
      }
      else if (!increasingCol && !decreasingCol && (col < lastCol - 3 || col > lastCol + 3)) {
        drawValidTrackPoint(ctxTemp,col * gridSize, last_y, click_error)
        validTrackPoints.add(`${col * gridSize},${last_y}`)
      }
      
    }
  }

  window.addEventListener('collision', (event) => {
    // console.log(`Collision between train ${event.train1} and train ${event.train2}`)
    // count total collisions
    collisionCount++
    const collisionAnimationStartedAt = displayCollision(event.col, event.row)
    game.incrementCollisionCost(globalThis.globalTicks, event.train1, event.train2)
    pauseBothTrains(event.train1, event.train2)
    setTimeout(() => {
      clearCollision(event.col, event.row, collisionAnimationStartedAt)
      showCustomAlert(`Collision detected between train ${event.train1} and train 
        ${event.train2} at intersection (${alpha(event.col + 1)},${alpha(event.row + 1)}).
        Trains will be out of service temporarily for repairs.`)
    }, 5000)
    //we want to inform the train about the collision and set its state to 
    //dysfunctional so that it does not move any further till the dysfunctional state is cleared. This will prevent multiple collision events for the same intersection as the train will not move further till the collision is cleared.
    game.trains[event.train1 - 1].setDysfunctional(true)
    game.trains[event.train2 - 1].setDysfunctional(true)
  })

  window.startStopTrain = (trainnumber) => {
    game.startStopTrain(trainnumber)
  }

  //not using this function currently.
  window.extendTrain = (trainnumber) => {
    clearTrainExtensionState()
    activeTrainExtensionTrainNumber = trainnumber
    const buttonGroup1 = document.querySelector('#buttonGroup1')
    buttonGroup1.dataset.extendingTrainNumber = trainnumber
    // const extendTrainEls = buttonGroup1.querySelectorAll('.fa-expand-alt')
    // extendTrainEls.forEach((el, index) => {
    //   el.dataset.selected = 'false'
    //   el.dataset.trainnumber = 0
    // })
    // extendTrainEls[trainnumber - 1].dataset.selected = 'true'
    // extendTrainEls[trainnumber - 1].dataset.trainnumber = trainnumber
    const trainExtensionControlEl = document.querySelector(`#trainExtensionControls${trainnumber}`)
    if (trainExtensionControlEl) {
      trainExtensionControlEl.style.display = 'flex'
    }
    const train = game.trains[trainnumber - 1]
    const stations = train.stations
    const startStation = stations[0]
    const endStation = stations[stations.length - 1]
    validStartingPoints = new Set()
    validStartingPoints.add(`${startStation.x},${startStation.y}`)
    validStartingPoints.add(`${endStation.x},${endStation.y}`)
    swal.fire({
      title: `Extend Train ${trainnumber}`,
      text: `Click on one of the two terminal stations of Train ${trainnumber} - (${startStation.name} or ${endStation.name}). 
        These are the only valid stations from which you can extend the train. After clicking on the station, you will be guided to select other points on the grid to extend the track from that station. When you are done click on the check icon in the train control. If you want to cancel then click on the cross icon in the train control.`
    })
    startExtendTrain = true
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
  window.cancelTrainExtension = (trainnumber) => {
    const selectedTrainNumber = getActiveTrainExtensionTrainNumber(trainnumber)
    if (selectedTrainNumber) {
      console.log(`Cancelling extension for train ${selectedTrainNumber}`)
    }
    const extendTrainEl = document.querySelector('#trainExtensionControls' + trainnumber)
    if (extendTrainEl) {
      extendTrainEl.style.display = 'none'
    }
    clearTrainExtensionState()
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
      startTrack = false
      if (positions.length === 1) {
        new swal(`You have specified a starting point and no ending point. To create a track, you need to specify at least two points.`)
      } else {
        new swal(`You have not specified any points for the track. To create a track, you need to specify at least two points.`)
      }
      document.querySelector('#startTrack').style.display = 'block'
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      return
    }
    if (positions[0].x === positions[positions.length - 1].x &&
      positions[0].y === positions[positions.length - 1].y) {
      startTrack = false
      new swal(`The starting point and ending point of the track cannot be the same. Please specify different points for the track.`)
      document.querySelector('#startTrack').style.display = 'block'
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      return
    }
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    // const speedEl = document.querySelector('#speed')
    const numCoachesEl = document.querySelector('#numcoaches')
    const numFreightWagonsEl = document.querySelector('#numfreightwagons')
    const selectTrainTypeEl = document.querySelector('#typeoftrain')
    const trainType = selectTrainTypeEl?.value === 'freight' ? 'freight' : 'passenger'
    // const parsedSpeed = Number.parseInt(speedEl?.value ?? '', 10)
    // const speed = Number.isInteger(parsedSpeed) && parsedSpeed >= 1 && parsedSpeed <= 20
    //   ? parsedSpeed
    //   : Math.ceil(Math.random() * 20)

    const parsedNumCoaches = Number.parseInt(numCoachesEl?.value ?? '', 10)
    const parsedNumFreightWagons = Number.parseInt(numFreightWagonsEl?.value ?? '', 10)
    const passengerCoachCount = Number.isInteger(parsedNumCoaches) && parsedNumCoaches >= 0
      ? parsedNumCoaches
      : 5
    const freightWagonCount = Number.isInteger(parsedNumFreightWagons) && parsedNumFreightWagons >= 0
      ? parsedNumFreightWagons
      : 30
    const numCoaches = trainType === 'freight' ? freightWagonCount : passengerCoachCount

    //check if we have enough funds to add the train
    const trackCost = game.getTrackCost(positions)
    const trainCost = trackCost + numCoaches * (trainType === 'freight' ? game.getFreightWagonCost() : game.getCoachCost()) + game.getEngineCost()
      + 2 * game.getStationCost() // adding 2 stations by default for each train
    if (trainCost > game.getCashInHand()) {
      new swal(`You do not have enough funds to add this train. You need $${trainCost.toLocaleString('en-US')} but you only have $${game.getCashInHand().toLocaleString('en-US')}.`)
      startTrack = false
      document.querySelector('#startTrack').style.display = 'block'
      return
    }
    // game.addTrain(positions, speed, numCoaches, 0, intersections, { trainType })
    game.addTrain(positions, numCoaches, 0, intersections, { trainType })
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
    // we close the Station popup if it is open
    const stationModal = document.querySelector('#buttonGroup3')
    if (stationModal) {
      stationModal.style.display = 'none'
    }

    // update the UI with the right number of coaches or freight wagons based on the train type
    const lblNumCoaches = document.querySelector(`#lblNumCoaches${trainNumber}`)
    if (lblNumCoaches) {
      lblNumCoaches.textContent = numCoaches
    }
  }

  const trainTypeSelect = document.querySelector('#typeoftrain')
  const passengerCoachSection = document.querySelector('#numcoaches')?.closest('div')
  const freightWagonSection = document.querySelector('#numfreightwagons')?.closest('div')

  const syncTrainTypeInputs = () => {
    const isFreight = trainTypeSelect?.value === 'freight'
    if (passengerCoachSection) {
      passengerCoachSection.hidden = isFreight
    }
    if (freightWagonSection) {
      freightWagonSection.hidden = !isFreight
    }
  }

  if (trainTypeSelect) {
    trainTypeSelect.addEventListener('change', syncTrainTypeInputs)
  }
  syncTrainTypeInputs()



  window.addCoach = function (trainNumber) {
    game.addCoach(trainNumber)
  }

  window.removeCoach = function (trainNumber) {
    game.removeCoach(trainNumber)
  }

  window.upgradeEngine = function (trainNumber) {
    const costOfUpgrade = game.getEngineUpgradeCost()
    swal.fire({
      title: `Upgrade Engine for Train ${trainNumber}`,
      text: `Upgrading the engine will increase the speed of the train. This will allow the train to move faster and reduce the travel time between stations. 
    However, this will cost you $${costOfUpgrade.toLocaleString('en-US')}. Do you want to upgrade the engine?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No'
    }).then((result) => {
      if (result.isConfirmed) {
        game.upgradeEngine(trainNumber)
      }
    })
  }

  // Initialize dragging for your control group
  const buttonGroup1 = document.querySelector('#buttonGroup1');
  makeDraggable(buttonGroup1);

  const buttonGroup2 = document.querySelector('#buttonGroup2');
  makeDraggable(buttonGroup2);

  const buttonGroup3 = document.querySelector('#buttonGroup3');
  makeDraggable(buttonGroup3);

  const buttonGroup4 = document.querySelector('#buttonGroup4');
  makeDraggable(buttonGroup4);

  const buttonGroup5 = document.querySelector('#buttonGroup5');
  makeDraggable(buttonGroup5);

  const buttonGroup6 = document.querySelector('#buttonGroup6');
  makeDraggable(buttonGroup6);

  const buttonGroup7 = document.querySelector('#buttonGroup7');
  makeDraggable(buttonGroup7);

  const howToPlayStartBtn = document.getElementById('howToPlayStartBtn')
  if (howToPlayStartBtn) {
    howToPlayStartBtn.addEventListener('click', () => {
      sendHotkeyToDocument('P')
    })
  }
  sendHotkeyToDocument('?')
})

function displayCollision(col, row) {
  const x = OFFSET_X + col * gridSize
  const y = OFFSET_Y + row * gridSize
  const key = `${col},${row}`
  const startedAt = performance.now()
  collisionAnimations.set(key, createCollisionAnimationState(x, y, startedAt))
  ensureCollisionAnimationLoop()
  return startedAt
}

function clearCollision(col, row, startedAt) {
  const key = `${col},${row}`
  if (startedAt != null) {
    const activeState = collisionAnimations.get(key)
    if (activeState && activeState.startedAt !== startedAt) {
      return
    }
  }
  collisionAnimations.delete(key)
  const x = OFFSET_X + col * gridSize
  const y = OFFSET_Y + row * gridSize
  ctxTemp.clearRect(x - collisionClearRadius, y - collisionClearRadius, collisionClearRadius * 2, collisionClearRadius * 2)
}

function createCollisionAnimationState(x, y, startedAt) {
  const sparks = Array.from({ length: 14 }, (_, index) => {
    const angle = (Math.PI * 2 * index / 14) + (Math.random() - 0.5) * 0.35
    return {
      angle,
      speed: 0.08 + Math.random() * 0.08,
      size: 1.5 + Math.random() * 2.2,
      drag: 0.84 + Math.random() * 0.12,
      life: 0.55 + Math.random() * 0.35
    }
  })

  const smoke = Array.from({ length: 8 }, () => ({
    driftX: (Math.random() - 0.5) * 0.06,
    driftY: 0.04 + Math.random() * 0.05,
    radiusStart: 5 + Math.random() * 6,
    delay: Math.random() * 0.35
  }))

  return {
    x,
    y,
    startedAt,
    sparks,
    smoke
  }
}

function ensureCollisionAnimationLoop() {
  if (collisionAnimationFrameId !== null) return

  const frame = (now) => {
    if (collisionAnimations.size === 0) {
      collisionAnimationFrameId = null
      return
    }

    collisionAnimations.forEach((state, key) => {
      const elapsed = now - state.startedAt
      const t = Math.max(0, Math.min(1, elapsed / collisionAnimationDurationMs))

      if (t >= 1) {
        collisionAnimations.delete(key)
        ctxTemp.clearRect(state.x - collisionClearRadius, state.y - collisionClearRadius, collisionClearRadius * 2, collisionClearRadius * 2)
        return
      }

      ctxTemp.clearRect(state.x - collisionClearRadius, state.y - collisionClearRadius, collisionClearRadius * 2, collisionClearRadius * 2)
      drawCollisionFrame(state, t)
    })

    collisionAnimationFrameId = requestAnimationFrame(frame)
  }

  collisionAnimationFrameId = requestAnimationFrame(frame)
}

function drawCollisionFrame(state, t) {
  const { x, y, sparks, smoke } = state

  ctxTemp.save()

  const blastRadius = 10 + t * 28
  const blastOpacity = Math.max(0, 0.95 - t * 1.1)
  const blastGradient = ctxTemp.createRadialGradient(x, y, 0, x, y, blastRadius)
  blastGradient.addColorStop(0, `rgba(255,255,185,${blastOpacity})`)
  blastGradient.addColorStop(0.35, `rgba(255,160,30,${blastOpacity * 0.95})`)
  blastGradient.addColorStop(1, `rgba(190,35,15,0)`)
  ctxTemp.beginPath()
  ctxTemp.fillStyle = blastGradient
  ctxTemp.arc(x, y, blastRadius, 0, Math.PI * 2)
  ctxTemp.fill()

  const ringRadius = 8 + t * 78
  const ringOpacity = Math.max(0, 0.8 - t * 0.9)
  ctxTemp.beginPath()
  ctxTemp.strokeStyle = `rgba(255,120,20,${ringOpacity})`
  ctxTemp.lineWidth = 2 + (1 - t) * 3
  ctxTemp.arc(x, y, ringRadius, 0, Math.PI * 2)
  ctxTemp.stroke()

  sparks.forEach((spark) => {
    const sparkT = Math.min(1, t / spark.life)
    if (sparkT >= 1) return

    const travel = (68 * spark.speed) * sparkT * (spark.drag + (1 - sparkT) * 0.6)
    const sx = x + Math.cos(spark.angle) * travel
    const sy = y + Math.sin(spark.angle) * travel
    const alpha = (1 - sparkT) * 0.95

    ctxTemp.beginPath()
    ctxTemp.fillStyle = `rgba(255,220,100,${alpha})`
    ctxTemp.arc(sx, sy, spark.size * (1 - sparkT * 0.5), 0, Math.PI * 2)
    ctxTemp.fill()
  })

  smoke.forEach((puff) => {
    const smokeT = (t - puff.delay) / (1 - puff.delay)
    if (smokeT <= 0 || smokeT >= 1) return

    const sx = x + puff.driftX * smokeT * 560
    const sy = y - puff.driftY * smokeT * 560
    const radius = puff.radiusStart + smokeT * 22
    const alpha = (1 - smokeT) * 0.22

    ctxTemp.beginPath()
    ctxTemp.fillStyle = `rgba(70,70,70,${alpha})`
    ctxTemp.arc(sx, sy, radius, 0, Math.PI * 2)
    ctxTemp.fill()
  })

  ctxTemp.restore()
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

  // number the columns and rows (in the first row and first column with 1,2,3..)
  ctx.fillStyle = 'black'
  ctx.font = '12px Arial'
  for (let i = 0; i < numCols; i++) {
    //first row, number the columns
    ctx.fillText(alpha(i), CANVASMARGIN + i * gridSize + 5, CANVASMARGIN + 10)
    //last row, number the columns
    ctx.fillText(alpha(i), CANVASMARGIN + i * gridSize + 5, CANVASHEIGHT - CANVASMARGIN - 5)
  }
  for (let j = 1; j < numRows; j++) {
    //first column, number the rows
    ctx.fillText(alpha(j), CANVASMARGIN + 5, CANVASMARGIN + j * gridSize + 10)
    //last column, number the rows
    ctx.fillText(alpha(j), CANVASWIDTH - CANVASMARGIN - 15, CANVASMARGIN + j * gridSize + 10)
  }

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
  train1.setUserPaused(true)
  train2.setUserPaused(true)
}

function displayFinancialResults() {
  //get cummulative values for each train
  const cashInHand = game.getCashInHand()
  document.getElementById('cashInHand').textContent = Math.floor(cashInHand / 1000000)
  const financialSummary = game.getCumFinancialSummaryByTrain()
  const tableBody = document.querySelector('#resultsBody')
  tableBody.replaceChildren()
  financialSummary.totalRevenue.forEach((revenue, index) => {
    if (revenue > 0 || financialSummary.totalExpenses[index] > 0) {
      const row = document.createElement('tr')
      const expenses = financialSummary.totalExpenses[index]
      const profit = financialSummary.profit[index]
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${Math.floor(revenue / 1000000)}</td>
        <td>${Math.floor(expenses / 1000000)}</td>
        <td>${Math.floor(profit / 1000000)}</td>
      `
      tableBody.appendChild(row)
    }
  })
}

// getDetailedSegmentsMap([{x:0,y:0},{x:100,y:0},{x:200,y:0}])
// getDetailedSegmentsMap([{x:200,y:0},{x:100,y:0},{x:0,y:0}])
// getDetailedSegmentsMap([{x:0,y:0},{x:100,y:0},{x:200,y:0},{x:200,y:150}])
// getDetailedSegmentsMap([{x:0,y:300},{x:100,y:300},{x:200,y:300},{x:200,y:150}])
// getDetailedSegmentsMap([{x:0,y:0},{x:100,y:0},{x:200,y:0},{x:200,y:100},{x:200,y:200},{x:200,y:300}])
// getDetailedSegmentsMap([{x:0,y:0},{x:100,y:0},{x:200,y:0},
//   {x:200,y:100},{x:200,y:200},{x:200,y:300},{x:300,y:300},{x:400,y:300}])
// getDetailedSegmentsMap([{ x: CANVASMARGIN + 100, y: CANVASMARGIN + 100 },
//   { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 100 },
//   { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 500 }])
/*
console.log(getDetailedSegmentsMap([
  { x: CANVASMARGIN + 800, y: CANVASMARGIN + 200 },
  { x: CANVASMARGIN + 500, y: CANVASMARGIN + 200 },
  { x: CANVASMARGIN + 500, y: CANVASMARGIN + 500 },
  { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 500 },
  { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 1000 },
  { x: CANVASMARGIN + 700, y: CANVASMARGIN + 1000 }
]))
let commonSegmentsMap = getCommonSegmentsMap([
  { x: CANVASMARGIN + 800, y: CANVASMARGIN + 200 },
  { x: CANVASMARGIN + 500, y: CANVASMARGIN + 200 },
  { x: CANVASMARGIN + 500, y: CANVASMARGIN + 500 },
  { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 500 },
  { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 1000 },
  { x: CANVASMARGIN + 700, y: CANVASMARGIN + 1000 }
], [
  { x: CANVASMARGIN + 500, y: CANVASMARGIN + 500 },
  { x: CANVASMARGIN + 500, y: CANVASMARGIN + 200 },
  { x: CANVASMARGIN + 800, y: CANVASMARGIN + 200 }
  // { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 500 },
  // { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 1000 },
  // { x: CANVASMARGIN + 700, y: CANVASMARGIN + 1000 }
])
//display the common segments on ctxTemp
for (const key of commonSegmentsMap.keys()) {
  const [startKey, endKey] = key.split('-')
  const startx = parseInt(startKey.split(',')[0])
  const starty = parseInt(startKey.split(',')[1])
  const endx = parseInt(endKey.split(',')[0])
  const endy = parseInt(endKey.split(',')[1])
  ctxTemp.beginPath()
  ctxTemp.moveTo(startx, starty)
  ctxTemp.lineTo(endx, endy)
  ctxTemp.strokeStyle = 'red'
  ctxTemp.lineWidth = 2
  ctxTemp.stroke()
}
  */
