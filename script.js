import { Game } from './Game.js'
import { Track } from './Track.js'
import { Intersections } from './Intersections.js'
import { makeDraggable, alpha, getDetailedSegmentsMap, getCommonSegmentsMap, delay } from './utility.js'
import { audioManager } from './audioManager.js'

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
const canvasMaps1 = document.querySelector('#canvas_maps1')
const canvasMaps2 = document.querySelector('#canvas_maps2')
const canvasMaps3 = document.querySelector('#canvas_maps3')
const canvasTemp = document.querySelector('#canvas_temp')
const ctxTracks = canvasTracks.getContext('2d')
const ctxResults = canvasResults.getContext('2d')
const ctxMaps1 = canvasMaps1.getContext('2d')
const ctxMaps2 = canvasMaps2.getContext('2d')
const ctxMaps3 = canvasMaps3.getContext('2d')
const ctxTemp = canvasTemp.getContext('2d')

canvas.height = canvasTracks.height = canvasTemp.height = canvasResults.height = canvasMaps1.height = canvasMaps2.height = canvasMaps3.height = CANVASHEIGHT + CANVASMARGIN
canvas.width = canvasTracks.width = canvasTemp.width = canvasResults.width = canvasMaps1.width = canvasMaps2.width = canvasMaps3.width = CANVASWIDTH + CANVASMARGIN

let paused = true
let startTrack = false
let startExtendTrain = false
let startFlyover = false
let startStation = false
let selectedTrainNumberForStartStation = null
let selectedTrainNumberForStartFlyover = null
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

window.setGameSoundEnabled = (enabled) => audioManager.setEnabled(enabled)

let allowPageUnload = false

window.allowGamePageUnload = (allowed = true) => {
  allowPageUnload = !!allowed
  return allowPageUnload
}

window.addEventListener('beforeunload', (event) => {
  if (allowPageUnload) {
    return
  }
  event.preventDefault()
  event.returnValue = ''
})

const controlsRoot = document.querySelector('#controls')

function blurFocusedControlElement() {
  const activeElement = document.activeElement
  if (activeElement instanceof HTMLElement && controlsRoot?.contains(activeElement)) {
    activeElement.blur()
  }
}

if (typeof window.swal !== 'undefined' && typeof window.swal.fire === 'function') {
  const originalSwalFire = window.swal.fire.bind(window.swal)
  window.swal.fire = (...args) => {
    blurFocusedControlElement()
    return originalSwalFire(...args)
  }
}

function initializeTrainControlWidgets(maxTrains = 9) {
  const container = document.querySelector('#trainControlsContainer')
  const template = document.querySelector('#trainControlTemplate')
  if (!container || !template) {
    return
  }

  container.innerHTML = ''
  for (let trainNumber = 1; trainNumber <= maxTrains; trainNumber++) {
    const fragment = template.content.cloneNode(true)
    const trainControlEl = fragment.querySelector('.trainControl')
    if (!trainControlEl) {
      continue
    }

    trainControlEl.id = `train${trainNumber}`
    trainControlEl.querySelector('[data-role="label"]').id = `lblTrain${trainNumber}`
    trainControlEl.querySelector('[data-role="label"]').textContent = `T${trainNumber}`
    trainControlEl.querySelector('[data-role="train-type"]').id = `lblTrainType${trainNumber}`
    trainControlEl.querySelector('[data-role="train-type"]').textContent = `P`

    const pauseEl = trainControlEl.querySelector('[data-role="pause"]')
    pauseEl.id = `pauseTrain${trainNumber}`
    pauseEl.setAttribute('onclick', `startStopTrain(${trainNumber})`)

    const newCountEl = trainControlEl.querySelector('[data-role="new-count"]')
    newCountEl.id = `newCount${trainNumber}`
    newCountEl.setAttribute('onchange', `updateNewCount(${trainNumber},event)`)
    newCountEl.setAttribute('onkeydown', `if(event.key==='Enter'||event.key==='Escape'){this.blur()}`)

    const upgradeEngineEl = trainControlEl.querySelector('[data-role="upgrade-engine"]')
    upgradeEngineEl.id = `upgradeEngine${trainNumber}`
    upgradeEngineEl.setAttribute('onclick', `upgradeEngine(${trainNumber})`)

    const healthEl = trainControlEl.querySelector('[data-role="health"]')
    healthEl.id = `health${trainNumber}`

    const extendEl = trainControlEl.querySelector('[data-role="extend"]')
    extendEl.id = `extendTrain${trainNumber}`
    extendEl.setAttribute('onclick', `extendTrain(${trainNumber})`)

    const removeEl = trainControlEl.querySelector('[data-role="remove"]')
    removeEl.id = `removeTrain${trainNumber}`
    removeEl.setAttribute('onclick', `removetrain(${trainNumber})`)

    const extensionControlsEl = trainControlEl.querySelector('[data-role="extension-controls"]')
    extensionControlsEl.id = `trainExtensionControls${trainNumber}`

    const completeExtensionEl = trainControlEl.querySelector('[data-role="complete-extension"]')
    completeExtensionEl.id = `completeTrainExtension${trainNumber}`
    completeExtensionEl.setAttribute('onclick', `completeTrainExtension(${trainNumber})`)

    const cancelExtensionEl = trainControlEl.querySelector('[data-role="cancel-extension"]')
    cancelExtensionEl.id = `cancelTrainExtension${trainNumber}`
    cancelExtensionEl.setAttribute('onclick', `cancelTrainExtension(${trainNumber})`)

    container.appendChild(fragment)
  }
}

