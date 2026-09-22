import { Train } from './Train.js'
import { Track } from './Track.js'
// import { Tracks } from './Tracks.js'
import { Financials } from './Financials.js'
import { Flyovers } from './Flyovers.js'
import { Flyover } from './Flyover.js'
import { createStation } from './Station.js'
import { Population } from './Population.js'
import { TravelPopulation } from './TravelPopulation.js'
import { Rawmaterials } from './Rawmaterials.js'
import { RawmaterialDemand } from './RawmaterialDemand.js'
import { RawMaterialSupply } from './RawMaterialSupply.js'
import { Popups } from "./Popups.js"
import { TrainInfo } from './TrainInfo.js'
import { getCommonSegmentsMap } from './utility.js'



class Game {

  TRAINCONFIG = [
    { defaultName: 'Red', Color: 'rgba(255,0,0,0.5)' },
    { defaultName: 'Violet', Color: 'rgba(125,0,255,0.5)' },
    { defaultName: 'Blue', Color: 'rgba(0,0,255,0.5)' },
    { defaultName: 'Yellow', Color: 'rgba(255,255,0,0.5)' },
    { defaultName: 'Magenta', Color: 'rgba(255,0,255,0.5)' },
    { defaultName: 'Cyan', Color: 'rgba(0,255,255,0.5)' }
  ]

  constructor(ctx, ctxTracks, ctxTemp, ctxDemoTracks, gridSize, OFFSET_X, OFFSET_Y) {
    this.ctx = ctx
    this.ctxTracks = ctxTracks
    this.ctxTemp = ctxTemp
    this.canvasWidth = ctx.canvas.width
    this.canvasHeight = ctx.canvas.height
    this.canvasDemoTracksWidth = ctxDemoTracks.canvas.width
    this.canvasDemoTracksHeight = ctxDemoTracks.canvas.height
    this.gridSize = gridSize
    this.ctxDemoTracks = ctxDemoTracks
    this.OFFSET_X = OFFSET_X
    this.OFFSET_Y = OFFSET_Y
    // this.drawGridCallback = drawGridCallback
    this.trains = []
    this.Flyovers = new Flyovers(ctxTracks, gridSize, OFFSET_X, OFFSET_Y)
    // this.tracks = new Tracks(ctxTracks)
    this.ticksPerTimeUnit = 10000
    this.totalTimeUnits = 100
    this.financials = new Financials(this.totalTimeUnits)
    this.population = new Population(ctx.canvas.width, ctx.canvas.height, gridSize)
    this.travelPopulation = new TravelPopulation(this.population, ctx.canvas.width, ctx.canvas.height, gridSize)
    this.rawmaterials = new Rawmaterials(ctx.canvas.width, ctx.canvas.height, gridSize)
    this.rawmaterialDemand = new RawmaterialDemand(ctx.canvas.width, ctx.canvas.height, gridSize)
    this.rawmaterialSupply = new RawMaterialSupply(ctx.canvas.width, ctx.canvas.height, gridSize)
    this.popups = new Popups()
    this.rawmaterialDemand.displayStatistics()
    this.maxTrains = 9
    this.trainInfo = new TrainInfo(this.maxTrains, this.totalTimeUnits)
  }
  getTimeUnitDuration() {
    return this.getMinutesPerTimeUnit()
  }
  getInitialCash() {
    // we return the number in millions
    return Math.floor(Financials.CASH_IN_HAND / 1000000)
  }
  getMinutesPerTimeUnit() {
    return Math.ceil(this.ticksPerTimeUnit / (60 * 60))
  }
  getCashInHand() {
    return this.financials.cashInHand
  }
  getCoachCost() {
    return this.financials.coachCost
  }
  getEngineCost() {
    return this.financials.engineCost
  }
  getEngineUpgradeCost() {
    return this.financials.engineUpgradeCost
  }
  getStationCost() {
    return this.financials.stationCost
  }
  getFlyoverCost() {
    return this.financials.FlyoverCost
  }
  getCollisionCost() {
    return this.financials.collisionCost
  }
  getTrackCostPerUnit() {
    return this.financials.trackCostPerUnit
  }
  getCoachCapacity() {
    return Train.coachPassengerCapacity
  }
  getFreightCapacity() {
    return Train.freightWagonCapacity
  }
  getTotalTimeUnits() {
    return this.totalTimeUnits
  }
  getMaxNumCoaches() {
    return Train.maxNumCoaches
  }
  getMaxNumFreightWagons() {
    return Train.maxNumFreightWagons
  }
  getMinNumFreightWagons() {
    return Train.minNumFreightWagons
  }
  getMinNumCoaches() {
    return Train.minNumCoaches
  }
  getFreightWagonCost() {
    //for the time being same cost as passenger coach
    return this.financials.coachCost
  }
  getTrackCost(positions) {
    return Track.getTrackLength(positions) * this.getTrackCostPerUnit()
  }
  getCumProfit() {
    return this.financials.cumProfitByTrain.reduce((acc, profit) => acc + profit, 0)
  }
  getRank() {
    //change this after we start saving the games to the database

    return 1
  }

  getCurrentTimePeriod() {
    // return Math.min(Math.floor(globalThis.globalTicks / this.ticksPerTimeUnit), this.totalTimeUnits - 1)
    return Math.floor(globalThis.globalTicks / this.ticksPerTimeUnit)
  }

  getCurrentTimeIndex() {
    return this.getCurrentTimePeriod()
  }

  addCoach(trainNumber, numCoaches = 1) {
    const train = this.trains[trainNumber - 1]
    if (train) {
      train.addCoach(numCoaches)
      this.financials.buyCoach(this.getCurrentTimeIndex(), trainNumber, numCoaches)
    }
  }

  removeCoach(trainNumber, numCoaches = 1) {
    const train = this.trains[trainNumber - 1]
    if (train) {
      train.removeCoach(numCoaches)
    }
  }

  upgradeEngine(trainNumber) {
    const train = this.trains[trainNumber - 1]
    if (train) {
      train.upgradeEngine()
      //after upgrading the engine we need to disable the icon for upgrading the engine for that train. 
      // document.querySelector(`#upgradeEngineTrain${trainNumber}`).style.display = 'none'
      // Optionally, you can also add a class to indicate that the engine has been upgraded
      document.querySelector(`#upgradeEngine${trainNumber}`).classList.add('upgraded')
    }
  }

  incrementCollisionCost(ticks, train1, train2) {
    this.financials.incrementCollisionCost(this.getCurrentTimeIndex(), train1, train2)
  }

  getFinancialSummary(ticks) {
    return this.financials.getFinancialSummary(this.getCurrentTimeIndex())
  }

  getFinancialSummaryByTrain(ticks) {
    return this.financials.getFinancialSummaryByTrain(this.getCurrentTimeIndex())
  }

  // addTrack(track) {
  //   this.tracks.add(track)
  // }

  setPossibleFlyoverLocations(locations) {
    this.Flyovers.setPossibleFlyoverLocations(locations)
  }

  addFlyover(row, col) {
    const flyover = new Flyover(row, col)
    this.Flyovers.addFlyover(flyover)
  }

  getNumberOfFlyovers() {
    return this.Flyovers.getAllFlyovers().length
  }

  validateUniqueStationDistances(stations, trainNumber) {
    const seenDistances = new Map()
    for (const station of stations) {
      const distance = station.distanceFromStart
      if (seenDistances.has(distance)) {
        const firstStationName = seenDistances.get(distance)
        console.warn(
          `[Station Guard] Duplicate distanceFromStart (${distance}) for train ${trainNumber}: ${firstStationName} and ${station.name}`
        )
      } else {
        seenDistances.set(distance, station.name)
      }
    }
  }