initializeTrainControlWidgets(game.maxTrains)

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


const initializeDefaultTrains = async () => {
  let positions = [
    { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 500 },
    { x: CANVASMARGIN + 1450, y: CANVASMARGIN + 500 },
    { x: CANVASMARGIN + 1450, y: CANVASMARGIN + 1000 },
    { x: CANVASMARGIN + 1900, y: CANVASMARGIN + 1000 }
  ]

  await game.addTrain(positions, 7, 0, intersections, { trainType: 'passenger', partOfInitialSetup: true })

  positions = [
    { x: CANVASMARGIN + 250, y: CANVASMARGIN + 250 },
    { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 250 },
    { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 500 }
  ]
  let trainNumber = await game.addTrain(positions, 1, 0, intersections,
    { trainType: 'passenger', partOfInitialSetup: true })
  // game.addStation(trainNumber, 500, 300, `S${trainNumber}0604`, 30, { partOfInitialSetup: true })
  // game.addStation(trainNumber, 1200, 900, `S${trainNumber}1310`, 30, { partOfInitialSetup: true })

  positions = [
    { x: CANVASMARGIN + 1900, y: CANVASMARGIN + 200 },
    { x: CANVASMARGIN + 1900, y: CANVASMARGIN + 600 },
    { x: CANVASMARGIN + 300, y: CANVASMARGIN + 600 }
  ]
  trainNumber = await game.addFreightTrain(positions, 30, 0, intersections,
    { partOfInitialSetup: true })
  game.addStation(trainNumber, 1800, 600, `S${trainNumber}1907`, 30, { partOfInitialSetup: true })
}

await initializeDefaultTrains()