  async addTrain(positions, numCoaches, delayBeforeStart, intersections, options = {}) {
    const overlapMatches = []
    let useParallelTrack = false
    let numSegments = 0
    let autoAssignedLane = 0

    for (const train of this.trains) {
      if (train === null) continue
      const commonSegmentsMap = getCommonSegmentsMap(positions, train.track?.positions)
      if (commonSegmentsMap.size > 0) {
        numSegments += commonSegmentsMap.size
        overlapMatches.push({
          trainNumber: train.trainNumber,
          commonSegmentsMap
        })
      }
    }
    if (numSegments > 0) {
      const overlappingTrains = overlapMatches.map(match => match.trainNumber).join(', ')
      // console.log(`The new train overlaps with existing train(s): ${overlappingTrains}.`)
      const cost = numSegments * this.financials.parallelTrackCostPerSegment
      // console.log(`Parallel track cost for ${numSegments} segments: $${cost}`)
      useParallelTrack = await this.promptUserForParallelTrack(numSegments, overlappingTrains, cost)

      if (useParallelTrack) {
        const overlapCountBySegment = new Map()
        overlapMatches.forEach((match) => {
          match.commonSegmentsMap.forEach((segment, key) => {
            overlapCountBySegment.set(key, (overlapCountBySegment.get(key) ?? 0) + 1)
          })
        })
        const maxExistingLinesOnAnySegment = overlapCountBySegment.size > 0
          ? Math.max(...overlapCountBySegment.values())
          : 0
        // Lane cycles as overlap grows: 0 -> 1 -> 2 -> 0 -> ...
        autoAssignedLane = maxExistingLinesOnAnySegment % 3
        // console.log(`[ParallelLane] overlapDepth=${maxExistingLinesOnAnySegment}, assignedLane=${autoAssignedLane}, trains=[${overlappingTrains}]`)
        if(options.runningScriptedDemo !== true) {
          this.financials.incrementExpenses(this.getCurrentTimeIndex(), null, cost, 'Parallel Track Cost')
        }
      }
    }

    // Apply freight train defaults automatically when trainType is 'freight'
    if (options.trainType === 'freight') {
      options = {
        //checking how the game looks without the visual length scale for freight trains. 
        // visualLengthScale: 0.35,
        visualLengthScale: 1,
        maxVisualCoaches: 18,
        color: 'rgba(80,80,80,0.75)',
        ...options
      }
    }

    // if there is a train that is removed and has null value in the trains array, we can reuse that train slot for the new train. This way we can keep the train number consistent and avoid issues with train numbers changing after a train is removed.
    const nullIndex = this.trains.findIndex(train => train === null)
    let trainNumber;
    if (nullIndex !== -1) {
      trainNumber = nullIndex + 1
    } else {
      trainNumber = this.trains.length + 1
    }
    const firstPosition = positions[0]
    const lastPosition = positions[positions.length - 1]

    const trackCtx = options.runningScriptedDemo ? this.ctxDemoTracks : this.ctxTracks
    const track = new Track(trackCtx, positions, '', this.gridSize, overlapMatches)

    if (firstPosition.x == lastPosition.x && firstPosition.y == lastPosition.y) {
      alert('The starting and ending positions are the same. Please choose different positions for the starting and ending points.')
      return
    } else {
      //we add stations at both starting and ending points
      track.addStation(createStation(this.canvasWidth, this.canvasHeight, trackCtx, firstPosition.x, firstPosition.y, this.gridSize, 0, trainNumber, 30))
      track.addStation(createStation(this.canvasWidth, this.canvasHeight, trackCtx, lastPosition.x, lastPosition.y, this.gridSize, 0, trainNumber, 30))
      intersections.updateIntersectionsWithStationLocation(firstPosition.y / this.gridSize, firstPosition.x / this.gridSize, true)
      intersections.updateIntersectionsWithStationLocation(lastPosition.y / this.gridSize, lastPosition.x / this.gridSize, true)
      if (!options.partOfInitialSetup && !options.runningScriptedDemo) {
        this.financials.addStation(this.getCurrentTimeIndex(), trainNumber)
        this.financials.addStation(this.getCurrentTimeIndex(), trainNumber)
      }
    }
    // if (stations.length > 1) {
    //   stations[1].distanceFromStart = track.totalLength
    // }
    this.validateUniqueStationDistances(track.stations.getAllStations(), trainNumber)
    // this.addTrack(track)
    const colorConfig = this.TRAINCONFIG[(trainNumber - 1) % this.TRAINCONFIG.length]
    const color = options.color ?? colorConfig.Color
    const trainName = options.trainName ?? colorConfig.defaultName
    const train = new Train({
      ctx: this.ctx,
      ctxTemp: this.ctxTemp,
      track,
      color,
      numCoaches,
      trainName,
      delayBeforeStart,
      trainNumber,
      intersections,
      financials: this.financials,
      travelPopulation: this.travelPopulation,
      rawMaterialDemand: this.rawmaterialDemand,
      rawMaterialSupply: this.rawmaterialSupply,
      getCurrentTimeIndex: () => this.getCurrentTimeIndex(),
      trainType: options.trainType,
      lane: options.lane ?? autoAssignedLane,
      visualLengthScale: options.visualLengthScale,
      maxVisualCoaches: options.maxVisualCoaches,
      // popups: this.popups,
      trainInfo: this.trainInfo,
      runningScriptedDemo: options.runningScriptedDemo ?? false,
    })
    const length = track.getTotalLength()
    const currentTimeIndex = this.getCurrentTimeIndex()
    if (!options.partOfInitialSetup && !options.runningScriptedDemo) {
      this.financials.incrementTrackCost(currentTimeIndex, trainNumber, length)
      this.financials.buyEngine(currentTimeIndex, trainNumber)
      this.financials.buyCoach(currentTimeIndex, trainNumber, numCoaches)
    }
    this.trains[trainNumber - 1] = train

    if (useParallelTrack) {
      overlapMatches.forEach((match) => {
        intersections.allowTrainsForCommonSegments(match.commonSegmentsMap, [match.trainNumber, trainNumber])
      })
    }

    const trainElement = document.querySelector(`#train${trainNumber}`)
    if (trainElement) {
      if (nullIndex !== -1) {
        trainElement.style.display = 'block'
      } else {
        trainElement.style.display = 'grid'
      }
      trainElement.style.backgroundColor = color
      //if freight train them disable the speed control buttons for that train
      if (options.trainType === 'freight') {
        const speedUpButton = document.querySelector(`#speedUpTrain${trainNumber}`)
        const slowDownButton = document.querySelector(`#slowDownTrain${trainNumber}`)
        if (speedUpButton) {
          speedUpButton.disabled = true
          speedUpButton.style.cursor = 'not-allowed'
        }
        if (slowDownButton) {
          slowDownButton.disabled = true
          slowDownButton.style.cursor = 'not-allowed'
        }
      }
    }
    return trainNumber
  }

  async addFreightTrain(positions, numCoaches, delayBeforeStart, intersections, options = {}) {
    return this.addTrain(positions, numCoaches, delayBeforeStart, intersections, {
      trainType: 'freight',
      // visualLengthScale: 0.35,
      visualLengthScale: 1,
      maxVisualCoaches: 18,
      color: 'rgba(80,80,80,0.75)',
      ...options
    })
  }

  async addPassengerTrain(positions, numCoaches, delayBeforeStart, intersections, options = {}) {
    return this.addTrain(positions, numCoaches, delayBeforeStart, intersections, {
      trainType: 'passenger',
      ...options
    })
  }
  startStopTrain(trainNumber) {
    if (trainNumber <= this.trains.length) {
      const el = document.querySelector(`#pauseTrain${trainNumber}`)
      if (el) {
        el.classList.toggle('fa-pause')
        el.classList.toggle('fa-play')
      }
      const train = this.trains[trainNumber - 1]
      train.startStop()
    }
  }

  setTrainLane(trainNumber, lane) {
    const train = this.trains[trainNumber - 1]
    if (train) {
      train.setLane(lane)
    }
  }

  draw() {
    this.trains.forEach((train, index) => {
      if (train) {
        // console.log(`Drawing train ${train.trainNumber}`)
        train.draw()
      }
    })
  }

  hasOtherTrainStationAt(x, y, excludedTrainNumber) {
    return this.trains.some((otherTrain, index) => {
      if (!otherTrain) {
        return false
      }
      const otherTrainNumber = index + 1
      if (otherTrainNumber === excludedTrainNumber) {
        return false
      }
      if (typeof otherTrain.track?.hasStation !== 'function') {
        return false
      }
      return otherTrain.track.hasStation(x, y)
    })
  }