const drawScene = () => {
  if (!paused) {
    // moved this to the end of the if statement to ensure 
    // that the globalTicks are incremented after all other operations within the drawScene loop.
    // globalThis.globalTicks++
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

      // all existing trains sound their horn at the beginning of each time period..
      game.trains.forEach(train => {
        if (train) {
          const startDelayMs = Math.random() * 20000
          setTimeout(() => {
            audioManager.playTrainHorn({
              trainNumber: train.trainNumber,
              baseFrequency: 320 + 10 * train.trainNumber,
              duration: 0.2,
              volume: 0.11
            })
            setTimeout(() => {
              audioManager.playTrainHorn({
                trainNumber: train.trainNumber,
                baseFrequency: 320 + 10 * train.trainNumber,
                duration: 2.0,
                volume: 0.11
              })
            }, 200)
          }, startDelayMs)
        }
      })
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

    globalThis.globalTicks++
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

  const drawFilledCircle = (ctx, x, y, radius, color) => {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  
  const drawHollowCircle = (ctx, x, y, radius, color) => {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.stroke()
    ctx.closePath()
    ctx.restore()
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
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
  }

  const handleTrainHotkeys = (event) => {

    if (event.repeat || !event.code) return

    const isKeyboardRefresh = event.code === 'F5' || ((event.ctrlKey || event.metaKey) && event.code === 'KeyR')
    if (isKeyboardRefresh) {
      event.preventDefault()
      if (typeof window.swal !== 'undefined' && typeof window.swal.fire === 'function') {
        window.swal.fire({
          icon: 'info',
          title: 'Refresh blocked',
          text: 'Use in-game controls to continue. Browser refresh restarts the game.'
        })
      }
      return
    }

    if (event.code === 'KeyN') {
      // Allow toggling sound even when focus is inside an input.
      toggleSound()
      return
    }

    if (!startTrack && !startExtendTrain && !startFlyover && event.key === 'Escape') {
      ctxMaps1.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      ctxMaps2.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      ctxMaps3.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      return;
    }

    // NEW: Do nothing if the user is typing in an input or textarea
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }

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
      startFlyoverSelection()
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
        const populationMap = game.population.getAll()
        const maxPopulation = Math.max(...populationMap.map(p => p.population))
        const rMaxSquare = (gridSize / 2) ** 2
        populationMap.forEach(p => {
          const radiusSquare = rMaxSquare * (p.population / maxPopulation)
          const radius = 2 * Math.sqrt(radiusSquare)
          ctxMaps1.beginPath()
          ctxMaps1.arc(p.x, p.y, radius, 0, 2 * Math.PI)
          ctxMaps1.fillStyle = 'rgba(0,255,0,0.5)'
          ctxMaps1.fill()
        })
      } else {
        ctxMaps1.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      }
      showingPopulationMap = !showingPopulationMap

    } else if (event.code === 'KeyY') {
      //if the code is Y then show the rawmaterials Map
      if (!showingRawmaterialsMap) {
        const rawmaterialsMap = game.rawmaterials.getAll()
        const maxRawmaterial = Math.max(...rawmaterialsMap.map(p => p.rawmaterial))
        const rMaxSquare = (gridSize / 2) ** 2
        rawmaterialsMap.forEach(p => {
          const radiusSquare = rMaxSquare * (p.rawmaterial / maxRawmaterial)
          const radius = Math.sqrt(radiusSquare)
          ctxMaps2.beginPath()
          ctxMaps2.arc(p.x, p.y, radius, 0, 2 * Math.PI)
          ctxMaps2.fillStyle = 'rgba(255,255,0,0.5)'
          ctxMaps2.fill()
        })
      } else {
        ctxMaps2.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      }
      showingRawmaterialsMap = !showingRawmaterialsMap
    } else if (event.code === 'KeyZ') {
      //if the code is Z then show the rawmaterial demand Map
      if (!showingRawmaterialDemandMap) {
        const rawmaterialDemandMap = game.rawmaterialDemand.getAll()
        const maxRawmaterialDemand = Math.max(...rawmaterialDemandMap.map(p => p.rawmaterial))

        const rMaxSquare = (gridSize / 2) ** 3
        rawmaterialDemandMap.forEach(p => {
          if (p.rawmaterial !== 0) {

            const radiusSquare = rMaxSquare * (p.rawmaterial / maxRawmaterialDemand)
            const radius = Math.sqrt(radiusSquare)
            ctxMaps3.beginPath()
            ctxMaps3.arc(p.x, p.y, radius, 0, 2 * Math.PI)
            ctxMaps3.fillStyle = 'rgba(0,0,255,0.5)'
            ctxMaps3.fill()

            ctxMaps3.font = '20px Arial'
            ctxMaps3.fillStyle = 'black'
            const textMetrics = ctxMaps3.measureText(`${Math.floor(p.rawmaterial)}`)
            ctxMaps3.fillText(`${Math.floor(p.rawmaterial)}`, p.x - textMetrics.width / 2, p.y + 10)
          }
        })
      } else {
        ctxMaps3.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
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
    } else if (event.code === 'KeyN') {
      //if the code is N then toggle sound
      toggleSound()
    }
  }

  startPausebutton.addEventListener('click', () => {
    startPauseGame()
  })

  const soundControlEl = document.querySelector('#soundControl')
  const soundControlLabelEl = document.querySelector('#soundControlLabel')
  const soundControlIconEl = soundControlEl?.querySelector('i')

  const updateSoundControlUI = (enabled = audioManager.isEnabled()) => {
    if (soundControlLabelEl) {
      soundControlLabelEl.textContent = enabled ? 'Sound: On' : 'Sound: Off'
    }
    if (soundControlIconEl) {
      soundControlIconEl.classList.toggle('fa-volume-up', enabled)
      soundControlIconEl.classList.toggle('fa-volume-mute', !enabled)
      soundControlIconEl.title = enabled ? 'Sound On (press N to mute)' : 'Sound Off (press N to unmute)'
    }
    if (soundControlEl) {
      soundControlEl.setAttribute('aria-pressed', String(enabled))
    }
  }

  updateSoundControlUI()

  const toggleSound = async () => {
    const enabled = audioManager.toggleSound()
    if (enabled && !audioManager.isUnlocked()) {
      await audioManager.unlockAudio()
    }
    updateSoundControlUI(enabled)
    return enabled
  }

  const normalizeSmokeLevel = (level) => {
    const value = typeof level === 'string' ? level.toLowerCase() : 'high'
    if (value === 'off' || value === 'low' || value === 'high') {
      return value
    }
    return 'high'
  }

  let currentSmokeLevel = 'high'
  const smokeLevelControlEl = document.querySelector('#smokeLevelControl')

  const applySmokeLevelToTrains = (level) => {
    const normalized = normalizeSmokeLevel(level)
    game.trains.forEach((train) => {
      if (!train) {
        return
      }
      if (typeof train.setSmokeSetting === 'function') {
        train.setSmokeSetting(normalized)
      } else {
        train.smokeSetting = normalized
      }
    })
    return normalized
  }

  const updateSmokeControlUI = (level = currentSmokeLevel) => {
    if (smokeLevelControlEl) {
      smokeLevelControlEl.value = normalizeSmokeLevel(level)
    }
  }

  window.setTrainSmokeLevel = (level) => {
    currentSmokeLevel = applySmokeLevelToTrains(level)
    updateSmokeControlUI(currentSmokeLevel)
    return currentSmokeLevel
  }

  if (smokeLevelControlEl) {
    smokeLevelControlEl.addEventListener('change', (event) => {
      window.setTrainSmokeLevel(event.target.value)
    })
  }

  window.setTrainSmokeLevel(currentSmokeLevel)

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
    'Z': 'KeyZ',
    'N': 'KeyN'
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

  const getCanvasPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  const typeOfTrain = document.getElementById('typeoftrain')
  if (typeOfTrain) {
    typeOfTrain.addEventListener('change', (event) => {
      if (event.target.value == 'passenger') {
        //hide the freight train related controls
        document.querySelector('#freightTrainControls').style.display = 'none'
        document.querySelector('#passengerTrainControls').style.display = 'grid'
      } else if (event.target.value == 'freight') {
        //hide the passenger train related controls
        document.querySelector('#passengerTrainControls').style.display = 'none'
        document.querySelector('#freightTrainControls').style.display = 'grid'
      }
    })
  }

  const infoForTrainContainer = document.querySelector('#infoForTrain')
  if (infoForTrainContainer) {
    infoForTrainContainer.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || target.tagName !== 'SPAN') {
        return
      }
      const trainNumber = Number.parseInt(target.dataset.value, 10)
      if (!Number.isInteger(trainNumber)) {
        return
      }
      //hide all elements for all trains
      document.querySelectorAll('[id^="infotrainoperations"]').forEach(el => el.style.display = 'none')
      const infoTrainOperationsElement = document.querySelector(`#infotrainoperations${trainNumber}`)
      if (infoTrainOperationsElement) {
        infoTrainOperationsElement.style.display = 'block'
      }
    })
  }

  const stationForTrainContainer = document.querySelector('#stationFortrain')

  const clearStationHoverPreview = (force = false) => {
    if (force || !startStation) {
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    }
  }

  const clearFlyoverPreview = (force=false) => {
    if (force || !startFlyover) {
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    }
  }

  if (stationForTrainContainer) {
    stationForTrainContainer.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || target.tagName !== 'SPAN') {
        return
      }
      const trainNumber = Number.parseInt(target.dataset.value, 10)
      if (!Number.isInteger(trainNumber)) {
        return
      }
      stationForTrainContainer.querySelectorAll('span').forEach(span => span.classList.remove('selected'))
      target.classList.add('selected')

      const train = game.trains[trainNumber - 1]
      if (!train) {
        console.error(`Train with number ${trainNumber} not found`)
        return
      }
      // AJ 08/21/26 added the following.
      if (startStation && selectedTrainNumberForStartStation === trainNumber) {
        startStation = false
        ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
        selectedTrainNumberForStartStation = null
        return
      }

      startStation = true
      const possibleStationLocations = train.track.getPossibleStationLocations()
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      possibleStationLocations.forEach(location => {
        ctxTemp.beginPath()
        ctxTemp.moveTo(location.x, location.y)
        ctxTemp.fillStyle = 'purple'
        ctxTemp.arc(location.x, location.y, 10, 0, Math.PI * 2)
        ctxTemp.closePath()
        ctxTemp.fill()
      })

      selectedTrainNumberForStartStation = trainNumber
    })

    stationForTrainContainer.addEventListener('mousemove', (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || target.tagName !== 'SPAN') {
        return
      }
      const trainNumber = Number.parseInt(target.dataset.value, 10)
      if (!Number.isInteger(trainNumber)) {
        return
      }

      const train = game.trains[trainNumber - 1]
      if (!train) {
        console.error(`Train with number ${trainNumber} not found`)
        return
      }

      if (!startStation) {
        //clear the temporary canvas before drawing
        ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
        train.track.drawUsingNewPositions(ctxTemp, 'rgb(255, 255, 0)', 10)
      }
    })

    stationForTrainContainer.addEventListener('mouseleave', () => {
      clearStationHoverPreview()
    })
  }

  const flyoverForTrainContainer = document.querySelector('#flyoverForTrain')

  if (flyoverForTrainContainer) {
    flyoverForTrainContainer.addEventListener('click', (event) => {
      startFlyover = true
      const target = event.target
      if (!(target instanceof HTMLElement) || target.tagName !== 'SPAN') {
        return
      }
      const trainNumber = Number.parseInt(target.dataset.value, 10)
      if (!Number.isInteger(trainNumber)) {
        return
      }
      const train = game.trains[trainNumber - 1]
      if (!train) {
        console.error(`Train with number ${trainNumber} not found`)
        return
      }

      flyoverForTrainContainer.querySelectorAll('span').forEach(span => span.classList.remove('selected'))
      target.classList.add('selected')

      if (startFlyover && selectedTrainNumberForStartFlyover === trainNumber) {
        startFlyover = false
        ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
        selectedTrainNumberForStartFlyover = null
        return
      }

      selectedTrainNumberForStartFlyover = trainNumber
      // const possibleFlyoverLocations = getPossibleFlyoverLocations(trainNumber)
      // ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      // possibleFlyoverLocations.forEach(location => {
      //   drawFilledCircle(ctxTemp, location.x, location.y, 20, 'orange')
      // })
      
    })
    flyoverForTrainContainer.addEventListener('mousemove', (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || target.tagName !== 'SPAN') {
        return
      }
      const trainNumber = Number.parseInt(target.dataset.value, 10)
      if (!Number.isInteger(trainNumber)) {
        return
      }
      const train = game.trains[trainNumber - 1]
      if (!train) {
        console.error(`Train with number ${trainNumber} not found`)
        return
      }
      if (!startFlyover ) {
        //clear the temporary canvas before drawing
        ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
        train.track.drawUsingNewPositions(ctxTemp, 'rgb(255, 255, 0)', 10)
        const flyoverLocations = getPossibleFlyoverLocations(trainNumber)
        flyoverLocations.forEach(location => {
          drawFilledCircle(ctxTemp, location.x, location.y, 20, 'rgb(255, 255, 0)')
          drawHollowCircle(ctxTemp, location.x, location.y, 20, 'black')
        })
      }
    })

    // flyoverForTrainContainer.addEventListener('mouseleave', () => {
    //   clearFlyoverPreview()
    // })
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
          swal.fire({
            title: 'Invalid Starting Point',
            text: `The point at (Row ${alpha((y / gridSize))}, Col ${alpha((x / gridSize))}) is not a valid starting point for track extension.`,
            icon: 'error',
            confirmButtonText: 'OK'
          })
          return
        }
        console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y} and it's a valid starting point for track extension`)
        // figure out if this point is in the same row or column as the previous point
        // if it is then we remove the redundant previous point
        if ((positionsForExtendTrain.length > 0) && !validTrackPoints.has(`${x},${y}`)) {
          console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y} but it's not a valid starting point`)
          swal.fire({
            title: 'Invalid Point',
            text: `The point at (Row ${alpha((y / gridSize))}, Col ${alpha((x / gridSize))}) is not a valid point for track extension.`,
            icon: 'error',
            confirmButtonText: 'OK'
          })
          return
        }
        if (positionsForExtendTrain.length > 1) {
          const lastPosition = positionsForExtendTrain[positionsForExtendTrain.length - 1]
          const secondLastPosition = positionsForExtendTrain[positionsForExtendTrain.length - 2]
          if (lastPosition.x === secondLastPosition.x && x === lastPosition.x) {
            positionsForExtendTrain.pop()
          }
          if (lastPosition.y === secondLastPosition.y && y === lastPosition.y) {
            positionsForExtendTrain.pop()
          }
        }
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
        // figure out if this point is in the same row or column as the previous point
        // if it is then we remove the redundant previous point
        if (positions.length > 1) {
          const lastPosition = positions[positions.length - 1]
          const secondLastPosition = positions[positions.length - 2]
          if (lastPosition.x === secondLastPosition.x && x === lastPosition.x) {
            positions.pop()
          }
          if (lastPosition.y === secondLastPosition.y && y === lastPosition.y) {
            positions.pop()
          }
        }
        positions.push({ x, y })
        updateCanvasTemp(x, y)

        //once a new track is under construction, we can reset the pointer events on the #flagOff
        document.querySelector('#flagOff').style.pointerEvents = 'auto'
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
            text: `Do you want to add a Station for Train ${selectedTrainNumber} at (Row ${alpha((location.y / gridSize))}, Col ${alpha((location.x / gridSize))})?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
          }).then((result) => {
            if (result.isConfirmed) {
              game.addStation(selectedTrainNumber, location.x, location.y, `S${selectedTrainNumber}${String((location.x / gridSize) + 1).padStart(2, '0')}${String((location.y / gridSize) + 1).padStart(2, '0')}`, 30)
              //clear the canvasTemp after adding the station
              // AJ 08/21/26 removed the following line so that more than one station can be added.
              // ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
            }
            // AJ 08/21/26 removed the following line so that more than one station can be added.
            // startStation = false
          })
        }
      })
    }
    if (startFlyover) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize
      if ((Math.abs(x - point.x) < click_error) && (Math.abs(y - point.y) < click_error)) {
        // check if the clicked point is a valid flyover location for the selected train
        const selectedTrainNumber = Number.parseInt(document.querySelector('#flyoverForTrain span.selected')?.dataset.value, 10)
        if (!selectedTrainNumber) { 
          return
        }
        const possibleFlyoverLocations = getPossibleFlyoverLocations(selectedTrainNumber)
        const isValidFlyoverLocation = possibleFlyoverLocations.some(location => location.x === x && location.y === y)
        if (!isValidFlyoverLocation) {
          swal.fire({
            title: 'Invalid Flyover Location',
            text: 'The selected location is not a valid flyover location for the selected train.',
            icon: 'error',
            confirmButtonText: 'OK'
          })
          return
        }
        // ensure that flyover does not already exist at this location
        const flyovers = game.getFlyovers()
        const flyoverExists = flyovers.some(flyover => flyover.col === x / gridSize && flyover.row === y / gridSize)
        if (flyoverExists) {
          swal.fire({
            title: 'Flyover Already Exists',
            text: 'A flyover already exists at the selected location.',
            icon: 'error',
            confirmButtonText: 'OK'
          })
          return
        }
        // console.log(`Flyover added at (${(x / gridSize) + 1},${(y / gridSize) + 1})`)
        swal.fire({
          title: `Add Flyover`,
          text: `Do you want to add a Flyover at (Row ${alpha((y / gridSize))}, Col ${alpha((x / gridSize))})?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes',
          cancelButtonText: 'No'
        }).then((result) => {
          if (result.isConfirmed) {
            const n = game.getNumberOfFlyovers()
            intersections.updateIntersectionsWithFlyoverLocation(y / gridSize, x / gridSize, true)
            game.addFlyover(y / gridSize, x / gridSize)
          }else{
            //clear the canvasTemp after cancelling the flyover
            // ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
          }


        })
      }
    }
  })
  document.querySelector('#canvas_temp').addEventListener('mousemove', (event) => {
    const point = getCanvasPoint(event)
    const row = alpha(Math.round((point.y - CANVASMARGIN) / gridSize))
    const col = alpha(Math.round((point.x - CANVASMARGIN) / gridSize))
    const buttonGroup8el = document.querySelector('#buttonGroup8')
    if (!buttonGroup8el) {
      return
    }
    const label = buttonGroup8el.querySelector('span')
    if (!label) {
      return
    }
    buttonGroup8el.style.display = 'block'
    // buttonGroup8 is fixed-position, so place it in viewport coordinates.
    buttonGroup8el.style.left = `${event.clientX + 7}px`
    buttonGroup8el.style.top = `${event.clientY + 7}px`
    label.textContent = `${col},${row}`

    if (startTrack) {
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

  // window.startFlyover = function () {
  //   startFlyover = true
  //   startTrack = false
  //   window.showPossibleFlyoverLocations()
  // }

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
    if (stationForTrainContainer) {
      stationForTrainContainer.style.display = 'block'
    }
    document.querySelector('#canvas_temp').style = 'cursor:crosshair'
  }

  const startFlyoverSelection = function () {
    startStation = false
    startTrack = false
    // startStation = true
    if (flyoverForTrainContainer) {
      flyoverForTrainContainer.style.display = 'block'
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

  //set up the grid
  drawGrid(ctxTracks)

  const updateValidTrackPreview = (pathPositions, options = {}) => {
    const {
      pointColor = 'blue',
      firstStepAnchor = null,
      drawTrackPreview = false
    } = options

    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    pathPositions.forEach(position => {
      const { x, y } = position
      drawFilledCircle(ctxTemp, x, y, 7, pointColor)
    })

    validTrackPoints.clear()
    if (pathPositions.length === 0) {
      return
    }

    const { x: last_x, y: last_y } = pathPositions[pathPositions.length - 1]
    let x_before_last_x = null
    let y_before_last_y = null

    if (pathPositions.length > 1) {
      x_before_last_x = pathPositions[pathPositions.length - 2].x
      y_before_last_y = pathPositions[pathPositions.length - 2].y
    } else if (firstStepAnchor) {
      x_before_last_x = firstStepAnchor.x
      y_before_last_y = firstStepAnchor.y
    }

    const lastRow = last_y / gridSize
    const lastCol = last_x / gridSize
    const increasingRow = y_before_last_y !== null && last_y > y_before_last_y
    const decreasingRow = y_before_last_y !== null && last_y < y_before_last_y
    const increasingCol = x_before_last_x !== null && last_x > x_before_last_x
    const decreasingCol = x_before_last_x !== null && last_x < x_before_last_x

    if (pathPositions.length === 1) {
      if (increasingRow || decreasingRow) {
        for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
          if ((decreasingRow && row < lastRow - 1) || (increasingRow && row > lastRow + 1)) {
            drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`)
            validTrackPoints.add(`${last_x},${row * gridSize}`)
          }
        }
      } else if (increasingCol || decreasingCol) {
        for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
          if ((decreasingCol && col < lastCol - 1) || (increasingCol && col > lastCol + 1)) {
            drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`)
            validTrackPoints.add(`${col * gridSize},${last_y}`)
          }
        }
      } else {
        for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
          if (Math.abs(row - lastRow) >= 4) {
            drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`)
            validTrackPoints.add(`${last_x},${row * gridSize}`)
          }
        }
        for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
          if (Math.abs(col - lastCol) >= 4) {
            drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`)
            validTrackPoints.add(`${col * gridSize},${last_y}`)
          }
        }
      }
      return
    }

    if (increasingCol || decreasingCol) {
      if (Math.abs(lastCol - (x_before_last_x / gridSize)) >= 4 || pathPositions.length <= 2) {
        for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
          if (Math.abs(row - lastRow) < 4) {
            continue
          }
          drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`)
          validTrackPoints.add(`${last_x},${row * gridSize}`)
        }
      }

      for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
        if ((increasingCol && col > lastCol) || (decreasingCol && col < lastCol)) {
          drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`)
          validTrackPoints.add(`${col * gridSize},${last_y}`)
        }
      }
    }

    if (increasingRow || decreasingRow) {
      if (Math.abs(lastRow - (y_before_last_y / gridSize)) >= 4 || pathPositions.length <= 2) {
        for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
          if (Math.abs(col - lastCol) < 4) {
            continue
          }
          drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`)
          validTrackPoints.add(`${col * gridSize},${last_y}`)
        }
      }

      for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
        if ((increasingRow && row > lastRow) || (decreasingRow && row < lastRow)) {
          drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`)
          validTrackPoints.add(`${last_x},${row * gridSize}`)
        }
      }
    }

    if (increasingRow) {
      for (let row = y_before_last_y / gridSize + 2; row < lastRow; row++) {
        drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`)
        validTrackPoints.add(`${last_x},${row * gridSize}`)
      }
    }
    if (decreasingRow) {
      for (let row = y_before_last_y / gridSize - 2; row > lastRow; row--) {
        drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`)
        validTrackPoints.add(`${last_x},${row * gridSize}`)
      }
    }
    if (increasingCol) {
      for (let col = x_before_last_x / gridSize + 2; col < lastCol; col++) {
        drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`)
        validTrackPoints.add(`${col * gridSize},${last_y}`)
      }
    }
    if (decreasingCol) {
      for (let col = x_before_last_x / gridSize - 2; col > lastCol; col--) {
        drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`)
        validTrackPoints.add(`${col * gridSize},${last_y}`)
      }
    }

    if (drawTrackPreview) {
      const tempTrack = new Track(ctxTemp, pathPositions)
      tempTrack.draw()
    }
  }

  function updateCanvasTempForExtendTrain() {
    const el = document.querySelector('#buttonGroup1')
    if (!el) {
      return
    }
    const trainNumber = Number.parseInt(el.dataset.extendingTrainNumber, 10)
    let firstStepAnchor = null

    if (positionsForExtendTrain.length === 1) {
      const train = game.trains[trainNumber - 1]
      if (train) {
        if (train.track.positions[0].x === positionsForExtendTrain[0].x &&
          train.track.positions[0].y === positionsForExtendTrain[0].y) {
          firstStepAnchor = {
            x: train.track.positions[1].x,
            y: train.track.positions[1].y
          }
        } else if (train.track.positions[train.track.positions.length - 1].x === positionsForExtendTrain[0].x &&
          train.track.positions[train.track.positions.length - 1].y === positionsForExtendTrain[0].y) {
          firstStepAnchor = {
            x: train.track.positions[train.track.positions.length - 2].x,
            y: train.track.positions[train.track.positions.length - 2].y
          }
        }
      }
    }

    updateValidTrackPreview(positionsForExtendTrain, {
      pointColor: 'orange',
      firstStepAnchor,
      drawTrackPreview: true
    })
  }

  function updateCanvasTemp() {
    updateValidTrackPreview(positions, {
      pointColor: 'blue',
      drawTrackPreview: true
    })
  }

  window.addEventListener('collision', (event) => {
    audioManager.safePlay('beep')
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
    swal.fire({
      title: 'Set Starting Point',
      text: `Click on the grid to set the starting point of the track. After that, you can continue to add more points to define the track. Since the train cannot make sharp turns you will be guided and you will
      only be able to add points (shown by green circles) that do not create sharp turns. When you are done, click on the check icon in the train control. If you want to cancel, click on the cross icon in the train control.`
    })
    document.querySelector('#canvas_temp').style = 'cursor:crosshair'
  }

  window.canceltrack = () => {
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
    if (startTrack) {
      startTrack = false
      document.querySelector('#canvas_temp').style = 'cursor:default'
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

  window.turnSoundOn = async () => {
    if (audioManager.isEnabled()) {
      await toggleSound()
      return
    }
    audioManager.setEnabled(true)
    if (!audioManager.isUnlocked()) {
      await audioManager.unlockAudio()
    }
    updateSoundControlUI(true)
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
    swal.fire({
      title: `Remove Train T${trainnumber}`,
      text: `Are you sure you want to remove Train T${trainnumber}? This action cannot be undone. Also please note that 
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
  window.newtrain = async () => {

    if (positions.length < 2) {
      startTrack = false
      if (positions.length === 1) {
        swal.fire(`You have specified a starting point and no ending point. To create a track, you need to specify at least two points.`)
      } else {
        swal.fire(`You have not specified any points for the track. To create a track, you need to specify at least two points.`)
      }
      document.querySelector('#startTrack').style.display = 'block'
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN)
      return
    }
    if (positions[0].x === positions[positions.length - 1].x &&
      positions[0].y === positions[positions.length - 1].y) {
      startTrack = false
      swal.fire(`The starting point and ending point of the track cannot be the same. Please specify different points for the track.`)
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
      swal.fire(`You do not have enough funds to add this train. You need $${trainCost.toLocaleString('en-US')} but you only have $${game.getCashInHand().toLocaleString('en-US')}.`)
      startTrack = false
      document.querySelector('#startTrack').style.display = 'block'
      return
    }
    // game.addTrain(positions, speed, numCoaches, 0, intersections, { trainType })
    const createdTrainNumber = await game.addTrain(positions, numCoaches, 0, intersections, { trainType })
    if (!createdTrainNumber) {
      return
    }
    applySmokeLevelToTrains(currentSmokeLevel)
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


    // update the UI with the right number of coaches or freight wagons based on the train type
    const lblNumCoaches = document.querySelector(`#lblNumCoaches${createdTrainNumber}`)
    if (lblNumCoaches) {
      lblNumCoaches.textContent = numCoaches
    }
    // update the UI with the right train type
    const lblTrainType = document.querySelector(`#lblTrainType${createdTrainNumber}`)
    if (lblTrainType) {
      lblTrainType.textContent = trainType == 'Passenger' ? 'P' : 'F'
    }

    //we also update the options in the select box
    const selectAddEl = document.querySelector(`#selectAdd${createdTrainNumber}`)
    if (selectAddEl) {
      selectAddEl.innerHTML = ''
      for (let i = 1; i <= Train.maxNumCoaches - numCoaches; i++) {
        const option = document.createElement('option')
        option.value = i
        option.textContent = i
        selectAddEl.appendChild(option)
      }
      selectAddEl.value = trainType
    }
    // we also update the UI so that the user is not able to click
    // on flag-off icon a second time.
    const flagOffIcon = document.querySelector('#flagOff')
    if (flagOffIcon) {
      flagOffIcon.style.pointerEvents = 'none'
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

  window.updateNewCount = (trainNumber, event) => {
    const train = game.trains[trainNumber - 1]
    if (!train || !event?.target) {
      return
    }

    const countInput = event.target
    const blurCountInput = () => {
      if (countInput instanceof HTMLElement) {
        countInput.blur()
      }
    }

    const oldValue = train.numCoaches
    const newValue = Number.parseInt(countInput.value, 10)
    const minAllowed = 2
    const maxAllowed = train.trainType === 'freight'
      ? game.getMaxNumFreightWagons()
      : game.getMaxNumCoaches()

    if (!Number.isInteger(newValue) || newValue < minAllowed || newValue > maxAllowed) {
      countInput.value = oldValue
      blurCountInput()
      return
    }

    if (newValue === oldValue) {
      blurCountInput()
      return
    }

    if (newValue > oldValue) {
      game.addCoach(trainNumber, newValue - oldValue)
      blurCountInput()
      return
    }

    game.removeCoach(trainNumber, oldValue - newValue)
    blurCountInput()
  }

  window.addCoach = function (trainNumber) {
    const train = game.trains[trainNumber - 1]
    if (!train) {
      console.error(`Train with number ${trainNumber} not found`)
      return
    }
    const additionalAddPassengerEl = document.querySelector(`#additionalAddPassenger${trainNumber}`)
    const additionalAddFreightEl = document.querySelector(`#additionalAddFreight${trainNumber}`)
    const additionalSubtractPassengerEl = document.querySelector(`#additionalSubtractPassenger${trainNumber}`)
    const additionalSubtractFreightEl = document.querySelector(`#additionalSubtractFreight${trainNumber}`)
    if (train.trainType === 'passenger') {
      if (additionalAddPassengerEl) {
        additionalAddPassengerEl.style.display = 'flex'
        setTimeout(() => {
          additionalAddPassengerEl.style.display = 'none'
        }, 5000)
      }
      if (additionalAddFreightEl) {
        additionalAddFreightEl.style.display = 'none'
      }
      if (additionalSubtractPassengerEl) {
        additionalSubtractPassengerEl.style.display = 'none'
      }
      if (additionalSubtractFreightEl) {
        additionalSubtractFreightEl.style.display = 'none'
      }
    } else if (train.trainType === 'freight') {
      if (additionalAddPassengerEl) {
        additionalAddPassengerEl.style.display = 'none'
      }
      if (additionalAddFreightEl) {
        additionalAddFreightEl.style.display = 'flex'
        setTimeout(() => {
          additionalAddFreightEl.style.display = 'none'
        }, 5000)
      }
      if (additionalSubtractPassengerEl) {
        additionalSubtractPassengerEl.style.display = 'none'
      }
      if (additionalSubtractFreightEl) {
        additionalSubtractFreightEl.style.display = 'none'
      }
    }
    // game.addCoach(trainNumber)
  }

  window.removeCoach = function (trainNumber) {
    const train = game.trains[trainNumber - 1]
    if (!train) {
      console.error(`Train with number ${trainNumber} not found`)
      return
    }
    const additionalAddPassengerEl = document.querySelector(`#additionalAddPassenger${trainNumber}`)
    const additionalAddFreightEl = document.querySelector(`#additionalAddFreight${trainNumber}`)
    const additionalSubtractPassengerEl = document.querySelector(`#additionalSubtractPassenger${trainNumber}`)
    const additionalSubtractFreightEl = document.querySelector(`#additionalSubtractFreight${trainNumber}`)
    if (train.trainType === 'passenger') {
      if (additionalAddPassengerEl) {
        additionalAddPassengerEl.style.display = 'none'
      }
      if (additionalAddFreightEl) {
        additionalAddFreightEl.style.display = 'none'
      }
      if (additionalSubtractPassengerEl) {
        additionalSubtractPassengerEl.style.display = 'flex'
        setTimeout(() => {
          additionalSubtractPassengerEl.style.display = 'none'
        }, 5000)
      }
      if (additionalSubtractFreightEl) {
        additionalSubtractFreightEl.style.display = 'none'
      }
    } else if (train.trainType === 'freight') {
      if (additionalAddPassengerEl) {
        additionalAddPassengerEl.style.display = 'none'
      }
      if (additionalAddFreightEl) {
        additionalAddFreightEl.style.display = 'none'
      }
      if (additionalSubtractPassengerEl) {
        additionalSubtractPassengerEl.style.display = 'none'
      }
      if (additionalSubtractFreightEl) {
        additionalSubtractFreightEl.style.display = 'flex'
        setTimeout(() => {
          additionalSubtractFreightEl.style.display = 'none'
        }, 5000)
      }
    }
    // game.removeCoach(trainNumber)
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
  if (buttonGroup2) {
    // buttonGroup2.addEventListener('mouseleave', () => {
    //   clearFlyoverPreview()
    // })
    const buttonGroup2Close = buttonGroup2.querySelector('.dialogClose')
    if (buttonGroup2Close) {
      buttonGroup2Close.addEventListener('click', () => {
        buttonGroup2.style.display = 'none'
        clearFlyoverPreview(true)
      })
    }
  }

  const buttonGroup3 = document.querySelector('#buttonGroup3');
  makeDraggable(buttonGroup3);
  if (buttonGroup3) {
    // buttonGroup3.addEventListener('mouseleave', () => {
    //   clearStationHoverPreview()
    // })
    const buttonGroup3Close = buttonGroup3.querySelector('.dialogClose')
    if (buttonGroup3Close) {
      buttonGroup3Close.addEventListener('click', () => {
        buttonGroup3.style.display = 'none'
        clearStationHoverPreview(true)
      })
    }
  }

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

  const getPossibleFlyoverLocations = function (trainNumber) {
    const train = game.trains[trainNumber - 1]
    if (!train) {
      console.error(`Train with number ${trainNumber} not found`)
      return []
    }
    const locations = train.getPossibleFlyoverLocations()
    // now we check if any of these locations is also present in the track of any other train

    const otherLocations = []
    for (const loc of locations) {
      for (const otherTrain of game.trains) {
        if (otherTrain.trainNumber === trainNumber) {
          continue
        }
        let otherTrainPossibleFlyoverLocations = otherTrain.getPossibleFlyoverLocations()
        if (otherTrainPossibleFlyoverLocations.some(otherLoc => otherLoc.x === loc.x && otherLoc.y === loc.y)) {
          otherLocations.push(loc)
        }
      }
    }
    return otherLocations
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
  swal.fire({
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
      const colorConfig = game.TRAINCONFIG[(index) % game.TRAINCONFIG.length]
      const row = document.createElement('tr')
      row.style.backgroundColor = game.trains[index]?.trainType === 'freight' ? 'rgba(80,80,80,0.75)' : colorConfig.Color
      // row.style.color = colorConfig.textColor
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