  removeTrain(trainNumber) {
    console.log(`Removing train ${trainNumber} in game.removeTrain(), with number of trains: ${this.trains.length}`)  

    if (trainNumber <= this.trains.length) {
      const train = this.trains[trainNumber - 1]
      const stationLocations = new Set()
      if (train) {
        if (!train.isUserPaused()) {
          train.setUserPaused(true)
        }
        const stations = train.track?.stations?.getAllStations?.() ?? []
        stations.forEach((station) => {
          stationLocations.add(`${station.x},${station.y}`)
        })
      }

      stationLocations.forEach((locationKey) => {
        const [xStr, yStr] = locationKey.split(',')
        const x = Number(xStr)
        const y = Number(yStr)
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return
        }
        if (!this.hasOtherTrainStationAt(x, y, trainNumber)) {
          train?.intersections?.updateIntersectionsWithStationLocation(
            y / this.gridSize,
            x / this.gridSize,
            false
          )
        }
      })

      // instead of removing the train from the array, we can set the null value for the train in the array. 
      // This way we can keep the train number consistent and avoid issues with train numbers changing after a train is removed.
      this.trains[trainNumber - 1] = null
      // we remove the track for the deleted train. We do this by
      // redrawing the tracks only for the remaining trains. This is a simple way to remove the track of the deleted train without having to implement a more complex track management system.
     
     this.displayAllTracksAndStations()

      const trainElement = document.querySelector(`#train${trainNumber}`)
      if (trainElement) {
        trainElement.style='display:none'
        // trainElement.style.filter = "blur(5px)"
      }
      this.Flyovers.draw()
    }
  }

  displayAllTracksAndStations() {
    //clear the ctxTracks before redrawing all tracks and stations
    this.ctxTracks.clearRect(0, 0, this.ctxTracks.canvas.width, this.ctxTracks.canvas.height)
    // if(typeof this.drawGridCallback === 'function'){
    //   this.drawGridCallback(this.ctxTracks)
    // }
    this.trains.forEach(train => {
      if (train) {
        train.track.drawUsingNewPositions()
        const stations = train.track.stations.getAllStations()
        stations.forEach(station => {
          station.draw()
        })
      }
    })
  }

  addStation(trainNumber, x, y, name, stopDuration, options = {}) {
    if (trainNumber <= this.trains.length) {
      const train = this.trains[trainNumber - 1]
      const station = createStation(this.canvasWidth, this.canvasHeight, this.ctxTracks, x, y, this.gridSize, 0, trainNumber, stopDuration)
      train.addStation(station)
      train.intersections.updateIntersectionsWithStationLocation(y / this.gridSize, x / this.gridSize, true)
      if (!options.partOfInitialSetup && !options.runningScriptedDemo) {
        this.financials.addStation(this.getCurrentTimeIndex(), trainNumber)
      }
    }
  }
  deleteStationAt(trainNumber, x, y) {
    if (trainNumber <= this.trains.length) {
      const train = this.trains[trainNumber - 1]
      if (train) {
        const station = train.track.stations.getStationAt(x , y )
        if (station) {
          train.deleteStation(station)
          train.intersections.updateIntersectionsWithStationLocation(y / this.gridSize, x / this.gridSize, false)
          this.financials.deleteStation(this.getCurrentTimeIndex(), trainNumber)
          this.displayAllTracksAndStations()
        }
      }
    }
  }

  getCumFinancialSummaryByTrain() {
    return this.financials.getCumFinancialSummaryByTrain()
  }

  incrementTimeUnit() {
    this.rawmaterialSupply.incrementTimeUnit()
    this.rawmaterialDemand.incrementTimeUnit()

    this.financials.incrementTimeUnit()
  }

  extendTrain(trainNumber, positionsForExtendTrain) {
    const train = this.trains[trainNumber - 1]
    if (train) {
      const stationLocation = train.extendTrain(positionsForExtendTrain)
      const station = createStation(this.canvasWidth, this.canvasHeight, this.ctxTracks, stationLocation.x, stationLocation.y, this.gridSize, 0, trainNumber, 30)
      train.addStation(station)
      train.intersections.updateIntersectionsWithStationLocation(stationLocation.y / this.gridSize, stationLocation.x / this.gridSize, true)
      this.financials.addStation(this.getCurrentTimeIndex(), trainNumber)
    }
  }

  async promptUserForParallelTrack(numSegments, overlappingTrains, cost) {
    if (numSegments == 0) {
      return false
    }
    if (typeof window.swal === 'undefined' || typeof window.swal.fire !== 'function') {
      return false
    }

    const result = await window.swal.fire({
      title: 'Enable Parallel Track?',
      text: `The new train overlaps with existing train(s): ${overlappingTrains}. ${numSegments} segments overlap. Enabling parallel-track mode will add $${cost.toLocaleString('en-US')} to track costs. If you do not
      add parallel tracks, you will have to manually manage collisions.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Enable Parallel Track',
      cancelButtonText: 'Manage Collisions Manually'
    })

    return result.isConfirmed === true
  }

  getFlyovers() {
    return this.Flyovers.getAllFlyovers()
  }

  isParallelTrackEnabledForTrains(row, col, intersections, trainNumber1, trainNumber2) {
    const enabled = intersections.getAllowedTrainsAtCell(row, col).has(trainNumber1) && intersections.getAllowedTrainsAtCell(row, col).has(trainNumber2)
    // console.log(`[ParallelTrackCheck] Cell (${row}, ${col}) for trains ${trainNumber1} and ${trainNumber2}: ${enabled ? 'ENABLED' : 'DISABLED'}`  )
    return enabled
  }

  

  
}

export {
  Game
}